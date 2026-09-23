// Renders moneyball.html in a real DOM and checks the news cards: the
// picture, and - more importantly - every way a picture can be absent. The
// crest-only card is not a rare edge case, it is what the panel looked like
// before photographs existed, so it has to keep reading properly.
//
//   npm i jsdom && node scripts/test-news-ui.mjs
//
// jsdom is not a dependency of this project (there is no package.json and
// the site ships no build step), so without it this check reports itself
// skipped instead of failing the suite.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let JSDOM, VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = await import("jsdom"));
} catch {
  console.log("  skip jsdom is not installed - run: npm i jsdom");
  process.exit(0);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(fs.readFileSync(`${ROOT}/data/moneyball-fixtures.json`, "utf8"));

// Three cards: one with a photo, one with a photo that will fail, one with none.
const news = {
  generatedAt: Date.now() - 120000,
  counts: { withImage: 2 },
  items: [
    { title: "Story one with a picture", publisher: "ESPN", link: "https://espn.com/a",
      image: "https://a.espncdn.com/photo.jpg", summary: null, teams: ["arsenal"], publishedAt: Date.now() - 3600000 },
    { title: "Story two, picture will fail to load", publisher: "Sky Sports", link: "https://sky.com/b",
      image: "https://blocked.example/x.jpg", summary: null, teams: ["mancity", "bayern"], publishedAt: Date.now() - 7200000 },
    { title: "Story three with no picture at all", publisher: "BBC Sport", link: "https://bbc.co.uk/c",
      image: null, summary: null, teams: ["liverpool"], publishedAt: Date.now() - 10800000 },
    { title: "Story four, hostile image url", publisher: "Nowhere", link: "https://x.test/d",
      image: "javascript:alert(1)", summary: null, teams: ["chelsea"], publishedAt: Date.now() - 14400000 },
    { title: "Story five, wide with a summary", publisher: "The Guardian", link: "https://guardian.com/e",
      image: "https://i.guim.co.uk/e.jpg", summary: "A sentence long enough to be a real summary of the story rather than a caption.",
      teams: ["manutd"], publishedAt: Date.now() - 18000000 },
    { title: "Story six, also wide with a summary", publisher: "Mirror", link: "https://mirror.co.uk/f",
      image: null, summary: "Another summary, long enough that the wide card has something to say under the headline.",
      teams: ["napoli"], publishedAt: Date.now() - 21600000 }
  ]
};

const vc = new VirtualConsole();
const errors = [];
vc.on("jsdomError", (e) => errors.push(String(e.message)));
vc.on("error", (...a) => errors.push(a.join(" ")));

const dom = await JSDOM.fromFile(path.join(ROOT, "moneyball.html"), {
  runScripts: "dangerously",
  resources: "usable",
  virtualConsole: vc,
  beforeParse(win) {
    win.fetch = (url) => {
      const u = String(url);
      const body = u.includes("football-news") ? news
        : u.includes("moneyball-fixtures") ? fixtures
        : u.includes("build.json") ? { build: "x" } : {};
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve("") });
    };
    win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  }
});

const { window } = dom;
await new Promise((r) => setTimeout(r, 900));
const doc = window.document;

/* The panel opens filtered to the clubs on the board; these four stories are
   fixtures, so show them all. */
const allClubs = [...doc.querySelectorAll("#news-tools .chip")].find((b) => /All clubs/i.test(b.textContent));
if (allClubs) allClubs.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

let fail = 0;
const say = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) fail++; };

const rows = [...doc.querySelectorAll(".news-row")];
const cards = [...doc.querySelectorAll(".news-card")];
const tall = [...doc.querySelectorAll(".news-card.tall")];
const wide = [...doc.querySelectorAll(".news-card.wide")];

// 1. the rhythm: four across, then two wide - not one shape repeated
say(rows.length >= 2, `more than one row shape rendered (got ${rows.length})`);
say(rows[0] && !rows[0].classList.contains("wide"), "the first row is the four-across row");
say(rows[1] && rows[1].classList.contains("wide"), "the second row is the wide row");
say(tall.length === 4, `four cards in the first row (got ${tall.length})`);
say(wide.length === 2, `two wide cards in the second row (got ${wide.length})`);
say(cards.length === 6, `every story placed (got ${cards.length})`);

// 2. the wide slots go to the stories that have something to say
say(wide.every((c) => !!c.querySelector(".news-summary")),
  "both wide cards carry a summary under the headline");
say(tall.every((c) => !c.querySelector(".news-summary")),
  "narrow cards stay headline-only");
say(wide.every((c) => !!c.querySelector("h3")) && tall.every((c) => !!c.querySelector("h4")),
  "wide cards lead with a bigger headline than narrow ones");

// 3. the picture itself
const withPic = cards.find((c) => /Story one with a picture/.test(c.textContent));
const pic = withPic && withPic.querySelector("img.news-photo");
say(!!pic, "a story with a picture renders one");
say(pic && pic.getAttribute("src") === "https://a.espncdn.com/photo.jpg", "picture points at the publisher's url");
say(pic && pic.getAttribute("loading") === "lazy", "pictures load lazily");
say(pic && pic.getAttribute("referrerpolicy") === "no-referrer", "no referrer is sent to the publisher's cdn");
say(pic && pic.getAttribute("alt") === "", "picture is decorative: the headline is the text");
say(withPic && !!withPic.querySelector(".news-shot.has-img"), "its frame is marked has-img so the crest tile hides");
say(withPic && !!withPic.querySelector(".news-teams .crest, .news-teams .mono"), "club crest still shown above the headline");
say(withPic && withPic.tagName === "A" && withPic.getAttribute("rel") === "noopener noreferrer",
  "card is still a safe outbound link");

// 4. a card with no picture still gets a frame, showing its club crest
const noPic = cards.find((c) => /no picture at all/.test(c.textContent));
say(noPic && !!noPic.querySelector(".news-shot"), "story without a picture still gets a frame");
say(noPic && !noPic.querySelector(".news-shot.has-img"), "that frame is not marked has-img");
say(noPic && !noPic.querySelector("img.news-photo"), "no photograph element is emitted when there is none");
say(noPic && !!noPic.querySelector(".news-shot-fallback .crest, .news-shot-fallback .mono"),
  "the crest tile stands in for the missing picture");

// 5. a hostile image url is refused outright
const hostile = cards.find((c) => /hostile image url/.test(c.textContent));
say(hostile && !hostile.querySelector("img.news-photo"), "javascript: image url is refused");
say(hostile && !hostile.querySelector(".news-shot.has-img"), "a refused url does not count as a picture");
say(!doc.body.innerHTML.includes("javascript:alert"), "hostile url never reaches the document");

// 6. a picture that fails to load hands over to the crest tile
const failing = cards.find((c) => /picture will fail/.test(c.textContent));
say(failing && !!failing.querySelector("img.news-photo"), "failing card starts out with a photograph");
if (failing) {
  const img = failing.querySelector("img.news-photo");
  img.dispatchEvent(new window.Event("error"));
  say(!failing.querySelector("img.news-photo"), "the broken image is removed when it fails to load");
  say(!failing.querySelector(".news-shot.has-img"), "the frame drops back to the crest tile");
  say(!!failing.querySelector(".news-shot-fallback"), "the crest tile is there to take over");
  say(!!failing.querySelector("h4"), "headline survives the image failing");
}

const real = errors.filter((e) => !/Could not load|Not implemented|css/i.test(e));
say(real.length === 0, `no script errors on the page (${real.slice(0, 2).join(" | ") || "none"})`);

console.log(fail ? `\n${fail} failure(s).` : "\nnews UI ok");
process.exit(fail ? 1 : 0);
