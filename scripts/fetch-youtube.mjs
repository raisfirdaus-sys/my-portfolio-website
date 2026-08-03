// Fetches the most recent videos from a single YouTube playlist ("Good
// Revenue: Wallstreet Decoded") via YouTube's public Atom feed endpoint —
// no API key needed, same no-credentials philosophy as the Yahoo Finance
// fetchers. Runs server-side inside the GitHub Actions runner (see
// .github/workflows/update-youtube.yml); the site itself just reads the
// resulting static JSON file.

const PLAYLIST_ID = "PLGC5zGgXQgsI";
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?playlist_id=${PLAYLIST_ID}`;

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseEntries(xml) {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  return entries
    .map((block) => {
      const videoId = block.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
      const title = block.match(/<title>(.*?)<\/title>/)?.[1];
      const published = block.match(/<published>(.*?)<\/published>/)?.[1];
      if (!videoId || !title) return null;
      return {
        videoId,
        title: decodeEntities(title),
        publishedAt: published || null,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        // Predictable thumbnail CDN path — more robust than scraping the
        // <media:thumbnail> url out of the feed, and always available.
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      };
    })
    .filter(Boolean);
}

async function main() {
  const fs = await import("node:fs/promises");
  const outPath = new URL("../data/youtube.json", import.meta.url);

  let existingVideos = [];
  try {
    existingVideos = JSON.parse(await fs.readFile(outPath, "utf-8")).videos || [];
  } catch {
    // no existing file yet, start fresh
  }

  // A failed fetch falls back to whatever the last successful run wrote,
  // rather than wiping the section blank until the next successful run.
  let videos = existingVideos;
  try {
    const res = await fetch(FEED_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; rais-firdaus-portfolio-bot/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const fetched = parseEntries(xml);
    if (fetched.length) videos = fetched;
  } catch (err) {
    console.error("Failed to fetch YouTube playlist feed:", err.message || err);
  }

  // Most recent first, capped so the section stays skimmable.
  videos.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  videos = videos.slice(0, 12);

  const output = {
    updatedAt: new Date().toISOString(),
    playlistId: PLAYLIST_ID,
    playlistUrl: `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`,
    videos,
  };
  await fs.writeFile(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`Wrote ${videos.length} YouTube videos to data/youtube.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
