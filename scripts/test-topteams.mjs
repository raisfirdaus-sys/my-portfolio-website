// Top Team Statistics: a team whose import brought goals, shots, tackles,
// fouls and cards but NO xG must still appear on the five boards for the
// figures it does have. It used to appear on none of them - effStats only
// clears statsMissing when both xG columns arrive, and the boards gated on
// that flag - so the subtitle counted a team the boards then refused to
// show. Run against the code before that fix, six of these fail.
//
//   npm i jsdom && node scripts/test-topteams.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = await import("jsdom")); }
catch { console.log("  skip jsdom is not installed - run: npm i jsdom"); process.exit(0); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, "data/moneyball-fixtures.json"), "utf8"));
const vc = new VirtualConsole();
const dom = await JSDOM.fromFile(path.join(ROOT, "moneyball.html"), {
  runScripts: "dangerously", resources: "usable", virtualConsole: vc,
  beforeParse(win) {
    // Leeds: imported goals/shots/tackles/fouls/cards, but NO xG - exactly the case that vanished.
    // file:// has an opaque origin, so jsdom's own localStorage throws; a
    // plain map is all the page needs.
    // Figures high enough to top every board it belongs on, so the check is
    // about whether the team is ADMITTED, not about who else is published
    // in the data file on the day the test runs.
    const store = {
      "mb-overrides": JSON.stringify({
        leeds: { matches: 7, goals: 9.71, shots: 39.43, fouls: 0.11,
                 tackles: 49.43, yellow: 9.43, red: 0, xgF: null }
      })
    };
    Object.defineProperty(win, "localStorage", {
      configurable: true,
      value: {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
        clear: () => { for (const k in store) delete store[k]; }
      }
    });
    win.fetch = (u) => Promise.resolve({ ok: true,
      json: () => Promise.resolve(String(u).includes("fixtures") ? fixtures : { items: [] }),
      text: () => Promise.resolve("") });
    win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }));
  }
});
await new Promise(r => setTimeout(r, 900));
const doc = dom.window.document;
let fail = 0;
const say = (ok, m) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${m}`); if (!ok) fail++; };

const cards = [...doc.querySelectorAll(".tt-card")];
const board = (title) => cards.find(c => (c.querySelector("h4")||{}).textContent === title);
const namesIn = (t) => { const b = board(t); return b ? [...b.querySelectorAll(".tt-name, td, li, span")].map(e=>e.textContent).join(" | ") : ""; };

say(cards.length > 0, `leaderboards rendered (${cards.length} boards)`);
say(/Leeds/i.test(namesIn("Goals per match")), "Leeds appears on Goals per match (it has that figure)");
say(/Leeds/i.test(namesIn("Shots")), "Leeds appears on Shots");
say(/Leeds/i.test(namesIn("Tackles")), "Leeds appears on Tackles");
say(/Leeds/i.test(namesIn("Fouls")), "Leeds appears on Fouls");
say(/Leeds/i.test(namesIn("Yellow cards")), "Leeds appears on Yellow cards");
say(!/Leeds/i.test(namesIn("xG created")), "Leeds does NOT appear on xG created (it has no xG)");
/* Arsenal was published with a real xG CONCEDED but no xG created, so it
   must stay off the xG created board however it is flagged. */
say(!/Arsenal/i.test(namesIn("xG created")),
  "a team with no xG created stays off that board, measured flag or not");

/* The subtitle must count the same teams the boards will show: everything
   published as measured, plus whatever this browser has entered. Pinning a
   literal number here only tested how much happened to be published. */
const TT_FIELDS = ["xgF", "xgA", "goals", "shots", "sot", "tackles", "fouls", "yellow"];
const expected = Object.keys(fixtures.teams).filter((k) => {
  const t = fixtures.teams[k];
  if (k === "leeds") return true;                       // entered in this browser
  return t.measured && TT_FIELDS.some((f) => t[f] != null);
}).length;
const sub = (doc.getElementById("tt-sub")||{}).textContent || "";
say(sub.indexOf(expected + " teams with real data") === 0,
  `subtitle counts the same way the boards do (got "${sub}", expected ${expected})`);

console.log(fail ? `\n${fail} failure(s).` : "\ntop-teams ok");
process.exit(fail ? 1 : 0);
