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
    { title: "Lead story with a picture", publisher: "ESPN", link: "https://espn.com/a",
      image: "https://a.espncdn.com/photo.jpg", teams: ["arsenal"], publishedAt: Date.now() - 3600000 },
    { title: "Second story, picture will fail to load", publisher: "Sky Sports", link: "https://sky.com/b",
      image: "https://blocked.example/x.jpg", teams: ["mancity", "bayern"], publishedAt: Date.now() - 7200000 },
    { title: "Third story with no picture at all", publisher: "BBC Sport", link: "https://bbc.co.uk/c",
      image: null, teams: ["liverpool"], publishedAt: Date.now() - 10800000 },
    { title: "Fourth story, hostile image url", publisher: "Nowhere", link: "https://x.test/d",
      image: "javascript:alert(1)", teams: ["chelsea"], publishedAt: Date.now() - 14400000 }
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

const lead = doc.querySelector(".news-lead");
const cards = [...doc.querySelectorAll(".news-card")];
say(!!lead, "lead story rendered");
say(cards.length === 3, `three grid cards rendered (got ${cards.length})`);

// 1. the lead has a picture, inside the link, with the headline still there
const leadImg = lead && lead.querySelector(".news-shot img");
say(!!leadImg, "lead card has a picture");
say(leadImg && leadImg.getAttribute("src") === "https://a.espncdn.com/photo.jpg", "lead picture points at the publisher's url");
say(leadImg && leadImg.getAttribute("loading") === "lazy", "pictures load lazily");
say(leadImg && leadImg.getAttribute("referrerpolicy") === "no-referrer", "no referrer is sent to the publisher's cdn");
say(leadImg && leadImg.getAttribute("alt") === "", "picture is decorative: the headline is the text");
say(lead && lead.classList.contains("has-shot"), "lead card is marked has-shot for the two-column layout");
say(lead && !!lead.querySelector("h3"), "lead headline survives alongside the picture");
say(lead && !!lead.querySelector(".news-teams .crest"), "club crest still shown above the headline");
say(lead && lead.tagName === "A" && lead.getAttribute("rel") === "noopener noreferrer", "card is still a safe outbound link");

// 2. a card with no image keeps the old crest-only layout
const noPic = cards.find((c) => /no picture at all/.test(c.textContent));
say(noPic && !noPic.querySelector(".news-shot"), "story without a picture renders no empty frame");
say(noPic && !noPic.classList.contains("has-shot"), "story without a picture is not marked has-shot");
say(noPic && !!noPic.querySelector("h4") && !!noPic.querySelector(".news-teams"), "story without a picture still reads as a card");

// 3. a hostile image url is refused outright
const hostile = cards.find((c) => /hostile image url/.test(c.textContent));
say(hostile && !hostile.querySelector(".news-shot"), "javascript: image url is refused");
say(!doc.body.innerHTML.includes("javascript:alert"), "hostile url never reaches the document");

// 4. a picture that fails to load takes its frame with it
const failing = cards.find((c) => /picture will fail/.test(c.textContent));
say(failing && !!failing.querySelector(".news-shot"), "failing card starts out with a frame");
if (failing) {
  const img = failing.querySelector(".news-shot img");
  img.dispatchEvent(new window.Event("error"));
  say(!failing.querySelector(".news-shot"), "frame is removed when the image fails");
  say(!failing.classList.contains("has-shot"), "card drops back to the crest layout when the image fails");
  say(!!failing.querySelector("h4"), "headline survives the image failing");
}

const real = errors.filter((e) => !/Could not load|Not implemented|css/i.test(e));
say(real.length === 0, `no script errors on the page (${real.slice(0, 2).join(" | ") || "none"})`);

console.log(fail ? `\n${fail} failure(s).` : "\nnews UI ok");
process.exit(fail ? 1 : 0);
