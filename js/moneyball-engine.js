/* ==========================================================================
   MONEYBALL ODDS ENGINE
   Dixon-Coles adjusted bivariate Poisson with a metric-fusion attack layer.

   Pipeline
   --------
   1. xG-based attack / defence ratings      -> baseline lambda
   2. Shot-profile fusion (shots, SoT, xG/shot, big misses, finishing)
   3. Creation quality via xA                -> repeatability, widens CI
   4. Defensive intensity via tackles+fouls  -> small, capped adjustment
   5. Discipline hazard via fouls+cards      -> red-card risk -> lambda shift
   6. Home-field advantage (league specific)
   7. Dixon-Coles score matrix (low-score correlation rho)
   8. Market settlement incl. full Asian quarter-line logic
   9. Expected value, fair odds, Kelly, calibrated confidence

   Every constant below is deliberately CONSERVATIVE. Fouls, tackles and cards
   are weak predictors next to xG; the classic modelling error is to overweight
   them because they are easy to collect. Caps keep them where they belong.
   ========================================================================== */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------- math -- */
  var LOGF = [0];
  for (var i = 1; i <= 40; i++) LOGF[i] = LOGF[i - 1] + Math.log(i);

  function poisson(k, lambda) {
    if (lambda <= 0) return k === 0 ? 1 : 0;
    return Math.exp(-lambda + k * Math.log(lambda) - LOGF[k]);
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function safeDiv(a, b, fallback) { return (b && isFinite(b) && b !== 0) ? a / b : fallback; }
  function round(v, d) { var m = Math.pow(10, d == null ? 2 : d); return Math.round(v * m) / m; }

  /* ------------------------------------------------------ model constants -- */
  var K = {
    MATRIX: 11,              // scorelines 0..10 per side
    RATING_PRIOR: 4.0,       // matches of prior for attack/defence shrinkage
    FINISH_PRIOR: 38,        // matches of prior for finishing regression
    VOLUME_EXP: 0.35,        // diminishing return on shot volume
    BIGMISS_PENALTY: 0.018,  // per big miss above league norm
    TACKLE_COEF: 0.035,      // opponent xG suppression per z of tackles
    FOUL_COEF: 0.022,        // opponent set-piece xG gain per z of fouls
    DEF_INTENSITY_CAP: 0.12, // +/- 12% max from tackles+fouls combined
    RED_FROM_FOULS: 0.0032,  // hazard per foul per match
    RED_FROM_YELLOW: 0.0100, // hazard per yellow per match
    RED_HIST_WEIGHT: 0.55,   // blend of historical red rate vs foul-driven
    RED_SELF_EFFECT: 0.18,   // own lambda loss weighted by time remaining
    RED_OPP_EFFECT: 0.20,    // opponent lambda gain
    LEAGUE_SHOTS: 12.8,      // reference shots/match for z-scoring
    LEAGUE_FOULS: 12.5,
    LEAGUE_TACKLES: 17.2,
    SD_SHOTS: 3.0, SD_FOULS: 2.0, SD_TACKLES: 2.4
  };

  /* ================================================== 1-6. LAMBDA MODEL == */
  /**
   * Fuse a team's raw metrics into an attack multiplier, a defence
   * multiplier, a red-card hazard and a repeatability score.
   */
  function profile(t, league) {
    var L = league.avgGoalsPerMatch / 2;                 // league xG per team
    var n = Math.max(1, t.matches || 1);

    /* --- attack & defence baseline from xG ------------------------------
       Raw xG ratios are multiplied together for the two teams, so any noise
       compounds. With a handful of matches played, an unshrunk rating pair
       produces absurd lambdas (Milan 3.00 vs Lecce 0.48). Regress each rating
       toward the league mean of 1 with a 4-match prior: strength stabilises
       faster than finishing, so the prior is much lighter than FINISH_PRIOR. */
    var wRating = n / (n + K.RATING_PRIOR);
    var atk = 1 + (safeDiv(t.xgF, L, 1) - 1) * wRating;
    var def = 1 + (safeDiv(t.xgA, L, 1) - 1) * wRating;
    var ratingWeight = wRating;

    /* --- shot profile --------------------------------------------------- */
    var xgPerShot = safeDiv(t.xgF, t.shots, 0.105);
    var volume = Math.pow(clamp(safeDiv(t.shots, K.LEAGUE_SHOTS, 1), 0.5, 1.8), K.VOLUME_EXP);
    // A team with many low-value shots is flattered by volume alone.
    var quality = clamp(xgPerShot / 0.105, 0.72, 1.35);
    var shotFusion = Math.pow(volume * Math.pow(quality, 0.65), 0.5);

    /* --- finishing, regressed hard toward the mean ---------------------- */
    var finishing = safeDiv(t.goals, t.xgF, 1);
    var shrink = n / (n + K.FINISH_PRIOR);
    var finAdj = 1 + (clamp(finishing, 0.4, 2.2) - 1) * shrink;
    finAdj -= K.BIGMISS_PENALTY * Math.max(0, (t.bigMiss || 0) - 1.1);
    finAdj = clamp(finAdj, 0.85, 1.15);

    /* --- creation quality (xA): repeatability, not a big mean shift ----- */
    var xaRatio = clamp(safeDiv(t.xA, t.xgF, 0.8), 0.35, 1.25);
    var repeatability = clamp(0.60 + 0.50 * xaRatio, 0.80, 1.12);
    // Only 25% of the repeatability signal moves the mean; the rest widens CI.
    var repeatMean = 1 + (repeatability - 1) * 0.25;

    /* --- defensive intensity: tackles suppress, fouls concede ----------- */
    var zT = (t.tackles - K.LEAGUE_TACKLES) / K.SD_TACKLES;
    var zF = (t.fouls - K.LEAGUE_FOULS) / K.SD_FOULS;
    var defIntensity = clamp(
      1 - K.TACKLE_COEF * zT + K.FOUL_COEF * zF,
      1 - K.DEF_INTENSITY_CAP, 1 + K.DEF_INTENSITY_CAP
    );

    /* --- red-card hazard ------------------------------------------------ */
    var hazard = K.RED_FROM_FOULS * t.fouls + K.RED_FROM_YELLOW * t.yellow;
    var pRed = clamp(
      K.RED_HIST_WEIGHT * (t.red || 0) + (1 - K.RED_HIST_WEIGHT) * hazard,
      0.01, 0.35
    );

    return {
      atk: atk, def: def,
      shotFusion: shotFusion, finAdj: finAdj,
      repeatability: repeatability, repeatMean: repeatMean,
      defIntensity: defIntensity, pRed: pRed,
      xgPerShot: xgPerShot, ratingWeight: ratingWeight,
      sotRate: safeDiv(t.sot, t.shots, 0.33),
      matches: n
    };
  }

  function lambdas(homeTeam, awayTeam, league, opts) {
    opts = opts || {};
    var L = league.avgGoalsPerMatch / 2;
    var H = profile(homeTeam, league);
    var A = profile(awayTeam, league);
    var hfa = opts.hfa != null ? opts.hfa : league.hfaAttack;

    var lh = L * H.atk * A.def * H.shotFusion * H.finAdj * H.repeatMean
               * A.defIntensity * hfa;
    var la = L * A.atk * H.def * A.shotFusion * A.finAdj * A.repeatMean
               * H.defIntensity * (2 - hfa);   // away side of the same HFA

    // red-card effect: own attack drops, opponent's rises
    lh *= (1 - H.pRed * K.RED_SELF_EFFECT) * (1 + A.pRed * K.RED_OPP_EFFECT);
    la *= (1 - A.pRed * K.RED_SELF_EFFECT) * (1 + H.pRed * K.RED_OPP_EFFECT);

    if (opts.tilt) { lh *= (1 + opts.tilt); la *= (1 - opts.tilt); }

    return {
      home: clamp(lh, 0.12, 5.5),
      away: clamp(la, 0.12, 5.5),
      profiles: { home: H, away: A },
      hfa: hfa
    };
  }

  /* ============================================ 7. DIXON-COLES MATRIX === */
  function tau(i, j, lh, la, rho) {
    if (i === 0 && j === 0) return 1 - lh * la * rho;
    if (i === 0 && j === 1) return 1 + lh * rho;
    if (i === 1 && j === 0) return 1 + la * rho;
    if (i === 1 && j === 1) return 1 - rho;
    return 1;
  }

  function scoreMatrix(lh, la, rho) {
    var N = K.MATRIX, M = [], total = 0, i, j, p;
    for (i = 0; i < N; i++) {
      M[i] = [];
      for (j = 0; j < N; j++) {
        p = poisson(i, lh) * poisson(j, la) * Math.max(0.02, tau(i, j, lh, la, rho));
        M[i][j] = p; total += p;
      }
    }
    for (i = 0; i < N; i++) for (j = 0; j < N; j++) M[i][j] /= total;
    return M;
  }

  /* =========================================== 8. MARKET SETTLEMENT ===== */
  /* A bet is scored per scoreline into net stake units:
     +1 full win, +0.5 half win, 0 push, -0.5 half lose, -1 full lose.
     Quarter lines are split across the two neighbouring lines and averaged,
     which is exactly how an Asian book settles them. This one function
     therefore covers every line type without special cases.                */

  function sublines(line) {
    var q = Math.abs(line * 4) % 2;         // 1 => quarter line
    return q === 1 ? [line - 0.25, line + 0.25] : [line];
  }

  function settleAH(gh, ga, line, side) {
    // line is signed from the HOME team's perspective.
    var subs = sublines(line), acc = 0;
    for (var s = 0; s < subs.length; s++) {
      var adj = (gh - ga) + subs[s];
      var res = adj > 0 ? 1 : adj < 0 ? -1 : 0;
      acc += (side === 'home' ? res : -res);
    }
    return acc / subs.length;
  }

  function settleOU(gh, ga, line, side) {
    var subs = sublines(line), acc = 0, total = gh + ga;
    for (var s = 0; s < subs.length; s++) {
      var res = total > subs[s] ? 1 : total < subs[s] ? -1 : 0;
      acc += (side === 'over' ? res : -res);
    }
    return acc / subs.length;
  }

  /**
   * Walk the score matrix once and bucket the five possible net outcomes.
   * Returns w / l (expected winning & losing stake fractions) plus the
   * full outcome distribution needed for parlay simulation.
   */
  function evaluateBet(M, settleFn) {
    var N = M.length, dist = { win: 0, halfWin: 0, push: 0, halfLose: 0, lose: 0 };
    var w = 0, l = 0, i, j, p, net;
    for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
      p = M[i][j]; if (p < 1e-12) continue;
      net = settleFn(i, j);
      if (net === 1) dist.win += p;
      else if (net === 0.5) dist.halfWin += p;
      else if (net === 0) dist.push += p;
      else if (net === -0.5) dist.halfLose += p;
      else dist.lose += p;
      if (net > 0) w += p * net; else if (net < 0) l += p * (-net);
    }
    return { dist: dist, w: w, l: l };
  }

  /* =========================================== 9. VALUE & CONFIDENCE ==== */
  var STABILITY = { ou: 0.92, ah: 0.85, x12: 0.72, oe: 0.50 };

  function lineType(line) {
    var a = Math.abs(line * 4) % 4;
    if (a === 1 || a === 3) return 'quarter';
    if (a === 2) return 'half';
    return 'whole';
  }
  function lineSafety(kind, line) {
    if (kind === 'x12' || kind === 'oe') return 1.0;
    var t = lineType(line);
    return t === 'half' ? 1.0 : t === 'quarter' ? 0.78 : 0.86;
  }

  function value(bet, odds, ctx) {
    var w = bet.w, l = bet.l;
    if (w <= 0) return null;
    var fairOdds = 1 + l / w;
    var pModel = w / (w + l);                       // push-adjusted model prob
    var ev = w * (odds - 1) - l;                    // per 1 unit staked
    var edge = odds / fairOdds - 1;
    var kelly = (odds - 1) > 0 ? ev / (odds - 1) : 0;

    var edgeScore = clamp(ev / 0.08, 0, 1);
    var dataScore = clamp(ctx.matches / 12, 0.25, 1);
    var stability = (STABILITY[ctx.kind] || 0.7)
                  * (0.85 + 0.15 * clamp(ctx.repeatability, 0.8, 1.12))
                  * (ctx.half === '1h' ? 0.82 : 1);
    var safety = lineSafety(ctx.kind, ctx.line);

    /* A model far out of line with the market is usually wrong about its own
       inputs. Penalise confidence, and refuse to promote anything to PRIME
       once the disagreement passes 25% -- that is an input-error signature,
       not an edge. An EV above 15% is likewise treated as implausible. */
    var div = ctx.divergence || 0;
    var trust = clamp(1 - div / 0.45, 0.15, 1);
    var implausible = div > 0.25 || ev > 0.15;

    /* A second model family voting the other way is evidence the edge is an
       artefact. Only applied when the Bradley-Terry offset was fitted on
       enough matches to mean anything (see calibrateOffset.reliable), and
       only to the outright-style markets it can actually speak about. */
    var crossPenalty = 1, crossState = null;
    if (ctx.cross && !ctx.cross.advisoryOnly) {
      crossState = ctx.cross.agree;
      var spreadPen = clamp(1 - ctx.cross.spread / 0.25, 0.55, 1);
      var agreeBonus = ctx.cross.agree === true ? 1.06
                     : ctx.cross.agree === false ? 0.85 : 1;
      crossPenalty = clamp(spreadPen * agreeBonus, 0.5, 1.06);
      if (ctx.cross.agree === false && ctx.cross.spread > 0.10) implausible = true;
    }
    trust = clamp(trust * crossPenalty, 0.12, 1.06);

    var confidence = 100 * (0.42 * edgeScore + 0.24 * dataScore
                          + 0.24 * clamp(stability, 0, 1) + 0.10 * safety) * trust;

    var tier = 'neutral';
    if (ev >= 0.04 && confidence >= 58 && !implausible) tier = 'prime';
    else if (ev >= 0.015 && !implausible) tier = 'value';
    else if (ev <= -0.04) tier = 'avoid';
    else if (implausible && ev > 0.015) tier = 'suspect';

    return {
      odds: odds, fairOdds: fairOdds, pModel: pModel,
      ev: ev, edge: edge, kelly: kelly,
      confidence: confidence, tier: tier,
      divergence: div, trust: trust, implausible: implausible,
      crossAgree: crossState, crossPenalty: crossPenalty,
      lineType: ctx.line == null ? null : lineType(ctx.line),
      dist: bet.dist
    };
  }

  /* Remove bookmaker margin from a set of prices (multiplicative method). */
  function devig(oddsList) {
    var inv = oddsList.map(function (o) { return 1 / o; });
    var sum = inv.reduce(function (a, b) { return a + b; }, 0);
    return { probs: inv.map(function (v) { return v / sum; }), overround: sum - 1 };
  }



  /* =============================================== ODDS FORMATS ========
     SBOBET boards switch between Decimal, Indo, Malay, HK and American.
     A number like -1.20 is Indo (decimal 1.833), NOT a decimal price -
     reading it as one silently corrupts every EV downstream.
     ===================================================================== */
  var FORMATS = ['decimal', 'indo', 'malay', 'hk', 'american'];

  function toDecimal(v, format) {
    v = parseFloat(v);
    if (!isFinite(v)) return null;
    switch (format) {
      case 'decimal':  return v > 1 ? v : null;
      case 'hk':       return v > 0 ? v + 1 : null;
      case 'indo':     // |v| >= 1 ; positive = underdog, negative = favourite
        if (v >= 1)  return v + 1;
        if (v <= -1) return 1 + 1 / (-v);
        return null;
      case 'malay':    // |v| <= 1 ; positive = favourite, negative = underdog
        if (v > 0 && v <= 1)   return 1 + v;
        if (v < 0 && v >= -1)  return 1 + 1 / (-v);
        return null;
      case 'american':
        if (v >= 100)  return 1 + v / 100;
        if (v <= -100) return 1 + 100 / (-v);
        return null;
      default: return null;
    }
  }

  function fromDecimal(dec, format) {
    dec = parseFloat(dec);
    if (!isFinite(dec) || dec <= 1) return null;
    var profit = dec - 1;
    switch (format) {
      case 'decimal':  return dec;
      case 'hk':       return profit;
      case 'indo':     return profit >= 1 ? profit : -1 / profit;
      case 'malay':    return profit <= 1 ? profit : -1 / profit;
      case 'american': return profit >= 1 ? profit * 100 : -100 / profit;
      default: return null;
    }
  }

  /** Guess which format a set of printed prices is in. */
  function detectFormat(values) {
    var v = values.map(parseFloat).filter(isFinite);
    if (!v.length) return 'decimal';
    var abs = v.map(Math.abs);
    var anyNeg = v.some(function (x) { return x < 0; });
    var maxAbs = Math.max.apply(null, abs), minAbs = Math.min.apply(null, abs);
    if (maxAbs >= 100) return 'american';
    if (!anyNeg && minAbs > 1.01) return 'decimal';
    if (anyNeg && minAbs >= 1) return 'indo';
    if (anyNeg && maxAbs <= 1) return 'malay';
    if (!anyNeg && maxAbs <= 1) return 'hk';
    return 'indo';
  }

  /* ============================================ MARKET ANCHORING ========
     The closing line is the single strongest football predictor there is.
     A model that disagrees with it by 40% is almost always wrong about its
     own inputs, not right about the market. So: recover the lambdas the
     offered prices imply, then shrink the model toward them. marketWeight
     = 0 is pure model (dangerous), 1 is pure market (EV always ~0, but
     honest). The default 0.35 keeps model signal while refusing to bet
     against the market on a rounding error.
     ===================================================================== */

  /** Collect de-vigged market probabilities we can fit against. */
  function marketTargets(fx, half) {
    var mk = (fx.markets || {})[half || 'ft']; if (!mk) return [];
    var out = [];
    if (mk.x12 && mk.x12['1'] && mk.x12.X && mk.x12['2']) {
      var dv = devig([mk.x12['1'], mk.x12.X, mk.x12['2']]);
      out.push({ type: 'x12', probs: dv.probs, weight: 1.0 });
    }
    // main O/U line = the one whose two prices are closest to even
    var best = null;
    (mk.ou || []).forEach(function (r) {
      if (r.o == null || r.u == null) return;
      var skew = Math.abs(1 / r.o - 1 / r.u);
      if (!best || skew < best.skew) best = { skew: skew, r: r };
    });
    if (best) {
      var dvo = devig([best.r.o, best.r.u]);
      out.push({ type: 'ou', line: best.r.line, probs: dvo.probs, weight: 1.2 });
    }
    var bestA = null;
    (mk.ah || []).forEach(function (r) {
      if (r.h == null || r.a == null) return;
      var skew = Math.abs(1 / r.h - 1 / r.a);
      if (!bestA || skew < bestA.skew) bestA = { skew: skew, r: r };
    });
    if (bestA) {
      var dva = devig([bestA.r.h, bestA.r.a]);
      out.push({ type: 'ah', line: bestA.r.line, probs: dva.probs, weight: 1.0 });
    }
    return out;
  }

  function fitError(lh, la, rho, targets) {
    var M = scoreMatrix(lh, la, rho), err = 0;
    for (var t = 0; t < targets.length; t++) {
      var T = targets[t], p;
      if (T.type === 'x12') {
        var o = outrightProbs(M);
        err += T.weight * (Math.pow(o.home - T.probs[0], 2)
                         + Math.pow(o.draw - T.probs[1], 2)
                         + Math.pow(o.away - T.probs[2], 2));
      } else if (T.type === 'ou') {
        var b = evaluateBet(M, function (i, j) { return settleOU(i, j, T.line, 'over'); });
        p = b.w / (b.w + b.l);
        err += T.weight * 2 * Math.pow(p - T.probs[0], 2);
      } else {
        var ba = evaluateBet(M, function (i, j) { return settleAH(i, j, T.line, 'home'); });
        p = ba.w / (ba.w + ba.l);
        err += T.weight * 2 * Math.pow(p - T.probs[0], 2);
      }
    }
    return err;
  }

  /** Coarse-to-fine grid search for the lambdas the prices imply.
      Each axis keeps its OWN window so the refinement does not collapse
      both lambdas into a shared range. */
  function impliedLambdas(fx, league, seed, half) {
    half = half || 'ft';
    var targets = marketTargets(fx, half);
    if (!targets.length) return null;
    var rho = half === '1h' ? league.rhoHT : league.rhoFT;
    var hLo = 0.20, hHi = 4.20, aLo = 0.20, aHi = 4.20, step = 0.20;
    var bh = seed ? seed.home : 1.4, ba = seed ? seed.away : 1.2;
    var bestErr = Infinity;

    for (var pass = 0; pass < 4; pass++) {
      var passBest = Infinity, ph = bh, pa = ba;
      for (var h = hLo; h <= hHi + 1e-9; h += step) {
        for (var a = aLo; a <= aHi + 1e-9; a += step) {
          var e = fitError(h, a, rho, targets);
          if (e < passBest) { passBest = e; ph = h; pa = a; }
        }
      }
      if (!isFinite(passBest)) return null;
      bh = ph; ba = pa; bestErr = passBest;
      hLo = Math.max(0.12, bh - step); hHi = bh + step;
      aLo = Math.max(0.12, ba - step); aHi = ba + step;
      step = step / 4;
    }
    return {
      home: bh, away: ba,
      rmse: Math.sqrt(bestErr / targets.length),
      targets: targets.length
    };
  }

  /* ===================================================== FIXTURE RUN ==== */
  function analyseFixture(fx, teams, leagues, opts) {
    opts = opts || {};
    var league = leagues.filter(function (L) { return L.id === fx.league; })[0];
    var home = teams[fx.home], away = teams[fx.away];
    if (!league) throw new Error('Unknown league "' + fx.league + '" on fixture ' + fx.id);
    if (!home)   throw new Error('Unknown team "' + fx.home + '" (home) on fixture ' + fx.id);
    if (!away)   throw new Error('Unknown team "' + fx.away + '" (away) on fixture ' + fx.id);
    var lam = lambdas(home, away, league, opts);

    /* --- shrink the model toward what the prices imply ------------------ */
    var mw = opts.marketWeight != null ? opts.marketWeight : 0.35;

    /* With no real xG input there is nothing to disagree with the market
       about, so the only honest model IS the market: force a full anchor and
       say so, rather than inventing an edge out of placeholder numbers. */
    var statsMissing = !!(home.statsMissing || away.statsMissing);
    if (statsMissing) mw = 1;
    var implied = impliedLambdas(fx, league, { home: lam.home, away: lam.away });
    var rawH = lam.home, rawA = lam.away, lamH = rawH, lamA = rawA;
    var divergence = null;
    if (implied && mw > 0) {
      lamH = rawH * (1 - mw) + implied.home * mw;
      lamA = rawA * (1 - mw) + implied.away * mw;
    }
    if (implied) {
      divergence = (Math.abs(rawH - implied.home) + Math.abs(rawA - implied.away))
                 / Math.max(0.5, implied.home + implied.away);
    }

    /* --- first half ------------------------------------------------------
       Scaling the full-time lambdas by a fixed share is crude: books price
       the first half with its own, flatter goal expectation. Where 1H prices
       exist, fit them directly and blend by the same marketWeight; otherwise
       fall back to the league's first-half share. */
    var share = league.firstHalfShare;
    var lamH1 = lamH * share, lamA1 = lamA * share;
    var implied1h = impliedLambdas(fx, league, { home: lamH1, away: lamA1 }, '1h');
    if (implied1h && mw > 0) {
      lamH1 = lamH1 * (1 - mw) + implied1h.home * mw;
      lamA1 = lamA1 * (1 - mw) + implied1h.away * mw;
    }

    var mFT = scoreMatrix(lamH, lamA, league.rhoFT);
    var mHT = scoreMatrix(lamH1, lamA1, league.rhoHT);

    var matches = Math.min(lam.profiles.home.matches, lam.profiles.away.matches);
    var repeat = (lam.profiles.home.repeatability + lam.profiles.away.repeatability) / 2;

    /* second-family sanity check (Bradley-Terry) where stats allow it */
    var cross = null;
    if (opts.calibration) {
      try {
        cross = crossCheck({
          league: league, home: home, away: away,
          outright: outrightProbs(mFT), fixture: fx
        }, opts.calibration);
        if (cross && !opts.calibration.reliable) cross.advisoryOnly = true;
      } catch (e) { cross = null; }
    }

    var picks = [];

    function pushBet(half, kind, label, line, side, odds, M, counterOdds) {
      if (odds == null || !isFinite(odds) || odds <= 1) return;
      var fn;
      if (kind === 'ah') fn = function (i, j) { return settleAH(i, j, line, side); };
      else if (kind === 'ou') fn = function (i, j) { return settleOU(i, j, line, side); };
      else if (kind === 'x12') fn = function (i, j) {
        var r = i > j ? '1' : i < j ? '2' : 'X';
        return r === side ? 1 : -1;
      };
      else fn = function (i, j) {
        var isOdd = ((i + j) % 2) === 1;
        return (side === 'odd') === isOdd ? 1 : -1;
      };
      var bet = evaluateBet(M, fn);
      var v = value(bet, odds, {
        kind: kind, line: line, matches: matches,
        repeatability: repeat, half: half, divergence: divergence,
        cross: cross
      });
      if (!v) return;

      /* --- the bookmaker's margin on THIS pair ---------------------------
         Without real stat input there is no edge to find, but the vig you
         pay is always knowable: it is the single biggest controllable cost
         in a parlay, because it compounds once per leg. */
      v.vig = null; v.pFairMarket = null;
      if (counterOdds != null && isFinite(counterOdds) && counterOdds > 1) {
        var dv = devig([odds, counterOdds]);
        v.vig = dv.overround;
        v.pFairMarket = dv.probs[0];
      }

      /* Leg efficiency, for ranking parlay legs.
         The first version of this multiplied the probability by a flat
         constant per line type. That was too crude, and two real settled
         coupons showed why: across 18 legs, half lines returned 100% of
         their printed odds, whole lines 88% and quarter lines 64%. The
         leakage is structural, not bad luck - a push pays 1.0x and wipes the
         leg's odds entirely, a half-lose pays 0.5x, and in a parlay both
         silently delete the payout you were counting on.
         So rank by the probability mass that actually pays FULL odds, giving
         half-wins half credit and pushes and half-loses none, then discount
         by the margin paid. A whole line with 42% push risk now scores far
         below one with 15%, which a flat constant could never express. */
      var vigCost = v.vig != null ? v.vig : 0.06;
      var cleanWin = (bet.dist.win || 0) + 0.5 * (bet.dist.halfWin || 0);
      v.cleanWin = cleanWin;
      v.pushRisk = (bet.dist.push || 0);
      v.halfRisk = (bet.dist.halfWin || 0) + (bet.dist.halfLose || 0);
      v.efficiency = cleanWin * (1 - vigCost * 2.2);

      v.id = fx.id + '|' + half + '|' + kind + '|' + (line == null ? side : line + '|' + side);
      v.fixtureId = fx.id;
      v.half = half; v.kind = kind; v.label = label; v.side = side; v.line = line;
      picks.push(v);
    }

    ['ft', '1h'].forEach(function (half) {
      var mk = (fx.markets || {})[half]; if (!mk) return;
      var M = half === 'ft' ? mFT : mHT;
      var tag = half === '1h' ? 'HT ' : '';

      (mk.ah || []).forEach(function (r) {
        pushBet(half, 'ah', tag + home.name + ' ' + fmtLine(r.line), r.line, 'home', r.h, M, r.a);
        pushBet(half, 'ah', tag + away.name + ' ' + fmtLine(-r.line), r.line, 'away', r.a, M, r.h);
      });
      (mk.ou || []).forEach(function (r) {
        pushBet(half, 'ou', tag + 'Over ' + r.line.toFixed(2), r.line, 'over', r.o, M, r.u);
        pushBet(half, 'ou', tag + 'Under ' + r.line.toFixed(2), r.line, 'under', r.u, M, r.o);
      });
      if (mk.x12) {
        // 1X2 is a three-way market: its margin is spread over all three.
        var x3 = (mk.x12['1'] && mk.x12.X && mk.x12['2'])
               ? devig([mk.x12['1'], mk.x12.X, mk.x12['2']]) : null;
        [['1', mk.x12['1'], home.name + ' Menang', 0],
         ['X', mk.x12.X, 'Seri', 1],
         ['2', mk.x12['2'], away.name + ' Menang', 2]].forEach(function (row) {
          pushBet(half, 'x12', tag + row[2], null, row[0], row[1], M);
          if (x3) {
            var last = picks[picks.length - 1];
            if (last && last.side === row[0] && last.half === half && last.kind === 'x12') {
              last.vig = x3.overround / 3;   // per-outcome share of a 3-way margin
              last.pFairMarket = x3.probs[row[3]];
              last.efficiency = last.pFairMarket * (1 - (x3.overround / 3) * 2.2);
            }
          }
        });
      }
      if (mk.oe) {
        pushBet(half, 'oe', tag + 'Total Ganjil', null, 'odd', mk.oe.odd, M, mk.oe.even);
        pushBet(half, 'oe', tag + 'Total Genap', null, 'even', mk.oe.even, M, mk.oe.odd);
      }
    });

    /* How to rank, and what "best" means, depends on whether expected value
       carries any information here. Under a full market anchor the model was
       fitted to these very prices, so EV is just the bookmaker's margin with
       a minus sign: every row is negative, nothing ever clears the value
       tier, and the board highlights nothing while the parlay builder
       happily selects legs. Two criteria on one screen again.
       So: with real information, rank by EV. Without it, rank by the same
       full-payout efficiency the parlay selector uses, and mark the best of
       those. One function, both paths. */
    var rankByEV = mw < 0.999 && !statsMissing;
    picks.sort(rankByEV
      ? function (a, b) { return b.ev - a.ev || b.confidence - a.confidence; }
      : function (a, b) { return (b.efficiency || 0) - (a.efficiency || 0); });
    picks.forEach(function (p) { p.rankedBy = rankByEV ? 'ev' : 'efficiency'; });

    return {
      fixture: fx, league: league, home: home, away: away,
      cross: cross,
      lambdas: { home: lamH, away: lamA,
                 home1h: lamH1, away1h: lamA1,
                 impliedHome1h: implied1h ? implied1h.home : null,
                 impliedAway1h: implied1h ? implied1h.away : null,
                 rawHome: rawH, rawAway: rawA,
                 impliedHome: implied ? implied.home : null,
                 impliedAway: implied ? implied.away : null },
      marketWeight: mw, statsMissing: statsMissing,
      implied: implied, implied1h: implied1h, divergence: divergence,
      profiles: lam.profiles,
      matrixFT: mFT, matrixHT: mHT,
      outright: outrightProbs(mFT),
      outright1h: outrightProbs(mHT),
      totals: totalGoalsDist(mFT),
      picks: picks,
      rankedBy: rankByEV ? 'ev' : 'efficiency',
      /* With no information of our own, the best available leg is the one
         that keeps most of its printed odds after margin - not one with a
         positive expected value, because none exists. */
      best: rankByEV
        ? (picks.filter(function (p) { return p.tier === 'prime' || p.tier === 'value'; })[0] || null)
        : (picks.filter(function (p) {
             return (p.kind === 'ah' || p.kind === 'ou') && mixParlayEligible(p);
           })[0] || null),
      suspects: picks.filter(function (p) { return p.tier === 'suspect'; }).length,
      dataQuality: matches
    };
  }

  function outrightProbs(M) {
    var N = M.length, h = 0, d = 0, a = 0, btts = 0, i, j;
    for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
      if (i > j) h += M[i][j]; else if (i < j) a += M[i][j]; else d += M[i][j];
      if (i > 0 && j > 0) btts += M[i][j];
    }
    return { home: h, draw: d, away: a, btts: btts };
  }

  function totalGoalsDist(M) {
    var N = M.length, out = [], i, j;
    for (i = 0; i < 2 * N - 1; i++) out[i] = 0;
    for (i = 0; i < N; i++) for (j = 0; j < N; j++) out[i + j] += M[i][j];
    return out.slice(0, 9);
  }

  function fmtLine(l) {
    if (l === 0) return '0.00';
    return (l > 0 ? '+' : '') + l.toFixed(2);
  }

  /* ================================================ PARLAY SIMULATOR === */
  /* Reproduces Asian parlay settlement exactly: a half-lose leg pays 0.5x,
     a half-win leg pays 1 + (odds-1)/2, a push pays 1.0x. This is why a
     printed 73x ticket can cash at 5x.                                    */
  function legMultiplier(outcome, odds) {
    switch (outcome) {
      case 'win':      return odds;
      case 'halfWin':  return 1 + (odds - 1) / 2;
      case 'push':     return 1;
      case 'halfLose': return 0.5;
      default:         return 0;
    }
  }

  /** Exact expected multiplier for one leg. Zero variance - no simulation. */
  function legExpectedMultiplier(leg) {
    var d = leg.dist, o = leg.odds, e = 0;
    e += (d.win      || 0) * legMultiplier('win', o);
    e += (d.halfWin  || 0) * legMultiplier('halfWin', o);
    e += (d.push     || 0) * legMultiplier('push', o);
    e += (d.halfLose || 0) * legMultiplier('halfLose', o);
    e += (d.lose     || 0) * legMultiplier('lose', o);
    return e;
  }

  function simulateParlay(legs, trials, seed) {
    trials = trials || 20000;
    var s = seed || 123456789;
    function rnd() { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); }

    var keys = ['win', 'halfWin', 'push', 'halfLose', 'lose'];
    var printed = legs.reduce(function (a, L) { return a * L.odds; }, 1);

    /* The mean return is the PRODUCT of the per-leg expected multipliers,
       because legs are settled independently. Estimating it by simulation
       instead is a mistake: a parlay's payoff distribution is dominated by
       rare large wins, so the sample mean stays noisy even at 40k trials
       (swings of several percentage points at nine legs). Compute it
       exactly and use the simulation only for the quantities that need it -
       probability of profit, median, upper percentile. */
    var expectedReturn = 1, allWinP = 1;
    legs.forEach(function (L) {
      expectedReturn *= legExpectedMultiplier(L);
      allWinP *= ((L.dist.win || 0) + (L.dist.halfWin || 0));
    });

    var profitCount = 0, returns = [];
    for (var t = 0; t < trials; t++) {
      var mult = 1;
      for (var i = 0; i < legs.length; i++) {
        var r = rnd(), cum = 0, chosen = 'lose';
        for (var k = 0; k < keys.length; k++) {
          cum += legs[i].dist[keys[k]] || 0;
          if (r <= cum) { chosen = keys[k]; break; }
        }
        mult *= legMultiplier(chosen, legs[i].odds);
        if (mult === 0) break;
      }
      if (mult > 1) profitCount++;
      returns.push(mult);
    }
    returns.sort(function (a, b) { return a - b; });

    return {
      legs: legs.length,
      printedOdds: printed,
      expectedReturn: expectedReturn,          // exact
      ev: expectedReturn - 1,                  // exact
      pProfit: profitCount / trials,           // simulated
      pAllWin: allWinP,                        // exact
      median: returns[Math.floor(trials / 2)],
      p90: returns[Math.floor(trials * 0.9)],
      quarterLegs: legs.filter(function (L) { return L.lineType === 'quarter'; }).length,
      expectedCashMultiple: expectedReturn,
      drag: printed > 0 ? 1 - expectedReturn / printed : 0,
      trials: trials
    };
  }


  /* ======================================= BRADLEY-TERRY CROSS-CHECK ====
     From Stuart Coles' Smartodds note on the Opta Million. Three ideas there
     are worth taking, and one is worth refusing.

     TAKEN 1 - the paired-comparison model  P(i beats j) = S_i / (S_i + S_j).
     This is Bradley-Terry. It is a weaker model than Dixon-Coles for betting,
     because it says nothing about scorelines and so cannot price a handicap
     or a total. Its value here is that it is a DIFFERENT model family: when
     Bradley-Terry and Dixon-Coles disagree with the market in the same
     direction, that is a stronger signal than either alone. When they
     disagree with each other, the edge is probably a modelling artefact and
     confidence should fall. That is what this module is for.

     TAKEN 2 - the offset  S = R - 1350.  Coles calls it trial-and-error, but
     it is the most transferable point in the piece: in a RATIO model the
     zero point of the rating scale controls how much spread the model
     produces. FIFA points sit around 1600-1850, so raw ratings make every
     match look near-even (1850/(1850+1600) = 0.54); subtracting 1350 lets
     the differences dominate. Rather than guess the offset, calibrateOffset
     fits it by least squares against de-vigged market prices.

     REFUSED - the headline. The article's own arithmetic is that the optimal
     strategy is ~26,000x better than random and still 3.6e-12 in absolute
     terms. That is the same mathematics as a nine-leg parlay: per-leg
     optimisation multiplies, but it cannot outrun the number of legs. See
     compoundingArithmetic below, which states that plainly in numbers.
     ===================================================================== */

  /** A single positive strength number per team, on a points-like scale. */
  function ratingBase(t, league) {
    if (t.statsMissing || t.xgF == null || t.xgA == null) return null;
    var L = league.avgGoalsPerMatch / 2;
    // centred at 100 for a league-average team; 100 points per goal of xG diff
    return 100 + 100 * ((t.xgF - t.xgA) / Math.max(0.2, L));
  }

  function btProb(Sh, Sa) {
    if (!(Sh > 0) || !(Sa > 0)) return null;
    return Sh / (Sh + Sa);
  }

  /**
   * Least-squares fit of the rating offset against de-vigged market prices.
   * Only fixtures with real stats on BOTH teams and a usable 1X2 market can
   * contribute - anything else would be fitting the market to itself.
   */
  function calibrateOffset(fixtures, teams, leagues, hfaLogit) {
    hfaLogit = hfaLogit == null ? 0.22 : hfaLogit;   // home edge on the BT scale
    var obs = [];
    fixtures.forEach(function (fx) {
      var lg = leagues.filter(function (l) { return l.id === fx.league; })[0];
      if (!lg) return;
      var h = teams[fx.home], a = teams[fx.away];
      if (!h || !a) return;
      var rh = ratingBase(h, lg), ra = ratingBase(a, lg);
      if (rh == null || ra == null) return;
      var mk = (fx.markets || {}).ft;
      if (!mk || !mk.x12 || !mk.x12['1'] || !mk.x12.X || !mk.x12['2']) return;
      var dv = devig([mk.x12['1'], mk.x12.X, mk.x12['2']]);
      var decisive = dv.probs[0] + dv.probs[2];
      if (decisive < 0.4) return;
      obs.push({ rh: rh, ra: ra, target: dv.probs[0] / decisive });
    });
    if (obs.length < 3) return { offset: null, n: obs.length, rmse: null };

    var minR = Math.min.apply(null, obs.map(function (o) { return Math.min(o.rh, o.ra); }));
    var best = null;
    // grid then refine, same shape as the lambda fit
    var lo = minR - 400, hi = minR - 1, step = 10;
    for (var pass = 0; pass < 4; pass++) {
      var bestPass = null;
      for (var off = lo; off <= hi; off += step) {
        var err = 0;
        for (var i = 0; i < obs.length; i++) {
          var Sh = (obs[i].rh - off) * (1 + hfaLogit);
          var Sa = (obs[i].ra - off);
          var p = btProb(Sh, Sa);
          if (p == null) { err = Infinity; break; }
          err += Math.pow(p - obs[i].target, 2);
        }
        if (bestPass == null || err < bestPass.err) bestPass = { off: off, err: err };
      }
      if (!bestPass || !isFinite(bestPass.err)) return { offset: null, n: obs.length, rmse: null };
      best = bestPass;
      lo = best.off - step; hi = best.off + step; step = step / 4;
    }
    var rmse = Math.sqrt(best.err / obs.length);
    return {
      offset: best.off, n: obs.length, rmse: rmse, hfaLogit: hfaLogit,
      /* One offset fitted from a handful of matches is not a calibration, it
         is a coincidence. Below six observations, or with a poor fit, the
         cross-check is shown but never allowed to move confidence. */
      reliable: obs.length >= 6 && rmse < 0.075,
      boundary: Math.abs(best.off - (minR - 1)) < 1e-6
    };
  }

  /**
   * Compare the three views of the same match: Dixon-Coles, Bradley-Terry and
   * the market, all on the "home wins given a decisive result" scale so they
   * are directly comparable.
   */
  function crossCheck(a, calib) {
    if (!calib || calib.offset == null) return null;
    var lg = a.league;
    var rh = ratingBase(a.home, lg), ra = ratingBase(a.away, lg);
    if (rh == null || ra == null) return null;

    var Sh = (rh - calib.offset) * (1 + (calib.hfaLogit || 0.22));
    var Sa = (ra - calib.offset);
    var bt = btProb(Sh, Sa);
    if (bt == null) return null;

    var o = a.outright;
    var dec = o.home + o.away;
    if (dec <= 0) return null;
    var dc = o.home / dec;

    var mkt = null;
    var mk = (a.fixture.markets || {}).ft;
    if (mk && mk.x12 && mk.x12['1'] && mk.x12.X && mk.x12['2']) {
      var dv = devig([mk.x12['1'], mk.x12.X, mk.x12['2']]);
      var d2 = dv.probs[0] + dv.probs[2];
      if (d2 > 0) mkt = dv.probs[0] / d2;
    }

    var spread = Math.abs(dc - bt);
    var agree = null;
    if (mkt != null) {
      // do both models lean the same way against the market?
      var dcLean = dc - mkt, btLean = bt - mkt;
      agree = (dcLean > 0 && btLean > 0) || (dcLean < 0 && btLean < 0);
    }
    return {
      dc: dc, bt: bt, market: mkt, spread: spread, agree: agree,
      strengthHome: Sh, strengthAway: Sa,
      ratingHome: rh, ratingAway: ra, offset: calib.offset
    };
  }

  /* ============================== THE COMPOUNDING ARITHMETIC ===========
     The Opta Million calculation, restated for a parlay. Coles' point is
     that an optimal strategy beat random by ~26,000x and was still hopeless,
     because both numbers get raised to the power of the number of
     predictions. Same here: choosing better legs raises the base, but the
     exponent is what kills the ticket.
     ===================================================================== */
  function compoundingArithmetic(legProbs, randomProb) {
    randomProb = randomProb == null ? 0.5 : randomProb;
    var n = legProbs.length;
    if (!n) return null;
    var pOpt = legProbs.reduce(function (x, p) { return x * p; }, 1);
    var pRand = Math.pow(randomProb, n);
    var avg = legProbs.reduce(function (x, p) { return x + p; }, 0) / n;
    return {
      legs: n,
      avgLegProb: avg,
      pOptimal: pOpt,
      pRandom: pRand,
      improvementFactor: pRand > 0 ? pOpt / pRand : Infinity,
      oneIn: pOpt > 0 ? 1 / pOpt : Infinity,
      /* how many legs the same per-leg quality could carry before the ticket
         drops under a 1-in-20 chance - the practical answer to "how long
         should my ticket be?" */
      legsForOneIn20: avg > 0 && avg < 1
        ? Math.floor(Math.log(0.05) / Math.log(avg)) : null
    };
  }


  /* ================================================ CALIBRATION ========
     "Are you accurate?" is not a question to answer with a claim. It is a
     measurement. These helpers grade real settled coupons against what the
     model said beforehand, and score the result.

     The metric is the Brier score: mean((p - outcome)^2), lower is better.
     A model that always says 50% scores 0.25 on any sequence. Beating 0.25
     means the probabilities carry information; losing to it means they are
     worse than a shrug. Half-win and half-lose count as an outcome of 0.75
     and 0.25 respectively, since a quarter line really does settle at half
     stake on each side.

     With 18 legs nothing here is statistically significant. The point is the
     method and the ledger: every coupon added makes the number mean more,
     and the number is allowed to be unflattering.
     ===================================================================== */
  var OUTCOME_VALUE = { win: 1, halfWin: 0.75, push: 0.5, halfLose: 0.25, lose: 0 };

  /** Settle a leg from a recorded score, independent of what anyone claimed. */
  function settleFromScore(leg) {
    var raw = leg.half === '1h' ? leg.score1h : leg.score;
    if (!raw || typeof raw !== 'string' || raw.indexOf(':') < 0) return null;
    var parts = raw.split(':');
    var gh = parseInt(parts[0], 10), ga = parseInt(parts[1], 10);
    if (!isFinite(gh) || !isFinite(ga)) return null;
    var net;
    if (leg.kind === 'ah')      net = settleAH(gh, ga, leg.line, leg.side);
    else if (leg.kind === 'ou') net = settleOU(gh, ga, leg.line, leg.side);
    else if (leg.kind === 'x12') {
      var r = gh > ga ? '1' : gh < ga ? '2' : 'X';
      net = r === leg.side ? 1 : -1;
    } else if (leg.kind === 'oe') {
      var isOdd = ((gh + ga) % 2) === 1;
      net = (leg.side === 'odd') === isOdd ? 1 : -1;
    } else return null;
    return net === 1 ? 'win' : net === 0.5 ? 'halfWin' : net === 0 ? 'push'
         : net === -0.5 ? 'halfLose' : 'lose';
  }

  /**
   * Grade one coupon. For each leg: what the model's probability was, what
   * actually happened, and whether the two agree. A leg whose fixture is not
   * in the dataset still grades on the recorded outcome, it just carries no
   * model probability and is excluded from the Brier score.
   */
  function gradeCoupon(coupon, analysesById) {
    var rows = coupon.legs.map(function (leg) {
      var derived = settleFromScore(leg);
      var outcome = derived || leg.outcome || null;
      var mismatch = !!(derived && leg.outcome && derived !== leg.outcome);

      var pModel = null, pMarket = null, modelPick = null;
      var a = leg.fixtureId ? analysesById[leg.fixtureId] : null;
      if (a) {
        var match = a.picks.filter(function (pk) {
          return pk.kind === leg.kind && pk.half === leg.half && pk.side === leg.side &&
                 (leg.line == null ? pk.line == null : Math.abs(pk.line - leg.line) < 1e-9);
        })[0];
        if (match) {
          pModel = match.pModel;
          pMarket = match.pFairMarket;
          modelPick = match;
        }
      }
      return {
        leg: leg, outcome: outcome, derivedFromScore: !!derived,
        outcomeMismatch: mismatch,
        value: outcome ? OUTCOME_VALUE[outcome] : null,
        pModel: pModel, pMarket: pMarket, pick: modelPick,
        legMultiplier: outcome && leg.odds ? legMultiplier(outcome, leg.odds) : null
      };
    });

    var mult = 1, known = 0;
    rows.forEach(function (r) {
      if (r.legMultiplier != null) { mult *= r.legMultiplier; known++; }
    });

    var scored = rows.filter(function (r) { return r.pModel != null && r.value != null; });
    var brier = null, brierMarket = null, brierBaseline = null;
    if (scored.length) {
      brier = scored.reduce(function (x, r) {
        return x + Math.pow(r.pModel - r.value, 2);
      }, 0) / scored.length;
      var withMkt = scored.filter(function (r) { return r.pMarket != null; });
      if (withMkt.length) {
        brierMarket = withMkt.reduce(function (x, r) {
          return x + Math.pow(r.pMarket - r.value, 2);
        }, 0) / withMkt.length;
      }
      brierBaseline = scored.reduce(function (x, r) {
        return x + Math.pow(0.5 - r.value, 2);
      }, 0) / scored.length;
    }

    return {
      coupon: coupon, rows: rows,
      legsKnown: known, legsTotal: rows.length,
      grossMultiple: known === rows.length ? mult : null,
      scoredLegs: scored.length,
      brier: brier, brierMarket: brierMarket, brierBaseline: brierBaseline,
      beatsCoinFlip: brier != null && brierBaseline != null ? brier < brierBaseline : null,
      wins: rows.filter(function (r) { return r.outcome === 'win'; }).length,
      halves: rows.filter(function (r) {
        return r.outcome === 'halfWin' || r.outcome === 'halfLose';
      }).length,
      losses: rows.filter(function (r) { return r.outcome === 'lose'; }).length
    };
  }

  /** Aggregate calibration across coupons, bucketed by stated probability. */
  function calibrationReport(grades) {
    var all = [];
    grades.forEach(function (g) {
      g.rows.forEach(function (r) {
        if (r.pModel != null && r.value != null) all.push(r);
      });
    });
    if (!all.length) return null;
    var buckets = [[0, 0.45], [0.45, 0.55], [0.55, 0.65], [0.65, 1.01]].map(function (b) {
      var inB = all.filter(function (r) { return r.pModel >= b[0] && r.pModel < b[1]; });
      return {
        lo: b[0], hi: b[1], n: inB.length,
        meanP: inB.length ? inB.reduce(function (x, r) { return x + r.pModel; }, 0) / inB.length : null,
        meanActual: inB.length ? inB.reduce(function (x, r) { return x + r.value; }, 0) / inB.length : null
      };
    });
    var brier = all.reduce(function (x, r) { return x + Math.pow(r.pModel - r.value, 2); }, 0) / all.length;
    var baseline = all.reduce(function (x, r) { return x + Math.pow(0.5 - r.value, 2); }, 0) / all.length;
    return {
      n: all.length, brier: brier, brierBaseline: baseline,
      skill: baseline > 0 ? 1 - brier / baseline : null,
      buckets: buckets,
      /* Anything under about 50 graded legs is a story, not a statistic. */
      significant: all.length >= 50
    };
  }

  /* ============================================ PARLAY LEG SELECTOR ====
     Building a parlay is a different problem from finding a value bet.
     Multiplying odds multiplies the vig too, so leg choice is dominated by
     three controllable costs:
       1. margin paid per leg (vig)      - compounds once per leg
       2. quarter-line payout drag       - can cut a winning ticket by 90%
       3. probability of the leg landing
     With real stat input, EV leads. Without it, EV is zero by construction
     and these three are all that is left - which is still worth optimising.
     ===================================================================== */
  /* Mix Parlay is NOT the same menu as single bets. Books strip out the legs
     most likely to be mispriced in the punter's favour - short-priced
     favourites above all - by imposing a minimum price per leg (commonly
     around 1.50 decimal). That is why a heavy favourite's 1X2 disappears
     from the parlay menu and only awkward alternatives remain: a big Over, a
     deep handicap on the underdog, or an Under. MIX_PARLAY_MIN_ODDS models
     that restriction so the selector only ever proposes legs that are
     actually available to bet. */
  var MIX_PARLAY_MIN_ODDS = 1.50;

  function mixParlayEligible(pick, minOdds) {
    return pick.odds >= (minOdds != null ? minOdds : MIX_PARLAY_MIN_ODDS);
  }

  function pickParlayLegs(analyses, opts) {
    opts = opts || {};
    var n = opts.legs || 9;
    var allowQuarter = !!opts.allowQuarter;
    var minProb = opts.minProb != null ? opts.minProb : 0.50;
    var maxProb = opts.maxProb != null ? opts.maxProb : 0.90;
    var minOdds = opts.minLegOdds != null ? opts.minLegOdds : MIX_PARLAY_MIN_ODDS;
    var useEV = !!opts.useEV;
    var kinds = opts.kinds || ['ah', 'ou'];   // 1X2/OE carry far more margin

    var pool = [], blocked = 0;
    analyses.forEach(function (a) {
      a.picks.forEach(function (p) {
        if (kinds.indexOf(p.kind) < 0) return;
        if (!allowQuarter && p.lineType === 'quarter') return;
        if (!mixParlayEligible(p, minOdds)) { blocked++; return; }
        /* Filter on the same quantity the ranking uses: the probability of
           being paid FULL odds. Filtering on raw probability while ranking on
           full payout pulled the two apart, and raising the threshold then
           did the opposite of what it should - a whole line counts its push
           mass as "not a loss", so it clears a high raw bar while paying out
           far less often. At a 0.55 raw bar the Champions League pool
           collapsed to four legs, three of them whole lines carrying 28-42%
           push risk: exactly the legs this metric exists to reject. */
        var prob = p.cleanWin != null ? p.cleanWin
                 : (p.pFairMarket != null ? p.pFairMarket : p.pModel);
        if (prob < minProb || prob > maxProb) return;
        pool.push({
          pick: p, analysis: a, prob: prob,
          score: useEV ? (p.ev * 100 + p.efficiency) : p.efficiency
        });
      });
    });
    pickParlayLegs.lastBlocked = blocked;
    pool.sort(function (x, y) { return y.score - x.score; });

    /* one leg per fixture: two legs from the same match are correlated, and
       the independence assumption behind a parlay price then fails */
    var chosen = [], used = {};
    for (var i = 0; i < pool.length && chosen.length < n; i++) {
      var fid = pool[i].pick.fixtureId;
      if (used[fid]) continue;
      used[fid] = 1; chosen.push(pool[i]);
    }
    return chosen;
  }

  /** Turn selector output into simulate-ready legs. */
  function toSimLegs(chosen) {
    return chosen.map(function (c) {
      return { odds: c.pick.odds, dist: c.pick.dist, lineType: c.pick.lineType,
               label: c.pick.label, fixtureId: c.pick.fixtureId };
    });
  }

  /* ===================================================== EXPORTS ======== */
  var API = {
    K: K, poisson: poisson, clamp: clamp, round: round,
    profile: profile, lambdas: lambdas,
    scoreMatrix: scoreMatrix, evaluateBet: evaluateBet,
    settleAH: settleAH, settleOU: settleOU, sublines: sublines,
    value: value, devig: devig, lineType: lineType,
    FORMATS: FORMATS, toDecimal: toDecimal, fromDecimal: fromDecimal, detectFormat: detectFormat,
    analyseFixture: analyseFixture, outrightProbs: outrightProbs,
    impliedLambdas: impliedLambdas, marketTargets: marketTargets, fitError: fitError,
    totalGoalsDist: totalGoalsDist, fmtLine: fmtLine,
    simulateParlay: simulateParlay, legMultiplier: legMultiplier,
    legExpectedMultiplier: legExpectedMultiplier,
    pickParlayLegs: pickParlayLegs, toSimLegs: toSimLegs,
    settleFromScore: settleFromScore, gradeCoupon: gradeCoupon,
    calibrationReport: calibrationReport, OUTCOME_VALUE: OUTCOME_VALUE,
    ratingBase: ratingBase, btProb: btProb, calibrateOffset: calibrateOffset,
    crossCheck: crossCheck, compoundingArithmetic: compoundingArithmetic,
    MIX_PARLAY_MIN_ODDS: MIX_PARLAY_MIN_ODDS, mixParlayEligible: mixParlayEligible
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.MBEngine = API;
})(typeof window !== 'undefined' ? window : globalThis);
