const L=require('./layout.js'), panels=require('./panels.json');
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log(`  ${c?'PASS':'FAIL'}  ${m}`);};
const J=panels.find(p=>p.id==='jinko-51QL6-DV'), A=panels.find(p=>p.id==='aiko-MCE54Mw');

console.log('\n=== 200mm edge rule vs the certification 2s rule ===');
{
  ok(L.EDGE_SETBACK_MIN===200, 'no panel edge within 200mm of the gutter or roof edge');
  ok(L.edgeSetback({panelGapS:50}).mm===200, 's=50mm: the 200mm rule governs');
  ok(L.edgeSetback({panelGapS:100}).mm===200, 's=100mm: 2s=200, still 200');
  const big=L.edgeSetback({panelGapS:150});
  ok(big.mm===300 && big.governedBy.includes('2s'), 's=150mm: 2s=300 takes over');
  ok(L.edgeSetback({panelGapS:300}).mm===600, 's=300mm (max): 600mm setback');
}

console.log('\n=== A rail must clear the setback PLUS the panel overhang ===');
{
  const sb=200;
  const bj=L.railBand(J,{planeLength:5000,setback:sb});
  const ba=L.railBand(A,{planeLength:5000,setback:sb});
  console.log(`   Jinko lowest rail ${bj.minY}mm (200 + ${bj.overhang} overhang)`);
  console.log(`   Aiko  lowest rail ${ba.minY}mm (200 + ${ba.overhang} overhang)`);
  ok(bj.minY===582, 'Jinko: 200 + 382 = 582mm');
  ok(ba.minY===510, 'Aiko: 200 + 310 = 510mm');
  ok(bj.maxY===5000-582, 'band is symmetric about the face');
  ok(bj.minY>sb, 'the rail band is stricter than the raw setback — that is the point');
}

console.log('\n=== Which is why the bottom course is unusable ===');
{
  const band=L.railBand(J,{planeLength:5000,setback:200});
  const g=L.tileGrid({planeLength:5000,planeWidth:8000,gauge:330,coverWidth:300,band});
  const c1=g.hookLines.find(l=>l.course===1);
  const c2=g.hookLines.find(l=>l.course===2);
  console.log(`   course 1 at ${c1.y}mm -> ${c1.usable?'usable':'excluded'}`);
  console.log(`   course 2 at ${c2.y}mm -> ${c2.usable?'usable':'excluded'}`);
  ok(c1.usable===false, 'bottom course excluded automatically');
  ok(c1.reason.includes('too low'), 'and the reason is the setback + overhang, not an arbitrary rule');
  ok(c2.usable===true, 'the second course is fine');
  ok(g.hookLines.at(-1).reason.includes('ridge cap'), 'top course still blocked by the ridge cap');
  ok(g.usableLines.every(l=>l.y>=band.minY && l.y<=band.maxY), 'every usable line sits inside the band');
}

console.log('\n=== A shallow roof can leave nothing usable ===');
{
  const band=L.railBand(J,{planeLength:1400,setback:200});
  const g=L.tileGrid({planeLength:1400,planeWidth:6000,gauge:330,coverWidth:300,band});
  const fit=L.canFitRailPair(J,band);
  console.log(`   1400mm face: band ${band.minY}-${band.maxY} (${fit.bandWidth}mm deep), ${g.usableLines.length} usable course(s)`);
  console.log(`   -> ${fit.reason}`);
  ok(g.usableLines.length>0, 'a course can be usable...');
  ok(fit.ok===false, '...yet the face still cannot take a panel');
  ok(fit.shortBy>0 && fit.reason.includes('short'), 'and it says by how much');
  // A face that IS deep enough passes.
  const big=L.railBand(J,{planeLength:5000,setback:200});
  ok(L.canFitRailPair(J,big).ok===true, 'a 5000mm face fits a rail pair');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
