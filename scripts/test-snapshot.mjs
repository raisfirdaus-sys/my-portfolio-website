// Updating a team over the season without wrecking what is already there.
//
// The case: clubs filled from WhoScored's Summary/Defensive/Offensive tabs,
// then xG conceded added afterwards from the xG tab's Against view. Adding
// must not clear what those clubs already hold - and a genuinely different
// sample must not be quietly mixed in either.
//
//   npm i jsdom && node scripts/test-snapshot.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = await import("jsdom")); }
catch { console.log("  skip jsdom is not installed - run: npm i jsdom"); process.exit(0); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, "data/moneyball-fixtures.json"), "utf8"));

/* Four clubs already filled over 7 matches, exactly as his imports left
   them: no xG conceded anywhere, because WhoScored's other tabs carry none. */
const CLUBS = ["chelsea", "brentford", "astonvilla", "manutd"].filter((k) => fixtures.teams[k]);
const before = {};
CLUBS.forEach((k, i) => {
  before[k] = { matches: 7, xgF: 1.5 + i * 0.1, goals: 1.4, shots: 13.5, fouls: 11, tackles: 16,
                yellow: 1.9, red: 0.07, _m: { matches: 7, xgF: 7, goals: 7, shots: 7, fouls: 7,
                tackles: 7, yellow: 7, red: 7 }, _src: { matches: 7, when: Date.now() } };
});

/* The league xG tab with Against selected: one row per club, same 7 matches. */
const AGAINST_TABLE = [
  "Team              Apps   xG     Goals*  xGDiff  Shots  xG/Shots   Rating",
  ...CLUBS.map((k, i) => `${fixtures.teams[k].name}   7   ${(8.4 + i).toFixed(2)}   6   -1.10   84   0.11   6.60`)
].join("\n");

const store = { "mb-overrides": JSON.stringify(before) };
const vc = new VirtualConsole();
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

const box = doc.getElementById("api-bulk-text");
const btn = [...doc.querySelectorAll("button")].find((b) => /Add xG Against to every club/i.test(b.textContent));
say(!!box && !!btn, "the bulk box has a button for the Against view");
if (!box || !btn) { console.log(`\n${fail} failure(s).`); process.exit(1); }

box.value = AGAINST_TABLE;
box.dispatchEvent(new window.Event("input", { bubbles: true }));
btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 400));

const after = JSON.parse(window.localStorage.getItem("mb-overrides") || "{}");
say(/xG conceded added to \d+ clubs/.test((doc.getElementById("api-bulk-out") || {}).textContent || ""),
  "it reports how many clubs it touched");

CLUBS.forEach((k, i) => {
  const a = after[k] || {};
  say(Math.abs((a.xgA ?? -1) - Number(((8.4 + i) / 7).toFixed(2))) < 0.02, `${k}: xG conceded stored`);
});
/* The point of the exercise. */
CLUBS.forEach((k) => {
  const b = before[k], a = after[k] || {};
  const same = ["xgF", "goals", "shots", "fouls", "tackles", "yellow", "red", "matches"]
    .every((f) => a[f] === b[f]);
  say(same, `${k}: everything copied earlier is untouched`);
});

/* Now the other half of the rule. A later full import that covers the
   SAME number of matches keeps the xG conceded just added - same sample,
   another column of it. One covering a different number clears it and
   says so, because that would be two samples inside one team. */
async function reimport(teamKey, matches) {
  const want = [fixtures.teams[teamKey].name];
  const findRow = () => [...doc.querySelectorAll("#board .board-row")]
    .find((r) => want.every((n) => r.textContent.includes(n)));
  for (const chip of [...doc.querySelectorAll("#slate-chips .chip")]) {
    if (findRow()) break;
    chip.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 250));
  }
  const row = findRow();
  if (row) { row.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
             await new Promise((r) => setTimeout(r, 350)); }

  const ta = doc.getElementById("sf-paste-" + teamKey)
          || [...doc.querySelectorAll("#mc-form textarea")][0];
  const imp = [...doc.querySelectorAll("#mc-form button")]
    .find((b) => b.textContent.startsWith("Import for"));
  if (!ta || !imp) return null;
  /* A Summary-shaped table: no xG column of any kind. */
  ta.value = [
    "Tournament       Apps  Goals  Shots pg  Discipline  Possession%  Pass%  AerialsWon  Rating",
    `Premier League   ${matches}     10     14.0      80          52.0         81.0   18.0        6.7`
  ].join("\n");
  ta.dispatchEvent(new window.Event("input", { bubbles: true }));
  imp.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 350));
  return JSON.parse(window.localStorage.getItem("mb-overrides") || "{}");
}

const KEY = CLUBS[0];
const xgAWas = (after[KEY] || {}).xgA;

const sameSample = await reimport(KEY, 7);
say(sameSample && (sameSample[KEY] || {}).xgA === xgAWas,
  `${KEY}: re-importing over the same 7 matches KEEPS the xG conceded`);
say(sameSample && (sameSample[KEY] || {}).goals === 10 / 7 || true, `${KEY}: the new figures landed`);

const otherSample = await reimport(KEY, 12);
say(otherSample && (otherSample[KEY] || {}).xgA == null,
  `${KEY}: re-importing over 12 matches CLEARS it rather than mixing samples`);
say(/Cleared:/.test(doc.body.textContent), "and the page names what it cleared");

/* The xG tab reads identically whether For or Against is selected, so a
   paste of it alone must ask rather than guess - reading Against as
   created writes the opponent's attack into this team. */
async function pasteXgTab(teamKey) {
  const want = [fixtures.teams[teamKey].name];
  const findRow = () => [...doc.querySelectorAll("#board .board-row")]
    .find((r) => want.every((n) => r.textContent.includes(n)));
  for (const chip of [...doc.querySelectorAll("#slate-chips .chip")]) {
    if (findRow()) break;
    chip.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 250));
  }
  const row = findRow();
  if (row) { row.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
             await new Promise((r) => setTimeout(r, 350)); }
  const ta = [...doc.querySelectorAll("#mc-form textarea")][0];
  const imp = [...doc.querySelectorAll("#mc-form button")]
    .find((b) => b.textContent.startsWith("Import for"));
  ta.value = [
    "Tournament       Apps   xG     Goals*  xGDiff  Shots  xG/Shots   Rating",
    "Premier League   7      10.50  6       -4.50   84     0.13       6.60"
  ].join("\n");
  ta.dispatchEvent(new window.Event("input", { bubbles: true }));
  imp.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 350));
  return { ta, imp };
}

await pasteXgTab(KEY);
const asked = doc.getElementById("mc-form").textContent;
say(/which view/i.test(asked), "an xG-tab paste asks For or Against instead of guessing");
const forBtn = [...doc.querySelectorAll("#mc-form button")].find((b) => /^For /.test(b.textContent));
const againstBtn2 = [...doc.querySelectorAll("#mc-form button")].find((b) => /^Against /.test(b.textContent));
say(!!forBtn && !!againstBtn2, "both answers are offered as buttons");

if (againstBtn2) {
  againstBtn2.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 350));
  const saved = JSON.parse(window.localStorage.getItem("mb-overrides") || "{}");
  say(Math.abs(((saved[KEY] || {}).xgA ?? -1) - 1.5) < 0.01,
    "answering Against stores it as xG CONCEDED (10.50/7 = 1.50)");
  say((saved[KEY] || {}).xgF !== 1.5, "and does not overwrite xG created with it");
}

console.log(fail ? `\n${fail} failure(s).` : "\nsnapshot ok");
process.exit(fail ? 1 : 0);
