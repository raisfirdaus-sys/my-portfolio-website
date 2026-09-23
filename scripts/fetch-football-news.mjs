// Fetches football headlines from Google News RSS and writes
// data/football-news.json. Runs server-side inside the GitHub Actions
// runner (see .github/workflows/update-football-news.yml) — the site itself
// only ever reads the resulting static JSON.
//
// Two sources, because neither is enough alone. Google News needs no key,
// no plan and no per-league entitlement - which is exactly what stopped the
// Sportmonks route working - and it reaches outlets nobody would think to
// list. But it hands over a headline and a redirect and nothing else: no
// picture, and its redirect no longer opens from a script, so the article
// page cannot be read either (measured: 60 lookups, 0 pictures).
//
// So the publishers' own feeds are read alongside it. Those carry the
// picture inside the feed, the same way Yahoo Finance does for the stock
// page, and link straight to the article. Where the same story arrives from
// both, the copy with a picture wins.
//
// Stories are tagged to teams by matching the headline against the team
// names this site knows, plus the short forms newspapers actually print
// ("Man Utd", "Spurs", "Barca"). A story mentioning none of them is dropped:
// the brief is football relevant to THIS board, not football in general.

import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

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

/* Publishers' own feeds, read alongside Google News.

   Google News is the wide net - it finds stories from outlets nobody would
   think to list - but it hands over a headline, a redirect and nothing
   else. No picture, and its redirect will not open from a script any more,
   so the article page cannot be read either. Measured on the runner: 60
   lookups, 60 failures, 0 pictures.

   A publisher's own feed hands over the picture inside the feed, the same
   way Yahoo Finance does for the stock page, and links straight to the
   article instead of through Google. So the stories come from both: Google
   for reach, these for pictures and honest links. Where the same story
   arrives twice, the copy with a picture wins.

   A feed that moves or dies is logged and skipped, so the list can be long
   without being fragile. */
const PUBLISHER_FEEDS = [
  { id: "bbc",      name: "BBC Sport",    url: "https://feeds.bbci.co.uk/sport/football/rss.xml" },
  { id: "sky",      name: "Sky Sports",   url: "https://www.skysports.com/rss/12040" },
  { id: "guardian", name: "The Guardian", url: "https://www.theguardian.com/football/rss" },
  { id: "tele",     name: "The Telegraph", url: "https://www.telegraph.co.uk/football/rss.xml" },
  { id: "indy",     name: "The Independent", url: "https://www.independent.co.uk/sport/football/rss" },
  { id: "mirror",   name: "Mirror Football", url: "https://www.mirror.co.uk/sport/football/?service=rss" },
  { id: "metro",    name: "Metro",        url: "https://metro.co.uk/sport/football/feed/" },
  { id: "90min",    name: "90min",        url: "https://www.90min.com/posts.rss" },
  { id: "talksport", name: "talkSPORT",   url: "https://talksport.com/football/feed/" },
  { id: "espn",     name: "ESPN",         url: "https://www.espn.com/espn/rss/soccer/news" },
  { id: "fitalia",  name: "Football Italia", url: "https://www.football-italia.net/feed" },
  { id: "bundes",   name: "Bundesliga",   url: "https://www.bundesliga.com/en/bundesliga/news/rss" },
  /* Reach plc's regional titles all answer ?service=rss, and their club
     desks file more often than the nationals - which is most of what a
     board full of English clubs wants. */
  { id: "footlondon", name: "football.london", url: "https://www.football.london/?service=rss" },
  { id: "men",      name: "Manchester Evening News", url: "https://www.manchestereveningnews.co.uk/sport/football/?service=rss" },
  { id: "echo",     name: "Liverpool Echo", url: "https://www.liverpoolecho.co.uk/sport/football/?service=rss" },
  { id: "chronicle", name: "Chronicle Live", url: "https://www.chroniclelive.co.uk/sport/football/?service=rss" },
  { id: "birmingham", name: "Birmingham Live", url: "https://www.birminghammail.co.uk/sport/football/?service=rss" }
];
/* Dropped after one run measured them: express.co.uk answers 403 to a
   script, and football365.com/feed, goal.com/feeds/en/news and
   tribalfootball.com/rss all answer 404. A dead feed only costs a logged
   line, but there is no reason to keep asking. */

/* Feeds used ONLY to build a blocklist, never to supply stories.
   The same clubs field women's and youth sides, and Google returns their
   results under the plain league queries above. Half the headlines a keyword
   filter lets through say nothing about which side played: "Bayern 2-2 Man
   City (Sep 22, 2026) Game Analysis", "Reaction: Bayern's Gwinn on
   'frustrating' draw". No wording test can catch those. But Google itself
   knows: ask it for the women's competition and it returns those very
   stories. So we ask, and drop anything that comes back. */
const EXCLUDE_FEEDS = [
  { id: "uwcl",      q: "UEFA Women's Champions League" },
  { id: "wsl",       q: "Women's Super League football" },
  { id: "wfoot",     q: "women's football" },
  { id: "youth",     q: "football U21 U19 youth academy" },
  { id: "frauen",    q: "Frauen Bundesliga" },
  { id: "ligaf",     q: "Liga F futbol femenino" },
  { id: "femminile", q: "Serie A Femminile" }
];

/* How many of the board's busiest clubs also get a women's-side query.
   Twelve covers the clubs that dominate the brief without turning one run
   into a hundred requests. */
const CLUB_BLOCK_QUERIES = 12;

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

/* Layer 1 of the competition filter, kept out of main() so the test can
   call it. ’ is the curly apostrophe Google returns about half the time;
   "wcl" covers the shorthand headlines use once the competition is known
   ("late WCL relief for Arsenal"), which the longer "uwcl" missed. */
export const OTHER_COMP =
  /\b(women['\u2019]?s?|wsl|u?wcl|nwsl|femenino|feminin[ae]?|femminile|frauen|damallsvenskan|u1[5-9]|u2[0-3]|youth|academy|reserves)\b/i;

/* Sports pages file on more than football, and a national team's name is
   exactly what tags those stories to this board: "Farewell Mark Wood,
   England's fastest ever bowler" arrived as an England story. These words
   do not appear in football writing. */
export const OTHER_SPORT =
  /\b(cricket|bowler|wicket|batsman|batting|innings|test match|odi|t20|rugby|scrum|six nations|nfl|super bowl|quarterback|nba|basketball|tennis|wimbledon|golf|pga|ryder cup|formula 1|f1 gp|grand prix|motogp|boxing|ufc|mma|olympic|athletics|cycling|tour de france|darts|snooker|baseball|mlb|nhl|ice hockey)\b/i;

export function isOtherSport(title) {
  return OTHER_SPORT.test(String(title || ""));
}

export function isOtherCompetition(title) {
  /* Strip accents first: Spanish and French headlines print "femenino" and
     "féminine" with and without them, and a word boundary would not match
     across the accented letter. */
  const flat = String(title || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return OTHER_COMP.test(flat);
}

/* Layer 2: ask Google for the competitions we do NOT want and remember what
   comes back, by headline and by link. A story is the same story under every
   query, so this catches the ones whose wording gives nothing away.

   It must never take the brief down with it: a feed that fails is logged
   and skipped, leaving layer 1 to do the work. A missing blocklist costs a
   few off-topic cards, which is the cheaper failure. */
async function buildBlocklist(feeds) {
  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const blocked = new Set();
  let ok = 0;
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") {
      console.error(`Blocklist feed failed: ${feeds[i].id}:`, r.reason?.message || r.reason);
      return;
    }
    ok++;
    for (const it of r.value) { blocked.add(norm(it.title)); blocked.add(it.link); }
  });
  console.log(`${ok}/${feeds.length} blocklist feeds fetched, ${blocked.size} entries.`);
  return blocked;
}

/* The standing queries above miss the club-level coverage: "Slegers praises
   Arsenal's resilience", "Man City fight back from two down to thwart
   Bayern". Both are women's matches; neither says so, and neither turned up
   under a competition-wide query.

   So ask about the clubs the brief is actually full of. Whichever teams
   dominate today's candidates get a women's-side query of their own, which
   means this keeps working when the board moves on to different clubs -
   nothing here is a list of names to maintain. */
export function busiestTeams(candidates, limit) {
  const freq = new Map();
  for (const it of candidates) {
    for (const key of it.teams) freq.set(key, (freq.get(key) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key]) => key);
}

/* ========================================================= pictures ====
   OneFootball leads every card with a photograph and a wall of crests does
   not read the same way, so each published story gets one.

   The feed carries none, so the picture has to come off the article itself:
   og:image, the image a publisher nominates for links to its own page. That
   is what it is published for - it is the same picture that appears when
   the article is shared anywhere else - and the card links straight back to
   the publisher and credits it by name. No image is copied or re-hosted;
   the browser loads it from the publisher, and a card whose image will not
   load falls back to the crest layout that shipped before.

   Cost control, because this runs unattended every half hour: only the ~60
   stories that actually get published are opened, images already resolved
   in the previous run are reused by link, each request is capped in time
   and in bytes read, and the whole phase gives up at a deadline. Every one
   of those failures ends in a crest, never in a broken run. */

const IMG_CONCURRENCY = 6;
const IMG_TIMEOUT_MS = 9000;
const IMG_PHASE_MS = 150000;
const IMG_READ_BYTES = 262144;      // og: tags live in <head>; never read a whole page
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/* Google News links are redirects. The older ones carry the publisher URL
   inside the base64 payload, which saves a request and a redirect when it
   works; scanning the decoded bytes for "http" is deliberately looser than
   parsing the protobuf, because the surrounding format has changed before
   and the URL is the only part worth having. */
export function decodeGoogleLink(link) {
  const m = /\/rss\/articles\/([A-Za-z0-9_-]+)/.exec(String(link || ""));
  if (!m) return null;
  let raw;
  try {
    raw = Buffer.from(m[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("latin1");
  } catch { return null; }
  const at = raw.search(/https?:\/\//);
  if (at < 0) return null;
  const url = raw.slice(at).split(/[^\x20-\x7e]/)[0].trim();
  return /^https?:\/\/[^\s"'<>]+$/.test(url) ? url : null;
}

/* When the link does not decode, Google serves a page that points at the
   publisher instead. data-n-au holds it outright; failing that, take the
   first URL on the page that is not Google's own furniture. */
export function publisherUrlFromGooglePage(html) {
  const text = String(html || "");
  const direct = /data-n-au=["'](https?:\/\/[^"']+)["']/i.exec(text);
  if (direct) return direct[1];
  const own = /(^|\.)(google|gstatic|googleapis|googleusercontent|youtube|ggpht)\.[a-z.]+$/i;
  const meta = /(^|\.)(w3\.org|schema\.org|whatwg\.org)$/i;
  const re = /https?:\/\/[^\s"'<>\\)]+/g;
  let m;
  while ((m = re.exec(text))) {
    let u;
    try { u = new URL(m[0]); } catch { continue; }
    if (own.test(u.hostname) || meta.test(u.hostname)) continue;
    return u.href;
  }
  return null;
}

/* The publisher's own nomination, in the order publishers set it. */
export function extractOgImage(html, baseUrl) {
  const head = String(html || "").slice(0, IMG_READ_BYTES);
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url|:url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i,
    /<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/i
  ];
  for (const re of patterns) {
    const m = re.exec(head);
    if (!m) continue;
    const abs = absoluteHttpUrl(decode(m[1]).trim(), baseUrl);
    if (abs) return abs;
  }
  return null;
}

/* A relative og:image is common; a data: URI would be embedded in the page
   we publish, so only http(s) survives. */
export function absoluteHttpUrl(candidate, baseUrl) {
  if (!candidate) return null;
  let u;
  try { u = baseUrl ? new URL(candidate, baseUrl) : new URL(candidate); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  return u.href;
}

/* Read only the head of the response: enough for the meta tags, and it
   stops a photo-heavy article page from being pulled down in full. */
async function readCapped(res) {
  if (!res.body) return (await res.text()).slice(0, IMG_READ_BYTES);
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  try {
    while (got < IMG_READ_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
      got += value.length;
    }
  } catch { /* a truncated page is still worth parsing */ }
  try { await reader.cancel(); } catch { /* already closed */ }
  return Buffer.concat(chunks).toString("utf8");
}

async function getPage(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), IMG_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml,*/*" }
    });
    if (!res.ok) return null;
    return { url: res.url || url, html: await readCapped(res) };
  } catch {
    return null;                       // timeout, TLS, DNS, paywall redirect loop
  } finally {
    clearTimeout(timer);
  }
}

/* Measured on the runner, 23 Sep 2026: all 60 of these came back in 1.1s
   with nothing to read - one failed round trip each. Google does not serve
   its redirect links to a plain GET any more, so the article page is never
   reached and no picture can be read off it.

   Until that is solved, asking is 60 pointless requests to Google every
   half hour, so a link we know will fail is not fetched at all. Everything
   below still works for a link that points straight at a publisher, which
   is the shape the fix will produce. */
function isGoogleRedirect(link) {
  try { return /(^|\.)news\.google\.com$/i.test(new URL(link).hostname); }
  catch { return false; }
}

async function articleImage(link) {
  const decoded = decodeGoogleLink(link);
  const start = decoded || link;
  if (isGoogleRedirect(start)) return null;        // known to fail; do not ask

  let page = await getPage(start);
  if (!page) return null;

  let host = "";
  try { host = new URL(page.url).hostname; } catch { return null; }

  if (/(^|\.)news\.google\.com$/i.test(host)) {
    const real = publisherUrlFromGooglePage(page.html);
    if (!real) return null;
    page = await getPage(real);
    if (!page) return null;
  }
  return extractOgImage(page.html, page.url);
}

/* Images already resolved in the previous run are reused by link, so a
   steady feed costs a handful of requests rather than sixty. */
async function attachImages(stories, previousItems) {
  const known = new Map();
  for (const it of previousItems) {
    if (it && it.link && it.image) known.set(it.link, it.image);
  }

  const deadline = Date.now() + IMG_PHASE_MS;
  const tally = { fromFeed: 0, found: 0, reused: 0, missing: 0, skipped: 0 };
  let next = 0;

  async function worker() {
    while (next < stories.length) {
      const it = stories[next++];
      if (it.image) { tally.fromFeed++; continue; }        // publisher gave us one
      if (known.has(it.link)) { it.image = known.get(it.link); tally.reused++; continue; }
      if (Date.now() > deadline) { it.image = null; tally.skipped++; continue; }
      const img = await articleImage(it.link);
      it.image = img;
      if (img) tally.found++; else tally.missing++;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(IMG_CONCURRENCY, stories.length) }, worker)
  );
  return tally;
}

/* The previous file is the image cache. Missing or unreadable is fine - it
   just means every picture is resolved from scratch this run. */
async function previousItems(path) {
  try {
    const prev = JSON.parse(await fs.readFile(path, "utf8"));
    return Array.isArray(prev.items) ? prev.items : [];
  } catch {
    return [];
  }
}

/* The picture, straight out of the feed. Publishers announce it in one of
   four ways and there is no telling which until you look, so try all four:
   media:content, media:thumbnail, an image enclosure, or the first <img>
   inside the description. */
export function imageFromItemXml(raw) {
  const xml = String(raw || "");
  const patterns = [
    /<media:content[^>]+url=["']([^"']+)["'][^>]*>/i,
    /<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i,
    /<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image\/[^"']*["']/i,
    /<enclosure[^>]+type=["']image\/[^"']*["'][^>]*url=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["']/i,
    /&lt;img[^&]*src=&quot;([^&]+)&quot;/i
  ];
  for (const re of patterns) {
    const m = re.exec(xml);
    if (!m) continue;
    const url = absoluteHttpUrl(decode(m[1]).trim());
    if (url) return url;
  }
  return null;
}

/* The wide cards carry a sentence or two under the headline, so the row
   does not read as a picture with a caption. Publishers put it in
   <description>; Google News puts a block of markup and links there, which
   is why only publisher feeds are asked for one. */
export function summaryFromItemXml(raw, limit = 220) {
  const text = decode(field(raw, "description") || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 40) return null;              // a caption, not a summary
  if (/^(read more|continue reading|the post )/i.test(text)) return null;
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const at = cut.lastIndexOf(" ");
  return (at > 80 ? cut.slice(0, at) : cut).trim() + "\u2026";
}

/* Atom-style feeds put the URL in an attribute rather than the element. */
export function linkFromItemXml(raw) {
  const plain = field(raw, "link");
  if (plain && /^https?:\/\//i.test(plain)) return plain;
  const attr = /<link[^>]+href=["'](https?:\/\/[^"']+)["']/i.exec(String(raw || ""));
  if (attr) return decode(attr[1]);
  const guid = field(raw, "guid");
  return guid && /^https?:\/\//i.test(guid) ? guid : null;
}

async function fetchPublisherFeed(feed) {
  const res = await fetch(feed.url, {
    headers: { "User-Agent": BROWSER_UA, Accept: "application/rss+xml,application/xml,text/xml,*/*" }
  });
  if (!res.ok) throw new Error(`${feed.id}: HTTP ${res.status}`);
  const xml = await res.text();
  return xml.split(/<item[\s>]/i).slice(1).map((raw) => {
    const title = field(raw, "title");
    const link = linkFromItemXml(raw);
    if (!title || !link) return null;
    const pub = field(raw, "pubDate") || field(raw, "published") || field(raw, "updated");
    const at = pub ? Date.parse(pub) : NaN;
    return {
      competition: feed.id,
      title,
      publisher: feed.name,
      link,
      image: imageFromItemXml(raw),
      summary: summaryFromItemXml(raw),
      teams: tagTeams(title),
      publishedAt: isFinite(at) ? at : null
    };
  }).filter(Boolean);
}

/* The same story arrives under several Google queries and, now, from the
   publisher as well. Those copies are not equal: the publisher's carries a
   picture and links straight to the article, while Google's links through a
   redirect and carries nothing. So de-duplication picks rather than keeps
   the first - a copy with a picture wins, and a direct link beats a
   redirect. */
export function dedupe(items) {
  const best = new Map();
  const score = (it) =>
    (it.image ? 4 : 0) + (it.summary ? 2 : 0) + (isGoogleRedirect(it.link) ? 0 : 1);

  for (const it of items) {
    const key = norm(it.title);
    if (!key) continue;
    const held = best.get(key);
    if (!held || score(it) > score(held)) best.set(key, it);
  }

  // Two headlines can share one link; keep the first that claimed it.
  const seenLink = new Set();
  return [...best.values()].filter((it) => {
    if (seenLink.has(it.link)) return false;
    seenLink.add(it.link);
    return true;
  });
}

/* Ordering. Straight recency looked right and read wrong: measured on the
   runner, every one of the 480 stories the publishers filed carried a
   picture, yet only 13 reached the page, because Google files far more
   stories and files them faster. The panel ended up newest-first and almost
   entirely pictureless.

   So a picture is worth a few hours of freshness - a story with one is
   preferred over a bare headline up to PHOTO_WORTH_MS newer, and no further.
   Nothing is promoted past that, so the panel stays a news panel rather
   than a gallery of yesterday. */
const PHOTO_WORTH_MS = 8 * 60 * 60 * 1000;

export function rank(it) {
  return (it.publishedAt || 0) + (it.image ? PHOTO_WORTH_MS : 0);
}

async function main() {
  // Both sources at once: Google News for reach, publishers for pictures.
  const [gRes, pRes] = await Promise.all([
    Promise.allSettled(COMPETITIONS.map(fetchFeed)),
    Promise.allSettled(PUBLISHER_FEEDS.map(fetchPublisherFeed))
  ]);

  let items = [];
  gRes.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...r.value);
    else console.error(`Failed: ${COMPETITIONS[i].id}:`, r.reason?.message || r.reason);
  });
  let fromPublishers = 0, withPicture = 0;
  pRes.forEach((r, i) => {
    if (r.status !== "fulfilled") {
      console.error(`Failed: ${PUBLISHER_FEEDS[i].name}:`, r.reason?.message || r.reason);
      return;
    }
    fromPublishers += r.value.length;
    withPicture += r.value.filter((it) => it.image).length;
    items.push(...r.value);
  });

  const gOk = gRes.filter((r) => r.status === "fulfilled").length;
  const pOk = pRes.filter((r) => r.status === "fulfilled").length;
  console.log(
    `${gOk}/${COMPETITIONS.length} Google feeds and ${pOk}/${PUBLISHER_FEEDS.length} publisher ` +
    `feeds fetched: ${items.length} raw items, ${fromPublishers} from publishers ` +
    `(${withPicture} carrying a picture).`
  );

  /* A live feed that silently empties is worse than a stale one: the page
     would look broken with no way to tell why. Keep the previous file. */
  if (!items.length) {
    console.error("No items at all — leaving the existing file untouched.");
    process.exitCode = 1;
    return;
  }

  items = dedupe(items);

  /* Layer 1: the headline says so outright. Cheap, and it never fails the
     way a network call can. */
  const dropped = { keyword: 0, sport: 0, feed: 0 };
  const candidates = items.filter((it) => {
    if (!it.teams.length) return false;                   // not about this board
    if (isOtherCompetition(it.title)) { dropped.keyword++; return false; }
    if (isOtherSport(it.title)) { dropped.sport++; return false; }
    return true;
  });

  /* Layer 2: whatever Google returns for the competitions we do not want,
     including a women's query for each club these candidates are full of. */
  const clubFeeds = busiestTeams(candidates, CLUB_BLOCK_QUERIES).map((key) => ({
    id: `w-${key}`,
    q: `${DATA.teams[key].name} women football`
  }));
  const blocked = await buildBlocklist(EXCLUDE_FEEDS.concat(clubFeeds));

  let tagged = candidates.filter((it) => {
    if (blocked.has(norm(it.title)) || blocked.has(it.link)) { dropped.feed++; return false; }
    return true;
  });

  /* The club queries are the one part of this that could misfire: ask Google
     for "Arsenal women football" and a men's Arsenal story could come back,
     and it would be blocked with the rest. One or two of those is a fair
     price. Half the brief is not - so if the blocklist ever takes most of
     the candidates, distrust it and publish on wording alone. */
  let overblocked = false;
  if (candidates.length >= 40 && tagged.length < candidates.length * 0.25) {
    console.error(
      `Blocklist removed ${dropped.feed} of ${candidates.length} candidates - ` +
      `too many to be right. Falling back to the wording filter for this run.`
    );
    overblocked = true;
    dropped.feed = 0;
    tagged = candidates;
  }
  tagged.sort((a, b) => rank(b) - rank(a));

  /* A filter that removes everything is a bug, not a quiet news day. Keep
     the previous file rather than publishing an empty brief. */
  if (!tagged.length) {
    console.error(`Filtered every one of ${items.length} stories - leaving the existing file untouched.`);
    process.exitCode = 1;
    return;
  }

  const outPath = new URL("../data/football-news.json", import.meta.url);
  const published = tagged.slice(0, 60);

  /* Pictures last: the brief is already complete without them, so a slow or
     unreachable publisher costs a photograph and nothing else. */
  const pics = await attachImages(published, await previousItems(outPath));
  console.log(
    `Images: ${pics.fromFeed} straight from the feed, ${pics.found} read off the article, ` +
    `${pics.reused} reused, ${pics.missing} not offered, ${pics.skipped} skipped (out of time).`
  );

  const out = {
    generatedAt: Date.now(),
    source: "Google News RSS",
    teamsKnown: Object.keys(DATA.teams).length,
    counts: {
      raw: items.length,
      tagged: tagged.length,
      droppedKeyword: dropped.keyword,
      droppedOtherSport: dropped.sport,
      droppedFeed: dropped.feed,
      blocklistDistrusted: overblocked,
      withImage: published.filter((it) => it.image).length
    },
    items: published
  };

  await fs.writeFile(outPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${out.items.length} tagged stories (of ${items.length} unique; dropped ${dropped.keyword} by wording, ${dropped.sport} as another sport, ${dropped.feed} by blocklist).`);
}

/* Importing this file (the filter test does) must not fire the fetch. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
