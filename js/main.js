/* ==========================================================================
   Rais Firdaus — Stock Portfolio
   Single source of truth: HOLDINGS. Everything (ticker tape, donut chart,
   growth bars, holding cards) renders from this array.
   ========================================================================== */

const HOLDINGS = [
  {
    ticker: "MU",
    name: "Micron Technology Inc",
    sector: "Semiconductors & AI Memory",
    website: "https://www.micron.com",
    value: 814.59,
    changePct: 13.03,
    growth5y: 85,
    color: "#123524",
    thesis:
      "Micron sits at the heart of the memory-chip (DRAM & NAND) supply chain that fuels generative AI data centers. As AI compute demand rises, so does the need for high-capacity memory.",
    outlook:
      "The AI infrastructure upgrade cycle, HBM (High Bandwidth Memory), and a recovery in chip pricing are the main catalysts I'm watching over the next 5 years.",
  },
  {
    ticker: "GEV",
    name: "GE Vernova Inc.",
    sector: "Energy & Grid Infrastructure",
    website: "https://www.gevernova.com",
    value: 661.61,
    changePct: 1.93,
    growth5y: 95,
    color: "#1a4630",
    thesis:
      "Spun off from General Electric, this company focuses on gas turbines, renewable energy, and grid modernization — exactly what the world needs to support the surge in electricity demand from AI data centers.",
    outlook:
      "I see 'electrification & grid buildout' as one of the megatrends of this decade, and GEV is strategically positioned as a core supplier.",
  },
  {
    ticker: "MA",
    name: "Mastercard Inc",
    sector: "Digital Payments",
    website: "https://www.mastercard.com",
    value: 556.49,
    changePct: 0.31,
    growth5y: 70,
    color: "#1e5238",
    thesis:
      "A toll-booth business model: every card transaction generates a fee, with high margins and low capital costs. The growth of e-commerce & the cashless society is a long-term tailwind.",
    outlook:
      "Expansion into cross-border payments, tokenization, and emerging markets (including Indonesia) could become the next growth engine.",
  },
  {
    ticker: "ABBV",
    name: "AbbVie Inc",
    sector: "Pharmaceuticals & Biotech",
    website: "https://www.abbvie.com",
    value: 510.84,
    changePct: 17.16,
    growth5y: 60,
    color: "#256346",
    thesis:
      "After navigating the Humira patent cliff, AbbVie successfully diversified its portfolio into immunology (Skyrizi, Rinvoq) and oncology drugs that are growing aggressively.",
    outlook:
      "A new drug pipeline and strategic acquisitions are the main focus of the medium-to-long-term pharma growth story.",
  },
  {
    ticker: "V",
    name: "Visa Inc. Class A",
    sector: "Digital Payments",
    website: "https://www.visa.com",
    value: 382.39,
    changePct: 6.94,
    growth5y: 65,
    color: "#2c7350",
    thesis:
      "The world's largest payment network with an extremely wide moat. Like Mastercard, Visa benefits from the global shift from cash to digital.",
    outlook:
      "Value-added services (fraud protection, data analytics) and growing digital transaction volume are driving revenue beyond the core card business.",
  },
  {
    ticker: "JNJ",
    name: "Johnson & Johnson",
    sector: "Healthcare & Consumer Health",
    website: "https://www.jnj.com",
    value: 320.23,
    changePct: 5.76,
    growth5y: 40,
    color: "#347e5c",
    thesis:
      "A healthcare giant with broad diversification: pharmaceuticals, MedTech, and consumer products. A Dividend Aristocrat that has consistently raised its dividend for decades in a row.",
    outlook:
      "Post-Kenvue spin-off, the focus is now purely on high-margin pharma & MedTech — a defensive profile that suits balancing a portfolio.",
  },
  {
    ticker: "VLO",
    name: "Valero Energy Corporation",
    sector: "Energy & Refining",
    website: "https://www.valero.com",
    value: 314.47,
    changePct: -0.42,
    growth5y: 35,
    color: "#3d8b68",
    thesis:
      "One of the largest independent oil refining companies in the US. A cyclical business, but one that generates massive cash flow when refining margins (crack spreads) run high.",
    outlook:
      "I see VLO as both a hedge and an exposure to global energy demand that will remain elevated throughout the energy transition.",
  },
  {
    ticker: "PG",
    name: "Procter & Gamble Company",
    sector: "Consumer Staples",
    website: "https://www.pg.com",
    value: 148.12,
    changePct: -2.45,
    growth5y: 30,
    color: "#49a06b",
    thesis:
      "A maker of everyday household staples (Gillette, Pampers, Tide) with strong brand power and high recession resilience. A Dividend Aristocrat with a track record of over 60 years.",
    outlook:
      "Steady single-digit growth, but it forms the 'defensive core' that keeps the portfolio calm when markets turn volatile.",
  },
  {
    ticker: "GILD",
    name: "Gilead Sciences Inc",
    sector: "Biotechnology & Pharmaceuticals",
    website: "https://www.gilead.com",
    value: 129.9,
    changePct: -0.05,
    growth5y: 55,
    color: "#5cb37e",
    thesis:
      "A market leader in HIV treatment, continuing to expand into oncology. Cash flow from its dominant HIV franchise funds long-term research & acquisitions.",
    outlook:
      "The cell therapy pipeline and development of long-acting HIV prevention drugs are the catalysts I'm tracking.",
  },
  {
    ticker: "MNST",
    name: "Monster Beverage Corp",
    sector: "Consumer Beverage",
    website: "https://www.monsterbevcorp.com",
    value: 89.24,
    changePct: -4.12,
    growth5y: 50,
    color: "#7ec99a",
    thesis:
      "The world's number-two player in the energy drink category, with high margins and strong brand loyalty among Gen Z & millennials.",
    outlook:
      "Geographic expansion (Asia, Latin America) and new product lines (alcohol brands, lower-sugar variants) are the next growth avenues.",
  },
  {
    ticker: "KO",
    name: "The Coca-Cola Company",
    sector: "Consumer Staples & Beverages",
    website: "https://www.coca-colacompany.com",
    value: 63.98,
    changePct: -1.93,
    growth5y: 35,
    color: "#a9e0bd",
    thesis:
      "One of the most recognized brands in the world, with a massive distribution network spanning over 200 countries. An 'asset-light' model via bottling partners keeps margins high.",
    outlook:
      "Diversifying beyond carbonated drinks (bottled water, tea, coffee) and premium pricing form the long-term growth strategy.",
  },
];

// ---------------------------------------------------------------------------
// Derived data
// ---------------------------------------------------------------------------
const totalValue = HOLDINGS.reduce((sum, h) => sum + h.value, 0);
HOLDINGS.forEach((h) => {
  h.weight = (h.value / totalValue) * 100;
});

// What I originally paid for 1 share of each of the 11 holdings (today's
// value minus today's dollar move, summed across all positions). This stays
// fixed — it's the baseline the live "Total Portfolio Value" is compared
// against to show real profit/loss.
const INITIAL_CAPITAL_USD = 3776.85;

function fmtPct(n, digits = 1) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function initials(ticker) {
  return ticker.slice(0, 2);
}

// Real company logo, keyed by the company's own domain (see
// HOLDINGS[].website). Clearbit's logo API is the primary source, but it's
// on several ad-blocker filter lists (it was originally a tracking/data
// company), so requests to it silently fail for a chunk of visitors. Falls
// back to Google's favicon service (rarely blocked) and finally to the
// ticker initials. Prevents "MU" reading as Manchester United instead of
// Micron, etc.
function companyLogoHTML(h) {
  let domain = "";
  try {
    domain = new URL(h.website).hostname.replace(/^www\./, "");
  } catch {
    return `<span class="logo-fallback">${initials(h.ticker)}</span>`;
  }
  const googleFavicon = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
  return `
    <img
      class="logo-img"
      src="https://logo.clearbit.com/${domain}?size=128"
      alt="${h.name}"
      onerror="if (!this.dataset.fallback) { this.dataset.fallback = '1'; this.src = '${googleFavicon}'; } else { this.style.display='none'; this.nextElementSibling.style.display='flex'; }"
    />
    <span class="logo-fallback" style="display:none">${initials(h.ticker)}</span>`;
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
    return `<span><a href="${h.website}" target="_blank" rel="noopener"><b>${h.ticker}</b></a> $${h.value.toFixed(2)} <span class="${cls}">${arrow} ${fmtPct(h.changePct, 2)}</span></span>`;
  }).join("");
  // duplicate for seamless loop
  track.innerHTML = items + items;
}

// ---------------------------------------------------------------------------
// Hero holdings slider (all 11, sorted by weight, horizontally scrollable)
// ---------------------------------------------------------------------------
function renderHeroList() {
  const track = document.getElementById("hero-slider-track");
  if (!track) return;
  const sorted = [...HOLDINGS].sort((a, b) => b.weight - a.weight);
  track.innerHTML = sorted
    .map((h) => {
      const cls = h.changePct >= 0 ? "chip-up" : "chip-down";
      return `
        <a class="hero-slide-card" href="${h.website}" target="_blank" rel="noopener">
          <div class="hsc-top">
            <span class="mini-badge logo-badge">${companyLogoHTML(h)}</span>
            <span class="chip ${cls}">${fmtPct(h.changePct, 2)}</span>
          </div>
          <div class="hsc-body">
            <strong>${h.ticker}</strong>
            <span>${h.sector}</span>
          </div>
          <span class="hsc-price">$${h.value.toFixed(2)}</span>
        </a>`;
    })
    .join("");
}

function initHeroSlider() {
  const track = document.getElementById("hero-slider-track");
  const prevBtn = document.getElementById("hero-slider-prev");
  const nextBtn = document.getElementById("hero-slider-next");
  if (!track || !prevBtn || !nextBtn) return;
  const scrollByCards = (dir) => {
    const card = track.querySelector(".hero-slide-card");
    const step = card ? card.getBoundingClientRect().width + 14 : 200;
    track.scrollBy({ left: dir * step * 2, behavior: "smooth" });
  };
  prevBtn.addEventListener("click", () => scrollByCards(-1));
  nextBtn.addEventListener("click", () => scrollByCards(1));
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
        <span class="legend-logo logo-badge">${companyLogoHTML(h)}</span>
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
// Portrait stat chips (top 2 projected growth, shown on the philosophy photo)
// ---------------------------------------------------------------------------
function renderPortraitStats() {
  const wrap = document.getElementById("portrait-stats");
  if (!wrap) return;
  const top2 = [...HOLDINGS].sort((a, b) => b.growth5y - a.growth5y).slice(0, 2);
  wrap.innerHTML = top2
    .map(
      (h) => `
      <div class="portrait-stat">
        <span class="ps-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>
        </span>
        <div>
          <strong>${h.ticker}</strong>
          <small>${h.growth5y}% Projected Growth</small>
        </div>
      </div>`
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Sector groups (derived from HOLDINGS by ticker)
// ---------------------------------------------------------------------------
const SECTOR_GROUPS = [
  { name: "Semiconductors & AI", tickers: ["MU"] },
  { name: "Energy & Infrastructure", tickers: ["GEV", "VLO"] },
  { name: "Digital Payments", tickers: ["MA", "V"] },
  { name: "Pharmaceuticals & Biotech", tickers: ["ABBV", "GILD"] },
  { name: "Consumer Healthcare", tickers: ["JNJ"] },
  { name: "Consumer Staples & Beverages", tickers: ["PG", "KO", "MNST"] },
];

function renderSectorList() {
  const wrap = document.getElementById("sector-list");
  if (!wrap) return;
  wrap.innerHTML = SECTOR_GROUPS.map(
    (g) => `
    <a class="sector-row" href="#holdings">
      <div>
        <div class="sr-name">${g.name}</div>
        <div class="sr-tickers">${g.tickers.join(" · ")}</div>
      </div>
      <span class="sr-arrow">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7M17 7H8M17 7v9"/></svg>
      </span>
    </a>`
  ).join("");
}

// ---------------------------------------------------------------------------
// Sector radar chart (11 axes = 11 tickers, two normalized series)
// ---------------------------------------------------------------------------
function renderSectorRadar() {
  const svg = document.getElementById("radar-svg");
  if (!svg) return;

  const n = HOLDINGS.length;
  const size = 380;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 130;
  const maxWeight = Math.max(...HOLDINGS.map((h) => h.weight));
  const maxGrowth = Math.max(...HOLDINGS.map((h) => h.growth5y));

  const angleFor = (i) => -Math.PI / 2 + i * ((2 * Math.PI) / n);
  const pointAt = (i, ratio) => {
    const a = angleFor(i);
    return [cx + Math.cos(a) * outerR * ratio, cy + Math.sin(a) * outerR * ratio];
  };

  let gridCircles = "";
  [0.25, 0.5, 0.75, 1].forEach((r) => {
    gridCircles += `<circle cx="${cx}" cy="${cy}" r="${outerR * r}" fill="none" style="stroke:var(--line)" stroke-width="1"/>`;
  });

  let axisLines = "";
  let labels = "";
  HOLDINGS.forEach((h, i) => {
    const [ax, ay] = pointAt(i, 1);
    axisLines += `<line x1="${cx}" y1="${cy}" x2="${ax}" y2="${ay}" style="stroke:var(--line)" stroke-width="1"/>`;

    const a = angleFor(i);
    const lr = outerR + 20;
    const lx = cx + Math.cos(a) * lr;
    const ly = cy + Math.sin(a) * lr;
    let anchor = "middle";
    if (Math.cos(a) > 0.25) anchor = "start";
    else if (Math.cos(a) < -0.25) anchor = "end";
    labels += `<text x="${lx}" y="${ly + 4}" font-size="11" font-weight="700" text-anchor="${anchor}" style="fill:var(--forest-700)">${h.ticker}</text>`;
  });

  const weightPts = HOLDINGS.map((h, i) => pointAt(i, h.weight / maxWeight).join(",")).join(" ");
  const growthPts = HOLDINGS.map((h, i) => pointAt(i, h.growth5y / maxGrowth).join(",")).join(" ");

  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.innerHTML = `
    ${gridCircles}
    ${axisLines}
    <polygon points="${weightPts}" style="fill:var(--forest-700);stroke:var(--forest-800)" fill-opacity="0.55" stroke-width="2"/>
    <polygon points="${growthPts}" style="fill:var(--lime-400);stroke:var(--lime-600)" fill-opacity="0.4" stroke-width="2"/>
    ${labels}
  `;
}

// ---------------------------------------------------------------------------
// Holding cards
// ---------------------------------------------------------------------------
function renderHoldingCards() {
  const wrap = document.getElementById("holdings-grid");
  if (!wrap) return;
  wrap.innerHTML = HOLDINGS.map((h) => {
    const cls = h.changePct >= 0 ? "chip-up" : "chip-down";
    const priceLabel = h.livePrice ? `$${h.livePrice.toFixed(2)}` : "";
    return `
    <div class="holding-card reveal">
      <div class="holding-top">
        <a class="holding-id" href="${h.website}" target="_blank" rel="noopener">
          <span class="badge logo-badge">${companyLogoHTML(h)}</span>
          <div>
            <strong>${h.ticker} <svg class="ext-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7M17 7H8M17 7v9"/></svg></strong>
            <span>${h.name}</span>
          </div>
        </a>
        <div class="holding-price">
          ${priceLabel ? `<span class="hp-price">${priceLabel}</span>` : ""}
          <span class="chip ${cls}">${fmtPct(h.changePct, 2)}</span>
        </div>
      </div>
      <span class="sector-tag">${h.sector}</span>
      <span class="thesis-label">Why I hold it</span>
      <p>${h.thesis}</p>
      <span class="thesis-label">Forward narrative</span>
      <p>${h.outlook}</p>
    </div>`;
  }).join("");
}

// ---------------------------------------------------------------------------
// Holdings report table — a compact fund-fact-sheet style breakdown
// (ticker, sector, price, weight, day/1y/YTD return), each ticker linking
// out to the company's official site.
// ---------------------------------------------------------------------------
function fmtSignedPct(pct) {
  if (typeof pct !== "number") return `<span class="rp-na">—</span>`;
  const cls = pct >= 0 ? "up" : "down";
  return `<span class="${cls}">${fmtPct(pct, 1)}</span>`;
}

// Renders a <span> holding both the final formatted value (so the table
// is correct even before any animation runs) and a data-value/data-kind
// pair that animateReportCounts() reads to count up from zero the first
// time the report scrolls into view.
function reportCountHTML(value, kind) {
  if (typeof value !== "number") return `<span class="rp-na">—</span>`;
  const cls = kind === "signed-pct" ? (value >= 0 ? "up" : "down") : "";
  const formatted = formatReportValue(value, kind);
  return `<span class="rp-count ${cls}" data-kind="${kind}" data-value="${value}">${formatted}</span>`;
}

function formatReportValue(v, kind) {
  if (kind === "usd") return `$${v.toFixed(2)}`;
  if (kind === "pct-plain") return `${v.toFixed(1)}%`;
  return fmtPct(v, 1);
}

function renderHoldingsReport() {
  const wrap = document.getElementById("report-table-body");
  if (!wrap) return;
  const sorted = [...HOLDINGS].sort((a, b) => b.weight - a.weight);
  wrap.innerHTML = sorted
    .map((h) => {
      const price = h.livePrice ?? h.value;
      return `
      <tr>
        <td>
          <a class="rp-ticker" href="${h.website}" target="_blank" rel="noopener">
            ${h.ticker}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7M17 7H8M17 7v9"/></svg>
          </a>
        </td>
        <td class="rp-name">${h.name}</td>
        <td class="rp-sector">${h.sector}</td>
        <td class="rp-num">${reportCountHTML(price, "usd")}</td>
        <td class="rp-num">${reportCountHTML(h.weight, "pct-plain")}</td>
        <td class="rp-num">${reportCountHTML(h.changePct, "signed-pct")}</td>
        <td class="rp-num">${reportCountHTML(h.oneYearReturnPercent, "signed-pct")}</td>
        <td class="rp-num">${reportCountHTML(h.ytdReturnPercent, "signed-pct")}</td>
      </tr>`;
    })
    .join("");
}

// Counts every numeric cell in the report table up from zero, once, the
// first time the table scrolls into view — draws the eye to the actual
// numbers instead of letting them sit as static text.
function animateReportCounts() {
  const wrap = document.getElementById("report-table-body");
  if (!wrap) return;
  wrap.querySelectorAll(".rp-count").forEach((el, i) => {
    const kind = el.dataset.kind;
    const to = parseFloat(el.dataset.value);
    if (Number.isNaN(to)) return;
    const duration = 1100;
    const delay = Math.min(i * 20, 300);
    setTimeout(() => {
      const start = performance.now();
      function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = formatReportValue(to * eased, kind);
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = formatReportValue(to, kind);
      }
      requestAnimationFrame(tick);
    }, delay);
  });
}

function initReportCountUp() {
  const section = document.getElementById("report");
  if (!section) return;
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateReportCounts();
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  observer.observe(section);
}

// ---------------------------------------------------------------------------
// Stock Score — an original, transparently-computed momentum read per
// holding (NOT a Wall Street analyst rating — we have no reliable way to
// source real analyst consensus/target-price data without a fragile,
// auth-gated Yahoo endpoint, and showing fabricated-looking analyst data
// would be misleading to retail readers). Built entirely from data this
// site already fetches: YTD return, 1-year return, and where the live
// price sits in its 52-week range.
// ---------------------------------------------------------------------------
function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function computeMomentumScore(h) {
  const livePrice = h.livePrice ?? h.value;
  const hasRange = typeof h.weekLow52 === "number" && typeof h.weekHigh52 === "number" && h.weekHigh52 > h.weekLow52;
  const rangePosition = hasRange ? clamp(((livePrice - h.weekLow52) / (h.weekHigh52 - h.weekLow52)) * 100, 0, 100) : null;

  const norm = (v, min, max) => clamp(((v - min) / (max - min)) * 100, 0, 100);
  const ytdComponent = typeof h.ytdReturnPercent === "number" ? norm(h.ytdReturnPercent, -50, 150) : null;
  const oneYComponent = typeof h.oneYearReturnPercent === "number" ? norm(h.oneYearReturnPercent, -50, 300) : null;

  const parts = [
    { v: ytdComponent, w: 0.4 },
    { v: oneYComponent, w: 0.4 },
    { v: rangePosition, w: 0.2 },
  ].filter((p) => p.v !== null);

  if (!parts.length) return null;
  const totalWeight = parts.reduce((sum, p) => sum + p.w, 0);
  const score = parts.reduce((sum, p) => sum + p.v * p.w, 0) / totalWeight;
  return Math.round(clamp(score, 0, 100));
}

function scoreLabel(score) {
  if (score === null) return "Awaiting data";
  if (score >= 75) return "Strong Momentum";
  if (score >= 55) return "Solid";
  if (score >= 35) return "Neutral";
  return "Cooling Off";
}

function scoreColor(score) {
  if (score === null) return "var(--ink-400)";
  if (score >= 75) return "var(--up)";
  if (score >= 35) return "var(--gold-500)";
  return "var(--down)";
}

function renderStockScores() {
  const wrap = document.getElementById("score-grid");
  if (!wrap) return;
  const sorted = [...HOLDINGS].sort((a, b) => b.weight - a.weight);

  wrap.innerHTML = sorted
    .map((h) => {
      const score = computeMomentumScore(h);
      const color = scoreColor(score);
      const label = scoreLabel(score);
      const gaugeBg =
        score === null ? "var(--cream-100)" : `conic-gradient(${color} 0% ${score}%, var(--cream-100) ${score}% 100%)`;

      const priceLabel = h.livePrice ? `$${h.livePrice.toFixed(2)}` : `$${h.value.toFixed(2)}`;
      const cls = h.changePct >= 0 ? "chip-up" : "chip-down";

      const hasRange = typeof h.weekLow52 === "number" && typeof h.weekHigh52 === "number" && h.weekHigh52 > h.weekLow52;
      const livePrice = h.livePrice ?? h.value;
      const rangePct = hasRange ? clamp(((livePrice - h.weekLow52) / (h.weekHigh52 - h.weekLow52)) * 100, 0, 100) : null;

      const rangeHTML = hasRange
        ? `
        <div class="score-range">
          <div class="score-range-track">
            <div class="score-range-marker" style="left:${rangePct}%"></div>
          </div>
          <div class="score-range-labels">
            <span>$${h.weekLow52.toFixed(2)}</span>
            <span>52-Week Range</span>
            <span>$${h.weekHigh52.toFixed(2)}</span>
          </div>
        </div>`
        : `<p class="score-range-na">52-week range not available yet.</p>`;

      return `
      <div class="score-card reveal">
        <div class="score-card-top">
          <a class="score-id" href="${h.website}" target="_blank" rel="noopener">
            <span class="badge logo-badge">${companyLogoHTML(h)}</span>
            <div>
              <strong>${h.ticker}</strong>
              <span>${h.name}</span>
            </div>
          </a>
          <div class="score-price">
            <span>${priceLabel}</span>
            <span class="chip ${cls}">${fmtPct(h.changePct, 2)}</span>
          </div>
        </div>
        <div class="score-gauge-row">
          <div class="score-gauge" style="background:${gaugeBg}">
            <div class="score-gauge-inner"><strong>${score === null ? "—" : score}</strong></div>
          </div>
          <div class="score-gauge-info">
            <span class="score-gauge-label" style="color:${color}">${label}</span>
            <span class="score-gauge-note">Momentum score — YTD &amp; 1-year trend plus 52-week range position</span>
          </div>
        </div>
        ${rangeHTML}
      </div>`;
    })
    .join("");

  observeReveals();
}

// ---------------------------------------------------------------------------
// Live Price Chart — interactive per-ticker, per-timeframe price history,
// fetched every 30 minutes by a GitHub Actions cron job into
// data/charts.json (see scripts/fetch-charts.mjs). "1H" isn't a native
// Yahoo range, so it's derived here by slicing the last hour out of the
// "1D" intraday series rather than being fetched separately.
// ---------------------------------------------------------------------------
let chartData = null;
let chartTicker = "MU";
let chartRange = "1D";

const CHART_RANGES = ["1H", "1D", "5D", "1M", "3M", "YTD", "5Y", "MAX"];

function getChartSeries(ticker, range) {
  const byTicker = chartData?.series?.[ticker];
  if (!byTicker) return null;
  if (range === "1H") {
    const oneDay = byTicker["1D"];
    if (!Array.isArray(oneDay) || oneDay.length < 2) return null;
    const lastT = oneDay[oneDay.length - 1][0];
    const sliced = oneDay.filter((p) => p[0] >= lastT - 3600);
    return sliced.length >= 2 ? sliced : oneDay.slice(-12);
  }
  return Array.isArray(byTicker[range]) ? byTicker[range] : null;
}

function buildLinePath(values, w, h, padL, padR, padT, padB) {
  const maxV = Math.max(...values);
  const minV = Math.min(...values);
  const span = maxV - minV || 1;
  const stepX = values.length > 1 ? (w - padL - padR) / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = padL + i * stepX;
    const y = padT + (h - padT - padB) * (1 - (v - minV) / span);
    return [x, y];
  });
  const linePath = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const areaPath =
    `M${points[0][0]},${h - padB} ` +
    points.map((p) => `L${p[0]},${p[1]}`).join(" ") +
    ` L${points[points.length - 1][0]},${h - padB} Z`;
  return { linePath, areaPath, minV, maxV };
}

function renderChartTickerTabs() {
  const wrap = document.getElementById("chart-ticker-tabs");
  if (!wrap) return;
  wrap.innerHTML = HOLDINGS.map(
    (h) => `<button class="chart-tab ${h.ticker === chartTicker ? "active" : ""}" data-ticker="${h.ticker}">${h.ticker}</button>`
  ).join("");
  wrap.querySelectorAll(".chart-tab").forEach((btn) =>
    btn.addEventListener("click", () => {
      chartTicker = btn.dataset.ticker;
      renderChartTickerTabs();
      renderChartPanel();
    })
  );
}

function renderChartRangeTabs() {
  const wrap = document.getElementById("chart-range-tabs");
  if (!wrap) return;
  wrap.innerHTML = CHART_RANGES.map(
    (r) => `<button class="range-tab ${r === chartRange ? "active" : ""}" data-range="${r}">${r}</button>`
  ).join("");
  wrap.querySelectorAll(".range-tab").forEach((btn) =>
    btn.addEventListener("click", () => {
      chartRange = btn.dataset.range;
      renderChartRangeTabs();
      renderChartPanel();
    })
  );
}

function renderChartPanel() {
  const svg = document.getElementById("chart-svg");
  const priceEl = document.getElementById("chart-price");
  const changeEl = document.getElementById("chart-change");
  const updatedEl = document.getElementById("chart-updated");
  if (!svg) return;

  const holding = HOLDINGS.find((h) => h.ticker === chartTicker);
  const livePriceLabel = holding
    ? holding.livePrice
      ? `$${holding.livePrice.toFixed(2)}`
      : `$${holding.value.toFixed(2)}`
    : "—";

  const series = getChartSeries(chartTicker, chartRange);

  if (!series || series.length < 2) {
    svg.innerHTML = `<text x="320" y="134" text-anchor="middle" font-size="13" style="fill:var(--ink-400)">Chart data for this timeframe isn't available yet — check back after the next refresh.</text>`;
    if (priceEl) priceEl.textContent = livePriceLabel;
    if (changeEl) {
      changeEl.textContent = "—";
      changeEl.className = "chip";
    }
    if (updatedEl) updatedEl.textContent = chartData?.updatedAt ? `Updated ${fmtUpdatedAt(chartData.updatedAt)}` : "";
    return;
  }

  const values = series.map((p) => p[1]);
  const first = values[0];
  const last = values[values.length - 1];

  // For "1D" specifically, (last - first) / first is the change since
  // *today's opening tick* — not the same thing as "today's change" (which
  // is measured against yesterday's close, the number shown everywhere
  // else on the site: ticker tape, holdings report, stock score). A stock
  // can be up since the open while still down on the day, so 1D reuses
  // the authoritative changePct already computed correctly in
  // fetch-quotes.mjs rather than re-deriving a different, easily-confused
  // number from the intraday series.
  const periodChangePct =
    chartRange === "1D" && holding && typeof holding.changePct === "number"
      ? holding.changePct
      : first
        ? ((last - first) / first) * 100
        : 0;
  const positive = periodChangePct >= 0;
  const color = positive ? "var(--up)" : "var(--down)";

  const w = 640;
  const h = 260;
  const { linePath, areaPath, minV, maxV } = buildLinePath(values, w, h, 10, 10, 16, 16);

  svg.innerHTML = `
    <defs>
      <linearGradient id="chartAreaFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" style="stop-color:${color}" stop-opacity="0.3"/>
        <stop offset="100%" style="stop-color:${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <text x="6" y="16" font-size="11" style="fill:var(--ink-400)">$${maxV.toFixed(2)}</text>
    <text x="6" y="${h - 6}" font-size="11" style="fill:var(--ink-400)">$${minV.toFixed(2)}</text>
    <path d="${areaPath}" fill="url(#chartAreaFill)"/>
    <path d="${linePath}" fill="none" style="stroke:${color}" stroke-width="2.5"/>
  `;

  if (priceEl) priceEl.textContent = livePriceLabel;
  if (changeEl) {
    changeEl.textContent = `${fmtPct(periodChangePct, 2)} (${chartRange})`;
    changeEl.className = `chip ${positive ? "chip-up" : "chip-down"}`;
  }
  if (updatedEl) {
    updatedEl.textContent = chartData?.updatedAt ? `Updated ${fmtUpdatedAt(chartData.updatedAt)}` : "";
  }
}

async function loadCharts() {
  try {
    const res = await fetch("data/charts.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    chartData = await res.json();
  } catch (err) {
    console.error("Failed to load data/charts.json:", err);
    chartData = null;
  }
  renderChartTickerTabs();
  renderChartRangeTabs();
  renderChartPanel();
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
      (p, i) =>
        `<circle class="gc-dot" style="transition-delay:${300 + i * 130}ms" cx="${p[0]}" cy="${p[1]}" r="4" fill="#c8f169" stroke="#12281f" stroke-width="2"/>`
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
    <path class="gc-area" d="${areaPath}" fill="url(#areaFill)"/>
    <path class="gc-line" d="${linePath}" fill="none" stroke="#c8f169" stroke-width="2.5"/>
    ${dots}
    ${xLabels}
  `;

  // Prime the line to render fully hidden (dasharray/dashoffset = full
  // length) so it can be "drawn" via CSS transition the first time it
  // scrolls into view — see initGrowthChartReveal().
  const linePathEl = el.querySelector(".gc-line");
  if (linePathEl) {
    const len = linePathEl.getTotalLength();
    linePathEl.style.strokeDasharray = String(len);
    linePathEl.style.strokeDashoffset = String(len);
  }
}

function initGrowthChartReveal() {
  const svg = document.getElementById("growth-svg");
  if (!svg) return;
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const line = svg.querySelector(".gc-line");
          if (line) line.style.strokeDashoffset = "0";
          svg.querySelectorAll(".gc-area, .gc-dot").forEach((el) => el.classList.add("in"));
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.35 }
  );
  observer.observe(svg);
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
// Cookie consent — this site has no ads or third-party analytics, so every
// choice here (Accept/Reject/Save) just records that the visitor has seen
// the notice; there's nothing else to actually gate.
// ---------------------------------------------------------------------------
function initCookieConsent() {
  const banner = document.getElementById("cookie-banner");
  const backdrop = document.getElementById("cookie-modal-backdrop");
  if (!banner || !backdrop) return;
  const STORAGE_KEY = "cookie-consent";

  function openModal() {
    backdrop.classList.add("show");
    backdrop.setAttribute("aria-hidden", "false");
  }
  function closeModal() {
    backdrop.classList.remove("show");
    backdrop.setAttribute("aria-hidden", "true");
  }
  function dismiss(choice) {
    localStorage.setItem(STORAGE_KEY, choice);
    banner.classList.remove("show");
    closeModal();
  }

  if (!localStorage.getItem(STORAGE_KEY)) {
    requestAnimationFrame(() => banner.classList.add("show"));
  }

  document.getElementById("cookie-accept")?.addEventListener("click", () => dismiss("accepted"));
  document.getElementById("cookie-reject")?.addEventListener("click", () => dismiss("rejected"));
  document.getElementById("cookie-modal-accept")?.addEventListener("click", () => dismiss("accepted"));
  document.getElementById("cookie-modal-reject")?.addEventListener("click", () => dismiss("rejected"));
  document.getElementById("cookie-modal-save")?.addEventListener("click", () => dismiss("accepted"));
  document.getElementById("cookie-manage")?.addEventListener("click", openModal);
  document.getElementById("cookie-modal-close")?.addEventListener("click", closeModal);
  document.getElementById("cookie-reopen")?.addEventListener("click", () => {
    banner.classList.remove("show");
    openModal();
  });
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop.classList.contains("show")) closeModal();
  });
}

// ---------------------------------------------------------------------------
// Scroll reveal + bar fill animation
// ---------------------------------------------------------------------------
let revealObserver = null;

// Re-scans for .reveal elements that aren't observed/visible yet. Needed
// because loadLiveQuotes() re-renders holding cards after the initial
// reveal pass, which would otherwise leave the fresh nodes stuck invisible.
// Siblings under the same parent get a staggered --reveal-i index (capped)
// so grids/lists cascade in one after another instead of popping in at once.
function observeReveals() {
  if (!revealObserver) return;
  const pending = document.querySelectorAll(".reveal:not(.in-view)");
  const counters = new WeakMap();
  pending.forEach((el) => {
    const parent = el.parentElement;
    const i = counters.get(parent) ?? 0;
    el.style.setProperty("--reveal-i", Math.min(i, 5));
    counters.set(parent, i + 1);
    revealObserver.observe(el);
  });
}

function initReveal() {
  const barFills = document.querySelectorAll(".bar-fill");

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
        }
      });
    },
    { threshold: 0.12 }
  );
  observeReveals();

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

  // One-shot "spin in" flourish for the allocation donut and sector radar,
  // the first time each scrolls into view.
  const spinTargets = [document.getElementById("donut"), document.getElementById("radar-svg")].filter(
    Boolean
  );
  const spinObserver = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("spin-in");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.35 }
  );
  spinTargets.forEach((el) => spinObserver.observe(el));
}

// ---------------------------------------------------------------------------
// Scroll polish: a top progress bar + a subtle parallax drift on the hero
// photo, both driven off the same rAF-throttled scroll listener.
// ---------------------------------------------------------------------------
function initScrollEffects() {
  const progress = document.getElementById("scroll-progress");
  const heroImg = document.querySelector(".hero-photo-hero .photo-hero-bg");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ticking = false;

  function update() {
    ticking = false;
    const doc = document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop;
    const max = doc.scrollHeight - doc.clientHeight;
    if (progress) progress.style.width = `${max > 0 ? Math.min((scrollTop / max) * 100, 100) : 0}%`;

    if (heroImg && !reduceMotion) {
      const heroBox = heroImg.closest(".hero-photo-hero");
      const rect = heroBox.getBoundingClientRect();
      // Only shift while the hero is anywhere near the viewport — no point
      // computing this once it's scrolled far away.
      if (rect.bottom > -200 && rect.top < window.innerHeight + 200) {
        const drift = Math.max(-30, Math.min(30, rect.top * 0.06));
        heroImg.style.transform = `scale(1.15) translateY(${drift}px)`;
      }
    }
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();
}

// ---------------------------------------------------------------------------
// Live quotes (fetched periodically by a GitHub Actions cron job into
// data/quotes.json — see scripts/fetch-quotes.mjs). This only overrides the
// day-change % (and adds a live price) on top of the static HOLDINGS data;
// it never changes allocation weights, since those depend on share counts
// we don't track here.
// ---------------------------------------------------------------------------
function fmtUpdatedAt(iso) {
  if (!iso) return "never auto-updated yet";
  const d = new Date(iso);
  return (
    d.toLocaleString("en-US", {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }) + " UTC"
  );
}

async function loadLiveQuotes() {
  const label = document.getElementById("quotes-updated");
  try {
    const res = await fetch("data/quotes.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    HOLDINGS.forEach((h) => {
      const q = data.quotes?.[h.ticker];
      if (q && typeof q.changePercent === "number") {
        h.changePct = q.changePercent;
        h.livePrice = q.price;
        h.oneYearReturnPercent = q.oneYearReturnPercent ?? null;
        h.ytdReturnPercent = q.ytdReturnPercent ?? null;
        h.weekLow52 = q.weekLow52 ?? null;
        h.weekHigh52 = q.weekHigh52 ?? null;
      }
    });

    renderTickerTape();
    renderHeroList();
    renderHoldingCards();
    renderHoldingsReport();
    renderStockScores();
    observeReveals();
    renderPerformanceStats(data);

    if (label) {
      label.textContent = data.updatedAt
        ? `Prices auto-updated · Last: ${fmtUpdatedAt(data.updatedAt)}`
        : "Initial prices (manual snapshot) · waiting for first auto-update";
    }
  } catch (err) {
    if (label) label.textContent = "Showing last snapshot prices (failed to load live data)";
    const perfUpdated = document.getElementById("perf-updated");
    if (perfUpdated) perfUpdated.textContent = "Failed to load live performance data.";
    console.error("Failed to load data/quotes.json:", err);
  }
}

// ---------------------------------------------------------------------------
// Portfolio performance (USD) — total value + weighted returns, sourced
// from the same live quotes.json the price ticker uses.
// ---------------------------------------------------------------------------
function fmtUSD(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function setPerfValue(id, pct) {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof pct !== "number") {
    el.textContent = "—";
    el.classList.remove("up", "down");
    return;
  }
  el.classList.toggle("up", pct >= 0);
  el.classList.toggle("down", pct < 0);
}

// ---- Count-up animation: plays once, the first time the Performance
// section is both in view and its data has loaded (whichever comes last).
let perfInView = false;
let perfDataReady = false;
let perfAnimated = false;
let perfTargets = { total: null, oneD: null, oneM: null, oneY: null, ytd: null };

function animateCountUp(elId, to, { kind = "usd", duration = 1600 } = {}) {
  const el = document.getElementById(elId);
  if (!el || typeof to !== "number") return;
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = to * eased;
    el.textContent = kind === "usd" ? fmtUSD(val) : `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`;
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = kind === "usd" ? fmtUSD(to) : fmtPct(to, 1);
  }
  requestAnimationFrame(tick);
}

function renderVsCapital(totalUSD) {
  const el = document.getElementById("perf-vs-capital");
  if (!el || typeof totalUSD !== "number") return;
  const gain = totalUSD - INITIAL_CAPITAL_USD;
  const gainPct = (gain / INITIAL_CAPITAL_USD) * 100;
  el.classList.toggle("up", gain >= 0);
  el.classList.toggle("down", gain < 0);
  el.textContent = `${gain >= 0 ? "+" : "-"}$${Math.abs(gain).toFixed(2)} (${fmtPct(gainPct, 1)}) vs. initial capital`;
}

function maybeAnimatePerf() {
  if (perfAnimated || !perfInView || !perfDataReady) return;
  perfAnimated = true;
  animateCountUp("perf-total", perfTargets.total, { kind: "usd" });
  const netEl = document.getElementById("perf-net");
  if (netEl) netEl.textContent = fmtUSD(INITIAL_CAPITAL_USD);
  if (typeof perfTargets.total === "number") renderVsCapital(perfTargets.total);
  if (typeof perfTargets.oneD === "number") animateCountUp("perf-1d", perfTargets.oneD, { kind: "pct" });
  if (typeof perfTargets.oneM === "number") animateCountUp("perf-1m", perfTargets.oneM, { kind: "pct" });
  if (typeof perfTargets.oneY === "number") animateCountUp("perf-1y", perfTargets.oneY, { kind: "pct" });
  if (typeof perfTargets.ytd === "number") animateCountUp("perf-ytd", perfTargets.ytd, { kind: "pct" });
}

function initPerfInViewObserver() {
  const section = document.getElementById("performance");
  if (!section) return;
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          perfInView = true;
          maybeAnimatePerf();
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );
  observer.observe(section);
}

function renderPerformanceStats(data) {
  const portfolio = data?.portfolio;
  const ytdLabel = document.getElementById("perf-ytd-label");
  const updatedEl = document.getElementById("perf-updated");

  if (ytdLabel) ytdLabel.textContent = `YTD Return ${new Date().getFullYear()}`;

  if (!portfolio) {
    if (updatedEl) updatedEl.textContent = "Waiting for the first auto-update of performance data.";
    return;
  }

  perfTargets = {
    total: typeof portfolio.totalUSD === "number" ? portfolio.totalUSD : null,
    oneD: portfolio.changePercent,
    oneM: portfolio.oneMonthReturnPercent,
    oneY: portfolio.oneYearReturnPercent,
    ytd: portfolio.ytdReturnPercent,
  };
  setPerfValue("perf-1d", portfolio.changePercent);
  setPerfValue("perf-1m", portfolio.oneMonthReturnPercent);
  setPerfValue("perf-1y", portfolio.oneYearReturnPercent);
  setPerfValue("perf-ytd", portfolio.ytdReturnPercent);
  [
    ["perf-1d", portfolio.changePercent],
    ["perf-1m", portfolio.oneMonthReturnPercent],
    ["perf-1y", portfolio.oneYearReturnPercent],
    ["perf-ytd", portfolio.ytdReturnPercent],
  ].forEach(([id, val]) => {
    if (typeof val !== "number") {
      const el = document.getElementById(id);
      if (el) el.textContent = "—";
    }
  });

  perfDataReady = true;
  if (perfAnimated) {
    // A later refresh (30-min cron) after the first animation already
    // played — just update the numbers directly, no need to re-animate.
    const totalEl = document.getElementById("perf-total");
    const netEl = document.getElementById("perf-net");
    if (totalEl && perfTargets.total !== null) totalEl.textContent = fmtUSD(perfTargets.total);
    if (netEl) netEl.textContent = fmtUSD(INITIAL_CAPITAL_USD);
    if (typeof perfTargets.total === "number") renderVsCapital(perfTargets.total);
  } else {
    maybeAnimatePerf();
  }

  if (updatedEl) {
    updatedEl.textContent = data.updatedAt
      ? `Calculated from live prices across 11 stocks · Last: ${fmtUpdatedAt(data.updatedAt)}. Some holdings (e.g. GEV, which only IPO'd in 2024) don't yet have a full 1-year price history, so their figure is calculated from the earliest available data.`
      : "Waiting for the first auto-update of performance data.";
  }
}

// ---------------------------------------------------------------------------
// Investment simulation game — practice picking stocks with play money and
// real (live-fetched) prices. Everything here is in-memory only and resets
// on page reload by design (no account, no localStorage). Because this is a
// static site with no backend, arbitrary-ticker prices are fetched directly
// from the browser via Yahoo Finance's chart endpoint, relayed through a
// free public CORS proxy (Yahoo doesn't set CORS headers itself, so a direct
// browser fetch would otherwise be blocked). That relay is an unofficial
// third-party service, so occasional failures/timeouts are expected and
// handled as a normal, retryable error rather than a crash.
// ---------------------------------------------------------------------------
const GAME_START_CASH = 10000;
const GAME_QUOTE_PROXY = "https://api.allorigins.win/raw?url=";
let gameState = { cash: GAME_START_CASH, positions: [] };

function fmtUSD2(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function fetchGameQuote(ticker) {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let json;
  try {
    const res = await fetch(`${GAME_QUOTE_PROXY}${encodeURIComponent(yahooUrl)}`, { signal: controller.signal });
    if (!res.ok) throw new Error("lookup failed");
    json = await res.json();
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`Timed out looking up "${ticker}" — try again.`);
    throw new Error(`Couldn't fetch "${ticker}" — check the symbol or try again in a moment.`);
  } finally {
    clearTimeout(timeout);
  }

  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  if (!result || !meta || typeof meta.regularMarketPrice !== "number") {
    throw new Error(`"${ticker}" doesn't look like a valid ticker.`);
  }
  return {
    ticker: (meta.symbol || ticker).toUpperCase(),
    name: meta.shortName || meta.longName || meta.symbol || ticker,
    price: meta.regularMarketPrice,
  };
}

function computeGameTotals() {
  const positionsValue = gameState.positions.reduce((sum, p) => sum + p.shares * p.currentPrice, 0);
  const total = gameState.cash + positionsValue;
  const pl = total - GAME_START_CASH;
  const plPct = (pl / GAME_START_CASH) * 100;
  return { positionsValue, total, pl, plPct };
}

function renderGameStats() {
  const { positionsValue, total, pl, plPct } = computeGameTotals();
  document.getElementById("game-cash").textContent = fmtUSD2(gameState.cash);
  document.getElementById("game-positions-value").textContent = fmtUSD2(positionsValue);
  document.getElementById("game-total-value").textContent = fmtUSD2(total);
  const plEl = document.getElementById("game-total-pl");
  plEl.textContent = `${pl >= 0 ? "+" : "-"}${fmtUSD2(Math.abs(pl))} (${fmtPct(plPct, 1)})`;
  plEl.classList.toggle("up", pl >= 0);
  plEl.classList.toggle("down", pl < 0);
}

function renderGamePositions() {
  const body = document.getElementById("game-positions-body");
  body.innerHTML = "";
  if (!gameState.positions.length) {
    const row = document.createElement("tr");
    row.className = "game-empty-row";
    row.innerHTML = `<td colspan="6">No positions yet — buy your first pick above.</td>`;
    body.appendChild(row);
    return;
  }
  gameState.positions.forEach((p) => {
    const pl = (p.currentPrice - p.entryPrice) * p.shares;
    const plPct = ((p.currentPrice - p.entryPrice) / p.entryPrice) * 100;
    const row = document.createElement("tr");

    const tickerCell = document.createElement("td");
    tickerCell.textContent = p.ticker;
    tickerCell.title = p.name;
    row.appendChild(tickerCell);

    const sharesCell = document.createElement("td");
    sharesCell.className = "rp-num";
    sharesCell.textContent = p.shares.toFixed(4);
    row.appendChild(sharesCell);

    const entryCell = document.createElement("td");
    entryCell.className = "rp-num";
    entryCell.textContent = fmtUSD2(p.entryPrice);
    row.appendChild(entryCell);

    const currentCell = document.createElement("td");
    currentCell.className = "rp-num";
    currentCell.textContent = fmtUSD2(p.currentPrice);
    row.appendChild(currentCell);

    const plCell = document.createElement("td");
    plCell.className = `rp-num ${pl >= 0 ? "up" : "down"}`;
    plCell.textContent = `${pl >= 0 ? "+" : "-"}${fmtUSD2(Math.abs(pl))} (${fmtPct(plPct, 1)})`;
    row.appendChild(plCell);

    const actionCell = document.createElement("td");
    actionCell.className = "rp-num";
    const sellBtn = document.createElement("button");
    sellBtn.type = "button";
    sellBtn.className = "game-sell-btn";
    sellBtn.textContent = "Sell";
    sellBtn.dataset.ticker = p.ticker;
    actionCell.appendChild(sellBtn);
    row.appendChild(actionCell);

    body.appendChild(row);
  });
}

function setGameFeedback(message, kind = "neutral") {
  const el = document.getElementById("game-feedback");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("up", kind === "up");
  el.classList.toggle("down", kind === "down");
}

function setGameQuotePreview(message, kind = "neutral") {
  const el = document.getElementById("game-quote-preview");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("down", kind === "down");
}

function initGame() {
  const form = document.getElementById("game-buy-form");
  const tickerInput = document.getElementById("game-ticker-input");
  const amountInput = document.getElementById("game-amount-input");
  const buyBtn = document.getElementById("game-buy-btn");
  const refreshBtn = document.getElementById("game-refresh-btn");
  const resetBtn = document.getElementById("game-reset-btn");
  const positionsBody = document.getElementById("game-positions-body");
  if (!form) return;

  // Live quote preview: as soon as a valid-looking ticker is typed, look it
  // up (debounced) so the user sees the price/name before committing to a
  // buy amount — same fetch also gets cached and reused by the Buy handler
  // below so we don't hit the price relay twice for one purchase.
  let previewTimer = null;
  let previewToken = 0;
  let lastPreview = null; // { ticker, quote }

  function schedulePreview() {
    const ticker = tickerInput.value.trim().toUpperCase();
    clearTimeout(previewTimer);
    if (!/^[A-Z][A-Z.\-]{0,9}$/.test(ticker)) {
      setGameQuotePreview("");
      return;
    }
    previewTimer = setTimeout(async () => {
      const myToken = ++previewToken;
      setGameQuotePreview(`Looking up ${ticker}…`);
      try {
        const quote = await fetchGameQuote(ticker);
        if (myToken !== previewToken) return; // a newer lookup superseded this one
        lastPreview = { ticker, quote };
        setGameQuotePreview(`${quote.ticker} · ${quote.name} · ${fmtUSD2(quote.price)}`);
      } catch (err) {
        if (myToken !== previewToken) return;
        setGameQuotePreview(err.message || `Couldn't find "${ticker}".`, "down");
      }
    }, 500);
  }

  tickerInput.addEventListener("input", schedulePreview);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ticker = tickerInput.value.trim().toUpperCase();
    const amount = parseFloat(amountInput.value);

    if (!/^[A-Z][A-Z.\-]{0,9}$/.test(ticker)) {
      setGameFeedback("Enter a valid ticker symbol first (e.g. SNDK).", "down");
      return;
    }
    if (!(amount > 0)) {
      setGameFeedback("Enter how many USD you want to invest.", "down");
      return;
    }
    if (amount > gameState.cash) {
      setGameFeedback(`Not enough virtual cash — you have ${fmtUSD2(gameState.cash)} left.`, "down");
      return;
    }

    buyBtn.disabled = true;
    setGameFeedback(`Looking up ${ticker}…`);
    try {
      // Reuse the preview's quote if it's fresh and for the same ticker,
      // otherwise fetch fresh (e.g. user submitted before the preview
      // finished, or edited the amount long after the preview loaded).
      const quote = lastPreview?.ticker === ticker ? lastPreview.quote : await fetchGameQuote(ticker);
      const shares = amount / quote.price;
      const existing = gameState.positions.find((p) => p.ticker === quote.ticker);
      if (existing) {
        const totalCost = existing.shares * existing.entryPrice + amount;
        existing.shares += shares;
        existing.entryPrice = totalCost / existing.shares;
        existing.currentPrice = quote.price;
      } else {
        gameState.positions.push({
          ticker: quote.ticker,
          name: quote.name,
          shares,
          entryPrice: quote.price,
          currentPrice: quote.price,
        });
      }
      gameState.cash -= amount;
      setGameFeedback(`Bought ${shares.toFixed(4)} shares of ${quote.ticker} at ${fmtUSD2(quote.price)}.`, "up");
      tickerInput.value = "";
      amountInput.value = "";
      lastPreview = null;
      setGameQuotePreview("");
      renderGameStats();
      renderGamePositions();
    } catch (err) {
      setGameFeedback(err.message || "Something went wrong — try again.", "down");
    } finally {
      buyBtn.disabled = false;
    }
  });

  positionsBody?.addEventListener("click", (e) => {
    const btn = e.target.closest(".game-sell-btn");
    if (!btn) return;
    const ticker = btn.dataset.ticker;
    const idx = gameState.positions.findIndex((p) => p.ticker === ticker);
    if (idx === -1) return;
    const p = gameState.positions[idx];
    const proceeds = p.shares * p.currentPrice;
    const pl = proceeds - p.shares * p.entryPrice;
    gameState.cash += proceeds;
    gameState.positions.splice(idx, 1);
    setGameFeedback(
      `Sold ${p.ticker} for ${fmtUSD2(proceeds)} (${pl >= 0 ? "+" : "-"}${fmtUSD2(Math.abs(pl))}).`,
      pl >= 0 ? "up" : "down"
    );
    renderGameStats();
    renderGamePositions();
  });

  refreshBtn?.addEventListener("click", async () => {
    if (!gameState.positions.length) {
      setGameFeedback("No positions to refresh yet.");
      return;
    }
    refreshBtn.disabled = true;
    setGameFeedback("Refreshing prices…");
    const results = await Promise.allSettled(gameState.positions.map((p) => fetchGameQuote(p.ticker)));
    let okCount = 0;
    results.forEach((res, i) => {
      if (res.status === "fulfilled") {
        gameState.positions[i].currentPrice = res.value.price;
        okCount++;
      }
    });
    setGameFeedback(`Refreshed ${okCount}/${gameState.positions.length} position${gameState.positions.length === 1 ? "" : "s"}.`);
    renderGameStats();
    renderGamePositions();
    refreshBtn.disabled = false;
  });

  resetBtn?.addEventListener("click", () => {
    if (gameState.positions.length && !confirm("Reset the simulation back to $10,000? This clears all your virtual positions.")) {
      return;
    }
    gameState = { cash: GAME_START_CASH, positions: [] };
    tickerInput.value = "";
    amountInput.value = "";
    lastPreview = null;
    setGameQuotePreview("");
    setGameFeedback("Game reset — back to $10,000 virtual cash.");
    renderGameStats();
    renderGamePositions();
  });

  renderGameStats();
  renderGamePositions();
}

// ---------------------------------------------------------------------------
// Breaking news (fetched hourly by a GitHub Actions cron job into
// data/news.json — see scripts/fetch-news.mjs, which pulls from Yahoo
// Finance's public news search). Headline text, publisher names, and links
// all come from third-party sources, so this is built with DOM APIs
// (textContent / href assignment) rather than innerHTML, and links are
// validated to be plain http(s) URLs before use — never trust external
// strings enough to parse them as HTML.
// ---------------------------------------------------------------------------
function fmtNewsTime(ms) {
  if (typeof ms !== "number") return "";
  const diffMs = Date.now() - ms;
  const hours = Math.round(diffMs / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function safeHttpUrl(link) {
  try {
    const u = new URL(link);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function renderNewsList(items) {
  const wrap = document.getElementById("news-list");
  if (!wrap) return;
  wrap.innerHTML = "";

  items.forEach((n) => {
    const href = safeHttpUrl(n.link);
    if (!href) return;

    const a = document.createElement("a");
    a.className = "news-card reveal";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";

    // Cover image, like a real news wire — with a branded fallback tile
    // (never a broken-image icon) if a story has no thumbnail or the image
    // fails to load.
    const thumbWrap = document.createElement("span");
    thumbWrap.className = "news-thumb-wrap";

    const fallback = document.createElement("span");
    fallback.className = "news-thumb-fallback";
    fallback.textContent = n.ticker;

    const imgUrl = safeHttpUrl(n.image);
    if (imgUrl) {
      const img = document.createElement("img");
      img.className = "news-thumb";
      img.src = imgUrl;
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.onerror = () => {
        img.remove();
        fallback.style.display = "flex";
      };
      thumbWrap.appendChild(img);
    } else {
      fallback.style.display = "flex";
    }
    thumbWrap.appendChild(fallback);

    const body = document.createElement("span");
    body.className = "news-card-body";

    const ticker = document.createElement("span");
    ticker.className = "news-ticker";
    ticker.textContent = n.ticker;

    const title = document.createElement("span");
    title.className = "news-title";
    title.textContent = n.title;

    const meta = document.createElement("span");
    meta.className = "news-meta";
    meta.textContent = `${n.publisher || "Yahoo Finance"} · ${fmtNewsTime(n.publishedAt)}`;

    body.appendChild(ticker);
    body.appendChild(title);
    body.appendChild(meta);

    a.appendChild(thumbWrap);
    a.appendChild(body);
    wrap.appendChild(a);
  });

  observeReveals();
}

async function loadNews() {
  const wrap = document.getElementById("news-list");
  const updatedEl = document.getElementById("news-updated");
  if (!wrap) return;
  try {
    const res = await fetch("data/news.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];

    if (!items.length) {
      wrap.innerHTML = `<p class="news-empty">No recent headlines available right now — check back soon.</p>`;
    } else {
      renderNewsList(items);
    }

    if (updatedEl) {
      updatedEl.textContent = data.updatedAt ? `Updated ${fmtUpdatedAt(data.updatedAt)}` : "";
    }
  } catch (err) {
    wrap.innerHTML = `<p class="news-empty">Couldn't load the latest headlines right now.</p>`;
    console.error("Failed to load data/news.json:", err);
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("stat-count").textContent = HOLDINGS.length;
  document.getElementById("year").textContent = new Date().getFullYear();

  renderTickerTape();
  renderHeroList();
  initHeroSlider();
  renderDonut();
  renderGrowthBars();
  renderHoldingCards();
  renderHoldingsReport();
  renderStockScores();
  renderGrowthChart();
  initGrowthChartReveal();
  renderPortraitStats();
  renderSectorList();
  renderSectorRadar();
  initPillarTabs();
  initNavToggle();
  initCookieConsent();

  document.querySelectorAll(".section-head, .letter-card, .cta-band").forEach((el) =>
    el.classList.add("reveal")
  );

  initReveal();
  initScrollEffects();
  initPerfInViewObserver();
  initReportCountUp();
  initGame();
  loadLiveQuotes();
  loadNews();
  loadCharts();
});
