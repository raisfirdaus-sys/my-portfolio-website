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

console.log('\n' + (fail === 0 ? 'ALL TESTS PASSED' : fail + ' TEST(S) FAILED'));
process.exit(fail === 0 ? 0 : 1);
