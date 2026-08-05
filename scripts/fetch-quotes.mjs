// Fetches the latest quote for each ticker from Yahoo Finance's public
// chart endpoint and writes data/quotes.json. Runs server-side inside the
// GitHub Actions runner (see .github/workflows/update-quotes.yml), so
// there's no CORS or API-key concern — the site itself just reads the
// resulting static JSON file.
//
// Each ticker request pulls a full year of daily closes (not just today's
// quote) so we can derive real 1-year and year-to-date returns instead of
// making those up. If a holding ever lacks a full year of history (e.g. a
// recent IPO/spin-off), the "1-year" figure simply falls back to the return
// since the earliest available close.

const TICKERS = ["MA", "PLTR", "MSFT", "ABBV", "V", "GOOGL", "AMZN", "JNJ", "DDOG", "GILD", "SBUX", "KO"];

// Real share count currently held for each ticker (source of truth: broker
// screenshots as of the last manual portfolio update — keep in sync with
// the `shares` field on each HOLDINGS entry in js/main.js). This is what
// lets the portfolio totals below match the actual brokerage account
// instead of the "1 share of everything" simplification this used to be.
const SHARES = {
  MA: 1.033704517,
  PLTR: 4,
  MSFT: 1.020412387,
  ABBV: 2,
  V: 1.077276398,
  GOOGL: 1,
  AMZN: 1.268422079,
  JNJ: 1.276856691,
  DDOG: 1.038768015,
  GILD: 1,
  SBUX: 1,
  KO: 1.08,
};

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
  const latestCandidate = priceCandidates.reduce((a, b) => (b.time > a.time ? b : a));
  const price = latestCandidate.price;

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const series = timestamps
    .map((t, i) => ({ t, c: closes[i] }))
    .filter((p) => typeof p.c === "number");

  const pctFrom = (base) => (typeof base === "number" && base ? ((price - base) / base) * 100 : null);

  // Naively counting back from the end of the series (e.g. "length-2 is
  // yesterday") breaks in two different ways depending on whether today's
  // candle has been backfilled into the series yet by fetch time, and a
  // fixed "gap in hours" heuristic to distinguish those cases turned out to
  // have its own failure mode: over a weekend, Yahoo's meta block just
  // carries Friday's stale close forward, so a run on the actual next
  // trading day can end up comparing today's session against the wrong
  // reference point instead of the last real trading day. Sidestep all of
  // that by asking the only question that actually matters — "what was the
  // close on the last trading day *before* today, in the exchange's own
  // calendar?" — using real calendar dates (America/New_York, where the
  // NYSE/Nasdaq trading day boundary actually falls) rather than a raw
  // elapsed-hours proxy. This naturally skips weekends/holidays and doesn't
  // care whether today's own candle is already in the series or not. This
  // was previously wrong in both magnitude and sign (e.g. showing a stock
  // up when it had actually closed down, or comparing against a stale
  // multi-day-old close right after a weekend) without ever tripping the
  // original ">40% = glitch" safety net, since the errors were smaller than
  // that threshold.
  const nyDateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });
  const nyDate = (epochSeconds) => nyDateFormatter.format(new Date(epochSeconds * 1000));
  const todayNy = nyDate(latestCandidate.time);
  let prevClose = null;
  for (let i = series.length - 1; i >= 0; i--) {
    if (nyDate(series[i].t) < todayNy) {
      prevClose = series[i].c;
      break;
    }
  }
  prevClose = prevClose ?? meta.previousClose ?? meta.chartPreviousClose ?? null;
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

  // Portfolio-level aggregates, dollar-weighted by each holding's actual
  // position size (shares * price) — matches how a real brokerage totals
  // and weights a portfolio, so this lines up with the real account total
  // and gain% shown in the broker app instead of an abstract "1 share of
  // everything" figure.
  const priced = TICKERS.map((t) => ({ shares: SHARES[t] ?? 1, ...quotes[t] })).filter((q) => q.price);
  const totalUSD = priced.reduce((sum, q) => sum + q.shares * q.price, 0);
  const weightedReturn = (key) => {
    const withValue = priced.filter((q) => typeof q[key] === "number");
    const weightSum = withValue.reduce((sum, q) => sum + q.shares * q.price, 0);
    if (!withValue.length || !weightSum) return null;
    return withValue.reduce((sum, q) => sum + ((q.shares * q.price) / weightSum) * q[key], 0);
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
