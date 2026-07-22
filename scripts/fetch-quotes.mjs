// Fetches the latest quote for each ticker from Yahoo Finance's public
// chart endpoint and writes data/quotes.json. Runs server-side inside the
// GitHub Actions runner (see .github/workflows/update-quotes.yml), so
// there's no CORS or API-key concern — the site itself just reads the
// resulting static JSON file.

const TICKERS = ["MU", "GEV", "MA", "ABBV", "V", "JNJ", "VLO", "PG", "GILD", "MNST", "KO"];

async function fetchQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; rais-firdaus-portfolio-bot/1.0)" },
  });
  if (!res.ok) throw new Error(`${ticker}: HTTP ${res.status}`);
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") {
    throw new Error(`${ticker}: unexpected response shape`);
  }
  const price = meta.regularMarketPrice;
  const prevClose = meta.previousClose ?? meta.chartPreviousClose;
  const change = prevClose ? price - prevClose : 0;
  const changePercent = prevClose ? (change / prevClose) * 100 : 0;
  return { price, change, changePercent };
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

  const output = { updatedAt: new Date().toISOString(), quotes };
  await fs.writeFile(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`Wrote ${Object.keys(quotes).length} quotes to data/quotes.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
