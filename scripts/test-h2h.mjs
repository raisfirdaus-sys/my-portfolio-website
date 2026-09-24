// "TERLALU RENDAH KAN LEITCH VS LITUANIA SUDAH TAK FEELING DI HATI SOALNYA
//  H2H NYA GAK BISA APA-APA LEITCH ITU"
//
// The page rated Liechtenstein +1.50 at 52.3% and they lost 0-2 at home.
// The reader knew it was wrong before kick-off, from the head to head. The
// model had never seen a single previous meeting - it had the bookmaker's
// price and a season of xG and nothing else.
//
// This drives the real page: paste meetings, press the button, and require
// the fixture to be priced differently afterwards.
//
//   npm i jsdom && node scripts/test-h2h.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = await import("jsdom")); }
catch { console.log("  skip jsdom is not installed - run: npm i jsdom"); process.exit(0); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, "data/moneyball-fixtures.json"), "utf8"));
const E = (await import(path.join(ROOT, "js/moneyball-engine.js"))).default
       ?? (await import(path.join(ROOT, "js/moneyball-engine.js")));

let fail = 0;
const say = (ok, m) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${m}`); if (!ok) fail++; };

/* ---------------------------------------------------------- the parser -- */
const names = {};
Object.keys(fixtures.teams).forEach((k) => { names[fixtures.teams[k].name.toLowerCase()] = k; });
const toKey = (n) => names[String(n).toLowerCase().trim()] ?? null;

const PASTE = [
  "24/03/2025 Lithuania 2 - 0 Liechtenstein",
  "2024-10-14 Liechtenstein 0-1 Lithuania",
  "Sep 7, 2024 Lithuania 1-0 Liechtenstein",
  "15/11/2022 Liechtenstein 0-2 Lithuania",
  "a line that is not a result at all"
].join("\n");

const parsed = E.parseH2H(PASTE, toKey);
say(parsed.meetings.length === 4, `four meetings read (got ${parsed.meetings.length})`);
say(parsed.skipped.length === 1, "the line that is not a result is reported, not silently dropped");

/* ISO dates were being chewed from the middle: "2024-10-14" matched as
   24-10-14 and the row was thrown away with "20" stuck to the team name. */
const iso = parsed.meetings.find((m) => m.home === "liechtenstein" && m.hg === 0 && m.ag === 1);
say(!!iso, "an ISO date is read, not mistaken for a day/month/year");
say(iso && new Date(iso.date).toISOString().slice(0, 10) === "2024-10-14",
  `and lands on the right day (got ${iso ? new Date(iso.date).toISOString().slice(0, 10) : "-"})`);
const named = parsed.meetings.find((m) => m.hg === 1 && m.ag === 0);
say(named && new Date(named.date).toISOString().slice(0, 10) === "2024-09-07",
  "a written month is read too");

/* ------------------------------------------------------- the reading ---- */
const now = Date.UTC(2026, 8, 24);
const r = E.h2hReading(parsed.meetings, "liechtenstein", "lithuania", { now });
say(r && r.n === 4, "all four count toward the reading");
say(r && r.supremacy < 0, `Lithuania come out ahead (supremacy ${r ? r.supremacy.toFixed(2) : "-"})`);

/* Venue must be taken out, and taken out the right way round: the same
   scoreline won AWAY is the better performance, so it must read as the
   stronger one by exactly twice the home edge. */
const atHome = [{ date: now, home: "lithuania", away: "liechtenstein", hg: 2, ag: 0 }];
const away   = [{ date: now, home: "liechtenstein", away: "lithuania", hg: 0, ag: 2 }];
const rHome = E.h2hReading(atHome, "liechtenstein", "lithuania", { now, venueEdge: 0.35 });
const rAway = E.h2hReading(away,   "liechtenstein", "lithuania", { now, venueEdge: 0.35 });
say(Math.abs((rHome.supremacy - rAway.supremacy) - 0.70) < 1e-9,
  `the same win away reads stronger by twice the home edge (${(rHome.supremacy - rAway.supremacy).toFixed(2)})`);
say(rHome.total === rAway.total, "and the goal total is untouched by where it was played");

/* Age must matter: the same result long ago counts for less. */
const old = [{ date: Date.UTC(2006, 0, 1), home: "lithuania", away: "liechtenstein", hg: 2, ag: 0 }];
const fresh = [{ date: Date.UTC(2026, 0, 1), home: "lithuania", away: "liechtenstein", hg: 2, ag: 0 }];
say(E.h2hReading(old, "liechtenstein", "lithuania", { now }).weight <
    E.h2hReading(fresh, "liechtenstein", "lithuania", { now }).weight / 4,
  "a twenty-year-old meeting counts for a fraction of a recent one");

/* A head to head may inform the ratings, never replace them. */
const huge = [];
for (let i = 0; i < 40; i++) {
  huge.push({ date: Date.UTC(2026, 0, 1), home: "lithuania", away: "liechtenstein", hg: 9, ag: 0 });
}
const fx = fixtures.fixtures.find((f) => f.id === "lie-ltu");
const rHuge = E.h2hReading(huge, "liechtenstein", "lithuania", { now });
const aHuge = E.analyseFixture(fx, fixtures.teams, fixtures.leagues, { marketWeight: 0.35, h2h: rHuge });
say(aHuge.h2h.weight <= 0.451,
  `forty 9-0 results still cannot take over the fixture (weight ${aHuge.h2h.weight.toFixed(2)})`);

/* ----------------------------------------------------------- the page --- */
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
await new Promise((r2) => setTimeout(r2, 900));
const { window } = dom, doc = window.document;
const click = (elm) => elm.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

const tab = [...doc.querySelectorAll("button")].find((b) => /24-27 Sept 2026/i.test(b.textContent));
click(tab);
await new Promise((r2) => setTimeout(r2, 120));

function rowFor(home, away) {
  return [...doc.querySelectorAll(".board-row")].find((row) => {
    const t = [...row.querySelectorAll(".board-team span")].map((x) => x.textContent.trim());
    return t[0] === home && t[1] === away;
  });
}
const before = rowFor("Liechtenstein", "Lithuania");
say(!!before, "the fixture is on the board");
const beforeText = before.querySelector(".board-pick").textContent.trim();

const box = doc.getElementById("h2h-text");
const btn = doc.getElementById("h2h-apply");
say(!!box && !!btn, "the head-to-head box and its button are on the page");
box.value = PASTE;
box.dispatchEvent(new window.Event("input", { bubbles: true }));
click(btn);
await new Promise((r2) => setTimeout(r2, 300));

const out = (doc.getElementById("h2h-out") || {}).textContent || "";
say(/4 meetings read/i.test(out), `it reports what it read (got "${out.slice(0, 60)}")`);
say(/Liechtenstein/.test(out) && /Lithuania/.test(out),
  "and which two teams the meetings belong to");
say(/neutral ground/i.test(out), "and that the venue was taken out");

const after = rowFor("Liechtenstein", "Lithuania");
const afterText = after.querySelector(".board-pick").textContent.trim();
say(afterText !== beforeText,
  "the fixture is priced differently once the meetings are in");

/* It must survive a reload: entering a head to head is work. */
say(!!store["mb-h2h"], "the meetings are kept in browser storage");
const kept = JSON.parse(store["mb-h2h"]);
say(Object.keys(kept)[0] === "liechtenstein|lithuania",
  "stored against the pairing, not against one fixture");
say(kept["liechtenstein|lithuania"].meetings.length === 4, "with all four meetings");

/* And it must be shown, not just used. */
const mc = (doc.getElementById("mc-h2h") || {}).textContent || "";
say(mc.length > 0, "the match centre has a head-to-head panel");

say(errors.length === 0, `no script errors (${errors.length ? errors[0] : "none"})`);

console.log(fail ? `\n${fail} failure(s).` : "\nhead to head ok");
process.exit(fail ? 1 : 0);
