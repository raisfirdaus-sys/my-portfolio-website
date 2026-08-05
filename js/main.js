/* ==========================================================================
   Rais Firdaus — Stock Portfolio
   Single source of truth: HOLDINGS. Everything (ticker tape, donut chart,
   growth bars, holding cards) renders from this array.
   ========================================================================== */

const HOLDINGS = [
  {
    ticker: "PLTR",
    name: "Palantir Technologies Inc",
    sector: "Data Analytics & AI Software",
    website: "https://www.palantir.com",
    value: 645.24,
    shares: 4,
    changePct: -0.83,
    growth5y: 90,
    color: "#123524",
    thesis:
      "Palantir's Foundry and AIP platforms turn messy enterprise and government data into decision-ready software, a depth of security and integration few competitors can replicate. Its shift from government-heavy revenue toward fast-growing commercial customers is what turned the stock from a niche defense play into a broader AI story.",
    outlook:
      "Commercial customer growth, AIP adoption pace, and further defense & government contract wins are the catalysts I'm watching most closely.",
  },
  {
    ticker: "MA",
    name: "Mastercard Inc",
    sector: "Digital Payments",
    website: "https://www.mastercard.com",
    value: 591.22,
    shares: 1.033704517,
    changePct: 0.16,
    growth5y: 70,
    color: "#234634",
    thesis:
      "A toll-booth business model: every card transaction generates a fee, with high margins and low capital costs. The growth of e-commerce & the cashless society is a long-term tailwind.",
    outlook:
      "Expansion into cross-border payments, tokenization, and emerging markets (including Indonesia) could become the next growth engine.",
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corporation",
    sector: "Cloud Computing & Enterprise Software",
    website: "https://www.microsoft.com",
    value: 497.59,
    shares: 1.020412387,
    changePct: -0.98,
    growth5y: 75,
    color: "#335745",
    thesis:
      "Microsoft pairs the dominant enterprise productivity suite (Office, Windows, Teams) with Azure, the world's #2 cloud platform, giving it both a defensive moat and a high-growth engine in one company. Its early, deep OpenAI partnership put Copilot AI features across nearly every product line before most competitors had a real answer.",
    outlook:
      "Azure's AI-workload growth, Copilot monetization across the Microsoft 365 suite, and continued enterprise cloud migration are the catalysts I'm watching over the next 5 years.",
  },
  {
    ticker: "ABBV",
    name: "AbbVie Inc",
    sector: "Pharmaceuticals & Biotech",
    website: "https://www.abbvie.com",
    value: 489.42,
    shares: 2,
    changePct: -0.11,
    growth5y: 60,
    color: "#446855",
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
    value: 396.24,
    shares: 1.077276398,
    changePct: 0.63,
    growth5y: 65,
    color: "#547965",
    thesis:
      "The world's largest payment network with an extremely wide moat. Like Mastercard, Visa benefits from the global shift from cash to digital.",
    outlook:
      "Value-added services (fraud protection, data analytics) and growing digital transaction volume are driving revenue beyond the core card business.",
  },
  {
    ticker: "GOOGL",
    name: "Alphabet Inc Class A",
    sector: "Internet Search & Cloud Computing",
    website: "https://abc.xyz",
    value: 379.68,
    shares: 1,
    changePct: 0.52,
    growth5y: 70,
    color: "#658a76",
    thesis:
      "Alphabet still owns the world's dominant search and digital-advertising engine, and Google Cloud has grown into a real third pillar alongside AWS and Azure. Its Gemini AI models and in-house TPU chips give it a rare combination of AI research depth and the infrastructure to deploy it at scale.",
    outlook:
      "Gemini's integration across Search, Workspace, and Cloud, plus continued Waymo and YouTube growth, are the long-term catalysts I'm tracking.",
  },
  {
    ticker: "AMZN",
    name: "Amazon.com Inc",
    sector: "E-Commerce & Cloud Computing",
    website: "https://www.amazon.com",
    value: 351.68,
    shares: 1.268422079,
    changePct: -2.36,
    growth5y: 80,
    color: "#759b86",
    thesis:
      "Amazon combines the world's largest e-commerce marketplace with AWS, the leading cloud computing platform that quietly generates the bulk of the company's operating profit. This dual engine of retail scale and high-margin cloud infrastructure gives it a wide moat few competitors can match.",
    outlook:
      "AWS's expansion into generative AI infrastructure, plus advertising revenue growth and logistics efficiency, are the catalysts I'm tracking most closely over the next 5 years.",
  },
  {
    ticker: "JNJ",
    name: "Johnson & Johnson",
    sector: "Healthcare & Consumer Health",
    website: "https://www.jnj.com",
    value: 322.77,
    shares: 1.276856691,
    changePct: -0.65,
    growth5y: 40,
    color: "#86ac97",
    thesis:
      "A healthcare giant with broad diversification: pharmaceuticals, MedTech, and consumer products. A Dividend Aristocrat that has consistently raised its dividend for decades in a row.",
    outlook:
      "Post-Kenvue spin-off, the focus is now purely on high-margin pharma & MedTech — a defensive profile that suits balancing a portfolio.",
  },
  {
    ticker: "DDOG",
    name: "Datadog Inc",
    sector: "Cloud Monitoring & Observability",
    website: "https://www.datadoghq.com",
    value: 299.38,
    shares: 1.038768015,
    changePct: 0,
    growth5y: 85,
    color: "#96bda7",
    thesis:
      "Datadog is a leading cloud monitoring and observability platform that DevOps and engineering teams rely on to keep modern, distributed applications running. As more of the world's software moves to the cloud and AI-driven workloads multiply, demand for real-time visibility into performance and infrastructure keeps expanding.",
    outlook:
      "New AI-observability products and deeper integration across security, logs, and infrastructure monitoring are the growth levers I'm watching over the next 5 years.",
  },
  {
    ticker: "GILD",
    name: "Gilead Sciences Inc",
    sector: "Biotechnology & Pharmaceuticals",
    website: "https://www.gilead.com",
    value: 130.98,
    shares: 1,
    changePct: -0.15,
    growth5y: 55,
    color: "#a7ceb7",
    thesis:
      "A market leader in HIV treatment, continuing to expand into oncology. Cash flow from its dominant HIV franchise funds long-term research & acquisitions.",
    outlook:
      "The cell therapy pipeline and development of long-acting HIV prevention drugs are the catalysts I'm tracking.",
  },
  {
    ticker: "SBUX",
    name: "Starbucks Corporation",
    sector: "Restaurants & Consumer Retail",
    website: "https://www.starbucks.com",
    value: 103.67,
    shares: 1,
    changePct: 0.22,
    growth5y: 45,
    color: "#b7dfc8",
    thesis:
      "Starbucks remains the dominant global coffeehouse brand, with a loyalty program and mobile-ordering ecosystem that drives repeat, high-frequency purchases. Its scale gives it pricing power and a distribution footprint competitors struggle to replicate.",
    outlook:
      "A turnaround plan focused on store experience, menu simplification, and international growth (especially China) is the story I'm watching over the next 5 years.",
  },
  {
    ticker: "KO",
    name: "The Coca-Cola Company",
    sector: "Consumer Staples & Beverages",
    website: "https://www.coca-colacompany.com",
    value: 93.07,
    shares: 1.08,
    changePct: -0.79,
    growth5y: 35,
    color: "#c8f0d8",
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

// What I actually have invested right now across the 12 holdings (cost
// basis of currently-held shares, straight from the broker — not a running
// total of every historical deposit, since positions get bought and sold
// repeatedly). This stays fixed until the next portfolio update — it's the
// baseline the live "Total Portfolio Value" is compared against to show
// real profit/loss.
const INITIAL_CAPITAL_USD = 4027.76;

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
// Hero holdings slider (all holdings, sorted by weight, horizontally scrollable)
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
  { name: "Cloud & Software", tickers: ["DDOG", "MSFT"] },
  { name: "Internet & AI Platforms", tickers: ["GOOGL", "PLTR"] },
  { name: "Digital Payments", tickers: ["MA", "V"] },
  { name: "Pharmaceuticals & Biotech", tickers: ["ABBV", "GILD"] },
  { name: "Consumer Healthcare", tickers: ["JNJ"] },
  { name: "E-Commerce & Consumer Discretionary", tickers: ["AMZN", "SBUX"] },
  { name: "Consumer Staples & Beverages", tickers: ["KO"] },
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
// Sector radar chart (one axis per ticker, two normalized series)
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
let chartTicker = "MA";
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
      ? `Calculated from live prices across ${HOLDINGS.length} stocks · Last: ${fmtUpdatedAt(data.updatedAt)}.`
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
// browser fetch would otherwise be blocked). Any single free proxy is prone
// to being slow or down, so several are raced in parallel via Promise.any —
// whichever responds first (with valid JSON) wins, and the lookup only
// fails if every one of them does. Still an unofficial best-effort relay,
// so an occasional failure is handled as a normal, retryable error.
// ---------------------------------------------------------------------------
const GAME_START_CASH = 10000;
// Once bought, positions no longer wait on the real market (closed on
// weekends/after-hours, and polling it repeatedly would hammer the quote
// relay anyway) — instead each tick nudges the price by a small random
// +/- step, purely so there's something to react to for practice. It's a
// deliberately simple, unbiased random walk, not a market model.
const GAME_TICK_MS = 2500;
const GAME_TICK_MAX_STEP_PCT = 0.0025;
const GAME_QUOTE_PROXIES = [
  (target) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
  (target) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
  (target) => `https://corsproxy.io/?url=${encodeURIComponent(target)}`,
  (target) => `https://thingproxy.freeboard.io/fetch/${target}`,
];
let gameState = { cash: GAME_START_CASH, positions: [] };

function fmtUSD2(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function fetchViaProxy(proxyUrl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(proxyUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Same math as scripts/fetch-quotes.mjs's fetchQuote() (the server-side
// script behind the core holdings' "Stock Score"), ported to run
// client-side so the game's arbitrary tickers get a real momentum read
// too — not fabricated, just computed from the same 1-year daily-close
// series and 52-week range Yahoo already returns.
const NY_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });
function nyDateOf(epochSeconds) {
  return NY_DATE_FORMATTER.format(new Date(epochSeconds * 1000));
}

function parseYahooChartQuote(json, ticker) {
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  if (!result || !meta || typeof meta.regularMarketPrice !== "number") {
    throw new Error(`"${ticker}" doesn't look like a valid ticker.`);
  }

  // Same "most recent of regular/post/pre-market" candidate pick as
  // scripts/fetch-quotes.mjs, so a ticker typed into the game/analyzer gets
  // the same live-price accuracy as the core holdings instead of
  // silently lagging on a stale regularMarketPrice outside trading hours.
  const priceCandidates = [
    { price: meta.regularMarketPrice, time: meta.regularMarketTime },
    { price: meta.postMarketPrice, time: meta.postMarketTime },
    { price: meta.preMarketPrice, time: meta.preMarketTime },
  ].filter((c) => typeof c.price === "number" && typeof c.time === "number");
  const latestCandidate = priceCandidates.length
    ? priceCandidates.reduce((a, b) => (b.time > a.time ? b : a))
    : { price: meta.regularMarketPrice, time: meta.regularMarketTime };
  const price = latestCandidate.price;

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const series = timestamps.map((t, i) => ({ t, c: closes[i] })).filter((p) => typeof p.c === "number");
  const pctFrom = (base) => (typeof base === "number" && base ? ((price - base) / base) * 100 : null);

  // Same calendar-date-in-the-exchange's-own-timezone previous-close logic
  // as fetch-quotes.mjs — naively trusting meta.previousClose (or counting
  // back a fixed number of series entries) breaks across weekends.
  let prevClose = null;
  if (typeof latestCandidate.time === "number") {
    const todayNy = nyDateOf(latestCandidate.time);
    for (let i = series.length - 1; i >= 0; i--) {
      if (nyDateOf(series[i].t) < todayNy) {
        prevClose = series[i].c;
        break;
      }
    }
  }
  prevClose = prevClose ?? meta.previousClose ?? meta.chartPreviousClose ?? null;
  const changePercent = pctFrom(prevClose) ?? 0;
  const change = typeof prevClose === "number" ? price - prevClose : 0;

  const oneYearReturnPercent = pctFrom(series[0]?.c);
  const jan1 = Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000;
  const ytdStartClose = (series.find((p) => p.t >= jan1) || series[0])?.c;
  const ytdReturnPercent = pctFrom(ytdStartClose);

  return {
    ticker: (meta.symbol || ticker).toUpperCase(),
    name: meta.shortName || meta.longName || meta.symbol || ticker,
    price,
    change,
    changePercent,
    weekLow52: typeof meta.fiftyTwoWeekLow === "number" ? meta.fiftyTwoWeekLow : null,
    weekHigh52: typeof meta.fiftyTwoWeekHigh === "number" ? meta.fiftyTwoWeekHigh : null,
    oneYearReturnPercent,
    ytdReturnPercent,
    series,
  };
}

async function fetchGameQuote(ticker) {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`;
  let json;
  try {
    json = await Promise.any(GAME_QUOTE_PROXIES.map((buildUrl) => fetchViaProxy(buildUrl(yahooUrl), 10000)));
  } catch {
    throw new Error(`Couldn't fetch "${ticker}" right now — all price relays are slow/down, try again in a moment.`);
  }
  return parseYahooChartQuote(json, ticker);
}

// Adapts a game quote/position (price + weekLow52/High52 + YTD/1yr return)
// into the shape computeMomentumScore() expects from a HOLDINGS entry, so
// the exact same, already-transparent scoring logic applies to any ticker.
function gameMomentumScore(q) {
  return computeMomentumScore({
    livePrice: q.price ?? q.currentPrice,
    value: q.price ?? q.currentPrice,
    weekLow52: q.weekLow52,
    weekHigh52: q.weekHigh52,
    ytdReturnPercent: q.ytdReturnPercent,
    oneYearReturnPercent: q.oneYearReturnPercent,
  });
}

// ---------------------------------------------------------------------------
// Momentum backtest — a genuine historical check rather than the live
// simulator: fetches a ticker's full real price history, computes what its
// Momentum score would have read as of a chosen point in the past using
// only data available up to that date (no lookahead), and compares that to
// the real return that actually happened between then and now.
// ---------------------------------------------------------------------------
const gameHistoryCache = new Map();

async function fetchGameHistory(ticker) {
  if (gameHistoryCache.has(ticker)) return gameHistoryCache.get(ticker);
  // range=max returns a mature ticker's ENTIRE trading history (LLY, for
  // example, has been public since the 1970s) — tens of thousands of daily
  // points, which free CORS proxies tend to choke on or truncate. The
  // longest backtest option is 5 years back, and scoring that fairly needs
  // ~1 extra year of trailing data, so 10y is comfortable headroom without
  // the oversized payload.
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=10y`;
  let json;
  try {
    json = await Promise.any(GAME_QUOTE_PROXIES.map((buildUrl) => fetchViaProxy(buildUrl(yahooUrl), 12000)));
  } catch {
    throw new Error(`Couldn't fetch history for "${ticker}" — all price relays are slow/down, try again in a moment.`);
  }
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  if (!result || !meta) throw new Error(`"${ticker}" doesn't look like a valid ticker.`);
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const series = timestamps.map((t, i) => ({ t, c: closes[i] })).filter((p) => typeof p.c === "number");
  if (series.length < 30) throw new Error(`Not enough price history for "${ticker}" to backtest.`);
  const data = {
    ticker: (meta.symbol || ticker).toUpperCase(),
    name: meta.shortName || meta.longName || meta.symbol || ticker,
    series,
  };
  gameHistoryCache.set(ticker, data);
  return data;
}

function computeHistoricalMomentum(series, idx) {
  const price = series[idx].c;
  const t = series[idx].t;

  const oneYearBeforeT = t - 365 * 86400;
  const windowStart = series.findIndex((p) => p.t >= oneYearBeforeT);
  const window = windowStart === -1 ? series.slice(0, idx + 1) : series.slice(windowStart, idx + 1);
  if (window.length < 20) return null; // not enough trailing history for a fair read

  const weekLow52 = Math.min(...window.map((p) => p.c));
  const weekHigh52 = Math.max(...window.map((p) => p.c));
  const pctFrom = (base) => (typeof base === "number" && base ? ((price - base) / base) * 100 : null);
  const oneYearReturnPercent = pctFrom(window[0].c);

  const evalYear = new Date(t * 1000).getUTCFullYear();
  const jan1 = Date.UTC(evalYear, 0, 1) / 1000;
  const ytdStart = window.find((p) => p.t >= jan1) || window[0];
  const ytdReturnPercent = pctFrom(ytdStart.c);

  const score = computeMomentumScore({
    livePrice: price,
    value: price,
    weekLow52,
    weekHigh52,
    ytdReturnPercent,
    oneYearReturnPercent,
  });
  return score === null ? null : { score, price };
}

async function runGameBacktest(ticker, yearsAgo) {
  const history = await fetchGameHistory(ticker);
  const series = history.series;
  const now = series[series.length - 1].t;
  const targetT = now - yearsAgo * 365 * 86400;

  let evalIdx = -1;
  for (let i = 0; i < series.length; i++) {
    if (series[i].t <= targetT) evalIdx = i;
    else break;
  }
  if (evalIdx === -1) {
    throw new Error(`"${history.ticker}" doesn't have price history going back ${yearsAgo} year${yearsAgo === 1 ? "" : "s"}.`);
  }

  const momentum = computeHistoricalMomentum(series, evalIdx);
  if (!momentum) {
    throw new Error(`Not enough trailing history before that date to score "${history.ticker}" fairly.`);
  }

  const priceNow = series[series.length - 1].c;
  const actualReturnPercent = ((priceNow - momentum.price) / momentum.price) * 100;

  return {
    ticker: history.ticker,
    name: history.name,
    dateThen: new Date(series[evalIdx].t * 1000),
    score: momentum.score,
    priceThen: momentum.price,
    priceNow,
    actualReturnPercent,
  };
}

function renderBacktestResult(result, yearsAgo) {
  const resultBox = document.getElementById("game-backtest-result");
  const captionEl = document.getElementById("game-backtest-caption");
  if (!resultBox) return;
  resultBox.hidden = false;

  const momentumEl = document.getElementById("bt-momentum");
  momentumEl.textContent = `${result.score}/100 (${scoreLabel(result.score)})`;
  momentumEl.style.color = scoreColor(result.score);

  document.getElementById("bt-price-then").textContent = fmtUSD2(result.priceThen);
  document.getElementById("bt-price-now").textContent = fmtUSD2(result.priceNow);

  const returnEl = document.getElementById("bt-return");
  returnEl.textContent = `${result.actualReturnPercent >= 0 ? "+" : ""}${result.actualReturnPercent.toFixed(1)}%`;
  returnEl.classList.toggle("up", result.actualReturnPercent >= 0);
  returnEl.classList.toggle("down", result.actualReturnPercent < 0);

  if (captionEl) {
    const dateLabel = result.dateThen.toISOString().slice(0, 10);
    captionEl.classList.remove("down");
    captionEl.textContent = `${result.ticker} · ${result.name} — evaluated as of ${dateLabel} (${yearsAgo} year${
      yearsAgo === 1 ? "" : "s"
    } ago), using only data available through that date.`;
  }
}

function initGameBacktest() {
  const form = document.getElementById("game-backtest-form");
  const tickerInput = document.getElementById("game-backtest-ticker");
  const rangeTabs = document.getElementById("game-backtest-range-tabs");
  const btn = document.getElementById("game-backtest-btn");
  const resultBox = document.getElementById("game-backtest-result");
  const feedbackEl = document.getElementById("game-backtest-feedback");
  const captionEl = document.getElementById("game-backtest-caption");
  if (!form) return;

  // Same live-preview pattern as the buy form — confirms which company a
  // ticker actually resolves to (e.g. ARM vs AMR, PSX vs PVX) before
  // spending a fetch on the heavier 10-year history for the real backtest.
  attachGameTickerPreview(tickerInput, "game-backtest-preview");

  let selectedYears = 1;
  rangeTabs?.addEventListener("click", (e) => {
    const tab = e.target.closest(".range-tab");
    if (!tab) return;
    rangeTabs.querySelectorAll(".range-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    selectedYears = parseInt(tab.dataset.years, 10);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ticker = tickerInput.value.trim().toUpperCase();
    if (!/^[A-Z][A-Z.\-]{0,9}$/.test(ticker)) {
      feedbackEl.textContent = "Enter a valid ticker symbol first (e.g. AAPL).";
      feedbackEl.classList.add("down");
      return;
    }
    btn.disabled = true;
    feedbackEl.classList.remove("down");
    feedbackEl.textContent = `Pulling ${ticker}'s real price history…`;
    if (captionEl) captionEl.textContent = "";
    resultBox.hidden = true;
    try {
      const result = await runGameBacktest(ticker, selectedYears);
      feedbackEl.textContent = "";
      renderBacktestResult(result, selectedYears);
    } catch (err) {
      feedbackEl.textContent = err.message || "Something went wrong — try again.";
      feedbackEl.classList.add("down");
    } finally {
      btn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------------------
// Stock Analyzer — scout any US ticker with a live quote plus a genuinely
// computed technical read: 52-week range position, YTD/1-year trend, the
// same Momentum score used everywhere else on the site, and support/
// resistance levels derived from real historical closes (3-month, 6-month,
// and official 52-week extremes). Everything here is arithmetic on real
// data, not a fabricated "AI confidence" narrative.
// ---------------------------------------------------------------------------
function computeSupportResistance(series, price, weekLow52, weekHigh52) {
  const now = series.length ? series[series.length - 1].t : Math.floor(Date.now() / 1000);
  const windowSince = (days) => series.filter((p) => p.t >= now - days * 86400);

  const levels = [];
  const addLevel = (label, value) => {
    if (typeof value === "number" && isFinite(value)) levels.push({ label, value });
  };

  const threeMo = windowSince(91);
  if (threeMo.length) {
    addLevel("3-Month Low", Math.min(...threeMo.map((p) => p.c)));
    addLevel("3-Month High", Math.max(...threeMo.map((p) => p.c)));
  }
  const sixMo = windowSince(182);
  if (sixMo.length) {
    addLevel("6-Month Low", Math.min(...sixMo.map((p) => p.c)));
    addLevel("6-Month High", Math.max(...sixMo.map((p) => p.c)));
  }
  addLevel("52-Week Low", weekLow52);
  addLevel("52-Week High", weekHigh52);

  // The 3-month high and 52-week high are frequently the exact same print —
  // de-dupe near-identical levels so the same price doesn't show up twice.
  const seenValues = [];
  const distinctLevels = levels.filter((lvl) => {
    const isDup = seenValues.some((v) => Math.abs(v - lvl.value) / lvl.value < 0.002);
    if (isDup) return false;
    seenValues.push(lvl.value);
    return true;
  });

  const resistances = distinctLevels.filter((l) => l.value > price * 1.001).sort((a, b) => a.value - b.value);
  const supports = distinctLevels.filter((l) => l.value < price * 0.999).sort((a, b) => b.value - a.value);
  return { resistances, supports };
}

function buildTechnicalReadBullets(q, score) {
  const bullets = [];
  const hasRange = typeof q.weekLow52 === "number" && typeof q.weekHigh52 === "number" && q.weekHigh52 > q.weekLow52;

  if (hasRange) {
    const rangePct = clamp(((q.price - q.weekLow52) / (q.weekHigh52 - q.weekLow52)) * 100, 0, 100);
    const fromHigh = ((q.weekHigh52 - q.price) / q.weekHigh52) * 100;
    const fromLow = ((q.price - q.weekLow52) / q.weekLow52) * 100;
    if (rangePct >= 97) {
      bullets.push(`Trading within 3% of its 52-week high of ${fmtUSD2(q.weekHigh52)}.`);
    } else if (rangePct <= 3) {
      bullets.push(`Trading within 3% of its 52-week low of ${fmtUSD2(q.weekLow52)}.`);
    } else {
      bullets.push(
        `Sits in the ${rangePct >= 50 ? "upper" : "lower"} half of its 52-week range — ${fromHigh.toFixed(1)}% below the high (${fmtUSD2(
          q.weekHigh52
        )}) and ${fromLow.toFixed(1)}% above the low (${fmtUSD2(q.weekLow52)}).`
      );
    }
  }

  if (typeof q.changePercent === "number") {
    bullets.push(`${q.changePercent >= 0 ? "Up" : "Down"} ${Math.abs(q.changePercent).toFixed(2)}% today.`);
  }
  if (typeof q.ytdReturnPercent === "number") {
    bullets.push(`${q.ytdReturnPercent >= 0 ? "Up" : "Down"} ${Math.abs(q.ytdReturnPercent).toFixed(1)}% year-to-date.`);
  }
  if (typeof q.oneYearReturnPercent === "number") {
    bullets.push(
      `${q.oneYearReturnPercent >= 0 ? "Up" : "Down"} ${Math.abs(q.oneYearReturnPercent).toFixed(1)}% over the trailing 12 months.`
    );
  }
  if (score !== null) {
    bullets.push(
      `Momentum score: ${score}/100 (${scoreLabel(score)}) — the same YTD/1-year/range-position read used across this site. It describes current price behavior, not a forecast.`
    );
  }
  return bullets;
}

function renderAnalyzerSrColumn(elId, title, levels, price, isResistance) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = "";

  const heading = document.createElement("h5");
  heading.textContent = title;
  el.appendChild(heading);

  if (!levels.length) {
    const p = document.createElement("p");
    p.className = "analyzer-sr-empty";
    p.textContent = isResistance
      ? "No resistance overhead across the windows checked — currently at/near a fresh high."
      : "No support below across the windows checked — currently at/near a fresh low.";
    el.appendChild(p);
    return;
  }

  levels.slice(0, 2).forEach((lvl) => {
    const distPct = isResistance ? ((lvl.value - price) / price) * 100 : ((price - lvl.value) / price) * 100;
    const row = document.createElement("div");
    row.className = "analyzer-sr-row";

    const labelEl = document.createElement("span");
    labelEl.className = "analyzer-sr-label";
    labelEl.textContent = lvl.label;
    const valueEl = document.createElement("span");
    valueEl.className = "analyzer-sr-value";
    valueEl.textContent = fmtUSD2(lvl.value);
    const distEl = document.createElement("span");
    distEl.className = "analyzer-sr-dist";
    distEl.textContent = `${distPct.toFixed(1)}% away`;

    row.append(labelEl, valueEl, distEl);
    el.appendChild(row);
  });
}

function renderAnalyzerResult(q) {
  const wrap = document.getElementById("analyzer-result");
  if (!wrap) return;
  wrap.hidden = false;

  document.getElementById("analyzer-ticker-out").textContent = q.ticker;
  document.getElementById("analyzer-name-out").textContent = q.name;
  document.getElementById("analyzer-price-out").textContent = fmtUSD2(q.price);

  const changeEl = document.getElementById("analyzer-change-out");
  changeEl.className = `chip ${q.changePercent >= 0 ? "chip-up" : "chip-down"}`;
  changeEl.textContent = `${q.change >= 0 ? "+" : "-"}${fmtUSD2(Math.abs(q.change))} (${fmtPct(q.changePercent, 2)})`;

  const score = gameMomentumScore(q);
  const color = scoreColor(score);
  document.getElementById("analyzer-score-out").textContent = score === null ? "—" : score;
  document.getElementById("analyzer-gauge").style.background =
    score === null ? "var(--cream-100)" : `conic-gradient(${color} 0% ${score}%, var(--cream-100) ${score}% 100%)`;
  const labelEl = document.getElementById("analyzer-label-out");
  labelEl.textContent = scoreLabel(score);
  labelEl.style.color = color;

  const hasRange = typeof q.weekLow52 === "number" && typeof q.weekHigh52 === "number" && q.weekHigh52 > q.weekLow52;
  const rangeWrap = document.getElementById("analyzer-range-wrap");
  if (hasRange) {
    rangeWrap.hidden = false;
    const rangePct = clamp(((q.price - q.weekLow52) / (q.weekHigh52 - q.weekLow52)) * 100, 0, 100);
    document.getElementById("analyzer-range-marker").style.left = `${rangePct}%`;
    document.getElementById("analyzer-range-low").textContent = fmtUSD2(q.weekLow52);
    document.getElementById("analyzer-range-high").textContent = fmtUSD2(q.weekHigh52);
  } else {
    rangeWrap.hidden = true;
  }

  const bulletsEl = document.getElementById("analyzer-bullets");
  bulletsEl.innerHTML = "";
  buildTechnicalReadBullets(q, score).forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    bulletsEl.appendChild(li);
  });

  const sr = computeSupportResistance(q.series || [], q.price, q.weekLow52, q.weekHigh52);
  document.getElementById("analyzer-sr-price").textContent = `Current price: ${fmtUSD2(q.price)}`;
  renderAnalyzerSrColumn("analyzer-resistance", "Resistance", sr.resistances, q.price, true);
  renderAnalyzerSrColumn("analyzer-support", "Support", sr.supports, q.price, false);
}

function initStockAnalyzer() {
  const form = document.getElementById("analyzer-form");
  const tickerInput = document.getElementById("analyzer-ticker");
  const btn = document.getElementById("analyzer-btn");
  const feedbackEl = document.getElementById("analyzer-feedback");
  const resultBox = document.getElementById("analyzer-result");
  if (!form) return;

  attachGameTickerPreview(tickerInput, "analyzer-preview");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ticker = tickerInput.value.trim().toUpperCase();
    if (!/^[A-Z][A-Z.\-]{0,9}$/.test(ticker)) {
      feedbackEl.textContent = "Enter a valid ticker symbol first (e.g. AAPL).";
      feedbackEl.classList.add("down");
      return;
    }
    btn.disabled = true;
    feedbackEl.classList.remove("down");
    feedbackEl.textContent = `Pulling ${ticker}'s live price…`;
    resultBox.hidden = true;
    try {
      const quote = await fetchGameQuote(ticker);
      feedbackEl.textContent = "";
      renderAnalyzerResult(quote);
    } catch (err) {
      feedbackEl.textContent = err.message || "Something went wrong — try again.";
      feedbackEl.classList.add("down");
    } finally {
      btn.disabled = false;
    }
  });
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
  const liveIndicator = document.getElementById("game-live-indicator");
  if (liveIndicator) liveIndicator.hidden = gameState.positions.length === 0;
  body.innerHTML = "";
  if (!gameState.positions.length) {
    const row = document.createElement("tr");
    row.className = "game-empty-row";
    row.innerHTML = `<td colspan="7">No positions yet — buy your first pick above.</td>`;
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

    const momentumCell = document.createElement("td");
    const score = gameMomentumScore(p);
    if (score !== null) {
      const badge = document.createElement("span");
      badge.className = "game-momentum-badge";
      badge.textContent = `${score} · ${scoreLabel(score)}`;
      badge.style.color = scoreColor(score);
      momentumCell.appendChild(badge);
    } else {
      momentumCell.textContent = "—";
    }
    row.appendChild(momentumCell);

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

function setGameQuotePreview(elId, message, kind = "neutral") {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("down", kind === "down");
}

// Builds the success-state preview with DOM APIs rather than innerHTML —
// quote.name comes straight from Yahoo Finance (third-party data), so it's
// treated the same as the site's breaking-news headlines: never parsed as
// HTML, even though the odds of anything malicious in a ticker's shortName
// are low.
function renderGameQuotePreviewSuccess(elId, quote) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.classList.remove("down");
  el.textContent = "";
  el.appendChild(document.createTextNode(`${quote.ticker} · ${quote.name} · ${fmtUSD2(quote.price)}`));

  const score = gameMomentumScore(quote);
  if (score !== null) {
    el.appendChild(document.createTextNode(" · Momentum "));
    const badge = document.createElement("strong");
    badge.textContent = `${score}/100 (${scoreLabel(score)})`;
    badge.style.color = scoreColor(score);
    el.appendChild(badge);
  }
}

// Debounced ticker -> quote preview, shared by the buy form and the
// backtest form: shows the resolved company name (and today's momentum)
// as soon as a valid-looking ticker is typed, so a mistyped/confused
// symbol (ARM vs AMR, PSX vs PVX) is obvious before committing to it.
function attachGameTickerPreview(inputEl, previewElId, onResolved) {
  let timer = null;
  let token = 0;
  inputEl.addEventListener("input", () => {
    const ticker = inputEl.value.trim().toUpperCase();
    clearTimeout(timer);
    if (!/^[A-Z][A-Z.\-]{0,9}$/.test(ticker)) {
      setGameQuotePreview(previewElId, "");
      return;
    }
    timer = setTimeout(async () => {
      const myToken = ++token;
      setGameQuotePreview(previewElId, `Looking up ${ticker}…`);
      try {
        const quote = await fetchGameQuote(ticker);
        if (myToken !== token) return; // a newer lookup superseded this one
        renderGameQuotePreviewSuccess(previewElId, quote);
        onResolved?.(ticker, quote);
      } catch (err) {
        if (myToken !== token) return;
        setGameQuotePreview(previewElId, err.message || `Couldn't find "${ticker}".`, "down");
      }
    }, 500);
  });
}

function tickGamePrices() {
  if (!gameState.positions.length) return;
  gameState.positions.forEach((p) => {
    // Stepping with price *= (1 + uniform(-s, s)) looks symmetric but isn't:
    // compounding a "fair" +/-X% swing repeatedly has a built-in downward
    // drag (the same reason +10% then -10% nets -1%, not 0%). Stepping in
    // log-space instead (price *= e^step) removes that drag, so this is a
    // genuinely unbiased random walk rather than one quietly rigged to lose.
    const step = (Math.random() - 0.5) * 2 * GAME_TICK_MAX_STEP_PCT;
    p.currentPrice = Math.max(0.01, p.currentPrice * Math.exp(step));
  });
  renderGameStats();
  renderGamePositions();
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
  let lastPreview = null; // { ticker, quote }
  attachGameTickerPreview(tickerInput, "game-quote-preview", (ticker, quote) => {
    lastPreview = { ticker, quote };
  });

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
        existing.weekLow52 = quote.weekLow52;
        existing.weekHigh52 = quote.weekHigh52;
        existing.ytdReturnPercent = quote.ytdReturnPercent;
        existing.oneYearReturnPercent = quote.oneYearReturnPercent;
      } else {
        gameState.positions.push({
          ticker: quote.ticker,
          name: quote.name,
          shares,
          entryPrice: quote.price,
          currentPrice: quote.price,
          weekLow52: quote.weekLow52,
          weekHigh52: quote.weekHigh52,
          ytdReturnPercent: quote.ytdReturnPercent,
          oneYearReturnPercent: quote.oneYearReturnPercent,
        });
      }
      gameState.cash -= amount;
      setGameFeedback(`Bought ${shares.toFixed(4)} shares of ${quote.ticker} at ${fmtUSD2(quote.price)}.`, "up");
      tickerInput.value = "";
      amountInput.value = "";
      lastPreview = null;
      setGameQuotePreview("game-quote-preview", "");
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
      setGameFeedback("No positions to sync yet.");
      return;
    }
    refreshBtn.disabled = true;
    setGameFeedback("Pulling the real current quote for each position…");
    const results = await Promise.allSettled(gameState.positions.map((p) => fetchGameQuote(p.ticker)));
    let okCount = 0;
    results.forEach((res, i) => {
      if (res.status === "fulfilled") {
        const p = gameState.positions[i];
        p.currentPrice = res.value.price;
        p.weekLow52 = res.value.weekLow52;
        p.weekHigh52 = res.value.weekHigh52;
        p.ytdReturnPercent = res.value.ytdReturnPercent;
        p.oneYearReturnPercent = res.value.oneYearReturnPercent;
        okCount++;
      }
    });
    setGameFeedback(
      `Synced ${okCount}/${gameState.positions.length} position${gameState.positions.length === 1 ? "" : "s"} to the real market price — simulation continues from there.`
    );
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
    setGameQuotePreview("game-quote-preview", "");
    setGameFeedback("Game reset — back to $10,000 virtual cash.");
    renderGameStats();
    renderGamePositions();
  });

  renderGameStats();
  renderGamePositions();
  setInterval(tickGamePrices, GAME_TICK_MS);
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

function renderYoutubeGrid(videos) {
  const wrap = document.getElementById("youtube-grid");
  if (!wrap) return;
  wrap.innerHTML = "";

  videos.forEach((v) => {
    const href = safeHttpUrl(v.url);
    if (!href) return;

    const a = document.createElement("a");
    a.className = "youtube-card reveal";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";

    const thumbWrap = document.createElement("span");
    thumbWrap.className = "youtube-thumb-wrap";

    const imgUrl = safeHttpUrl(v.thumbnail);
    if (imgUrl) {
      const img = document.createElement("img");
      img.className = "youtube-thumb";
      img.src = imgUrl;
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      thumbWrap.appendChild(img);
    }

    const playBadge = document.createElement("span");
    playBadge.className = "youtube-play-badge";
    playBadge.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5Z"/></svg>';
    thumbWrap.appendChild(playBadge);

    const title = document.createElement("span");
    title.className = "youtube-title";
    title.textContent = v.title;

    a.appendChild(thumbWrap);
    a.appendChild(title);
    wrap.appendChild(a);
  });

  observeReveals();
}

async function loadYoutube() {
  const wrap = document.getElementById("youtube-grid");
  const updatedEl = document.getElementById("youtube-updated");
  if (!wrap) return;
  try {
    const res = await fetch("data/youtube.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const videos = Array.isArray(data.videos) ? data.videos : [];

    if (!videos.length) {
      wrap.innerHTML = `<p class="news-empty">No videos available right now — check back soon.</p>`;
    } else {
      renderYoutubeGrid(videos);
    }

    if (updatedEl) {
      updatedEl.textContent = data.updatedAt ? `Updated ${fmtUpdatedAt(data.updatedAt)}` : "";
    }
  } catch (err) {
    wrap.innerHTML = `<p class="news-empty">Couldn't load the latest videos right now.</p>`;
    console.error("Failed to load data/youtube.json:", err);
  }
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
  const statCount2 = document.getElementById("stat-count-2");
  if (statCount2) statCount2.textContent = HOLDINGS.length;
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
  initGameBacktest();
  initStockAnalyzer();
  loadLiveQuotes();
  loadNews();
  loadCharts();
  loadYoutube();
});
