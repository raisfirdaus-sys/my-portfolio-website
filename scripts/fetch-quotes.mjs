// Fetches the latest quote for each ticker from Yahoo Finance's public
// chart endpoint and writes data/quotes.json. Runs server-side inside the
// GitHub Actions runner (see .github/workflows/update-quotes.yml), so
// there's no CORS or API-key concern — the site itself just reads the
// resulting static JSON file.
//
// Each ticker request pulls a full year of daily closes (not just today's
// quote) so we can derive real 1-year and year-to-date returns instead of
// making those up. Some holdings (e.g. GEV, spun off in April 2024) don't
// have a full year of history yet — in that case the "1-year" figure is
// simply the return since the earliest available close.

const TICKERS = ["MU", "GEV", "MA", "ABBV", "V", "JNJ", "VLO", "PG", "GILD", "MNST", "KO"];

async function fetchQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; rais-firdaus-portfolio-bot/1.0)" },
  });
  if (!res.ok) throw new Error(`${ticker}: HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") {
    throw new Error(`${ticker}: unexpected response shape`);
  }

  // Yahoo's meta block carries up to three "current price" candidates —
  // regular session, pre-market, and post-market — each with its own
  // timestamp. Outside of regular trading hours, regularMarketPrice is
  // just stale (last session's close), so pick whichever candidate is
  // actually the most recent rather than always trusting regularMarketPrice.
  // This is what lets the site's "Today" change reflect a live pre-market
  // move instead of lagging behind it until the regular session opens.
  const priceCandidates = [
    { price: meta.regularMarketPrice, time: meta.regularMarketTime },
    { price: meta.postMarketPrice, time: meta.postMarketTime },
    { price: meta.preMarketPrice, time: meta.preMarketTime },
  ].filter((c) => typeof c.price === "number" && typeof c.time === "number");
  const price = priceCandidates.reduce((a, b) => (b.time > a.time ? b : a)).price;

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const series = timestamps
    .map((t, i) => ({ t, c: closes[i] }))
    .filter((p) => typeof p.c === "number");

  const pctFrom = (base) => (typeof base === "number" && base ? ((price - base) / base) * 100 : null);

  // meta.previousClose is Yahoo's own "prior trading session close" field —
  // it's computed server-side alongside regularMarketPrice, so it's always
  // aligned with the live `price` picked above. The daily close series,
  // by contrast, can lag by a day right after the market closes (Yahoo
  // sometimes takes a while to backfill "today"'s candle into the
  // historical array), which silently makes series[length-2] resolve to
  // an intraday price from *today* instead of yesterday's real close —
  // this previously produced changePercent values that were wrong in both
  // magnitude and sign (e.g. showing a stock up when it was actually down)
  // without ever exceeding the old ">40% = glitch" safety threshold, so it
  // went uncaught. Trust meta.previousClose first; only fall back to the
  // series (or chartPreviousClose) when meta doesn't have it.
  let prevClose = meta.previousClose ?? (series.length >= 2 ? series[series.length - 2].c : null) ?? meta.chartPreviousClose ?? null;
  let changePercent = pctFrom(prevClose);
  const change = typeof prevClose === "number" ? price - prevClose : 0;
  changePercent = changePercent ?? 0;

  // Unlike meta.previousClose (which caused the daily-change bug above),
  // these reference points come straight from the same daily-close series
  // used for the day-change calculation, so there's no equivalent "wrong
  // baseline" risk here — a genuinely huge multi-month rally (e.g. MU's
  // AI-memory-driven run) is a real return, not a data glitch, so it's
  // trusted as-is rather than capped/nulled.
  const oneYearAgoClose = series[0]?.c;
  const oneYearReturnPercent = pctFrom(oneYearAgoClose);

  const jan1 = Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000;
  const ytdStartClose = (series.find((p) => p.t >= jan1) || series[0])?.c;
  const ytdReturnPercent = pctFrom(ytdStartClose);

  const oneMonthAgo = Date.now() / 1000 - 30 * 24 * 60 * 60;
  const oneMonthAgoClose = (series.find((p) => p.t >= oneMonthAgo) || series[0])?.c;
  const oneMonthReturnPercent = pctFrom(oneMonthAgoClose);

  const weekLow52 = typeof meta.fiftyTwoWeekLow === "number" ? meta.fiftyTwoWeekLow : null;
  const weekHigh52 = typeof meta.fiftyTwoWeekHigh === "number" ? meta.fiftyTwoWeekHigh : null;

  return { price, change, changePercent, oneMonthReturnPercent, oneYearReturnPercent, ytdReturnPercent, weekLow52, weekHigh52 };
}

async function main() {
  const fs = await import("node:fs/promises");
  const outPath = new URL("../data/quotes.json", import.meta.url);

  let existing = { updatedAt: null, quotes: {} };
  try {
    existing = JSON.parse(await fs.readFile(outPath, "utf-8"));
  } catch {
    // no existing file yet, start fresh
  }

  const quotes = { ...existing.quotes };
  const results = await Promise.allSettled(TICKERS.map(fetchQuote));

  results.forEach((result, i) => {
    const ticker = TICKERS[i];
    if (result.status === "fulfilled") {
      quotes[ticker] = result.value;
    } else {
      console.error(`Failed to fetch ${ticker}:`, result.reason?.message || result.reason);
    }
  });

  // Portfolio-level aggregates, weighted by each holding's current price
  // (the site treats "one unit per ticker" throughout — see HOLDINGS in
  // js/main.js — so price itself doubles as the position weight).
  const priced = TICKERS.map((t) => quotes[t]).filter(Boolean);
  const totalUSD = priced.reduce((sum, q) => sum + q.price, 0);
  const weightedReturn = (key) => {
    const withValue = priced.filter((q) => typeof q[key] === "number");
    if (!withValue.length || !totalUSD) return null;
    return withValue.reduce((sum, q) => sum + (q.price / totalUSD) * q[key], 0);
  };

  const portfolio = {
    totalUSD,
    changePercent: weightedReturn("changePercent"),
    oneMonthReturnPercent: weightedReturn("oneMonthReturnPercent"),
    oneYearReturnPercent: weightedReturn("oneYearReturnPercent"),
    ytdReturnPercent: weightedReturn("ytdReturnPercent"),
  };

  const output = { updatedAt: new Date().toISOString(), quotes, portfolio };
  await fs.writeFile(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`Wrote ${Object.keys(quotes).length} quotes to data/quotes.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
