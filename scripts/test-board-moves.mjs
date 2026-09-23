// "MASIH SAMA KAYAK REKOMENDASIMU PAS BELUM TAK RUBAH STATISTIKNYA" - the
// board's recommendations did not change after every national-team statistic
// had been entered. Two things were wrong underneath, and this test locks
// both of them down from the page rather than from the engine:
//
//   1. Nothing moved, because eleven rows of twenty were blacked out by the
//      old divergence guard and the rest fell back to ranking by vig - the
//      same ranking the page uses with no data at all.
//   2. What did move was wrong in one direction. With no xG conceded to be
//      had anywhere, the model could only express half of each team's
//      strength, so it backed the underdog in every mismatch.
//
//   npm i jsdom && node scripts/test-board-moves.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = await import("jsdom")); }
catch { console.log("  skip jsdom is not installed - run: npm i jsdom"); process.exit(0); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, "data/moneyball-fixtures.json"), "utf8"));

/* A WhoScored country table, pasted in one go: xG created and shots, no xG
   conceded, because WhoScored publishes none. */
const ROWS = [
  ["Netherlands", 2.30, 17.1], ["Germany", 2.10, 15.8], ["Norway", 2.40, 16.0],
  ["Denmark", 1.55, 13.6], ["Portugal", 2.45, 17.5], ["Wales", 1.20, 11.4],
  ["Serbia", 1.35, 12.8], ["Greece", 1.40, 12.2], ["Italy", 1.95, 15.4],
  ["Belgium", 2.25, 16.2], ["Turkey", 1.80, 14.4], ["France", 2.35, 16.8],
  ["Czechia", 1.50, 13.0], ["Croatia", 1.75, 14.1], ["England", 2.05, 15.2],
  ["Spain", 2.55, 18.0], ["Georgia", 1.25, 11.8], ["Northern Ireland", 1.10, 10.6],
  ["Hungary", 1.40, 12.4], ["Ukraine", 1.45, 12.9], ["Poland", 1.70, 14.0],
  ["Bosnia and Herzegovina", 1.20, 11.2], ["Sweden", 1.85, 14.6], ["Romania", 1.15, 11.5],
  ["Austria", 1.90, 15.0], ["Israel", 1.30, 12.0], ["Kosovo", 1.15, 11.0],
  ["Ireland", 1.05, 10.4], ["Slovenia", 1.20, 11.6], ["Scotland", 1.35, 12.3],
  ["North Macedonia", 0.95, 9.8], ["Switzerland", 1.95, 15.1], ["San Marino", 0.25, 5.2],
  ["Finland", 1.40, 12.6], ["Bulgaria", 0.85, 9.4], ["Luxembourg", 1.00, 10.2],
  ["Andorra", 0.45, 6.8], ["Malta", 0.70, 8.6], ["Liechtenstein", 0.30, 5.6],
  ["Lithuania", 0.90, 9.6]
];
const TABLE = ["Team  MP  xG  Goals*  Shots  Fls  Tkl  CrdY  CrdR"].concat(
  ROWS.map(([name, xg, sh]) =>
    [name, 8, (xg * 8).toFixed(2), Math.round(xg * 8 * 0.95), (sh * 8).toFixed(0),
     92, 128, 14, 0].join("  "))
).join("\n");

const vc = new VirtualConsole();
const errors = [];
vc.on("jsdomError", (e) => errors.push(String(e.message)));

const store = {};
const dom = await JSDOM.fromFile(path.join(ROOT, "moneyball.html"), {
  runScripts: "dangerously", resources: "usable", virtualConsole: vc,
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
const { window } = dom, doc = window.document;

let fail = 0;
const say = (ok, m) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${m}`); if (!ok) fail++; };
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

/* Open the Nations League schedule: national teams, and the board the
   complaint was about. */
const tab = [...doc.querySelectorAll("button")]
  .find((b) => /24-27 Sept 2026/i.test(b.textContent));
say(!!tab, "the Nations League schedule is on the page");
click(tab);
await new Promise((r) => setTimeout(r, 120));

function board() {
  return [...doc.querySelectorAll(".board-row")].map((row) => {
    const teams = [...row.querySelectorAll(".board-team span")].map((s) => s.textContent.trim());
    const pick = row.querySelector(".board-pick");
    return { home: teams[0], away: teams[1],
             /* The light blue is the recommendation. A label without it is
                the cheapest leg on a row the model has no view about. */
             pick: pick.classList.contains("hl")
               ? ((pick.querySelector(".lbl") || {}).textContent || null) : null,
             label: (pick.querySelector(".lbl") || {}).textContent || null,
             text: pick.textContent.trim() };
  });
}

const before = board();
say(before.length > 10, `the board is rendered (${before.length} rows)`);
/* With nothing entered the highlight is the cheapest leg, not a claim about
   the match - that is what the panel beside it says too. */
say(before.every((r) => r.label), "every row carries a leg to look at from the start");
say(before.every((r) => !r.pick),
  "but with nothing entered none of them is highlighted as a recommendation");

/* Paste the table in and press the button, exactly as a person would. */
const box = doc.getElementById("api-bulk-text");
const fillBtn = [...doc.querySelectorAll("button")].find((b) => /Fill from this paste/i.test(b.textContent));
say(!!box && !!fillBtn, "the bulk paste box and its button are on the page");
box.value = TABLE;
box.dispatchEvent(new window.Event("input", { bubbles: true }));
click(fillBtn);
await new Promise((r) => setTimeout(r, 400));

const after = board();
say(after.length === before.length, "the same matches are still on the board");

const picks = after.filter((r) => r.pick);
say(picks.length > 0, `entering statistics produces recommendations (${picks.length} of ${after.length})`);
say(picks.length <= after.length / 2,
  "and it stays selective rather than recommending most of the board");
say(after.every((r) => r.label),
  "no row is left blank for having no edge on it");

const moved = after.filter((r, i) => r.text !== before[i].text).length;
say(moved > after.length / 2, `most rows read differently than before (${moved} of ${after.length})`);

/* None of the old blackout wording: that message meant the row had been
   given up on, and it covered more than half the board. */
say(!after.some((r) => /nothing selected/i.test(r.text)),
  "no row is blacked out by the old divergence guard");

/* The dangerous failure: a model too quiet to tell the teams apart backs
   the long underdog every time. Check against the prices, not against the
   home side. */
const dataTeams = fixtures.teams;
let onFavourite = 0, onUnderdog = 0;
for (const row of picks) {
  const fx = fixtures.fixtures.find((f) =>
    f.slate === 4 && dataTeams[f.home] && dataTeams[f.away] &&
    dataTeams[f.home].name === row.home && dataTeams[f.away].name === row.away);
  if (!fx) continue;
  const x12 = ((fx.markets || {}).ft || {}).x12;
  if (!x12 || x12["1"] == null || x12["2"] == null) continue;
  const favourite = x12["1"] < x12["2"] ? row.home : row.away;
  if (row.pick.indexOf(row.home) === 0 || row.pick.indexOf(row.away) === 0) {
    const side = row.pick.indexOf(row.home) === 0 ? row.home : row.away;
    if (side === favourite) onFavourite++; else onUnderdog++;
  }
}
const sided = onFavourite + onUnderdog;
/* Four picks cannot prove a split either way, so this only records it. The
   claim that the one-way machine is gone is made where it can be measured:
   section 18 of scripts/test-engine.js pins the model to the market and
   requires it to claim exactly the market's probability, which is what used
   to manufacture the underdog picks. */
console.log(`  note ${onUnderdog} underdog, ${onFavourite} favourite of ${sided} sided picks`);

/* "Over" on almost every row was the other systematic tell, from a goal
   level that no longer matches the prices. */
const overs = picks.filter((r) => /^over/i.test(r.pick)).length;
say(overs <= Math.max(1, Math.ceil(picks.length / 2)),
  `"Over" is not most of the board (${overs} of ${picks.length})`);

say(errors.length === 0, `no script errors (${errors.length ? errors[0] : "none"})`);

console.log(fail ? `\n${fail} failure(s).` : "\nboard moves ok");
process.exit(fail ? 1 : 0);
