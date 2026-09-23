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
    const store = {
      "mb-overrides": JSON.stringify({
        leeds: { matches: 7, goals: 1.71, shots: 13.43, fouls: 10.71, tackles: 17.43, yellow: 1.43, red: 0 }
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
say(!/Arsenal/i.test(namesIn("xG created")), "Arsenal (placeholder seeds, never imported) stays off the real-data board");

const sub = (doc.getElementById("tt-sub")||{}).textContent || "";
say(/^1 teams? with your data/.test(sub), `subtitle counts the same way the boards do (got "${sub}")`);

console.log(fail ? `\n${fail} failure(s).` : "\ntop-teams ok");
process.exit(fail ? 1 : 0);
