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
  function safeDiv(a, b, fallback) {
    /* Guards the numerator as well. A null xA was dividing to 0 rather than
       falling back, so a team with no xA recorded scored as if it created
       nothing - penalised for missing data instead of treated as unknown. */
    if (a == null || !isFinite(a)) return fallback;
    return (b && isFinite(b) && b !== 0) ? a / b : fallback;
  }
  function round(v, d) { var m = Math.pow(10, d == null ? 2 : d); return Math.round(v * m) / m; }

  /* ------------------------------------------------------ model constants -- */
  var K = {
    MATRIX: 11,              // scorelines 0..10 per side
    RATING_PRIOR: 4.0,       // matches of prior for attack/defence shrinkage
    /* A club league is a round robin: by the end everyone has played
       everyone, so one club's xG per match can be compared with another's
       directly. National teams never have that. Their totals come from
       qualifying groups drawn against completely different opposition, so
       Spain's 2.55 and England's 2.05 are not two measurements of the same
       thing - most of the gap is who each of them happened to be drawn
       against. Feeding that difference in raw made the model insist Spain
       were far stronger than the market had them, and the whole board fell
       silent behind the divergence guard. The number is still evidence,
       just much weaker evidence, so it is held to a far heavier prior. */
    NATIONAL_RATING_PRIOR: 14.0,
    /* What a rating is worth when xG conceded had to be assumed league
       average rather than measured - half the rating is then an
       assumption, so it counts for a little over half as much. */
    ASSUMED_DEF_WEIGHT: 0.6,
    /* Below this the model is left alone; above DIV_CAP it is not used at
       all. In between the market anchor is raised in proportion. */
    DIV_FREE: 0.15,
    DIV_CAP: 0.70,
    /* The same idea measured against the fit's own accuracy: a residual up
       to RESID_FREE typical errors is ordinary disagreement, and one at
       RESID_CAP is the model out of its depth. */
    RESID_FREE: 1.5,
    RESID_CAP: 3.0,
    /* How closely the fitted line has to track the prices before the model
       is allowed its full configured say. In goals of supremacy. */
    FIT_FREE: 0.20,
    FIT_CAP: 0.60,
    /* Head to head: weighted meetings of prior, and the most of the
       fixture it may ever decide. Six meetings of prior is heavy on
       purpose - two countries meeting twice is a coincidence, not a
       pattern - and the cap keeps the ratings in charge. */
    H2H_PRIOR: 6.0,
    H2H_CAP: 0.45,
    /* What share of its own weight a head to head is worth when it is the
       ONLY thing entered. Four meetings measure a pairing's supremacy to
       about three quarters of a goal; a fitted season of xG measures it to
       about a third. So a head to head on its own is a real but minor
       voice, and this says so rather than flattering it. */
    H2H_ALONE: 0.70,
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
    var prior = t.national ? K.NATIONAL_RATING_PRIOR : K.RATING_PRIOR;
    var wRating = n / (n + prior);

    /* WhoScored publishes xG created and nothing at all about xG conceded:
       not on Summary, not on Defensive, not on Offensive, not on its xG
       tab. Refusing to rate a team without it meant the commonest source
       there is could not move a single price.

       So a missing xG conceded is treated as exactly league average, which
       is what safeDiv already does above - the team's defence carries no
       information either way. That is a real assumption, not a
       measurement, so it is charged for: half the rating rests on it, so
       the rating's weight is cut and the fixture leans further on the
       market price. The page says so beside the team. */
    var defAssumed = t.xgA == null;
    var ratingWeight = wRating * (defAssumed ? K.ASSUMED_DEF_WEIGHT : 1);

    /* This is the weight the paragraph above describes, and until now it was
       worked out, printed beside the team, and then not used: atk and def
       were shrunk by the full wRating, so a rating half built on an
       assumption counted for exactly as much as a measured one. It is
       applied here, where it was always meant to be. */
    var atk = 1 + (safeDiv(t.xgF, L, 1) - 1) * ratingWeight;
    var def = 1 + (safeDiv(t.xgA, L, 1) - 1) * ratingWeight;

    /* --- shot profile --------------------------------------------------- */
    var xgPerShot = safeDiv(t.xgF, t.shots, 0.105);
    var volume = Math.pow(clamp(safeDiv(t.shots, K.LEAGUE_SHOTS, 1), 0.5, 1.8), K.VOLUME_EXP);
    // A team with many low-value shots is flattered by volume alone.
    var quality = clamp(xgPerShot / 0.105, 0.72, 1.35);
    /* Shot volume and shot quality come out of exactly the same matches as
       the xG rating does, so they deserve exactly the same discount for how
       few those matches are and for how unbalanced the schedule behind them
       was. Leaving this term at full strength meant a national team's
       figures were held to a heavy prior in one breath and taken at face
       value in the next. */
    var shotFusion = 1 + (Math.pow(volume * Math.pow(quality, 0.65), 0.5) - 1) * ratingWeight;

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

    /* --- defensive intensity: tackles suppress, fouls concede -----------
       A column that was never filled in is UNKNOWN, not zero. Read as zero,
       a missing tackle count scored seven standard deviations below the
       league and a missing foul count six above, which pinned every such
       team at the cap and multiplied both sides of every fixture by 1.11.
       On a board where nobody had entered these columns that was an 11%
       lift on every total - it read as the model wanting Over on almost
       every row, and it was nothing of the kind. Unknown now means the
       league average, which is what having no information should mean. */
    var zT = t.tackles == null ? 0 : (t.tackles - K.LEAGUE_TACKLES) / K.SD_TACKLES;
    var zF = t.fouls == null ? 0 : (t.fouls - K.LEAGUE_FOULS) / K.SD_FOULS;
    var defIntensity = clamp(
      1 - K.TACKLE_COEF * zT + K.FOUL_COEF * zF,
      1 - K.DEF_INTENSITY_CAP, 1 + K.DEF_INTENSITY_CAP
    );

    /* --- red-card hazard ------------------------------------------------ */
    /* Same again for the red-card hazard: no discipline figures means the
       league's own rate, not a team that never fouls and never books. */
    var hazard = K.RED_FROM_FOULS * (t.fouls == null ? K.LEAGUE_FOULS : t.fouls) +
                 K.RED_FROM_YELLOW * (t.yellow == null ? 1.8 : t.yellow);
    var pRed = clamp(
      K.RED_HIST_WEIGHT * (t.red || 0) + (1 - K.RED_HIST_WEIGHT) * hazard,
      0.01, 0.35
    );

    return {
      atk: atk, def: def,
      shotFusion: shotFusion, finAdj: finAdj,
      repeatability: repeatability, repeatMean: repeatMean,
      defIntensity: defIntensity, pRed: pRed,
      xgPerShot: xgPerShot, ratingWeight: ratingWeight, defAssumed: defAssumed,
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

    /* NOTE: tilt is deliberately NOT applied here. A tilt expresses the
       user's own view, and applying it before the market blend meant a full
       anchor washed it straight back out. It is applied after blending, in
       analyseFixture, so it reads as "start from the market, then apply what
       I know that the market does not". */

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

  /**
   * Shift a settled bet's winning mass without touching its push mass.
   *
   * A correction to a probability must not quietly change how often the bet
   * is a push: a push pays 1.0x and is the single biggest thing separating a
   * quarter line from a half line, so moving it would rewrite the parlay
   * arithmetic the page is built on. Only the win/lose split moves.
   */
  function rescaleBet(bet, upWin, upLose) {
    var d = bet.dist;
    var out = {
      win: d.win * upWin, halfWin: d.halfWin * upWin,
      push: d.push,
      halfLose: d.halfLose * upLose, lose: d.lose * upLose
    };
    /* Renormalise the moved mass back onto the share that was not push, so
       the five buckets still sum to one. */
    var live = 1 - d.push, moved = out.win + out.halfWin + out.halfLose + out.lose;
    if (moved > 1e-12 && live > 1e-12) {
      var k = live / moved;
      out.win *= k; out.halfWin *= k; out.halfLose *= k; out.lose *= k;
    }
    return {
      dist: out,
      w: out.win + 0.5 * out.halfWin,
      l: out.lose + 0.5 * out.halfLose
    };
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

    /* The implausibility guard exists to catch a model that has drifted away
       from the market on bad inputs. A user tilt is the opposite case: the
       disagreement is deliberate and its size is exactly what was asked for.
       Flagging it as suspect would mean the page refuses to circle the pick
       its own controls just produced. */
    var deliberate = Math.abs(ctx.tilt || 0) > 0.001;
    var implausible = deliberate ? false : (div > 0.25 || ev > 0.15);
    if (deliberate) trust = 1;

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


  /* ============================================ STAT IMPORT ============
     UEFA's club statistics page is the most accessible public source for
     Champions League teams, but it does NOT publish expected goals, and xG
     is this model's single most important input. What it does publish is a
     full shot profile, and xG can be approximated from that.

     The approximation is crude and labelled as such wherever it is used. A
     shot on target is worth roughly 0.185 xG on average across European
     football, one off target about 0.05, a blocked attempt about 0.04. Those
     are population averages: they know nothing about where the shot was
     taken from, who took it, or what the goalkeeper was doing. A team that
     shoots from distance all evening will have its xG overstated by this
     formula, and one that walks the ball in will have it understated.

     Use it when nothing better is available. Understat and FBref publish
     real xG; when you have those numbers, type them in and this estimate
     should be discarded.
     ===================================================================== */
  var XG_PER_SHOT = { onTarget: 0.185, offTarget: 0.050, blocked: 0.040 };

  function estimateXG(onTarget, offTarget, blocked) {
    var t = 0;
    if (isFinite(onTarget))  t += XG_PER_SHOT.onTarget  * onTarget;
    if (isFinite(offTarget)) t += XG_PER_SHOT.offTarget * offTarget;
    if (isFinite(blocked))   t += XG_PER_SHOT.blocked   * blocked;
    return t > 0 ? t : null;
  }

  /** Pull a labelled number out of pasted page text. */
  function grabStat(text, labels) {
    for (var i = 0; i < labels.length; i++) {
      /* The page wraps a long label inside a narrow circle, so a copy can
         arrive as "Matches\nplayed" or "Goals\nconceded". Match any run of
         whitespace between the words, newline included, or none of those
         labels is ever found. */
      var label = labels[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                           .replace(/\s+/g, '\\s+');
      /* UEFA renders the number before its label, but other sources put it
         after, so try both and take whichever matches. Also handles the
         "5/7" form used for completed-out-of-attempted pairs. */
      /* The label must END there: a bare "Tackles" query otherwise matches
         "5 Tackles won" and reads the won count as the total. */
      var before = new RegExp('(\\d+(?:[.,]\\d+)?)(?:\\s*/\\s*\\d+)?\\s*\\n?\\s*' + label + '(?![A-Za-z])', 'i');
      var after  = new RegExp(label + '\\s*:?\\s*\\n?\\s*(\\d+(?:[.,]\\d+)?)', 'i');
      var m = text.match(before) || text.match(after);
      if (m) {
        var v = parseFloat(m[1].replace(',', '.'));
        if (isFinite(v)) return v;
      }
    }
    return null;
  }

  /**
   * Parse a UEFA club statistics page pasted as plain text into the fields
   * this model uses. Everything is converted to a PER MATCH average, because
   * that is what the model expects and the page reports season totals.
   */

  /* ------------------------------------------------- JSON stat import ---
     An API response can be shaped almost any way, and Sportmonks in
     particular returns statistics as a list of {type, value} pairs whose
     type is a numeric id unless the type relation is included. Rather than
     hard-code one schema, walk the whole tree and collect anything that
     looks like a named statistic - either a key whose NAME matches, or an
     object carrying a name-ish field beside a value-ish one.

     This will not be right for every provider on the first try. It is meant
     to get most of the way there from a pasted response, and to fail
     visibly (fields left empty, listed as missing) rather than quietly
     inventing numbers.
     ----------------------------------------------------------------- */
  var STAT_PATTERNS = {
    matches:  [/^(matches|games|appearances|matches_played|games_played|played)$/i],
    goals:    [/^(goals|goals_scored|goals_for|scored)$/i],
    xgF:      [/^(xg|x_g|xg_for|expected_goals|expected_goals_for|xg_scored|expected_goals_scored)$/i],
    xgA:      [/^(xga|xg_a|x_ga|xg_against|expected_goals_against|expected_goals_conceded)$/i],
    xA:       [/^(xa|x_a|expected_assists|xg_assist|xg_assisted)$/i],
    shots:    [/^(shots|shots_total|total_shots|attempts|shots_attempted|total_attempts)$/i],
    sot:      [/^(shots_on_target|shots_on_goal|attempts_on_target|on_target|shots_ongoal)$/i],
    fouls:    [/^(fouls|fouls_committed|fouls_conceded)$/i],
    tackles:  [/^(tackles|tackles_total|total_tackles)$/i],
    yellow:   [/^(yellow_cards?|yellowcards|yellow)$/i],
    red:      [/^(red_cards?|redcards|red)$/i],
    bigMiss:  [/^(big_chances_missed|big_misses|clear_chances_missed)$/i]
  };

  function numericish(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string') {
      var n = parseFloat(v.replace(',', '.'));
      if (isFinite(n)) return n;
    }
    if (v && typeof v === 'object') {
      /* {value: 12}, {total: 12}, {count: 12}, {all: {count: 12}} */
      var keys = ['value', 'total', 'count', 'average', 'amount', 'all'];
      for (var i = 0; i < keys.length; i++) {
        if (v[keys[i]] != null) {
          var n2 = numericish(v[keys[i]]);
          if (n2 != null) return n2;
        }
      }
    }
    return null;
  }

  function matchField(name) {
    if (!name) return null;
    /* Providers label the same statistic as "Expected Goals", "expected_goals",
       "Expected-Goals" or "expectedGoals". Normalise to one form before
       matching, or a pattern written with underscores silently misses every
       human-readable label. */
    var clean = String(name).trim()
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s\-.]+/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase();
    for (var field in STAT_PATTERNS) {
      var pats = STAT_PATTERNS[field];
      for (var i = 0; i < pats.length; i++) {
        if (pats[i].test(clean)) return field;
      }
    }
    return null;
  }

  function collectFromJSON(node, out, depth) {
    depth = depth || 0;
    if (!node || typeof node !== 'object' || depth > 12) return;
    if (Array.isArray(node)) {
      node.forEach(function (n) { collectFromJSON(n, out, depth + 1); });
      return;
    }
    /* shape A: {type: {name: "Shots Total"}, value: 12} or {name, value} */
    var nameish = node.name || node.code || node.developer_name ||
                  (node.type && (node.type.name || node.type.code || node.type.developer_name));
    if (nameish) {
      var f = matchField(nameish);
      if (f != null) {
        var v = numericish(node.value != null ? node.value :
                (node.data != null ? node.data : node.count));
        if (v != null && out[f] == null) out[f] = v;
      }
    }
    /* shape B: plain keys - {"xg": 1.8, "shots_on_target": 5} */
    for (var k in node) {
      if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
      var child = node[k];
      var fk = matchField(k);
      if (fk != null && out[fk] == null) {
        var vk = numericish(child);
        if (vk != null) out[fk] = vk;
      }
      collectFromJSON(child, out, depth + 1);
    }
  }

  function parseStatsJSON(text) {
    var json;
    try { json = JSON.parse(text); } catch (e) { return null; }
    var found = {};
    collectFromJSON(json, found, 0);
    if (!Object.keys(found).length) {
      return { error: 'The JSON parsed, but no recognised statistic field was found. ' +
        'Send the JSON snippet to Claude so the mapping can be written for it exactly.' };
    }
    var matches = found.matches;
    var perMatch = matches && matches > 1;
    function per(v) {
      if (v == null) return null;
      /* xG is often already a per-match average; totals over many matches are
         obvious from their size, so only divide what clearly needs it. */
      return perMatch ? Math.round((v / matches) * 100) / 100 : Math.round(v * 100) / 100;
    }
    var out = {
      matches: matches || 1,
      goals: per(found.goals), xgF: per(found.xgF), xgA: per(found.xgA),
      xA: per(found.xA), shots: per(found.shots), sot: per(found.sot),
      bigMiss: per(found.bigMiss), fouls: per(found.fouls),
      tackles: per(found.tackles), yellow: per(found.yellow), red: per(found.red),
      _estimated: { xgF: false, xgA: false },
      _source: 'json',
      _perMatchApplied: !!perMatch,
      _missing: []
    };
    ['goals','xgF','xgA','shots','sot','fouls','tackles','yellow','red'].forEach(function (k) {
      if (out[k] == null) out._missing.push(k);
    });
    return out;
  }


  /* ------------------------------------------- multi-team JSON import ---
     A browser cannot call most football APIs directly: they do not send
     Access-Control-Allow-Origin, so the fetch fails with a bare "Failed to
     fetch" no matter how correct the token is. Opening the same URL in a tab
     works fine, because the address bar is not subject to CORS.

     So the practical route is one bulk request, opened in a tab, copied once
     and pasted here - a list endpoint returning every team with its
     statistics attached. This walks such a response, pulls each team's name
     and statistics, and hands back a map keyed by name for the caller to
     match against its own fixtures.
     ----------------------------------------------------------------- */
  function parseManyTeams(text) {
    var json;
    try { json = JSON.parse(text); } catch (e) { return null; }

    var teams = [];
    function walk(node, depth) {
      if (!node || typeof node !== 'object' || depth > 8) return;
      if (Array.isArray(node)) {
        node.forEach(function (n) { walk(n, depth + 1); });
        return;
      }
      /* A team entry is an object with a name and something statistics-like
         hanging off it. Anything else is a container to descend through. */
      var hasName = typeof node.name === 'string' && node.name.length > 1;
      var statsHolder = node.statistics || node.details || node.stats;
      if (hasName && statsHolder) {
        var found = {};
        collectFromJSON(statsHolder, found, 0);
        if (Object.keys(found).length >= 3) {
          /* Providers ship a crest URL beside the team: it is part of the
             response the operator already pays for, so it is the one image
             source they plainly have the right to use. */
          var img = node.image_path || node.image || node.logo || node.logo_path || null;
          teams.push({ name: node.name, id: node.id != null ? String(node.id) : null,
                       logo: typeof img === 'string' ? img : null, raw: found });
          return;   // do not descend into a team we have already taken
        }
      }
      for (var k in node) {
        if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k], depth + 1);
      }
    }
    walk(json, 0);
    if (!teams.length) return { error: 'No team with recognisable statistics was found in this JSON.' };

    return {
      teams: teams.map(function (t) {
        var f = t.raw;
        var m = f.matches;
        var perMatch = m && m > 1;
        function per(v) {
          if (v == null) return null;
          return perMatch ? Math.round((v / m) * 100) / 100 : Math.round(v * 100) / 100;
        }
        var missing = [];
        var stats = {
          matches: m || 1, goals: per(f.goals), xgF: per(f.xgF), xgA: per(f.xgA),
          xA: per(f.xA), shots: per(f.shots), sot: per(f.sot), bigMiss: per(f.bigMiss),
          fouls: per(f.fouls), tackles: per(f.tackles), yellow: per(f.yellow), red: per(f.red)
        };
        ['goals','xgF','xgA','shots','sot','fouls','tackles'].forEach(function (k) {
          if (stats[k] == null) missing.push(k);
        });
        return { name: t.name, id: t.id, logo: t.logo, stats: stats, missing: missing };
      })
    };
  }

  /** Loose name match: exact first, then normalised, then containment. */
  function matchTeamName(target, candidates) {
    function norm(x) {
      return String(x || '').toLowerCase()
        .replace(/\b(fc|afc|cf|sc|ac|as|ss|ssc|club|cd|rc|sv|vfb|fk|bk|if)\b/g, '')
        .replace(/[^a-z0-9]+/g, '');
    }
    var t = norm(target);
    var exact = candidates.filter(function (c) { return norm(c.name) === t; })[0];
    if (exact) return exact;
    var partial = candidates.filter(function (c) {
      var n = norm(c.name);
      return n && t && (n.indexOf(t) === 0 || t.indexOf(n) === 0);
    })[0];
    return partial || null;
  }

  /* ====================================================== TABLE PASTES ===
     WhoScored, FBref and Understat do not label a number the way UEFA does.
     They print a header row and put the numbers on their own line below it:

       Tournament      Apps  Goals  Shots pg  Discipline  Possession%  ...
       Premier League   5      7       12         70         44.8      ...

     grabStat looks for a number touching its label, so on a page like this
     it finds nothing at all - the thing next to "Goals" is the word "Shots".
     This reads by COLUMN instead: match the header names, then line the
     numbers up underneath them by position.

     One paste usually holds several of these tables (Summary, then
     Defensive, then Offensive), so every table in the text is read and the
     later ones fill in what the earlier ones did not have. */

  /* Header name -> field, and whether the column is already a per-match
     figure. "Shots pg" is per match; "Shots" on the xG table is a season
     total. Getting that backwards is a factor-of-five error, so the rule is
     explicit rather than guessed: a name ending in "pg" is per match.
     Confirmed against a real paste - 60 shots over 5 apps on one table is
     the 12 "Shots pg" the other table prints. */
  var TABLE_COLUMNS = {
    'apps': 'apps', 'mp': 'apps', 'matches': 'apps', 'games': 'apps',
    'goals': 'goals', 'goals*': 'goals', 'gls': 'goals', 'g': 'goals',
    'shots': 'shots', 'shots pg': 'shots', 'sh': 'shots', 'shotspg': 'shots',
    'sot': 'sot', 'sot pg': 'sot', 'shotsontarget': 'sot', 'shots on target': 'sot',
    'xg': 'xgF', 'xg pg': 'xgF', 'npxg': 'xgF',
    'xga': 'xgA', 'xga pg': 'xgA', 'xgagainst': 'xgA', 'xgconceded': 'xgA',
    'xa': 'xA', 'xag': 'xA',
    'tackles': 'tackles', 'tackles pg': 'tackles', 'tkl': 'tackles',
    'fouls': 'fouls', 'fouls pg': 'fouls', 'fls': 'fouls',
    'yellow': 'yellow', 'yel': 'yellow', 'crdy': 'yellow', 'yellowcards': 'yellow',
    'red': 'red', 'crdr': 'red', 'redcards': 'red',
    /* One cell holding both card counts - see splitDiscipline. */
    'discipline': 'discipline'
  };
  var TABLE_TOTAL_FIELDS = ['apps', 'goals', 'shots', 'sot', 'xgF', 'xgA', 'xA',
                            'tackles', 'fouls', 'yellow', 'red'];

  /* WhoScored draws the two card counts as coloured boxes side by side, and
     a copy brings them back stuck together: 7 yellow and 0 red arrive as
     "70". The last digit is the red count - red cards never reach double
     figures in a season, yellows routinely do - so the split is safe in the
     direction that matters. */
  function splitDiscipline(v) {
    if (v == null || !isFinite(v) || v < 0) return null;
    if (v !== Math.floor(v)) return null;           // not a card count
    if (v < 10) return { yellow: v, red: 0 };
    return { yellow: Math.floor(v / 10), red: v % 10 };
  }

  function normHeader(s) {
    return String(s).toLowerCase().replace(/[%()]/g, '').replace(/\s+/g, ' ').trim();
  }

  /* "Shots pg" is two words in the header but one column. Glue a trailing
     "pg" (and the "per game"/"p90" spellings) onto the name before it. */
  function headerCells(line) {
    var raw = line.trim().split(/\s{2,}|\t|\s/).filter(Boolean);
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var w = raw[i];
      if (/^(pg|per|p90|\/90|game)$/i.test(w) && out.length) {
        if (/^(per)$/i.test(w) && /^game$/i.test(raw[i + 1] || '')) i++;
        out[out.length - 1] += ' pg';
        continue;
      }
      out.push(w);
    }
    return out;
  }

  function isNumberCell(s) { return /^[+-]?\d+(?:[.,]\d+)?$/.test(String(s).trim()); }

  /* A competition a team has played but that carries no figures yet prints
     as "N/A" or a dash. Manchester City's xG tab lists FA Cup 6 and
     Community Shield 1 that way, between competitions that do have
     numbers. Treating those cells as the end of the table lost every row
     below them - which is why City's paste read nothing while Liverpool's,
     whose empty rows happened to sit last, read fine. */
  function isBlankCell(s) {
    return /^(n\/?a|-|\u2013|\u2014|\u2212|\.|)$/i.test(String(s).trim());
  }

  /**
   * Read every header-and-rows table in a pasted page.
   * Returns null when the text holds no table this knows how to read.
   */
  /**
   * Walk every header-and-rows table in a paste and hand back one row at a
   * time. Both readers below share this, so the rules that are easy to get
   * wrong - which column is per match, where the row label ends - are
   * written once.
   */
  function eachTableRow(text, onRow, opts) {
    opts = opts || {};
    var fallbackApps = parseFloat(opts.matchesFallback);
    if (!isFinite(fallbackApps) || fallbackApps < 1) fallbackApps = null;

    var lines = String(text).replace(/\u00a0/g, ' ').split(/\r?\n/);
    var tables = 0, needMatches = false;

    for (var i = 0; i < lines.length; i++) {
      var cells = headerCells(lines[i]);
      if (cells.length < 3) continue;

      /* A header line names columns and carries no numbers of its own. */
      var map = {}, named = 0, hasApps = false;
      for (var c = 0; c < cells.length; c++) {
        if (isNumberCell(cells[c])) { named = -99; break; }
        var field = TABLE_COLUMNS[normHeader(cells[c])];
        if (field) { map[c] = field; named++; if (field === 'apps') hasApps = true; }
      }
      if (named < 2 || map[0] != null) continue;   // column 0 is a label

      /* A league table often has no Apps column at all: WhoScored's
         "Team Statistics" lists Goals, Shots pg, Discipline, Possession%
         and nothing about how many matches produced them. Goals there is a
         season total, so without a match count it cannot become an average
         - and inventing one would quietly divide by the wrong number. Take
         it from the caller, or say it is needed and read no rows. */
      if (!hasApps && !fallbackApps) { needMatches = true; continue; }

      /* How many columns come before the first figure. A team page starts
         with one ("Tournament"); a league table often starts with two, a
         rank and the club ("R  Team  Apps  Goals ..."). Counting them
         rather than assuming one is what lets the same reader take both. */
      var firstData = cells.length;
      for (var fm in map) { if (+fm < firstData) firstData = +fm; }
      if (firstData < 1 || firstData >= cells.length) continue;

      var perMatchCol = {};
      for (var pc = 0; pc < cells.length; pc++) {
        perMatchCol[pc] = /\bpg$/.test(normHeader(cells[pc]));
      }

      var want = cells.length - firstData, rowsHere = 0;
      for (var j = i + 1; j < lines.length; j++) {
        var row = lines[j].trim();
        if (!row) { if (rowsHere) break; else continue; }
        var parts = row.split(/\s{2,}|\t|\s/).filter(Boolean);
        if (parts.length < want + 1) break;

        /* Count the value cells at the end of the row - numbers, or the
           markers a competition without figures prints instead. Whatever
           comes before them is the label. */
        var tail = 0;
        while (tail < parts.length - 1 &&
               (isNumberCell(parts[parts.length - 1 - tail]) ||
                isBlankCell(parts[parts.length - 1 - tail]))) tail++;

        /* A row of markers is often short too, because a dash in the last
           column may not survive the copy at all. Skip it and keep going:
           the rows underneath are the ones being looked for. */
        if (tail < want) {
          /* Short because its empty cells did not all survive the copy.
             A row carrying both a marker and a figure - "FA Cup 6 N/A N/A
             N/A N/A -" - is a competition played but not yet measured, so
             step over it. Prose has no markers and ends the table. */
          var hasMarker = parts.some(isBlankCell);
          var hasNumber = parts.some(isNumberCell);
          if (hasMarker && hasNumber) continue;
          break;
        }

        /* One number too many is the Discipline cell arriving as two:
           WhoScored draws the cards as a yellow box and a red box, and a
           copy sometimes brings them back glued ("61") and sometimes apart
           ("6 1"). Nothing else in these tables splits like that, so that
           is the only extra column this will account for - anything else
           is a row this reader does not understand, and it stops rather
           than lining the wrong numbers up under the wrong headings. */
        var splitCards = -1;
        if (tail > want) {
          var discCol = -1;
          for (var dc in map) { if (map[dc] === 'discipline') discCol = +dc; }
          if (tail !== want + 1 || discCol < 0) break;
          splitCards = discCol - firstData;
        }

        var nums = parts.slice(parts.length - tail);

        /* Whatever is left in front of the numbers is the row's name: a
           competition on a team page, a club on a league table. */
        var label = parts.slice(0, parts.length - want).join(' ').trim();

        var rowApps = null, values = [];
        for (var k = 0, off = 0; k < nums.length; k++) {
          if (isBlankCell(nums[k])) continue;      // no figure in this cell
          var col = k - off + firstData, f = map[col];
          if (splitCards === k - off && f === 'discipline') {
            /* Two cells for one column: yellow, then red. */
            var yel = parseFloat(String(nums[k]).replace(',', '.'));
            var redv = parseFloat(String(nums[k + 1]).replace(',', '.'));
            if (isFinite(yel)) values.push({ field: 'yellow', value: yel, perMatch: false });
            if (isFinite(redv)) values.push({ field: 'red', value: redv, perMatch: false });
            k++; off++;
            continue;
          }
          if (!f) continue;
          var v = parseFloat(String(nums[k]).replace(',', '.'));
          if (!isFinite(v)) continue;
          if (f === 'apps') rowApps = v;
          else values.push({ field: f, value: v, perMatch: perMatchCol[col] });
        }
        if (!rowApps && fallbackApps) rowApps = fallbackApps;
        if (!rowApps || rowApps < 1) break;      // a row that cannot be weighted

        /* A competition played but not yet measured contributes nothing,
           and must not inflate the match count it would be divided by. */
        if (!values.length) { rowsHere++; continue; }

        rowsHere++;
        onRow({ label: label, apps: rowApps, values: values });
      }
      if (rowsHere) { tables++; i = i + rowsHere; }
    }
    return { tables: tables, needMatches: needMatches };
  }

  /* One bucket of season totals, and the matches each of them came from. */
  function newBucket() { return { totals: {}, appsFor: {}, matches: 0, rows: 0 }; }

  function addRow(b, row) {
    for (var q = 0; q < row.values.length; q++) {
      var it = row.values[q];
      if (it.field === 'discipline') {
        var d = splitDiscipline(it.value);
        if (!d) continue;
        b.totals.yellow = (b.totals.yellow || 0) + d.yellow;
        b.totals.red = (b.totals.red || 0) + d.red;
        b.appsFor.yellow = (b.appsFor.yellow || 0) + row.apps;
        b.appsFor.red = (b.appsFor.red || 0) + row.apps;
        continue;
      }
      /* A per-match column is turned back into a season total here, so
         several competitions add up and are divided once at the end. */
      b.totals[it.field] = (b.totals[it.field] || 0) +
        (it.perMatch ? it.value * row.apps : it.value);
      b.appsFor[it.field] = (b.appsFor[it.field] || 0) + row.apps;
    }
    b.rows++;
  }

  function finishBucket(b, matches, tables) {
    function per(f) {
      if (b.totals[f] == null || !b.appsFor[f]) return null;
      return Math.round((b.totals[f] / b.appsFor[f]) * 100) / 100;
    }
    var out = {
      matches: matches,
      _fromTable: true,
      _tables: tables,
      _rows: b.rows,
      goals: per('goals'),
      xgF: per('xgF'),
      xgA: per('xgA'),
      xA: per('xA'),
      shots: per('shots'),
      sot: per('sot'),
      bigMiss: null,
      fouls: per('fouls'),
      tackles: per('tackles'),
      yellow: per('yellow'),
      red: per('red'),
      _estimated: { xgF: false, xgA: false },
      _missing: []
    };
    ['goals', 'xgF', 'xgA', 'shots', 'sot', 'fouls', 'tackles', 'yellow', 'red']
      .forEach(function (k) { if (out[k] == null) out._missing.push(k); });
    return out;
  }

  /**
   * One team's page: every row is a competition that team played in, so the
   * rows are added together.
   *
   * Matches are counted per FIELD, not per row. A paste usually holds
   * Summary, Defensive and Offensive, and all three list the same
   * competitions - adding their Apps would say a team played 21 matches
   * when it played 7, and divide every average by three.
   */
  function parseStatsTable(text, opts) {
    if (!text || typeof text !== 'string') return null;
    var b = newBucket(), tableApps = [], idx = -1, lastLabels = [];

    var scan = eachTableRow(text, function (row) {
      /* A competition seen again belongs to the next table, so its apps
         must not be added to this table's match count a second time. */
      if (lastLabels.indexOf(row.label) !== -1) { idx = -1; lastLabels = []; }
      if (idx === -1) { tableApps.push(0); idx = tableApps.length - 1; }
      lastLabels.push(row.label);
      tableApps[idx] += row.apps;
      addRow(b, row);
    }, opts);
    if (!scan.tables || !b.rows) return null;
    var tables = scan.tables;

    var matches = 0;
    for (var i = 0; i < tableApps.length; i++) matches = Math.max(matches, tableApps[i]);
    if (matches < 1) return null;
    return finishBucket(b, matches, tables);
  }

  /**
   * A league table: every row is a different club, so each one becomes its
   * own team. Which of the two shapes a paste is gets decided by the row
   * labels themselves - "Premier League" matches no club and "Aston Villa"
   * does - rather than by asking the reader to say which they pasted.
   *
   * candidates: [{ key, name }] - the teams this site knows.
   */
  function parseTeamsTable(text, candidates, opts) {
    if (!text || typeof text !== 'string') return null;
    if (!candidates || !candidates.length) return null;

    var buckets = {}, names = {}, unmatched = [];
    var scan = eachTableRow(text, function (row) {
      /* League tables number their rows, so the label arrives as
         "1 Manchester City". Try the label as it stands first - a club can
         genuinely begin with a number, like 1860 Munich - and only then
         with a leading rank taken off. */
      var hit = matchTeamName(row.label, candidates);
      if (!hit) {
        var noRank = row.label.replace(/^\s*\d{1,3}[.)]?\s+/, '').trim();
        if (noRank && noRank !== row.label) hit = matchTeamName(noRank, candidates);
      }
      if (!hit) {
        if (unmatched.indexOf(row.label) === -1) unmatched.push(row.label);
        return;
      }
      if (!buckets[hit.key]) { buckets[hit.key] = newBucket(); names[hit.key] = hit.name; }
      var b = buckets[hit.key];
      b.matches = Math.max(b.matches, row.apps);
      addRow(b, row);
    }, opts);

    var keys = Object.keys(buckets);
    /* A table this reader understands but cannot weight: say so, so the
       page can ask for the match count instead of falling through to the
       single-team reader and reporting nothing found. */
    if (!keys.length) {
      return scan.needMatches ? { needsMatches: true, teams: [], unmatched: unmatched } : null;
    }

    return {
      teams: keys.map(function (k) {
        return { key: k, name: names[k], stats: finishBucket(buckets[k], buckets[k].matches, scan.tables) };
      }),
      tables: scan.tables,
      needsMatches: false,
      unmatched: unmatched
    };
  }

  /**
   * The xG tab's "Against" view: the same table shape, but every figure in
   * it belongs to the opponent. Exactly one of them is wanted - xG
   * conceded - and reading the rest would quietly overwrite this team's
   * own attack with the other side's.
   */
  function parseXGAgainst(text) {
    var t = parseStatsTable(text);
    if (!t || t.xgF == null) return null;
    return {
      matches: t.matches,
      xgA: t.xgF,                 // "xG" in the Against view IS xG conceded
      _fromTable: true,
      _againstView: true,
      _tables: t._tables
    };
  }

  function parseTeamStats(text, opts) {
    opts = opts || {};
    /* The caller says which view this is; nothing in the copied text
       distinguishes them, because both carry the words "For" and
       "Against" from the toggle itself. Guessing would be a coin flip
       that silently swaps a team's attack for its defence. */
    if (opts.against) return parseXGAgainst(text);
    if (!text || typeof text !== 'string') return null;
    var trimmed = text.trim();
    /* A pasted API response is JSON; a pasted page is not. */
    if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') {
      var asJson = parseStatsJSON(trimmed);
      if (asJson) return asJson;
    }
    var t = text.replace(/\u00a0/g, ' ');

    /* A header-and-rows table (WhoScored, FBref, Understat) reads nothing at
       all through grabStat, so try it by column first. Its own match count
       comes from the Apps column, which is why it runs before the fallback
       below asks the caller for one. */
    var asTable = parseStatsTable(t, opts);
    if (asTable) return asTable;

    var matches = grabStat(t, ['Matches played', 'Matches played', 'Matches contested']);
    /* Every number on the page is a season total, so nothing can be turned
       into a per-match average without this one figure. Pages differ in how
       they draw it - inside a donut, split across lines, sometimes as an
       image - so when it cannot be read, take it from the caller rather
       than refusing a paste that is otherwise complete. */
    /* UEFA draws the match count inside a donut whose text does not come
       along when the page is copied: what arrives is "Key stats 1 0 0 Won
       Drawn Lost", with no "Matches played" anywhere. But won + drawn +
       lost IS the match count on a competition page, so derive it. Two
       shapes are seen: the three numbers grouped ahead of the three labels,
       and each number beside its own label. */
    var matchesFromRecord = false;
    if (!matches || matches < 1) {
      var rec =
        /(\d+)\s+(\d+)\s+(\d+)\s+Won\s+Drawn\s+Lost/i.exec(t) ||
        /(\d+)\s*Won\s+(\d+)\s*Drawn\s+(\d+)\s*Lost/i.exec(t);
      if (rec) {
        var sum = parseInt(rec[1], 10) + parseInt(rec[2], 10) + parseInt(rec[3], 10);
        if (isFinite(sum) && sum > 0) { matches = sum; matchesFromRecord = true; }
      }
    }

    var matchesFromCaller = false;
    if (!matches || matches < 1) {
      var fb = parseFloat(opts.matchesFallback);
      if (isFinite(fb) && fb >= 1) { matches = fb; matchesFromCaller = true; }
    }
    if (!matches || matches < 1) {
      return { error: 'The match count could not be read from this page. ' +
        'Type it into the MATCHES PLAYED box, then press Import again.',
        needsMatches: true,
        sample: String(text).replace(/\s+/g, ' ').trim().slice(0, 240) };
    }

    var goals      = grabStat(t, ['Goals']);
    var conceded   = grabStat(t, ['Goals conceded']);
    var onTarget   = grabStat(t, ['Attempts on target']);
    var offTarget  = grabStat(t, ['Attempts off target']);
    var blocked    = grabStat(t, ['Attempts blocked']);
    var total      = grabStat(t, ['Total attempts', 'Total']);
    var concOn     = grabStat(t, ['Attempts conceded on target']);
    var concOff    = grabStat(t, ['Attempts conceded off target']);
    /* total tackles, not the won/lost split beneath it */
    var tackles    = grabStat(t, ['Tackles']);
    var fouls      = grabStat(t, ['Fouls committed']);
    var yellow     = grabStat(t, ['Yellow cards']);
    var red        = grabStat(t, ['Red cards']);
    var assists    = grabStat(t, ['Assists']);

    if (total == null && onTarget != null && offTarget != null) {
      total = onTarget + offTarget + (blocked || 0);
    }

    var xgF = estimateXG(onTarget, offTarget, blocked);
    /* Only on- and off-target are published for the opponent, so a blocked
       count is missing from the conceded side and xGA is slightly understated. */
    var xgA = estimateXG(concOn, concOff, null);

    function per(v) { return v == null ? null : Math.round((v / matches) * 100) / 100; }

    var out = {
      matches: matches,
      _matchesFromCaller: matchesFromCaller,
      _matchesFromRecord: matchesFromRecord,
      goals: per(goals),
      xgF: per(xgF),
      xgA: per(xgA),
      xA: null,                 // not published anywhere on the page
      shots: per(total),
      sot: per(onTarget),
      bigMiss: null,            // "clear chances" is a different measure
      fouls: per(fouls),
      tackles: per(tackles),
      yellow: per(yellow),
      red: per(red),
      _assists: per(assists),
      _estimated: { xgF: xgF != null, xgA: xgA != null },
      _missing: []
    };
    ['goals', 'xgF', 'xgA', 'shots', 'sot', 'fouls', 'tackles', 'yellow', 'red'].forEach(function (k) {
      if (out[k] == null) out._missing.push(k);
    });
    return out;
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
    /* ...unless the past meetings have been entered. Those are a
       measurement too, so the model is given a say in proportion to how
       much of one there is - less than a full season of xG would earn, and
       never more than the cap below. */
    var h2hIn = opts.h2h && opts.h2h.weight > 0 ? opts.h2h : null;
    if (statsMissing && h2hIn) {
      var wAlone = Math.min(K.H2H_CAP, h2hIn.weight / (h2hIn.weight + K.H2H_PRIOR));
      mw = 1 - wAlone * K.H2H_ALONE;
    }
    /* Put the model into the market's units before anything is judged - the
       goal level, then the supremacy scale. See calibrateShape for why both
       were wrong and why neither is a view about this match. With no board
       to fit against, the scale is 1 and the line is the identity, so
       nothing happens at all. */
    var shape = opts.shape || null;
    var totalScale = (shape && typeof shape.scaleFor === 'function') ? shape.scaleFor(fx.league) : 1;
    if (!(totalScale > 0)) totalScale = 1;

    var rawH = lam.home * totalScale, rawA = lam.away * totalScale;

    var supRaw = rawH - rawA, supAdj = supRaw;
    if (shape && shape.slopeFitted) {
      var total = rawH + rawA;
      supAdj = shape.alpha + shape.beta * supRaw;
      /* Stretching supremacy must not eat the whole match: one side always
         keeps a lambda it could score from. */
      supAdj = clamp(supAdj, -(total - 0.24), total - 0.24);
      rawH = (total + supAdj) / 2;
      rawA = (total - supAdj) / 2;
    }

    /* --- what the two sides have actually done to each other ----------
       See parseH2H. The reading is a measurement of THIS pairing, so it is
       weighed against the ratings by how many meetings there are and how
       old they are, and capped: a head to head may inform the model, never
       replace it. */
    var h2h = opts.h2h || null, h2hUse = null;
    if (h2h && h2h.weight > 0) {
      var wH2H = Math.min(K.H2H_CAP, h2h.weight / (h2h.weight + K.H2H_PRIOR));
      var hfaGoals = (league.hfaAttack - 1) * (league.avgGoalsPerMatch / 2) * 2;
      var supModel = rawH - rawA, totModel = rawH + rawA;
      var supH2H = h2h.supremacy + hfaGoals;       // put this fixture's venue back
      var sup = supModel * (1 - wH2H) + supH2H * wH2H;
      /* The total moves too, but on a lighter weight: how many goals a
         pairing produces is far more volatile than who wins it. */
      var wTot = wH2H * 0.5;
      var tot = totModel * (1 - wTot) + h2h.total * wTot;
      if (tot < 0.5) tot = 0.5;
      sup = clamp(sup, -(tot - 0.24), tot - 0.24);
      rawH = (tot + sup) / 2;
      rawA = (tot - sup) / 2;
      h2hUse = { weight: wH2H, n: h2h.n,
                 supremacyBefore: supModel, supremacyAfter: sup,
                 /* What the meetings ALONE say, at this fixture's venue.
                    This is the number to hold against the price: the
                    blended one is dragged by whatever the ratings thought,
                    so comparing that to the market answers a different
                    question than the reader is asking. */
                 supremacyH2H: supH2H,
                 totalBefore: totModel, totalAfter: tot, totalH2H: h2h.total };
    }

    var implied = impliedLambdas(fx, league, { home: rawH, away: rawA });
    var lamH = rawH, lamA = rawA;

    /* How far the model has walked away from the price, before any blending.
       This is the honest measure of disagreement: the blended number cannot
       disagree with the market by much by construction, so measuring after
       the blend would always report calm. */
    var divergence = null;
    if (implied) {
      divergence = (Math.abs(rawH - implied.home) + Math.abs(rawA - implied.away))
                 / Math.max(0.5, implied.home + implied.away);
    }

    /* The old rule was all or nothing: past 25% disagreement no pick was
       promoted at all. On a national-team board that silenced eleven rows
       out of twenty - every row saying "too far, nothing selected" - which
       is not a cautious answer, it is no answer. And it is the wrong shape
       of answer: disagreement is not a switch, it is a measure of how much
       the model should be believed.

       So the anchor slides instead. Up to DIV_FREE the model is left as
       configured; from there it is pulled back toward the price in
       proportion to how far out it has gone, reaching the market entirely
       at DIV_CAP. A small, well-supported disagreement still moves the
       odds - which is the whole point of entering statistics - while a wild
       one quietly costs itself its own influence. */
    /* A second reading of the same disagreement, in the units the fit has
       already earned the right to use. calibrateShape reports the typical
       distance between its line and the prices across the whole board; a
       fixture whose distance is several times that is not an edge the model
       has found, it is the model at the edge of what it can do. San Marino
       v Finland was exactly this: 2.4 times the board's own error, and a
       confident +2.50 on the worst team in Europe. */
    var residZ = null;
    if (shape && shape.slopeFitted && shape.rmse > 0.05 && implied) {
      residZ = Math.abs((implied.home - implied.away) - (rawH - rawA)) / shape.rmse;
    }

    /* How much say the model has earned on THIS board, before any single
       fixture is looked at. calibrateShape has already measured how far its
       line typically sits from the prices; a model that tracks them to a
       tenth of a goal deserves more of a say than one that tracks them to
       half a goal, and until now both got the same 35%. That is how a
       fixture came to be quoted at +12% expected value by a model whose own
       typical error was two thirds of a goal of supremacy.

       It also gives entering more data a point: every column added tightens
       the fit, and a tighter fit hands the model more of the say. */
    /* The model has the teams in a different order from the prices: its
       inputs are wrong, and nothing it says about this board can be
       trusted. Defer to the prices completely. */
    if (shape && shape.orderDisagrees) mw = 1;

    var mwRaw = mw;
    if (mw < 1 && shape && shape.slopeFitted && shape.rmse != null) {
      var loose = (shape.rmse - K.FIT_FREE) / (K.FIT_CAP - K.FIT_FREE);
      mw = mw + (1 - mw) * clamp(loose, 0, 1);
      mwRaw = mw;
    }

    if (mw < 1) {
      var over = divergence == null ? 0
        : (divergence - K.DIV_FREE) / (K.DIV_CAP - K.DIV_FREE);
      if (residZ != null) {
        over = Math.max(over, (residZ - K.RESID_FREE) / (K.RESID_CAP - K.RESID_FREE));
      }
      mw = mw + (1 - mw) * clamp(over, 0, 1);
    }

    if (implied && mw > 0) {
      lamH = rawH * (1 - mw) + implied.home * mw;
      lamA = rawA * (1 - mw) + implied.away * mw;
    }

    /* What survives the blend: this is what the priced numbers actually
       embody, so it is what the confidence gate should judge. */
    var divergenceEff = divergence == null ? null : divergence * (1 - mw);

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

    /* --- the user's own read, applied on top of the market --------------
       Football knowledge the model cannot see - a coach change, a squad
       full of internationals, a side with something to prove - enters here.
       tilt > 0 shifts goals toward the home side, tilt < 0 toward the away
       side, and everything downstream (every market, the parlay, the EV
       column) follows from it. */
    var tilt = opts.tilt || 0;
    if (tilt) {
      lamH *= (1 + tilt); lamA *= (1 - tilt);
      lamH1 *= (1 + tilt); lamA1 *= (1 - tilt);
      lamH = clamp(lamH, 0.08, 6); lamA = clamp(lamA, 0.08, 6);
      lamH1 = clamp(lamH1, 0.04, 4); lamA1 = clamp(lamA1, 0.04, 4);
    }

    var mFT = scoreMatrix(lamH, lamA, league.rhoFT);
    var mHT = scoreMatrix(lamH1, lamA1, league.rhoHT);

    /* The same two matrices built from the PRICES alone. They are the
       reference against which this model's own fitting error is measured -
       see the correction in pushBet. */
    var mFTmkt = implied ? scoreMatrix(implied.home, implied.away, league.rhoFT) : null;
    var mHTmkt = implied1h ? scoreMatrix(implied1h.home, implied1h.away, league.rhoHT) : null;

    var matches = Math.min(lam.profiles.home.matches, lam.profiles.away.matches);
    var repeat = (lam.profiles.home.repeatability + lam.profiles.away.repeatability) / 2;

    /* second-family sanity check (Bradley-Terry) where stats allow it */
    var cross = null;
    void tilt;   /* declared above with the lambda adjustment */
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

    function pushBet(half, kind, label, line, side, odds, M, counterOdds, fairOverride) {
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

      /* ---- take out this model's own fitting error ---------------------
         A Poisson matrix cannot match a real Asian board exactly. Fitted to
         a favourite-heavy market it always leaves the same residual: it
         gives the plus-handicap side two to three points more than the
         de-vigged price does, because real football produces more heavy
         wins than Poisson allows. The size is small; the direction never
         varies.
         Left in, that residual IS the edge the page finds. Pinned entirely
         to the market - the model contributing nothing at all - the board
         still offered San Marino +2.25, Turkey +1.00, Wales +1.75: over
         forty runs with the inputs jittered, 61 of 62 picks were the
         underdog. Not one of them came from the statistics.
         So it is measured against the prices and subtracted. The model's
         own movement survives untouched; what cancels is the part that was
         there before the model said anything. */
      var Mmkt = half === 'ft' ? mFTmkt : mHTmkt;
      var pFair = fairOverride != null ? fairOverride
        : (counterOdds != null && isFinite(counterOdds) && counterOdds > 1
            ? devig([odds, counterOdds]).probs[0] : null);
      if (Mmkt && pFair != null) {
        var betMkt = evaluateBet(Mmkt, fn);
        var live = bet.w + bet.l, liveMkt = betMkt.w + betMkt.l;
        if (live > 1e-6 && liveMkt > 1e-6) {
          var bias = (betMkt.w / liveMkt) - pFair;
          var pOld = bet.w / live;
          var pNew = clamp(pOld - bias, 0.005, 0.995);
          bet = rescaleBet(bet, pNew / pOld, (1 - pNew) / (1 - pOld));
        }
      }

      var v = value(bet, odds, {
        kind: kind, line: line, matches: matches,
        repeatability: repeat, half: half, divergence: divergenceEff,
        cross: cross, tilt: tilt
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
        [['1', mk.x12['1'], home.name + ' Win', 0],
         ['X', mk.x12.X, 'Draw', 1],
         ['2', mk.x12['2'], away.name + ' Win', 2]].forEach(function (row) {
          /* A three-way market has no single counter-price, so its fair
             probability is handed in from the three-way de-vig - otherwise
             1X2 would be the one market left carrying the fitting error. */
          pushBet(half, 'x12', tag + row[2], null, row[0], row[1], M, null,
                  x3 ? x3.probs[row[3]] : null);
          if (x3) {
            var last = picks[picks.length - 1];
            if (last && last.side === row[0] && last.half === half && last.kind === 'x12') {
              /* The margin on a three-way market is its full overround, not
                 a third of it. Under proportional de-vigging every outcome is
                 marked up by the same factor, so a punter backing one of them
                 pays the whole overround - exactly as in a two-way market.
                 Dividing by three made a 12.59% first-half 1X2 display as
                 4.20% and look cheaper than the 10.48% handicap beside it,
                 which inverted the comparison the whole board is for. */
              last.vig = x3.overround;
              last.pFairMarket = x3.probs[row[3]];
              last.cleanWin = last.dist.win || last.pFairMarket;
              last.efficiency = last.pFairMarket * (1 - x3.overround * 2.2);
            }
          }
        });
      }
      if (mk.oe) {
        pushBet(half, 'oe', tag + 'Total Odd', null, 'odd', mk.oe.odd, M, mk.oe.even);
        pushBet(half, 'oe', tag + 'Total Even', null, 'even', mk.oe.even, M, mk.oe.odd);
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
    /* EV only means something when this model knows something the prices do
       not. That is true with real statistics, and equally true when the user
       has told it something the market has not priced. */
    var rankByEV = (mw < 0.999 && !statsMissing) || Math.abs(tilt) > 0.001;
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
      marketWeight: mw, marketWeightBase: mwRaw,
      h2h: h2hUse,
      shape: { totalScale: totalScale, supremacyBeta: shape && shape.slopeFitted ? shape.beta : 1,
               supremacyAlpha: shape && shape.slopeFitted ? shape.alpha : 0,
               fitted: !!(shape && shape.slopeFitted), residZ: residZ,
               rmse: shape ? shape.rmse : null },
      statsMissing: statsMissing, tilt: tilt,
      implied: implied, implied1h: implied1h,
      /* divergence is the raw disagreement, which is what the reader should
         be told about; divergenceEff is what is left of it after the anchor
         slid, which is what the gate judged. */
      divergence: divergence, divergenceEff: divergenceEff,
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
        /* Availability decides, not market type. Excluding 1X2 by kind meant
           it never entered the comparison even where it was the better buy;
           the efficiency metric already charges it for its margin, so let
           the number rule. */
        /* Odd/even is excluded, not by market snobbery but because Poisson
           makes it ~50/50 whatever the teams are: no amount of real xG will
           ever give it an edge, so it can be cheap but never good, and
           circling it would send you to the one market where the model is
           permanently blind. Everything else competes on the number. */
        : (picks.filter(function (p) {
             return p.kind !== 'oe' && mixParlayEligible(p);
           })[0] || null),
      /* The cheapest leg on the fixture, always, whether or not the model
         found an edge. Once statistics were entered the board ranked by
         expected value and simply fell silent on every row without one -
         fifteen rows of twenty blank, which reads as the page having got
         worse for being given data. The row can say "no edge here, and this
         is the least expensive thing on it" instead. */
      bestCheap: picks.slice().sort(function (a, b) {
        return (b.efficiency || 0) - (a.efficiency || 0);
      }).filter(function (p) { return p.kind !== 'oe' && mixParlayEligible(p); })[0] || null,
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
  /**
   * A single positive strength number per team, on a points-like scale.
   *
   * strict: used by the market calibration below, which must not fit its
   * offset against teams whose defence was assumed rather than measured.
   * The model path is permissive - a team rated on xG created alone still
   * says something true about its attack, and saying nothing was the worse
   * answer.
   */
  function ratingBase(t, league, strict) {
    if (t.xgF == null) return null;
    if (strict && (t.statsMissing || t.xgA == null)) return null;
    var L = league.avgGoalsPerMatch / 2;
    var xgA = t.xgA == null ? L : t.xgA;      // league average, not a measurement
    // centred at 100 for a league-average team; 100 points per goal of xG diff
    return 100 + 100 * ((t.xgF - xgA) / Math.max(0.2, L));
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
  /* ============================================ HEAD TO HEAD =========== */
  /**
   * Past meetings between these two sides, read from a pasted list.
   *
   * Why this exists. On 24 September 2026 the page rated Liechtenstein
   * +1.50 at 52.3% and they lost 0-2 at home to Lithuania. The reader knew
   * before kick-off that it was wrong, and he knew it from the head to head
   * - Liechtenstein never do anything in these fixtures. The model had no
   * way to know: it had never seen a single previous meeting. It had the
   * bookmaker's price and the season's xG totals, and nothing else.
   *
   * What a head to head genuinely adds is narrower than it looks. Most of
   * the signal in "Lithuania beat Liechtenstein 2-0" is simply that
   * Lithuania are better, which the ratings already carry. The part that is
   * NOT already carried is the one that cost him: where one side is
   * amateur-level, the meetings are lopsided by more than any rating built
   * from a compressed season sample will say. So this is read as a
   * measurement of THIS pairing's supremacy, shrunk hard, and never allowed
   * to overrule the ratings outright.
   *
   * Venue is taken out of each meeting before averaging and the current
   * fixture's own home edge put back, so a run of away defeats is not
   * mistaken for weakness and a run of home wins is not mistaken for
   * strength.
   */
  var H2H_MONTH = 30.44 * 24 * 3600 * 1000;

  /** A meeting loses half its weight every four years. */
  function h2hAge(dateMs, nowMs) {
    if (!dateMs) return 0.5;                      // undated: counted, quietly
    var years = (nowMs - dateMs) / (12 * H2H_MONTH);
    if (years < 0) years = 0;
    return Math.pow(0.5, years / 4);
  }

  /**
   * Turn a pasted block into meetings. Accepts what the sites actually give:
   *   24/03/2025  Lithuania 2 - 0 Liechtenstein
   *   2025-03-24  Liechtenstein 0-2 Lithuania
   *   Mar 24, 2025  Lithuania 2-0 Liechtenstein  (Nations League)
   * A row needs two names either side of a score to count; anything else is
   * skipped rather than guessed at.
   */
  function parseH2H(text, nameToKey) {
    var out = [], bad = [];
    String(text || '').split(/[\r\n]+/).forEach(function (raw) {
      var line = String(raw).replace(/\s+/g, ' ').trim();
      if (!line) return;
      var date = grabDate(line);
      var withoutDate = date.rest;
      /* The score is the one "a - b" with a name on each side. Penalty
         shoot-out figures in brackets are left alone: the 90-minute score
         is what every market settles on. */
      var m = withoutDate.match(/^(.*?)\s+(\d{1,2})\s*[-:–]\s*(\d{1,2})\s+(.*)$/);
      if (!m) { bad.push(line); return; }
      var hName = m[1].replace(/\(.*?\)/g, '').trim();
      var aName = m[4].replace(/\(.*?\)/g, '').replace(/\b(aet|pen|pens|ot)\b.*$/i, '').trim();
      /* Trailing competition names run into the away side: cut at two or
         more spaces, or at a bracket, whichever came first. */
      aName = aName.split(/\s{2,}|[|•]/)[0].trim();
      var hKey = nameToKey(hName), aKey = nameToKey(aName);
      if (!hKey || !aKey || hKey === aKey) { bad.push(line); return; }
      out.push({ date: date.ms, home: hKey, away: aKey,
                 hg: parseInt(m[2], 10), ag: parseInt(m[3], 10) });
    });
    return { meetings: out, skipped: bad };
  }

  function grabDate(line) {
    /* ISO first. Tried the other way round, "2024-10-14" is chewed from the
       middle as 24-10-14 and the row is thrown away with "20" stuck to the
       team name. */
    var m = line.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (m) {
      return { ms: Date.UTC(+m[1], +m[2] - 1, +m[3]),
               rest: line.replace(m[0], ' ').replace(/\s+/g, ' ').trim() };
    }
    m = line.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
    if (m) {
      var y = parseInt(m[3], 10); if (y < 100) y += 2000;
      return { ms: Date.UTC(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10)),
               rest: line.replace(m[0], ' ').replace(/\s+/g, ' ').trim() };
    }
    m = line.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i);
    if (m) {
      var mon = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
        .indexOf(m[1].toLowerCase().slice(0, 3));
      return { ms: Date.UTC(+m[3], mon, +m[2]),
               rest: line.replace(m[0], ' ').replace(/\s+/g, ' ').trim() };
    }
    /* A bare year is better than nothing for ageing the meeting. */
    m = line.match(/\b(19|20)\d{2}\b/);
    if (m) return { ms: Date.UTC(+m[0], 6, 1), rest: line.replace(m[0], ' ').replace(/\s+/g, ' ').trim() };
    return { ms: null, rest: line };
  }

  /**
   * Reduce a set of meetings to what this fixture can use: a supremacy and
   * a total, both from the CURRENT home side's point of view, with the
   * venue of each past meeting taken out.
   */
  function h2hReading(meetings, homeKey, awayKey, opts) {
    opts = opts || {};
    var now = opts.now || Date.now();
    var venue = opts.venueEdge == null ? 0.35 : opts.venueEdge;   // goals
    var wSum = 0, supSum = 0, totSum = 0, used = [];
    (meetings || []).forEach(function (m) {
      var forHome, forAway, wasHome;
      if (m.home === homeKey && m.away === awayKey) { forHome = m.hg; forAway = m.ag; wasHome = 1; }
      else if (m.home === awayKey && m.away === homeKey) { forHome = m.ag; forAway = m.hg; wasHome = -1; }
      else return;                                   // not this pairing
      if (m.neutral) wasHome = 0;
      var w = h2hAge(m.date, now);
      if (!(w > 0)) return;
      wSum += w;
      supSum += w * ((forHome - forAway) - venue * wasHome);
      totSum += w * (forHome + forAway);
      used.push(m);
    });
    if (!wSum) return null;
    return {
      n: used.length, weight: wSum,
      supremacy: supSum / wSum,          // neutral-venue goal difference
      total: totSum / wSum,
      meetings: used
    };
  }

  /**
   * Fit the model's UNITS to the market's, once per board.
   *
   * Two things were systematically wrong, and neither was a view about any
   * particular match:
   *
   * 1. The goal LEVEL. WhoScored counts shots more generously than the 12.8
   *    per match this model references, so the volume term lifted every team
   *    at once: 3.15 model goals against 2.73 in the prices. It showed up as
   *    an "Over" pick on fifteen national-team rows out of twenty.
   *
   * 2. The SUPREMACY scale, which was far worse. WhoScored publishes no xG
   *    conceded, so every defence is assumed league average and only half of
   *    each team's strength can be expressed. The model's spread of opinion
   *    came out at a quarter of the market's - 0.25 goals of standard
   *    deviation against 0.99 - while still ordering the teams almost
   *    perfectly (r = 0.93). A model that knows who is better but says it
   *    four times too quietly backs the underdog in every single mismatch:
   *    San Marino +2.25, Liechtenstein +1.25, North Macedonia +1.25. That is
   *    the worst failure a betting page can have, and it is not an opinion,
   *    it is a missing column.
   *
   * So both are fitted against the prices on the board: a level per
   * competition, and one straight line through model supremacy against
   * market supremacy. What is fitted is two numbers for the whole board -
   * the units. What is NOT fitted is any single match: after the line is
   * applied, each fixture's distance from it is untouched, and that residual
   * is the model's own judgement, the only thing it ever bets on.
   *
   * The honest limit of this: a model calibrated to the board can only ever
   * say one match is mispriced RELATIVE to the others. It can never say the
   * whole board is wrong, and it does not try to.
   */
  function calibrateShape(fixtures, teams, leagues, opts) {
    var seen = [];
    fixtures.forEach(function (fx) {
      var lg = leagues.filter(function (l) { return l.id === fx.league; })[0];
      if (!lg) return;
      var h = teams[fx.home], a = teams[fx.away];
      if (!h || !a || h.statsMissing || a.statsMissing) return;
      var lam;
      try { lam = lambdas(h, a, lg, opts || {}); } catch (err) { return; }
      var imp = impliedLambdas(fx, lg, { home: lam.home, away: lam.away });
      if (!imp) return;
      var m = lam.home + lam.away, k = imp.home + imp.away;
      if (!(m > 0) || !(k > 0)) return;
      seen.push({ league: fx.league, lg: lg, fx: fx,
                  mh: lam.home, ma: lam.away, kh: imp.home, ka: imp.away });
    });

    var NONE = { scale: 1, byLeague: {}, beta: 1, alpha: 0, n: 0,
                 reliable: false, slopeFitted: false, r: null, rmse: null,
                 scaleFor: function () { return 1; } };
    if (seen.length < 3) return NONE;

    /* --- 1. level, per competition ------------------------------------- */
    var per = {}, allM = 0, allK = 0;
    seen.forEach(function (o) {
      var b = per[o.league] || (per[o.league] = { m: 0, k: 0, n: 0 });
      b.m += o.mh + o.ma; b.k += o.kh + o.ka; b.n++;
      allM += o.mh + o.ma; allK += o.kh + o.ka;
    });
    var global = clamp(allK / allM, 0.75, 1.33);
    var byLeague = {};
    Object.keys(per).forEach(function (id) {
      /* Three matches is the least that can tell a level from a coincidence;
         a thinner competition borrows the board's level. */
      byLeague[id] = per[id].n >= 3 ? clamp(per[id].k / per[id].m, 0.75, 1.33) : global;
    });
    function scaleFor(id) { return byLeague[id] != null ? byLeague[id] : global; }

    /* --- 2. supremacy, one line for the whole board --------------------- */
    var xs = [], ys = [];
    seen.forEach(function (o) {
      var sc = scaleFor(o.league);
      xs.push((o.mh - o.ma) * sc);
      ys.push(o.kh - o.ka);
    });
    var n = xs.length;
    function mean(v) { var t = 0; for (var i = 0; i < v.length; i++) t += v[i]; return t / v.length; }
    var mx = mean(xs), my = mean(ys), cov = 0, vx = 0, vy = 0;
    for (var i = 0; i < n; i++) {
      cov += (xs[i] - mx) * (ys[i] - my);
      vx += (xs[i] - mx) * (xs[i] - mx);
      vy += (ys[i] - my) * (ys[i] - my);
    }
    var out = { scale: global, byLeague: byLeague, n: n, reliable: true,
                beta: 1, alpha: 0, slopeFitted: false, r: null, rmse: null,
                scaleFor: function (id) { return scaleFor(id); } };

    /* Eight fixtures is the fewest that can place a line rather than trace
       two points. */
    if (n < 8 || vx <= 1e-9 || vy <= 1e-9) return out;
    var r = cov / Math.sqrt(vx * vy);
    out.r = r;

    /* A board where the model cannot even ORDER the teams the way the prices
       do is not a board with a weak fit, it is a board with wrong numbers on
       it - a column read from the wrong table, a paste that landed on the
       wrong team, figures from a different season. Stretching that would
       only shout the mistake louder, and leaving it alone was worse still:
       on a test board whose ratings correlated at -0.35 with the prices, the
       page offered forty picks out of forty-two at twelve to fourteen per
       cent expected value. Every one of them was an artefact.

       So this is reported as what it is, and the caller defers to the
       prices entirely. */
    if (!(r > 0.5)) { out.orderDisagrees = true; return out; }

    /* The cap is a runaway guard, not a working limit: when it binds, the
       model has not been put into the market's units at all and the biggest
       mismatches stay under-read, which shows up as a pick on every long
       underdog. It is set high enough to be loose in normal use, and
       whether it bound is reported so the caller can tell. */
    var betaRaw = cov / vx;
    var beta = clamp(betaRaw, 1, 8);
    var alpha = my - beta * mx;
    var rss = 0;
    for (var j = 0; j < n; j++) {
      var e = ys[j] - (alpha + beta * xs[j]);
      rss += e * e;
    }
    out.beta = beta; out.alpha = alpha; out.slopeFitted = true;
    out.betaRaw = betaRaw; out.betaCapped = betaRaw > 8;
    out.r = r; out.rmse = Math.sqrt(rss / n);
    return out;
  }

  function calibrateOffset(fixtures, teams, leagues, hfaLogit) {
    hfaLogit = hfaLogit == null ? 0.22 : hfaLogit;   // home edge on the BT scale
    var obs = [];
    fixtures.forEach(function (fx) {
      var lg = leagues.filter(function (l) { return l.id === fx.league; })[0];
      if (!lg) return;
      var h = teams[fx.home], a = teams[fx.away];
      if (!h || !a) return;
      var rh = ratingBase(h, lg, true), ra = ratingBase(a, lg, true);
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
    parseTeamStats: parseTeamStats, estimateXG: estimateXG, grabStat: grabStat,
    parseStatsTable: parseStatsTable, parseTeamsTable: parseTeamsTable,
    parseXGAgainst: parseXGAgainst,
    splitDiscipline: splitDiscipline,
    parseStatsJSON: parseStatsJSON, STAT_PATTERNS: STAT_PATTERNS,
    parseManyTeams: parseManyTeams, matchTeamName: matchTeamName,
    XG_PER_SHOT: XG_PER_SHOT,
    analyseFixture: analyseFixture, outrightProbs: outrightProbs,
    impliedLambdas: impliedLambdas, marketTargets: marketTargets, fitError: fitError,
    totalGoalsDist: totalGoalsDist, fmtLine: fmtLine,
    simulateParlay: simulateParlay, legMultiplier: legMultiplier,
    legExpectedMultiplier: legExpectedMultiplier,
    pickParlayLegs: pickParlayLegs, toSimLegs: toSimLegs,
    settleFromScore: settleFromScore, gradeCoupon: gradeCoupon,
    calibrationReport: calibrationReport, OUTCOME_VALUE: OUTCOME_VALUE,
    ratingBase: ratingBase, btProb: btProb, calibrateOffset: calibrateOffset,
    calibrateShape: calibrateShape,
    parseH2H: parseH2H, h2hReading: h2hReading, h2hAge: h2hAge,
    crossCheck: crossCheck, compoundingArithmetic: compoundingArithmetic,
    MIX_PARLAY_MIN_ODDS: MIX_PARLAY_MIN_ODDS, mixParlayEligible: mixParlayEligible
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.MBEngine = API;
})(typeof window !== 'undefined' ? window : globalThis);
