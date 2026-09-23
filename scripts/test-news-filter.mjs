// Checks the news competition filter against real headlines that leaked
// through it. Run: node scripts/test-news-filter.mjs
//
// The cases below are verbatim from data/football-news.json on 23 Sep 2026,
// when a quarter of the brief turned out to be UEFA Women's Champions League
// coverage tagged to the men's clubs on the board.

import {
  isOtherCompetition, busiestTeams,
  extractOgImage, absoluteHttpUrl, decodeGoogleLink, publisherUrlFromGooglePage,
  imageFromItemXml, linkFromItemXml, summaryFromItemXml, dedupe,
  isOtherSport, rank
} from "./fetch-football-news.mjs";

/* Wording alone should catch these. */
const MUST_DROP = [
  "UEFA Women's Champions League Matchday 1 Wednesday preview: Barcelona vs Paris FC, Chelsea vs Austria Wien",
  "Mariona Caldentey penalty provides late WCL relief for Arsenal against Køge",
  "Wamser rescues point for Manchester City in WCL fightback at Bayern Munich",
  "Arsenal start UEFA Women's Champions League campaign with a win, but where are the goals going to come from?",
  "Watch cool Gwinn finish for Bayern | Video | UEFA Women's Champions League",
  "Women's Champions League highlights: Arsenal 1-0 HB Køge",
  "Bayern Munich Frauen suffer second half collapse in 2-2 draw with Manchester City",
  "Real Madrid need more from young star Schröder to reach new UWCL heights",
  "Arsenal wins late, Man City draws at Bayern as UWCL returns",
  "Real Madrid draws in their debut in the Women’s Champions League",   // curly apostrophe
  "Manchester City goal in Women’s Champions League allowed to stand despite flare on pitch",
  "Juventus vs Benfica: UEFA Women's Champions League stats & head-to-head",
  "Chelsea U21 beaten by Arsenal youth side",
  "Barcelona Femeníno secure comfortable win",
  "Juventus Femminile draw at home"
];

/* Real men's-team stories. None of these may be dropped. */
const MUST_KEEP = [
  "Portugal vs Wales Preview - Jorge Jesus era begins in the UEFA Nations League",
  "Vinícius Junior's Crisis at Real Madrid Could Have an Unexpected Origin",
  "Transfer news LIVE: Arsenal plot Alvarez loan; three Chelsea targets; Man Utd, Liverpool latest",
  "De Bruyne: I did not try to leave Napoli",
  "Mikel Arteta agrees contract extension expected to keep him at Arsenal until 2030",
  "England vs Spain UEFA Nations League preview: Everything you need to know",
  "Former Manchester City star Sergio Agüero says Bayern Munich is team no one wants to face in Champions League",
  "Bavarian Loan Works: Two Bayern Munich loanees meet in 2. Budesliga",
  "Real Madrid Clashes With La Liga Over Refereeing",
  "PREVIEW | Netherlands vs Germany: team news, lineups, predictions (UEFA Nations League 24/09)",
  "Sunderland Could Reignite Their Interest In This Ligue 1 Winger: Should Le Bris Move In For Him?",
  "Zakaria’s adductor injury revealed after Switzerland withdrawal"
];

/* Wording gives nothing away on these: only the blocklist feeds can catch
   them. Recorded so the next person knows layer 1 is not expected to. */
const WORDING_CANNOT_CATCH = [
  "Bayern 2-2 Man City (Sep 22, 2026) Game Analysis",
  "Arsenal 1-0 HB Køge (Sep 22, 2026) Game Analysis",
  "Slegers praises Arsenal’s resilience after late Champions League win",
  "Reaction: Bayern's Gwinn on 'frustrating' draw",
  "Man City fight back from two down to thwart Bayern"
];

let fail = 0;

/* The club blocklist queries are derived from whichever teams the brief is
   full of, so nothing here is a hand-kept list of club names. */
function checkBusiestTeams() {
  const candidates = [
    { teams: ["arsenal", "mancity"] },
    { teams: ["arsenal"] },
    { teams: ["arsenal", "bayern"] },
    { teams: ["mancity"] },
    { teams: ["bayern"] },
    { teams: ["mancity"] },
    { teams: [] },
    { teams: ["venezia"] }
  ];
  const top = busiestTeams(candidates, 3);
  const want = ["arsenal", "mancity", "bayern"];   // 3, 3, 2 - venezia has 1
  if (top.join(",") !== want.join(",")) {
    console.error(`FAIL: busiest teams were ${top.join(",")}, expected ${want.join(",")}`);
    return 1;
  }
  if (busiestTeams([], 12).length !== 0) {
    console.error("FAIL: no candidates should mean no club queries");
    return 1;
  }
  if (busiestTeams(candidates, 12).length !== 4) {
    console.error("FAIL: asking for more clubs than exist should not invent any");
    return 1;
  }
  console.log("  ok   club blocklist queries follow the busiest teams in the brief");
  return 0;
}

function checkImages() {
  let bad = 0;
  const base = "https://www.espn.com/soccer/report/_/gameId/1234";

  // og:image, in both attribute orders publishers write it.
  const cases = [
    ['<meta property="og:image" content="https://a.espncdn.com/photo.jpg">', "https://a.espncdn.com/photo.jpg"],
    ['<meta content="https://a.espncdn.com/photo.jpg" property="og:image">', "https://a.espncdn.com/photo.jpg"],
    ['<meta property="og:image:secure_url" content="https://a.espncdn.com/s.jpg">', "https://a.espncdn.com/s.jpg"],
    ['<meta name="twitter:image" content="https://a.espncdn.com/t.jpg">', "https://a.espncdn.com/t.jpg"],
    ['<link rel="image_src" href="https://a.espncdn.com/l.jpg">', "https://a.espncdn.com/l.jpg"],
    // relative paths are common and must be resolved against the article
    ['<meta property="og:image" content="/media/hero.jpg">', "https://www.espn.com/media/hero.jpg"],
    // entities survive the round trip
    ['<meta property="og:image" content="https://x.com/a.jpg?w=1&amp;h=2">', "https://x.com/a.jpg?w=1&h=2"]
  ];
  for (const [html, want] of cases) {
    const got = extractOgImage(html, base);
    if (got !== want) { console.error(`FAIL: og:image was ${got}, expected ${want}`); bad++; }
  }

  // og:image wins over twitter:image when a page offers both.
  const both = '<meta name="twitter:image" content="https://x/t.jpg">' +
               '<meta property="og:image" content="https://x/og.jpg">';
  if (extractOgImage(both, base) !== "https://x/og.jpg") {
    console.error("FAIL: og:image should be preferred over twitter:image"); bad++;
  }

  // A page with no picture must say so rather than guess.
  if (extractOgImage("<html><head><title>x</title></head></html>", base) !== null) {
    console.error("FAIL: a page with no image should return null"); bad++;
  }
  if (extractOgImage("", base) !== null || extractOgImage(null, base) !== null) {
    console.error("FAIL: empty input should return null"); bad++;
  }

  /* A data: URI would be embedded in the file we publish, and javascript:
     would run on the page. Only http(s) may through. */
  for (const bad_url of [
    "data:image/png;base64,iVBORw0KGgo=",
    "javascript:alert(1)",
    "file:///etc/passwd"
  ]) {
    if (absoluteHttpUrl(bad_url, base) !== null) {
      console.error(`FAIL: ${bad_url.slice(0, 24)} should be rejected`); bad++;
    }
    if (extractOgImage(`<meta property="og:image" content="${bad_url}">`, base) !== null) {
      console.error(`FAIL: og:image ${bad_url.slice(0, 24)} should be rejected`); bad++;
    }
  }

  // Old-style Google links carry the publisher URL inside the base64.
  const real = "https://www.bbc.com/sport/football/articles/abc123";
  const payload = Buffer.from("\x08\x13\x22" + String.fromCharCode(real.length) + real + "\xd2\x01\x00", "latin1")
    .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const decoded = decodeGoogleLink(`https://news.google.com/rss/articles/${payload}?oc=5`);
  if (decoded !== real) { console.error(`FAIL: decoded link was ${decoded}, expected ${real}`); bad++; }

  /* The current format holds an opaque id, not a URL. Returning null is the
     right answer - the fetcher then follows the redirect instead. */
  const opaque = "https://news.google.com/rss/articles/CBMifEFVX3lxTE44aTQySk5WZ0doVE5tcTkzUDdHbmVfdmFh?oc=5";
  if (decodeGoogleLink(opaque) !== null) {
    console.error("FAIL: an opaque link should decode to null, not a guess"); bad++;
  }
  if (decodeGoogleLink("https://example.com/story") !== null) {
    console.error("FAIL: a non-Google link should decode to null"); bad++;
  }

  // Falling back to the redirect page: prefer data-n-au, skip Google's own URLs.
  const gpage = '<html><head><link href="https://fonts.gstatic.com/x.css">' +
    '<script src="https://www.google.com/js/k.js"></script></head>' +
    '<body><a data-n-au="https://www.skysports.com/football/news/1" href="./read">x</a></body></html>';
  if (publisherUrlFromGooglePage(gpage) !== "https://www.skysports.com/football/news/1") {
    console.error("FAIL: data-n-au should be preferred"); bad++;
  }
  const noAttr = '<link href="https://fonts.gstatic.com/x.css">' +
    '<a href="https://www.theguardian.com/football/2026/sep/23/x">y</a>';
  if (publisherUrlFromGooglePage(noAttr) !== "https://www.theguardian.com/football/2026/sep/23/x") {
    console.error("FAIL: should skip Google's own assets and take the publisher"); bad++;
  }
  if (publisherUrlFromGooglePage('<link href="https://www.gstatic.com/a.css">') !== null) {
    console.error("FAIL: a page with only Google URLs should return null"); bad++;
  }

  if (!bad) console.log("  ok   article pictures: og:image read, relative resolved, data:/javascript: refused");
  return bad;
}

/* The publisher feeds are where the pictures actually come from, so the
   four shapes publishers announce them in each get a case, taken from the
   real feeds this script reads. */
function checkFeedImages() {
  let bad = 0;
  const cases = [
    ["media:content (Guardian, 90min)",
     '<item><title>x</title><media:content url="https://i.guim.co.uk/img/a.jpg" width="620"/></item>',
     "https://i.guim.co.uk/img/a.jpg"],
    ["media:thumbnail (BBC, Mirror)",
     '<item><title>x</title><media:thumbnail width="976" url="https://ichef.bbci.co.uk/b.jpg"/></item>',
     "https://ichef.bbci.co.uk/b.jpg"],
    ["enclosure, url first (WordPress)",
     '<item><enclosure url="https://metro.co.uk/c.jpg" length="0" type="image/jpeg"/></item>',
     "https://metro.co.uk/c.jpg"],
    ["enclosure, type first",
     '<item><enclosure type="image/jpeg" length="0" url="https://metro.co.uk/d.jpg"/></item>',
     "https://metro.co.uk/d.jpg"],
    ["img inside a CDATA description",
     '<item><description><![CDATA[<p><img src="https://talksport.com/e.jpg" alt=""/>text</p>]]></description></item>',
     "https://talksport.com/e.jpg"],
    ["img inside an escaped description",
     '<item><description>&lt;img src=&quot;https://express.co.uk/f.jpg&quot; /&gt; text</description></item>',
     "https://express.co.uk/f.jpg"]
  ];
  for (const [what, xml, want] of cases) {
    const got = imageFromItemXml(xml);
    if (got !== want) { console.error(`FAIL: ${what} gave ${got}, expected ${want}`); bad++; }
  }

  // A feed with no picture must say so, and must not invent one.
  if (imageFromItemXml("<item><title>plain</title><link>https://x/y</link></item>") !== null) {
    console.error("FAIL: an item with no picture should return null"); bad++;
  }
  // An enclosure that is audio or video is not a picture.
  if (imageFromItemXml('<item><enclosure url="https://x/p.mp3" type="audio/mpeg"/></item>') !== null) {
    console.error("FAIL: an audio enclosure is not a picture"); bad++;
  }
  // Same http(s)-only rule as everywhere else.
  if (imageFromItemXml('<item><media:content url="data:image/png;base64,AAA"/></item>') !== null) {
    console.error("FAIL: a data: URI should be refused"); bad++;
  }

  // Links: plain RSS, atom href, and guid as a last resort.
  const links = [
    ["<item><link>https://www.bbc.com/sport/1</link></item>", "https://www.bbc.com/sport/1"],
    ['<item><link rel="alternate" href="https://www.espn.com/2"/></item>', "https://www.espn.com/2"],
    ["<item><guid isPermaLink=\"true\">https://www.goal.com/3</guid></item>", "https://www.goal.com/3"],
    ["<item><guid>tag:example,2026:4</guid></item>", null]
  ];
  for (const [xml, want] of links) {
    const got = linkFromItemXml(xml);
    if (got !== want) { console.error(`FAIL: link was ${got}, expected ${want}`); bad++; }
  }

  // Summaries: the wide cards carry one, so markup and stubs must not reach them.
  const withMarkup = '<item><description><![CDATA[<p>Arsenal have agreed a new deal with Mikel Arteta that runs to 2030, the club confirmed on Tuesday.</p>]]></description></item>';
  const gotSummary = summaryFromItemXml(withMarkup);
  if (!gotSummary || /[<>]/.test(gotSummary)) {
    console.error(`FAIL: summary should be plain text, got ${gotSummary}`); bad++;
  }
  if (summaryFromItemXml("<item><description>Read more</description></item>") !== null) {
    console.error("FAIL: a stub description is not a summary"); bad++;
  }
  if (summaryFromItemXml("<item><title>x</title></item>") !== null) {
    console.error("FAIL: no description should give no summary"); bad++;
  }
  const long = "<item><description>" + "word ".repeat(120) + "</description></item>";
  const trimmed = summaryFromItemXml(long, 220);
  if (!trimmed || trimmed.length > 222 || !trimmed.endsWith("\u2026")) {
    console.error(`FAIL: a long summary should be cut and marked (len ${trimmed && trimmed.length})`); bad++;
  }

  if (!bad) console.log("  ok   feed pictures and summaries: media/enclosure/inline img, text trimmed");
  return bad;
}

/* When Google and a publisher both carry a story, the page should get the
   copy with the picture and the direct link - not whichever arrived first. */
function checkDedupe() {
  let bad = 0;
  const google = {
    title: "Arteta agrees new Arsenal deal",
    link: "https://news.google.com/rss/articles/CBMiabc?oc=5",
    image: null, publisher: "Google News"
  };
  const publisher = {
    title: "Arteta agrees new Arsenal deal",
    link: "https://www.skysports.com/football/news/1",
    image: "https://e0.365dm.com/a.jpg", publisher: "Sky Sports"
  };

  for (const [order, input] of [["google first", [google, publisher]], ["publisher first", [publisher, google]]]) {
    const out = dedupe(input);
    if (out.length !== 1) { console.error(`FAIL: ${order} should collapse to one story, got ${out.length}`); bad++; continue; }
    if (out[0].publisher !== "Sky Sports") {
      console.error(`FAIL: ${order} kept the copy with no picture`); bad++;
    }
  }

  // Punctuation and case differences are the same headline.
  const same = dedupe([
    { title: "De Bruyne: I did not try to leave Napoli", link: "https://a/1", image: null },
    { title: "De Bruyne - I did not try to leave Napoli!", link: "https://b/2", image: "https://c/p.jpg" }
  ]);
  if (same.length !== 1 || !same[0].image) {
    console.error(`FAIL: near-identical headlines should collapse to the copy with a picture (got ${same.length})`); bad++;
  }

  // Two genuinely different stories must both survive.
  if (dedupe([
    { title: "Arsenal win late", link: "https://a/1", image: null },
    { title: "Napoli draw at home", link: "https://b/2", image: null }
  ]).length !== 2) {
    console.error("FAIL: different stories should not be collapsed"); bad++;
  }

  // One link cannot carry two cards.
  if (dedupe([
    { title: "First headline", link: "https://a/1", image: null },
    { title: "Second headline", link: "https://a/1", image: null }
  ]).length !== 1) {
    console.error("FAIL: two headlines sharing a link should collapse"); bad++;
  }

  if (!bad) console.log("  ok   the copy with a picture and a direct link wins de-duplication");
  return bad;
}

/* Sports desks file on more than football, and a national side's name is
   what tags those stories here. Real example from the runner. */
function checkOtherSport() {
  let bad = 0;
  const notFootball = [
    "Farewell Mark Wood, England\u2019s fastest ever bowler",
    "England name squad for the third Test match against India",
    "Rugby: England edge France in the Six Nations",
    "Italy's Jannik Sinner reaches the Wimbledon quarter-final",
    "Brazil's basketball team qualify for the Olympic Games"
  ];
  const football = [
    "England vs Spain UEFA Nations League preview: Everything you need to know",
    "Arsenal test Manchester City in the Premier League title race",
    // "test" and "match" are ordinary football words; only "test match" is not
    "Arteta faces his sternest test as Arsenal match Liverpool's pace",
    "Real Madrid statement claims La Liga president Tebas is incapable of leading",
    "Portugal vs Wales Preview - Jorge Jesus era begins in the UEFA Nations League"
  ];
  for (const t of notFootball) {
    if (!isOtherSport(t)) { console.error(`FAIL: not football, should be dropped:\n  ${t}`); bad++; }
  }
  for (const t of football) {
    if (isOtherSport(t)) { console.error(`FAIL: dropped a football story:\n  ${t}`); bad++; }
  }
  if (!bad) console.log(`  ok   ${notFootball.length} other-sport headlines dropped, ${football.length} football ones kept`);
  return bad;
}

/* A picture is worth a few hours of freshness, and no more than that. */
function checkRank() {
  let bad = 0;
  const HOUR = 3600000, now = Date.now();
  const withPic = (hoursAgo) => ({ publishedAt: now - hoursAgo * HOUR, image: "https://x/p.jpg" });
  const noPic = (hoursAgo) => ({ publishedAt: now - hoursAgo * HOUR, image: null });

  // A six-hour-old story with a picture outranks a fresh bare headline.
  if (rank(withPic(6)) <= rank(noPic(0))) {
    console.error("FAIL: a picture should outrank a slightly fresher bare headline"); bad++;
  }
  // A ten-hour-old one does not: the bonus is bounded, so the panel stays news.
  if (rank(withPic(10)) >= rank(noPic(0))) {
    console.error("FAIL: the picture bonus should not promote yesterday's news"); bad++;
  }
  // Between two stories that both have pictures, the newer still wins.
  if (rank(withPic(1)) <= rank(withPic(5))) {
    console.error("FAIL: among pictures, recency should still decide"); bad++;
  }
  // And between two bare headlines.
  if (rank(noPic(1)) <= rank(noPic(5))) {
    console.error("FAIL: among bare headlines, recency should still decide"); bad++;
  }
  // A missing timestamp must not throw or float to the top.
  if (rank({ publishedAt: null, image: null }) !== 0) {
    console.error("FAIL: an undated story should rank at the bottom"); bad++;
  }
  if (!bad) console.log("  ok   ranking: a picture is worth a few hours of freshness, not a day");
  return bad;
}

fail = checkBusiestTeams() + checkImages() + checkFeedImages() + checkDedupe() +
       checkOtherSport() + checkRank();
for (const t of MUST_DROP) {
  if (!isOtherCompetition(t)) { console.error("FAIL: should have been dropped:\n  " + t); fail++; }
}
for (const t of MUST_KEEP) {
  if (isOtherCompetition(t)) { console.error("FAIL: dropped a men's story:\n  " + t); fail++; }
}
console.log(`  ok   ${MUST_DROP.length} other-competition headlines dropped by wording`);
console.log(`  ok   ${MUST_KEEP.length} men's headlines kept`);
console.log(`  note ${WORDING_CANNOT_CATCH.length} headlines need the blocklist feeds (no wording tell)`);

if (fail) { console.error(`\n${fail} failure(s).`); process.exit(1); }
console.log("news filter ok");
