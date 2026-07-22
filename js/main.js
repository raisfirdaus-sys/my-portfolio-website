/* ==========================================================================
   Rais Firdaus — US Stock Portfolio
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
          <a class="sym" href="${h.website}" target="_blank" rel="noopener">
            <span class="mini-badge logo-badge">${companyLogoHTML(h)}</span>
            ${h.ticker}
          </a>
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
    <div class="sector-row">
      <div>
        <div class="sr-name">${g.name}</div>
        <div class="sr-tickers">${g.tickers.join(" · ")}</div>
      </div>
      <span class="sr-arrow">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7M17 7H8M17 7v9"/></svg>
      </span>
    </div>`
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

function renderHoldingsReport() {
  const wrap = document.getElementById("report-table-body");
  if (!wrap) return;
  const sorted = [...HOLDINGS].sort((a, b) => b.weight - a.weight);
  wrap.innerHTML = sorted
    .map((h) => {
      const price = h.livePrice ? `$${h.livePrice.toFixed(2)}` : `$${h.value.toFixed(2)}`;
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
        <td class="rp-num">${price}</td>
        <td class="rp-num">${h.weight.toFixed(1)}%</td>
        <td class="rp-num">${fmtSignedPct(h.changePct)}</td>
        <td class="rp-num">${fmtSignedPct(h.oneYearReturnPercent)}</td>
        <td class="rp-num">${fmtSignedPct(h.ytdReturnPercent)}</td>
      </tr>`;
    })
    .join("");
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
// Scroll reveal + bar fill animation
// ---------------------------------------------------------------------------
let revealObserver = null;

// Re-scans for .reveal elements that aren't observed/visible yet. Needed
// because loadLiveQuotes() re-renders holding cards after the initial
// reveal pass, which would otherwise leave the fresh nodes stuck invisible.
function observeReveals() {
  if (!revealObserver) return;
  document.querySelectorAll(".reveal:not(.in-view)").forEach((el) => revealObserver.observe(el));
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
      }
    });

    renderTickerTape();
    renderHeroList();
    renderHoldingCards();
    renderHoldingsReport();
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
let perfTargets = { total: null, net: null, oneY: null, ytd: null };

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

function maybeAnimatePerf() {
  if (perfAnimated || !perfInView || !perfDataReady) return;
  perfAnimated = true;
  animateCountUp("perf-total", perfTargets.total, { kind: "usd" });
  animateCountUp("perf-net", perfTargets.net, { kind: "usd" });
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
    net: typeof portfolio.totalUSD === "number" ? portfolio.totalUSD : null,
    oneY: portfolio.oneYearReturnPercent,
    ytd: portfolio.ytdReturnPercent,
  };
  setPerfValue("perf-1y", portfolio.oneYearReturnPercent);
  setPerfValue("perf-ytd", portfolio.ytdReturnPercent);
  if (typeof portfolio.oneYearReturnPercent !== "number") {
    const el = document.getElementById("perf-1y");
    if (el) el.textContent = "—";
  }
  if (typeof portfolio.ytdReturnPercent !== "number") {
    const el = document.getElementById("perf-ytd");
    if (el) el.textContent = "—";
  }

  perfDataReady = true;
  if (perfAnimated) {
    // A later refresh (30-min cron) after the first animation already
    // played — just update the numbers directly, no need to re-animate.
    const totalEl = document.getElementById("perf-total");
    const netEl = document.getElementById("perf-net");
    if (totalEl && perfTargets.total !== null) totalEl.textContent = fmtUSD(perfTargets.total);
    if (netEl && perfTargets.net !== null) netEl.textContent = fmtUSD(perfTargets.net);
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
  renderHoldingsReport();
  renderGrowthChart();
  initGrowthChartReveal();
  renderPortraitStats();
  renderSectorList();
  renderSectorRadar();
  initPillarTabs();
  initNavToggle();

  document.querySelectorAll(".section-head, .letter-card, .cta-band").forEach((el) =>
    el.classList.add("reveal")
  );

  initReveal();
  initPerfInViewObserver();
  loadLiveQuotes();
});
