// Statistics entered by the owner live in that one browser. A visitor - or
// the owner on another machine - sees none of them, which for a page meant
// to be sold is fatal: opened on a second account, Top Team Statistics read
// "0 teams with your data".
//
// The fix is publishing rather than logging in: a team carrying
// "measured": true in the data file counts as a real measurement for
// everyone, with no localStorage at all.
//
//   npm i jsdom && node scripts/test-published-stats.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = await import("jsdom")); }
catch { console.log("  skip jsdom is not installed - run: npm i jsdom"); process.exit(0); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = JSON.parse(fs.readFileSync(path.join(ROOT, "data/moneyball-fixtures.json"), "utf8"));

/* Four teams published the way an export would land them in the file. */
const PUBLISHED = ["chelsea", "brentford", "astonvilla", "manutd"].filter((k) => base.teams[k]);
const fixtures = JSON.parse(JSON.stringify(base));
PUBLISHED.forEach((k, i) => {
  Object.assign(fixtures.teams[k], {
    measured: true, measuredAt: "2026-09-23", statsMissing: false,
    matches: 7, xgF: 1.5 + i * 0.1, xgA: 1.2, goals: 1.4, shots: 13.5,
    fouls: 11, tackles: 16, yellow: 1.9, red: 0.07
  });
});

async function open(store) {
  const dom = await JSDOM.fromFile(path.join(ROOT, "moneyball.html"), {
    runScripts: "dangerously", resources: "usable", virtualConsole: new VirtualConsole(),
    beforeParse(win) {
      Object.defineProperty(win, "localStorage", { configurable: true,
        value: { getItem: (k) => (k in store ? store[k] : null),
                 setItem: (k, v) => { store[k] = String(v); },
                 removeItem: (k) => { delete store[k]; }, clear: () => {} } });
      win.fetch = (u) => Promise.resolve({ ok: true,
        json: () => Promise.resolve(String(u).includes("fixtures") ? fixtures : { items: [] }),
        text: () => Promise.resolve("") });
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener(){}, removeListener(){},
        addEventListener(){}, removeEventListener(){} }));
    }
  });
  await new Promise((r) => setTimeout(r, 900));
  return dom;
}

let fail = 0;
const say = (ok, m) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${m}`); if (!ok) fail++; };

/* A visitor: empty browser storage, nothing ever typed here. */
const visitor = await open({});
const doc = visitor.window.document;

const sub = (doc.getElementById("tt-sub") || {}).textContent || "";
say(/^4 teams with real data/.test(sub), `a visitor sees the published teams (got "${sub}")`);
say(!/your data/.test(sub), 'it no longer calls them "your data" to someone who entered nothing');

const cards = [...doc.querySelectorAll(".tt-card")];
say(cards.length >= 8, `the leaderboards render for a visitor (${cards.length})`);
const boardText = cards.map((c) => c.textContent).join(" ");
PUBLISHED.forEach((k) => say(boardText.includes(fixtures.teams[k].name),
  `${fixtures.teams[k].name} is on the boards with no localStorage`));

say(!/Only 0 teams have real data/.test(doc.body.textContent),
  "the empty-state warning is gone for a visitor");

/* And the owner can get the figures out of the browser to publish them. */
const owner = await open({ "mb-overrides": JSON.stringify({
  liverpool: { matches: 7, xgF: 1.61, xgA: 1.41, goals: 1.58, shots: 13.79,
               _src: { matches: 7, when: Date.now() } } }) });
const odoc = owner.window.document;
const exportBtn = [...odoc.querySelectorAll("button")]
  .find((b) => /Copy my statistics/i.test(b.textContent));
say(!!exportBtn, "there is a button to copy the figures out for publishing");
if (exportBtn) {
  exportBtn.dispatchEvent(new owner.window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 250));
  const ta = odoc.querySelector("#api-bulk-out textarea");
  say(!!ta, "it prints the JSON as well as copying it");
  const got = ta ? JSON.parse(ta.value) : {};
  say(!!got.liverpool, "the exported JSON carries the team");
  say(got.liverpool && got.liverpool.xgF === 1.61, "with the figures as entered");
  say(got.liverpool && got.liverpool.measured === true,
    'and marked "measured" so the published file counts it as real');
}

/* The phone board. jsdom does no layout, so the rule itself is checked:
   below 640px the six-column grid must stop forcing an 880px scroll, and
   the three price columns must be dropped so the model's pick - the one
   column worth reading - is on screen without swiping right. */
const css = fs.readFileSync(path.join(ROOT, "css/moneyball.css"), "utf8");
const phone = /@media \(max-width: 640px\) \{([\s\S]*?)\n\}/.exec(css);
say(!!phone, "there is a phone breakpoint for the board");
if (phone) {
  const block = phone[1];
  say(/\.board\s*\{[^}]*min-width:\s*0/.test(block), "the 880px minimum is released on a phone");
  say(/\.board-row\s+\.board-cell\s*\{[^}]*display:\s*none/.test(block),
    "handicap, over/under and 1X2 are dropped on a phone");
  say(/\.board-row\s*\{[^}]*grid-template-columns:\s*1fr/.test(block),
    "each fixture stacks instead of running off the right edge");
  say(/\.board-pick\.hl\s*\{[^}]*--hl-/.test(block),
    "the recommendation keeps its highlight, which is the point of the row");
  say(/\.board-head\s*\{[^}]*display:\s*none/.test(block),
    "the column headings go, since their columns did");
}

console.log(fail ? `\n${fail} failure(s).` : "\npublished stats ok");
process.exit(fail ? 1 : 0);
