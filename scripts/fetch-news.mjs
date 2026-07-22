// Fetches recent news headlines for each of the 11 holdings from Yahoo
// Finance's public search endpoint (the same one yfinance-style tools use
// for ticker.news) and writes data/news.json. Runs server-side inside the
// GitHub Actions runner (see .github/workflows/update-news.yml) — the site
// itself just reads the resulting static JSON file.

const TICKERS = ["MU", "GEV", "MA", "ABBV", "V", "JNJ", "VLO", "PG", "GILD", "MNST", "KO"];

// Yahoo's search response includes a thumbnail.resolutions[] array (sizes
// vary per story, not every story has one at all) — prefer the "original"
// tag when present since that's usually the highest-quality/widest crop,
// otherwise fall back to whatever resolution is available.
function pickThumbnail(n) {
  const resolutions = n?.thumbnail?.resolutions;
  if (!Array.isArray(resolutions) || !resolutions.length) return null;
  const preferred = resolutions.find((r) => r.tag === "original") || resolutions[resolutions.length - 1];
  return typeof preferred?.url === "string" ? preferred.url : null;
}

async function fetchNewsForTicker(ticker) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${ticker}&newsCount=6&quotesCount=0`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; rais-firdaus-portfolio-bot/1.0)" },
  });
  if (!res.ok) throw new Error(`${ticker}: HTTP ${res.status}`);
  const json = await res.json();
  const news = Array.isArray(json?.news) ? json.news : [];
  return news
    .filter((n) => typeof n.title === "string" && typeof n.link === "string")
    .map((n) => ({
      ticker,
      title: n.title,
      publisher: typeof n.publisher === "string" ? n.publisher : "Yahoo Finance",
      link: n.link,
      image: pickThumbnail(n),
      publishedAt: typeof n.providerPublishTime === "number" ? n.providerPublishTime * 1000 : null,
    }));
}

async function main() {
  const fs = await import("node:fs/promises");
  const outPath = new URL("../data/news.json", import.meta.url);

  const results = await Promise.allSettled(TICKERS.map(fetchNewsForTicker));
  let items = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      console.error(`Failed to fetch news for ${TICKERS[i]}:`, result.reason?.message || result.reason);
    }
  });

  // The same story often gets tagged against more than one related ticker —
  // de-dupe by link so it doesn't show up twice in the feed.
  const seenLinks = new Set();
  items = items.filter((item) => {
    if (seenLinks.has(item.link)) return false;
    seenLinks.add(item.link);
    return true;
  });

  // Most recent first, capped so the section stays skimmable rather than
  // turning into an endless list.
  items.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  items = items.slice(0, 18);

  const output = { updatedAt: new Date().toISOString(), items };
  await fs.writeFile(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`Wrote ${items.length} news items to data/news.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
