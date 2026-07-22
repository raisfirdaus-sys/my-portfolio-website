/* ==========================================================================
   Rais Firdaus — US Stock Portfolio
   Single source of truth: HOLDINGS. Everything (ticker tape, donut chart,
   growth bars, holding cards) renders from this array.
   ========================================================================== */

const HOLDINGS = [
  {
    ticker: "MU",
    name: "Micron Technology Inc",
    sector: "Semikonduktor & Memori AI",
    value: 814.59,
    changePct: 13.03,
    growth5y: 85,
    color: "#123524",
    thesis:
      "Micron ada di jantung rantai pasok chip memori (DRAM & NAND) yang jadi bahan bakar utama pusat data AI generatif. Ketika permintaan komputasi AI naik, kebutuhan memori berkapasitas tinggi ikut naik.",
    outlook:
      "Siklus upgrade infrastruktur AI, HBM (High Bandwidth Memory), dan pemulihan harga chip jadi katalis utama yang aku pantau untuk 5 tahun ke depan.",
  },
  {
    ticker: "GEV",
    name: "GE Vernova Inc.",
    sector: "Energi & Infrastruktur Grid",
    value: 661.61,
    changePct: 1.93,
    growth5y: 95,
    color: "#1a4630",
    thesis:
      "Spin-off dari General Electric ini fokus pada turbin gas, energi terbarukan, dan modernisasi jaringan listrik — persis yang dibutuhkan dunia untuk menopang lonjakan konsumsi listrik dari pusat data AI.",
    outlook:
      "Aku melihat tema 'electrification & grid buildout' sebagai salah satu megatren dekade ini, dan GEV berada di posisi strategis sebagai pemasok inti.",
  },
  {
    ticker: "MA",
    name: "Mastercard Inc",
    sector: "Pembayaran Digital",
    value: 556.49,
    changePct: 0.31,
    growth5y: 70,
    color: "#1e5238",
    thesis:
      "Model bisnis toll-booth: setiap transaksi kartu menghasilkan fee, dengan margin tinggi dan biaya modal rendah. Pertumbuhan e-commerce & cashless society jadi tailwind jangka panjang.",
    outlook:
      "Ekspansi ke pembayaran lintas negara, tokenisasi, dan negara berkembang (termasuk Indonesia) berpotensi jadi mesin pertumbuhan berikutnya.",
  },
  {
    ticker: "ABBV",
    name: "AbbVie Inc",
    sector: "Farmasi & Bioteknologi",
    value: 510.84,
    changePct: 17.16,
    growth5y: 60,
    color: "#256346",
    thesis:
      "Setelah menghadapi tantangan paten Humira, AbbVie berhasil mendiversifikasi portofolio obat imunologi (Skyrizi, Rinvoq) dan onkologi yang tumbuh agresif.",
    outlook:
      "Pipeline obat baru dan akuisisi strategis jadi fokus utama narasi pertumbuhan farmasi jangka menengah-panjang.",
  },
  {
    ticker: "V",
    name: "Visa Inc. Class A",
    sector: "Pembayaran Digital",
    value: 382.39,
    changePct: 6.94,
    growth5y: 65,
    color: "#2c7350",
    thesis:
      "Jaringan pembayaran terbesar di dunia dengan moat yang sangat lebar. Sama seperti Mastercard, Visa diuntungkan oleh pergeseran dari tunai ke digital secara global.",
    outlook:
      "Value-added services (fraud protection, data analytics) dan pertumbuhan volume transaksi digital jadi pendorong pendapatan di luar bisnis inti kartu.",
  },
  {
    ticker: "JNJ",
    name: "Johnson & Johnson",
    sector: "Kesehatan & Consumer Health",
    value: 320.23,
    changePct: 5.76,
    growth5y: 40,
    color: "#347e5c",
    thesis:
      "Perusahaan kesehatan raksasa dengan diversifikasi luas: farmasi, MedTech, hingga produk konsumen. Dividend Aristocrat yang konsisten menaikkan dividen puluhan tahun berturut-turut.",
    outlook:
      "Fokus pasca-spin-off Kenvue kini murni ke farmasi & MedTech bermargin tinggi — profil defensif yang cocok jadi penyeimbang portofolio.",
  },
  {
    ticker: "VLO",
    name: "Valero Energy Corporation",
    sector: "Energi & Pengilangan",
    value: 314.47,
    changePct: -0.42,
    growth5y: 35,
    color: "#3d8b68",
    thesis:
      "Salah satu perusahaan pengilangan minyak independen terbesar di AS. Bisnis siklikal, tapi menghasilkan arus kas besar saat margin pengilangan (crack spread) sedang tinggi.",
    outlook:
      "Aku melihat VLO sebagai lindung nilai sekaligus eksposur ke permintaan energi global yang masih akan tinggi dalam masa transisi energi.",
  },
  {
    ticker: "PG",
    name: "Procter & Gamble Company",
    sector: "Consumer Staples",
    value: 148.12,
    changePct: -2.45,
    growth5y: 30,
    color: "#49a06b",
    thesis:
      "Produsen kebutuhan rumah tangga sehari-hari (Gillette, Pampers, Tide) dengan brand power kuat dan daya tahan tinggi terhadap resesi. Dividend Aristocrat dengan rekam jejak lebih dari 60 tahun.",
    outlook:
      "Pertumbuhan stabil single-digit, tapi jadi fondasi 'defensive core' yang menjaga portofolio tetap tenang saat pasar bergejolak.",
  },
  {
    ticker: "GILD",
    name: "Gilead Sciences Inc",
    sector: "Bioteknologi & Farmasi",
    value: 129.9,
    changePct: -0.05,
    growth5y: 55,
    color: "#5cb37e",
    thesis:
      "Pemimpin pasar dalam pengobatan HIV dan terus memperluas ke onkologi. Arus kas dari waralaba HIV yang mendominasi pasar mendanai riset & akuisisi jangka panjang.",
    outlook:
      "Pipeline sel-T (cell therapy) dan pengembangan obat pencegahan HIV jangka panjang (long-acting) jadi katalis yang aku ikuti.",
  },
  {
    ticker: "MNST",
    name: "Monster Beverage Corp",
    sector: "Consumer Beverage",
    value: 89.24,
    changePct: -4.12,
    growth5y: 50,
    color: "#7ec99a",
    thesis:
      "Pemain nomor dua global di kategori minuman berenergi dengan margin tinggi dan brand loyalty kuat di kalangan Gen Z & milenial.",
    outlook:
      "Ekspansi geografis (Asia, Amerika Latin) dan lini produk baru (alcohol brands, varian rendah gula) jadi ruang pertumbuhan berikutnya.",
  },
  {
    ticker: "KO",
    name: "The Coca-Cola Company",
    sector: "Consumer Staples & Minuman",
    value: 63.98,
    changePct: -1.93,
    growth5y: 35,
    color: "#a9e0bd",
    thesis:
      "Salah satu brand paling dikenal di dunia dengan jaringan distribusi masif di lebih dari 200 negara. Model 'asset-light' lewat bottling partners menjaga margin tetap tinggi.",
    outlook:
      "Diversifikasi ke luar minuman berkarbonasi (air mineral, teh, kopi) dan harga premium jadi strategi pertumbuhan jangka panjang.",
  },
];

// ---------------------------------------------------------------------------
// Derived data
// ---------------------------------------------------------------------------
const totalValue = HOLDINGS.reduce((sum, h) => sum + h.value, 0);
HOLDINGS.forEach((h) => {
  h.weight = (h.value / totalValue) * 100;
});

function fmtPct(n, digits = 1) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function initials(ticker) {
  return ticker.slice(0, 2);
}

// ---------------------------------------------------------------------------
// Ticker tape
// ---------------------------------------------------------------------------
function renderTickerTape() {
  const track = document.getElementById("ticker-track");
  if (!track) return;
  const items = HOLDINGS.map((h) => {
    const cls = h.changePct >= 0 ? "up" : "down";
    const arrow = h.changePct >= 0 ? "▲" : "▼";
    return `<span><b>${h.ticker}</b> $${h.value.toFixed(2)} <span class="${cls}">${arrow} ${fmtPct(h.changePct, 2)}</span></span>`;
  }).join("");
  // duplicate for seamless loop
  track.innerHTML = items + items;
}

// ---------------------------------------------------------------------------
// Hero preview list (top 5 by weight)
// ---------------------------------------------------------------------------
function renderHeroList() {
  const el = document.getElementById("hero-ticker-list");
  if (!el) return;
  const top = [...HOLDINGS].sort((a, b) => b.weight - a.weight).slice(0, 5);
  el.innerHTML = top
    .map((h) => {
      const cls = h.changePct >= 0 ? "chip-up" : "chip-down";
      return `
        <div class="hero-ticker-row">
          <span class="sym">
            <span class="mini-badge">${initials(h.ticker)}</span>
            ${h.ticker}
          </span>
          <span class="chip ${cls}">${fmtPct(h.changePct, 2)}</span>
        </div>`;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Donut chart (CSS conic-gradient) + legend
// ---------------------------------------------------------------------------
function renderDonut() {
  const donut = document.getElementById("donut");
  const legend = document.getElementById("legend-list");
  if (!donut || !legend) return;

  let acc = 0;
  const stops = HOLDINGS.map((h) => {
    const start = acc;
    acc += h.weight;
    return `${h.color} ${start.toFixed(3)}% ${acc.toFixed(3)}%`;
  }).join(", ");
  donut.style.background = `conic-gradient(${stops})`;

  legend.innerHTML = HOLDINGS.slice()
    .sort((a, b) => b.weight - a.weight)
    .map(
      (h) => `
      <div class="legend-item">
        <span class="swatch" style="background:${h.color}"></span>
        <div class="li-body">
          <b>${h.ticker}</b>
          <small>${h.name}</small>
        </div>
        <span class="li-pct">${h.weight.toFixed(1)}%</span>
      </div>`
    )
    .join("");
}

// ---------------------------------------------------------------------------
// 5-year growth projection bars
// ---------------------------------------------------------------------------
function renderGrowthBars() {
  const wrap = document.getElementById("growth-bars");
  if (!wrap) return;
  const sorted = [...HOLDINGS].sort((a, b) => b.growth5y - a.growth5y);
  wrap.innerHTML = sorted
    .map(
      (h) => `
      <div class="bar-row">
        <div class="bar-label"><b>${h.ticker}</b><small>${h.sector}</small></div>
        <div class="bar-track"><div class="bar-fill" data-width="${h.growth5y}"></div></div>
        <div class="bar-value">${h.growth5y}%</div>
      </div>`
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Holding cards
// ---------------------------------------------------------------------------
function renderHoldingCards() {
  const wrap = document.getElementById("holdings-grid");
  if (!wrap) return;
  wrap.innerHTML = HOLDINGS.map((h) => {
    const cls = h.changePct >= 0 ? "chip-up" : "chip-down";
    return `
    <div class="holding-card reveal">
      <div class="holding-top">
        <div class="holding-id">
          <span class="badge">${initials(h.ticker)}</span>
          <div>
            <strong>${h.ticker}</strong>
            <span>${h.name}</span>
          </div>
        </div>
        <span class="chip ${cls}">${fmtPct(h.changePct, 2)}</span>
      </div>
      <span class="sector-tag">${h.sector}</span>
      <span class="thesis-label">Kenapa aku pegang</span>
      <p>${h.thesis}</p>
      <span class="thesis-label">Narasi ke depan</span>
      <p>${h.outlook}</p>
    </div>`;
  }).join("");
}

// ---------------------------------------------------------------------------
// Growth Rate area chart (SVG, illustrative 5-year portfolio index)
// ---------------------------------------------------------------------------
function renderGrowthChart() {
  const el = document.getElementById("growth-svg");
  if (!el) return;

  const years = ["2026", "2027", "2028", "2029", "2030", "2031"];
  const values = [100, 117, 133, 153, 176, 202]; // illustrative index, base 100

  const w = 560;
  const h = 260;
  const padL = 36;
  const padB = 30;
  const padT = 16;
  const padR = 10;

  const maxV = Math.max(...values);
  const minV = Math.min(...values) * 0.9;
  const stepX = (w - padL - padR) / (values.length - 1);

  const points = values.map((v, i) => {
    const x = padL + i * stepX;
    const y = padT + (h - padT - padB) * (1 - (v - minV) / (maxV - minV));
    return [x, y];
  });

  const linePath = points
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(" ");

  const areaPath =
    `M${points[0][0]},${h - padB} ` +
    points.map((p) => `L${p[0]},${p[1]}`).join(" ") +
    ` L${points[points.length - 1][0]},${h - padB} Z`;

  const gridLines = [0, 1, 2, 3]
    .map((i) => {
      const y = padT + ((h - padT - padB) / 3) * i;
      return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(248,246,238,0.08)" stroke-width="1"/>`;
    })
    .join("");

  const xLabels = years
    .map((yr, i) => {
      const x = padL + i * stepX;
      return `<text x="${x}" y="${h - 8}" font-size="11" fill="rgba(248,246,238,0.55)" text-anchor="middle">${yr}</text>`;
    })
    .join("");

  const dots = points
    .map(
      (p) =>
        `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#c8f169" stroke="#12281f" stroke-width="2"/>`
    )
    .join("");

  el.setAttribute("viewBox", `0 0 ${w} ${h}`);
  el.innerHTML = `
    <defs>
      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#c8f169" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#c8f169" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${gridLines}
    <path d="${areaPath}" fill="url(#areaFill)"/>
    <path d="${linePath}" fill="none" stroke="#c8f169" stroke-width="2.5"/>
    ${dots}
    ${xLabels}
  `;
}

// ---------------------------------------------------------------------------
// Pillar tabs (Mission / Values / Vision / Action)
// ---------------------------------------------------------------------------
function initPillarTabs() {
  const tabs = document.querySelectorAll(".pillar-tab");
  const panels = document.querySelectorAll(".pillar-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.target).classList.add("active");
    });
  });
}

// ---------------------------------------------------------------------------
// Mobile nav toggle
// ---------------------------------------------------------------------------
function initNavToggle() {
  const btn = document.getElementById("nav-toggle");
  const links = document.getElementById("nav-links");
  if (!btn || !links) return;
  btn.addEventListener("click", () => {
    links.classList.toggle("open-mobile");
    links.style.display = links.classList.contains("open-mobile") ? "flex" : "";
    if (links.classList.contains("open-mobile")) {
      links.style.position = "fixed";
      links.style.top = "72px";
      links.style.left = "0";
      links.style.right = "0";
      links.style.background = "rgba(13,31,23,0.98)";
      links.style.flexDirection = "column";
      links.style.padding = "24px";
      links.style.gap = "18px";
    }
  });
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      links.classList.remove("open-mobile");
      links.removeAttribute("style");
    })
  );
}

// ---------------------------------------------------------------------------
// Scroll reveal + bar fill animation
// ---------------------------------------------------------------------------
function initReveal() {
  const revealEls = document.querySelectorAll(".reveal");
  const barFills = document.querySelectorAll(".bar-fill");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
        }
      });
    },
    { threshold: 0.12 }
  );
  revealEls.forEach((el) => observer.observe(el));

  const barObserver = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.width = entry.target.dataset.width + "%";
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  barFills.forEach((el) => barObserver.observe(el));
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("stat-count").textContent = HOLDINGS.length;
  document.getElementById("year").textContent = new Date().getFullYear();

  renderTickerTape();
  renderHeroList();
  renderDonut();
  renderGrowthBars();
  renderHoldingCards();
  renderGrowthChart();
  initPillarTabs();
  initNavToggle();

  document.querySelectorAll(".section-head, .letter-card, .cta-band").forEach((el) =>
    el.classList.add("reveal")
  );

  initReveal();
});
