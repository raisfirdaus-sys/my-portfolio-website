const E = require(require('path').join(__dirname,'../js/moneyball-engine.js'));
const D = require(require('path').join(__dirname,'../data/moneyball-fixtures.json'));
let fail = 0;
function eq(name, got, want, tol) {
  const ok = tol != null ? Math.abs(got - want) <= tol : got === want;
  if (!ok) { fail++; console.log('  FAIL ' + name + ': got ' + got + ' want ' + want); }
  else console.log('  ok   ' + name + ' = ' + got);
}

console.log('\n== 1. Score matrix normalisation ==');
const M = E.scoreMatrix(1.7, 1.2, -0.055);
eq('matrix sums to 1', M.flat().reduce((a,b)=>a+b,0), 1, 1e-9);
eq('all cells >= 0', M.flat().every(v=>v>=0), true);

console.log('\n== 2. Quarter-line splitting ==');
eq('0.75 -> [0.5,1.0]', JSON.stringify(E.sublines(0.75)), '[0.5,1]');
eq('-0.75 -> [-1,-0.5]', JSON.stringify(E.sublines(-0.75)), '[-1,-0.5]');
eq('0.5 stays whole', JSON.stringify(E.sublines(0.5)), '[0.5]');
eq('2.0 stays whole', JSON.stringify(E.sublines(2)), '[2]');
eq('lineType 0.75', E.lineType(0.75), 'quarter');
eq('lineType -1.75', E.lineType(-1.75), 'quarter');
eq('lineType 0.5', E.lineType(0.5), 'half');
eq('lineType 2', E.lineType(2), 'whole');

console.log('\n== 3. Settlement vs the 9 REAL legs on slip 526461885 ==');
// Marseille +1.75, FT 1:2  -> full win
eq('Marseille +1.75 @ 1:2', E.settleAH(1,2,1.75,'home'), 1);
// Bournemouth +0.75, FT 0:1 -> half lose
eq('Bournemouth +0.75 @ 0:1', E.settleAH(0,1,0.75,'home'), -0.5);
// Villarreal -0.75, FT 3:1 -> full win
eq('Villarreal -0.75 @ 3:1', E.settleAH(3,1,-0.75,'home'), 1);
// Man City Over 2.50, FT 5:3 -> full win
eq('Over 2.50 @ 5:3', E.settleOU(5,3,2.5,'over'), 1);
// Leeds Under 3.00, FT 0:0 -> full win
eq('Under 3.00 @ 0:0', E.settleOU(0,0,3,'under'), 1);
// Fulham 1H Under 1.50, 1H 0:0 -> full win
eq('1H Under 1.50 @ 0:0', E.settleOU(0,0,1.5,'under'), 1);
// Fiorentina 1H Under 1.25, 1H 0:1 -> half WIN
eq('1H Under 1.25 @ 0:1', E.settleOU(0,1,1.25,'under'), 0.5);
// Juventus Over 2.25, FT 2:0 -> half LOSE
eq('Over 2.25 @ 2:0', E.settleOU(2,0,2.25,'over'), -0.5);
// Atletico 1H Under 1.50, 1H 0:0 -> full win
eq('1H Under 1.50 @ 0:0 (b)', E.settleOU(0,0,1.5,'under'), 1);

console.log('\n== 4. Push cases (whole lines) ==');
eq('Under 3.00 @ 2:1 = push', E.settleOU(2,1,3,'under'), 0);
eq('Home -1.00 @ 2:1 = push', E.settleAH(2,1,-1,'home'), 0);
eq('Home 0.00 @ 1:1 = push', E.settleAH(1,1,0,'home'), 0);

console.log('\n== 5. Slip payout reconstruction ==');
const legs = D.verifiedSlip.legs;
const outMap = { 'Won':'win','Half Won':'halfWin','Half Lose':'halfLose','Lose':'lose','Push':'push' };
let mult = 1;
legs.forEach(l => { mult *= E.legMultiplier(outMap[l.result], l.odds); });
const gross = mult * D.verifiedSlip.stake;
eq('gross return multiple', Math.round(mult*10000)/10000, 6.0696, 0.002);
eq('net profit matches ticket (506.96)', Math.round((gross - D.verifiedSlip.stake)*100)/100, D.verifiedSlip.payout, 0.05);
console.log('  -> printed odds ' + D.verifiedSlip.ticketOdds + ' would gross ' + (D.verifiedSlip.ticketOdds*100).toFixed(2));
console.log('  -> actual gross ' + gross.toFixed(2) + '  = ' + (100*gross/(D.verifiedSlip.ticketOdds*100)).toFixed(1) + '% of printed potential');

console.log('\n== 6. Fair-odds sanity: model must price a 50/50 at ~2.00 ==');
const Meven = E.scoreMatrix(1.35, 1.35, -0.055);
const b = E.evaluateBet(Meven, (i,j)=>E.settleAH(i,j,0.25,'home'));
// Analytic check: for a symmetric match a +0.25 bet has w = p + d/2, l = p,
// so fair odds = 1 + p/(p + d/2) -- NOT 2.00, because the draw refunds half
// the stake. The engine must reproduce that closed form exactly.
const o = E.outrightProbs(Meven);
const wAnalytic = o.home + o.draw/2, lAnalytic = o.home;
eq('+0.25 w matches closed form', b.w, wAnalytic, 1e-12);
eq('+0.25 l matches closed form', b.l, lAnalytic, 1e-12);
eq('+0.25 fair odds = closed form', 1 + b.l/b.w, 1 + lAnalytic/wAnalytic, 1e-12);
const b2 = E.evaluateBet(Meven, (i,j)=>E.settleAH(i,j,0,'home'));
eq('symmetric 0.0 fair odds near 2', 1 + b2.l/b2.w, 2.0, 0.02);

console.log('\n== 7. Zero-EV bet must have EV 0 at fair odds ==');
const fo = 1 + b.l/b.w;
const v = E.value(b, fo, {kind:'ah', line:0.25, matches:12, repeatability:1, half:'ft'});
eq('EV at fair odds = 0', Math.round(v.ev*1e9)/1e9, 0, 1e-6);
eq('edge at fair odds = 0', Math.round(v.edge*1e9)/1e9, 0, 1e-6);

console.log('\n== 8. Outcome distribution must sum to 1 ==');
eq('dist sums to 1', Object.values(b.dist).reduce((a,x)=>a+x,0), 1, 1e-9);

console.log('\n== 9. Full fixture analysis on all 9 fixtures ==');
D.fixtures.forEach(fx => {
  const r = E.analyseFixture(fx, D.teams, D.leagues);
  const o = r.outright;
  const sum = o.home + o.draw + o.away;
  if (Math.abs(sum - 1) > 1e-6) { fail++; console.log('  FAIL 1X2 sum ' + fx.id); }
  console.log('  ' + fx.id.padEnd(9) + ' lam ' + r.lambdas.home.toFixed(2) + '-' + r.lambdas.away.toFixed(2) +
    ' | 1X2 ' + (o.home*100).toFixed(0) + '/' + (o.draw*100).toFixed(0) + '/' + (o.away*100).toFixed(0) +
    ' | picks ' + r.picks.length +
    ' | best ' + (r.best ? r.best.label + ' EV ' + (r.best.ev*100).toFixed(1) + '%' : 'none'));
});

console.log('\n== 10. Parlay simulator: 9 legs of coin-flips at 1.90 ==');
const flat = Array.from({length:9}, () => ({
  odds: 1.90, lineType: 'half',
  dist: { win: 0.5, halfWin: 0, push: 0, halfLose: 0, lose: 0.5 }
}));
const sim = E.simulateParlay(flat, 40000, 42);
eq('printed odds 1.9^9', Math.round(sim.printedOdds*100)/100, 322.69, 0.5);
eq('P(all win) = 0.5^9', sim.pAllWin, Math.pow(0.5,9), 1e-9);
eq('expected return ~ 0.95^9', sim.expectedReturn, Math.pow(0.95,9), 0.03);

console.log('\n== 11. Quarter lines cut variance AND payout ==');
const q = Array.from({length:9}, () => ({
  odds: 1.90, lineType: 'quarter',
  dist: { win: 0.40, halfWin: 0.12, push: 0, halfLose: 0.12, lose: 0.36 }
}));
const simq = E.simulateParlay(q, 40000, 7);
console.log('  half-line parlay  expected return ' + sim.expectedReturn.toFixed(4) + ', P(profit) ' + (sim.pProfit*100).toFixed(2) + '%');
console.log('  quarter parlay    expected return ' + simq.expectedReturn.toFixed(4) + ', P(profit) ' + (simq.pProfit*100).toFixed(2) + '%');
console.log('  quarter drag vs printed: ' + (simq.drag*100).toFixed(2) + '%');

console.log('\n== 12. Bulk paste import (one response, many teams) ==');
// Sportmonks nests the number two levels down: value.all.count. An earlier
// version unwrapped "count" but not "all", so every team came back empty and
// the paste box reported "no statistics in this JSON" on a perfectly good
// response.
function smTeam(id, name, rows) {
  return { id: id, name: name, statistics: [{ details: rows.map(function (r) {
    return { type: { name: r[0] }, value: { all: { count: r[1] } } };
  }) }] };
}
const bulk = JSON.stringify({ data: [
  smTeam(83, 'Barcelona', [
    ['Matches Played', 8], ['Goals', 18], ['Expected Goals', 17.6],
    ['Expected Goals Against', 6.4], ['Shots Total', 140], ['Shots On Target', 56],
    ['Fouls', 88], ['Tackles', 132], ['Yellowcards', 14], ['Redcards', 1]
  ]),
  smTeam(496, 'Galatasaray SK', [
    ['Matches Played', 8], ['Goals', 12], ['Expected Goals', 10.4],
    ['Expected Goals Against', 11.2], ['Shots Total', 98], ['Shots On Target', 36],
    ['Fouls', 104], ['Tackles', 148], ['Yellowcards', 22], ['Redcards', 2]
  ])
]});
const many = E.parseManyTeams(bulk);
eq('two teams read from one response', many && many.teams ? many.teams.length : 0, 2);
const bar = many.teams.filter(t => t.name === 'Barcelona')[0];
eq('value.all.count unwrapped (matches)', bar.stats.matches, 8);
eq('totals divided into per-match xG', bar.stats.xgF, 2.2, 0.01);
eq('per-match shots', bar.stats.shots, 17.5, 0.01);
eq('nothing missing for a full row', bar.missing.length, 0);

// Name matching has to survive club suffixes on either side.
eq('Galatasaray -> Galatasaray SK',
   (E.matchTeamName('Galatasaray', many.teams) || {}).name, 'Galatasaray SK');
eq('Barcelona -> Barcelona',
   (E.matchTeamName('Barcelona', many.teams) || {}).name, 'Barcelona');
eq('a team absent from the response matches nothing',
   E.matchTeamName('Real Madrid', many.teams), null);

eq('junk is rejected, not guessed at', E.parseManyTeams('not json'), null);
const bare = E.parseManyTeams(JSON.stringify({ data: [{ id: 1, name: 'Some Club' }] }));
eq('a response without statistics reports why', !!(bare && bare.error), true);

console.log('\n== 13. Labels that wrapped onto two lines ==');
// UEFA draws "Matches played" inside a narrow circle, so a copy of the page
// arrives with the label split across lines. Matching it as a literal string
// found nothing, and the import refused a paste that was perfectly complete.
const wrapped = [
  'FC Barcelona', 'Key stats',
  '6', 'Matches', 'played',
  '14', 'Goals',
  '5', 'Goals', 'conceded',
  '22', 'Total attempts',
  '9', 'Attempts on', 'target',
  '8', 'Attempts off', 'target',
  '5', 'Attempts', 'blocked',
  '6', 'Tackles',
  '11', 'Fouls committed',
  '9', 'Yellow cards',
  '1', 'Red cards'
].join('\n');
const wp = E.parseTeamStats(wrapped);
eq('wrapped "Matches played" is found', wp && wp.matches, 6);
eq('wrapped "Goals conceded" does not swallow "Goals"', wp.goals, 14 / 6, 0.01);
eq('wrapped "Attempts on target" per match', wp.sot, 1.5, 0.01);
// This sample carries no "Attempts conceded" rows, so xGA genuinely cannot
// be computed - and that is exactly what should be reported, not a zero.
eq('only xGA reported missing', wp._missing.join(','), 'xgA');
eq('xGA left null rather than invented', wp.xgA, null);

// The same page on one line per stat must still work.
const flatPage = 'FC Barcelona\nKey stats\n6\nMatches played\n14\nGoals\n5\nGoals conceded\n' +
  '22\nTotal attempts\n9\nAttempts on target\n8\nAttempts off target\n5\nAttempts blocked\n' +
  '6\nTackles\n11\nFouls committed\n9\nYellow cards\n1\nRed cards';
eq('unwrapped page still parses', E.parseTeamStats(flatPage).matches, 6);

console.log('\n== 14. UEFA page with no "Matches played" anywhere ==');
// The real copy of a UEFA club stats page never contains the words "Matches
// played": that number lives inside a donut whose text does not come along.
// What does arrive is the win/draw/loss record, and on a competition page
// those three sum to the matches played.
const donut = 'Key stats 1 0 0 Won Drawn Lost 5 Goals 1 Goals conceded ' +
  '22 Total attempts 9 Attempts on target 8 Attempts off target 5 Attempts blocked ' +
  '6 Tackles 11 Fouls committed 1 Yellow cards 0 Red cards';
const dp = E.parseTeamStats(donut);
eq('match count derived from W+D+L', dp && dp.matches, 1);
eq('and it says where that came from', dp._matchesFromRecord, true);
eq('goals still per match', dp.goals, 5, 0.01);

// Several matches, and the other shape where each number sits by its label.
const perLabel = '3 Won 2 Drawn 1 Lost 12 Goals 6 Goals conceded 60 Total attempts ' +
  '24 Attempts on target 18 Attempts off target 12 Attempts blocked 30 Tackles ' +
  '60 Fouls committed 12 Yellow cards 0 Red cards';
const pl = E.parseTeamStats(perLabel);
eq('W+D+L across six matches', pl && pl.matches, 6);
eq('goals averaged over six', pl.goals, 2, 0.01);

// An explicit "Matches played" must still win over the derived figure.
const explicit = '9 Matches played 1 0 0 Won Drawn Lost 18 Goals 9 Goals conceded ' +
  '90 Total attempts 36 Attempts on target 27 Attempts off target 18 Attempts blocked ' +
  '45 Tackles 90 Fouls committed 18 Yellow cards 0 Red cards';
const ex = E.parseTeamStats(explicit);
eq('printed match count beats the derived one', ex.matches, 9);
eq('and is not flagged as derived', !!ex._matchesFromRecord, false);

/* ---------------------------------------------------------------- 15.
   Table pastes: WhoScored, FBref and Understat print a header row and put
   the numbers underneath it, so nothing is ever adjacent to its label.
   These are the real pastes, as the page's own diagnostic printed them
   back after an import that read nothing at all. */
console.log('\n== 15. header-and-rows tables (WhoScored / FBref / Understat) ==');

const whoScored = [
  'Tournament\tApps\tGoals\tShots pg\tDiscipline\tPossession%\tPass%\tAerialsWon\tRating',
  'Premier League\t5\t7\t12\t70\t44.8\t76.9\t21\t6.84',
  'League Cup\t2\t5\t15.5\t30\t50.0\t81.7\t22\t6.69',
  '',
  'Tournament\tApps\tShots pg\tTackles pg\tInterceptions pg\tFouls pg\tOffsides pg\tRating',
  'Premier League\t5\t12\t15.2\t9.4\t10.6\t1.8\t6.84',
  'League Cup\t2\t15.5\t14.1\t8.2\t11.2\t2.0\t6.69'
].join('\n');
const ws = E.parseTeamStats(whoScored);

/* Two tables list the SAME competitions. Adding their Apps together would
   claim 14 matches and halve every average - the bug this pins down. */
eq('matches counted once across two tables', ws && ws.matches, 7);
eq('goals per match = (7+5)/7', ws.goals, 1.71, 0.01);
eq('"Shots pg" weighted by apps, not averaged flat', ws.shots, 13, 0.01);
eq('fouls read from the second table', ws.fouls, 10.77, 0.01);
eq('tackles read from the second table', ws.tackles, 14.89, 0.01);
/* WhoScored glues the two card counts into one cell: "70" is 7 and 0. */
eq('yellow split out of the discipline cell', ws.yellow, 1.43, 0.01);
eq('red split out of the discipline cell', ws.red, 0, 0.001);

const understat = [
  'Tournament       Apps   xG     Goals*  xGDiff  Shots  xG/Shots   Rating',
  'Premier League   5      7.06   6       -1.06   60     0.12       6.84',
  'League Cup       2      5.63   5       -0.63   31     0.18       6.69'
].join('\n');
const us = E.parseTeamStats(understat);
eq('space-aligned table reads too', us && us.matches, 7);
eq('real xG, not estimated', us.xgF, 1.81, 0.01);
eq('xG is not flagged as estimated', !!(us._estimated && us._estimated.xgF), false);
eq('"Goals*" is still goals', us.goals, 1.57, 0.01);
/* Shots here is a season total (60 over 5); on the table above it is a
   per-match figure (12). Both must land on the same number, which is what
   proves the "ends in pg" rule is the right way round. */
eq('season-total shots match the per-game table', us.shots, ws.shots, 0.01);

const fbref = [
  'Squad            MP   Gls   Sh   SoT   xG    xGA   CrdY  CrdR  Fls   Tkl',
  'Arsenal          5    7     60   24    7.06  4.60  7     0     53    76'
].join('\n');
const fb = E.parseTeamStats(fbref);
eq('FBref abbreviations map too', fb && fb.matches, 5);
eq('FBref shots on target', fb.sot, 4.8, 0.01);
eq('FBref xG conceded', fb.xgA, 0.92, 0.01);
eq('FBref separate card columns', fb.yellow, 1.4, 0.01);

/* A UEFA label page must keep going down the old path. */
const stillUefa = E.parseTeamStats('Key stats 1 0 0 Won Drawn Lost 5 Goals 2 Goals conceded');
eq('a label page is not treated as a table', !!(stillUefa && stillUefa._fromTable), false);
eq('and still reads its own match count', stillUefa && stillUefa.matches, 1);

/* Prose must not be mistaken for a table. */
eq('prose is not a table', E.parseStatsTable('hello world\nnothing here at all'), null);
eq('empty input is not a table', E.parseStatsTable(''), null);
/* A table with no Apps column cannot be weighted, so it is refused. */
eq('a table without Apps is refused',
   E.parseStatsTable('Team Goals Shots\nArsenal 7 60'), null);

/* ---------------------------------------------------------------- 16.
   The gate that decides whether the model has an opinion at all.

   Nine figures were imported for two teams - goals, shots, fouls,
   tackles, cards - and every probability on the page stayed exactly where
   it was, because xG created and xG conceded were not among them. That is
   the engine working as designed, and it cost two rounds of "why has
   nothing changed", so it is pinned here. */
console.log('\n== 16. xG is the switch: without both, the market decides ==');

const DATA16 = require('../data/moneyball-fixtures.json');
/* A fixture whose BOTH sides ship without statistics - the case he hit.
   A fixture between two teams that already carry placeholder figures is a
   different question and would not test this gate at all. */
const fx16 = DATA16.fixtures.find((f) =>
  DATA16.teams[f.home] && DATA16.teams[f.away] &&
  DATA16.teams[f.home].statsMissing && DATA16.teams[f.away].statsMissing);

function view16(overrides) {
  const out = {};
  for (const k in DATA16.teams) {
    const base = DATA16.teams[k], ov = overrides[k];
    if (!ov) { out[k] = base; continue; }
    const m = Object.assign({}, base, ov);
    /* Same rule the page uses: xG created opens the gate, xG conceded
       sharpens it. Kept in step with effStats() in moneyball-app.js. */
    if (m.xgF != null) m.statsMissing = false;
    out[k] = m;
  }
  return out;
}
const run16 = (ov) => E.analyseFixture(fx16, view16(ov), DATA16.leagues, { marketWeight: 0.35 });

/* Everything except the two xG columns - exactly what a WhoScored
   Summary + Defensive paste delivers. */
const noXG = {
  [fx16.home]: { matches: 14, goals: 2.5, shots: 13.61, fouls: 11.44, tackles: 16.21, yellow: 1.93, red: 0.07 },
  [fx16.away]: { matches: 7, xgF: 1.82, goals: 1.42, shots: 13.42, fouls: 12, tackles: 15.86, yellow: 2.71, red: 0 }
};
const before = run16({});
const imported = run16(noXG);
eq('nothing entered: pinned to the market', before.marketWeight, 1);
/* The away side here has xG created, the home side has none - so the
   fixture is still market-only, because one rated team against a team on
   placeholders is not a comparison. */
eq('one side without xG keeps the fixture on the market', imported.marketWeight, 1);
eq('and it is still reported as statsMissing', imported.statsMissing, true);

/* The same paste plus the two xG figures. */
const withXG = JSON.parse(JSON.stringify(noXG));
withXG[fx16.home].xgF = 1.55;
withXG[fx16.home].xgA = 1.20;
withXG[fx16.away].xgA = 1.75;
const live = run16(withXG);
/* Not 0.35 to the decimal any more: the board-level fit quality can raise
   the anchor (section 18). What this gate is about is that the model was
   let in at all, rather than pinned to the price the way a fixture with no
   xG is. */
eq('both xG in: the model is let in', live.marketWeight < 0.999, true);
eq('and the fixture stops being statsMissing', live.statsMissing, false);

/* WhoScored publishes no xG conceded outside its xG tab's Against view,
   so xG created alone must be enough to rate a team - with the defence
   standing at league average and the rating counting for less. */
const xgFonly = {
  [fx16.home]: { matches: 7, xgF: 1.55, goals: 1.25, shots: 14.95, fouls: 9, tackles: 13.86, yellow: 1.43, red: 0 },
  [fx16.away]: { matches: 7, xgF: 1.38, goals: 1.58, shots: 13.63, sot: 4, fouls: 11.43, tackles: 16, yellow: 2, red: 0.14 }
};
const onlyF = run16(xgFonly);
/* Not 0.35 exactly any more: the anchor slides up with disagreement (see
   section 18), so what matters here is that the model was let in at all
   rather than pinned to the market the way a fixture with no xG is. */
eq('xG created alone lets the model in', onlyF.marketWeight < 0.9, true);
eq('and it is the configured anchor or a little above', onlyF.marketWeight >= 0.35, true);
eq('and the fixture is no longer statsMissing', onlyF.statsMissing, false);

/* An assumed defence must cost confidence, not be worth as much as a
   measured one. */
const LG16 = DATA16.leagues.filter((l) => l.id === fx16.league)[0];
const measured = E.profile({ matches: 7, xgF: 1.55, xgA: 1.30, goals: 1.25, shots: 14.95,
  fouls: 9, tackles: 13.86, yellow: 1.43, red: 0 }, LG16);
const assumed = E.profile({ matches: 7, xgF: 1.55, xgA: null, goals: 1.25, shots: 14.95,
  fouls: 9, tackles: 13.86, yellow: 1.43, red: 0 }, LG16);
eq('an assumed defence is flagged', assumed.defAssumed, true);
eq('a measured one is not', measured.defAssumed, false);
eq('and the assumed rating counts for less', assumed.ratingWeight < measured.ratingWeight, true);
eq('a missing xGA sits exactly at league average', assumed.def, 1, 0.0001);

/* The Against view of the xG tab gives the real figure. Its other columns
   belong to the opponent and must not touch this team. */
const againstPaste = [
  'Tournament       Apps   xG     Goals*  xGDiff  Shots  xG/Shots   Rating',
  'Premier League   5      9.20   7       -2.20   84     0.11       6.51',
  'League Cup       2      3.10   2       -1.10   28     0.11       6.98'
].join('\n');
const ag = E.parseTeamStats(againstPaste, { against: true });
eq('Against view reads xG conceded', ag && ag.xgA, 1.76, 0.01);
eq('and nothing else from it', ag.xgF === undefined && ag.goals === undefined && ag.shots === undefined, true);
eq('the same paste read normally is xG CREATED', E.parseTeamStats(againstPaste).xgF, 1.76, 0.01);

/* The promise being tested: the numbers on the page actually move. */
const p0 = before.picks && before.picks.length ? before.picks[0] : null;
const p1 = live.picks && live.picks.length ? live.picks[0] : null;
eq('a pick exists before and after', !!(p0 && p1), true);
if (p0 && p1) {
  const moved = live.picks.some((p) => {
    const was = before.picks.find((q) => q.label === p.label);
    return was && Math.abs((p.pModel || 0) - (was.pModel || 0)) > 0.002;
  });
  eq('model probabilities move once xG is in', moved, true);
}

/* One side alone is not enough: a real team against placeholders is not a
   comparison, so the gate stays shut. */
const oneSide = { [fx16.home]: { matches: 10, xgF: 1.55, xgA: 1.2, goals: 2, shots: 14 } };
eq('one side filled is still market-only', run16(oneSide).marketWeight, 1);
eq('Serie A is not called "Drawe A"',
   DATA16.leagues.filter((l) => l.id === 'seriea')[0].name, 'Serie A (Italy)');

/* ---------------------------------------------------------------- 17.
   Competitions played but not yet measured print "N/A" and a dash, and
   they sit between the ones that do have figures. Treating such a row as
   the end of the table loses every row below it.

   Manchester City's xG tab, verbatim. Liverpool's read fine only because
   its empty rows happened to come last; City's stopped at FA Cup and
   reported xG conceded 1.54 over 9 matches instead of 1.29 over 11 -
   wrong by a fifth, and confident about it. */
console.log('\n== 17. rows with no figures yet (N/A) ==');

const cityAgainst = [
  'Tournament      Apps   xG     Goals*  xGDiff  Shots  xG/Shots   Rating',
  'FA Cup          6      N/A    N/A     N/A     N/A    -',
  'Premier League  5      7.82   4       -3.82   59     0.13       6.96',
  'FIFA Club World Cup 4  6.04   6       -0.04   39     0.15       7.14',
  'Community Shield 1     N/A    N/A     N/A     N/A    -',
  'Champions League 1     0.19   0       -0.19   5      0.04       6.93',
  'League Cup      1      0.16   0       -0.16   4      0.04       7.59'
].join('\n');

const ag17 = E.parseTeamStats(cityAgainst, { against: true });
eq('an N/A row first does not end the table', !!ag17, true);
/* 5 + 4 + 1 + 1. The 6 FA Cup and 1 Community Shield matches carry no
   figures, so counting them would divide by a number nothing was
   measured over. */
eq('only measured competitions count toward matches', ag17 && ag17.matches, 11);
eq('xG conceded across all four', ag17 && ag17.xgA, 1.29, 0.01);

const cityFor = [
  'Tournament      Apps   xG     Goals*  xGDiff  Shots  xG/Shots   Rating',
  'FIFA Club World Cup 4  14.36  15      0.64    90     0.16       7.14',
  'FA Cup          6      N/A    N/A     N/A     N/A    -',
  'Premier League  5      10.16  13      2.84    68     0.15       6.96',
  'Champions League 1     2.77   2       -0.77   20     0.14       6.93',
  'League Cup      1      1.95   5       3.05    14     0.14       7.59',
  'Community Shield 1     N/A    N/A     N/A     N/A    -'
].join('\n');
const for17 = E.parseTeamStats(cityFor);
eq('an N/A row in the middle is stepped over', for17 && for17.matches, 11);
eq('and every row below it is still read', for17 && for17.xgF, 2.66, 0.01);

/* Prose is not a row with missing figures, and must still end a table. */
const withProse = [
  'Tournament      Apps   xG     Goals*  xGDiff  Shots  xG/Shots   Rating',
  'Premier League  5      7.82   4       -3.82   59     0.13       6.96',
  'These numbers cover the 2026 season and were last updated 3 days ago.'
].join('\n');
const pr17 = E.parseTeamStats(withProse, { against: true });
eq('prose still ends the table', pr17 && pr17.matches, 5);

console.log('\n== 18. fitting the model to the board, not to the seeds ==');
/* The complaint this section exists for: after every national-team
   statistic had been entered, the board looked exactly as it had before.
   Eleven rows of twenty read "model differs by 62% - too far, nothing
   selected", the parlay builder fell back to ranking by vig, and the picks
   were the same ones it had made with no data at all.
   Two things were wrong, and neither was a view about any match. */

/* Plausible WhoScored country figures: competitions summed, xG created
   only - WhoScored publishes no xG conceded anywhere. */
const NAT = {
  netherlands:[2.30,17.1], germany:[2.10,15.8], norway:[2.40,16.0], denmark:[1.55,13.6],
  portugal:[2.45,17.5], wales:[1.20,11.4], serbia:[1.35,12.8], greece:[1.40,12.2],
  italy:[1.95,15.4], belgium:[2.25,16.2], turkey:[1.80,14.4], france:[2.35,16.8],
  czechia:[1.50,13.0], croatia:[1.75,14.1], england:[2.05,15.2], spain:[2.55,18.0],
  georgia:[1.25,11.8], nireland:[1.10,10.6], hungary:[1.40,12.4], ukraine:[1.45,12.9],
  poland:[1.70,14.0], bosnia:[1.20,11.2], sweden:[1.85,14.6], romania:[1.15,11.5],
  austria:[1.90,15.0], israel:[1.30,12.0], kosovo:[1.15,11.0], ireland:[1.05,10.4],
  slovenia:[1.20,11.6], scotland:[1.35,12.3], nmacedonia:[0.95,9.8], switzerland:[1.95,15.1],
  sanmarino:[0.25,5.2], finland:[1.40,12.6], bulgaria:[0.85,9.4], luxembourg:[1.00,10.2],
  andorra:[0.45,6.8], malta:[0.70,8.6], liechtenstein:[0.30,5.6], lithuania:[0.90,9.6]
};
/* Built from a BLANK board, not from whatever is published today. These
   checks are about the mechanism - a source with a high shot count and no
   xG conceded - so real figures arriving in the data file must not quietly
   change what they measure. */
function blankTeams() {
  const out = JSON.parse(JSON.stringify(D.teams));
  const FIELDS = ['matches','goals','xgF','xgA','xA','shots','sot','bigMiss',
                  'fouls','tackles','yellow','red'];
  Object.keys(out).forEach(function (k) {
    FIELDS.forEach(function (f) { out[k][f] = f === 'matches' ? 0 : null; });
    out[k].statsMissing = true;
    delete out[k].measured;
  });
  return out;
}
const blank = blankTeams();
const natTeams = JSON.parse(JSON.stringify(blank));
Object.keys(NAT).forEach(function (k) {
  if (!natTeams[k]) return;
  natTeams[k] = Object.assign({}, natTeams[k], {
    matches: 8, xgF: NAT[k][0], shots: NAT[k][1], goals: NAT[k][0] * 0.95,
    sot: NAT[k][1] * 0.35, fouls: 11.5, tackles: 16, yellow: 1.8, red: 0.05,
    statsMissing: false, measured: true
  });
});
const natFx = D.fixtures.filter(function (f) { return f.slate === 4; });

/* Nothing entered: nothing to fit, so the fit must be the identity. */
const emptyShape = E.calibrateShape(natFx, blank, D.leagues, {});
eq('no statistics entered: no level correction', emptyShape.scaleFor('unl-a'), 1);
eq('no statistics entered: no supremacy stretch', emptyShape.slopeFitted, false);

const shape = E.calibrateShape(natFx, natTeams, D.leagues, {});
eq('a filled board fits a level', shape.reliable, true);

/* 1. The goal LEVEL. WhoScored counts shots generously, so every team was
      lifted at once and the board filled with "Over" picks. */
function totals(teams, sh) {
  let model = 0, market = 0, n = 0, over = 0, picks = 0, homeSide = 0, awaySide = 0;
  natFx.forEach(function (f) {
    const a = E.analyseFixture(f, teams, D.leagues, { marketWeight: 0.35, shape: sh, tilt: 0 });
    const L = a.lambdas;
    if (L.impliedHome == null) return;
    model += L.rawHome + L.rawAway; market += L.impliedHome + L.impliedAway; n++;
    if (!a.best) return;
    picks++;
    if (/^over/i.test(a.best.label)) over++;
    /* Which side of the price the pick sits on: the favourite is the team
       the market makes stronger. */
    const favHome = L.impliedHome > L.impliedAway;
    const onHome = a.best.label.indexOf(a.home.name) === 0;
    const onAway = a.best.label.indexOf(a.away.name) === 0;
    if (onHome) (favHome ? homeSide++ : awaySide++);
    else if (onAway) (favHome ? awaySide++ : homeSide++);
  });
  return { model: model / n, market: market / n, over: over, picks: picks,
           onFavourite: homeSide, onUnderdog: awaySide };
}
const unfitted = totals(natTeams, null);
const fitted = totals(natTeams, shape);
/* The level fit must move the model TOWARD the board's own goal level, and
   land close to it. A source that counts shots generously lifts every team
   at once; so did a missing discipline column, until that was read as
   unknown rather than as zero. */
eq('the level is fitted toward the board',
   Math.abs(fitted.model - fitted.market) <= Math.abs(unfitted.model - unfitted.market) + 1e-9, true);
eq('fitted, the goal level matches the board',
   Math.abs(fitted.model - fitted.market) < 0.20, true);
eq('and "Over" is not most of the board',
   fitted.over <= Math.max(1, Math.ceil(fitted.picks / 2)), true);

/* The bug that made every board read "Over": an unfilled tackle count
   scored seven standard deviations below the league and an unfilled foul
   count six above, pinning every team at the intensity cap and lifting
   both sides of every fixture by 11%. */
const noDisc = { matches: 6, xgF: 1.4, xgA: 1.4, goals: 1.35, shots: 12.8,
                 statsMissing: false };
const withDisc = Object.assign({}, noDisc, { fouls: 12.5, tackles: 17.2, yellow: 1.8, red: 0 });
const lgX = { id: 'x', name: 'x', avgGoalsPerMatch: 2.8, hfaAttack: 1.09,
              rhoFT: -0.055, rhoHT: -0.08, firstHalfShare: 0.43 };
const fxX = { id: 'x', league: 'x', home: 'H', away: 'A', markets: {} };
const aBare = E.analyseFixture(fxX, { H: noDisc, A: noDisc }, [lgX], { marketWeight: 0 });
const aSpelled = E.analyseFixture(fxX, { H: withDisc, A: withDisc }, [lgX], { marketWeight: 0 });
eq('an unfilled discipline column reads as league average, not as zero',
   Math.abs((aBare.lambdas.home + aBare.lambdas.away) -
            (aSpelled.lambdas.home + aSpelled.lambdas.away)) < 0.02, true);

/* 2. The SUPREMACY scale, which was the dangerous one. With no xG conceded
      anywhere, only half of each team's strength can be expressed, so the
      model's spread of opinion came out four times too narrow - and a model
      that knows who is better but says it too quietly backs the underdog in
      every mismatch. */
eq('the supremacy line is fitted on a full board', shape.slopeFitted, true);
eq('and it stretches rather than squashes', shape.beta > 1, true);
eq('because the model orders the teams well to begin with', shape.r > 0.8, true);

function supremacySpread(sh) {
  const xs = [];
  natFx.forEach(function (f) {
    const a = E.analyseFixture(f, natTeams, D.leagues, { marketWeight: 0.35, shape: sh, tilt: 0 });
    if (a.lambdas.impliedHome == null) return;
    xs.push([a.lambdas.rawHome - a.lambdas.rawAway,
             a.lambdas.impliedHome - a.lambdas.impliedAway]);
  });
  const sd = function (i) {
    const m = xs.reduce(function (t, r) { return t + r[i]; }, 0) / xs.length;
    return Math.sqrt(xs.reduce(function (t, r) { return t + (r[i] - m) * (r[i] - m); }, 0) / xs.length);
  };
  return { model: sd(0), market: sd(1) };
}
const before18 = supremacySpread(null), after18 = supremacySpread(shape);
eq('unfitted, the model is far quieter than the market', before18.model < before18.market / 2, true);
eq('fitted, it speaks at the market’s volume',
   Math.abs(after18.model - after18.market) < after18.market * 0.35, true);

/* The point of all of it: a selective board rather than a one-way machine.
   Before the fit the page promoted a pick on seven rows and every one was
   an underdog; unfitted at the old prior it promoted twenty of twenty. */
eq('the fitted board finds picks', fitted.picks >= 3, true);
eq('but does not recommend most of the board', fitted.picks <= natFx.length / 2, true);

/* 3. How much say the model gets is set by how well its line tracks the
      prices, which is the only evidence available about its accuracy. */
eq('the fit reports its own typical error', shape.rmse > 0, true);
const boardAnchor = E.analyseFixture(
  natFx.filter(function (f) { return f.id === 'cze-cro'; })[0],
  natTeams, D.leagues, { marketWeight: 0.35, shape: shape, tilt: 0 }).marketWeight;
eq('a loose fit costs the model some of its say', boardAnchor > 0.35, true);
eq('but never all of it while the fit still tracks', boardAnchor < 1, true);

/* A tighter fit must hand the model MORE say - otherwise entering more
   data buys nothing. */
const tightShape = Object.assign({}, shape, { rmse: 0.12,
  scaleFor: shape.scaleFor.bind(shape) });
const tightAnchor = E.analyseFixture(
  natFx.filter(function (f) { return f.id === 'cze-cro'; })[0],
  natTeams, D.leagues, { marketWeight: 0.35, shape: tightShape, tilt: 0 }).marketWeight;
eq('a tighter fit gives the model more say', tightAnchor < boardAnchor, true);

/* 3b. The invariant underneath all of it. Pinned entirely to the market -
       the model contributing nothing whatever - every leg must claim
       exactly the market's own de-vigged probability. It did not: a Poisson
       matrix fitted to a favourite-heavy Asian board always left the
       plus-handicap side two to three points richer than the price, and
       THAT residual was the edge the page kept finding. Over forty runs
       with the inputs jittered, 61 of 62 picks were the underdog, none of
       them from the statistics. */
let residual = 0, residualLeg = '';
[3, 4, 6].forEach(function (sl) {
  D.fixtures.filter(function (f) { return f.slate === sl; }).forEach(function (f) {
    const a = E.analyseFixture(f, blank, D.leagues, { marketWeight: 1, tilt: 0 });
    (a.picks || []).forEach(function (p) {
      if (p.pFairMarket == null) return;
      const d = Math.abs(p.pModel - p.pFairMarket);
      if (d > residual) { residual = d; residualLeg = f.id + ' ' + p.label; }
    });
  });
});
eq('pinned to the market, the model claims the market\u2019s own probability',
   residual < 0.0005, true);
if (residual >= 0.0005) console.log('       worst: ' + residualLeg + ' off by ' + (residual * 100).toFixed(2) + '%');

/* And the correction must not quietly move the push mass: a push pays 1.0x
   and is what separates a quarter line from a half line. */
const pushBefore = E.analyseFixture(
  D.fixtures.filter(function (f) { return f.slate === 4; })[0],
  blank, D.leagues, { marketWeight: 1, tilt: 0 });
const anyQuarter = (pushBefore.picks || []).filter(function (p) {
  return p.lineType === 'quarter' && p.pushRisk != null;
});
eq('quarter lines still carry their push risk',
   anyQuarter.length === 0 || anyQuarter.every(function (p) { return p.pushRisk >= 0; }), true);

/* 4. Figures that rank the teams differently from the prices are wrong
      figures, not an edge. A board of randomly assigned ratings offered
      forty picks out of forty-two at twelve to fourteen per cent EV. */
const scrambled = JSON.parse(JSON.stringify(natTeams));
const natKeys = Object.keys(NAT).filter(function (k) { return scrambled[k]; });
natKeys.forEach(function (k, i) {
  const other = NAT[natKeys[(natKeys.length - 1 - i)]];
  scrambled[k].xgF = other[0]; scrambled[k].shots = other[1];
  scrambled[k].goals = other[0] * 0.95; scrambled[k].sot = other[1] * 0.35;
});
const badShape = E.calibrateShape(natFx, scrambled, D.leagues, {});
eq('a board the model orders differently is recognised', badShape.orderDisagrees, true);
eq('and no line is fitted to it', badShape.slopeFitted, false);
let claimed = 0, deferred = 0;
natFx.forEach(function (f) {
  const a = E.analyseFixture(f, scrambled, D.leagues,
    { marketWeight: 0.35, shape: badShape, tilt: 0 });
  if (a.marketWeight === 1) deferred++;
  if (a.best && a.best.ev > 0.015) claimed++;
});
eq('every fixture on it defers to the price', deferred, natFx.length);
eq('and no edge is claimed anywhere', claimed, 0);

/* 3. The anchor slides instead of blacking the row out. A model far from
      the price keeps less of its own influence; it is not simply muted. */
function mwFor(id, sh) {
  const f = natFx.filter(function (x) { return x.id === id; })[0];
  return E.analyseFixture(f, natTeams, D.leagues, { marketWeight: 0.35, shape: sh, tilt: 0 });
}
const calm = mwFor('cze-cro', null);
/* The worst-disagreeing row on the unfitted board, whichever it is. */
let wild = null;
natFx.forEach(function (f) {
  const a = mwFor(f.id, null);
  if (a.divergence != null && (!wild || a.divergence > wild.divergence)) wild = a;
});
eq('agreement leaves the configured anchor near enough alone', calm.marketWeight, 0.35, 0.05);
eq('disagreement raises it', wild.marketWeight > calm.marketWeight, true);
eq('and it never exceeds the market itself', wild.marketWeight <= 1, true);
eq('the raw disagreement is still reported to the reader', wild.divergence > 0.25, true);
eq('while what was priced is much closer in', wild.divergenceEff < wild.divergence / 2, true);

/* 4. A national team's figures are weaker evidence than a club's, because
      a qualifying group is not a round robin. Same numbers, same league
      average, different prior. */
const clubLike = { matches: 8, xgF: 2.55, shots: 18.0, goals: 2.4, sot: 6.3,
                  fouls: 12.5, tackles: 17.2, yellow: 1.8, red: 0.05, statsMissing: false };
const natLike = Object.assign({ national: true }, clubLike);
const lg18 = D.leagues.filter(function (l) { return l.id === 'unl-a'; })[0];
const evenTeam = { matches: 8, xgF: 1.40, shots: 12.8, goals: 1.33, sot: 4.5,
                  fouls: 12.5, tackles: 17.2, yellow: 1.8, red: 0.05, statsMissing: false };
const asClub = E.analyseFixture(
  { id: 't', league: 'unl-a', home: 'H', away: 'A', markets: {} },
  { H: clubLike, A: evenTeam }, D.leagues, { marketWeight: 0 });
const asNation = E.analyseFixture(
  { id: 't', league: 'unl-a', home: 'H', away: 'A', markets: {} },
  { H: natLike, A: Object.assign({ national: true }, evenTeam) }, D.leagues, { marketWeight: 0 });
/* Two equal sides, to measure home advantage on its own: what is left
   after subtracting it is the part the figures actually bought. */
const asLevel = E.analyseFixture(
  { id: 't', league: 'unl-a', home: 'H', away: 'A', markets: {} },
  { H: evenTeam, A: evenTeam }, D.leagues, { marketWeight: 0 });
const base18 = asLevel.lambdas.home - asLevel.lambdas.away;
const gapClub = (asClub.lambdas.home - asClub.lambdas.away) - base18;
const gapNation = (asNation.lambdas.home - asNation.lambdas.away) - base18;
eq('a club with those figures is rated a clear favourite', gapClub > 0.5, true);
eq('the same figures from a qualifying group say much less',
   gapNation < gapClub * 0.65, true);
eq('but they still say it in the same direction', gapNation > 0, true);
void lg18;

console.log('\n' + (fail === 0 ? 'ALL TESTS PASSED' : fail + ' TEST(S) FAILED'));
process.exit(fail === 0 ? 0 : 1);
