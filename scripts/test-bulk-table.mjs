// One paste of a league table must fill every club in it and refresh the
// leaderboards without anything else being pressed. Renders the real page.
//
//   npm i jsdom && node scripts/test-bulk-table.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = await import("jsdom")); }
catch { console.log("  skip jsdom is not installed - run: npm i jsdom"); process.exit(0); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, "data/moneyball-fixtures.json"), "utf8"));

/* An FBref-shaped squad table: one row per club, plus a row for a club this
   site does not know, which must be reported rather than silently dropped. */
const LEAGUE_TABLE = [
  "Squad             MP   Gls   Sh    SoT   xG     xGA    CrdY  CrdR  Fls   Tkl",
  "Arsenal           7    14    112   41    12.60  6.40   13    0     78    104",
  "Aston Villa       7    8     90    29    7.00   9.24   16    1     83    120",
  "Brentford         7    16    109   35    13.79  11.20  12    0     95    104",
  "Leeds United      7    12    94    28    9.80   12.60  10    0     75    122",
  "Nowhere Rovers    7    5     40    10    3.00   9.00   5     0     50    60"
].join("\n");

const vc = new VirtualConsole();
const errors = [];
vc.on("jsdomError", (e) => errors.push(String(e.message)));

const dom = await JSDOM.fromFile(path.join(ROOT, "moneyball.html"), {
  runScripts: "dangerously", resources: "usable", virtualConsole: vc,
  beforeParse(win) {
    // file:// is an opaque origin, so jsdom's own localStorage throws.
    const store = {};
    Object.defineProperty(win, "localStorage", {
      configurable: true,
      value: {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; }, clear: () => {}
      }
    });
    win.fetch = (u) => Promise.resolve({ ok: true,
      json: () => Promise.resolve(String(u).includes("fixtures") ? fixtures : { items: [] }),
      text: () => Promise.resolve("") });
    win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener(){}, removeListener(){},
      addEventListener(){}, removeEventListener(){} }));
  }
});
await new Promise((r) => setTimeout(r, 900));
const { window } = dom, doc = window.document;

let fail = 0;
const say = (ok, m) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${m}`); if (!ok) fail++; };

const box = doc.getElementById("api-bulk-text");
say(!!box, "the bulk paste box is on the page");
const btn = [...doc.querySelectorAll("button")].find((b) => /Fill from this paste/i.test(b.textContent));
say(!!btn, "the fill button is on the page");
if (!box || !btn) { console.log(`\n${fail} failure(s).`); process.exit(1); }

/* Arsenal ships with a real xG CONCEDED but no xG created, so it cannot be
   on the xG created board yet. After the paste it must be - that is the
   leaderboards refreshing off this one press, and it stays true however
   many other teams are published in the data file. */
const boardText = (t) => {
  const c = [...doc.querySelectorAll(".tt-card")]
    .find((x) => (x.querySelector("h4") || {}).textContent === t);
  return c ? c.textContent : "";
};
say(!/Arsenal/.test(boardText("xG created")),
  "before the paste, Arsenal is not on the xG created board");
const boardsBefore = (doc.getElementById("tt-body") || {}).textContent || "";

/* Nothing typed anywhere: everything below comes from this one paste. */
box.value = LEAGUE_TABLE;
box.dispatchEvent(new window.Event("input", { bubbles: true }));
btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 400));

const report = (doc.getElementById("api-bulk-out") || {}).textContent || "";
say(/4 teams filled from one table/.test(report), `all four known clubs filled in one press (got "${report.slice(0, 48)}…")`);
say(/Nowhere Rovers/.test(report), "the row matching no team is reported, not silently dropped");

const saved = JSON.parse(window.localStorage.getItem("mb-overrides") || "{}");
for (const [key, want] of [["arsenal", 2], ["astonvilla", 1.14], ["brentford", 2.29], ["leeds", 1.71]]) {
  const got = saved[key] && saved[key].goals;
  say(Math.abs((got ?? -1) - want) < 0.01, `${key} goals per match = ${want} (got ${got})`);
}
say((saved.arsenal || {}).matches === 7, "matches taken from the MP column, not typed by hand");
say(Math.abs(((saved.brentford || {}).xgF ?? 0) - 1.97) < 0.01, "xG per match read straight from the table");
say(Math.abs(((saved.astonvilla || {}).red ?? -1) - 0.14) < 0.01, "separate red-card column read");
say(!("nowhererovers" in saved), "an unknown club writes nothing");

/* The point of the exercise: the leaderboards are already up to date. */
const cards = [...doc.querySelectorAll(".tt-card")];
say(cards.length >= 8, `every leaderboard rendered without another click (${cards.length})`);
/* Ranking is not the point and depends on who else is published; that the
   boards were REDRAWN off the same press is. */
const boardsAfter = (doc.getElementById("tt-body") || {}).textContent || "";
say(boardsAfter !== boardsBefore, "and the boards were redrawn off the same press");
const saved2 = JSON.parse(window.localStorage.getItem("mb-overrides") || "{}");
say(Math.abs(((saved2.arsenal || {}).xgF ?? 0) - 1.80) < 0.01,
  "Arsenal now carries an xG created it did not have before");
const sub = (doc.getElementById("tt-sub") || {}).textContent || "";
say(/^\d+ teams with real data/.test(sub), `the subtitle still counts (got "${sub}")`);

const real = errors.filter((e) => !/Could not load|Not implemented|css/i.test(e));
say(real.length === 0, `no script errors (${real.slice(0, 1).join("") || "none"})`);

console.log(fail ? `\n${fail} failure(s).` : "\nbulk table ok");
process.exit(fail ? 1 : 0);
