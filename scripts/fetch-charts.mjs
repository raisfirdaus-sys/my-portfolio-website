// Fetches multi-timeframe price history for each of the 11 holdings from
// Yahoo Finance's public chart endpoint (the same one fetch-quotes.mjs
// already uses successfully) and writes data/charts.json. Runs server-side
// inside the GitHub Actions runner (see .github/workflows/update-charts.yml).
//
// "1H" isn't a native Yahoo range, so it's derived client-side by slicing
// the last hour out of the "1D" (intraday) series rather than fetched
// separately.

const TICKERS = ["DDOG", "MA", "ABBV", "V", "AMZN", "JNJ", "PEP", "GILD", "SBUX", "KO", "MNST"];

const RANGE_SPECS = [
  { key: "1D", range: "1d", interval: "5m" },
  { key: "5D", range: "5d", interval: "15m" },
  { key: "1M", range: "1mo", interval: "1d" },
  { key: "3M", range: "3mo", interval: "1d" },
  { key: "YTD", range: "ytd", interval: "1d" },
  { key: "5Y", range: "5y", interval: "1wk" },
  { key: "MAX", range: "max", interval: "3mo" },
];

const UA = "Mozilla/5.0 (compatible; rais-firdaus-portfolio-bot/1.0)";

async function fetchSeries(ticker, spec) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${spec.interval}&range=${spec.range}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${ticker} ${spec.key}: HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];
  // [timestamp, close] pairs, seconds since epoch — kept compact since this
  // file covers 11 tickers x 7 ranges.
  return timestamps
    .map((t, i) => [t, closes[i]])
    .filter((p) => typeof p[1] === "number");
}

// Fetch one ticker's ranges sequentially (rather than all 77 requests at
// once) to avoid bursting Yahoo with a spike of concurrent requests from
// the same IP; the 11 tickers themselves still run concurrently.
async function fetchTicker(ticker) {
  const series = {};
  for (const spec of RANGE_SPECS) {
    try {
      series[spec.key] = await fetchSeries(ticker, spec);
    } catch (err) {
      console.error(`Failed to fetch ${ticker} ${spec.key}:`, err.message || err);
    }
  }
  return series;
}

async function main() {
  const fs = await import("node:fs/promises");
  const outPath = new URL("../data/charts.json", import.meta.url);

  const results = await Promise.allSettled(TICKERS.map(fetchTicker));
  const series = {};
  results.forEach((result, i) => {
    const ticker = TICKERS[i];
    if (result.status === "fulfilled") {
      series[ticker] = result.value;
    } else {
      console.error(`Failed to fetch charts for ${ticker}:`, result.reason?.message || result.reason);
    }
  });

  const output = { updatedAt: new Date().toISOString(), series };
  await fs.writeFile(outPath, JSON.stringify(output) + "\n");
  console.log(`Wrote chart series for ${Object.keys(series).length} tickers to data/charts.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
