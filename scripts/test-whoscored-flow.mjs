// The WhoScored workflow, end to end, with the figures his four tabs give:
// matches, xG created, goals, shots, tackles, fouls, cards - and no xG
// conceded, because WhoScored publishes none outside the xG tab's
// "Against" view. That must be enough to move the prices.
//
//   npm i jsdom && node scripts/test-whoscored-flow.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = await import("jsdom")); }
catch { console.log("  skip jsdom is not installed - run: npm i jsdom"); process.exit(0); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, "data/moneyball-fixtures.json"), "utf8"));

/* This has to be a fixture whose BOTH sides ship with no statistics at
   all - Chelsea vs Bournemouth, the one he was filling. On a fixture that
   already carries placeholder figures the gate never closes, so the test
   passes against broken code and proves nothing; that is exactly what it
   did on the first attempt.

   The figures are the ones WhoScored's four tabs give, with xG conceded
   nowhere among them. */
const TARGET = fixtures.fixtures.find((f) =>
  fixtures.teams[f.home] && fixtures.teams[f.away] &&
  fixtures.teams[f.home].statsMissing && fixtures.teams[f.away].statsMissing);
const WHOSCORED_HOME = { matches: 7, xgF: 1.55, goals: 1.25, shots: 14.95, fouls: 9, tackles: 13.86, yellow: 1.43, red: 0 };
const WHOSCORED_AWAY = { matches: 7, xgF: 1.38, goals: 1.58, shots: 13.63, sot: 4, fouls: 11.43, tackles: 16, yellow: 2, red: 0.14 };

async function page(store) {
  const vc = new VirtualConsole();
  const dom = await JSDOM.fromFile(path.join(ROOT, "moneyball.html"), {
    runScripts: "dangerously", resources: "usable", virtualConsole: vc,
    beforeParse(win) {
      Object.defineProperty(win, "localStorage", {
        configurable: true,
        value: { getItem: (k) => (k in store ? store[k] : null),
                 setItem: (k, v) => { store[k] = String(v); },
                 removeItem: (k) => { delete store[k]; }, clear: () => {} }
      });
      win.fetch = (u) => Promise.resolve({ ok: true,
        json: () => Promise.resolve(String(u).includes("fixtures") ? fixtures : { items: [] }),
        text: () => Promise.resolve("") });
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener(){}, removeListener(){},
        addEventListener(){}, removeEventListener(){} }));
    }
  });
  await new Promise((r) => setTimeout(r, 900));

  /* The board opens on another schedule, and only that schedule's
     fixtures are drawn - so walk the schedule chips until the target
     appears, then click it. */
  const doc = dom.window.document;
  const win = dom.window;
  const want = [fixtures.teams[TARGET.home].name, fixtures.teams[TARGET.away].name];
  const findRow = () => [...doc.querySelectorAll("#board .board-row")]
    .find((r) => want.every((n) => r.textContent.includes(n)));

  for (const chip of [...doc.querySelectorAll("#slate-chips .chip")]) {
    if (findRow()) break;
    chip.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 250));
  }
  const row = findRow();
  if (row) {
    row.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
  }
  return dom;
}

let fail = 0;
const say = (ok, m) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${m}`); if (!ok) fail++; };

const bare = await page({});

/* Confirm the click landed: the form must be showing the target fixture,
   or everything below would be measuring some other match. */
const shown = [...bare.window.document.querySelectorAll("#mc-form h4")]
  .map((n) => n.textContent.replace(/\s*\(.*$/, "").trim()).filter(Boolean);
const wantNames = [fixtures.teams[TARGET.home].name, fixtures.teams[TARGET.away].name];
say(shown[0] === wantNames[0] && shown[1] === wantNames[1],
  `the board is showing ${wantNames.join(" vs ")} (got ${shown.join(" vs ") || "nothing"})`);

const overrides = { [TARGET.home]: WHOSCORED_HOME, [TARGET.away]: WHOSCORED_AWAY };
const filled = await page({ "mb-overrides": JSON.stringify(overrides) });

/* Read the MODEL PROB. column by its heading, not by position, and only
   that column. Comparing whole rows was too loose: the sample-size badge
   moves when the match count changes even while the model is pinned to
   the market, so a broken build passed. What he is asking about is this
   number and nothing else. */
const probs = (dom) => {
  const host = dom.window.document.getElementById("mc-value");
  if (!host) return null;
  const heads = [...host.querySelectorAll("thead th")].map((th) => th.textContent.trim().toUpperCase());
  const col = heads.findIndex((h) => h.startsWith("MODEL PROB"));
  if (col < 0) return null;
  return [...host.querySelectorAll("tbody tr")]
    .map((tr) => [(tr.children[0] || {}).textContent, (tr.children[col] || {}).textContent].join("="))
    .join("|");
};

const before = probs(bare), after = probs(filled);
say(!!before && before.length > 0, "the value board renders a Model Prob. column");
say(before !== after,
  "WhoScored's four tabs alone MOVE the model probabilities" +
  (before === after ? ` (both read ${String(before).slice(0, 60)}…)` : ""));

const txt = filled.window.document.body.textContent;
say(!/No team statistics entered/.test(txt), "the page no longer claims nothing was entered");
say(/assumed league average/.test(txt), "it says plainly that xG conceded is an assumption");

const btn = [...filled.window.document.querySelectorAll("button")]
  .find((b) => /Import xG Against/i.test(b.textContent));
say(!!btn, "there is a button for the xG tab's Against view");

say(!/Drawe A/.test(txt), "Serie A is not called \"Drawe A\" anywhere on the page");

console.log(fail ? `\n${fail} failure(s).` : "\nwhoscored flow ok");
process.exit(fail ? 1 : 0);
