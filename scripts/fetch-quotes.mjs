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

  const price = meta.regularMarketPrice;

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const series = timestamps
    .map((t, i) => ({ t, c: closes[i] }))
    .filter((p) => typeof p.c === "number");

  const pctFrom = (base) => (typeof base === "number" && base ? ((price - base) / base) * 100 : null);

  // Note: meta.previousClose / meta.chartPreviousClose refer to the close
  // just before the *requested range* (i.e. ~1 year ago here), not
  // yesterday's close — using them directly for the daily change would be
  // wrong. The second-to-last point in the daily series is normally the
  // real previous close; a >40% single-day move on any of these large-cap
  // names almost certainly means that point is a data glitch (stale/
  // duplicate entry), so fall back to whichever candidate looks saner
  // rather than publish an absurd number.
  let prevClose = series.length >= 2 ? series[series.length - 2].c : null;
  let changePercent = pctFrom(prevClose);
  if (changePercent === null || Math.abs(changePercent) > 40) {
    const metaPrev = meta.previousClose ?? meta.chartPreviousClose;
    const metaPct = pctFrom(metaPrev);
    if (metaPct !== null && Math.abs(metaPct) < Math.abs(changePercent ?? Infinity)) {
      prevClose = metaPrev;
      changePercent = metaPct;
    }
  }
  const change = typeof prevClose === "number" ? price - prevClose : 0;
  changePercent = changePercent ?? 0;

  const oneYearAgoClose = series[0]?.c;
  const oneYearReturnPercent = oneYearAgoClose ? ((price - oneYearAgoClose) / oneYearAgoClose) * 100 : null;

  const jan1 = Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000;
  const ytdStartClose = (series.find((p) => p.t >= jan1) || series[0])?.c;
  const ytdReturnPercent = ytdStartClose ? ((price - ytdStartClose) / ytdStartClose) * 100 : null;

  return { price, change, changePercent, oneYearReturnPercent, ytdReturnPercent };
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
