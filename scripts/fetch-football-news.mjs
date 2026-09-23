// Fetches football headlines from Google News RSS and writes
// data/football-news.json. Runs server-side inside the GitHub Actions
// runner (see .github/workflows/update-football-news.yml) — the site itself
// only ever reads the resulting static JSON.
//
// Why Google News rather than a sports API: it needs no key, no plan and no
// per-league entitlement, which is exactly what stopped the Sportmonks route
// working. The trade-off is that it returns headlines and links only, with
// no photographs — so the page leads each card with the club crest it
// already draws instead of a publisher's image it has no licence to.
//
// Stories are tagged to teams by matching the headline against the team
// names this site knows, plus the short forms newspapers actually print
// ("Man Utd", "Spurs", "Barca"). A story mentioning none of them is dropped:
// the brief is football relevant to THIS board, not football in general.

import fs from "node:fs/promises";

const DATA = JSON.parse(
  await fs.readFile(new URL("../data/moneyball-fixtures.json", import.meta.url), "utf8")
);

/* Competition queries. One per league keeps the request count in the teens
   while still covering every team on the board. */
const COMPETITIONS = [
  { id: "epl",         q: "Premier League" },
  { id: "laliga",      q: "La Liga" },
  { id: "seriea",      q: "Serie A" },
  { id: "bundesliga",  q: "Bundesliga" },
  { id: "ligue1",      q: "Ligue 1" },
  { id: "ucl",         q: "Champions League" },
  { id: "unl-a",       q: "UEFA Nations League" },
  { id: "championship",q: "EFL Championship" },
  { id: "transfer",    q: "football transfer news" },
  { id: "injury",      q: "football injury news team" }
];

/* Short forms a headline is likely to use instead of the full club name. */
const ALIASES = {
  manutd: ["man utd", "man united", "manchester utd", "red devils"],
  mancity: ["man city", "man. city"],
  tottenham: ["spurs"],
  barcelona: ["barca", "barça"],
  realmadrid: ["madrid"],
  atletico: ["atleti", "atletico"],
  psg: ["paris st germain", "paris saint-germain", "paris sg"],
  bayern: ["bayern"],
  dortmund: ["bvb"],
  inter: ["inter milan", "nerazzurri"],
  acmilan: ["ac milan", "milan"],
  juventus: ["juve"],
  wolves: ["wolverhampton"],
  brighton: ["brighton"],
  nottingham: ["nott'm forest", "notts forest"],
  bournemouth: ["afc bournemouth"],
  newcastle: ["magpies"],
  liverpool: ["reds"],
  arsenal: ["gunners"],
  chelsea: ["blues"],
  everton: ["toffees"]
};

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/* Build the match list once: longest names first, so "Inter Milan" is tested
   before "Inter" and a story about Inter Milan is not tagged to both. */
const MATCHERS = [];
for (const [key, t] of Object.entries(DATA.teams)) {
  const names = new Set([norm(t.name)]);
  (ALIASES[key] || []).forEach((a) => names.add(norm(a)));
  for (const n of names) {
    if (n.length >= 4) MATCHERS.push({ key, name: t.name, needle: n });
  }
}
MATCHERS.sort((a, b) => b.needle.length - a.needle.length);

function tagTeams(headline) {
  const hay = " " + norm(headline) + " ";
  const hit = [];
  /* Once a stretch of the headline has been claimed, nothing shorter may
     match inside it. Without this, "Inter Milan" is tagged to Inter AND to
     Milan, because "milan" is how papers write AC Milan. Longest needle
     first plus claimed ranges gets both cases right. */
  const claimed = [];
  const overlaps = (a, b) => claimed.some((c) => a < c[1] && b > c[0]);

  for (const m of MATCHERS) {
    if (hit.includes(m.key)) continue;
    const needle = " " + m.needle + " ";
    let from = 0, at;
    while ((at = hay.indexOf(needle, from)) !== -1) {
      const start = at + 1, end = start + m.needle.length;
      if (!overlaps(start, end)) {
        claimed.push([start, end]);
        hit.push(m.key);
        break;
      }
      from = at + 1;
    }
    if (hit.length >= 3) break;
  }
  return hit;
}

function decode(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function field(block, tag) {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  return m ? decode(m[1]) : null;
}

/* Google News prints "Headline - Publisher"; split the publisher back off so
   the card can show it the way a news app does. */
function splitPublisher(title, sourceTag) {
  if (sourceTag) return { title: title.replace(new RegExp("\\s*-\\s*" + sourceTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), "").trim(), publisher: sourceTag };
  const i = title.lastIndexOf(" - ");
  if (i > 20) return { title: title.slice(0, i).trim(), publisher: title.slice(i + 3).trim() };
  return { title, publisher: "Google News" };
}

async function fetchFeed(comp) {
  const url = "https://news.google.com/rss/search?q=" +
    encodeURIComponent(comp.q) + "&hl=en-US&gl=US&ceid=US:en";
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; moneyball-odds-bot/1.0)" }
  });
  if (!res.ok) throw new Error(`${comp.id}: HTTP ${res.status}`);
  const xml = await res.text();
  const items = xml.split(/<item>/i).slice(1);
  return items.map((raw) => {
    const rawTitle = field(raw, "title");
    const link = field(raw, "link");
    if (!rawTitle || !link) return null;
    const source = field(raw, "source");
    const { title, publisher } = splitPublisher(rawTitle, source);
    const pub = field(raw, "pubDate");
    const at = pub ? Date.parse(pub) : NaN;
    return {
      competition: comp.id,
      title,
      publisher,
      link,
      teams: tagTeams(title),
      publishedAt: isFinite(at) ? at : null
    };
  }).filter(Boolean);
}

async function main() {
  const results = await Promise.allSettled(COMPETITIONS.map(fetchFeed));
  let items = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...r.value);
    else console.error(`Failed: ${COMPETITIONS[i].id}:`, r.reason?.message || r.reason);
  });

  const ok = results.filter((r) => r.status === "fulfilled").length;
  console.log(`${ok}/${COMPETITIONS.length} feeds fetched, ${items.length} raw items.`);

  /* A live feed that silently empties is worse than a stale one: the page
     would look broken with no way to tell why. Keep the previous file. */
  if (!items.length) {
    console.error("No items at all — leaving the existing file untouched.");
    process.exitCode = 1;
    return;
  }

  // The same story is syndicated under several queries; de-dupe by link,
  // then by headline, keeping the first (highest-ranked) copy.
  const seenLink = new Set(), seenTitle = new Set();
  items = items.filter((it) => {
    const t = norm(it.title);
    if (seenLink.has(it.link) || seenTitle.has(t)) return false;
    seenLink.add(it.link); seenTitle.add(t);
    return true;
  });

  // Only stories about teams on this board.
  const tagged = items.filter((it) => it.teams.length);
  tagged.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));

  const out = {
    generatedAt: Date.now(),
    source: "Google News RSS",
    teamsKnown: Object.keys(DATA.teams).length,
    counts: { raw: items.length, tagged: tagged.length },
    items: tagged.slice(0, 60)
  };

  await fs.writeFile(
    new URL("../data/football-news.json", import.meta.url),
    JSON.stringify(out, null, 2) + "\n"
  );
  console.log(`Wrote ${out.items.length} tagged stories (of ${items.length} unique).`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
