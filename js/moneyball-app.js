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
    legs: [], overrides: {}, tilt: {}, scores: {}, paste: {}, importMsg: {}, boardAll: false,
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
  function pct(v, d) { return (v * 100).toFixed(d == null ? 1 : d) + '%'; }
  function signPct(v, d) {
    var s = (v * 100).toFixed(d == null ? 1 : d);
    return (v > 0 ? '+' : '') + s + '%';
  }
  function rupiah(v) {
    return 'Rp ' + Math.round(v).toLocaleString('id-ID');
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
  function effStats(key) {
    var base = DATA.teams[key];
    var ov = STATE.overrides[key];
    if (!ov) return base;
    var merged = {};
    for (var k in base) merged[k] = base[k];
    for (var k2 in ov) merged[k2] = ov[k2];
    if (merged.xgF != null && merged.xgA != null) merged.statsMissing = false;
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
    if (!an.length) { box.textContent = 'Tidak ada pertandingan di jadwal ini.'; return; }

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
    var h = el('h3'); h.textContent = 'Matematika jadwal ini, sebelum pilih apa pun';
    box.appendChild(h);

    var rows = [
      ['Margin bandar rata-rata per leg (Handicap & O/U)', pct(avgVig, 2),
       avgVig > 0.07 ? 'sangat mahal - pasar likuiditas rendah'
                     : 'wajar untuk pasar Asia'],
      ['Pertandingan dengan input xG', withStats + ' dari ' + an.length,
       withStats === 0 ? 'model = pasar, EV nol sampai Anda isi statistik'
         : origins.user === 0
           ? 'semuanya masih angka contoh bawaan, BUKAN data asli'
           : origins.user + ' tim sudah Anda isi sendiri, ' + origins.seed + ' tim masih angka contoh'],
    ];
    if (sim) {
      rows.push(['Parlay ' + nLegs + ' leg terbaik yang bisa disusun di sini',
        'EV ' + signPct(sim.ev, 1),
        'harapan cair ' + sim.expectedReturn.toFixed(3) + 'x, peluang untung ' + pct(sim.pProfit, 2)]);
    }
    rows.forEach(function (r) {
      var p = el('p');
      p.innerHTML = r[0] + ': <span class="fig">' + r[1] + '</span> &mdash; ' + r[2];
      box.appendChild(p);
    });
    /* The single most dangerous state this tool can be in: showing a
       positive edge that came out of placeholder numbers. Say it outright. */
    if (sim && sim.ev > 0 && origins.user === 0 && origins.seed > 0) {
      var warn = el('p');
      warn.style.cssText = 'margin-top:8px;padding:9px 11px;border-radius:5px;' +
        'background:var(--surface-3);border-left:4px solid var(--critical)';
      warn.innerHTML = '<strong>Jangan pasang berdasarkan angka ini.</strong> EV positif di atas ' +
        'muncul dari statistik <em>contoh</em> yang saya isi supaya alat ini bisa jalan, bukan dari ' +
        'data pertandingan sungguhan. Angka contoh yang kebetulan tidak setuju dengan bandar akan ' +
        'selalu terlihat seperti peluang. Ganti dulu xG, xA, tembakan, foul, tekel dan kartu di form ' +
        '<em>Input Statistik</em> dengan data asli dari WhoScored / FBref / Understat &mdash; sebelum itu, ' +
        'satu-satunya angka di halaman ini yang benar-benar nyata adalah margin bandar dan jenis garisnya.';
      box.appendChild(warn);
    }

    if (sim) {
      var p2 = el('p');
      p2.innerHTML = '<strong>Konsekuensinya:</strong> tiap leg tambahan mengalikan margin bandar sekali lagi. ' +
        'Dengan margin ' + pct(avgVig, 1) + ' per leg, ' + nLegs + ' leg menahan sekitar <span class="fig">' +
        pct(Math.pow(1 - avgVig, nLegs), 1) + '</span> dari stake sebelum hasil pertandingan dihitung. ' +
        'Alat ini tidak bisa mengubah itu &mdash; yang bisa dilakukan: memilih leg dengan margin terkecil, ' +
        'menolak garis kuartal, dan menunjukkan angka aslinya.';
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
    var cnt = $('fx-count'); if (cnt) cnt.textContent = fxs.length + ' laga';
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
      else if (a) { badge.textContent = a.statsMissing ? 'pasar' : 'netral'; }
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
      cnt.textContent = fxs.length + ' laga' +
        (STATE.boardAll ? ' — semua jadwal' : '');
    }

    var head = el('div', 'board-head');
    head.innerHTML = '<span>Waktu</span><span>Pertandingan</span>' +
      '<span class="num">Handicap</span><span class="num">Atas / Bawah</span>' +
      '<span class="num">1 &middot; X &middot; 2</span><span>Pilihan model</span>';
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
          label = (sl.split(' - ')[0] || ('Jadwal ' + lastSlate)) + ' · ' + label;
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
          '<span class="meta">' + fmtOdds(a.best.odds) + ' · bayar penuh ' +
          pct(cw, 1) + ' · vig ' + pct(a.best.vig || 0, 2) + '</span>';
      } else {
        pick.innerHTML = '<span class="meta">' +
          (a && a.statsMissing ? 'ikut harga bandar' : 'tidak ada') + '</span>';
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
    [['Jadwal ini', false], ['Semua ' + DATA.fixtures.length + ' laga', true]]
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
      $('mc-head').textContent = 'Gagal menganalisa: ' + err.message; return;
    }
    var lg = a.league;
    $('mc-sub').textContent = (lg ? lg.name : '') + ' · ' + (fx.kickoff || '');

    /* --- header ------------------------------------------------------- */
    var head = $('mc-head'); head.innerHTML = '';
    var hh = el('div', 'mc-team');
    var sw1 = el('span', 'mc-swatch'); sw1.style.background = 'var(--series-home)';
    hh.appendChild(sw1); hh.appendChild(el('span', null, a.home.name));
    var lam = el('div', 'mc-lam');
    lam.innerHTML = '<div class="cap">Gol harapan</div><div class="big">' +
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
     [o.draw, 'var(--text-muted)', 'Seri'],
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
      '<span><i style="background:var(--text-muted)"></i>Seri ' + pct(o.draw, 1) + '</span>' +
      '<span><i style="background:var(--series-away)"></i>' + a.away.name + ' ' + pct(o.away, 1) + '</span>' +
      '<span><i style="background:var(--seq-400)"></i>Kedua tim cetak gol ' + pct(o.btts, 1) + '</span>';
    wrap.appendChild(leg);

    /* --- market anchor readout ---------------------------------------- */
    $('mw-val').textContent = (STATE.marketWeight * 100).toFixed(0) + '% pasar / ' +
      (100 - STATE.marketWeight * 100).toFixed(0) + '% statistik';
    var note = $('mw-note');
    var mwInput = $('mw');
    var userStats = fixtureHasUserStats(a.fixture);
    mwInput.disabled = !userStats;
    mwInput.style.opacity = userStats ? '1' : '0.4';
    if (!userStats) {
      $('mw-val').textContent = '100% pasar (terkunci)';
      var whoMissing = [];
      if (statOrigin(a.fixture.home) !== 'user') whoMissing.push(a.home.name);
      if (statOrigin(a.fixture.away) !== 'user') whoMissing.push(a.away.name);
      note.innerHTML = '<strong>Slider ini mati untuk laga ini sampai <em>kedua</em> tim Anda isi.</strong> ' +
        'Belum diisi: <span class="fig">' + whoMissing.join(' dan ') + '</span>. ' +
        'Satu tim dengan xG asli melawan satu tim dengan angka contoh bukan perbandingan, ' +
        'itu salah kaprah &mdash; jadi laga ini tetap memakai probabilitas pasar dan EV-nya ' +
        'hanyalah margin bandar. Kuncinya per laga, bukan per jadwal: mengisi satu pertandingan ' +
        'tidak akan membuka pengaruh model di pertandingan lain yang masih pakai angka contoh.';
    } else if (a.statsMissing) {
      note.innerHTML = '<strong>Statistik tim belum diisi.</strong> Model dipaksa 100% mengikuti pasar, ' +
        'jadi EV nol di mana-mana &mdash; itu jawaban yang benar, bukan kegagalan. ' +
        'Isi xG di form di bawah supaya model punya pendapat sendiri.';
    } else if (statOrigin(a.fixture.home) !== 'user' && statOrigin(a.fixture.away) !== 'user') {
      note.innerHTML = '<strong style="color:var(--critical)">Statistik laga ini masih angka contoh, ' +
        'bukan data asli.</strong> Setiap EV di bawah adalah konsekuensi dari angka yang saya karang ' +
        'agar alat bisa dijalankan. Ganti di form Input Statistik dulu.<br />Model murni: <span class="fig">' +
        a.lambdas.rawHome.toFixed(2) + ' &ndash; ' + a.lambdas.rawAway.toFixed(2) +
        '</span>, tersirat dari harga <span class="fig">' +
        (a.lambdas.impliedHome != null ? a.lambdas.impliedHome.toFixed(2) : '--') + ' &ndash; ' +
        (a.lambdas.impliedAway != null ? a.lambdas.impliedAway.toFixed(2) : '--') +
        '</span>, selisih <span class="fig">' + (a.divergence != null ? pct(a.divergence, 0) : '--') + '</span>.';
    } else {
      note.innerHTML = 'Model murni: <span class="fig">' + a.lambdas.rawHome.toFixed(2) + ' &ndash; ' +
        a.lambdas.rawAway.toFixed(2) + '</span>. Tersirat dari harga: <span class="fig">' +
        (a.lambdas.impliedHome != null ? a.lambdas.impliedHome.toFixed(2) : '--') + ' &ndash; ' +
        (a.lambdas.impliedAway != null ? a.lambdas.impliedAway.toFixed(2) : '--') +
        '</span>. Selisih <span class="fig">' + (a.divergence != null ? pct(a.divergence, 0) : '--') +
        '</span>' + (a.divergence > 0.25
          ? ' &mdash; terlalu jauh. Di atas 25% biasanya input yang salah, bukan bandar yang salah, jadi tidak ada baris yang dipromosikan ke pilihan utama.'
          : '.');
    }

    renderTilt(a);
    renderApiPanel();
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
    ['shots',   'Tembakan',         0],
    ['sot',     'Tepat sasaran',    1],
    ['bigMiss', 'Peluang terbuang', 1],
    ['xgA',     'xG dikebobolan',   1],
    ['fouls',   'Pelanggaran',      1],
    ['tackles', 'Tekel',            1],
    ['yellow',  'Kartu kuning',     1],
    ['red',     'Kartu merah',      2]
  ];

  function renderStatCompare(a) {
    var box = $('mc-stats'); box.innerHTML = '';
    var H = effStats(a.fixture.home), A = effStats(a.fixture.away);
    if (H.statsMissing || A.statsMissing) {
      var warnBox = el('div', 'notice');
      warnBox.innerHTML = '<h3>Belum ada data statistik untuk laga ini</h3>' +
        '<p>Perbandingan xG / xA / tembakan / foul / tekel / kartu butuh angka asli. ' +
        'Ambil dari WhoScored, FBref atau Understat, lalu isi di form <em>Input Statistik</em> di bawah. ' +
        'Sampai itu diisi, tabel nilai hanya mencerminkan harga bandar.</p>';
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
      ['xG per tembakan', ph.xgPerShot.toFixed(3), pa.xgPerShot.toFixed(3),
        'Kualitas peluang. Liga biasanya 0.105.'],
      ['Rasio tepat sasaran', pct(ph.sotRate, 1), pct(pa.sotRate, 1), 'Normal sekitar 33%.'],
      ['Koreksi penyelesaian', ph.finAdj.toFixed(3), pa.finAdj.toFixed(3),
        'Gol dibagi xG, diregress kuat ke 1 (prior 38 laga) dan didenda peluang terbuang.'],
      ['Keterulangan (dari xA)', ph.repeatability.toFixed(3), pa.repeatability.toFixed(3),
        'xA mendekati xG = peluang dari struktur permainan, lebih berulang.'],
      ['Intensitas bertahan', ph.defIntensity.toFixed(3), pa.defIntensity.toFixed(3),
        'Tekel menekan xG lawan, foul menambah bahaya bola mati. Dibatasi +/-12%.'],
      ['Risiko kartu merah', pct(ph.pRed, 1), pct(pa.pRed, 1),
        'Dari foul, kuning dan riwayat merah. Merah menggeser gol harapan kedua tim.'],
      ['Bobot rating (sampel)', ph.ratingWeight.toFixed(2), pa.ratingWeight.toFixed(2),
        '0 = ikut rata-rata liga, 1 = percaya penuh xG tim. Naik seiring jumlah laga.']
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
    out.textContent = t === 0
      ? 'netral \u2014 ikut harga bandar'
      : (t > 0 ? '+' : '') + (t * 100).toFixed(0) + '%  condong ke ' + side;

    /* market view versus the view after the adjustment, side by side */
    var base = E.analyseFixture(a.fixture, teamsView(), DATA.leagues,
      { marketWeight: slateHasUserStats() ? STATE.marketWeight : 1, calibration: CALIB, tilt: 0 });
    var b = base.outright, o = a.outright;

    var html = '<strong>Ini tempat pengetahuan bola Anda masuk.</strong> Model tidak tahu soal ' +
      'ganti pelatih, skuad penuh bintang, atau tim yang sedang terluka harga dirinya. ' +
      'Geser slider kalau Anda menilai satu tim lebih kuat daripada yang dihargai bandar, ' +
      'dan seluruh halaman &mdash; tiap pasar, EV, sampai pembangun parlay &mdash; ikut berubah.';
    if (t !== 0) {
      html += '<br /><span class="fig">Pasar:</span> ' + a.home.name + ' ' + pct(b.home, 0) +
        ' / seri ' + pct(b.draw, 0) + ' / ' + a.away.name + ' ' + pct(b.away, 0) +
        ' &nbsp;&rarr;&nbsp; <span class="fig">Setelah penilaian Anda:</span> ' +
        a.home.name + ' ' + pct(o.home, 0) + ' / seri ' + pct(o.draw, 0) + ' / ' +
        a.away.name + ' ' + pct(o.away, 0) +
        '<br />Gol harapan ' + base.lambdas.home.toFixed(2) + '\u2013' + base.lambdas.away.toFixed(2) +
        ' &rarr; <span class="fig">' + a.lambdas.home.toFixed(2) + '\u2013' + a.lambdas.away.toFixed(2) +
        '</span>. Tabel di bawah sekarang diurutkan menurut EV, karena Anda sudah memberi model ' +
        'informasi yang tidak ada di harga.';
    } else {
      html += '<br />Selama nol, EV di bawah hanyalah margin bandar dan tabel diurutkan menurut bayar-penuh.';
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
  var API_PRESETS = {
    sportmonks: {
      label: 'Sportmonks v3',
      url: 'https://api.sportmonks.com/v3/football/teams/{ID}?api_token={TOKEN}&include=statistics.details.type',
      search: 'https://api.sportmonks.com/v3/football/teams/search/{NAME}?api_token={TOKEN}',
      bulk: 'https://api.sportmonks.com/v3/football/teams/search/{NAME}?api_token={TOKEN}&include=statistics.details.type',
      hint: 'URL ini sama persis dengan yang muncul di API Playground Sportmonks. ' +
            'Tombol "Ambil semua" hanya bekerja kalau penyedia mengizinkan panggilan dari halaman web; ' +
            'Sportmonks tidak, jadi pakai kotak tempel massal di atas.'
    },
    custom: {
      label: 'URL sendiri',
      url: '', search: '', bulk: '',
      hint: 'Tempel URL lengkap apa pun. Tulis {TOKEN} di tempat kunci API, {ID} di tempat id tim, ' +
            'dan {NAME} di URL pencarian kalau penyedia Anda punya.'
    }
  };

  /* Free API plans are usually metered per hour, and a slate of eighteen
     fixtures is thirty-six teams - up to seventy-two calls once id lookups
     are counted. Pace the requests, cache every id that resolves, and skip
     teams that already carry entered statistics, so a second run costs
     almost nothing. */
  var API_DELAY_MS = 350;

  function apiResolveId(teamKey, token, searchUrl) {
    STATE.api.ids = STATE.api.ids || {};
    var cached = STATE.api.ids[teamKey];
    if (cached) return Promise.resolve(cached);
    if (!searchUrl) return Promise.reject(new Error('URL pencarian kosong'));
    var name = team(teamKey).name;
    var url = searchUrl.replace(/\{TOKEN\}/g, encodeURIComponent(token))
                       .replace(/\{NAME\}/g, encodeURIComponent(name));
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var list = (j && j.data) || [];
        if (!Array.isArray(list) || !list.length) throw new Error('tidak ditemukan');
        /* Prefer an exact name match before the first result: a search for
           "Lens" should not silently settle for "Lens B". */
        var exact = list.filter(function (t) {
          return t && t.name && t.name.toLowerCase() === name.toLowerCase();
        })[0];
        var pick = exact || list[0];
        if (!pick || pick.id == null) throw new Error('tanpa id');
        STATE.api.ids[teamKey] = String(pick.id);
        saveApi();
        return String(pick.id);
      });
  }

  function apiFetchTeam(teamKey, token, url, id) {
    var full = url.replace(/\{TOKEN\}/g, encodeURIComponent(token))
                  .replace(/\{ID\}/g, encodeURIComponent(id));
    return fetch(full, { headers: { Accept: 'application/json' } })
      .then(function (r) {
        return r.text().then(function (t) {
          if (!r.ok) throw new Error('HTTP ' + r.status + ' \u2014 ' + t.slice(0, 120));
          return t;
        });
      })
      .then(function (text) {
        var parsed = E.parseTeamStats(text);
        if (!parsed || parsed.error) throw new Error((parsed && parsed.error) || 'tak terbaca');
        if (parsed._missing && parsed._missing.length > 5) {
          var err = new Error('field statistik terlalu sedikit');
          err.raw = text;
          throw err;
        }
        STATE.overrides[teamKey] = STATE.overrides[teamKey] || {};
        ['matches','goals','xgF','xgA','xA','shots','sot','bigMiss','fouls','tackles','yellow','red']
          .forEach(function (f) { if (parsed[f] != null) STATE.overrides[teamKey][f] = parsed[f]; });
        saveOverrides();
        return parsed;
      });
  }

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
      out.innerHTML = '<div class="notice bad"><h3>Tim-nya tidak terbaca dari halaman ini</h3>' +
        '<p>Yang tertempel bukan JSON, jadi saya coba baca sebagai halaman statistik &mdash; ' +
        'tapi tidak ada nama tim yang saya kenal di dalamnya. Pastikan seluruh halaman tersalin ' +
        '(Ctrl+A lalu Ctrl+C), termasuk judul di bagian atas.</p></div>';
      return;
    }
    var known = (STATE.overrides[key] && STATE.overrides[key].matches) ||
                (DATA.teams[key] && DATA.teams[key].matches);
    var parsed = null;
    try { parsed = E.parseTeamStats(text, { matchesFallback: known }); } catch (e) {}
    if (!parsed || parsed.error || !parsed.matches) {
      out.innerHTML = '<div class="notice bad"><h3>Halaman ' + team(key).name +
        ' terbaca, tapi jumlah laganya tidak</h3><p>' +
        ((parsed && parsed.error) || 'Jumlah laga tidak ketemu.') + '</p>' +
        (parsed && parsed.sample
          ? '<p class="stat-note">Yang saya baca dari tempelan itu: <code>' +
            parsed.sample.replace(/</g, '&lt;') + '</code></p>'
          : '') + '</div>';
      return;
    }
    STATE.overrides[key] = STATE.overrides[key] || {};
    ['matches','goals','xgF','xgA','xA','shots','sot','bigMiss','fouls','tackles','yellow','red']
      .forEach(function (f) { if (parsed[f] != null) STATE.overrides[key][f] = parsed[f]; });
    saveOverrides();

    var miss = parsed._missing || [];
    var html = '<div class="notice ok"><h3>' + team(key).name + ' terisi dari halaman statistik</h3>' +
      '<p>' + parsed.matches + ' laga' +
      (parsed._matchesFromCaller ? ' (angka ini dari kotak, bukan dari halaman)' : '') + '. xG ' + (parsed.xgF != null ? parsed.xgF : '?') +
      ', xGA ' + (parsed.xgA != null ? parsed.xgA : '?') + ' per laga.' +
      (miss.length ? ' Tidak ada di halaman itu: ' + miss.join(', ') + '.' : ' Semua field terisi.') +
      '</p>' +
      (parsed.matches < 4
        ? '<p class="stat-note" style="color:var(--warn)">Baru ' + parsed.matches +
          ' laga &mdash; terlalu sedikit untuk dipercaya sendirian. Model akan tetap ' +
          'condong ke harga pasar sampai angkanya bertambah.</p>'
        : '') +
      '</div>';
    renderAll();
    var fresh = $('api-bulk-out');
    if (fresh) fresh.innerHTML = html; else out.innerHTML = html;
  }

  function applyBulkPaste(text, out) {
    var trimmed = String(text).trim();
    var looksJson = trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[';
    if (!looksJson) { applyPastedPage(trimmed, out); return; }

    var parsed;
    try { parsed = E.parseManyTeams(trimmed); } catch (e) { parsed = null; }
    if (!parsed) { applyPastedPage(trimmed, out); return; }
    if (parsed.error) {
      out.innerHTML = '<div class="notice bad"><h3>JSON terbaca, tapi tidak ada statistik di dalamnya</h3>' +
        '<p>' + parsed.error + ' Paling sering karena <code>include=statistics.details.type</code> ' +
        'hilang dari URL, atau liga itu di luar paket Anda sehingga yang kembali hanya nama tim.</p></div>';
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
      '<h3>' + parsed.teams.length + ' tim ada di tempelan, ' + filled.length + ' terpakai</h3>' +
      '<p>' + ready.length + ' dari ' + slateFixtures(STATE.slate).length +
      ' laga di jadwal ini sekarang dinilai oleh model, bukan oleh harga bandar.' +
      (stillMissing.length
        ? ' Masih kosong: <strong>' + stillMissing.map(function (k) { return team(k).name; }).join(', ') +
          '</strong> &mdash; tempel respons lain untuk mengisinya.'
        : ' Semua tim di jadwal ini sudah terisi.') +
      '</p>' +
      (skipped.length ? '<p class="stat-note">Tidak ditimpa karena sudah Anda isi sendiri: ' +
        skipped.join(', ') + '.</p>' : '') +
      '</div>';

    if (filled.length) {
      html += '<div style="max-height:240px;overflow:auto;font-family:var(--mono);font-size:11px;' +
        'background:var(--surface-3);padding:9px;border-radius:4px;margin-top:8px">' +
        filled.map(function (r) {
          return r.name + ' &larr; ' + r.api + ' &nbsp; ' + r.stats.matches + ' laga, xG ' +
            (r.stats.xgF != null ? r.stats.xgF : '?') + ', xGA ' +
            (r.stats.xgA != null ? r.stats.xgA : '?') +
            (r.missing && r.missing.length ? ' &nbsp; <span style="color:var(--warn)">hilang: ' +
              r.missing.join(', ') + '</span>' : '');
        }).join('<br>') + '</div>';
    } else {
      html += '<div class="notice"><h3>Tidak ada nama yang cocok</h3>' +
        '<p>Nama tim di respons: ' + parsed.teams.slice(0, 25).map(function (t) {
          return t.name;
        }).join(', ') + (parsed.teams.length > 25 ? ', …' : '') + '. ' +
        'Tidak satu pun cocok dengan tim di jadwal. Kalau menurut Anda seharusnya cocok, ' +
        'kirim daftar itu ke Claude supaya pencocokan namanya diperbaiki.</p></div>';
    }

    /* renderAll rebuilds this panel, so render first and re-attach after. */
    renderAll();
    var fresh = $('api-bulk-out');
    if (fresh) fresh.innerHTML = html;
    else out.innerHTML = html;
  }

  function renderBulkPaste(host, presetKey) {
    var wrap = el('div', 'notice');
    wrap.style.marginTop = '10px';
    wrap.innerHTML = '<h3>Cara cepat: buka satu URL, salin, tempel sekali</h3>' +
      '<p>Browser tidak boleh memanggil Sportmonks langsung dari halaman ini &mdash; itu aturan ' +
      '<strong>CORS</strong>, bukan soal token atau kuota, dan hasilnya selalu pesan ' +
      '<em>Failed to fetch</em>. Membuka URL yang sama di tab baru tidak kena aturan itu. ' +
      'Jadi: klik tautan di bawah, <strong>Ctrl+A lalu Ctrl+C</strong> di tab yang terbuka, ' +
      'kembali ke sini, tempel. Satu respons bisa berisi banyak tim, dan tempelan berikutnya ' +
      'menambah &mdash; tidak menghapus yang sudah masuk.</p>';
    host.appendChild(wrap);

    var bulkWrap = el('div', 'field');
    var bl = el('label', null, 'URL massal (pakai {TOKEN}, dan {NAME} kalau perlu nama tim)');
    bl.setAttribute('for', 'api-bulk');
    var bulkIn = el('input');
    bulkIn.id = 'api-bulk';
    if (!STATE.api.bulk) {
      STATE.api.bulk = API_PRESETS[presetKey].bulk || '';
      saveApi();
    }
    bulkIn.value = STATE.api.bulk;
    bulkIn.style.fontSize = '12px';
    bulkWrap.appendChild(bl); bulkWrap.appendChild(bulkIn);
    host.appendChild(bulkWrap);

    var linkRow = el('div', 'btn-row');
    var nameIn = el('input');
    nameIn.placeholder = 'nama tim untuk {NAME}';
    nameIn.style.cssText = 'width:190px;padding:6px 8px;border:1px solid var(--border-strong);' +
      'border-radius:4px;background:var(--surface-1);color:var(--text-primary);font-size:12px';
    /* A real <a href> would put the whole URL - token and all - in the
       browser's status bar the moment the pointer touches it, and into any
       screenshot taken while it is there. A button that opens the tab from
       script shows nothing: the address is only ever assembled at click. */
    var openLink = el('button', 'btn sm', 'Buka URL di tab baru');
    openLink.type = 'button';
    var linkNote = el('span');
    linkNote.style.cssText = 'font-size:12px;color:var(--text-muted)';

    function bulkTarget() {
      var token = (($('api-token') && $('api-token').value) || STATE.api.token || '').trim();
      var url = (bulkIn.value || '').trim();
      if (!token || !url) return null;
      return url.replace(/\{TOKEN\}/g, encodeURIComponent(token))
                .replace(/\{NAME\}/g, encodeURIComponent((nameIn.value || '').trim()));
    }

    function refreshLink() {
      var token = (($('api-token') && $('api-token').value) || STATE.api.token || '').trim();
      var url = (bulkIn.value || '').trim();
      var ready = !!(token && url);
      openLink.disabled = !ready;
      openLink.style.opacity = ready ? '1' : '0.45';
      linkNote.textContent = !token ? 'Isi token dulu.'
        : !url ? 'Isi URL massal dulu.'
        : 'Tab yang terbuka memuat token di bilah alamat \u2014 jangan di-screenshot.';
    }

    openLink.addEventListener('click', function () {
      var target = bulkTarget();
      if (!target) return;
      window.open(target, '_blank', 'noopener,noreferrer');
    });
    bulkIn.addEventListener('input', function () { STATE.api.bulk = bulkIn.value.trim(); saveApi(); refreshLink(); });
    nameIn.addEventListener('input', refreshLink);
    var tokenNode = $('api-token');
    if (tokenNode) tokenNode.addEventListener('input', refreshLink);
    refreshLink();

    linkRow.appendChild(nameIn);
    linkRow.appendChild(openLink);
    linkRow.appendChild(linkNote);
    host.appendChild(linkRow);

    var ta = el('textarea');
    ta.id = 'api-bulk-text';
    ta.rows = 5;
    ta.placeholder = 'Tempel di sini: respons JSON dari API, ATAU seluruh halaman statistik '
      + '(UEFA / FBref / Understat). Keduanya diterima \u2014 tekan tombol di bawah.';
    ta.style.cssText = 'width:100%;margin-top:9px;padding:8px;border:1px solid var(--border-strong);' +
      'border-radius:4px;background:var(--surface-1);color:var(--text-primary);' +
      'font-family:var(--mono);font-size:11px;min-width:0';
    host.appendChild(ta);

    var applyRow = el('div', 'btn-row');
    var applyBtn = el('button', 'btn', 'Isi dari tempelan ini');
    applyBtn.type = 'button';
    applyBtn.addEventListener('click', function () {
      var out = $('api-bulk-out');
      var text = (ta.value || '').trim();
      if (!text) {
        out.innerHTML = '<p class="stat-note" style="color:var(--critical)">Kotaknya masih kosong.</p>';
        return;
      }
      applyBulkPaste(text, out);
    });
    applyRow.appendChild(applyBtn);
    host.appendChild(applyRow);

    var bulkOut = el('div');
    bulkOut.id = 'api-bulk-out';
    bulkOut.style.marginTop = '10px';
    host.appendChild(bulkOut);
  }

  var API_ABORT = false;

  function apiFetchAll(btn) {
    var out = $('api-out');
    var tokenEl = $('api-token'), urlEl = $('api-url'), searchEl = $('api-search');
    var token = ((tokenEl && tokenEl.value) || '').trim();
    var url = ((urlEl && urlEl.value) || '').trim();
    var searchUrl = ((searchEl && searchEl.value) || '').trim();
    if (!token || !url) {
      out.innerHTML = '<p class="stat-note" style="color:var(--critical)">Token atau URL belum diisi.</p>';
      return;
    }

    var keys = {};
    slateFixtures(STATE.slate).forEach(function (f) { keys[f.home] = 1; keys[f.away] = 1; });
    var list = Object.keys(keys).filter(function (k) { return statOrigin(k) !== 'user'; });
    if (!list.length) {
      out.innerHTML = '<div class="notice ok"><h3>Semua tim di jadwal ini sudah punya data Anda</h3>' +
        '<p>Tidak ada yang perlu diambil. Pakai "Kembalikan nilai awal" di satu laga kalau ingin mengambil ulang.</p></div>';
      return;
    }

    API_ABORT = false;
    btn.disabled = true;
    var stop = el('button', 'btn sm ghost', 'Hentikan');
    stop.type = 'button';
    stop.addEventListener('click', function () { API_ABORT = true; });

    var log = el('div');
    log.style.cssText = 'max-height:240px;overflow:auto;font-family:var(--mono);font-size:11px;' +
      'background:var(--surface-3);padding:9px;border-radius:4px;margin-top:8px';
    out.innerHTML = '';
    var head = el('div', 'notice');
    head.innerHTML = '<h3>Mengambil ' + list.length + ' tim</h3>' +
      '<p>Setiap tim butuh dua panggilan: cari id, lalu ambil statistik. Jeda ' + API_DELAY_MS +
      'ms supaya kuota paket gratis tidak langsung habis. Tim yang sudah Anda isi dilewati.</p>';
    out.appendChild(head);
    out.appendChild(stop);
    out.appendChild(log);

    var ok = 0, fail = 0, rawSample = null, corsHit = false;
    function line(text, color) {
      var d = el('div', null, text);
      if (color) d.style.color = color;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
    }

    function step(i) {
      if (API_ABORT || i >= list.length) {
        btn.disabled = false;
        stop.remove();
        var summary = el('div', 'notice ' + (fail ? '' : 'ok'));
        summary.innerHTML = '<h3>' + (API_ABORT ? 'Dihentikan' : 'Selesai') + ': ' + ok +
          ' berhasil, ' + fail + ' gagal</h3>' +
          (corsHit && !ok
            ? '<p><strong>Ini CORS, bukan token dan bukan kuota.</strong> "Failed to fetch" berarti ' +
              'browser menolak membaca jawaban sebelum kode ini sempat melihatnya, karena penyedia ' +
              'tidak mengirim izin lintas-domain. Token Anda tidak terpakai, jadi kuota tidak berkurang. ' +
              'Pakai kotak <strong>tempel massal</strong> di atas: buka URL-nya di tab baru, salin, tempel sekali.</p>'
            : '') +
          (rawSample
            ? '<p>Ada respons yang tidak bisa dipetakan. Contohnya di bawah &mdash; salin dan kirim ke Claude ' +
              'supaya pemetaannya ditulis untuk bentuk ini.</p><pre style="max-height:200px;overflow:auto;' +
              'font-size:11px;white-space:pre-wrap">' + rawSample.slice(0, 2000).replace(/</g, '&lt;') + '</pre>'
            : '<p>Laga yang KEDUA timnya berhasil terisi sekarang memakai model, bukan lagi harga bandar.</p>');
        /* renderAll rebuilds the API panel, which would wipe this summary
           along with it. Render first, then re-attach to the fresh node. */
        renderAll();
        var fresh = $('api-out');
        if (fresh) { fresh.innerHTML = ''; fresh.appendChild(summary); }
        return;
      }
      var key = list[i];
      var name = team(key).name;
      line('[' + (i + 1) + '/' + list.length + '] ' + name + ' \u2026');
      apiResolveId(key, token, searchUrl)
        .then(function (id) { return apiFetchTeam(key, token, url, id); })
        .then(function (parsed) {
          ok++;
          line('    ok \u2014 ' + parsed.matches + ' laga, xG ' +
            (parsed.xgF != null ? parsed.xgF : '?') + ', xGA ' +
            (parsed.xgA != null ? parsed.xgA : '?'), 'var(--good)');
        })
        .catch(function (err) {
          fail++;
          if (err && err.raw && !rawSample) rawSample = err.raw;
          var msg = String((err && err.message) || err);
          if (/failed to fetch|networkerror|load failed/i.test(msg)) corsHit = true;
          line('    gagal \u2014 ' + msg, 'var(--critical)');
        })
        .then(function () { setTimeout(function () { step(i + 1); }, API_DELAY_MS); });
    }
    step(0);
  }

  function renderApiPanel() {
    var host = $('api-panel');
    if (!host) return;
    host.innerHTML = '';

    var warn = el('div', 'notice bad');
    warn.innerHTML = '<h3>Token API tidak pernah masuk ke repo</h3>' +
      '<p>Halaman ini disajikan GitHub Pages, jadi apa pun yang ada di kode sumbernya bisa dibaca siapa saja. ' +
      'Token yang Anda ketik di sini disimpan di <strong>localStorage browser ini saja</strong>, tidak pernah ' +
      'dikirim ke mana pun kecuali ke penyedia API-nya sendiri, dan tidak pernah ikut ter-commit.</p>' +
      '<p><strong>Kalau token Anda pernah terlihat orang lain &mdash; di chat, screenshot, atau layar yang dibagikan &mdash; ' +
      'hapus dan buat baru di halaman API Tokens penyedia Anda sebelum memakainya di sini.</strong></p>';
    host.appendChild(warn);

    var grid = el('div', 'form-grid');
    function field(id, label, value, type) {
      var f = el('div', 'field');
      var l = el('label', null, label); l.setAttribute('for', id);
      var i = el('input');
      i.id = id; i.type = type || 'text'; i.value = value || '';
      f.appendChild(l); f.appendChild(i);
      grid.appendChild(f);
      return i;
    }
    var presetKey = STATE.api.preset || 'sportmonks';

    var fp = el('div', 'field');
    var lp = el('label', null, 'Penyedia'); lp.setAttribute('for', 'api-preset');
    var sel = el('select'); sel.id = 'api-preset';
    Object.keys(API_PRESETS).forEach(function (k) {
      var o = el('option', null, API_PRESETS[k].label);
      o.value = k; if (k === presetKey) o.selected = true;
      sel.appendChild(o);
    });
    fp.appendChild(lp); fp.appendChild(sel);
    grid.appendChild(fp);

    var tokenIn = field('api-token', 'Token API', STATE.api.token, 'password');
    host.appendChild(grid);

    var urlWrap = el('div', 'field');
    urlWrap.style.marginTop = '9px';
    var ul = el('label', null, 'URL permintaan'); ul.setAttribute('for', 'api-url');
    var urlIn = el('input');
    urlIn.id = 'api-url';
    /* Show AND store the preset default. Rendering it into the field without
       committing it to state meant the button reported "URL belum diisi"
       while a URL was plainly visible above it. */
    if (!STATE.api.url) { STATE.api.url = API_PRESETS[presetKey].url; saveApi(); }
    urlIn.value = STATE.api.url;
    urlIn.style.fontSize = '12px';
    urlWrap.appendChild(ul); urlWrap.appendChild(urlIn);
    host.appendChild(urlWrap);

    var searchWrap = el('div', 'field');
    searchWrap.style.marginTop = '9px';
    var sl = el('label', null, 'URL pencarian id tim (pakai {NAME})');
    sl.setAttribute('for', 'api-search');
    var searchIn = el('input');
    searchIn.id = 'api-search';
    if (!STATE.api.search) {
      STATE.api.search = API_PRESETS[presetKey].search || '';
      saveApi();
    }
    searchIn.value = STATE.api.search;
    searchIn.style.fontSize = '12px';
    searchWrap.appendChild(sl); searchWrap.appendChild(searchIn);
    host.appendChild(searchWrap);
    searchIn.addEventListener('change', function () { STATE.api.search = searchIn.value.trim(); saveApi(); });

    var hint = el('p', 'stat-note', API_PRESETS[presetKey].hint);
    host.appendChild(hint);

    renderBulkPaste(host, presetKey);

    var slateKeys = {};
    slateFixtures(STATE.slate).forEach(function (f) { slateKeys[f.home] = 1; slateKeys[f.away] = 1; });
    var pending = Object.keys(slateKeys).filter(function (k) { return statOrigin(k) !== 'user'; });
    var allRow = el('div', 'btn-row');
    var allBtn = el('btn', 'btn');
    allBtn = el('button', 'btn', 'Ambil SEMUA \u2014 ' + pending.length + ' tim di jadwal ini');
    allBtn.type = 'button';
    allBtn.disabled = !pending.length;
    allBtn.addEventListener('click', function () { apiFetchAll(allBtn); });
    allRow.appendChild(allBtn);
    var allNote = el('span');
    allNote.style.cssText = 'font-size:12px;color:var(--text-muted)';
    allNote.textContent = pending.length
      ? 'Cari id + ambil statistik, otomatis, satu per satu dengan jeda.'
      : 'Semua tim di jadwal ini sudah punya data Anda.';
    allRow.appendChild(allNote);
    host.appendChild(allRow);

    sel.addEventListener('change', function () {
      STATE.api.preset = sel.value;
      STATE.api.url = API_PRESETS[sel.value].url;
      STATE.api.search = API_PRESETS[sel.value].search || '';
      STATE.api.bulk = API_PRESETS[sel.value].bulk || '';
      saveApi(); renderApiPanel();
    });
    tokenIn.addEventListener('change', function () { STATE.api.token = tokenIn.value.trim(); saveApi(); });
    urlIn.addEventListener('change', function () { STATE.api.url = urlIn.value.trim(); saveApi(); });

    var fx = currentFixture();
    if (!fx) return;
    var row = el('div', 'btn-row');
    [fx.home, fx.away].forEach(function (key) {
      var idField = el('input');
      idField.placeholder = 'id tim ' + team(key).name;
      idField.value = (STATE.api.ids && STATE.api.ids[key]) || '';
      idField.style.cssText = 'width:130px;padding:6px 8px;border:1px solid var(--border-strong);' +
        'border-radius:4px;background:var(--surface-1);color:var(--text-primary);' +
        'font-family:var(--mono);font-size:12px';
      idField.addEventListener('change', function () {
        STATE.api.ids = STATE.api.ids || {};
        STATE.api.ids[key] = idField.value.trim();
        saveApi();
      });
      var btn = el('button', 'btn sm', 'Ambil ' + team(key).name);
      btn.type = 'button';
      btn.addEventListener('click', function () { apiFetch(key, idField.value.trim(), btn); });
      row.appendChild(idField); row.appendChild(btn);
    });
    host.appendChild(row);
    var out = el('div'); out.id = 'api-out'; out.style.marginTop = '10px';
    host.appendChild(out);
  }

  function saveApi() {
    try { localStorage.setItem('mb-api', JSON.stringify(STATE.api)); } catch (err) {}
  }

  function apiFetch(teamKey, id, btn) {
    var out = $('api-out');
    var tokenEl = $('api-token'), urlEl = $('api-url');
    var token = ((tokenEl && tokenEl.value) || STATE.api.token || '').trim();
    var url = ((urlEl && urlEl.value) || STATE.api.url || '').trim();
    if (!token) { out.innerHTML = '<p class="stat-note" style="color:var(--critical)">Token belum diisi.</p>'; return; }
    if (!url) { out.innerHTML = '<p class="stat-note" style="color:var(--critical)">URL belum diisi.</p>'; return; }
    var full = url.replace(/\{TOKEN\}/g, encodeURIComponent(token))
                  .replace(/\{ID\}/g, encodeURIComponent(id || ''));
    btn.disabled = true;
    var label = btn.textContent;
    btn.textContent = 'Mengambil...';
    out.innerHTML = '<p class="stat-note">Memanggil penyedia dari browser Anda...</p>';

    fetch(full, { headers: { 'Accept': 'application/json' } })
      .then(function (r) {
        return r.text().then(function (t) { return { ok: r.ok, status: r.status, text: t }; });
      })
      .then(function (res) {
        var parsed = null;
        try { parsed = E.parseTeamStats(res.text); } catch (e) {}
        if (!res.ok) {
          out.innerHTML = '<div class="notice bad"><h3>Penyedia menolak: HTTP ' + res.status + '</h3>' +
            '<p>Paling sering: token salah, atau liga ini tidak termasuk paket gratis Anda. ' +
            'Respons mentahnya di bawah &mdash; kirim ke Claude kalau perlu dibaca.</p></div>' +
            '<pre style="max-height:180px;overflow:auto;background:var(--surface-3);padding:9px;' +
            'border-radius:4px;font-size:11px;white-space:pre-wrap">' +
            res.text.slice(0, 1500).replace(/</g, '&lt;') + '</pre>';
          return;
        }
        if (parsed && !parsed.error && parsed._missing && parsed._missing.length < 6) {
          STATE.overrides[teamKey] = STATE.overrides[teamKey] || {};
          ['matches','goals','xgF','xgA','xA','shots','sot','bigMiss','fouls','tackles','yellow','red']
            .forEach(function (f) { if (parsed[f] != null) STATE.overrides[teamKey][f] = parsed[f]; });
          saveOverrides();
          out.innerHTML = '<div class="notice ok"><h3>' + team(teamKey).name + ' terisi dari API</h3>' +
            '<p>' + parsed.matches + ' pertandingan. ' +
            (parsed._missing.length ? 'Tidak ditemukan: ' + parsed._missing.join(', ') + '.' : 'Semua field terisi.') +
            '</p></div>';
          renderAll();
        } else {
          out.innerHTML = '<div class="notice"><h3>Respons masuk, tapi belum bisa dipetakan</h3>' +
            '<p>' + ((parsed && parsed.error) || 'Field statistik yang dikenali terlalu sedikit.') +
            ' Salin JSON di bawah dan kirim ke Claude &mdash; pemetaannya akan ditulis persis untuk bentuk ini.</p></div>' +
            '<pre style="max-height:220px;overflow:auto;background:var(--surface-3);padding:9px;' +
            'border-radius:4px;font-size:11px;white-space:pre-wrap">' +
            res.text.slice(0, 2500).replace(/</g, '&lt;') + '</pre>';
        }
      })
      .catch(function (err) {
        out.innerHTML = '<div class="notice bad"><h3>Panggilan gagal</h3>' +
          '<p>' + String(err.message || err) + '</p>' +
          '<p>Kalau pesannya soal CORS, penyedia itu memang tidak mengizinkan panggilan langsung dari ' +
          'halaman web. Jalan keluarnya: buka URL-nya di tab baru, salin JSON-nya, lalu tempel di kotak ' +
          '<em>Input Statistik</em> di bawah &mdash; hasilnya sama persis.</p></div>';
      })
      .then(function () { btn.disabled = false; btn.textContent = label; });
  }

  /* ------------------------------------------------- BT cross-check ----- */
  function renderCross(a) {
    var host = $('mc-cross');
    if (!host) return;
    host.innerHTML = '';
    var c = a.cross;
    if (!c) {
      var p0 = el('p', 'stat-note');
      p0.innerHTML = 'Pemeriksaan silang Bradley-Terry butuh xG asli pada <strong>kedua</strong> tim. ' +
        'Belum tersedia untuk laga ini.';
      host.appendChild(p0);
      return;
    }
    var rows = [
      ['Dixon-Coles (model utama)', c.dc, 'Dari matriks skor: memperhitungkan jumlah gol, jadi bisa menilai handicap dan total.'],
      ['Bradley-Terry (pembanding)', c.bt, 'S_tuan / (S_tuan + S_tandang), rumus dari catatan Smartodds. Hanya bicara soal siapa menang.'],
      ['Pasar, margin dibuang', c.market, 'Harga 1X2 yang di-devig, dinormalkan ke hasil menang/kalah saja.']
    ];
    var t = el('table', 'mb');
    var html = '<thead><tr><th>Sumber</th><th style="text-align:right">P(tuan rumah menang | ada yang menang)</th><th>Keterangan</th></tr></thead><tbody>';
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
    var head = c.agree === true ? 'Dua keluarga model sepakat melawan pasar'
             : c.agree === false ? 'Dua model saling bertentangan'
             : 'Tidak ada harga 1X2 untuk dibandingkan';
    var body = c.agree === true
      ? 'Dixon-Coles dan Bradley-Terry memiringkan ke arah yang sama dibanding pasar. Dua model dengan asumsi berbeda yang setuju adalah bukti lebih kuat daripada satu model saja.'
      : c.agree === false
      ? 'Keduanya tidak sepakat arah. Kalau begini, edge yang muncul lebih mungkin berasal dari kesalahan model daripada dari kesalahan bandar. Keyakinan diturunkan.'
      : 'Laga ini tidak punya harga 1X2 lengkap di papan, jadi tidak ada patokan pasar untuk dibandingkan.';
    verdict.innerHTML = '<h3>' + head + '</h3><p>' + body + '</p>' +
      '<p>Selisih antar model: <span class="fig">' + (c.spread * 100).toFixed(1) + ' poin persen</span>. ' +
      'Kekuatan terkalibrasi: ' + a.home.name + ' <span class="fig">' + c.strengthHome.toFixed(1) +
      '</span>, ' + a.away.name + ' <span class="fig">' + c.strengthAway.toFixed(1) + '</span> ' +
      '(rating mentah ' + c.ratingHome.toFixed(1) + ' / ' + c.ratingAway.toFixed(1) +
      ', offset terpasang ' + c.offset.toFixed(1) + ').</p>';
    if (c.advisoryOnly) {
      verdict.innerHTML += '<p><strong>Hanya informasi, tidak mengubah keyakinan.</strong> Offset ini ' +
        'dicocokkan dari ' + (CALIB ? CALIB.n : 0) + ' pertandingan' +
        (CALIB && CALIB.rmse != null ? ' dengan rmse ' + CALIB.rmse.toFixed(3) : '') +
        '. Satu offset dari segelintir laga bukan kalibrasi, itu kebetulan &mdash; jadi pembanding ini ' +
        'ditampilkan tapi tidak diizinkan menggeser angka keyakinan. Isi statistik lebih banyak laga ' +
        'supaya bisa dipakai.';
    }
    host.appendChild(verdict);

    var note = el('p', 'stat-note');
    note.innerHTML = '<strong>Soal offset:</strong> dalam model rasio, titik nol skala rating ' +
      'menentukan seberapa lebar sebaran probabilitas. Catatan Smartodds memakai ' +
      '<code>S = R &minus; 1350</code> pada poin FIFA karena tanpa pengurangan itu ' +
      '<code>1850/(1850+1600) = 0.54</code> &mdash; semua laga terlihat imbang. Alat ini tidak menebak ' +
      'angka offsetnya: offset dicocokkan dengan kuadrat terkecil ke harga pasar yang sudah dibuang marginnya.';
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
    svg.setAttribute('aria-label', 'Peta panas probabilitas skor akhir');

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
              '<div class="t-row">1 dari ' + Math.round(1 / p2) + ' pertandingan</div>';
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
    cap.innerHTML = 'Baris = gol ' + a.home.name + ', kolom = gol ' + a.away.name +
      '. Warna makin gelap = makin sering. Angka dalam persen di sel yang paling mungkin.';
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
    svg.setAttribute('aria-label', 'Probabilitas jumlah total gol');

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
        return '<div class="t-title">' + i + ' gol</div>' +
          '<div class="t-row">Tepat: ' + pct(p, 2) + '</div>' +
          '<div class="t-row">' + i + ' gol atau kurang: ' + pct(cum, 1) + '</div>' +
          '<div class="t-row">Lebih dari ' + i + ': ' + pct(1 - cum, 1) + '</div>';
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
    cap.textContent = 'Rata-rata total gol menurut model: ' + exp.toFixed(2) +
      '. Sumbu bawah = jumlah gol dalam satu pertandingan.';
    box.appendChild(cap);
  }

  /* ===================================================== VALUE TABLE ==== */
  var TIER_LABEL = { prime: 'UTAMA', value: 'NILAI', neutral: 'NETRAL',
                     avoid: 'HINDARI', suspect: 'CURIGA' };
  var KIND_LABEL = { ah: 'Handicap', ou: 'Atas/Bawah', x12: '1X2', oe: 'Ganjil/Genap' };

  function renderValueTable(a) {
    var box = $('mc-value'); box.innerHTML = '';
    var tb = el('table', 'mb');
    tb.innerHTML = '<thead><tr>' +
      '<th style="width:26px"></th><th>Pilihan</th><th>Pasar</th><th>Garis</th>' +
      '<th style="text-align:right">Odds</th><th style="text-align:right">Odds adil</th>' +
      '<th style="text-align:right" title="Peluang hasil apa pun yang bukan kalah, termasuk seri dan setengah-menang">Prob. model</th>' +
      '<th style="text-align:right" title="Peluang leg ini membayar ODDS PENUH. Seri tidak dihitung, setengah-menang dihitung separuh. INI yang dipakai untuk memilih leg parlay.">Bayar penuh</th>' +
      '<th style="text-align:right">Vig</th>' +
      '<th style="text-align:right">EV</th><th>Keyakinan</th><th>Mix</th>' +
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
        ring.title = 'Pilihan terbaik model untuk laga ini';
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
        b.textContent = p.lineType === 'quarter' ? 'kuartal' : p.lineType === 'half' ? 'setengah' : 'bulat';
        b.title = p.lineType === 'quarter'
          ? 'Garis kuartal: stake dipecah dua. Bisa setengah menang / setengah kalah - inilah yang memotong pembayaran parlay.'
          : p.lineType === 'whole' ? 'Garis bulat: bisa seri (stake kembali).'
          : 'Garis setengah: menang atau kalah penuh, tanpa pemotongan.';
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
        cclean.title = 'Turun ' + (gap * 100).toFixed(1) + ' poin dari probabilitas mentah: ' +
          pct(p.pushRisk, 1) + ' berakhir seri' +
          (p.halfRisk > 0.001 ? ' dan ' + pct(p.halfRisk, 1) + ' setengah-hasil' : '') +
          '. Di parlay, leg seri mengalikan tiket dengan 1.0, jadi odds leg ini hangus.';
      }
      tr.appendChild(cclean);

      tr.appendChild(el('td', 'num', p.vig != null ? pct(p.vig, 2) : '—'));

      var cev = el('td', 'num ev', signPct(p.ev, 2));
      if (p.ev > 0.015) cev.style.color = 'var(--good)';
      else if (byEff) {
        cev.style.color = 'var(--text-muted)';
        cev.title = 'Tanpa statistik Anda, model dipasang pada harga ini juga, ' +
          'jadi EV di sini hanyalah margin bandar dengan tanda minus. Bukan penilaian ' +
          'bahwa taruhannya buruk - itu ongkos yang sama yang berlaku di semua baris.';
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
      cmix.innerHTML = ok ? '<span style="color:var(--good);font-weight:700">ada</span>'
                          : '<span style="color:var(--critical)" title="Odds di bawah 1.50 biasanya dibuang dari menu Mix Parlay">dibuang</span>';
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
        '<strong>Tabel ini diurutkan menurut BAYAR PENUH, bukan EV.</strong> ' +
        'Statistik tim belum Anda isi, jadi model dipasang pada harga bandar ini juga &mdash; ' +
        'artinya kolom EV di sini <em>selalu</em> negatif dan besarnya persis margin bandar. ' +
        'Itu bukan vonis bahwa semua taruhan buruk; itu ongkos yang sama untuk semua baris. ' +
        'Yang masih bisa dibandingkan: berapa sering leg membayar odds penuh, dan berapa margin yang dibayar.' +
        '<br /><span class="tier-dot prime"></span><strong>Biru muda + dilingkari</strong> = leg terbaik di laga ini ' +
        'yang benar-benar ada di menu Mix Parlay (odds di atas 1.50): bayar-penuh tertinggi setelah dipotong margin. ' +
        '&nbsp;&middot;&nbsp; <span class="tier-dot avoid"></span>merah = bocor lebih dari 8 poin ke seri/setengah-hasil, ' +
        'atau margin di atas 9%. &nbsp;&middot;&nbsp; <span class="tier-dot neutral"></span>sisanya setara.' +
        '<br /><strong>Isi xG di form di bawah</strong> dan tabel ini otomatis berganti mengurut menurut EV, ' +
        'karena saat itu model punya pendapat sendiri untuk dibandingkan dengan bandar.';
    } else legend.innerHTML =
      '<strong>Arti warna:</strong> ' +
      '<span class="tier-dot prime"></span>biru muda = EV di atas +4% dan keyakinan di atas 58 (dilingkari = terbaik di laga ini) &nbsp;&middot;&nbsp; ' +
      '<span class="tier-dot value"></span>kuning = EV di atas +1.5% &nbsp;&middot;&nbsp; ' +
      '<span class="tier-dot neutral"></span>netral &nbsp;&middot;&nbsp; ' +
      '<span class="tier-dot suspect"></span>oranye = EV terlihat bagus tapi model terlalu jauh dari pasar, jadi tidak dipercaya &nbsp;&middot;&nbsp; ' +
      '<span class="tier-dot avoid"></span>merah = EV di bawah -4%.' +
      '<br /><strong>Vig</strong> = margin bandar di pasangan harga itu; ini biaya yang pasti Anda bayar, ' +
      'berbeda dari EV yang cuma perkiraan. <strong>Kelly/4</strong> = ukuran stake konservatif.';
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
      h.appendChild(el('span', null, t.name + (t.statsMissing ? '  (belum ada data)' : '')));
      box.appendChild(h);

      var grid = el('div', 'form-grid');
      var fields = [
        ['matches', 'Laga dimainkan', 1],
        ['xgF', 'xG dibuat', 0.01], ['xgA', 'xG dikebobolan', 0.01],
        ['xA', 'xA (assist harapan)', 0.01], ['goals', 'Gol dibuat', 0.01],
        ['shots', 'Tembakan', 0.1], ['sot', 'Tepat sasaran', 0.1],
        ['bigMiss', 'Peluang terbuang', 0.1], ['fouls', 'Pelanggaran', 0.1],
        ['tackles', 'Tekel', 0.1], ['yellow', 'Kartu kuning', 0.1],
        ['red', 'Kartu merah', 0.01]
      ];
      fields.forEach(function (f) {
        var fd = el('div', 'field');
        var id = 'sf-' + key + '-' + f[0];
        var lb = el('label', null, f[1]); lb.setAttribute('for', id);
        var inp = el('input');
        inp.id = id; inp.type = 'number'; inp.step = String(f[2]); inp.min = '0';
        inp.value = t[f[0]] == null ? '' : t[f[0]];
        inp.placeholder = '—';
        inp.addEventListener('change', function () {
          STATE.overrides[key] = STATE.overrides[key] || {};
          var v = inp.value === '' ? null : parseFloat(inp.value);
          STATE.overrides[key][f[0]] = v;
          saveOverrides();
          renderAll();
        });
        fd.appendChild(lb); fd.appendChild(inp);
        grid.appendChild(fd);
      });
      box.appendChild(grid);
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
      lb.textContent = 'Tempel halaman statistik ' + team(key).name + ' (UEFA / FBref / Understat)';
      var ta = el('textarea');
      ta.rows = 3;
      ta.placeholder = 'Blok seluruh halaman statistik, Ctrl+C, tempel di sini lalu tekan Impor.';
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
      var imp = el('button', 'btn sm', 'Impor untuk ' + team(key).name);
      imp.type = 'button';
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
           back to whatever is typed in this team's "laga dimainkan" box. */
        var mEl = $('sf-' + key + '-matches');
        var parsed;
        try { parsed = E.parseTeamStats(ta.value, { matchesFallback: mEl && mEl.value }); }
        catch (err) { parsed = { error: err.message }; }
        if (!parsed) { msg.textContent = 'Tidak ada teks untuk dibaca.'; return; }
        if (parsed.error) {
          STATE.importMsg[key] = {
            color: 'var(--critical)',
            html: parsed.error +
              (parsed.sample
                ? '<br><span style="color:var(--text-muted)">Yang saya baca dari tempelan itu: ' +
                  '<code>' + parsed.sample.replace(/</g, '&lt;') + '</code></span>'
                : '')
          };
          msg.style.color = STATE.importMsg[key].color;
          msg.innerHTML = STATE.importMsg[key].html;
          return;
        }
        STATE.overrides[key] = STATE.overrides[key] || {};
        ['matches','goals','xgF','xgA','xA','shots','sot','bigMiss','fouls','tackles','yellow','red']
          .forEach(function (f) {
            if (parsed[f] != null) STATE.overrides[key][f] = parsed[f];
          });
        STATE.overrides[key]._xgEstimated = !!(parsed._estimated && parsed._estimated.xgF);
        saveOverrides();
        msg.style.color = 'var(--good)';
        var miss = parsed._missing.length
          ? ' Tidak ditemukan: ' + parsed._missing.join(', ') + ' \u2014 isi tangan kalau ada.'
          : '';
        /* A competition page early in the season can report a single match.
           One match is a coin toss dressed as a statistic, so say so where
           the number lands rather than letting it look like evidence. */
        var thin = parsed.matches < 4
          ? ' <strong>Baru ' + parsed.matches + ' laga</strong> \u2014 terlalu sedikit untuk ' +
            'dipercaya sendirian; model tetap condong ke harga pasar.'
          : '';
        delete STATE.paste[key];
        STATE.importMsg[key] = {
          color: 'var(--good)',
          html: 'Terisi dari ' + parsed.matches + ' pertandingan' +
            (parsed._matchesFromCaller ? ' (angka laga dari kotak, bukan dari halaman)' : '') + '.' +
            (parsed._estimated.xgF
              ? ' <strong>xG DIPERKIRAKAN</strong> dari profil tembakan, bukan xG asli \u2014 UEFA tidak menerbitkannya.'
              : '') + thin + miss
        };
        msg.style.color = STATE.importMsg[key].color;
        msg.innerHTML = STATE.importMsg[key].html;
        renderAll();
      });
      btnRow.appendChild(imp); btnRow.appendChild(msg);
      wrap.appendChild(lb); wrap.appendChild(ta); wrap.appendChild(btnRow);
      box.appendChild(wrap);
    });

    var row = el('div', 'btn-row');
    var reset = el('button', 'btn ghost', 'Kembalikan nilai awal');
    reset.type = 'button';
    reset.addEventListener('click', function () {
      delete STATE.overrides[a.fixture.home];
      delete STATE.overrides[a.fixture.away];
      delete STATE.importMsg[a.fixture.home];
      delete STATE.importMsg[a.fixture.away];
      saveOverrides();
      renderAll();
    });
    row.appendChild(reset);
    var hint = el('span');
    hint.style.cssText = 'font-size:12px;color:var(--text-muted)';
    hint.textContent = 'Semua angka adalah rata-rata PER PERTANDINGAN, bukan total musim.';
    row.appendChild(hint);
    box.appendChild(row);
  }

  /* ========================================================== PARLAY ==== */
  function addLeg(pick, analysis) {
    if (STATE.legs.some(function (l) { return l.pick.id === pick.id; })) return;
    if (STATE.legs.some(function (l) { return l.pick.fixtureId === pick.fixtureId; })) {
      if (!window.confirm('Sudah ada leg dari pertandingan ini. Dua leg dari satu laga saling ' +
        'berkaitan, jadi harga parlay jadi tidak valid. Tetap tambahkan?')) return;
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
        '<p>Tidak ada cukup leg yang membayar odds penuh ' + pct(STATE.relaxedFrom.asked, 0) +
        ' dari waktu, jadi saya turunkan sampai tiket terisi. Garis Asia yang seimbang memang ' +
        'duduk di sekitar 50&ndash;56% bayar penuh &mdash; itu memang tujuan bandar menyusun garisnya. ' +
        'Leg di bawah ini nyata dan bisa dipasang; yang berubah hanya seberapa tinggi ambang ' +
        'yang bisa dipenuhi pasar ini.</p>';
      list.appendChild(rl);
    }
    $('p-count').textContent = STATE.legs.length
      ? STATE.legs.length + ' leg dipilih' +
        (E.pickParlayLegs.lastBlocked ? ' · ' + E.pickParlayLegs.lastBlocked +
          ' pilihan dibuang karena odds di bawah 1.50 (tidak ada di menu Mix Parlay)' : '')
      : '';

    if (!STATE.legs.length) {
      var empty = el('div', 'panel-body');
      var bar = parseFloat($('p-minprob').value) || 0.5;
      var blocked = E.pickParlayLegs.lastBlocked || 0;
      empty.innerHTML =
        '<div class="notice bad" style="margin:0"><h3>Tidak ada satu pun leg yang memenuhi syarat</h3>' +
        '<p>Anda meminta leg yang membayar <strong>odds penuh</strong> minimal <span class="fig">' +
        pct(bar, 0) + '</span> dari waktu. Di jadwal ini tidak ada yang mencapainya' +
        (blocked ? ', dan ' + blocked + ' pilihan lain sudah dibuang lebih dulu karena odds di bawah 1.50 ' +
          '(tidak muncul di menu Mix Parlay)' : '') + '.</p>' +
        '<p>Itu jawaban yang benar, bukan kegagalan alat. Pasar yang likuid memang tidak menjual ' +
        'leg murah yang menang 55% dari waktu &mdash; kalau ada, bandar sudah memperbaiki harganya. ' +
        'Turunkan ambang ke sekitar <span class="fig">0.50&ndash;0.52</span> dan lihat berapa harga ' +
        'sebenarnya, atau pilih jadwal lain.</p>' +
        '<p><strong>Catatan:</strong> ambang ini mengukur peluang <em>bayar penuh</em>, bukan ' +
        'probabilitas mentah. Garis bulat sering terlihat berprobabilitas 56% padahal cuma 32% ' +
        'bayar penuh, karena sisanya seri &mdash; dan leg seri mengalikan tiket dengan 1.0.</p></div>';
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
          ? 'Nilai harapan terbaik di tiket ini'
          : 'Leg paling efisien di tiket ini: probabilitas tertinggi per satuan margin yang dibayar, tanpa garis kuartal';
        row.appendChild(ring);
      } else {
        row.appendChild(el('span', 'leg-num', String(i + 1)));
      }
      var main = el('div', 'leg-main');
      main.innerHTML = '<strong>' + p.label + '</strong><span>' +
        a.home.name + ' v ' + a.away.name + ' · ' + (a.fixture.kickoff || '') +
        ' · ' + KIND_LABEL[p.kind] + (p.half === '1h' ? ' BB1' : '') +
        (p.lineType === 'quarter' ? ' · <span style="color:var(--serious);font-weight:700">garis kuartal</span>' : '') +
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
      rm.type = 'button'; rm.title = 'Hapus leg';
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
    kpi('Odds tercetak', sim.printedOdds.toFixed(3),
      'Bayaran kalau semua leg menang penuh: ' + rupiah(stake * sim.printedOdds));
    kpi('Harapan cair', sim.expectedReturn.toFixed(4) + 'x',
      'Rata-rata jangka panjang: ' + rupiah(stake * sim.expectedReturn) + ' dari ' + rupiah(stake),
      sim.expectedReturn >= 1 ? 'good' : 'bad');
    kpi('Nilai harapan', signPct(sim.ev, 1),
      sim.ev < 0 ? 'Rugi harapan ' + rupiah(stake * -sim.ev) + ' setiap kali dipasang'
                 : 'Untung harapan ' + rupiah(stake * sim.ev),
      sim.ev >= 0 ? 'good' : 'bad');
    kpi('Peluang untung', pct(sim.pProfit, 2),
      'Semua leg menang penuh: ' + pct(sim.pAllWin, 3) + ' · hasil tengah ' + sim.median.toFixed(2) + 'x');
    if (sim.quarterLegs) {
      kpi('Leg garis kuartal', String(sim.quarterLegs),
        'Inilah yang memotong slip Anda dari 73x jadi 6.07x. Ganti ke garis setengah kalau ada.',
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
        fake.innerHTML = '<div class="cap">EV ini milik Anda, bukan bukti</div>' +
          '<div class="val">' + signPct(sim.ev, 1) + '</div>' +
          '<div class="note">Angka positif ini datang dari penilaian Anda sendiri di ' +
          tiltedLegs + ' laga, bukan dari data. Alat ini cuma menghitung konsekuensi ' +
          'pendapat Anda secara konsisten &mdash; ia tidak memverifikasinya. Kalau bacaan Anda ' +
          'tepat, tiket ini memang lebih baik daripada versi pasar. Kalau meleset, tiket ini ' +
          'lebih buruk, dan seluruh EV di atas ikut meleset sebesar kesalahan itu. ' +
          'Geser slider ke nol untuk melihat harga bandar apa adanya.</div>';
      } else {
        fake.innerHTML = '<div class="cap">EV positif ini tidak nyata</div>' +
          '<div class="val bad">' + signPct(sim.ev, 1) + '</div>' +
          '<div class="note">Tidak ada satu pun statistik di jadwal ini yang Anda isi sendiri ' +
          'dan tidak ada penilaian yang Anda masukkan, jadi angka positif ini keluar dari data ' +
          'contoh bawaan. Bandar tidak menawarkan edge sebesar ini kepada siapa pun.</div>';
      }
      kpis.appendChild(fake);
    }

    var why = el('div', 'kpi');
    why.innerHTML = '<div class="cap">Arti stabilo biru muda</div>' +
      '<div class="note">' + (hasEV
        ? 'Anda sudah mengisi statistik untuk jadwal ini, jadi baris yang distabilo adalah yang nilai harapannya positif, dan yang <strong>dilingkari</strong> adalah EV tertinggi.'
        : 'Statistik tim belum Anda isi, jadi tidak ada EV yang layak dikejar. Yang <strong>dilingkari</strong> adalah leg dengan peluang <strong>bayar penuh</strong> tertinggi setelah dipotong margin bandar &mdash; bukan probabilitas mentah. Bedanya besar: garis bulat bisa berprobabilitas 56% tapi cuma 32% bayar penuh karena sisanya seri, dan leg seri mengalikan tiket dengan 1.0. Aturan ini datang dari dua kupon nyata Anda: garis setengah mengembalikan 100% odds tercetak, bulat 88%, kuartal 64%.') +
      '</div>';
    kpis.appendChild(why);

    /* ladder: how ticket length changes the economics */
    var tb = el('table', 'mb');
    tb.innerHTML = '<thead><tr><th>Panjang tiket</th><th style="text-align:right">Odds tercetak</th>' +
      '<th style="text-align:right">Harapan cair</th><th style="text-align:right">EV</th>' +
      '<th style="text-align:right">Peluang untung</th><th style="text-align:right">Rugi harapan / ' +
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
    var lh = el('h4', null, 'Panjang tiket vs harapan hasil (leg yang sama, dipotong dari atas)');
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
      box.innerHTML = '<h3>Aritmetika perkalian &mdash; metode dari catatan Smartodds yang Anda kirim</h3>' +
        '<p>Rata-rata probabilitas per leg: <span class="fig">' + pct(ca.avgLegProb, 1) + '</span>. ' +
        'Peluang seluruh tiket tembus: <span class="fig">' + pct(ca.pOptimal, 3) +
        '</span> = 1 dari <span class="fig">' + Math.round(ca.oneIn).toLocaleString('id-ID') + '</span>.</p>' +
        '<p>Kalau leg dipilih acak (50% per leg): <span class="fig">' + pct(ca.pRandom, 3) +
        '</span> = 1 dari ' + Math.round(1 / ca.pRandom).toLocaleString('id-ID') + '. ' +
        'Jadi memilih dengan cermat memberi perbaikan <span class="fig">' +
        ca.improvementFactor.toFixed(2) + 'x</span>.</p>' +
        '<p><strong>Ini inti artikel itu.</strong> Coles menghitung strategi optimal untuk Opta Million ' +
        '26.000x lebih baik daripada acak, dan hasilnya tetap 3,6&times;10<sup>-12</sup> &mdash; ' +
        'karena kedua angka dipangkatkan jumlah prediksi. Persis sama di sini: memilih leg yang lebih baik ' +
        'mengalikan peluang <span class="fig">' + ca.improvementFactor.toFixed(2) + 'x</span>, ' +
        'sedangkan menambah leg membaginya <span class="fig">' +
        Math.round(1 / Math.pow(ca.avgLegProb, ca.legs)).toLocaleString('id-ID') +
        'x</span>. Perbaikan pilihan tidak bisa mengejar jumlah leg.</p>' +
        (ca.legsForOneIn20
          ? '<p><strong>Angka yang paling berguna:</strong> dengan kualitas leg segini, tiket masih ' +
            'punya peluang lebih baik dari 1-dari-20 sampai <span class="fig">' + ca.legsForOneIn20 +
            ' leg</span>. Tiket ' + ca.legs + ' leg Anda ada di 1-dari-' +
            Math.round(ca.oneIn).toLocaleString('id-ID') + '.</p>'
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
    tb.innerHTML = '<thead><tr><th>#</th><th>Pertandingan</th><th>Pilihan</th>' +
      '<th style="text-align:right">Odds</th><th>Skor</th><th>Hasil</th>' +
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

    $('slip-sub').textContent = 'ID ' + 9 + ' leg · rekonstruksi dari aturan settlement Asia';
    var note = $('slip-note'); note.innerHTML = '';
    var n1 = el('div', 'notice ok');
    n1.innerHTML = '<h3>Engine cocok dengan slip asli Anda, sampai ke rupiah</h3>' +
      '<p>Odds tercetak <span class="fig">' + vs.ticketOdds + '</span>, seharusnya bayar bruto ' +
      '<span class="fig">' + rupiah(vs.ticketOdds * vs.stake) + '</span> dari stake ' +
      rupiah(vs.stake) + '.</p>' +
      '<p>Hasil sebenarnya: <span class="fig">' + mult.toFixed(4) + 'x</span> = bruto ' +
      '<span class="fig">' + rupiah(gross) + '</span>, laba bersih <span class="fig">' +
      rupiah(net) + '</span> &mdash; sama dengan kolom Menang/Kalah di slip Anda (' +
      rupiah(vs.payout) + ').</p>' +
      '<p>Jadi Anda menerima <span class="fig">' + pct(gross / (vs.ticketOdds * vs.stake), 1) +
      '</span> dari potensi yang tercetak. Penyebabnya tiga leg garis kuartal: dua ' +
      '<em>half lose</em> (Bournemouth +0.75, Over 2.25) dan satu <em>half won</em> ' +
      '(Fiorentina BB1 Under 1.25). Dua half-lose itu saja mengalikan tiket dengan 0.5 &times; 0.5 = 0.25.</p>' +
      '<p><strong>Itulah kenapa alat ini menolak garis kuartal secara bawaan</strong>, dan kenapa ' +
      'kolom "garis" di Papan Nilai menandai tiap baris kuartal, setengah atau bulat.</p>';
    note.appendChild(n1);
  }


  /* ------------------------------------------------ calibration ledger -- */
  var OUTCOME_LABEL = { win: 'Menang', halfWin: 'Setengah menang', push: 'Seri (kembali)',
                        halfLose: 'Setengah kalah', lose: 'Kalah' };

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
      box.innerHTML = '<h3>Skor Brier atas ' + rep.n + ' leg yang punya probabilitas model</h3>' +
        '<p>Brier model <span class="fig">' + rep.brier.toFixed(4) + '</span> ' +
        'melawan <span class="fig">' + rep.brierBaseline.toFixed(4) + '</span> untuk model yang ' +
        'selalu menjawab 50%. Makin kecil makin baik, jadi skill score <span class="fig">' +
        (rep.skill * 100).toFixed(1) + '%</span>.</p>' +
        '<p><strong>' + (rep.significant
          ? 'Sampel sudah cukup untuk mulai dipercaya.'
          : 'Ini BUKAN bukti. ' + rep.n + ' leg terlalu sedikit &mdash; butuh 50 ke atas sebelum angka ini berarti apa pun.') +
        '</strong> Dan ada masalah kedua yang lebih serius: kupon di buku ini dipilih ' +
        'berdasarkan hasilnya. Satu kupon menang, satu kalah. Leg di kupon yang menang ' +
        'otomatis hampir semuanya mendarat, jadi kolom "kenyataan" di tabel bawah pasti ' +
        'terlihat lebih tinggi daripada kolom "klaim". Itu bias seleksi, bukan model yang bagus. ' +
        'Supaya angkanya jujur, kupon harus dicatat SEBELUM pertandingan, menang atau kalah.</p>';
      sum.appendChild(box);

      var tb = el('table', 'mb');
      var html = '<thead><tr><th>Bucket probabilitas</th><th style="text-align:right">Leg</th>' +
        '<th style="text-align:right">Rata-rata klaim model</th>' +
        '<th style="text-align:right">Rata-rata kenyataan</th><th>Selisih</th></tr></thead><tbody>';
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
        '<span class="sub">' + g.wins + ' menang, ' + g.halves + ' setengah, ' +
        (pushes ? pushes + ' seri, ' : '') + g.losses + ' kalah' +
        (g.grossMultiple != null ? ' \u00b7 pengali tiket ' + g.grossMultiple.toFixed(4) + 'x' : '') +
        (g.brier != null ? ' \u00b7 Brier ' + g.brier.toFixed(4) : '') + '</span>';
      panel.appendChild(head);

      var tb = el('table', 'mb');
      var html = '<thead><tr><th style="width:26px">#</th><th>Pertandingan</th><th>Pilihan</th>' +
        '<th style="text-align:right">Odds</th><th>Skor</th><th>Hasil</th>' +
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
          verdict = 'dipilih \u00b7 bayar penuh ' + pct(l.cleanWinAtPrediction, 1);
          vcolor = 'var(--hl-edge)';
        } else if (r.pick) {
          if (r.pick.ev <= -0.04) { verdict = 'HINDARI'; vcolor = 'var(--critical)'; }
          else if (r.pick.ev >= 0.015) { verdict = 'NILAI'; vcolor = 'var(--good)'; }
          else { verdict = 'netral'; vcolor = 'var(--text-secondary)'; }
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
                  'title="Skor babak pertama - leg ini diselesaikan dari sini" ' +
                  'style="width:62px;padding:2px 4px;font-family:var(--mono);font-size:12px;' +
                  'border:1px solid var(--border-strong);border-radius:3px;background:var(--surface-1);' +
                  'color:var(--text-primary)" />'
                : '') + '</td>'
            : '<td class="num"' + (l.scoreNote ? ' title="' + l.scoreNote.replace(/"/g, '&quot;') + '"' : '') + '>' +
            (l.score || '\u2014') +
            (l.score1h ? ' <span style="color:var(--text-muted)">(BB1 ' + l.score1h + ')</span>' : '') +
            (r.outcomeMismatch ? ' <span style="color:var(--critical)" title="Hasil yang dicatat bertentangan dengan skor. Engine memakai skor.">&#9888;</span>' : '') +
            '</td>') +
          '<td style="font-weight:600;color:' +
            (r.outcome === 'win' ? 'var(--good)' : lost ? 'var(--critical)'
             : r.outcome === 'push' ? 'var(--text-secondary)' : 'var(--warning)') + '">' +
            (OUTCOME_LABEL[r.outcome] || (pending ? 'belum main' : '?')) + '</td>' +
          '<td class="num"' + (l.pModelAtPrediction != null
              ? ' title="Dibekukan pada ' + (g.coupon.registeredAt || 'saat prediksi') +
                ', sebelum pertandingan. Tidak dihitung ulang."' : '') + '>' +
            (l.pModelAtPrediction != null ? pct(l.pModelAtPrediction, 1)
             : r.pModel != null ? pct(r.pModel, 1) : '\u2014') + '</td>' +
          '<td class="num"' +
            (l.vigAtPrediction != null
              ? ' style="color:var(--text-muted)" title="Ini margin bandar, bukan vonis. Tanpa statistik yang Anda isi, model dipasang pada harga ini juga, jadi EV tiap leg = minus marginnya."'
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
      ah2.innerHTML = 'Alternatif yang seharusnya diambil, dinilai dari skor nyata' +
        '<span class="sub">Harga yang ditawarkan tidak bisa dipulihkan, jadi kolom odds adalah ODDS ADIL MENURUT MODEL</span>';
      ap.appendChild(ah2);
      var tb2 = el('table', 'mb');
      var h2 = '<thead><tr><th>Pertandingan</th><th>Alternatif</th><th>Skor</th><th>Hasil</th>' +
        '<th style="text-align:right">Prob. model</th><th style="text-align:right">Odds adil model</th>' +
        '<th>Catatan</th></tr></thead><tbody>';
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
      warn2.innerHTML = '<p class="stat-note"><strong>Kolom odds adil bukan harga yang ditawarkan bandar.</strong> ' +
        'Papan Pasar Awal tidak diarsipkan di mana pun yang bisa saya baca, dan catatan Anda sudah hilang, ' +
        'jadi harga aslinya tidak bisa dipulihkan. Yang di kolom itu adalah nilai wajar menurut model &mdash; ' +
        'jawaban untuk "seharusnya berapa", bukan "ditawarkan berapa". Dan model itu berjalan di atas ' +
        'statistik contoh, bukan xG asli, jadi anggap ilustratif.</p>';
      ap.appendChild(warn2);
      host.appendChild(ap);
    }
  }

  /* ======================================================= METHODOLOGY == */
  function renderMethod() {
    var box = $('method'); box.innerHTML = '';
    var items = [
      ['1. Rating serang &amp; bertahan dari xG',
       'Rasio xG tim terhadap rata-rata liga. Kedua rating dikalikan untuk kedua tim, jadi ' +
       'derau ikut berlipat; karena itu tiap rating diregress ke rata-rata liga dengan prior ' +
       '4 laga (<code>RATING_PRIOR</code>). Tanpa ini, Milan vs Lecce keluar 3.00-0.48 &mdash; mustahil.'],
      ['2. Peleburan profil tembakan',
       'Tembakan, tepat sasaran dan xG per tembakan. Volume tembakan hanya dipangkatkan 0.35 ' +
       'karena hasilnya menurun; tim dengan banyak tembakan bernilai rendah tidak boleh ' +
       'terlihat bagus hanya karena volume.'],
      ['3. Penyelesaian &amp; peluang terbuang',
       'Gol dibagi xG, diregress dengan prior 38 laga: kemampuan menyelesaikan peluang hampir ' +
       'tidak bertahan dari musim ke musim, jadi jangan dipercaya. Peluang terbuang di atas ' +
       'normal liga dikenai denda kecil.'],
      ['4. xA sebagai ukuran keterulangan',
       'xA mendekati xG berarti peluang lahir dari struktur permainan, bukan dari bola mati atau ' +
       'rebound. Hanya 25% sinyal ini menggeser rata-rata; sisanya melebarkan ketidakpastian, ' +
       'karena xA memberi tahu seberapa <em>berulang</em> peluang itu, bukan seberapa banyak.'],
      ['5. Tekel &amp; pelanggaran',
       'Tekel di atas rata-rata menekan xG lawan; pelanggaran menambah bahaya bola mati. ' +
       'Keduanya dibatasi total &plusmn;12%. Kesalahan klasik adalah melebihkan bobot statistik ini ' +
       'karena mudah dikumpulkan &mdash; dibanding xG, keduanya prediktor lemah.'],
      ['6. Kartu kuning, merah dan disiplin',
       'Risiko kartu merah diperkirakan dari pelanggaran, kartu kuning dan riwayat merah. ' +
       'Kartu merah rata-rata terjadi sekitar menit 65, jadi efeknya ditimbang sisa waktu: ' +
       'gol harapan tim sendiri turun, lawan naik.'],
      ['7. Matriks skor Dixon-Coles',
       'Poisson bivariat dengan koreksi <code>&tau;(&rho;)</code> untuk skor rendah, karena Poisson ' +
       'independen terlalu jarang memprediksi 0-0 dan 1-1. Babak pertama difit langsung dari ' +
       'harga babak pertama kalau ada, bukan sekadar menskala penuh waktu.'],
      ['8. Jangkar pasar',
       'Harga penutupan adalah prediktor sepak bola terkuat yang ada. Model yang tidak setuju ' +
       'dengan pasar sebesar 40% hampir selalu salah soal inputnya sendiri, bukan benar soal ' +
       'pasar. Jadi &lambda; model digeser ke &lambda; yang tersirat dari harga; slider di Pusat ' +
       'Pertandingan mengatur seberapa jauh. Selisih di atas 25% otomatis menggugurkan status ' +
       'pilihan utama dan baris ditandai CURIGA.'],
      ['9. Penyelesaian garis Asia',
       'Satu fungsi menangani semua jenis garis: garis kuartal dipecah ke dua garis tetangga dan ' +
       'dirata-rata, persis seperti bandar menghitungnya. Hasil tiap skor masuk ke lima keranjang ' +
       '(menang, setengah menang, seri, setengah kalah, kalah), yang kemudian dipakai simulasi parlay.'],
      ['10. Nilai harapan, odds adil, Kelly',
       'Dari keranjang itu: <code>w</code> = bagian stake yang menang, <code>l</code> = yang kalah. ' +
       'Odds adil = <code>1 + l/w</code>. EV = <code>w &times; (odds-1) - l</code>. Ukuran stake ' +
       'ditampilkan sebagai Kelly seperempat, bukan Kelly penuh.'],
      ['11. Kenapa menu Mix Parlay berbeda',
       'Bandar membuang leg yang paling mungkin salah harga ke arah pemain &mdash; terutama favorit ' +
       'berharga pendek &mdash; dengan menetapkan odds minimum per leg (sekitar 1.50). Itu sebabnya ' +
       '1X2 favorit berat hilang dari menu parlay dan yang tersisa cuma pilihan serba nanggung. ' +
       'Alat ini memakai batas yang sama, jadi yang diusulkan selalu benar-benar bisa dipasang.'],
      ['12. Yang alat ini TIDAK bisa lakukan',
       'Tidak bisa membuat parlay 9 leg jadi menguntungkan. Margin bandar berlipat sekali per leg; ' +
       'pada margin 4% per leg, 9 leg sudah menahan sekitar 69% stake sebelum bola ditendang. ' +
       'Yang bisa diukur: berapa besar biayanya, leg mana paling murah, dan berapa banyak yang ' +
       'hilang ke garis kuartal.']
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
      ? '<h3>Sedang hidup: seluruh 12 langkah, di ' + liveFixtures + ' laga</h3>' +
        '<p>' + fedCount + ' dari ' + totalTeams + ' tim sudah punya statistik Anda. ' +
        'Di laga yang KEDUA timnya terisi, langkah 1&ndash;6 benar-benar berjalan. ' +
        'Di laga lain, langkah 1&ndash;6 tetap menganggur dan angkanya masih datang dari harga bandar.</p>'
      : '<h3>Yang sedang hidup sekarang: langkah 7 sampai 12 saja</h3>' +
        '<p><strong>Langkah 1&ndash;6 menganggur.</strong> Semuanya butuh statistik tim, dan belum ada ' +
        'satu laga pun yang kedua timnya terisi. Jadi tidak ada xG, tembakan, tekel atau kartu ' +
        'yang dipakai &mdash; walau tulisannya ada di bawah.</p>' +
        '<p>Yang dipakai: rata-rata gol dibongkar dari <strong>harga bandar sendiri</strong> ' +
        '(langkah 8), lalu diubah jadi sebaran skor (langkah 7) dan diselesaikan per jenis garis ' +
        '(langkah 9&ndash;10). Artinya <strong>probabilitas yang Anda lihat adalah harga bandar ' +
        'setelah margin dibuang</strong>, bukan tebakan model yang berdiri sendiri.</p>' +
        '<p>Itu tetap berguna &mdash; langkah 9 sampai 12 yang mengukur jenis garis, margin dan ' +
        'biaya panjang tiket. Tapi jangan bayangkan ada xG di baliknya, karena tidak ada.</p>';
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
      '<br /><strong>Statistik tim:</strong> ' + DATA.meta.statSource;
    box.appendChild(src);
  }

  /* ============================================================ CHROME == */
  /* Slate keys are insertion order, not calendar order, so sorting by key
     put 24-27 Sept to the right of 10-13 Okt. The fixtures cannot settle it
     either: `kickoff` holds "21:00" in one slate, "19/09 19:30" in another
     and "10/10" in a third. So each slate carries its own start date, and
     the label is parsed only as a fallback for a slate added without one. */
  var ID_MONTHS = { jan:1, feb:2, mar:3, apr:4, mei:5, jun:6, jul:7, agu:8,
                    sep:9, okt:10, nov:11, des:12 };
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
      /* The stored name carries its own explanation - "(Pasar Awal, setelah
         international break)" - which is useful as a tooltip and far too
         long for a chip on a phone. Keep the date, drop the aside. */
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
    applyAdminMode();
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
  var ADMIN_KEY = 'mb-admin';

  function adminOn() {
    try {
      var q = new RegExp('[?&]admin=([^&]*)').exec(location.search);
      if (q) {
        var want = q[1] !== '0' && q[1] !== 'false';
        localStorage.setItem(ADMIN_KEY, want ? '1' : '0');
        return want;
      }
      return localStorage.getItem(ADMIN_KEY) === '1';
    } catch (err) {
      return /[?&]admin=1/.test(location.search);
    }
  }

  function applyAdminMode() {
    var on = adminOn();
    ['api-section', 'stat-section'].forEach(function (id) {
      var n = $(id);
      if (n) n.hidden = !on;
    });
    return on;
  }

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
      DATA.fixtures.length + ' laga';

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

    /* Judgements are work: losing them on a refresh would make the control
       not worth using. Browser storage can be unavailable or throw, so every
       read and write is guarded and the page renders fine without it. */
    try {
      var ap = localStorage.getItem('mb-api');
      if (ap) {
        var parsedAp = JSON.parse(ap);
        if (parsedAp && typeof parsedAp === 'object') {
          STATE.api = { preset: parsedAp.preset || 'sportmonks', token: parsedAp.token || '',
                        url: parsedAp.url || '', search: parsedAp.search || '',
                        bulk: parsedAp.bulk || '', ids: parsedAp.ids || {} };
        }
      }
    } catch (err) {}

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
        '</p><p>Kalau file dibuka langsung lewat <code>file://</code>, browser memblokir ' +
        'pembacaan JSON. Jalankan server lokal: <code>python3 -m http.server</code> lalu buka ' +
        '<code>http://localhost:8000/moneyball.html</code>.</p></div>';
    });
})();
