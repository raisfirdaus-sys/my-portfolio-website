const E = require(require('path').join(__dirname,'../js/moneyball-engine.js'));
const D = require(require('path').join(__dirname,'../data/moneyball-fixtures.json'));
let fail = 0;
function check(c, msg) { if (!c) { fail++; console.log('  FAIL ' + msg); } }

console.log('== Market-implied lambdas must reprice the market back ==');
D.fixtures.filter(f => f.slate === 1).forEach(fx => {
  const L = D.leagues.find(l => l.id === fx.league);
  const imp = E.impliedLambdas(fx, L);
  if (!imp) { console.log('  ' + fx.id + ' : no fittable market'); return; }
  const M = E.scoreMatrix(imp.home, imp.away, L.rhoFT);
  const o = E.outrightProbs(M);
  let line = '  ' + fx.id.padEnd(9) + ' implied ' + imp.home.toFixed(2) + '-' + imp.away.toFixed(2) +
             ' rmse ' + imp.rmse.toFixed(4) + ' (' + imp.targets + ' targets)';
  // the fit must be tight: rmse over de-vigged probs should be well under 0.05
  check(imp.rmse < 0.05, fx.id + ' rmse too high: ' + imp.rmse);
  if (fx.markets.ft.x12) {
    const dv = E.devig([fx.markets.ft.x12['1'], fx.markets.ft.x12.X, fx.markets.ft.x12['2']]);
    line += ' | 1X2 model ' + (o.home*100).toFixed(0)+'/'+(o.draw*100).toFixed(0)+'/'+(o.away*100).toFixed(0) +
            ' vs mkt ' + (dv.probs[0]*100).toFixed(0)+'/'+(dv.probs[1]*100).toFixed(0)+'/'+(dv.probs[2]*100).toFixed(0);
    check(Math.abs(o.home - dv.probs[0]) < 0.05, fx.id + ' home prob off market');
  }
  console.log(line);
});

console.log('\n== marketWeight = 1 must leave no POSITIVE edge ==');
// Large NEGATIVE EV at full anchor is correct: the book loads its margin onto
// longshots, so a 7.49 first-half outsider really is a terrible price. What
// must not survive is a positive edge - that would mean the model disagrees
// with prices it was just fitted to.
let worstPos = 0, worstNeg = 0;
D.fixtures.filter(f => f.slate === 1).forEach(fx => {
  const r = E.analyseFixture(fx, D.teams, D.leagues, { marketWeight: 1 });
  r.picks.forEach(p => {
    if (p.ev > worstPos) worstPos = p.ev;
    if (p.ev < worstNeg) worstNeg = p.ev;
  });
});
console.log('  most positive EV at full anchor: ' + (worstPos*100).toFixed(2) + '% (must stay small)');
console.log('  most negative EV at full anchor: ' + (worstNeg*100).toFixed(2) + '% (expected - longshot margin)');
check(worstPos < 0.05, 'a positive edge survived a full market anchor: ' + worstPos);

console.log('\n== Divergence guard must demote implausible edges ==');
const fx = D.fixtures.find(f => f.id === 'mar-psg');
const pure = E.analyseFixture(fx, D.teams, D.leagues, { marketWeight: 0 });
const anch = E.analyseFixture(fx, D.teams, D.leagues, { marketWeight: 0.35 });
console.log('  pure model  : divergence ' + (pure.divergence*100).toFixed(1) + '%, best EV ' +
  (pure.picks[0].ev*100).toFixed(1) + '%, tier ' + pure.picks[0].tier + ', suspects ' + pure.suspects);
console.log('  anchored    : divergence ' + (anch.divergence*100).toFixed(1) + '%, best EV ' +
  (anch.picks[0].ev*100).toFixed(1) + '%, tier ' + anch.picks[0].tier + ', suspects ' + anch.suspects);
check(pure.picks[0].tier !== 'prime' || pure.picks[0].ev <= 0.15, 'runaway EV was promoted to prime');

console.log('\n== Anchored slate 1 ==');
D.fixtures.filter(f=>f.slate===1).forEach(f => {
  const r = E.analyseFixture(f, D.teams, D.leagues, { marketWeight: 0.35 });
  const b = r.best;
  console.log('  ' + f.id.padEnd(9) + ' lam ' + r.lambdas.home.toFixed(2) + '-' + r.lambdas.away.toFixed(2) +
    ' (raw ' + r.lambdas.rawHome.toFixed(2) + '-' + r.lambdas.rawAway.toFixed(2) +
    ', mkt ' + (r.lambdas.impliedHome!=null?r.lambdas.impliedHome.toFixed(2):'--') + '-' +
    (r.lambdas.impliedAway!=null?r.lambdas.impliedAway.toFixed(2):'--') + ')' +
    ' div ' + (r.divergence!=null?(r.divergence*100).toFixed(0)+'%':'--') +
    ' | best ' + (b ? b.label + ' @' + b.odds + ' EV ' + (b.ev*100).toFixed(1) + '% conf ' + b.confidence.toFixed(0) + ' [' + b.tier + ']' : 'none'));
});
console.log('\n' + (fail === 0 ? 'ANCHOR TESTS PASSED' : fail + ' FAILED'));
process.exit(fail?1:0);
