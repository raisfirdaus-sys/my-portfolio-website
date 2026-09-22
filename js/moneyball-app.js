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
    legs: [], overrides: {}
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
    var userFilled = ov && ['xgF', 'xgA', 'xA', 'goals', 'shots'].some(function (f) {
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
  function analyse(fx) {
    return E.analyseFixture(fx, teamsView(), DATA.leagues, {
      marketWeight: STATE.marketWeight,
      calibration: CALIB
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
    var fxs = slateFixtures(STATE.slate);
    var an = [];
    fxs.forEach(function (f) { try { an.push(analyse(f)); } catch (err) {} });
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
  function renderFixtures() {
    var list = $('fx-list'); list.innerHTML = '';
    var fxs = slateFixtures(STATE.slate);
    $('fx-count').textContent = fxs.length + ' laga';
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
    if (a.statsMissing) {
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
      '<th style="text-align:right">Prob. model</th><th style="text-align:right">Vig</th>' +
      '<th style="text-align:right">EV</th><th>Keyakinan</th><th>Mix</th>' +
      '<th style="text-align:right">Kelly/4</th><th></th></tr></thead>';
    var body = el('tbody');
    var top = a.best;
    a.picks.forEach(function (p) {
      var tr = el('tr', 'tier-' + p.tier);
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
      tr.appendChild(el('td', 'num', p.vig != null ? pct(p.vig, 2) : '—'));

      var cev = el('td', 'num ev', signPct(p.ev, 2));
      if (p.ev > 0.015) cev.style.color = 'var(--good)';
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
    legend.innerHTML =
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
          renderAll();
        });
        fd.appendChild(lb); fd.appendChild(inp);
        grid.appendChild(fd);
      });
      box.appendChild(grid);
    });
    var row = el('div', 'btn-row');
    var reset = el('button', 'btn ghost', 'Kembalikan nilai awal');
    reset.type = 'button';
    reset.addEventListener('click', function () {
      delete STATE.overrides[a.fixture.home];
      delete STATE.overrides[a.fixture.away];
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
  function parlayOpts(an) {
    return {
      legs: parseInt($('p-legs').value, 10) || 9,
      allowQuarter: $('p-quarter').value === '1',
      minProb: parseFloat($('p-minprob').value) || 0.5,
      maxProb: parseFloat($('p-maxprob').value) || 0.9,
      kinds: $('p-kinds').value.split(','),
      useEV: an.some(function (a) { return !a.statsMissing; })
    };
  }
  function buildParlay() {
    var an = analysesForSlate();
    STATE.legs = E.pickParlayLegs(an, parlayOpts(an));
    renderParlay();
  }

  function renderParlay() {
    var list = $('p-legs-list'); list.innerHTML = '';
    var kpis = $('p-kpis'); kpis.innerHTML = '';
    var ladder = $('p-ladder'); ladder.innerHTML = '';
    $('p-count').textContent = STATE.legs.length
      ? STATE.legs.length + ' leg dipilih' +
        (E.pickParlayLegs.lastBlocked ? ' · ' + E.pickParlayLegs.lastBlocked +
          ' pilihan dibuang karena odds di bawah 1.50 (tidak ada di menu Mix Parlay)' : '')
      : '';

    if (!STATE.legs.length) {
      list.appendChild(el('div', 'panel-body', 'Belum ada leg. Tekan "Susun parlay", atau tambahkan sendiri dari Papan Nilai.'));
      return;
    }

    /* Which leg deserves the highlighter? With real stat input, the one with
       the best expected value. Without it, EV is zero everywhere, so the
       honest criterion is the leg that is cheapest to hold: highest
       probability per unit of margin paid, with no quarter-line drag. */
    var hasEV = STATE.legs.some(function (L) { return L.pick.ev > 0.015; });
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
    var why = el('div', 'kpi');
    why.innerHTML = '<div class="cap">Arti stabilo biru muda</div>' +
      '<div class="note">' + (hasEV
        ? 'Model punya statistik asli untuk jadwal ini, jadi baris yang distabilo adalah yang nilai harapannya positif, dan yang <strong>dilingkari</strong> adalah EV tertinggi.'
        : 'Statistik tim belum diisi, jadi tidak ada EV untuk dikejar. Yang <strong>dilingkari</strong> adalah leg termurah untuk dipegang: probabilitas tertinggi per satuan margin bandar, tanpa garis kuartal. Itu satu-satunya keunggulan yang nyata sebelum Anda isi xG.') +
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
    items.forEach(function (it) {
      var d = el('details', 'method');
      var s = el('summary'); s.innerHTML = it[0];
      var b = el('div'); b.innerHTML = it[1];
      d.appendChild(s); d.appendChild(b);
      box.appendChild(d);
    });
    var src = el('p', 'stat-note');
    src.innerHTML = '<strong>Sumber data:</strong> ' + DATA.meta.oddsSource +
      '<br /><strong>Statistik tim:</strong> ' + DATA.meta.statSource;
    box.appendChild(src);
  }

  /* ============================================================ CHROME == */
  function renderSlateChips() {
    var box = $('slate-chips'); box.innerHTML = '';
    var slates = DATA.meta.slates || {};
    Object.keys(slates).sort().forEach(function (k) {
      var n = parseInt(k, 10);
      if (!slateFixtures(n).length) return;
      var label = slates[k].split(' - ')[0];
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
    renderReality();
    renderFixtures();
    renderMatchCentre();
    renderParlay();
  }

  /* ============================================================== BOOT == */
  function boot(data) {
    DATA = data;
    var sub = $('brand-sub');
    if (sub) sub.textContent = 'Dixon-Coles · xG fusion · ' +
      DATA.fixtures.length + ' laga';

    $('odds-format').addEventListener('change', function (e) {
      STATE.format = e.target.value; renderMatchCentre(); renderParlay();
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

    // default to the newest slate that has fixtures
    var avail = Object.keys(DATA.meta.slates || {}).map(Number)
      .filter(function (n) { return slateFixtures(n).length; }).sort(function (a, b) { return b - a; });
    if (avail.length) STATE.slate = avail[0];

    renderAll();
    renderSlip();
    renderMethod();
    buildParlay();
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
