// The page is sold to a worldwide audience, so every word a reader can see
// must be English. Three separate sweeps by hand missed something each time:
// "Arti stabilo biru muda" survived one, "Model berbeda" and "Odds adil"
// another, and a whole colour legend - "kuning", "netral", "merah", "EV di
// atas" - survived all three, because a sweep that looks for known
// Indonesian words can only ever find the words somebody thought of.
//
// So this inverts it. Every word in a user-visible string is checked against
// a list of words known to belong on this page. A word nobody has vouched
// for fails the test, whatever language it is in - which is the only way an
// unknown word can be caught.
//
// Adding a word is deliberate: put it in VOCABULARY below, in the group it
// belongs to, and the test passes again.
//
//   node scripts/test-language.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* The words that may appear in text a reader sees. Kept in its own file so
   that adding one is a visible, reviewable act rather than a line buried in
   a test. */
const VOCAB_FILE = "scripts/page-vocabulary.txt";
const NOUN_FILE = "scripts/page-proper-nouns.txt";
const readList = (f) => fs.readFileSync(path.join(ROOT, f), "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));
const VOCABULARY = readList(VOCAB_FILE).concat(readList(NOUN_FILE));

const OK = new Set(VOCABULARY.map((w) => w.toLowerCase()));

/* Strings the reader sees. Developer comments are stripped first: the rules
   here are about the page, not about the notes explaining it. */
function proseFrom(file) {
  const txt = fs.readFileSync(path.join(ROOT, file), "utf8");
  const code = txt.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
  const found = [];
  if (file.endsWith(".html")) {
    for (const m of code.matchAll(/>([^<>{}]+)</g)) found.push(m[1]);
  } else {
    for (const m of code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)) {
      found.push(m[1] ?? m[2]);
    }
  }
  return found;
}

/* A literal is prose - something a person reads - rather than a class name,
   a selector or a bit of markup. */
function isProse(raw) {
  const text = raw.replace(/&[a-z]+;/gi, " ").replace(/<[^>]*>/g, " ")
                  .replace(/\\u[0-9a-f]{4}/gi, " ").replace(/\\[nt]/g, " ");
  if (/[{};]|^\s*[.#]|^[a-z-]+\s*:\s*\S/i.test(raw)) return null;   // css
  if (/var\(--|\d\s*px\b/.test(raw)) return null;                   // css value
  if (/=\s*["']|\bhref\b|\bsrc\b/.test(raw)) return null;           // half an attribute
  if (/\(\?|\\[dwsbu]|\[A-Za-z/.test(raw)) return null;              // part of a regex
  if (/^[\w-]+$/.test(raw.trim())) return null;                      // one token: an id or class
  const words = text.split(/[^A-Za-z']+/).filter((w) => w.replace(/'/g, "").length > 1);
  if (!words.length) return null;
  /* A three-word minimum was how "Babak 1: " survived: one word, then a
     number, then a colon, and the whole label was waved through as
     not-a-sentence. A single word IS prose when it is punctuated like
     prose - a space, a colon, a full stop - and an identifier never is. */
  if (words.length < 3 && !/[\s:.,;!?()\u2014\u2013]/.test(text.trim())) return null;
  return words;
}

let fail = 0;
const offenders = new Map();

/* Team and league names are read straight onto the board, so they are
   user-visible text too - and that is where "Republik Irlandia" sat while
   three sweeps of the JavaScript went past it. */
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/moneyball-fixtures.json"), "utf8"));
const names = [];
for (const k of Object.keys(DATA.teams || {})) names.push(DATA.teams[k].name || "");
for (const l of DATA.leagues || []) names.push(l.name || "");
for (const raw of names) {
  for (const w of String(raw).split(/[^A-Za-z']+/)) {
    const k = w.toLowerCase().replace(/^'+|'+$/g, "");
    if (k.length < 2 || OK.has(k)) continue;
    if (!offenders.has(k)) offenders.set(k, { file: "data/moneyball-fixtures.json", sample: raw });
  }
}

for (const file of ["js/moneyball-app.js", "js/moneyball-engine.js", "moneyball.html"]) {
  for (const raw of proseFrom(file)) {
    const words = isProse(raw);
    if (!words) continue;
    for (const w of words) {
      const k = w.toLowerCase().replace(/^'+|'+$/g, "");
      if (!k || OK.has(k)) continue;
      if (/^[a-z]?\d/i.test(k)) continue;                            // 1x2, 2nd, h1
      if (!offenders.has(k)) offenders.set(k, { file, sample: raw.trim().slice(0, 78) });
    }
  }
}

if (offenders.size) {
  console.log(`  FAIL ${offenders.size} word(s) in user-visible text are not in the vocabulary:`);
  for (const [w, o] of [...offenders].sort()) {
    console.log(`       "${w}"  ${o.file}\n         ...${o.sample}`);
  }
  console.log(`\n  If a word is correct English that this page should use, add it to`);
  console.log(`  ${VOCAB_FILE} (or ${NOUN_FILE} for a name), in alphabetical order.`);
  console.log(`  If it is not English, translate it.`);
  fail = 1;
} else {
  console.log("  ok   every word in user-visible text is English and vouched for");
}

console.log(fail ? "\nlanguage FAILED" : "\nlanguage ok");
process.exit(fail);
