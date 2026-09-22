const E=require(require('path').join(__dirname,'../js/moneyball-engine.js'));
const D=require(require('path').join(__dirname,'../data/moneyball-fixtures.json'));
let warn=0, fail=0;

console.log('== A. Every price must be a valid decimal > 1 ==');
D.fixtures.forEach(fx=>{
  ['ft','1h'].forEach(h=>{
    const mk=fx.markets[h]; if(!mk) return;
    (mk.ah||[]).forEach(r=>{[r.h,r.a].forEach(v=>{ if(v!=null&&!(v>1)){fail++;console.log('  FAIL '+fx.id+' '+h+' ah '+v);} });});
    (mk.ou||[]).forEach(r=>{[r.o,r.u].forEach(v=>{ if(v!=null&&!(v>1)){fail++;console.log('  FAIL '+fx.id+' '+h+' ou '+v);} });});
    if(mk.x12) Object.values(mk.x12).forEach(v=>{ if(v!=null&&!(v>1)){fail++;console.log('  FAIL '+fx.id+' '+h+' x12 '+v);} });
  });
});
console.log('  checked '+D.fixtures.length+' fixtures');

console.log('\n== B. Handicap ladders must be monotonic in home price ==');
// as the home line DECREASES (home gives more), the home price must RISE
D.fixtures.forEach(fx=>{
  ['ft','1h'].forEach(h=>{
    const rows=((fx.markets[h]||{}).ah||[]).filter(r=>r.h!=null).slice().sort((a,b)=>b.line-a.line);
    for(let i=0;i+1<rows.length;i++){
      if(rows[i+1].h < rows[i].h - 1e-9){
        warn++;
        console.log('  WARN '+fx.id+' '+h+': line '+rows[i].line+' @'+rows[i].h+
                    ' then line '+rows[i+1].line+' @'+rows[i+1].h+' (price fell as handicap grew)');
      }
    }
  });
});

console.log('\n== C. Over/Under ladders must be monotonic ==');
D.fixtures.forEach(fx=>{
  ['ft','1h'].forEach(h=>{
    const rows=((fx.markets[h]||{}).ou||[]).filter(r=>r.o!=null).slice().sort((a,b)=>a.line-b.line);
    for(let i=0;i+1<rows.length;i++){
      if(rows[i+1].o < rows[i].o - 1e-9){
        warn++;
        console.log('  WARN '+fx.id+' '+h+': O'+rows[i].line+' @'+rows[i].o+' then O'+rows[i+1].line+' @'+rows[i+1].o);
      }
    }
  });
});

console.log('\n== D. Overround must be plausible (2-15%) ==');
let bad=0;
D.fixtures.forEach(fx=>{
  ['ft','1h'].forEach(h=>{
    const mk=fx.markets[h]; if(!mk) return;
    (mk.ah||[]).forEach(r=>{ if(r.h&&r.a){const v=E.devig([r.h,r.a]).overround;
      if(v<0.005||v>0.15){bad++;console.log('  ODD '+fx.id+' '+h+' AH '+r.line+' overround '+(v*100).toFixed(1)+'%');}}});
    (mk.ou||[]).forEach(r=>{ if(r.o&&r.u){const v=E.devig([r.o,r.u]).overround;
      if(v<0.005||v>0.15){bad++;console.log('  ODD '+fx.id+' '+h+' OU '+r.line+' overround '+(v*100).toFixed(1)+'%');}}});
    if(mk.x12&&mk.x12['1']&&mk.x12.X&&mk.x12['2']){const v=E.devig([mk.x12['1'],mk.x12.X,mk.x12['2']]).overround;
      if(v<0.01||v>0.20){bad++;console.log('  ODD '+fx.id+' '+h+' 1X2 overround '+(v*100).toFixed(1)+'%');}}
  });
});
console.log('  implausible overrounds: '+bad);

console.log('\n== E. Nations League: market anchors must fit ==');
const unl=D.fixtures.filter(f=>f.slate===4);
unl.forEach(fx=>{
  const L=D.leagues.find(l=>l.id===fx.league);
  const imp=E.impliedLambdas(fx,L);
  const r=E.analyseFixture(fx,D.teams,D.leagues);
  if(!imp){fail++;console.log('  FAIL no fit '+fx.id);return;}
  if(imp.rmse>0.05){warn++;console.log('  WARN poor fit '+fx.id+' rmse '+imp.rmse.toFixed(4));}
  console.log('  '+fx.id.padEnd(9)+' lam '+r.lambdas.home.toFixed(2)+'-'+r.lambdas.away.toFixed(2)+
    '  rmse '+imp.rmse.toFixed(4)+'  statsMissing '+r.statsMissing+'  maxEV '+
    (Math.max(...r.picks.map(p=>p.ev))*100).toFixed(1)+'%');
});

console.log('\n== F. THE 9-LEG NATIONS LEAGUE PARLAY ==');
const an=unl.map(fx=>E.analyseFixture(fx,D.teams,D.leagues));
const chosen=E.pickParlayLegs(an,{legs:9,allowQuarter:false,minProb:0.50,maxProb:0.90});
console.log('  legs selected: '+chosen.length);
chosen.forEach((c,i)=>{
  const p=c.pick, a=c.analysis;
  console.log('   '+(i+1)+'. '+(a.home.name+' vs '+a.away.name).padEnd(34)+
    p.label.padEnd(30)+' @'+p.odds.toFixed(2)+
    '  p='+(c.prob*100).toFixed(1)+'%  vig='+(p.vig!=null?(p.vig*100).toFixed(2)+'%':'--')+
    '  '+p.lineType);
});
const sim=E.simulateParlay(E.toSimLegs(chosen),60000,99);
console.log('\n  printed odds        : '+sim.printedOdds.toFixed(3));
console.log('  P(all 9 land)       : '+(sim.pAllWin*100).toFixed(3)+'%');
console.log('  expected return     : '+sim.expectedReturn.toFixed(4)+'x  (EV '+(sim.ev*100).toFixed(1)+'%)');
console.log('  P(any profit)       : '+(sim.pProfit*100).toFixed(2)+'%');
console.log('  median return       : '+sim.median.toFixed(3)+'x');
console.log('  quarter-line legs   : '+sim.quarterLegs);

console.log('\n  For comparison, same picks at shorter ticket lengths:');
[2,3,4,5,9].forEach(n=>{
  const sub=E.toSimLegs(chosen.slice(0,n));
  const s2=E.simulateParlay(sub,60000,7);
  console.log('   '+String(n).padStart(2)+' legs: printed '+s2.printedOdds.toFixed(2).padStart(8)+
    '  EV '+(s2.ev*100).toFixed(1).padStart(6)+'%   P(profit) '+(s2.pProfit*100).toFixed(2).padStart(6)+'%');
});

console.log('\nwarnings: '+warn+'   failures: '+fail);
process.exit(fail?1:0);
