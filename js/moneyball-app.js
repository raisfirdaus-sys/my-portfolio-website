/* ==========================================================================
   MONEYBALL ODDS - UI layer
   Renders the analysis board, charts, stat inputs and the parlay simulator.
   All modelling lives in moneyball-engine.js; this file only presents it.
   ========================================================================== */
(function () {
  'use strict';
  var E = window.MBEngine;
  var DATA = null, STATE = {
    slate: 4, fixtureId: null, format: 'decimal', marketWeight: 0.35,
    legs: [], overrides: {}, tilt: {}, scores: {}, paste: {}, importMsg: {}, editMsg: {}, boardAll: false, ttOnlyReal: true, newsSlateOnly: true,
    api: { preset: 'sportmonks', token: '', url: '', search: '', bulk: '', ids: {} }
  };

  /* ------------------------------------------------------------ helpers -- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  /* Headlines and publisher names arrive from an outside feed and are put
     into innerHTML. Anything from there is escaped first - a feed is not a
     trusted source, however ordinary its contents look. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pct(v, d) { return (v * 100).toFixed(d == null ? 1 : d) + '%'; }
  function signPct(v, d) {
    var s = (v * 100).toFixed(d == null ? 1 : d);
    return (v > 0 ? '+' : '') + s + '%';
  }
  function rupiah(v) {
    return 'Rp ' + Math.round(v).toLocaleString('en-US');
  }
  function fmtOdds(dec) {
    if (dec == null) return '--';
    if (STATE.format === 'decimal') return dec.toFixed(2);
    var v = E.fromDecimal(dec, STATE.format);
    if (v == null) return dec.toFixed(2);
    return STATE.format === 'american' ? (v > 0 ? '+' : '') + Math.round(v)
                                       : (v > 0 ? '' : '') + v.toFixed(2);
  }
  function team(key) { return (DATA.teams[key] || { name: key }); }
  function league(id) { return DATA.leagues.filter(function (l) { return l.id === id; })[0]; }
  /* The two figures the model cannot run without. Everything else makes a
     rating sharper; these two decide whether there is a rating at all - the
     engine returns no rating without both, which pins the fixture to the
     bookmaker's price and makes EV zero everywhere. A page that reports
     "filled 7 of 10" and says nothing about which 3 is a page that looks
     like it worked while the model is switched off. */
  var MODEL_REQUIRED = [['xgF', 'xG created']];

  var FIELD_LABEL = {
    matches: 'matches', goals: 'goals', xgF: 'xG created', xgA: 'xG conceded',
    xA: 'xA', shots: 'shots', sot: 'shots on target', bigMiss: 'big chances missed',
    fouls: 'fouls', tackles: 'tackles', yellow: 'yellow cards', red: 'red cards'
  };

  var SNAP_FIELDS = ['matches','goals','xgF','xgA','xA','shots','sot',
                     'bigMiss','fouls','tackles','yellow','red'];

  /**
   * Build a team's new snapshot from an import.
   *
   * An import replaces rather than patches, because patching is how a
   * season quietly rots: fill Manchester United from UEFA after one
   * Champions League match, paste WhoScored's ten-match page on top, and
   * goals and shots become ten-match figures while xG stays the number
   * from a single night - with "matches" now reading 10, so that night's
   * xG is compared as though it covered ten.
   *
   * With one exception, which is the whole point of being able to add xG
   * conceded afterwards: a figure already held is KEPT when it was
   * measured over the same number of matches as the new import. Same
   * sample, another column of it - the Against tab of the same page, or a
   * figure typed by hand against the same match count. Different sample,
   * cleared and named.
   */
  function snapshotFrom(prev, incoming, matches) {
    prev = prev || {};
    var prevM = prev._m || {};
    var snap = { _m: {} }, dropped = [], kept = [];

    SNAP_FIELDS.forEach(function (f) {
      if (incoming[f] != null) {
        snap[f] = incoming[f];
        snap._m[f] = matches;
        return;
      }
      if (f === 'matches' || prev[f] == null) return;
      /* Held over only if it came from a sample of the same size. An
         unstamped figure predates this rule, so it cannot be vouched for. */
      if (prevM[f] != null && prevM[f] === matches) {
        snap[f] = prev[f];
        snap._m[f] = prevM[f];
        kept.push(FIELD_LABEL[f] || f);
      } else {
        dropped.push(FIELD_LABEL[f] || f);
      }
    });

    if (prev.logo) snap.logo = prev.logo;        // not a measurement
    snap._src = { matches: matches, when: Date.now() };
    snap._dropped = dropped;
    snap._kept = kept;
    return snap;
  }

  /* How old this team's figures are, and how big a sample they came from.
     A snapshot taken in September is not wrong in November, but it is out
     of date, and the page should say which. */
  function snapshotNote(key) {
    var src = (STATE.overrides[key] || {})._src;
    if (!src || !src.when) return '';
    return ' \u00b7 ' + src.matches + ' matches, imported ' + timeAgo(src.when);
  }

  function missingForModel(key) {
    var t = effStats(key);
    if (!t) return [];
    return MODEL_REQUIRED.filter(function (r) { return t[r[0]] == null; })
                         .map(function (r) { return r[1]; });
  }

  /* Rated, but with its defence assumed rather than measured. Worth saying
     out loud wherever the team appears: the number moved, and half of what
     moved it is a league average. */
  function defenceAssumed(key) {
    var t = effStats(key);
    return !!(t && t.xgF != null && t.xgA == null);
  }

  function effStats(key) {
    var base = DATA.teams[key];
    var ov = STATE.overrides[key];
    if (!ov) return base;
    var merged = {};
    for (var k in base) merged[k] = base[k];
    for (var k2 in ov) merged[k2] = ov[k2];
    /* The engine rates a team from xG created, standing league average in
       for xG conceded when it is missing - WhoScored publishes no xG
       conceded except behind its xG tab's "Against" toggle, and refusing
       to rate without it meant the commonest source there is could not
       move a price. So one figure opens the gate; the other sharpens it. */
    if (merged.xgF != null) merged.statsMissing = false;
    return merged;
  }
  function teamsView() {
    var out = {};
    for (var k in DATA.teams) out[k] = effStats(k);
    return out;
  }
  /** Did a human type these numbers, or are they my placeholder seeds? */
  function statOrigin(key) {
    var base = DATA.teams[key];
    if (!base) return 'none';
    var ov = STATE.overrides[key];
    var userFilled = ov && ['xgF', 'xgA', 'goals', 'shots'].some(function (f) {
      return ov[f] != null;
    });
    if (userFilled) return 'user';
    if (base.statsMissing) return 'none';
    return 'seed';
  }
  var CALIB = null;
  function refreshCalibration() {
    try {
      CALIB = E.calibrateOffset(slateFixtures(STATE.slate), teamsView(), DATA.leagues);
    } catch (err) { CALIB = null; }
  }
  /* One basis for the whole page. The value board used STATE.marketWeight
     while the parlay builder forced a full market anchor, so the same match
     was being priced two different ways on one screen: Villarreal +2.00 read
     72.2% on the board and 53.2% in the ticket. Whichever number is right,
     showing both without saying so is worse than either. Placeholder seeds
     are not information, so when nobody has entered statistics the anchor is
     full, everywhere. */
  function analyse(fx) {
    /* Per fixture, not per slate. Filling in one match must not hand model
       influence to every other match still running on placeholder seeds -
       that is how a slate of invented edges appears the moment one real
       entry is made. */
    return E.analyseFixture(fx, teamsView(), DATA.leagues, {
      marketWeight: fixtureHasUserStats(fx) ? STATE.marketWeight : 1,
      calibration: CALIB,
      tilt: STATE.tilt[fx.id] || 0
    });
  }
  function slateFixtures(s) {
    return DATA.fixtures.filter(function (f) { return (f.slate || 1) === s; });
  }

  /* -------------------------------------------------------------- tips --- */
  var tip = null;
  function showTip(html, ev) {
    if (!tip) tip = $('tip');
    tip.innerHTML = html;
    tip.style.opacity = '1';
    tip.setAttribute('aria-hidden', 'false');
    var r = tip.getBoundingClientRect();
    var x = Math.min(ev.clientX + 13, window.innerWidth - r.width - 8);
    var y = Math.max(8, ev.clientY - r.height - 10);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() {
    if (!tip) tip = $('tip');
    tip.style.opacity = '0';
    tip.setAttribute('aria-hidden', 'true');
  }
  function bindTip(node, htmlFn) {
    node.addEventListener('mousemove', function (e) { showTip(htmlFn(), e); });
    node.addEventListener('mouseleave', hideTip);
  }

  /* ================================================== REALITY HEADLINE == */
  function renderReality() {
    var box = $('reality');
    box.innerHTML = '';
    var an = analysesForSlate();
    if (!an.length) { box.textContent = 'No fixtures on this schedule.'; return; }

    // average two-way margin actually on offer in this slate
    var vigs = [];
    an.forEach(function (a) {
      a.picks.forEach(function (p) {
        if (p.vig != null && (p.kind === 'ah' || p.kind === 'ou')) vigs.push(p.vig);
      });
    });
    var avgVig = vigs.length ? vigs.reduce(function (x, y) { return x + y; }, 0) / vigs.length : 0;
    var withStats = an.filter(function (a) { return !a.statsMissing; }).length;

    /* Where do the numbers behind any positive EV actually come from? */
    var origins = { user: 0, seed: 0, none: 0 };
    an.forEach(function (a) {
      [a.fixture.home, a.fixture.away].forEach(function (k) { origins[statOrigin(k)]++; });
    });

    var chosen = E.pickParlayLegs(an, parlayOpts(an));
    var sim = chosen.length ? E.simulateParlay(E.toSimLegs(chosen), 40000, 20260922) : null;
    var nLegs = chosen.length;

    box.className = 'notice ' + (avgVig > 0.07 ? 'bad' : 'notice');
    var h = el('h3'); h.textContent = 'The maths of this schedule, before you pick anything';
    box.appendChild(h);

    var rows = [
      ['Average bookmaker margin per leg (Handicap & O/U)', pct(avgVig, 2),
       avgVig > 0.07 ? 'very expensive - a thin market'
                     : 'normal for an Asian market'],
      ['Fixtures with xG entered', withStats + ' of ' + an.length,
       withStats === 0 ? 'model = market, EV is zero until you enter statistics'
         : origins.user === 0
           ? 'all still the shipped placeholders, NOT real data'
           : origins.user + ' teams you filled in yourself, ' + origins.seed + ' teams still on placeholders'],
    ];
    if (sim) {
      rows.push(['Parlay ' + nLegs + '-leg parlay, the best that can be built here',
        'EV ' + signPct(sim.ev, 1),
        'expected return ' + sim.expectedReturn.toFixed(3) + 'x, chance of profit ' + pct(sim.pProfit, 2)]);
    }
    rows.forEach(function (r) {
      var p = el('p');
      p.innerHTML = r[0] + ': <span class="fig">' + r[1] + '</span> &mdash; ' + r[2];
      box.appendChild(p);
    });
    /* The single most dangerous state this tool can be in: advertising a
       positive edge that rests on numbers too thin to carry it. The first
       version only caught the all-placeholder case, so entering four teams
       with ONE match each switched the warning off and left "EV +29.1%"
       standing on a nine-leg parlay - a claim no nine-leg parlay can
       honestly make. Three ways the edge can be untrustworthy, and any one
       of them is enough. */
    var thinLegs = [], farLegs = [];
    chosen.forEach(function (c) {
      var a2 = c.analysis || c;
      if (!a2 || !a2.fixture) return;
      [a2.fixture.home, a2.fixture.away].forEach(function (k) {
        var t = effStats(k);
        if (statOrigin(k) === 'user' && t && t.matches != null && t.matches < 4 &&
            thinLegs.indexOf(k) < 0) thinLegs.push(k);
      });
      if (a2.divergence > 0.25) farLegs.push(a2.fixture.id);
    });

    if (sim && sim.ev > 0 && (thinLegs.length || farLegs.length) &&
        !(origins.user === 0 && origins.seed > 0)) {
      var warnThin = el('p');
      warnThin.style.cssText = 'margin-top:8px;padding:9px 11px;border-radius:5px;' +
        'background:var(--surface-3);border-left:4px solid var(--critical)';
      warnThin.innerHTML = '<strong>The positive EV above cannot be trusted yet.</strong> ' +
        (thinLegs.length
          ? '<strong>' + thinLegs.length + ' teams</strong> on this ticket whose data covers ' +
            '<strong>fewer than 4 matches</strong> (' +
            thinLegs.slice(0, 4).map(function (k) { return team(k).name; }).join(', ') +
            (thinLegs.length > 4 ? ', &hellip;' : '') + '). '
          : '') +
        (farLegs.length
          ? '<strong>' + farLegs.length + ' fixtures</strong> on this ticket where the model differs by more than ' +
            '25% from the bookmaker price, which points at doubtful inputs rather than a doubtful bookmaker. '
          : '') +
        (thinLegs.length
          ? 'A sample that small makes one good match look like a permanent edge. '
          : 'A gap that size almost always means the numbers going in are still placeholders, not ' +
            'pengukuran. ') +
        '<strong>No ' + nLegs + '-leg parlay genuinely carries positive EV</strong> ' +
        '&mdash; if this number says otherwise, the number is what is wrong. ' +
        (thinLegs.length
          ? 'Raise each team match count to 4&ndash;5, then read it again.'
          : 'Enter real statistics for those fixtures, then read it again.');
      box.appendChild(warnThin);
    }

    if (sim && sim.ev > 0 && origins.user === 0 && origins.seed > 0) {
      var warn = el('p');
      warn.style.cssText = 'margin-top:8px;padding:9px 11px;border-radius:5px;' +
        'background:var(--surface-3);border-left:4px solid var(--critical)';
      warn.innerHTML = '<strong>Do not bet on these numbers.</strong> The positive EV above ' +
        'comes from the <em>placeholder</em> statistics shipped so the tool would run at all, not from ' +
        'real match data. A placeholder that happens to disagree with the bookmaker will ' +
        'always look like an opportunity. Replace xG, xA, shots, fouls, tackles and cards in the ' +
        '<em>Statistics Input</em> form with real data from WhoScored / FBref / Understat first &mdash; until then, ' +
        'the only genuinely real figures on this page are the bookmaker margin and the line types.';
      box.appendChild(warn);
    }

    if (sim) {
      var p2 = el('p');
      p2.innerHTML = '<strong>What that costs:</strong> every extra leg multiplies the bookmaker margin once more. ' +
        'At ' + pct(avgVig, 1) + ' per leg, ' + nLegs + ' legs hold back about <span class="fig">' +
        pct(Math.pow(1 - avgVig, nLegs), 1) + '</span> of the stake before a single result is counted. ' +
        'This tool cannot change that &mdash; what it can do: choose the legs with the smallest margin, ' +
        'refuse quarter lines, and show you the real numbers.';
      box.appendChild(p2);
    }
  }

  /* ==================================================== FIXTURE LIST ==== */
  /* Kept for the narrow list, which the wide board replaced. It renders
     only if that list is present, so restoring the markup is enough to
     bring it back. */
  function renderFixtures() {
    var list = $('fx-list'); if (!list) return;
    list.innerHTML = '';
    var fxs = slateFixtures(STATE.slate);
    var cnt = $('fx-count'); if (cnt) cnt.textContent = fxs.length + ' matches';
    var lastLeague = null;
    fxs.forEach(function (fx) {
      if (fx.league !== lastLeague) {
        lastLeague = fx.league;
        var lg = league(fx.league);
        list.appendChild(el('div', 'fx-group', lg ? lg.name : fx.league));
      }
      var a = null; try { a = analyse(fx); } catch (err) {}
      var btn = el('button', 'fx-row');
      btn.type = 'button';
      btn.setAttribute('aria-current', fx.id === STATE.fixtureId ? 'true' : 'false');
      btn.appendChild(el('span', 'fx-time', fx.kickoff || ''));
      var t = el('span', 'fx-teams');
      t.innerHTML = team(fx.home).name + '<br /><em>v</em> ' + team(fx.away).name;
      btn.appendChild(t);
      var badge = el('span', 'fx-badge');
      if (a && a.best) { badge.textContent = signPct(a.best.ev, 0); badge.classList.add('prime'); }
      else if (a) { badge.textContent = a.statsMissing ? 'market' : 'neutral'; }
      btn.appendChild(badge);
      btn.addEventListener('click', function () {
        STATE.fixtureId = fx.id; renderFixtures(); renderMatchCentre();
      });
      list.appendChild(btn);
    });
  }

  /* ====================================================== WIDE BOARD ==== */
  /* Club crests are trademarks. Shipping real ones on a page meant to be
     sold is the owner's risk to take, not mine to take for them - so a
     crest is a generated monogram unless that team carries a `logo` URL the
     operator has the right to use. Colour is derived from the team key, so
     it is stable across reloads and never two teams sharing a row. */
  /* A crest is drawn by the reader's browser, never committed here.
       1. logo   - set by the operator, or captured from their own API
                   response, so the right to use it is theirs
       2. flag   - national teams; a flag is not a club trademark
       3. domain - Clearbit by the club's own domain, with Google's favicon
                   service behind it (Clearbit sits on several ad-blocker
                   lists and silently fails for some readers)
       4. monogram - two letters on a colour derived from the team key, so
                   the column is never blank and never shifts. */
  function monogramHTML(key, hidden) {
    var t = effStats(key) || team(key);
    var words = String(t.name || key).replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/)
      .filter(function (w) { return w.length; });
    var mono = (words.length > 1
      ? words[0].charAt(0) + words[1].charAt(0)
      : (words[0] || '?').slice(0, 2)).toUpperCase();
    var h = 0;
    for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
    return '<i class="crest crest-mono" aria-hidden="true" style="' +
      (hidden ? 'display:none;' : '') + 'background:hsl(' + h + ',48%,34%)">' +
      mono + '</i>';
  }

  function crestHTML(key) {
    var t = effStats(key) || team(key);
    var src = null, second = null;
    if (t.logo) {
      src = String(t.logo);
    } else if (t.flag) {
      src = 'https://flagcdn.com/w40/' + encodeURIComponent(t.flag) + '.png';
    } else if (t.domain) {
      src = 'https://logo.clearbit.com/' + encodeURIComponent(t.domain) + '?size=128';
      second = 'https://www.google.com/s2/favicons?sz=128&domain=' +
        encodeURIComponent(t.domain);
    }
    if (!src) return monogramHTML(key, false);

    var showMono = "this.style.display='none';" +
                   "this.nextElementSibling.style.display='inline-flex';";
    var onerr = second
      ? "if(!this.dataset.f){this.dataset.f='1';this.src='" + second + "';}else{" + showMono + "}"
      : showMono;

    return '<img class="crest crest-img" src="' + src.replace(/"/g, '&quot;') +
           '" alt="' + String(t.name || key).replace(/"/g, '&quot;') +
           '" loading="lazy" onerror="' + onerr + '" />' +
           monogramHTML(key, true);
  }

  /* One market cell: the line above, the two prices below, right-aligned so
     a column of digits can be scanned down the page. */
  function marketCell(line, a, b, la, lb) {
    if (a == null && b == null) return '<span class="board-cell num">&mdash;</span>';
    return '<span class="board-cell num">' +
      (line != null ? '<span class="line">' + line + '</span><br />' : '') +
      (la || '') + '<b>' + (a != null ? fmtOdds(a) : '&mdash;') + '</b>' +
      ' &middot; ' + (lb || '') + '<b>' + (b != null ? fmtOdds(b) : '&mdash;') + '</b>' +
      '</span>';
  }

  /* The main line is the one closest to level for a handicap, and the one
     the book lists first for totals - that is the price everything else on
     the board is quoted around. */
  function mainAH(fx) {
    var rows = (((fx.markets || {}).ft || {}).ah) || [];
    if (!rows.length) return null;
    return rows.slice().sort(function (x, y) {
      return Math.abs(x.line) - Math.abs(y.line);
    })[0];
  }
  function mainOU(fx) {
    var rows = (((fx.markets || {}).ft || {}).ou) || [];
    return rows.length ? rows[0] : null;
  }

  function boardFixtures() {
    return STATE.boardAll
      ? DATA.fixtures.slice()
      : slateFixtures(STATE.slate);
  }

  function renderBoard() {
    var host = $('board'); if (!host) return;
    host.innerHTML = '';
    var fxs = boardFixtures();

    var cnt = $('board-count');
    if (cnt) {
      cnt.textContent = fxs.length + ' matches' +
        (STATE.boardAll ? ' — all schedules' : '');
    }

    var head = el('div', 'board-head');
    head.innerHTML = '<span>Time</span><span>Match</span>' +
      '<span class="num">Handicap</span><span class="num">Over / Under</span>' +
      '<span class="num">1 &middot; X &middot; 2</span><span>Model pick</span>';
    host.appendChild(head);

    var lastLeague = null, lastSlate = null;
    fxs.forEach(function (fx) {
      var groupKey = STATE.boardAll ? (fx.slate || 1) + '|' + fx.league : fx.league;
      if (groupKey !== lastLeague) {
        lastLeague = groupKey;
        var lg = league(fx.league);
        var label = (lg ? lg.name : fx.league);
        if (STATE.boardAll && (fx.slate || 1) !== lastSlate) {
          lastSlate = fx.slate || 1;
          var sl = (DATA.meta.slates || {})[String(lastSlate)] || '';
          label = (sl.split(' - ')[0] || ('Schedule ' + lastSlate)) + ' · ' + label;
        }
        host.appendChild(el('div', 'board-group', label));
      }

      var a = null; try { a = analyse(fx); } catch (err) {}
      var ah = mainAH(fx), ou = mainOU(fx);
      var x12 = (((fx.markets || {}).ft || {}).x12) || {};

      var row = el('button', 'board-row');
      row.type = 'button';
      row.setAttribute('aria-current', fx.id === STATE.fixtureId ? 'true' : 'false');

      var time = el('span', 'board-time');
      time.innerHTML = (fx.date ? fx.date + '<br />' : '') + (fx.kickoff || '');
      row.appendChild(time);

      var teams = el('span', 'board-teams');
      teams.innerHTML =
        '<span class="board-team">' + crestHTML(fx.home) + '<span>' + team(fx.home).name + '</span></span>' +
        '<span class="board-team">' + crestHTML(fx.away) + '<span>' + team(fx.away).name + '</span></span>';
      row.appendChild(teams);

      var ahCell = el('span');
      ahCell.innerHTML = ah
        ? marketCell((ah.line > 0 ? '+' : '') + ah.line, ah.h, ah.a)
        : '<span class="board-cell num">&mdash;</span>';
      row.appendChild(ahCell);

      var ouCell = el('span');
      ouCell.innerHTML = ou
        ? marketCell(ou.line, ou.o, ou.u, 'A ', 'B ')
        : '<span class="board-cell num">&mdash;</span>';
      row.appendChild(ouCell);

      var x12Cell = el('span', 'board-cell num');
      x12Cell.innerHTML = (x12['1'] != null)
        ? '<b>' + fmtOdds(x12['1']) + '</b> &middot; <b>' + fmtOdds(x12.X) +
          '</b> &middot; <b>' + fmtOdds(x12['2']) + '</b>'
        : '&mdash;';
      row.appendChild(x12Cell);

      /* The highlight is the whole point of the page: the leg the model
         would take, in light blue, exactly as on the value board. */
      var pick = el('span', 'board-pick');
      if (a && a.best) {
        var cw = (a.best.dist ? (a.best.dist.win || 0) + 0.5 * (a.best.dist.halfWin || 0)
                              : a.best.pModel) || 0;
        pick.classList.add('hl');
        pick.innerHTML = '<span class="lbl">' + a.best.label + '</span><br />' +
          '<span class="meta">' + fmtOdds(a.best.odds) + ' · full payout ' +
          pct(cw, 1) + ' · vig ' + pct(a.best.vig || 0, 2) + '</span>';
      } else if (a && a.statsMissing) {
        pick.innerHTML = '<span class="meta">following the bookmaker</span>';
      } else if (a && a.divergence > 0.25) {
        /* The guard fired: the model disagrees with the market by more than
           a quarter. On that much disagreement the inputs are the likely
           culprit, not the market, so no leg is promoted. Saying only
           "none" made that look like a fault. */
        pick.innerHTML = '<span class="meta">model differs by <strong>' +
          pct(a.divergence, 0) + '</strong> from the market<br />too far &mdash; nothing selected</span>';
      } else {
        pick.innerHTML = '<span class="meta">nothing worth taking</span>';
      }
      row.appendChild(pick);

      row.addEventListener('click', function () {
        if ((fx.slate || 1) !== STATE.slate) {
          STATE.slate = fx.slate || 1;
          STATE.legs = [];
        }
        STATE.fixtureId = fx.id;
        renderAll();
        /* The board can be long enough that the match centre below it is off
           screen, so a click would look like nothing happened. Bring it into
           view - honouring a reader who has asked for less motion. */
        var target = $('mc-block');
        if (target && target.scrollIntoView) {
          var still = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          target.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
        }
      });
      host.appendChild(row);
    });
  }

  function renderBoardTools() {
    var host = $('board-tools'); if (!host) return;
    host.innerHTML = '';
    [['This schedule', false], ['All ' + DATA.fixtures.length + ' matches', true]]
      .forEach(function (opt) {
        var b = el('button', 'chip', opt[0]);
        b.type = 'button';
        b.setAttribute('aria-pressed', !!STATE.boardAll === opt[1] ? 'true' : 'false');
        b.addEventListener('click', function () {
          STATE.boardAll = opt[1];
          renderBoardTools();
          renderBoard();
        });
        host.appendChild(b);
      });
  }

  /* ================================================= FOOTBALL NEWS ==== */
  /* Headlines are fetched server-side every half hour by a scheduled
     workflow and committed as a static file; this only reads it. The feed
     carries no photographs, so each card leads with the crest of the club
     the story is tagged to - an image this page already draws, rather than
     a publisher's picture it has no licence to republish. */
  var NEWS = null;

  function timeAgo(ms) {
    if (!ms) return '';
    var mins = Math.round((Date.now() - ms) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    var days = Math.round(hrs / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
  }

  function newsTeamsHTML(item) {
    var known = (item.teams || []).filter(function (k) { return DATA.teams[k]; });
    if (!known.length) return '';
    return '<span class="news-teams">' +
      known.slice(0, 3).map(function (k) {
        return crestHTML(k) + '<span class="news-club">' + team(k).name + '</span>';
      }).join('<span class="dot">&middot;</span>') +
      '</span>';
  }

  function newsItems() {
    var all = (NEWS && NEWS.items) || [];
    if (!STATE.newsSlateOnly) return all;
    /* Only stories about teams playing in the schedule on screen. */
    var keys = {};
    slateFixtures(STATE.slate).forEach(function (f) { keys[f.home] = 1; keys[f.away] = 1; });
    return all.filter(function (it) {
      return (it.teams || []).some(function (k) { return keys[k]; });
    });
  }

  function renderNews() {
    var host = $('news-body'); if (!host) return;
    host.innerHTML = '';
    var sub = $('news-sub');

    if (!NEWS) {
      if (sub) sub.textContent = '';
      host.innerHTML = '<p class="stat-note">Loading headlines&hellip;</p>';
      return;
    }
    if (NEWS.error) {
      if (sub) sub.textContent = '';
      host.innerHTML = '<div class="notice"><h3>Headlines unavailable</h3>' +
        '<p>The news file could not be read. The rest of the page is unaffected &mdash; ' +
        'odds and model output do not depend on it.</p></div>';
      return;
    }

    var items = newsItems();
    if (sub) {
      sub.textContent = items.length + ' stories' +
        (NEWS.generatedAt ? ' · updated ' + timeAgo(NEWS.generatedAt) : '');
    }

    if (!items.length) {
      host.innerHTML = '<div class="notice"><h3>No stories for this schedule yet</h3>' +
        '<p>The feed is filtered to the clubs on this board. Switch to ' +
        '<strong>All clubs</strong> above, or wait for the next refresh &mdash; ' +
        'headlines are collected every 30 minutes.</p></div>';
      return;
    }

    /* Two shapes, alternating: a row of four with the picture on top, then
       a row of two wide ones with the picture beside the text. A grid where
       every card is identical reads as a list; breaking the rhythm every
       few rows is what makes a news page look edited rather than generated. */
    function card(it, wide) {
      var a = el('a', 'news-card' + (wide ? ' wide' : ' tall'));
      /* javascript: and data: URLs in a feed would execute on click. */
      a.href = /^https?:\/\//i.test(it.link || '') ? it.link : '#';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';

      /* The publisher's own picture, loaded from the publisher and never
         copied here. Same check as the link: only http(s). */
      var shot = /^https?:\/\//i.test(it.image || '') ? it.image : '';

      /* Every card gets a frame, photograph or not - the way the stock page
         does it. Without one the frame shows the club crest, which reads as
         a deliberate placeholder rather than a hole in the row. */
      var badge = (it.teams && it.teams.length) ? crestHTML(it.teams[0]) : '';

      a.innerHTML =
        '<div class="news-shot' + (shot ? ' has-img' : '') + '">' +
          (shot
            ? '<img class="news-photo" src="' + esc(shot) + '" alt="" ' +
              'loading="lazy" decoding="async" referrerpolicy="no-referrer" />'
            : '') +
          '<span class="news-shot-fallback">' + badge + '</span>' +
        '</div>' +
        '<div class="news-body">' +
          newsTeamsHTML(it) +
          (wide ? '<h3>' : '<h4>') + esc(it.title) + (wide ? '</h3>' : '</h4>') +
          (wide && it.summary ? '<p class="news-summary">' + esc(it.summary) + '</p>' : '') +
          '<span class="news-meta">' + esc(it.publisher || '') +
          (it.publishedAt ? '<span class="dot">&middot;</span>' + timeAgo(it.publishedAt) : '') +
          '</span>' +
        '</div>';

      /* Hotlinked pictures fail for reasons invisible from here: the
         publisher blocks it, the URL rots, the reader is offline. Fall back
         to the crest tile rather than leave a torn-image box mid-page. */
      var img = shot ? a.querySelector('img.news-photo') : null;
      if (img) {
        img.addEventListener('error', function () {
          var frame = a.querySelector('.news-shot');
          if (frame) frame.classList.remove('has-img');
          if (img.parentNode) img.parentNode.removeChild(img);
        });
      }
      return a;
    }

    /* Four across, then two wide, repeating. A wide card earns its width
       with a summary, so stories that have one are pulled into those slots
       and the rest fill the rows of four. */
    var ROWS = [4, 2, 4, 2, 4, 2];
    var pool = items.slice(0, ROWS.reduce(function (a, b) { return a + b; }, 0));
    var withText = pool.filter(function (it) { return it.summary; });
    var without = pool.filter(function (it) { return !it.summary; });

    ROWS.forEach(function (n, i) {
      var wide = (n === 2);
      var row = el('div', 'news-row' + (wide ? ' wide' : ''));
      for (var k = 0; k < n; k++) {
        /* Prefer a story with a summary for the wide slots and one without
           for the narrow ones, but never leave a slot empty over it. */
        var first = wide ? withText : without;
        var other = wide ? without : withText;
        var it = first.shift() || other.shift();
        if (!it) break;
        row.appendChild(card(it, wide));
      }
      if (row.childNodes.length) host.appendChild(row);
    });
  }

  function renderNewsTools() {
    var host = $('news-tools'); if (!host) return;
    host.innerHTML = '';
    [['This schedule', true], ['All clubs', false]].forEach(function (opt) {
      var b = el('button', 'chip', opt[0]);
      b.type = 'button';
      b.setAttribute('aria-pressed', (STATE.newsSlateOnly !== false) === opt[1] ? 'true' : 'false');
      b.addEventListener('click', function () {
        STATE.newsSlateOnly = opt[1];
        renderNewsTools();
        renderNews();
      });
      host.appendChild(b);
    });
  }

  /* The file is rewritten every half hour, so it must never come from cache.
     A failure here is contained: the panel says so and nothing else breaks. */
  function loadNews() {
    fetch('data/football-news.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function (j) { NEWS = j; renderNews(); })
      .catch(function () { NEWS = { error: true }; renderNews(); });
  }

  /* ============================================ TOP TEAM STATISTICS ==== */
  /* Leaderboards over the teams this file knows. Most of those numbers are
     still the placeholder baselines the project shipped with, so every row
     says which it is and the default view hides the placeholders entirely.
     A ranking that quietly mixes measured and invented numbers is worse
     than no ranking at all. */
  var TT_CATS = [
    ['xG created',        'xgF',     'desc', 2, 'Chances created per match.'],
    ['xG conceded',   'xgA',     'asc',  2, 'Lower is better: chances handed to the opposition.'],
    ['Goals per match',     'goals',   'desc', 2, 'Real goals, not expected ones.'],
    ['Shots',            'shots',   'desc', 1, 'Total attempts per match.'],
    ['Shots on target',  'sot',     'desc', 1, 'Attempts that were on target.'],
    ['Tackles',            'tackles', 'desc', 1, 'Tackles per match.'],
    ['Fouls',            'fouls',   'asc',  1, 'Fewer is more disciplined.'],
    ['Yellow cards',     'yellow',  'desc', 2, 'Per match. Higher also lifts red-card risk.']
  ];

  /* Judged per FIELD, not per team.

     Two bugs lived in the team-level test this replaces. A team whose
     import brought goals, shots, tackles, fouls and cards but no xG kept
     statsMissing = true - effStats only clears that when BOTH xG columns
     arrive - so it was dropped from every board, including the five boards
     for the figures it actually had. And "real" meant "this team has some
     user data anywhere", so a team with one imported figure showed its
     shipped placeholder for every other board with a real-data badge on it.

     A row belongs on a board when that board's own figure was filled in by
     hand or by import. Nothing else qualifies. */
  function ttRows(field, dir, onlyReal) {
    var rows = [];
    Object.keys(DATA.teams).forEach(function (k) {
      var t = effStats(k);
      if (!t) return;
      var v = t[field];
      if (v == null || !isFinite(v)) return;
      var ov = STATE.overrides[k];
      var real = !!(ov && ov[field] != null);
      if (onlyReal && !real) return;
      rows.push({ key: k, name: t.name || k, v: v, real: real });
    });
    rows.sort(function (a, b) {
      return dir === 'asc' ? a.v - b.v : b.v - a.v;
    });
    return rows;
  }

  function renderTopTeams() {
    var host = $('tt-body'); if (!host) return;
    host.innerHTML = '';

    /* Counted the same way the boards select, so the subtitle cannot claim
       five teams while the boards show four. */
    var TT_FIELDS = TT_CATS.map(function (c) { return c[1]; });
    var realCount = Object.keys(DATA.teams).filter(function (k) {
      var ov = STATE.overrides[k];
      return !!(ov && TT_FIELDS.some(function (f) { return ov[f] != null; }));
    }).length;
    var withAny = Object.keys(DATA.teams).filter(function (k) {
      var t = effStats(k); return t && !t.statsMissing;
    }).length;

    if (STATE.ttOnlyReal == null) STATE.ttOnlyReal = true;
    var onlyReal = STATE.ttOnlyReal;

    var sub = $('tt-sub');
    if (sub) {
      sub.textContent = onlyReal
        ? realCount + ' teams with your data'
        : withAny + ' teams, mostly placeholder numbers';
    }

    if (onlyReal && realCount < 3) {
      var empty = el('div', 'notice');
      empty.innerHTML = '<h3>Only ' + realCount + ' teams have real data</h3>' +
        '<p>A ranking only means something once several teams are filled in. Use <strong>Statistics ' +
        'Input</strong> below, or press &ldquo;Include placeholders&rdquo; to ' +
        'see the shape of the table &mdash; but those placeholders are <strong>not measurements</strong>, ' +
        'so do not choose bets with them.</p>';
      host.appendChild(empty);
      if (realCount === 0) return;
    }

    var grid = el('div', 'tt-grid');
    TT_CATS.forEach(function (c) {
      var rows = ttRows(c[1], c[2], onlyReal).slice(0, 5);
      if (!rows.length) return;
      var card = el('div', 'tt-card');
      var h = el('h4', null, c[0]);
      h.title = c[4];
      card.appendChild(h);
      rows.forEach(function (r, i) {
        var row = el('div', 'tt-row' + (r.real ? '' : ' tt-seed'));
        row.innerHTML = '<span class="tt-rank">' + (i + 1) + '</span>' +
          crestHTML(r.key) +
          '<span class="tt-name">' + r.name + '</span>' +
          '<span class="tt-val">' + r.v.toFixed(c[3]) + '</span>';
        card.appendChild(row);
      });
      grid.appendChild(card);
    });
    host.appendChild(grid);
  }

  function renderTopTeamTools() {
    var host = $('tt-tools'); if (!host) return;
    host.innerHTML = '';
    [['Real data only', true], ['Include placeholders', false]].forEach(function (opt) {
      var b = el('button', 'chip', opt[0]);
      b.type = 'button';
      b.setAttribute('aria-pressed', (STATE.ttOnlyReal !== false) === opt[1] ? 'true' : 'false');
      b.addEventListener('click', function () {
        STATE.ttOnlyReal = opt[1];
        renderTopTeamTools();
        renderTopTeams();
      });
      host.appendChild(b);
    });
  }

  /* ==================================================== MATCH CENTRE ==== */
  function currentFixture() {
    var fxs = slateFixtures(STATE.slate);
    var f = fxs.filter(function (x) { return x.id === STATE.fixtureId; })[0];
    return f || fxs[0] || null;
  }

  function renderMatchCentre() {
    var fx = currentFixture();
    if (!fx) return;
    STATE.fixtureId = fx.id;
    var a;
    try { a = analyse(fx); }
    catch (err) {
      $('mc-head').textContent = 'Could not analyse this fixture: ' + err.message; return;
    }
    var lg = a.league;
    $('mc-sub').textContent = (lg ? lg.name : '') + ' · ' + (fx.kickoff || '');

    /* --- header ------------------------------------------------------- */
    var head = $('mc-head'); head.innerHTML = '';
    var hh = el('div', 'mc-team');
    var sw1 = el('span', 'mc-swatch'); sw1.style.background = 'var(--series-home)';
    hh.appendChild(sw1); hh.appendChild(el('span', null, a.home.name));
    var lam = el('div', 'mc-lam');
    lam.innerHTML = '<div class="cap">Expected goals</div><div class="big">' +
      a.lambdas.home.toFixed(2) + ' &ndash; ' + a.lambdas.away.toFixed(2) + '</div>' +
      '<div class="cap">Babak 1: ' + a.lambdas.home1h.toFixed(2) + ' &ndash; ' +
      a.lambdas.away1h.toFixed(2) + '</div>';
    var ha = el('div', 'mc-team away');
    ha.appendChild(el('span', null, a.away.name));
    var sw2 = el('span', 'mc-swatch'); sw2.style.background = 'var(--series-away)';
    ha.appendChild(sw2);
    head.appendChild(hh); head.appendChild(lam); head.appendChild(ha);

    /* --- 1X2 strip ---------------------------------------------------- */
    var wrap = $('mc-prob'); wrap.innerHTML = '';
    var o = a.outright;
    var strip = el('div', 'prob-strip');
    [[o.home, 'var(--series-home)', a.home.name],
     [o.draw, 'var(--text-muted)', 'Draw'],
     [o.away, 'var(--series-away)', a.away.name]].forEach(function (r) {
      var seg = el('div', 'prob-seg');
      seg.style.flex = String(Math.max(r[0], 0.02));
      seg.style.background = r[1];
      seg.textContent = (r[0] * 100).toFixed(0) + '%';
      bindTip(seg, function () {
        return '<div class="t-title">' + r[2] + '</div><div class="t-row">Probabilitas model ' +
               pct(r[0], 1) + '</div><div class="t-row">Odds adil ' + (1 / r[0]).toFixed(2) + '</div>';
      });
      strip.appendChild(seg);
    });
    wrap.appendChild(strip);
    var leg = el('div', 'prob-legend');
    leg.innerHTML =
      '<span><i style="background:var(--series-home)"></i>' + a.home.name + ' ' + pct(o.home, 1) + '</span>' +
      '<span><i style="background:var(--text-muted)"></i>Draw ' + pct(o.draw, 1) + '</span>' +
      '<span><i style="background:var(--series-away)"></i>' + a.away.name + ' ' + pct(o.away, 1) + '</span>' +
      '<span><i style="background:var(--seq-400)"></i>Both teams to score ' + pct(o.btts, 1) + '</span>';
    wrap.appendChild(leg);

    /* --- market anchor readout ---------------------------------------- */
    $('mw-val').textContent = (STATE.marketWeight * 100).toFixed(0) + '% market / ' +
      (100 - STATE.marketWeight * 100).toFixed(0) + '% statistics';
    var note = $('mw-note');
    var mwInput = $('mw');
    var userStats = fixtureHasUserStats(a.fixture);
    mwInput.disabled = !userStats;
    mwInput.style.opacity = userStats ? '1' : '0.4';
    if (!userStats) {
      $('mw-val').textContent = '100% market (locked)';
      var whoMissing = [];
      if (statOrigin(a.fixture.home) !== 'user') whoMissing.push(a.home.name);
      if (statOrigin(a.fixture.away) !== 'user') whoMissing.push(a.away.name);
      note.innerHTML = '<strong>This slider stays dead for this fixture until <em>both</em> teams are filled in.</strong> ' +
        'Not filled in: <span class="fig">' + whoMissing.join(' and ') + '</span>. ' +
        'A team with real xG against a team on placeholders is not a comparison, ' +
        'it is a category error &mdash; so this fixture keeps market probabilities and its EV ' +
        'is only the bookmaker margin. The gate is per fixture, not per schedule: filling one match ' +
        'does not unlock model influence on any other match still running on placeholders.';
    } else if (a.statsMissing) {
      /* Name the missing figures. "No statistics entered" is wrong and
         maddening when nine of them were just entered by hand. */
      var needH = missingForModel(a.fixture.home), needA = missingForModel(a.fixture.away);
      var parts = [];
      if (needH.length) parts.push(esc(team(a.fixture.home).name) + ': ' + needH.join(' + '));
      if (needA.length) parts.push(esc(team(a.fixture.away).name) + ': ' + needA.join(' + '));
      note.innerHTML = '<strong>The model is switched off for this fixture, so every price below is ' +
        'the bookmaker\u2019s and EV is zero.</strong> ' +
        (parts.length
          ? 'Still needed: <span class="fig">' + parts.join('</span>; <span class="fig">') + '</span>. ' +
            'Goals, shots, tackles, fouls and cards all sharpen a rating, but without <strong>both</strong> ' +
            'xG figures there is no rating to sharpen \u2014 the engine has nothing to compare the two sides with.'
          : 'Enter the statistics below to give the model an opinion of its own.');
    } else if (statOrigin(a.fixture.home) !== 'user' && statOrigin(a.fixture.away) !== 'user') {
      note.innerHTML = '<strong style="color:var(--critical)">This fixture still runs on placeholder statistics, ' +
        'not real data.</strong> Every EV below follows from numbers invented ' +
        'so the tool would run. Replace them in the Statistics Input form first.<br />Pure model: <span class="fig">' +
        a.lambdas.rawHome.toFixed(2) + ' &ndash; ' + a.lambdas.rawAway.toFixed(2) +
        '</span>, implied by the price <span class="fig">' +
        (a.lambdas.impliedHome != null ? a.lambdas.impliedHome.toFixed(2) : '--') + ' &ndash; ' +
        (a.lambdas.impliedAway != null ? a.lambdas.impliedAway.toFixed(2) : '--') +
        '</span>, a gap of <span class="fig">' + (a.divergence != null ? pct(a.divergence, 0) : '--') + '</span>.';
    } else {
      note.innerHTML = 'Pure model: <span class="fig">' + a.lambdas.rawHome.toFixed(2) + ' &ndash; ' +
        a.lambdas.rawAway.toFixed(2) + '</span>. Implied by the price: <span class="fig">' +
        (a.lambdas.impliedHome != null ? a.lambdas.impliedHome.toFixed(2) : '--') + ' &ndash; ' +
        (a.lambdas.impliedAway != null ? a.lambdas.impliedAway.toFixed(2) : '--') +
        '</span>. Gap <span class="fig">' + (a.divergence != null ? pct(a.divergence, 0) : '--') +
        '</span>' + (a.divergence > 0.25
          ? ' &mdash; too far. Above 25% it is usually the inputs that are wrong rather than the bookmaker, so no row is promoted to the main pick.'
          : '.');
    }

    renderTilt(a);
    renderCross(a);
    renderStatCompare(a);
    renderHeat(a);
    renderTotals(a);
    renderValueTable(a);
    renderStatForm(a);
  }

  /* ================================================== STAT COMPARISON == */
  var STAT_ROWS = [
    ['xgF',     'Expected goals',   1],
    ['xA',      'Expected assist',  1],
    ['shots',   'Shots',            0],
    ['sot',     'Shots on target',  1],
    ['bigMiss', 'Big chances missed', 1],
    ['xgA',     'xG conceded',   1],
    ['fouls',   'Fouls',      1],
    ['tackles', 'Tackles',            1],
    ['yellow',  'Yellow cards',     1],
    ['red',     'Red cards',        2]
  ];

  function renderStatCompare(a) {
    var box = $('mc-stats'); box.innerHTML = '';
    var H = effStats(a.fixture.home), A = effStats(a.fixture.away);
    if (H.statsMissing || A.statsMissing) {
      var warnBox = el('div', 'notice');
      var nH = missingForModel(a.fixture.home), nA = missingForModel(a.fixture.away);
      var who = [];
      if (nH.length) who.push(esc(H.name) + ' needs ' + nH.join(' + '));
      if (nA.length) who.push(esc(A.name) + ' needs ' + nA.join(' + '));
      warnBox.innerHTML = '<h3>' + (who.length ? 'Two figures short of a model' : 'No statistics for this fixture yet') + '</h3>' +
        '<p>' + (who.length ? '<strong>' + who.join('. ') + '.</strong> ' : '') +
        'Until <strong>xG created and xG conceded</strong> are in for both sides, this fixture is priced ' +
        'by the bookmaker alone and the value table only mirrors it.</p>' +
        '<p class="stat-note">WhoScored\u2019s Summary, Defensive and Offensive tables do not carry xG conceded. ' +
        'Its <strong>xG</strong> tab has xG created; FBref carries both, on its squad table and the matching ' +
        '&ldquo;vs&rdquo; opponent table. Either can also be typed straight into the two boxes below.</p>';
      box.appendChild(warnBox);
      $('mc-stats-table').innerHTML = '';
      return;
    }
    STAT_ROWS.forEach(function (r) {
      var k = r[0], hv = +H[k] || 0, av = +A[k] || 0;
      var max = Math.max(hv, av, 0.0001);
      var row = el('div', 'statbar');
      var lt = el('div', 'statbar-track left');
      var lf = el('div', 'statbar-fill');
      lf.style.width = (hv / max * 100) + '%';
      lf.style.background = 'var(--series-home)';
      lt.appendChild(el('div', 'statbar-val', hv.toFixed(r[2])));
      lt.appendChild(lf);
      row.appendChild(lt);
      row.appendChild(el('div', 'statbar-name', r[1]));
      var rt = el('div', 'statbar-track');
      var rf = el('div', 'statbar-fill');
      rf.style.width = (av / max * 100) + '%';
      rf.style.background = 'var(--series-away)';
      rt.appendChild(rf);
      rt.appendChild(el('div', 'statbar-val', av.toFixed(r[2])));
      row.appendChild(rt);
      bindTip(row, function () {
        return '<div class="t-title">' + r[1] + '</div>' +
          '<div class="t-row">' + a.home.name + ': ' + hv.toFixed(r[2]) + '</div>' +
          '<div class="t-row">' + a.away.name + ': ' + av.toFixed(r[2]) + '</div>';
      });
      box.appendChild(row);
    });

    // derived fusion figures - the part that actually moves the model
    var ph = a.profiles.home, pa = a.profiles.away;
    var t = el('div', 'table-scroll'); t.style.marginTop = '12px';
    var rows = [
      ['xG per shot', ph.xgPerShot.toFixed(3), pa.xgPerShot.toFixed(3),
        'Chance quality. The league runs around 0.105.'],
      ['Shots-on-target rate', pct(ph.sotRate, 1), pct(pa.sotRate, 1), 'Around 33% is normal.'],
      ['Finishing correction', ph.finAdj.toFixed(3), pa.finAdj.toFixed(3),
        'Goals over xG, regressed hard toward 1 (38-match prior) and penalised for big chances missed.'],
      ['Repeatability (from xA)', ph.repeatability.toFixed(3), pa.repeatability.toFixed(3),
        'xA close to xG means chances come from open-play structure, which repeats.'],
      ['Defensive intensity', ph.defIntensity.toFixed(3), pa.defIntensity.toFixed(3),
        'Tackles suppress the opponent’s xG, fouls add set-piece danger. Capped at +/-12%.'],
      ['Red-card risk', pct(ph.pRed, 1), pct(pa.pRed, 1),
        'From fouls, yellows and red-card history. A red shifts expected goals for both sides.'],
      ['Rating weight (sample)', ph.ratingWeight.toFixed(2), pa.ratingWeight.toFixed(2),
        '0 = follow the league average, 1 = trust the team xG fully. Rises with the match count.']
    ];
    var html = '<table class="mb"><thead><tr><th>Turunan model</th><th style="text-align:right">' +
      a.home.name + '</th><th style="text-align:right">' + a.away.name + '</th><th>Arti</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td>' + r[0] + '</td><td class="num">' + r[1] + '</td><td class="num">' +
        r[2] + '</td><td style="color:var(--text-secondary);font-size:12px">' + r[3] + '</td></tr>';
    });
    html += '</tbody></table>';
    t.innerHTML = html;
    $('mc-stats-table').innerHTML = '';
    $('mc-stats-table').appendChild(t);
  }



  /* --------------------------------------------- the user's own read ---- */
  function saveOverrides() {
    try { localStorage.setItem('mb-overrides', JSON.stringify(STATE.overrides)); } catch (err) {}
  }

  function saveTilt() {
    try { localStorage.setItem('mb-tilt', JSON.stringify(STATE.tilt)); } catch (err) {}
  }

  function renderTilt(a) {
    var slider = $('tilt'), out = $('tilt-val'), note = $('tilt-note');
    if (!slider) return;
    var t = STATE.tilt[a.fixture.id] || 0;
    slider.value = String(Math.round(t * 100));

    var side = t > 0 ? a.home.name : a.away.name;
    /* textContent, not innerHTML - so an HTML entity here would be drawn
       literally, as "neutral &mdash; follow the bookmaker" was. */
    out.textContent = t === 0
      ? 'neutral \u2014 follow the bookmaker'
      : (t > 0 ? '+' : '') + (t * 100).toFixed(0) + '%  leaning to ' + side;

    /* market view versus the view after the adjustment, side by side */
    var base = E.analyseFixture(a.fixture, teamsView(), DATA.leagues,
      { marketWeight: slateHasUserStats() ? STATE.marketWeight : 1, calibration: CALIB, tilt: 0 });
    var b = base.outright, o = a.outright;

    var html = '<strong>This is where your football knowledge goes in.</strong> The model knows nothing about ' +
      'a new manager, a squad full of stars, or a side with its pride wounded. ' +
      'Move the slider if you rate one team above what the bookmaker prices, ' +
      'and the whole page &mdash; every market, every EV, down to the parlay builder &mdash; moves with it.';
    if (t !== 0) {
      html += '<br /><span class="fig">Market:</span> ' + a.home.name + ' ' + pct(b.home, 0) +
        ' / draw ' + pct(b.draw, 0) + ' / ' + a.away.name + ' ' + pct(b.away, 0) +
        ' &nbsp;&rarr;&nbsp; <span class="fig">After your judgement:</span> ' +
        a.home.name + ' ' + pct(o.home, 0) + ' / draw ' + pct(o.draw, 0) + ' / ' +
        a.away.name + ' ' + pct(o.away, 0) +
        '<br />Expected goals ' + base.lambdas.home.toFixed(2) + '\u2013' + base.lambdas.away.toFixed(2) +
        ' &rarr; <span class="fig">' + a.lambdas.home.toFixed(2) + '\u2013' + a.lambdas.away.toFixed(2) +
        '</span>. The table below now sorts by EV, because you have given the model ' +
        'information the price does not contain.';
    } else {
      html += '<br />While it sits at zero, the EV below is only the bookmaker margin and the table sorts by full-payout.';
    }
    note.innerHTML = html;
  }


  /* ------------------------------------------------------ API source ----
     This page is served from GitHub Pages, so anything committed to the
     repository is public. An API token therefore never goes in the source:
     it is typed here and kept in the browser's own storage, on this machine
     only. The fetch runs in the browser too, which is the only way it can
     run at all - whoever built this cannot reach the network.

     The endpoint is editable rather than hard-coded because provider URLs
     differ and change. Paste the example request from the provider's own
     console, put {TOKEN} where the key goes, and the page substitutes it.
     ----------------------------------------------------------------- */

  /* Free API plans are usually metered per hour, and a slate of eighteen
     fixtures is thirty-six teams - up to seventy-two calls once id lookups
     are counted. Pace the requests, cache every id that resolves, and skip
     teams that already carry entered statistics, so a second run costs
     almost nothing. */


  /* ------------------------------------------------ bulk paste import ---
     The button above calls the provider from this page. Most football APIs
     refuse that: they send no Access-Control-Allow-Origin header, so the
     browser blocks the response before any code sees it and every team comes
     back as a bare "Failed to fetch" - which says nothing about the token,
     the quota or the league.

     The address bar is not subject to that rule. So the reliable route is:
     open one request in a tab, copy the whole response, paste it once here.
     One response can carry many teams, and pastes accumulate, so filling a
     slate is a handful of copies rather than thirty-six.
     -------------------------------------------------------------------- */
  /* A pasted statistics PAGE carries the club's name in its own heading, so
     the box does not need to be told which team it belongs to. Earliest
     mention wins, with the longer name breaking a tie - that keeps "Inter
     Milan" from being read as a page about Milan. */
  function teamKeyFromPageText(text) {
    var head = String(text).slice(0, 6000).toLowerCase();
    var bestKey = null, bestAt = Infinity, bestLen = 0;
    Object.keys(DATA.teams).forEach(function (k) {
      var n = String(team(k).name || '').toLowerCase();
      if (n.length < 4) return;
      var at = head.indexOf(n);
      if (at < 0) return;
      if (at < bestAt || (at === bestAt && n.length > bestLen)) {
        bestKey = k; bestAt = at; bestLen = n.length;
      }
    });
    return bestKey;
  }

  /* One box, two kinds of paste. An API response is JSON and can carry many
     teams; a statistics page is not JSON and carries exactly one. Deciding
     here rather than asking the user which box to use removes the step that
     went wrong most often. */
  function applyPastedPage(text, out) {
    var key = teamKeyFromPageText(text);
    if (!key) {
      out.innerHTML = '<div class="notice bad"><h3>No team could be read from this page</h3>' +
        '<p>What you pasted is not JSON, so it was read as a statistics page &mdash; ' +
        'but it holds no team name this site recognises. Make sure the whole page was copied ' +
        '(Ctrl+A then Ctrl+C), including the heading at the top.</p></div>';
      return;
    }
    var known = (STATE.overrides[key] && STATE.overrides[key].matches) ||
                (DATA.teams[key] && DATA.teams[key].matches);
    var parsed = null;
    try { parsed = E.parseTeamStats(text, { matchesFallback: known }); } catch (e) {}
    if (!parsed || parsed.error || !parsed.matches) {
      out.innerHTML = '<div class="notice bad"><h3>Halaman ' + team(key).name +
        ' was read, but its match count was not</h3><p>' +
        ((parsed && parsed.error) || 'Match count not found.') + '</p>' +
        (parsed && parsed.sample
          ? '<p class="stat-note">What was actually read from that paste: <code>' +
            parsed.sample.replace(/</g, '&lt;') + '</code></p>'
          : '') + '</div>';
      return;
    }
    STATE.overrides[key] = STATE.overrides[key] || {};
    ['matches','goals','xgF','xgA','xA','shots','sot','bigMiss','fouls','tackles','yellow','red']
      .forEach(function (f) { if (parsed[f] != null) STATE.overrides[key][f] = parsed[f]; });
    saveOverrides();

    var miss = parsed._missing || [];
    var html = '<div class="notice ok"><h3>' + team(key).name + ' filled from a statistics page</h3>' +
      '<p>' + parsed.matches + ' matches' +
      (parsed._matchesFromCaller ? ' (that figure came from the box, not the page)' : '') + '. xG ' + (parsed.xgF != null ? parsed.xgF : '?') +
      ', xGA ' + (parsed.xgA != null ? parsed.xgA : '?') + ' per match.' +
      (miss.length ? ' Not on that page: ' + miss.join(', ') + '.' : ' Every field filled.') +
      '</p>' +
      (parsed.matches < 4
        ? '<p class="stat-note" style="color:var(--warning)">Only ' + parsed.matches +
          ' matches &mdash; too few to stand alone. The model will keep ' +
          'leaning on the market price until that count grows.</p>'
        : '') +
      '</div>';
    renderAll();
    var fresh = $('api-bulk-out');
    if (fresh) fresh.innerHTML = html; else out.innerHTML = html;
  }

  /* A league table has one row per club, so one paste fills every team in
     it. Which shape a paste is gets decided by the row labels themselves:
     "Premier League" matches no club, "Aston Villa" does. */
  function applyManyTeamsTable(many, out) {
    /* Same ambiguity as the single-team box, one league wide: a league xG
       table reads identically whether For or Against was selected, and
       filling xG created from an Against table would write every
       opponent's attack into every club at once. */
    if (many.teams.length && many.teams.every(function (t) { return looksLikeXgTab(t.stats); })) {
      out.innerHTML = '<div class="notice"><h3>This is the league xG tab \u2014 which view?</h3>' +
        '<p>' + many.teams.length + ' clubs, and nothing in the paste says whether <em>For</em> ' +
        'or <em>Against</em> was selected \u2014 the two tables are identical. Reading one as the ' +
        'other would write every opponent\u2019s attack into every club here.</p>' +
        '<p><strong>For (xG created)</strong>: press <em>Fill from this paste</em> again after ' +
        'switching the toggle, or paste the Summary tab instead.<br />' +
        '<strong>Against (xG conceded)</strong>: press ' +
        '<em>Add xG Against to every club</em> \u2014 the button beside this one.</p></div>';
      return;
    }

    var known = [], refreshed = [];
    many.teams.forEach(function (t) {
      if (!DATA.teams[t.key]) return;
      var had = statOrigin(t.key) === 'user';
      /* Same rule as a single-team import: one source, one sample, one
         snapshot. A league table is a complete measurement of its own. */
      var snap = snapshotFrom(STATE.overrides[t.key], t.stats, t.stats.matches);
      delete snap._dropped; delete snap._kept;
      STATE.overrides[t.key] = snap;
      known.push(t);
      if (had) refreshed.push(team(t.key).name);
    });
    if (known.length) saveOverrides();

    var slate = slateFixtures(STATE.slate);
    var ready = slate.filter(function (f) {
      return statOrigin(f.home) === 'user' && statOrigin(f.away) === 'user';
    });
    var slateKeys = {};
    slate.forEach(function (f) { slateKeys[f.home] = 1; slateKeys[f.away] = 1; });
    var stillMissing = Object.keys(slateKeys).filter(function (k) {
      return statOrigin(k) !== 'user';
    });

    var html = '<div class="notice ' + (known.length ? 'ok' : '') + '">' +
      '<h3>' + known.length + ' teams filled from one table</h3>' +
      '<p>' + ready.length + ' of ' + slate.length + ' fixtures on this schedule are now priced ' +
      'by the model rather than by the bookmaker.' +
      (stillMissing.length
        ? ' Still empty: <strong>' + stillMissing.map(function (k) { return team(k).name; }).join(', ') +
          '</strong> &mdash; paste that league\u2019s table too.'
        : ' Every team on this schedule is filled.') + '</p>' +
      (refreshed.length
        ? '<p class="stat-note"><strong>Replaced</strong> figures you already had for: ' +
          refreshed.join(', ') + '. A league table is the newer measurement, so it wins.</p>'
        : '') +
      (function () {
        var off = known.filter(function (t) {
          return MODEL_REQUIRED.some(function (r) { return t.stats[r[0]] == null; });
        });
        if (!off.length) return '';
        var need = MODEL_REQUIRED.filter(function (r) {
          return off[0].stats[r[0]] == null;
        }).map(function (r) { return r[1]; });
        return '<p class="stat-note" style="color:var(--warning)"><strong>The model stays switched off for ' +
          off.length + ' of these teams: no ' + need.join(' and ') + ' in this table.</strong> ' +
          'Their fixtures keep the bookmaker\u2019s price until both xG figures are in.</p>';
      })() +
      (many.unmatched.length
        ? '<p class="stat-note">Rows that matched no team on this site: ' +
          many.unmatched.slice(0, 12).map(esc).join(', ') +
          (many.unmatched.length > 12 ? ', \u2026' : '') + '.</p>'
        : '') +
      '</div>';

    if (known.length) {
      html += '<div style="max-height:240px;overflow:auto;font-family:var(--mono);font-size:11px;' +
        'background:var(--surface-3);padding:9px;border-radius:4px;margin-top:8px">' +
        known.map(function (t) {
          var st = t.stats;
          return esc(team(t.key).name) + ' &nbsp; ' + st.matches + ' matches, goals ' +
            (st.goals != null ? st.goals : '?') + ', xG ' + (st.xgF != null ? st.xgF : '?') +
            ', xGA ' + (st.xgA != null ? st.xgA : '?') +
            (st._missing.length
              ? ' &nbsp; <span style="color:var(--warning)">not in the table: ' +
                st._missing.join(', ') + '</span>'
              : '');
        }).join('<br>') + '</div>';
    }

    /* renderAll rebuilds this panel - and every leaderboard with it, which
       is the point: nothing else has to be pressed. */
    renderAll();
    var fresh = $('api-bulk-out');
    if (fresh) fresh.innerHTML = html; else out.innerHTML = html;
  }

  /* Add xG conceded to every club already filled, from one paste of
     WhoScored's league Team Statistics -> xG tab with Against selected.

     This ADDS a column; it never replaces a snapshot. The clubs in that
     table were filled from three or four other tabs one at a time, and
     wiping that to store one number would be the opposite of what this is
     for. Where the match counts disagree the figure is still stored, and
     the team is named, because two samples in one team is something to
     see rather than something to silently allow. */
  /* The xG tab carries xG and shots and nothing else this model reads -
     no goals conceded, no cards, no tackles, no fouls. A paste holding
     those is a Summary or Defensive table and needs no question asked. */
  function looksLikeXgTab(parsed) {
    if (!parsed || !parsed._fromTable || parsed.xgF == null) return false;
    return parsed.fouls == null && parsed.tackles == null &&
           parsed.yellow == null && parsed.red == null && parsed.sot == null;
  }

  /* Ask once, in the place the answer is needed, with the consequence of
     each choice written on the button. */
  function askWhichXgView(key, parsed, msg) {
    var box = el('span');
    box.innerHTML = '<strong>This is WhoScored\u2019s xG tab \u2014 which view?</strong> ' +
      'Both read the same (' + parsed.matches + ' matches, xG ' + parsed.xgF + ' per match), ' +
      'so nothing in the paste says whether <em>For</em> or <em>Against</em> was selected. ' +
      'Pick the one that was on screen:<br />';

    [['For \u2014 xG created', 'xgF'], ['Against \u2014 xG conceded', 'xgA']].forEach(function (opt) {
      var b = el('button', 'btn sm' + (opt[1] === 'xgA' ? ' ghost' : ''), opt[0]);
      b.type = 'button';
      b.style.marginRight = '6px';
      b.addEventListener('click', function () {
        var ov = STATE.overrides[key] = STATE.overrides[key] || {};
        ov._m = ov._m || {};
        var otherM = ov.matches;
        ov[opt[1]] = parsed.xgF;
        ov._m[opt[1]] = parsed.matches;
        if (ov.matches == null) { ov.matches = parsed.matches; ov._m.matches = parsed.matches; }
        saveOverrides();
        delete STATE.paste[key];
        STATE.importMsg[key] = {
          color: 'var(--good)',
          html: '<strong>' + (opt[1] === 'xgA' ? 'xG conceded' : 'xG created') + ' set to ' +
            parsed.xgF + '</strong> per match, from ' + parsed.matches + ' matches. ' +
            'Nothing else on this team was touched.' +
            (otherM != null && otherM !== parsed.matches
              ? '<br /><strong style="color:var(--warning)">The rest of this team was measured ' +
                'over ' + otherM + ' matches, not ' + parsed.matches + '.</strong> Two samples in ' +
                'one team: use the same competition filter on both tabs.'
              : '')
        };
        renderAll();
      });
      box.appendChild(b);
    });

    msg.style.color = 'var(--warning)';
    msg.innerHTML = '';
    msg.appendChild(box);
  }

  function applyBulkAgainst(text, out) {
    var many = null;
    try {
      many = E.parseTeamsTable(text, Object.keys(DATA.teams).map(function (k) {
        return { key: k, name: team(k).name };
      }));
    } catch (err) { many = null; }

    if (!many || !many.teams.length) {
      out.innerHTML = '<div class="notice bad"><h3>No xG table found in that paste</h3>' +
        '<p>This box wants WhoScored\u2019s league <strong>Team Statistics</strong>, the ' +
        '<strong>xG</strong> tab, with <strong>Against</strong> selected \u2014 one row per club, ' +
        'columns reading Team, Apps, xG, Goals*, xGDiff, Shots.</p></div>';
      return;
    }

    var set = [], mismatched = [], untouched = [];
    many.teams.forEach(function (t) {
      if (!DATA.teams[t.key]) return;
      var xgA = t.stats.xgF;                 // "xG" in the Against view IS conceded
      if (xgA == null) { untouched.push(team(t.key).name); return; }
      var ov = STATE.overrides[t.key] = STATE.overrides[t.key] || {};
      ov._m = ov._m || {};
      if (ov.matches != null && t.stats.matches != null && ov.matches !== t.stats.matches) {
        mismatched.push(team(t.key).name + ' (' + ov.matches + ' vs ' + t.stats.matches + ')');
      }
      ov.xgA = xgA;
      ov._m.xgA = t.stats.matches;
      if (ov.matches == null) { ov.matches = t.stats.matches; ov._m.matches = t.stats.matches; }
      set.push(team(t.key).name);
    });
    if (set.length) saveOverrides();

    var html = '<div class="notice ' + (set.length ? 'ok' : '') + '">' +
      '<h3>xG conceded added to ' + set.length + ' clubs</h3>' +
      '<p>Nothing else was touched \u2014 everything those clubs already held is still there. ' +
      'Their defences are now measured rather than assumed at league average.</p>' +
      (mismatched.length
        ? '<p class="stat-note" style="color:var(--warning)"><strong>Different match counts</strong> ' +
          'between what these clubs already held and this table: ' + esc(mismatched.join(', ')) +
          '. The figure was still stored; re-import their other tabs with the same competition ' +
          'filter if you want one sample throughout.</p>'
        : '') +
      (many.unmatched.length
        ? '<p class="stat-note">Rows matching no team here: ' +
          many.unmatched.slice(0, 12).map(esc).join(', ') +
          (many.unmatched.length > 12 ? ', \u2026' : '') + '.</p>'
        : '') +
      '</div>';

    renderAll();
    var fresh = $('api-bulk-out');
    if (fresh) fresh.innerHTML = html; else out.innerHTML = html;
  }

  function applyBulkPaste(text, out) {
    var trimmed = String(text).trim();
    var looksJson = trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[';
    if (!looksJson) {
      var many = null;
      try {
        many = E.parseTeamsTable(trimmed, Object.keys(DATA.teams).map(function (k) {
          return { key: k, name: team(k).name };
        }));
      } catch (err) { many = null; }
      if (many && many.teams.length) { applyManyTeamsTable(many, out); return; }
      applyPastedPage(trimmed, out);
      return;
    }

    var parsed;
    try { parsed = E.parseManyTeams(trimmed); } catch (e) { parsed = null; }
    if (!parsed) { applyPastedPage(trimmed, out); return; }
    if (parsed.error) {
      out.innerHTML = '<div class="notice bad"><h3>The JSON parsed, but carries no statistics</h3>' +
        '<p>' + parsed.error + ' Most often because <code>include=statistics.details.type</code> ' +
        'is missing from the URL, or that league sits outside your plan so only team names came back.</p></div>';
      return;
    }

    /* Match against every team the site knows, not just this slate: one
       response often carries teams from several of them. */
    var keys = Object.keys(DATA.teams);
    var filled = [], skipped = [], missed = [];
    keys.forEach(function (key) {
      if (statOrigin(key) === 'user') { skipped.push(team(key).name); return; }
      var hit = E.matchTeamName(team(key).name, parsed.teams);
      if (!hit) { missed.push(key); return; }
      STATE.overrides[key] = STATE.overrides[key] || {};
      ['matches','goals','xgF','xgA','xA','shots','sot','bigMiss','fouls','tackles','yellow','red']
        .forEach(function (f) { if (hit.stats[f] != null) STATE.overrides[key][f] = hit.stats[f]; });
      /* A crest that came with the operator's own response beats anything
         guessed from a domain, so keep it. */
      if (hit.logo) STATE.overrides[key].logo = hit.logo;
      filled.push({ key: key, name: team(key).name, api: hit.name, stats: hit.stats, missing: hit.missing });
    });
    if (filled.length) saveOverrides();

    /* Which fixtures in the current slate now have BOTH sides filled - that
       is the only thing that switches a fixture off market-only pricing. */
    var ready = slateFixtures(STATE.slate).filter(function (f) {
      return statOrigin(f.home) === 'user' && statOrigin(f.away) === 'user';
    });
    var slateKeys = {};
    slateFixtures(STATE.slate).forEach(function (f) { slateKeys[f.home] = 1; slateKeys[f.away] = 1; });
    var stillMissing = Object.keys(slateKeys).filter(function (k) { return statOrigin(k) !== 'user'; });

    var html = '<div class="notice ' + (filled.length ? 'ok' : '') + '">' +
      '<h3>' + parsed.teams.length + ' teams in the paste, ' + filled.length + ' used</h3>' +
      '<p>' + ready.length + ' of ' + slateFixtures(STATE.slate).length +
      ' fixtures on this schedule are now priced by the model rather than by the bookmaker.' +
      (stillMissing.length
        ? ' Still empty: <strong>' + stillMissing.map(function (k) { return team(k).name; }).join(', ') +
          '</strong> &mdash; paste another response to fill them.'
        : ' Every team on this schedule is filled.') +
      '</p>' +
      (skipped.length ? '<p class="stat-note">Not overwritten because you entered them yourself: ' +
        skipped.join(', ') + '.</p>' : '') +
      '</div>';

    if (filled.length) {
      html += '<div style="max-height:240px;overflow:auto;font-family:var(--mono);font-size:11px;' +
        'background:var(--surface-3);padding:9px;border-radius:4px;margin-top:8px">' +
        filled.map(function (r) {
          return r.name + ' &larr; ' + r.api + ' &nbsp; ' + r.stats.matches + ' matches, xG ' +
            (r.stats.xgF != null ? r.stats.xgF : '?') + ', xGA ' +
            (r.stats.xgA != null ? r.stats.xgA : '?') +
            (r.missing && r.missing.length ? ' &nbsp; <span style="color:var(--warning)">missing: ' +
              r.missing.join(', ') + '</span>' : '');
        }).join('<br>') + '</div>';
    } else {
      html += '<div class="notice"><h3>No names matched</h3>' +
        '<p>Team names in the response: ' + parsed.teams.slice(0, 25).map(function (t) {
          return t.name;
        }).join(', ') + (parsed.teams.length > 25 ? ', …' : '') + '. ' +
        'None matched a team on the schedule. If you think one should have, ' +
        'send that list to Claude so the name matching can be fixed.</p></div>';
    }

    /* renderAll rebuilds this panel, so render first and re-attach after. */
    renderAll();
    var fresh = $('api-bulk-out');
    if (fresh) fresh.innerHTML = html;
    else out.innerHTML = html;
  }

  /* The statistics box, with the API panel it used to live in taken out.
     No token, no endpoint, no fetch: a browser cannot call these providers
     directly anyway (no Access-Control-Allow-Origin), and the free plan did
     not carry these leagues. What is left is the part that always worked -
     paste a page or a response, and let it fill whatever it recognises. */
  function renderBulkPaste(host) {
    var wrap = el('div', 'notice');
    wrap.style.marginTop = '4px';
    wrap.innerHTML = '<h3>Fill many teams at once</h3>' +
      '<p><strong>Updating clubs you have already filled:</strong> paste WhoScored\u2019s league ' +
      'Team Statistics &rarr; <strong>xG</strong> tab with <strong>Against</strong> selected and press ' +
      '<em>Add xG Against to every club</em>. That adds xG conceded to all of them and touches ' +
      'nothing else &mdash; Chelsea, Brentford, Aston Villa, Man Utd and the rest keep everything ' +
      'you copied into them.</p>' +
      '<p><strong>A whole league table fills every club in it at once</strong> &mdash; copy the ' +
      'squad table from FBref, WhoScored or Understat (Ctrl+A, Ctrl+C) and paste it here. ' +
      'Rows are matched to teams by name, and a league table replaces what it covers, ' +
      'because it is the newer measurement. A single team\u2019s page or a JSON response ' +
      'works here too; JSON does not overwrite teams you filled in by hand.</p>';
    host.appendChild(wrap);

    var ta = el('textarea');
    ta.id = 'api-bulk-text';
    ta.rows = 4;
    ta.placeholder = 'Paste a league table (one row per club), one team\u2019s statistics page, ' +
      'or a JSON response \u2014 all three are accepted. Press the button below.';
    ta.style.cssText = 'width:100%;margin-top:8px;padding:8px;border:1px solid var(--border-strong);' +
      'border-radius:4px;background:var(--surface-1);color:var(--text-primary);' +
      'font-family:var(--mono);font-size:11px;min-width:0';
    host.appendChild(ta);

    var applyRow = el('div', 'btn-row');
    var applyBtn = el('button', 'btn', 'Fill from this paste');
    applyBtn.type = 'button';
    applyBtn.addEventListener('click', function () {
      var out = $('api-bulk-out');
      var text = (ta.value || '').trim();
      if (!text) {
        out.innerHTML = '<p class="stat-note" style="color:var(--critical)">The box is still empty.</p>';
        return;
      }
      applyBulkPaste(text, out);
    });
    applyRow.appendChild(applyBtn);

    var againstBtn = el('button', 'btn ghost', 'Add xG Against to every club');
    againstBtn.type = 'button';
    againstBtn.title = 'League Team Statistics \u2192 xG tab \u2192 Against: stores xG conceded ' +
      'for every club in the table and changes nothing else';
    againstBtn.addEventListener('click', function () {
      var out2 = $('api-bulk-out');
      var text2 = (ta.value || '').trim();
      if (!text2) {
        out2.innerHTML = '<p class="stat-note" style="color:var(--critical)">The box is still empty.</p>';
        return;
      }
      applyBulkAgainst(text2, out2);
    });
    applyRow.appendChild(againstBtn);
    host.appendChild(applyRow);

    var bulkOut = el('div');
    bulkOut.id = 'api-bulk-out';
    bulkOut.style.marginTop = '10px';
    host.appendChild(bulkOut);
  }





  /* ------------------------------------------------- BT cross-check ----- */
  function renderCross(a) {
    var host = $('mc-cross');
    if (!host) return;
    host.innerHTML = '';
    var c = a.cross;
    if (!c) {
      var p0 = el('p', 'stat-note');
      p0.innerHTML = 'The Bradley-Terry cross-check needs real xG on <strong>both</strong> teams. ' +
        'Not available for this fixture yet.';
      host.appendChild(p0);
      return;
    }
    var rows = [
      ['Dixon-Coles (main model)', c.dc, 'From the scoreline matrix: it accounts for how many goals, so it can price handicaps and totals.'],
      ['Bradley-Terry (cross-check)', c.bt, 'S_home / (S_home + S_away), the formula from the Smartodds note. It speaks only to who wins.'],
      ['Market, margin removed', c.market, 'De-vigged 1X2 prices, normalised to win/lose outcomes only.']
    ];
    var t = el('table', 'mb');
    var html = '<thead><tr><th>Source</th><th style="text-align:right">P(home wins | someone wins)</th><th>What it means</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td>' + r[0] + '</td><td class="num">' +
        (r[1] != null ? pct(r[1], 1) : '\u2014') +
        '</td><td style="color:var(--text-secondary);font-size:12px">' + r[2] + '</td></tr>';
    });
    html += '</tbody>';
    t.innerHTML = html;
    var sc = el('div', 'table-scroll'); sc.appendChild(t);
    host.appendChild(sc);

    var verdict = el('div', 'notice' + (c.agree === true ? ' ok' : c.agree === false ? ' bad' : ''));
    var head = c.agree === true ? 'Two model families agree against the market'
             : c.agree === false ? 'Dua model saling bertentangan'
             : 'No 1X2 price to compare against';
    var body = c.agree === true
      ? 'Dixon-Coles and Bradley-Terry lean the same way against the market. Two models built on different assumptions agreeing is stronger evidence than one model alone.'
      : c.agree === false
      ? 'The two disagree on direction. When that happens, any edge on show is more likely a model error than a bookmaker error. Confidence is cut.'
      : 'This fixture has no complete 1X2 price on the board, so there is no market benchmark to compare against.';
    verdict.innerHTML = '<h3>' + head + '</h3><p>' + body + '</p>' +
      '<p>Gap between the models: <span class="fig">' + (c.spread * 100).toFixed(1) + ' percentage points</span>. ' +
      'Calibrated strength: ' + a.home.name + ' <span class="fig">' + c.strengthHome.toFixed(1) +
      '</span>, ' + a.away.name + ' <span class="fig">' + c.strengthAway.toFixed(1) + '</span> ' +
      '(raw rating ' + c.ratingHome.toFixed(1) + ' / ' + c.ratingAway.toFixed(1) +
      ', fitted offset ' + c.offset.toFixed(1) + ').</p>';
    if (c.advisoryOnly) {
      verdict.innerHTML += '<p><strong>Shown for information; it does not move confidence.</strong> This offset was ' +
        'fitted from ' + (CALIB ? CALIB.n : 0) + ' fixtures' +
        (CALIB && CALIB.rmse != null ? ' with rmse ' + CALIB.rmse.toFixed(3) : '') +
        '. One offset from a handful of fixtures is not calibration, it is coincidence &mdash; so this cross-check is ' +
        'displayed but not allowed to move the confidence figure. Enter statistics for more fixtures ' +
        'before leaning on it.';
    }
    host.appendChild(verdict);

    var note = el('p', 'stat-note');
    note.innerHTML = '<strong>About the offset:</strong> in a ratio model the zero point of the rating scale ' +
      'sets how wide the spread of probabilities is. The Smartodds note uses ' +
      '<code>S = R &minus; 1350</code> on FIFA points, because without that subtraction ' +
      '<code>1850/(1850+1600) = 0.54</code> &mdash; every match looks level. This tool does not guess ' +
      'that offset: it is fitted by least squares to de-vigged market prices.';
    host.appendChild(note);
  }

  /* ========================================================= HEATMAP ==== */
  function renderHeat(a) {
    var box = $('mc-heat'); box.innerHTML = '';
    var N = 6, cell = 34, pad = 26;
    var M = a.matrixFT;
    var max = 0;
    for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) max = Math.max(max, M[i][j]);
    var ramp = ['--seq-100','--seq-200','--seq-300','--seq-400','--seq-500','--seq-600','--seq-700'];
    var W = pad + N * cell + 6, H = pad + N * cell + 6;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Heat map of final-score probabilities');

    function txt(x, y, s, anchor) {
      var t = document.createElementNS(svg.namespaceURI, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('class', 'ax');
      t.setAttribute('text-anchor', anchor || 'middle'); t.textContent = s;
      return t;
    }
    for (var c = 0; c < N; c++) {
      svg.appendChild(txt(pad + c * cell + cell / 2, 12, String(c)));
      svg.appendChild(txt(pad - 8, pad + c * cell + cell / 2 + 4, String(c), 'end'));
    }
    for (var hg = 0; hg < N; hg++) {
      for (var ag = 0; ag < N; ag++) {
        var p = M[hg][ag];
        var step = Math.min(ramp.length - 1, Math.floor(p / max * ramp.length));
        var rect = document.createElementNS(svg.namespaceURI, 'rect');
        rect.setAttribute('x', pad + ag * cell); rect.setAttribute('y', pad + hg * cell);
        rect.setAttribute('width', cell); rect.setAttribute('height', cell);
        rect.setAttribute('rx', 3);
        rect.setAttribute('fill', 'var(' + ramp[step] + ')');
        rect.setAttribute('class', 'heat-cell');
        (function (hg2, ag2, p2) {
          bindTip(rect, function () {
            return '<div class="t-title">' + hg2 + ' &ndash; ' + ag2 + '</div>' +
              '<div class="t-row">' + pct(p2, 2) + '</div>' +
              '<div class="t-row">1 in ' + Math.round(1 / p2) + ' matches</div>';
          });
        })(hg, ag, p);
        svg.appendChild(rect);
        if (p > max * 0.55) {
          var lbl = txt(pad + ag * cell + cell / 2, pad + hg * cell + cell / 2 + 4,
            (p * 100).toFixed(0));
          lbl.setAttribute('fill', step >= 4 ? '#fff' : 'var(--text-primary)');
          lbl.setAttribute('font-weight', '700');
          svg.appendChild(lbl);
        }
      }
    }
    box.appendChild(svg);
    var cap = el('p', 'stat-note');
    cap.innerHTML = 'Rows = goals for ' + a.home.name + ', columns = goals for ' + a.away.name +
      '. Darker means more frequent. The percentage is printed in the most likely cells.';
    box.appendChild(cap);
  }

  /* ==================================================== TOTAL GOALS ===== */
  function renderTotals(a) {
    var box = $('mc-totals'); box.innerHTML = '';
    var d = a.totals, n = d.length;
    var W = 280, H = 190, padL = 26, padB = 24, padT = 8;
    var max = Math.max.apply(null, d);
    var bw = (W - padL - 6) / n;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Total goals probability');

    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
      var y = padT + (1 - f) * (H - padT - padB);
      var ln = document.createElementNS(svg.namespaceURI, 'line');
      ln.setAttribute('x1', padL); ln.setAttribute('x2', W - 2);
      ln.setAttribute('y1', y); ln.setAttribute('y2', y);
      ln.setAttribute('class', 'grid-line');
      svg.appendChild(ln);
      var t = document.createElementNS(svg.namespaceURI, 'text');
      t.setAttribute('x', padL - 5); t.setAttribute('y', y + 3);
      t.setAttribute('class', 'ax'); t.setAttribute('text-anchor', 'end');
      t.textContent = (f * max * 100).toFixed(0) + '%';
      svg.appendChild(t);
    });

    d.forEach(function (p, i) {
      var h = p / max * (H - padT - padB);
      var x = padL + i * bw + 1, y = H - padB - h;
      var r = document.createElementNS(svg.namespaceURI, 'rect');
      r.setAttribute('x', x); r.setAttribute('y', y);
      r.setAttribute('width', Math.max(1, bw - 3)); r.setAttribute('height', Math.max(1, h));
      r.setAttribute('rx', 4);
      r.setAttribute('fill', 'var(--seq-400)');
      r.style.cursor = 'pointer';
      bindTip(r, function () {
        var cum = 0; for (var k = 0; k <= i; k++) cum += d[k];
        return '<div class="t-title">' + i + ' goals</div>' +
          '<div class="t-row">Tepat: ' + pct(p, 2) + '</div>' +
          '<div class="t-row">' + i + ' goals or fewer: ' + pct(cum, 1) + '</div>' +
          '<div class="t-row">More than ' + i + ': ' + pct(1 - cum, 1) + '</div>';
      });
      svg.appendChild(r);
      var t = document.createElementNS(svg.namespaceURI, 'text');
      t.setAttribute('x', x + (bw - 3) / 2); t.setAttribute('y', H - padB + 12);
      t.setAttribute('class', 'ax'); t.setAttribute('text-anchor', 'middle');
      t.textContent = String(i);
      svg.appendChild(t);
    });
    box.appendChild(svg);
    var exp = d.reduce(function (s, p, i) { return s + p * i; }, 0);
    var cap = el('p', 'stat-note');
    cap.textContent = 'Average total goals under the model: ' + exp.toFixed(2) +
      '. The bottom axis is goals in a single match.';
    box.appendChild(cap);
  }

  /* ===================================================== VALUE TABLE ==== */
  var TIER_LABEL = { prime: 'PRIME', value: 'VALUE', neutral: 'NEUTRAL',
                     avoid: 'HINDARI', suspect: 'CURIGA' };
  var KIND_LABEL = { ah: 'Handicap', ou: 'Over/Under', x12: '1X2', oe: 'Odd/Even' };

  function renderValueTable(a) {
    var box = $('mc-value'); box.innerHTML = '';

    /* When the engine has already refused to promote any leg, the table
       below still lists rows with large positive EV. Left unexplained that
       reads as a page full of opportunities - the opposite of what the
       board just said. Say it once, at the top, before the numbers. */
    if (!a.statsMissing && a.divergence > 0.25) {
      var warn = el('div', 'notice bad');
      warn.style.marginBottom = '10px';
      warn.innerHTML = '<h3>Do not trust the EV numbers below yet</h3>' +
        '<p>Model berbeda <strong>' + pct(a.divergence, 0) + '</strong> from the bookmaker price. ' +
        'At a gap that size what is wrong is almost always the <strong>model inputs</strong>, ' +
        'not the bookmaker price &mdash; the bookmaker sees squads, injuries and team news; this model ' +
        'sees only the numbers you typed in.</p>' +
        '<p>That is why no row is promoted to the main pick, and ' +
        'positive EV here is marked amber, not green. EV +70% does not mean a chance of ' +
        'winning; it means <strong>the data is still too thin</strong>. Raise the match count ' +
        'until the gap falls below 25%, and only then is the number worth reading.</p>';
      box.appendChild(warn);
    }

    var tb = el('table', 'mb');
    tb.innerHTML = '<thead><tr>' +
      '<th style="width:26px"></th><th>Selection</th><th>Market</th><th>Line</th>' +
      '<th style="text-align:right">Odds</th><th style="text-align:right">Odds adil</th>' +
      '<th style="text-align:right" title="Chance of any outcome that is not a loss, including pushes and half-wins">Model prob.</th>' +
      '<th style="text-align:right" title="Chance this leg pays FULL ODDS. Pushes count as nothing, half-wins count as half. THIS is what parlay legs are chosen on.">Full payout</th>' +
      '<th style="text-align:right">Vig</th>' +
      '<th style="text-align:right">EV</th><th>Confidence</th><th>Mix</th>' +
      '<th style="text-align:right">Kelly/4</th><th></th></tr></thead>';
    var body = el('tbody');
    var top = a.best;
    var byEff = a.rankedBy === 'efficiency';

    /* Under a full market anchor every EV is the margin with a minus sign,
       so colouring rows by EV painted the entire board red and highlighted
       nothing - which reads as "everything here is terrible" when it only
       means "you are paying the usual margin". When ranking by efficiency,
       colour by that instead: the circled pick, then the rest neutral,
       with red reserved for legs that really are expensive or leaky. */
    a.picks.forEach(function (p, idx) {
      var cls;
      if (byEff) {
        var leaky = (p.pModel - p.cleanWin) > 0.08;
        var pricey = p.vig != null && p.vig > 0.09;
        cls = (top && p.id === top.id) ? 'tier-prime'
            : (leaky || pricey) ? 'tier-avoid' : 'tier-neutral';
      } else {
        cls = 'tier-' + p.tier;
      }
      var tr = el('tr', cls);
      if (top && p.id === top.id) tr.classList.add('is-top');
      var c0 = el('td');
      if (top && p.id === top.id) {
        var ring = el('span', 'ring'); ring.textContent = '✓';
        ring.title = 'The model best pick for this fixture';
        c0.appendChild(ring);
      }
      tr.appendChild(c0);

      var c1 = el('td');
      c1.innerHTML = '<span class="tier-dot ' + p.tier + '"></span>' + p.label;
      tr.appendChild(c1);
      tr.appendChild(el('td', null, KIND_LABEL[p.kind] + (p.half === '1h' ? ' (BB1)' : '')));

      var c3 = el('td');
      if (p.line != null) {
        var b = el('span', 'badge ' + (p.lineType === 'quarter' ? 'q' : p.lineType === 'half' ? 'h' : 'w'));
        b.textContent = p.lineType === 'quarter' ? 'quarter' : p.lineType === 'half' ? 'half' : 'whole';
        b.title = p.lineType === 'quarter'
          ? 'Quarter line: the stake splits in two. It can half-win or half-lose - this is what cuts parlay payouts.'
          : p.lineType === 'whole' ? 'Whole line: it can push (stake returned).'
          : 'Half line: a full win or a full loss, nothing in between.';
        c3.appendChild(b);
      } else { c3.textContent = '—'; }
      tr.appendChild(c3);

      tr.appendChild(el('td', 'num', fmtOdds(p.odds)));
      tr.appendChild(el('td', 'num', fmtOdds(p.fairOdds)));
      tr.appendChild(el('td', 'num', pct(p.pModel, 1)));

      /* The number that actually decides parlay selection. Showing raw
         probability alone let a whole line read 72% while paying full odds
         only 42% of the time, with the rest sitting in pushes. */
      var cclean = el('td', 'num');
      var gap = p.pModel - p.cleanWin;
      cclean.textContent = pct(p.cleanWin, 1);
      if (gap > 0.03) {
        cclean.style.color = 'var(--critical)';
        cclean.style.fontWeight = '700';
        cclean.title = 'Turun ' + (gap * 100).toFixed(1) + ' points below the raw probability: ' +
          pct(p.pushRisk, 1) + ' ends in a push' +
          (p.halfRisk > 0.001 ? ' and ' + pct(p.halfRisk, 1) + ' a half result' : '') +
          '. In a parlay a pushed leg multiplies the ticket by 1.0, so this leg odds burn away.';
      }
      tr.appendChild(cclean);

      tr.appendChild(el('td', 'num', p.vig != null ? pct(p.vig, 2) : '—'));

      var cev = el('td', 'num ev', signPct(p.ev, 2));
      /* Green says "take this". It must not appear on an EV the engine
         itself refuses to stand behind: when the model sits more than a
         quarter away from the market, or this row was marked implausible,
         the number is a symptom of bad inputs, not an edge. Colouring it by
         size alone contradicted the board above, which had already said no
         leg was worth promoting. */
      var untrusted = (a.divergence > 0.25) || p.implausible || (p.trust != null && p.trust < 0.5);
      if (p.ev > 0.015 && !untrusted) cev.style.color = 'var(--good)';
      else if (p.ev > 0.015 && untrusted) {
        cev.style.color = 'var(--warning)';
        cev.title = 'This EV is large because the model disagrees with the market by ' +
          pct(a.divergence, 0) + '. At a gap that size what is wrong is almost always the ' +
          'model inputs, not the bookmaker price \u2014 so this figure is not an opportunity, ' +
          'it is a sign the data is still too thin.';
      }
      else if (byEff) {
        cev.style.color = 'var(--text-muted)';
        cev.title = 'Without your statistics the model is pinned to this same price, ' +
          'so the EV here is only the bookmaker margin with a minus sign. It is not a verdict ' +
          'that the bet is bad - it is the same cost that applies to every row.';
      }
      tr.appendChild(cev);

      var cconf = el('td');
      var m = el('div', 'meter');
      var track = el('div', 'meter-track');
      var fill = el('div', 'meter-fill');
      fill.style.width = Math.max(2, Math.min(100, p.confidence)) + '%';
      if (p.confidence < 35) fill.style.background = 'var(--text-muted)';
      track.appendChild(fill);
      m.appendChild(track);
      m.appendChild(el('span', 'meter-num', p.confidence.toFixed(0)));
      cconf.appendChild(m);
      tr.appendChild(cconf);

      var cmix = el('td');
      var ok = E.mixParlayEligible(p);
      cmix.innerHTML = ok ? '<span style="color:var(--good);font-weight:700">yes</span>'
                          : '<span style="color:var(--critical)" title="Odds below 1.50 are usually removed from the Mix Parlay menu">removed</span>';
      tr.appendChild(cmix);

      tr.appendChild(el('td', 'num', (p.kelly / 4 > 0 ? pct(p.kelly / 4, 1) : '—')));

      var cadd = el('td');
      if (ok) {
        var btn = el('button', 'btn sm ghost', '+');
        btn.type = 'button';
        btn.title = 'Tambahkan ke parlay';
        btn.addEventListener('click', function () { addLeg(p, a); });
        cadd.appendChild(btn);
      }
      tr.appendChild(cadd);

      body.appendChild(tr);
    });
    tb.appendChild(body);
    box.appendChild(tb);

    var legend = el('div', 'panel-body');
    legend.style.fontSize = '12px';
    legend.style.color = 'var(--text-secondary)';
    if (byEff) {
      legend.innerHTML =
        '<strong>This table sorts by FULL PAYOUT, not by EV.</strong> ' +
        'You have not entered team statistics, so the model is pinned to this same bookmaker price &mdash; ' +
        'which means the EV column here is <em>always</em> negative, by exactly the bookmaker margin. ' +
        'That is not a verdict that every bet is bad; it is the same cost on every row. ' +
        'What can still be compared: how often a leg pays full odds, and how much margin it costs.' +
        '<br /><span class="tier-dot prime"></span><strong>Light blue + circled</strong> = the best leg in this fixture ' +
        'that actually appears in the Mix Parlay menu (odds above 1.50): highest full-payout after margin. ' +
        '&nbsp;&middot;&nbsp; <span class="tier-dot avoid"></span>red = leaks more than 8 points into pushes or half-results, ' +
        'or margin above 9%. &nbsp;&middot;&nbsp; <span class="tier-dot neutral"></span>the rest are equivalent.' +
        '<br /><strong>Enter xG in the form below</strong> and this table switches to sorting by EV, ' +
        'because at that point the model has an opinion of its own to set against the bookmaker.';
    } else legend.innerHTML =
      '<strong>What the colours mean:</strong> ' +
      '<span class="tier-dot prime"></span>light blue = EV above +4% and confidence above 58 (circled = best in this fixture) &nbsp;&middot;&nbsp; ' +
      '<span class="tier-dot value"></span>kuning = EV di atas +1.5% &nbsp;&middot;&nbsp; ' +
      '<span class="tier-dot neutral"></span>netral &nbsp;&middot;&nbsp; ' +
      '<span class="tier-dot suspect"></span>amber = the EV looks good but the model sits too far from the market to be trusted &nbsp;&middot;&nbsp; ' +
      '<span class="tier-dot avoid"></span>merah = EV di bawah -4%.' +
      '<br /><strong>Vig</strong> = the bookmaker margin in that pair of prices; this is a cost you certainly pay, ' +
      'unlike EV, which is only an estimate. <strong>Kelly/4</strong> = a conservative stake size.';
    box.appendChild(legend);
  }

  /* ====================================================== STAT FORM ===== */
  function renderStatForm(a) {
    var box = $('mc-form'); box.innerHTML = '';
    [a.fixture.home, a.fixture.away].forEach(function (key, idx) {
      var t = effStats(key);
      var h = el('h4');
      h.style.cssText = 'font-size:13px;margin:' + (idx ? '18px' : '0') + ' 0 8px;display:flex;align-items:center;gap:7px';
      var sw = el('span', 'mc-swatch');
      sw.style.background = idx ? 'var(--series-away)' : 'var(--series-home)';
      h.appendChild(sw);
      var need = missingForModel(key);
      h.appendChild(el('span', null, t.name +
        (need.length ? '  (model still off \u2014 needs ' + need.join(' + ') + ')'
          : defenceAssumed(key) ? '  (rated \u2014 xG conceded assumed league average)' : '')));
      var note = snapshotNote(key);
      if (note) {
        var age = el('span', 'meta', note);
        age.style.cssText = 'font-weight:400;font-size:11px;color:var(--text-muted)';
        h.appendChild(age);
      }
      box.appendChild(h);

      var grid = el('div', 'form-grid');
      var fields = [
        ['matches', 'Matches played', 1],
        ['xgF', 'xG created', 0.01], ['xgA', 'xG conceded', 0.01],
        ['xA', 'xA (expected assists)', 0.01], ['goals', 'Goals scored', 0.01],
        ['shots', 'Shots', 0.1], ['sot', 'Shots on target', 0.1],
        ['bigMiss', 'Big chances missed', 0.1], ['fouls', 'Fouls', 0.1],
        ['tackles', 'Tackles', 0.1], ['yellow', 'Yellow cards', 0.1],
        ['red', 'Red cards', 0.01]
      ];
      /* Read every box for this team and commit them together. Typing used
         to redraw the whole page on each field, which stole focus mid-entry
         - so a value is now kept as it is typed, and applied on Enter or on
         the button beside the last field. */
      function commit() {
        STATE.overrides[key] = STATE.overrides[key] || {};
        var filled = 0;
        var typedM = parseFloat(($('sf-' + key + '-matches') || {}).value);
        STATE.overrides[key]._m = STATE.overrides[key]._m || {};
        fields.forEach(function (f) {
          var node = $('sf-' + key + '-' + f[0]);
          if (!node) return;
          var v = node.value === '' ? null : parseFloat(node.value);
          STATE.overrides[key][f[0]] = (v != null && isFinite(v)) ? v : null;
          if (STATE.overrides[key][f[0]] != null) {
            filled++;
            /* Typed against the match count in the box beside it, so a
               later import over the same sample can keep it. */
            if (isFinite(typedM)) STATE.overrides[key]._m[f[0]] = typedM;
          } else {
            delete STATE.overrides[key]._m[f[0]];
          }
        });
        saveOverrides();
        var ready = statOrigin(key) === 'user';
        var other = key === a.fixture.home ? a.fixture.away : a.fixture.home;
        var bothReady = ready && statOrigin(other) === 'user';
        STATE.editMsg[key] = {
          color: ready ? 'var(--good)' : 'var(--warning)',
          html: filled + ' values saved for ' + team(key).name + '. ' +
            (bothReady
              ? '<strong>Both teams in this fixture are filled</strong> \u2014 the model prices it now, not the bookmaker.'
              : ready
                ? 'Still needs <strong>' + team(other).name + '</strong> before the model can price this fixture.'
                : 'Not enough yet: xG created and xG conceded must both be filled.')
        };
        renderAll();
      }

      fields.forEach(function (f) {
        var fd = el('div', 'field');
        var id = 'sf-' + key + '-' + f[0];
        var lb = el('label', null, f[1]); lb.setAttribute('for', id);
        var inp = el('input');
        inp.id = id; inp.type = 'number'; inp.step = String(f[2]); inp.min = '0';
        inp.value = t[f[0]] == null ? '' : t[f[0]];
        inp.placeholder = '\u2014';
        /* Keep the value without redrawing, so the next box stays reachable. */
        inp.addEventListener('change', function () {
          STATE.overrides[key] = STATE.overrides[key] || {};
          var v = inp.value === '' ? null : parseFloat(inp.value);
          STATE.overrides[key][f[0]] = (v != null && isFinite(v)) ? v : null;
          saveOverrides();
        });
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
        });
        fd.appendChild(lb); fd.appendChild(inp);
        grid.appendChild(fd);
      });

      /* Sits in the grid beside the last field, so it reads as the end of
         the row rather than as a separate control. */
      var applyCell = el('div', 'field');
      var spacer = el('label', null, '\u00a0');
      var apply = el('button', 'btn sm', 'Apply changes');
      apply.type = 'button';
      apply.style.width = '100%';
      apply.title = 'Apply the numbers you typed (or press Enter in any box)';
      apply.addEventListener('click', commit);
      applyCell.appendChild(spacer); applyCell.appendChild(apply);
      grid.appendChild(applyCell);

      box.appendChild(grid);

      var done = el('div');
      done.id = 'edit-msg-' + key;
      done.style.cssText = 'font-size:12px;margin-top:6px';
      var kept = STATE.editMsg[key];
      if (kept) { done.style.color = kept.color; done.innerHTML = kept.html; }
      box.appendChild(done);
    });
    /* Paste-and-parse, so a page of statistics does not have to be retyped
       field by field. */
    [a.fixture.home, a.fixture.away].forEach(function (key, idx) {
      var wrap = el('div');
      wrap.style.cssText = 'margin-top:' + (idx ? '10px' : '14px') +
        ';padding-top:10px;border-top:1px dashed var(--border)';
      var lb = el('label');
      lb.style.cssText = 'display:block;font-size:10px;font-weight:700;text-transform:uppercase;' +
        'letter-spacing:.05em;color:var(--text-muted);margin-bottom:4px';
      lb.textContent = 'Paste statistics page for ' + team(key).name + ' (UEFA / FBref / Understat)';
      var ta = el('textarea');
      ta.rows = 3;
      ta.placeholder = 'Select the whole statistics page, Ctrl+C, paste it here and press Import.';
      /* Editing any stat field re-renders this whole form. Without keeping
         the pasted text, typing the match count would silently throw away
         the page just pasted - which is the exact order the error message
         above asks for. */
      ta.value = STATE.paste[key] || '';
      ta.addEventListener('input', function () { STATE.paste[key] = ta.value; });
      ta.style.cssText = 'width:100%;padding:7px 9px;border:1px solid var(--border-strong);' +
        'border-radius:4px;background:var(--surface-1);color:var(--text-primary);' +
        'font-family:var(--mono);font-size:12px;resize:vertical';
      var btnRow = el('div', 'btn-row');
      btnRow.style.marginTop = '7px';
      var imp = el('button', 'btn sm', 'Import for ' + team(key).name);
      imp.type = 'button';

      /* The xG tab's "Against" view is the same table with the opponent's
         numbers in it, and a copy of the page carries the words "For" and
         "Against" either way - so nothing in the text says which view it
         is. A second button is the only honest way to ask. */
      var impAgainst = el('button', 'btn sm ghost', 'Import xG Against');
      impAgainst.type = 'button';
      impAgainst.title = 'WhoScored xG tab with the Against toggle on: reads xG conceded only';

      var msg = el('span');
      msg.id = 'imp-msg-' + key;
      msg.style.cssText = 'font-size:12px;color:var(--text-secondary)';
      /* A successful import calls renderAll, which rebuilds this form and
         takes the message with it - so the one case worth reporting was the
         one that never appeared. Keep it in state and redraw it here. */
      var keptMsg = STATE.importMsg[key];
      if (keptMsg) { msg.style.color = keptMsg.color; msg.innerHTML = keptMsg.html; }
      imp.addEventListener('click', function () {
        /* The page's own match count is unreadable on some layouts, so fall
           back to whatever is typed in this team's "matches played" box. */
        var mEl = $('sf-' + key + '-matches');
        var rawPaste = ta.value;
        var parsed;
        try { parsed = E.parseTeamStats(rawPaste, { matchesFallback: mEl && mEl.value }); }
        catch (err) { parsed = { error: err.message }; }
        if (!parsed) { msg.textContent = 'There is no text to read.'; return; }
        if (parsed.error) {
          STATE.importMsg[key] = {
            color: 'var(--critical)',
            html: parsed.error +
              (parsed.sample
                ? '<br><span style="color:var(--text-muted)">What was actually read from that paste: ' +
                  '<code>' + parsed.sample.replace(/</g, '&lt;') + '</code></span>'
                : '')
          };
          msg.style.color = STATE.importMsg[key].color;
          msg.innerHTML = STATE.importMsg[key].html;
          return;
        }

        /* The xG tab's two views are the same table: Apps, xG, Goals*,
           xGDiff, Shots, xG/Shots, Rating, whether For or Against is
           selected, and a copy of the page carries both words because
           they are the toggle's own labels. Nothing in the text says
           which one was on screen.

           Reading it as xG created when it was Against writes the
           opponent's attack into this team - the single worst thing this
           importer could do quietly. So when a paste is that table and
           nothing else, it asks instead of guessing. */
        if (looksLikeXgTab(parsed)) {
          askWhichXgView(key, parsed, msg);
          return;
        }

        /* An import REPLACES this team's figures rather than patching the
           ones it happens to carry.

           Patching is how a season quietly rots. Manchester United was
           filled from UEFA's page after one Champions League match: xG
           1.42, xGA 0.25, over 1 match. Paste WhoScored's ten-match page
           on top of that and goals, shots, tackles and cards all become
           ten-match figures while xG stays the number from a single night
           - and "matches" now reads 10, so that one night's xG is divided
           and compared as though it covered ten. Nothing warns anyone;
           the numbers simply stop meaning what they say.

           One source, one sample, one snapshot. Anything the new source
           does not carry is cleared and named, so an empty box is visible
           where a borrowed number used to hide. */
        var prevSnap = STATE.overrides[key] || {};
        var snap = snapshotFrom(prevSnap, parsed, parsed.matches);
        snap._xgEstimated = !!(parsed._estimated && parsed._estimated.xgF);
        var droppedFields = snap._dropped;
        var keptFields = snap._kept;
        delete snap._dropped; delete snap._kept;
        var shrank = prevSnap.matches != null && parsed.matches < prevSnap.matches
          ? prevSnap.matches : null;
        STATE.overrides[key] = snap;
        saveOverrides();

        /* How many fields this paste actually delivered. A paste that fills
           nothing used to report "Filled from 5 fixtures" in green and list
           what it missed underneath, which reads as success and is not: the
           5 came from the MATCHES PLAYED box, not from the page. Count the
           fields, and let the count decide what the message says. */
        var FIELDS = ['goals','xgF','xgA','xA','shots','sot','fouls','tackles','yellow','red'];
        var filled = FIELDS.filter(function (f) { return parsed[f] != null; });

        var miss = parsed._missing.length
          ? ' Not found: ' + parsed._missing.join(', ') + ' \u2014 fill those in by hand if you have them.'
          : '';

        if (!filled.length) {
          STATE.importMsg[key] = {
            color: 'var(--warning)',
            html: '<strong>Nothing was read from this paste.</strong> ' +
              'No statistic on the page could be matched, so no field changed' +
              (parsed._matchesFromCaller
                ? ' \u2014 the match count shown is the one you typed in the box, not something read from the page'
                : '') + '.<br />' +
              'What was actually read: <code>' +
              esc(String(rawPaste || '').replace(/\s+/g, ' ').trim().slice(0, 240)) + '</code>'
          };
          msg.style.color = STATE.importMsg[key].color;
          msg.innerHTML = STATE.importMsg[key].html;
          renderAll();
          return;
        }
        /* A competition page early in the season can report a single match.
           One match is a coin toss dressed as a statistic, so say so where
           the number lands rather than letting it look like evidence. */
        var thin = parsed.matches < 4
          ? ' <strong>Only ' + parsed.matches + ' matches</strong> \u2014 too few to be ' +
            'trusted alone; the model keeps leaning on the market price.'
          : '';

        /* Green with the model still switched off is the message that cost
           two rounds of "why has nothing changed": seven fields landed and
           the only two that decide anything did not. */
        var stillNeed = MODEL_REQUIRED.filter(function (r) {
          return STATE.overrides[key][r[0]] == null;
        }).map(function (r) { return r[1]; });
        var gate = stillNeed.length
          ? '<br /><strong style="color:var(--warning)">The model is still switched off for this team: ' +
            'no ' + stillNeed.join(' and ') + '.</strong> Paste WhoScored\u2019s <strong>xG</strong> tab, ' +
            'or type the figure into the box above.'
          : (STATE.overrides[key].xgA == null
            ? '<br /><strong>The model is now on for this team.</strong> xG conceded is standing at the ' +
              'league average, which is an assumption, not a measurement \u2014 so this rating counts for ' +
              'less. For the real figure: WhoScored\u2019s <strong>xG</strong> tab, switch <strong>For</strong> ' +
              'to <strong>Against</strong>, then paste it and press <em>Import xG Against</em>.'
            : '');
        delete STATE.paste[key];
        delete STATE.editMsg[key];
        STATE.importMsg[key] = {
          color: stillNeed.length ? 'var(--warning)' : 'var(--good)',
          html: 'Filled <strong>' + filled.length + ' of ' + FIELDS.length +
            ' statistics</strong> from ' + parsed.matches + ' fixtures' +
            (parsed._fromTable
              ? ' (read by column from ' + parsed._tables +
                (parsed._tables === 1 ? ' table' : ' tables') + ')'
              : '') +
            (parsed._matchesFromCaller ? ' (match count from the box, not from the page)'
              : parsed._matchesFromRecord ? ' (derived from won+drawn+lost, because UEFA '
                + 'draws the match count inside a circle whose text does not come along when the page is copied)'
              : '') + '.' +
            (parsed._estimated.xgF
              ? ' <strong>xG is ESTIMATED</strong> from the shot profile, not real xG \u2014 UEFA does not publish it.'
              : '') + thin + miss + gate +
            (keptFields.length
              ? '<br />Kept from before, measured over the same ' + parsed.matches +
                ' matches: <strong>' + keptFields.join(', ') + '</strong>.'
              : '') +
            (droppedFields.length
              ? '<br /><strong>Cleared:</strong> ' + droppedFields.join(', ') +
                '. Not in this source, and measured over a different number of matches \u2014 ' +
                'keeping them would mix two samples into one team.'
              : '') +
            (shrank
              ? '<br /><strong style="color:var(--warning)">This sample is smaller than the one ' +
                'it replaced</strong> (' + parsed.matches + ' matches, was ' + shrank +
                '). If that was not intended, paste the fuller source again.'
              : '')
        };
        msg.style.color = STATE.importMsg[key].color;
        msg.innerHTML = STATE.importMsg[key].html;
        renderAll();
      });
      btnRow.appendChild(imp);
      btnRow.appendChild(impAgainst);
      impAgainst.addEventListener('click', function () {
        var got;
        try { got = E.parseTeamStats(ta.value, { against: true }); }
        catch (err) { got = null; }
        if (!got || got.xgA == null) {
          STATE.importMsg[key] = {
            color: 'var(--critical)',
            html: '<strong>No xG column found in that paste.</strong> This button wants ' +
              'WhoScored\u2019s <strong>xG</strong> tab with <strong>Against</strong> selected \u2014 ' +
              'the table whose columns read Tournament, Apps, xG, Goals*, xGDiff, Shots.'
          };
        } else {
          /* This one adds a column to the snapshot already there rather
             than replacing it: it is the same team over the same matches,
             read from another tab of the same page. Worth checking they
             really are the same sample. */
          STATE.overrides[key] = STATE.overrides[key] || {};
          var snapM = STATE.overrides[key].matches;
          var mismatch = snapM != null && got.matches != null && snapM !== got.matches;
          STATE.overrides[key].xgA = got.xgA;
          STATE.overrides[key]._m = STATE.overrides[key]._m || {};
          STATE.overrides[key]._m.xgA = got.matches;
          if (snapM == null) STATE.overrides[key].matches = got.matches;
          saveOverrides();
          delete STATE.paste[key];
          STATE.importMsg[key] = {
            color: 'var(--good)',
            html: '<strong>xG conceded set to ' + got.xgA + '</strong> per match, from ' +
              got.matches + ' fixtures. This team\u2019s defence is now measured rather than assumed.' +
              (mismatch
                ? '<br /><strong style="color:var(--warning)">But the rest of this team was ' +
                  'measured over ' + snapM + ' matches, not ' + got.matches + '.</strong> Two ' +
                  'samples in one team: re-import both tabs with the same competition filter.'
                : '')
          };
        }
        msg.style.color = STATE.importMsg[key].color;
        msg.innerHTML = STATE.importMsg[key].html;
        renderAll();
      }); btnRow.appendChild(msg);
      wrap.appendChild(lb); wrap.appendChild(ta); wrap.appendChild(btnRow);
      box.appendChild(wrap);
    });

    /* One box that fills many teams, at the end of the per-team boxes. */
    var bulk = el('div');
    bulk.style.cssText = 'margin-top:14px;padding-top:10px;border-top:1px dashed var(--border)';
    renderBulkPaste(bulk);
    box.appendChild(bulk);

    var row = el('div', 'btn-row');
    var reset = el('button', 'btn ghost', 'Reset to defaults');
    reset.type = 'button';
    reset.addEventListener('click', function () {
      delete STATE.overrides[a.fixture.home];
      delete STATE.overrides[a.fixture.away];
      delete STATE.importMsg[a.fixture.home];
      delete STATE.importMsg[a.fixture.away];
      delete STATE.editMsg[a.fixture.home];
      delete STATE.editMsg[a.fixture.away];
      saveOverrides();
      renderAll();
    });
    row.appendChild(reset);
    var hint = el('span');
    hint.style.cssText = 'font-size:12px;color:var(--text-muted)';
    hint.textContent = 'Every figure is a PER MATCH average, not a season total.';
    row.appendChild(hint);
    box.appendChild(row);
  }

  /* ========================================================== PARLAY ==== */
  function addLeg(pick, analysis) {
    if (STATE.legs.some(function (l) { return l.pick.id === pick.id; })) return;
    if (STATE.legs.some(function (l) { return l.pick.fixtureId === pick.fixtureId; })) {
      if (!window.confirm('There is already a leg from this fixture. Two legs from one match are ' +
        'correlated, which makes the parlay price invalid. Add it anyway?')) return;
    }
    STATE.legs.push({ pick: pick, analysis: analysis });
    renderParlay();
  }

  function analysesForSlate() {
    var an = [];
    slateFixtures(STATE.slate).forEach(function (f) {
      try { an.push(analyse(f)); } catch (err) {}
    });
    return an;
  }
  /** A fixture can only use the model when BOTH its teams were filled in by
      a person. One team's real xG against the other's placeholder is not a
      comparison, it is a category error. */
  function fixtureHasUserStats(fx) {
    return statOrigin(fx.home) === 'user' && statOrigin(fx.away) === 'user';
  }

  /** Slate-level, for controls that apply to the whole board. */
  function slateHasUserStats() {
    return slateFixtures(STATE.slate).some(fixtureHasUserStats);
  }

  function parlayOpts(an) {
    return {
      legs: parseInt($('p-legs').value, 10) || 9,
      allowQuarter: $('p-quarter').value === '1',
      minProb: parseFloat($('p-minprob').value) || 0.5,
      maxProb: parseFloat($('p-maxprob').value) || 0.9,
      kinds: $('p-kinds').value.split(','),
      /* Selecting on expected value is only honest when the numbers behind
         that value came from a person. Ranking by EV over placeholder seeds
         makes the selector hunt for edges I invented, which is how a ticket
         ends up advertised at +42% EV. With seeds, rank on what is actually
         knowable instead: full-payout probability net of margin. */
      useEV: slateHasUserStats()
    };
  }
  function buildParlay() {
    var an = analysesForSlate();
    var opts = parlayOpts(an);
    var want = opts.legs;
    var asked = opts.minProb;

    /* A balanced Asian line sits at 50-56% full payout by construction, so a
       bar much above 0.50 empties the tray in any liquid market. Rather than
       hand back an empty box and an explanation, step the bar down until the
       ticket fills, and report exactly where it had to land. */
    var legs = E.pickParlayLegs(an, opts);
    var used = asked;
    while (legs.length < want && used > 0.44) {
      used = Math.round((used - 0.01) * 100) / 100;
      opts.minProb = used;
      legs = E.pickParlayLegs(an, opts);
    }
    STATE.legs = legs;
    STATE.relaxedFrom = (used < asked && legs.length) ? { asked: asked, used: used } : null;
    renderParlay();
  }

  function renderParlay() {
    var list = $('p-legs-list'); list.innerHTML = '';
    var kpis = $('p-kpis'); kpis.innerHTML = '';
    var ladder = $('p-ladder'); ladder.innerHTML = '';
    if (STATE.relaxedFrom) {
      var rl = el('div', 'notice');
      rl.style.cssText = 'margin:0 0 10px;border-left-color:var(--warning)';
      rl.innerHTML = '<h3>Ambang diturunkan otomatis: ' + pct(STATE.relaxedFrom.asked, 0) +
        ' \u2192 ' + pct(STATE.relaxedFrom.used, 0) + '</h3>' +
        '<p>Not enough legs pay full odds ' + pct(STATE.relaxedFrom.asked, 0) +
        ' of the time, so the threshold was lowered until the ticket filled. A balanced Asian line does ' +
        'sit around 50&ndash;56% full-payout &mdash; that is precisely what the bookmaker builds it to do. ' +
        'The legs below are real and bettable; all that changed is how high a threshold ' +
        'this market can meet.</p>';
      list.appendChild(rl);
    }
    $('p-count').textContent = STATE.legs.length
      ? STATE.legs.length + ' legs selected' +
        (E.pickParlayLegs.lastBlocked ? ' · ' + E.pickParlayLegs.lastBlocked +
          ' selections were dropped for odds below 1.50 (absent from the Mix Parlay menu)' : '')
      : '';

    if (!STATE.legs.length) {
      var empty = el('div', 'panel-body');
      var bar = parseFloat($('p-minprob').value) || 0.5;
      var blocked = E.pickParlayLegs.lastBlocked || 0;
      empty.innerHTML =
        '<div class="notice bad" style="margin:0"><h3>Not a single leg qualifies</h3>' +
        '<p>You asked for legs paying <strong>full odds</strong> at least <span class="fig">' +
        pct(bar, 0) + '</span> of the time. Nothing on this schedule reaches that' +
        (blocked ? ', and ' + blocked + ' other selections were dropped first for odds below 1.50 ' +
          '(they do not appear in the Mix Parlay menu)' : '') + '.</p>' +
        '<p>That is the correct answer, not a failure of the tool. A liquid market does not sell ' +
        'cheap legs that win 55% of the time &mdash; if it did, the bookmaker would have fixed the price. ' +
        'Lower the threshold to around <span class="fig">0.50&ndash;0.52</span> and see what this really ' +
        'costs, or pick a different schedule.</p>' +
        '<p><strong>Note:</strong> this threshold measures the chance of a <em>full payout</em>, not ' +
        'raw probability. A whole line often reads 56% probable while paying full odds only 32% ' +
        'of the time, because the rest is a push &mdash; and a pushed leg multiplies the ticket by 1.0.</p></div>';
      list.appendChild(empty);
      return;
    }

    /* Which leg deserves the highlighter? With real stat input, the one with
       the best expected value. Without it, EV is zero everywhere, so the
       honest criterion is the leg that is cheapest to hold: highest
       probability per unit of margin paid, with no quarter-line drag. */
    /* Only call it an expected-value pick when a person supplied the numbers
       behind that value. A positive EV over placeholder seeds is not a
       reason to change how the ticket is ranked or described. */
    var userStats = slateHasUserStats();
    var hasEV = userStats && STATE.legs.some(function (L) { return L.pick.ev > 0.015; });
    var bestIdx = 0, bestScore = -Infinity;
    STATE.legs.forEach(function (L, i) {
      var sc = hasEV ? L.pick.ev : L.pick.efficiency;
      if (sc > bestScore) { bestScore = sc; bestIdx = i; }
    });

    STATE.legs.forEach(function (L, i) {
      var p = L.pick, a = L.analysis;
      var row = el('div', 'leg');
      var isBest = i === bestIdx;
      if (isBest || p.ev > 0.015) row.style.background = 'var(--hl-wash)';
      if (isBest) {
        var ring = el('span', 'ring');
        ring.textContent = '\u2713';
        ring.title = hasEV
          ? 'Best expected value on this ticket'
          : 'The most efficient leg on this ticket: highest probability per unit of margin paid, no quarter lines';
        row.appendChild(ring);
      } else {
        row.appendChild(el('span', 'leg-num', String(i + 1)));
      }
      var main = el('div', 'leg-main');
      main.innerHTML = '<strong>' + p.label + '</strong><span>' +
        a.home.name + ' v ' + a.away.name + ' · ' + (a.fixture.kickoff || '') +
        ' · ' + KIND_LABEL[p.kind] + (p.half === '1h' ? ' BB1' : '') +
        (p.lineType === 'quarter' ? ' · <span style="color:var(--serious);font-weight:700">quarter line</span>' : '') +
        '</span>';
      row.appendChild(main);
      var info = el('div');
      info.style.cssText = 'text-align:right;font-family:var(--mono);font-size:12px';
      var prob = p.pFairMarket != null ? p.pFairMarket : p.pModel;
      info.innerHTML = '<div style="font-weight:700">' + fmtOdds(p.odds) + '</div>' +
        '<div style="color:var(--text-muted)">p ' + pct(prob, 0) +
        (p.vig != null ? ' · vig ' + pct(p.vig, 1) : '') + '</div>';
      row.appendChild(info);
      var rm = el('button', 'btn sm ghost', '×');
      rm.type = 'button'; rm.title = 'Remove leg';
      rm.addEventListener('click', function () {
        STATE.legs.splice(i, 1); renderParlay();
      });
      row.appendChild(rm);
      list.appendChild(row);
    });

    var stake = parseFloat($('p-stake').value) || 100000;
    var sim = E.simulateParlay(E.toSimLegs(STATE.legs), 40000, 20260922);

    function kpi(cap, val, note, cls) {
      var k = el('div', 'kpi');
      k.innerHTML = '<div class="cap">' + cap + '</div><div class="val' +
        (cls ? ' ' + cls : '') + '">' + val + '</div>' +
        (note ? '<div class="note">' + note + '</div>' : '');
      kpis.appendChild(k);
    }
    kpi('Printed odds', sim.printedOdds.toFixed(3),
      'Payout if every leg wins in full: ' + rupiah(stake * sim.printedOdds));
    kpi('Expected return', sim.expectedReturn.toFixed(4) + 'x',
      'Long-run average: ' + rupiah(stake * sim.expectedReturn) + ' of ' + rupiah(stake),
      sim.expectedReturn >= 1 ? 'good' : 'bad');
    kpi('Expected value', signPct(sim.ev, 1),
      sim.ev < 0 ? 'Expected loss of ' + rupiah(stake * -sim.ev) + ' every time it is staked'
                 : 'Expected profit of ' + rupiah(stake * sim.ev),
      sim.ev >= 0 ? 'good' : 'bad');
    kpi('Chance of profit', pct(sim.pProfit, 2),
      'Every leg wins in full: ' + pct(sim.pAllWin, 3) + ' · median result ' + sim.median.toFixed(2) + 'x');
    if (sim.quarterLegs) {
      kpi('Quarter-line legs', String(sim.quarterLegs),
        'This is what cut your slip from 73x to 6.07x. Switch to half lines where you can.',
        'bad');
    }
    var tiltedLegs = STATE.legs.filter(function (L) {
      return Math.abs(STATE.tilt[L.pick.fixtureId] || 0) > 0.001;
    }).length;

    if (sim.ev > 0.02 && !slateHasUserStats()) {
      var fake = el('div', 'kpi');
      fake.style.cssText = 'border-left:4px solid var(--critical)';
      if (tiltedLegs) {
        /* Not fabricated - but not evidence either. The edge is the user's
           own read, priced back to them. Saying "this EV is not real" would
           be wrong; saying nothing would let a personal opinion masquerade as
           a measurement. */
        fake.innerHTML = '<div class="cap">This EV is yours, not evidence</div>' +
          '<div class="val">' + signPct(sim.ev, 1) + '</div>' +
          '<div class="note">This positive figure comes from your own judgement on ' +
          tiltedLegs + ' fixtures, not from data. The tool only works out the consequences of ' +
          'your opinion consistently &mdash; it does not verify it. If your read is ' +
          'right, this ticket really is better than the market version. If it is wrong, this ticket is ' +
          'worse, and every EV above is wrong by the size of that error. ' +
          'Slide it back to zero to see the bookmaker price as it stands.</div>';
      } else {
        fake.innerHTML = '<div class="cap">This positive EV is not real</div>' +
          '<div class="val bad">' + signPct(sim.ev, 1) + '</div>' +
          '<div class="note">Not one statistic on this schedule was entered by you ' +
          'and no judgement was supplied, so this positive figure came out of data ' +
          'that shipped as placeholders. No bookmaker offers an edge this size to anyone.</div>';
      }
      kpis.appendChild(fake);
    }

    var why = el('div', 'kpi');
    why.innerHTML = '<div class="cap">Arti stabilo biru muda</div>' +
      '<div class="note">' + (hasEV
        ? 'You have entered statistics for this schedule, so the highlighted rows are the ones with positive expected value, and the <strong>circled</strong> row is the highest EV.'
        : 'You have not entered team statistics, so there is no EV worth chasing. The <strong>circled</strong> leg is the one with the highest chance of a <strong>full payout</strong> after the bookmaker margin &mdash; not raw probability. The difference is large: a whole line can read 56% probable while paying full odds only 32% of the time, because the rest is a push, and a pushed leg multiplies the ticket by 1.0. That rule comes from your own two real coupons: half lines returned 100% of the printed odds, whole lines 88%, quarter lines 64%.') +
      '</div>';
    kpis.appendChild(why);

    /* ladder: how ticket length changes the economics */
    var tb = el('table', 'mb');
    tb.innerHTML = '<thead><tr><th>Ticket length</th><th style="text-align:right">Printed odds</th>' +
      '<th style="text-align:right">Expected return</th><th style="text-align:right">EV</th>' +
      '<th style="text-align:right">Chance of profit</th><th style="text-align:right">Expected loss / ' +
      rupiah(stake) + '</th></tr></thead>';
    var bd = el('tbody');
    var lens = [];
    for (var n = 1; n <= STATE.legs.length; n++) {
      if (n <= 4 || n === STATE.legs.length || n % 2 === 1) lens.push(n);
    }
    lens.forEach(function (n) {
      var s2 = E.simulateParlay(E.toSimLegs(STATE.legs.slice(0, n)), 20000, 777);
      var tr = el('tr');
      if (n === STATE.legs.length) tr.className = 'is-top';
      tr.innerHTML = '<td>' + n + ' leg</td>' +
        '<td class="num">' + s2.printedOdds.toFixed(2) + '</td>' +
        '<td class="num">' + s2.expectedReturn.toFixed(4) + 'x</td>' +
        '<td class="num" style="color:' + (s2.ev >= 0 ? 'var(--good)' : 'var(--critical)') + '">' +
          signPct(s2.ev, 1) + '</td>' +
        '<td class="num">' + pct(s2.pProfit, 2) + '</td>' +
        '<td class="num">' + rupiah(stake * Math.max(0, -s2.ev)) + '</td>';
      bd.appendChild(tr);
    });
    tb.appendChild(bd);
    var wrapT = el('div', 'table-scroll');
    wrapT.appendChild(tb);
    var lh = el('h4', null, 'Ticket length vs expected outcome (same legs, trimmed from the top)');
    lh.style.cssText = 'font-size:12px;margin-bottom:8px;color:var(--text-secondary)';
    ladder.appendChild(lh);
    ladder.appendChild(wrapT);

    /* the Opta Million arithmetic, applied to this ticket */
    var probs = STATE.legs.map(function (L) {
      return L.pick.pFairMarket != null ? L.pick.pFairMarket : L.pick.pModel;
    });
    var ca = E.compoundingArithmetic(probs, 0.5);
    if (ca) {
      var box = el('div', 'notice');
      box.style.marginTop = '13px';
      box.innerHTML = '<h3>The arithmetic of multiplying &mdash; the method from the Smartodds note you sent</h3>' +
        '<p>Average probability per leg: <span class="fig">' + pct(ca.avgLegProb, 1) + '</span>. ' +
        'Chance the whole ticket lands: <span class="fig">' + pct(ca.pOptimal, 3) +
        '</span> = 1 in <span class="fig">' + Math.round(ca.oneIn).toLocaleString('en-US') + '</span>.</p>' +
        '<p>If the legs were picked at random (50% each): <span class="fig">' + pct(ca.pRandom, 3) +
        '</span> = 1 in ' + Math.round(1 / ca.pRandom).toLocaleString('en-US') + '. ' +
        'So choosing carefully buys an improvement of <span class="fig">' +
        ca.improvementFactor.toFixed(2) + 'x</span>.</p>' +
        '<p><strong>This is the heart of that article.</strong> Coles worked out that the optimal Opta Million strategy was ' +
        '26,000x better than random, and the result was still 3.6&times;10<sup>-12</sup> &mdash; ' +
        'because both figures are raised to the power of the number of predictions. Exactly the same here: better leg selection ' +
        'multiplies the chance by <span class="fig">' + ca.improvementFactor.toFixed(2) + 'x</span>, ' +
        'sedangkan menambah leg membaginya <span class="fig">' +
        Math.round(1 / Math.pow(ca.avgLegProb, ca.legs)).toLocaleString('en-US') +
        'x</span>. Better selection cannot outrun the number of legs.</p>' +
        (ca.legsForOneIn20
          ? '<p><strong>The most useful number here:</strong> at this leg quality, a ticket still ' +
            'has better than a 1-in-20 chance up to <span class="fig">' + ca.legsForOneIn20 +
            ' legs</span>. A ' + ca.legs + '-leg ticket sits at 1-in-' +
            Math.round(ca.oneIn).toLocaleString('en-US') + '.</p>'
          : '');
      ladder.appendChild(box);
    }
  }

  /* ================================================ SLIP VALIDATION ===== */
  function renderSlip() {
    var vs = DATA.verifiedSlip;
    if (!vs) return;
    var outMap = { 'Won': 'win', 'Half Won': 'halfWin', 'Half Lose': 'halfLose',
                   'Lose': 'lose', 'Push': 'push' };
    var mult = 1;
    var rows = vs.legs.map(function (l) {
      var m = E.legMultiplier(outMap[l.result], l.odds);
      mult *= m;
      return { l: l, m: m };
    });
    var gross = mult * vs.stake;
    var net = gross - vs.stake;

    var box = $('slip-table'); box.innerHTML = '';
    var tb = el('table', 'mb');
    tb.innerHTML = '<thead><tr><th>#</th><th>Fixture</th><th>Selection</th>' +
      '<th style="text-align:right">Odds</th><th>Score</th><th>Result</th>' +
      '<th style="text-align:right">Pengali leg</th><th style="text-align:right">Pengali berjalan</th></tr></thead>';
    var bd = el('tbody');
    var run = 1;
    rows.forEach(function (r, i) {
      run *= r.m;
      var tr = el('tr');
      if (r.m < 1) tr.className = 'tier-avoid';
      tr.innerHTML = '<td class="num">' + (i + 1) + '</td>' +
        '<td>' + r.l.match + '</td><td>' + r.l.pick + '</td>' +
        '<td class="num">' + r.l.odds.toFixed(2) + '</td>' +
        '<td class="num">' + r.l.score + '</td>' +
        '<td style="color:' + (r.m >= 1 ? 'var(--good)' : 'var(--critical)') + ';font-weight:600">' +
          r.l.result + '</td>' +
        '<td class="num">' + r.m.toFixed(3) + '</td>' +
        '<td class="num">' + run.toFixed(3) + '</td>';
      bd.appendChild(tr);
    });
    tb.appendChild(bd);
    box.appendChild(tb);

    $('slip-sub').textContent = 'ID ' + 9 + ' legs · reconstructed from Asian settlement rules';
    var note = $('slip-note'); note.innerHTML = '';
    var n1 = el('div', 'notice ok');
    n1.innerHTML = '<h3>The engine matches your real slip, down to the rupiah</h3>' +
      '<p>Printed odds <span class="fig">' + vs.ticketOdds + '</span>, which should pay gross ' +
      '<span class="fig">' + rupiah(vs.ticketOdds * vs.stake) + '</span> of a stake of ' +
      rupiah(vs.stake) + '.</p>' +
      '<p>Actual result: <span class="fig">' + mult.toFixed(4) + 'x</span> = gross ' +
      '<span class="fig">' + rupiah(gross) + '</span>, net profit <span class="fig">' +
      rupiah(net) + '</span> &mdash; the same as the Win/Lose column on your slip (' +
      rupiah(vs.payout) + ').</p>' +
      '<p>So you received <span class="fig">' + pct(gross / (vs.ticketOdds * vs.stake), 1) +
      '</span> of the printed potential. The cause was three quarter-line legs: two ' +
      '<em>half lose</em> (Bournemouth +0.75, Over 2.25) and one <em>half won</em> ' +
      '(Fiorentina 1H Under 1.25). Those two half-loses alone multiplied the ticket by 0.5 &times; 0.5 = 0.25.</p>' +
      '<p><strong>That is why this tool refuses quarter lines by default</strong>, and why ' +
      'the "line" column on the Value Board marks every row as quarter, half or whole.</p>';
    note.appendChild(n1);
  }


  /* ------------------------------------------------ calibration ledger -- */
  var OUTCOME_LABEL = { win: 'Win', halfWin: 'Half win', push: 'Push (returned)',
                        halfLose: 'Half lose', lose: 'Lose' };

  function renderCalibration() {
    var host = $('calib-coupons'), sum = $('calib-summary');
    if (!host || !sum) return;
    host.innerHTML = ''; sum.innerHTML = '';
    if (!DATA.coupons || !DATA.coupons.length) return;

    /* analyse every fixture once, at the default anchor, so grading does not
       shift when the user drags the market-weight slider */
    var byId = {};
    DATA.fixtures.forEach(function (fx) {
      try {
        byId[fx.id] = E.analyseFixture(fx, teamsView(), DATA.leagues,
          { marketWeight: 0.35, calibration: CALIB });
      } catch (err) {}
    });

    /* A pre-registered coupon carries no results yet. Scores typed here are
       merged in before grading, so the ledger updates as matches finish
       without waiting on a redeploy. The stored model probability is the one
       frozen at prediction time and is never recomputed. */
    var grades = DATA.coupons.map(function (c) {
      var merged = c;
      if (c.status === 'pending') {
        merged = {};
        for (var k in c) merged[k] = c[k];
        merged.legs = c.legs.map(function (leg, i) {
          var key = c.id + '|' + i;
          var typed = STATE.scores[key];
          if (!typed) return leg;
          var copy = {};
          for (var k2 in leg) copy[k2] = leg[k2];
          if (typed.score) copy.score = typed.score;
          if (typed.score1h) copy.score1h = typed.score1h;
          copy.outcome = null;   // always derive from the score
          return copy;
        });
      }
      return E.gradeCoupon(merged, byId);
    });
    var rep = E.calibrationReport(grades);

    if (rep) {
      var box = el('div', 'notice' + (rep.significant ? '' : ' bad'));
      box.innerHTML = '<h3>Brier score over ' + rep.n + ' legs that carry a model probability</h3>' +
        '<p>Brier model <span class="fig">' + rep.brier.toFixed(4) + '</span> ' +
        'melawan <span class="fig">' + rep.brierBaseline.toFixed(4) + '</span> against a model that ' +
        'that always answers 50%. Lower is better, so a skill score of <span class="fig">' +
        (rep.skill * 100).toFixed(1) + '%</span>.</p>' +
        '<p><strong>' + (rep.significant
          ? 'The sample is large enough to start trusting.'
          : 'This is NOT evidence. ' + rep.n + ' legs is far too few &mdash; it takes 50 or more before this number means anything.') +
        '</strong> And there is a second, more serious problem: the coupons in this ledger were chosen ' +
        'by their results. One coupon won, one lost. The legs on the winning coupon ' +
        'almost all landed by definition, so the "reality" column in the table below must ' +
        'read higher than the "claimed" column. That is selection bias, not a good model. ' +
        'For the number to be honest, coupons must be recorded BEFORE the matches, win or lose.</p>';
      sum.appendChild(box);

      var tb = el('table', 'mb');
      var html = '<thead><tr><th>Bucket probabilitas</th><th style="text-align:right">Leg</th>' +
        '<th style="text-align:right">Average model claim</th>' +
        '<th style="text-align:right">Average reality</th><th>Gap</th></tr></thead><tbody>';
      rep.buckets.forEach(function (b) {
        if (!b.n) return;
        var diff = b.meanActual - b.meanP;
        html += '<tr><td>' + (b.lo * 100).toFixed(0) + '\u2013' + (b.hi * 100).toFixed(0) + '%</td>' +
          '<td class="num">' + b.n + '</td>' +
          '<td class="num">' + pct(b.meanP, 1) + '</td>' +
          '<td class="num">' + pct(b.meanActual, 1) + '</td>' +
          '<td class="num" style="color:' + (Math.abs(diff) < 0.08 ? 'var(--good)' : 'var(--text-secondary)') +
          '">' + signPct(diff, 1) + '</td></tr>';
      });
      html += '</tbody>';
      tb.innerHTML = html;
      var sc = el('div', 'table-scroll'); sc.appendChild(tb);
      sum.appendChild(sc);
    }

    grades.forEach(function (g) {
      var panel = el('div');
      panel.style.cssText = 'border-top:1px solid var(--border)';
      var head = el('div', 'panel-head');
      head.style.background = 'var(--chrome-2)';
      var pushes = g.rows.filter(function (r) { return r.outcome === 'push'; }).length;
      head.innerHTML = g.coupon.label +
        '<span class="sub">' + g.wins + ' won, ' + g.halves + ' half, ' +
        (pushes ? pushes + ' pushed, ' : '') + g.losses + ' lost' +
        (g.grossMultiple != null ? ' \u00b7 ticket multiplier ' + g.grossMultiple.toFixed(4) + 'x' : '') +
        (g.brier != null ? ' \u00b7 Brier ' + g.brier.toFixed(4) : '') + '</span>';
      panel.appendChild(head);

      var tb = el('table', 'mb');
      var html = '<thead><tr><th style="width:26px">#</th><th>Fixture</th><th>Selection</th>' +
        '<th style="text-align:right">Odds</th><th>Score</th><th>Result</th>' +
        '<th style="text-align:right">Prob. model</th><th style="text-align:right">EV model</th>' +
        '<th>Vonis model</th></tr></thead><tbody>';
      var pending = g.coupon.status === 'pending';
      g.rows.forEach(function (r, i) {
        var l = r.leg;
        var verdict = '\u2014', vcolor = 'var(--text-muted)';
        /* On a pre-registered ticket with no entered statistics, EV is the
           bookmaker's margin with a minus sign - every leg would print
           AVOID, including the nine this tool just recommended. Report why
           the leg was chosen instead: how often it pays full odds. */
        if (l.cleanWinAtPrediction != null) {
          verdict = 'selected \u00b7 full payout ' + pct(l.cleanWinAtPrediction, 1);
          vcolor = 'var(--hl-edge)';
        } else if (r.pick) {
          if (r.pick.ev <= -0.04) { verdict = 'HINDARI'; vcolor = 'var(--critical)'; }
          else if (r.pick.ev >= 0.015) { verdict = 'VALUE'; vcolor = 'var(--good)'; }
          else { verdict = 'neutral'; vcolor = 'var(--text-secondary)'; }
        } else if (r.pModel != null) {
          verdict = r.pModel < 0.5 ? 'prob. di bawah 50%' : 'prob. di atas 50%';
          vcolor = r.pModel < 0.5 ? 'var(--critical)' : 'var(--text-secondary)';
        }
        var lost = r.outcome === 'lose';
        html += '<tr' + (lost ? ' class="tier-avoid"' : '') + '>' +
          '<td class="num">' + (i + 1) + '</td>' +
          '<td>' + l.match + '</td><td>' + l.pick + '</td>' +
          '<td class="num">' + (l.odds ? l.odds.toFixed(2) : '\u2014') + '</td>' +
          (pending
            ? '<td class="num"><input class="score-in" data-c="' + g.coupon.id + '" data-i="' + i +
              '" data-f="score" value="' + (l.score || '') + '" placeholder="1:1" ' +
              'style="width:56px;padding:2px 4px;font-family:var(--mono);font-size:12px;' +
              'border:1px solid var(--border-strong);border-radius:3px;background:var(--surface-1);' +
              'color:var(--text-primary)" />' +
              (l.half === '1h'
                ? ' <input class="score-in" data-c="' + g.coupon.id + '" data-i="' + i +
                  '" data-f="score1h" value="' + (l.score1h || '') + '" placeholder="BB1 0:0" ' +
                  'title="First-half score - this leg settles from it" ' +
                  'style="width:62px;padding:2px 4px;font-family:var(--mono);font-size:12px;' +
                  'border:1px solid var(--border-strong);border-radius:3px;background:var(--surface-1);' +
                  'color:var(--text-primary)" />'
                : '') + '</td>'
            : '<td class="num"' + (l.scoreNote ? ' title="' + l.scoreNote.replace(/"/g, '&quot;') + '"' : '') + '>' +
            (l.score || '\u2014') +
            (l.score1h ? ' <span style="color:var(--text-muted)">(BB1 ' + l.score1h + ')</span>' : '') +
            (r.outcomeMismatch ? ' <span style="color:var(--critical)" title="The recorded result contradicts the score. The engine uses the score.">&#9888;</span>' : '') +
            '</td>') +
          '<td style="font-weight:600;color:' +
            (r.outcome === 'win' ? 'var(--good)' : lost ? 'var(--critical)'
             : r.outcome === 'push' ? 'var(--text-secondary)' : 'var(--warning)') + '">' +
            (OUTCOME_LABEL[r.outcome] || (pending ? 'not played yet' : '?')) + '</td>' +
          '<td class="num"' + (l.pModelAtPrediction != null
              ? ' title="Frozen on ' + (g.coupon.registeredAt || 'the day it was predicted') +
                ', before the match. Never recomputed."' : '') + '>' +
            (l.pModelAtPrediction != null ? pct(l.pModelAtPrediction, 1)
             : r.pModel != null ? pct(r.pModel, 1) : '\u2014') + '</td>' +
          '<td class="num"' +
            (l.vigAtPrediction != null
              ? ' style="color:var(--text-muted)" title="This is the bookmaker margin, not a verdict. Without statistics from you the model is pinned to this same price, so every leg EV is minus that margin."'
              : '') + '>' +
            (l.vigAtPrediction != null ? '\u2212' + pct(l.vigAtPrediction, 1) + ' margin'
             : r.pick ? signPct(r.pick.ev, 1) : '\u2014') + '</td>' +
          '<td style="color:' + vcolor + ';font-weight:600;font-size:12px">' + verdict + '</td></tr>';
      });
      html += '</tbody>';
      tb.innerHTML = html;
      var sc2 = el('div', 'table-scroll'); sc2.appendChild(tb);
      panel.appendChild(sc2);

      if (g.coupon.note) {
        var n = el('div', 'panel-body');
        n.innerHTML = '<p class="stat-note">' + g.coupon.note + '</p>';
        panel.appendChild(n);
      }
      host.appendChild(panel);
    });

    host.querySelectorAll('.score-in').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var key = inp.getAttribute('data-c') + '|' + inp.getAttribute('data-i');
        STATE.scores[key] = STATE.scores[key] || {};
        var v = inp.value.trim();
        if (v) STATE.scores[key][inp.getAttribute('data-f')] = v;
        else delete STATE.scores[key][inp.getAttribute('data-f')];
        try { localStorage.setItem('mb-scores', JSON.stringify(STATE.scores)); } catch (e) {}
        renderCalibration();
      });
    });

    /* the alternatives the user says he should have taken, graded */
    var alts = (DATA.couponReview || {}).gradedAlternatives;
    if (alts && alts.length) {
      var ap = el('div');
      ap.style.cssText = 'border-top:1px solid var(--border)';
      var ah2 = el('div', 'panel-head');
      ah2.style.background = 'var(--chrome-2)';
      ah2.innerHTML = 'The alternatives that should have been taken, judged against the real scores' +
        '<span class="sub">The offered prices cannot be recovered, so the odds column is the MODEL FAIR ODDS</span>';
      ap.appendChild(ah2);
      var tb2 = el('table', 'mb');
      var h2 = '<thead><tr><th>Match</th><th>Alternative</th><th>Score</th><th>Result</th>' +
        '<th style="text-align:right">Prob. model</th><th style="text-align:right">Odds adil model</th>' +
        '<th>Note</th></tr></thead><tbody>';
      alts.forEach(function (alt) {
        var a = byId[alt.fixtureId];
        var pm = null, fair = null;
        if (a) {
          var M = alt.half === '1h' ? a.matrixHT : a.matrixFT;
          var fn2;
          if (alt.kind === 'ah') fn2 = function (i, j) { return E.settleAH(i, j, alt.line, alt.side); };
          else if (alt.kind === 'ou') fn2 = function (i, j) { return E.settleOU(i, j, alt.line, alt.side); };
          else fn2 = function (i, j) {
            var rr = i > j ? '1' : i < j ? '2' : 'X';
            return rr === alt.side ? 1 : -1;
          };
          var b2 = E.evaluateBet(M, fn2);
          if (b2.w > 0) { pm = b2.w / (b2.w + b2.l); fair = 1 + b2.l / b2.w; }
        }
        var settled = E.settleFromScore({
          kind: alt.kind, line: alt.line, side: alt.side, half: alt.half,
          score: alt.score, score1h: alt.score1h || alt.score
        });
        h2 += '<tr><td>' + (a ? a.home.name + ' v ' + a.away.name : alt.fixtureId) + '</td>' +
          '<td>' + alt.label + '</td><td class="num">' + (alt.score || '\u2014') + '</td>' +
          '<td style="font-weight:600;color:' +
            (settled === 'win' ? 'var(--good)' : 'var(--critical)') + '">' +
            (OUTCOME_LABEL[settled] || '?') + '</td>' +
          '<td class="num">' + (pm != null ? pct(pm, 1) : '\u2014') + '</td>' +
          '<td class="num">' + (fair != null ? fair.toFixed(2) : '\u2014') + '</td>' +
          '<td style="font-size:12px;color:var(--text-secondary)">' + (alt.note || '') + '</td></tr>';
      });
      h2 += '</tbody>';
      tb2.innerHTML = h2;
      var sc3 = el('div', 'table-scroll'); sc3.appendChild(tb2);
      ap.appendChild(sc3);
      var warn2 = el('div', 'panel-body');
      warn2.innerHTML = '<p class="stat-note"><strong>The fair-odds column is not a price any bookmaker offered.</strong> ' +
        'The early-market board is not archived anywhere readable from here, and your own notes are gone, ' +
        'so the original prices cannot be recovered. What is in that column is the model fair value &mdash; ' +
        'an answer to "what should it have been", not "what was offered". And that model runs on ' +
        'placeholder statistics rather than real xG, so treat it as illustrative.</p>';
      ap.appendChild(warn2);
      host.appendChild(ap);
    }
  }

  /* ======================================================= METHODOLOGY == */
  function renderMethod() {
    var box = $('method'); box.innerHTML = '';
    var items = [
      ['1. Attack &amp; defence ratings from xG',
       'A team xG as a ratio of the league average. Both ratings multiply for both sides, so ' +
       'noise multiplies with them; that is why each rating is regressed toward the league average with a ' +
       '4-match prior (<code>RATING_PRIOR</code>). Without it, Milan vs Lecce comes out 3.00-0.48 &mdash; impossible.'],
      ['2. Shot-profile fusion',
       'Shots, shots on target and xG per shot. Shot volume is raised only to the power 0.35 ' +
       'because it has diminishing returns; a team taking many low-value shots must not ' +
       'look good on volume alone.'],
      ['3. Finishing &amp; big chances missed',
       'Goals over xG, regressed with a 38-match prior: finishing ability barely ' +
       'persists from season to season, so do not trust it. Big chances missed above ' +
       'the league norm carry a small penalty.'],
      ['4. xA as a measure of repeatability',
       'xA close to xG means chances are born from open-play structure rather than set pieces or ' +
       'rebounds. Only 25% of this signal moves the mean; the rest widens the uncertainty, ' +
       'because xA tells you how <em>repeatable</em> those chances are, not how many there were.'],
      ['5. Tackles &amp; fouls',
       'Tackles above average suppress the opponent\u2019s xG; fouls add set-piece danger. ' +
       'Both are capped at &plusmn;12% in total. The classic error is over-weighting these ' +
       'because they are easy to collect &mdash; next to xG, both are weak predictors.'],
      ['6. Yellows, reds and discipline',
       'Red-card risk is estimated from fouls, yellows and red-card history. ' +
       'A red card falls around the 65th minute on average, so its effect is weighted by the time left: ' +
       'the team own expected goals fall and the opponent rise.'],
      ['7. Dixon-Coles scoreline matrix',
       'A bivariate Poisson with the <code>&tau;(&rho;)</code> correction for low scores, because independent Poisson ' +
       'predicts 0-0 and 1-1 too rarely. The first half is fitted directly from ' +
       'first-half prices when they exist, rather than simply scaling full time.'],
      ['8. Market anchor',
       'The closing price is the strongest football predictor there is. A model that disagrees ' +
       'with the market by 40% is almost always wrong about its own inputs rather than right about the ' +
       'market. So the model &lambda; is shifted toward the &lambda; implied by the price; the slider in the Match ' +
       'Centre sets how far. A gap above 25% automatically forfeits ' +
       'main pick and the row is marked SUSPECT.'],
      ['9. Asian line settlement',
       'One function handles every line type: a quarter line splits across its two neighbours and is ' +
       'averaged, exactly as the bookmaker settles it. Every scoreline falls into one of five buckets ' +
       '(win, half win, push, half lose, lose), and those buckets drive the parlay simulation.'],
      ['10. Expected value, fair odds, Kelly',
       'From those buckets: <code>w</code> = the share of stake that wins, <code>l</code> = the share that loses. ' +
       'Odds adil = <code>1 + l/w</code>. EV = <code>w &times; (odds-1) - l</code>. Ukuran stake ' +
       'is shown as quarter Kelly, not full Kelly.'],
      ['11. Why the Mix Parlay menu differs',
       'The bookmaker removes the legs most likely to be mispriced in the player favour &mdash; above all short-priced ' +
       'favourites &mdash; by setting a minimum price per leg (around 1.50). That is why ' +
       'heavy-favourite 1X2 disappears from the parlay menu and only marginal selections remain. ' +
       'This tool applies the same limit, so what it proposes can always actually be placed.'],
      ['12. What this tool CANNOT do',
       'It cannot make a 9-leg parlay profitable. The bookmaker margin compounds once per leg; ' +
       'at 4% per leg, nine legs already hold back about 69% of the stake before a ball is kicked. ' +
       'What it can measure: how large that cost is, which legs are cheapest, and how much is ' +
       'lost to quarter lines.']
    ];
    /* This list describes what the engine CAN do. Read on a page where no
       statistics have been entered, it reads like a description of what it
       IS doing - and steps 1 to 6 all speak of xG the site does not have.
       Say plainly which steps are running right now. */
    var statFed = [1, 2, 3, 4, 5, 6];   // the steps that need entered statistics
    var fedCount = 0, totalTeams = 0;
    Object.keys(DATA.teams).forEach(function (k) {
      totalTeams++;
      if (statOrigin(k) === 'user') fedCount++;
    });
    var liveFixtures = DATA.fixtures.filter(function (f) {
      return statOrigin(f.home) === 'user' && statOrigin(f.away) === 'user';
    }).length;

    var state = el('div', 'notice' + (liveFixtures ? ' ok' : ''));
    state.innerHTML = liveFixtures
      ? '<h3>Live: all 12 steps, across ' + liveFixtures + ' fixtures</h3>' +
        '<p>' + fedCount + ' of ' + totalTeams + ' teams now carry your statistics. ' +
        'In fixtures where BOTH teams are filled, steps 1&ndash;6 genuinely run. ' +
        'In every other fixture, steps 1&ndash;6 stay idle and the numbers still come from the bookmaker price.</p>'
      : '<h3>Live right now: steps 7 through 12 only</h3>' +
        '<p><strong>Steps 1&ndash;6 are idle.</strong> Every one of them needs team statistics, and not one ' +
        'fixture yet has both teams filled. So no xG, shots, tackles or cards are being used ' +
        '&mdash; whatever the text below describes.</p>' +
        '<p>What is being used: expected goals recovered from <strong>the bookmaker own price</strong> ' +
        '(step 8), then turned into a scoreline distribution (step 7) and settled per line type ' +
        '(steps 9&ndash;10). Which means <strong>the probabilities you see are the bookmaker price ' +
        'with the margin removed</strong>, not an independent model estimate.</p>' +
        '<p>That is still useful &mdash; steps 9 to 12 are what measure line type, margin and ' +
        'the cost of ticket length. But do not imagine there is xG behind it, because there is not.</p>';
    box.appendChild(state);

    items.forEach(function (it, i) {
      var d = el('details', 'method');
      var sm = el('summary');
      var idle = !liveFixtures && statFed.indexOf(i + 1) >= 0;
      sm.innerHTML = it[0] + (idle
        ? ' <span style="font-size:10px;font-weight:700;letter-spacing:.04em;' +
          'color:var(--text-muted);border:1px solid var(--border-strong);border-radius:3px;' +
          'padding:1px 5px;margin-left:6px">MENGANGGUR</span>'
        : '');
      var b = el('div'); b.innerHTML = it[1];
      if (idle) d.style.opacity = '0.62';
      d.appendChild(sm); d.appendChild(b);
      box.appendChild(d);
    });
    var src = el('p', 'stat-note');
    src.innerHTML = '<strong>Sumber data:</strong> ' + DATA.meta.oddsSource +
      '<br /><strong>Team statistics:</strong> ' + DATA.meta.statSource;
    box.appendChild(src);
  }

  /* ============================================================ CHROME == */
  /* Slate keys are insertion order, not calendar order, so sorting by key
     put 24-27 Sept to the right of 10-13 Okt. The fixtures cannot settle it
     either: `kickoff` holds "21:00" in one slate, "19/09 19:30" in another
     and "10/10" in a third. So each slate carries its own start date, and
     the label is parsed only as a fallback for a slate added without one. */
  /* The slate labels are English now, but a slate written earlier may still
     carry an Indonesian month, so both spellings are accepted. */
  var ID_MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, mei:5, jun:6, jul:7,
                    aug:8, agu:8, sep:9, oct:10, okt:10, nov:11, dec:12, des:12 };
  function slateStart(k, label) {
    var explicit = (DATA.meta.slateStart || {})[String(k)];
    if (explicit) return explicit;
    /* "10-13 Okt 2026" or "20 Sept 2026" -> take the first day. */
    var m = /(\d{1,2})(?:\s*[-\u2013]\s*\d{1,2})?\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/.exec(label || '');
    if (m) {
      var mo = ID_MONTHS[m[2].toLowerCase()];
      if (mo) {
        return m[3] + '-' + ('0' + mo).slice(-2) + '-' + ('0' + m[1]).slice(-2);
      }
    }
    return '9999-' + ('00' + k).slice(-3);   // unknown dates sort last, stably
  }

  function renderSlateChips() {
    var box = $('slate-chips'); box.innerHTML = '';
    var slates = DATA.meta.slates || {};
    Object.keys(slates).sort(function (a, b) {
      var sa = slateStart(a, slates[a]), sb = slateStart(b, slates[b]);
      return sa < sb ? -1 : sa > sb ? 1 : (Number(a) - Number(b));
    }).forEach(function (k) {
      var n = parseInt(k, 10);
      if (!slateFixtures(n).length) return;
      /* The stored name carries its own aside - "(Early market, after the
         international break)" - useful as a tooltip and far too long for a
         chip on a phone. Keep the date, drop the aside. */
      var label = slates[k].split(' - ')[0].replace(/\s*\([^)]*\)\s*$/, '').trim();
      var c = el('button', 'chip', label);
      c.type = 'button';
      c.title = slates[k];
      c.setAttribute('aria-pressed', n === STATE.slate ? 'true' : 'false');
      c.addEventListener('click', function () {
        STATE.slate = n; STATE.fixtureId = null; STATE.legs = [];
        renderAll();
        buildParlay();   // a new slate needs a new ticket, not an empty tray
      });
      box.appendChild(c);
    });
  }

  function renderAll() {
    refreshCalibration();
    renderSlateChips();
    renderNewsTools();
    renderNews();
    renderTopTeamTools();
    renderTopTeams();
    renderReality();
    renderBoardTools();
    renderBoard();
    renderFixtures();
    renderMatchCentre();
    renderParlay();
  }

  /* ================================================== OPERATOR MODE ==== */
  /* The API token field, the endpoints and the import tools are the
     operator's workshop, not part of what a visitor - or a buyer - should
     see. They stay hidden unless the page is opened once with ?admin=1,
     which is then remembered in this browser. ?admin=0 puts them away again.

     This is not a security boundary and is not pretending to be one: the
     markup ships to everyone and anyone who looks can find the flag. What
     it does is keep a stranger from stumbling into a token field, and keep
     the page looking like a finished product. The token itself was never in
     the repository and still is not. */


  /* ================================================= STALE BUILD ====== */
  /* GitHub Pages serves HTML with its own max-age, so a plain URL can hand
     a reader yesterday's page while the data file - which busts its own
     cache - arrives fresh. That is the worst shape of wrong: the page looks
     updated and behaves like an old build, which is exactly what sent this
     project chasing bugs that were already fixed.

     The build id is stamped into both this page and build.json. Fetch the
     latter with the cache defeated; if it disagrees, reload once. The
     sessionStorage guard means a genuinely mismatched deploy can never put
     the page in a reload loop - it simply stays on the old build and says
     nothing, rather than spinning. */
  function checkForNewBuild() {
    var meta = document.querySelector('meta[name="build"]');
    var mine = meta && meta.getAttribute('content');
    if (!mine || mine === 'dev') return;
    fetch('build.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.build || j.build === mine) return;
        var once = 'mb-reloaded-' + j.build;
        try {
          if (sessionStorage.getItem(once)) return;
          sessionStorage.setItem(once, '1');
        } catch (err) { return; }
        location.reload();
      })
      .catch(function () { /* offline, or opened from a file: leave it be */ });
  }

  /* ============================================================== BOOT == */
  function boot(data) {
    DATA = data;
    var sub = $('brand-sub');
    if (sub) sub.textContent = 'Dixon-Coles · xG fusion · ' +
      DATA.fixtures.length + ' matches';

    $('odds-format').addEventListener('change', function (e) {
      STATE.format = e.target.value; renderBoard(); renderMatchCentre(); renderParlay();
    });
    $('theme-toggle').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var next = cur === 'dark' ? 'light' : cur === 'light' ? 'dark'
        : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark');
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('mb-theme', next); } catch (err) {}
    });
    $('mw').addEventListener('input', function (e) {
      STATE.marketWeight = parseInt(e.target.value, 10) / 100;
      renderReality(); renderFixtures(); renderMatchCentre(); renderParlay();
    });
    $('tilt').addEventListener('input', function (e) {
      var fx = currentFixture(); if (!fx) return;
      var v = parseInt(e.target.value, 10) / 100;
      if (v === 0) delete STATE.tilt[fx.id]; else STATE.tilt[fx.id] = v;
      saveTilt();
      renderFixtures(); renderMatchCentre(); buildParlay();
    });
    $('tilt-reset').addEventListener('click', function () {
      var fx = currentFixture(); if (!fx) return;
      delete STATE.tilt[fx.id];
      saveTilt();
      renderFixtures(); renderMatchCentre(); buildParlay();
    });
    $('p-build').addEventListener('click', buildParlay);
    $('p-clear').addEventListener('click', function () { STATE.legs = []; renderParlay(); });
    $('p-stake').addEventListener('change', renderParlay);
    ['p-legs', 'p-minprob', 'p-maxprob', 'p-quarter', 'p-kinds'].forEach(function (id) {
      $(id).addEventListener('change', buildParlay);
    });

    try {
      var t = localStorage.getItem('mb-theme');
      if (t) document.documentElement.setAttribute('data-theme', t);
    } catch (err) {}

    /* The API panel was removed: its token, endpoints and fetch buttons are
       gone, so there is nothing left to restore. Whatever a browser still
       holds from an older build is simply ignored.

       Judgements are work: losing them on a refresh would make the control
       not worth using. Browser storage can be unavailable or throw, so every
       read and write is guarded and the page renders fine without it. */
    try {
      var ov = localStorage.getItem('mb-overrides');
      if (ov) {
        var parsedOv = JSON.parse(ov);
        if (parsedOv && typeof parsedOv === 'object') STATE.overrides = parsedOv;
      }
    } catch (err) { STATE.overrides = {}; }

    try {
      var sc = localStorage.getItem('mb-scores');
      if (sc) {
        var parsedSc = JSON.parse(sc);
        if (parsedSc && typeof parsedSc === 'object') STATE.scores = parsedSc;
      }
    } catch (err) { STATE.scores = {}; }

    try {
      var saved = localStorage.getItem('mb-tilt');
      if (saved) {
        var parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') STATE.tilt = parsed;
      }
    } catch (err) { STATE.tilt = {}; }

    /* Land on the newest slate that has fixtures - by start date, so this
       can never disagree with the order the chips are drawn in. */
    var slatesMeta = DATA.meta.slates || {};
    var avail = Object.keys(slatesMeta)
      .filter(function (k) { return slateFixtures(Number(k)).length; })
      .sort(function (a, b) {
        var sa = slateStart(a, slatesMeta[a]), sb = slateStart(b, slatesMeta[b]);
        return sa < sb ? 1 : sa > sb ? -1 : (Number(b) - Number(a));
      });
    if (avail.length) STATE.slate = Number(avail[0]);

    renderAll();
    renderSlip();
    renderCalibration();
    renderMethod();
    buildParlay();
    loadNews();
    checkForNewBuild();
  }

  fetch('data/moneyball-fixtures.json?v=' + Date.now())
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(boot)
    .catch(function (err) {
      document.querySelector('.wrap').innerHTML =
        '<div class="notice bad"><h3>Gagal memuat data</h3><p>' + err.message +
        '</p><p>If the file is opened directly over <code>file://</code>, the browser blocks ' +
        'reading JSON. Run a local server: <code>python3 -m http.server</code> then open ' +
        '<code>http://localhost:8000/moneyball.html</code>.</p></div>';
    });
})();
