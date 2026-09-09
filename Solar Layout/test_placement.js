const P=require('./placement.js'), L=require('./layout.js'), E=require('./engine.js');
const panels=require('./panels.json');
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log(`  ${c?'PASS':'FAIL'}  ${m}`);};
const J=panels.find(p=>p.id==='jinko-51QL6-DV'), A=panels.find(p=>p.id==='aiko-MCE54Mw');
const linesFor=(gauge,planeLength=5000)=>{
  const band=L.railBand(J,{planeLength,setback:200});
  return L.tileGrid({planeLength,planeWidth:8000,gauge,coverWidth:300,band}).usableLines;
};

console.log('\n=== Landscape is NOT bound by the portrait rail band ===');
{
  const r=P.lowestFirstRow(J,{lines:linesFor(330),planeLength:5000,setback:200});
  console.log(`   portrait  first panel edge ${r.portrait.panelBottom}mm (rail at ${r.portrait.lowestRail}mm)`);
  console.log(`   landscape first panel edge ${r.landscape.panelBottom}mm`);
  ok(r.landscape.panelBottom===200, 'landscape starts exactly at the 200mm setback');
  ok(r.portrait.panelBottom>=200, 'portrait never breaches the setback');
  ok(r.landscape.lowestRail===null, 'landscape has no "lowest rail" — its rails run up-slope');
}

console.log('\n=== How much lower landscape reaches depends entirely on the gauge ===');
{
  const results={};
  for(const g of [300,320,330,360,400]){
    const r=P.lowestFirstRow(J,{lines:linesFor(g),planeLength:5000,setback:200});
    results[g]=r;
    console.log(`   gauge ${g}: portrait ${r.portrait?r.portrait.panelBottom+'mm':'IMPOSSIBLE'}, landscape ${r.landscape.panelBottom}mm`);
  }
  ok(results[320].landscapeGain>250, '320mm gauge: landscape reaches ~287mm lower');
  ok(results[330].landscapeGain<10, '330mm gauge: barely any difference');
  ok(results[300].portrait===null && results[400].portrait===null,
     '300mm and 400mm gauges: portrait is impossible, landscape still works');
  ok(Object.values(results).every(r=>r.landscape.panelBottom===200),
     'landscape is 200mm at every gauge — it is not quantised up-slope');
}

console.log('\n=== Portrait rows are real: rails on courses, clamp in range, edges legal ===');
{
  const rows=P.portraitRows(J,{lines:linesFor(330),planeLength:5000,setback:200});
  ok(rows.length>0, 'feasible portrait rows found');
  const lines=linesFor(330).map(l=>l.y);
  ok(rows.every(r=>lines.includes(r.railY[0])&&lines.includes(r.railY[1])), 'both rails on usable courses');
  ok(rows.every(r=>r.clampFromEnd>=J.clamp.minFromEnd&&r.clampFromEnd<=J.clamp.maxFromEnd),
     'clamp distance inside the manufacturer range');
  ok(rows.every(r=>r.panelBottom>=200&&r.panelTop<=4800), 'panel edges inside both setbacks');
  const sep=E.railSeparationWindow(J);
  ok(rows.every(r=>r.separation>=sep.min&&r.separation<=sep.max), 'rail separation inside the clamp window');
}

console.log('\n=== The width datum is the capping edge, not the first full tile ===');
{
  const b=P.acrossSlopeBand({cappingToCapping:8000,setback:200});
  ok(b.usable===7600 && b.datum==='capping edge', '200mm in from each capping edge');
  // On a tight face, counting whole tiles costs a panel.
  const measured=P.panelsAcross(J,'portrait',{cappingToCapping:6150,setback:200}).panels;
  const counted =P.panelsAcross(J,'portrait',{cappingToCapping:Math.floor(6150/300)*300,setback:200}).panels;
  console.log(`   6150mm face: measured ${measured} panels, counted-by-tiles ${counted} panels`);
  ok(measured>counted, 'measuring to the capping wins a panel that counting tiles would lose');
}

console.log('\n=== Klip-Lok is parked, tin and tile are live ===');
{
  ok(E.ACTIVE_ROOFS.join()==='tin,tile', 'app offers tin and tile only');
  ok(E.CERTS.kliplok.parked===true, 'kliplok flagged parked with a reason');
  const t=require('./spacing_tables.json');
  ok(t.filter(x=>x.roof==='kliplok').length===10, 'its 10 tables stay loaded for later');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
