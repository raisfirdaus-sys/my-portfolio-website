// Checks the news competition filter against real headlines that leaked
// through it. Run: node scripts/test-news-filter.mjs
//
// The cases below are verbatim from data/football-news.json on 23 Sep 2026,
// when a quarter of the brief turned out to be UEFA Women's Champions League
// coverage tagged to the men's clubs on the board.

import { isOtherCompetition } from "./fetch-football-news.mjs";

/* Wording alone should catch these. */
const MUST_DROP = [
  "UEFA Women's Champions League Matchday 1 Wednesday preview: Barcelona vs Paris FC, Chelsea vs Austria Wien",
  "Mariona Caldentey penalty provides late WCL relief for Arsenal against Køge",
  "Wamser rescues point for Manchester City in WCL fightback at Bayern Munich",
  "Arsenal start UEFA Women's Champions League campaign with a win, but where are the goals going to come from?",
  "Watch cool Gwinn finish for Bayern | Video | UEFA Women's Champions League",
  "Women's Champions League highlights: Arsenal 1-0 HB Køge",
  "Bayern Munich Frauen suffer second half collapse in 2-2 draw with Manchester City",
  "Real Madrid need more from young star Schröder to reach new UWCL heights",
  "Arsenal wins late, Man City draws at Bayern as UWCL returns",
  "Real Madrid draws in their debut in the Women’s Champions League",   // curly apostrophe
  "Manchester City goal in Women’s Champions League allowed to stand despite flare on pitch",
  "Juventus vs Benfica: UEFA Women's Champions League stats & head-to-head",
  "Chelsea U21 beaten by Arsenal youth side",
  "Barcelona Femeníno secure comfortable win",
  "Juventus Femminile draw at home"
];

/* Real men's-team stories. None of these may be dropped. */
const MUST_KEEP = [
  "Portugal vs Wales Preview - Jorge Jesus era begins in the UEFA Nations League",
  "Vinícius Junior's Crisis at Real Madrid Could Have an Unexpected Origin",
  "Transfer news LIVE: Arsenal plot Alvarez loan; three Chelsea targets; Man Utd, Liverpool latest",
  "De Bruyne: I did not try to leave Napoli",
  "Mikel Arteta agrees contract extension expected to keep him at Arsenal until 2030",
  "England vs Spain UEFA Nations League preview: Everything you need to know",
  "Former Manchester City star Sergio Agüero says Bayern Munich is team no one wants to face in Champions League",
  "Bavarian Loan Works: Two Bayern Munich loanees meet in 2. Budesliga",
  "Real Madrid Clashes With La Liga Over Refereeing",
  "PREVIEW | Netherlands vs Germany: team news, lineups, predictions (UEFA Nations League 24/09)",
  "Sunderland Could Reignite Their Interest In This Ligue 1 Winger: Should Le Bris Move In For Him?",
  "Zakaria’s adductor injury revealed after Switzerland withdrawal"
];

/* Wording gives nothing away on these: only the blocklist feeds can catch
   them. Recorded so the next person knows layer 1 is not expected to. */
const WORDING_CANNOT_CATCH = [
  "Bayern 2-2 Man City (Sep 22, 2026) Game Analysis",
  "Arsenal 1-0 HB Køge (Sep 22, 2026) Game Analysis",
  "Slegers praises Arsenal’s resilience after late Champions League win",
  "Reaction: Bayern's Gwinn on 'frustrating' draw",
  "Man City fight back from two down to thwart Bayern"
];

let fail = 0;
for (const t of MUST_DROP) {
  if (!isOtherCompetition(t)) { console.error("FAIL: should have been dropped:\n  " + t); fail++; }
}
for (const t of MUST_KEEP) {
  if (isOtherCompetition(t)) { console.error("FAIL: dropped a men's story:\n  " + t); fail++; }
}
console.log(`  ok   ${MUST_DROP.length} other-competition headlines dropped by wording`);
console.log(`  ok   ${MUST_KEEP.length} men's headlines kept`);
console.log(`  note ${WORDING_CANNOT_CATCH.length} headlines need the blocklist feeds (no wording tell)`);

if (fail) { console.error(`\n${fail} failure(s).`); process.exit(1); }
console.log("news filter ok");
