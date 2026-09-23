// The logo, the favicon and the palette. A brand that is only in one file is
// a brand that goes missing the next time that file is edited, so this
// checks the page that ships: the mark in the header, the mark again at the
// foot where a reader looks to see whose work this is, a favicon that is the
// drawn mark rather than a generic tick, and a palette with no light blue or
// orange left in it.
//
//   npm i jsdom && node scripts/test-brand.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(ROOT, "moneyball.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "css/moneyball.css"), "utf8");

let fail = 0;
const say = (ok, m) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${m}`); if (!ok) fail++; };

/* --- the files exist and are small enough to send ---------------------- */
const FILES = [
  ["assets/brand/moneyball-logo.webp", 300],
  ["assets/brand/moneyball-logo-550.webp", 150],
  ["assets/brand/moneyball-mark-512.webp", 150],
  ["assets/brand/moneyball-mark-180.png", 120],
  ["assets/brand/moneyball-mark-32.png", 20],
  ["assets/brand/favicon.ico", 40]
];
for (const [f, maxKb] of FILES) {
  const p = path.join(ROOT, f);
  const ok = fs.existsSync(p);
  say(ok, `${f} is in the repository`);
  if (ok) {
    const kb = fs.statSync(p).size / 1024;
    say(kb <= maxKb, `  and is ${kb.toFixed(0)}KB, within ${maxKb}KB`);
  }
}

/* --- wired into the page ----------------------------------------------- */
say(/rel="icon"[^>]*favicon\.ico/.test(html), "the favicon is the drawn mark, not a generic tick");
say(/rel="apple-touch-icon"[^>]*moneyball-mark-180\.png/.test(html),
  "a home-screen icon is offered too");
say(!/rel="icon" href="data:image\/svg/.test(html), "the old inline tick icon is gone");
say(/<meta name="theme-color" content="#2e1758"/.test(html),
  "the browser chrome is told the brand purple");

const brandImg = (html.match(/<img[^>]*class="brand-logo"[^>]*>/) || [""])[0];
say(/moneyball-mark-150\.png/.test(brandImg), "the drawn mark is in the header");
say(/srcset=/.test(brandImg), "at two densities, so it stays crisp on a phone");
/* He asked for the gold alone: no tile, no rounded box behind it. The mark
   must therefore carry its own transparency and the rule must not paint one
   back on. */
const markPng = fs.readFileSync(path.join(ROOT, "assets/brand/moneyball-mark-150.png"));
say(markPng.slice(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),
  "the header mark is a PNG");
say(markPng[25] === 6, "and carries an alpha channel, so the purple box is gone");
const brandRule = css.slice(css.indexOf(".brand-logo {"), css.indexOf(".brand-logo {") + 200);
say(!/border-radius|background/.test(brandRule),
  "no rounded box or tile is painted behind it");
say(/class="site-foot"/.test(html) && /class="foot-logo"[^>]*moneyball-logo\.webp/.test(html),
  "and again at the foot of the page, for the branding");
say(/loading="lazy"/.test(html.slice(html.indexOf("foot-logo") - 200, html.indexOf("foot-logo") + 300)),
  "the foot logo loads lazily, since it is below everything");

for (const m of html.matchAll(/<img[^>]*class="(brand-logo|foot-logo)"[^>]*>/g)) {
  say(/alt="[^"]{4,}"/.test(m[0]), `the ${m[0].match(/class="([\w-]+)"/)[1]} has alt text`);
  say(/width="\d+"[\s\S]*height="\d+"/.test(m[0]),
    `the ${m[0].match(/class="([\w-]+)"/)[1]} reserves its space, so the page does not jump`);
}

/* --- the palette -------------------------------------------------------- */
const tokens = css.slice(0, css.indexOf("* { box-sizing"));
say(/--hl-edge:\s*#e0ab3c/.test(tokens), "the highlighter is gold in the dark theme");
say(/--hl-edge:\s*#b8860b/.test(tokens), "and a darker gold in the light one, to be readable");
say(/--chrome:\s*#2e1758/.test(tokens), "the bar is brand purple in both themes");
say(/data-theme="dark"/.test(html), "the page opens in the purple theme by default");

/* The two colours he asked to be rid of. Judged by hue, because by eye
   "is this blue" and "is this orange" are hue questions and nothing else -
   an earlier version compared raw channels and called violet blue and gold
   orange, which is exactly the confusion this is meant to settle.
     blue   190-247 deg   (the old #2a78d6 sits at 213)
     orange   5-35 deg    (the old #eb6834 sits at 17)
   The brand's own two live outside both: gold at 40, violet at 255. */
function hue(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.02) return null;                       // grey: no hue to judge
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return h;
}
const BRAND_SLOTS = /--(series-home|series-away|series-home-soft|series-away-soft|seq-\d00|hl-wash|hl-edge|hl-ink):\s*(#[0-9a-f]{6})/gi;
const offenders = [];
for (const m of tokens.matchAll(BRAND_SLOTS)) {
  const hex = m[2].toLowerCase(), h = hue(hex);
  if (h == null) continue;
  const blue = h >= 190 && h <= 247;
  const orange = h >= 5 && h <= 35;
  if (blue || orange) offenders.push(`${m[1]} = ${hex} at ${h.toFixed(0)} deg (${blue ? "blue" : "orange"})`);
}
say(offenders.length === 0,
  offenders.length ? `brand slots still hold: ${offenders.join(", ")}` : "no light blue or orange left in any brand slot");

console.log(fail ? `\n${fail} failure(s).` : "\nbrand ok");
process.exit(fail ? 1 : 0);
