const L = require('./layout.js');
const E = require('./engine.js');
const panels = require('./panels.json');
let pass=0, fail=0;
const ok=(c,m)=>{c?pass++:fail++;console.log(`  ${c?'PASS':'FAIL'}  ${m}`);};
const J = panels.find(p=>p.id==='jinko-51QL6-DV');
const A = panels.find(p=>p.id==='aiko-MCE54Mw');

console.log('\n=== Orientation geometry ===');
{
  const p=L.orientation(J,'portrait'), l=L.orientation(J,'landscape');
  console.log(`   portrait : ${p.upSlope} up-slope x ${p.acrossSlope} across, rails run ${p.railRun}`);
  console.log(`   landscape: ${l.upSlope} up-slope x ${l.acrossSlope} across, rails run ${l.railRun}`);
  ok(p.upSlope===1906 && p.acrossSlope===1134, 'portrait is 1906 up-slope');
  ok(l.upSlope===1134 && l.acrossSlope===1906, 'landscape is 1134 up-slope');
  ok(p.railRun==='across-slope' && l.railRun==='up-slope',
     'rail direction flips with orientation (clamps are always on the long side)');
  ok(p.separation.min===l.separation.min,
     'rail separation window is the same number either way — it just points elsewhere');
}

console.log('\n=== Tile grid: top course is never available ===');
{
  const g=L.tileGrid({planeLength:5000, planeWidth:8000, gauge:330, coverWidth:300});
  console.log(`   ${g.courses} courses x ${g.tilesPerCourse} tiles = ${g.tilesOnFace} tiles on the face`);
  console.log(`   highest usable hook line: ${g.highestUsableY} mm (course ${g.usableLines.at(-1).course})`);
  ok(g.courses===15 && g.tilesPerCourse===26, '15 courses of 26 tiles');
  ok(g.tilesOnFace===390, '390 tiles on the face');
  ok(g.usableLines.length===14, 'one course excluded');
  ok(g.hookLines.at(-1).usable===false, 'top course is blocked');
  ok(g.hookLines.at(-1).reason.includes('ridge cap'), 'reason names the ridge cap');
  ok(g.usableLines.every(l=>l.course<g.courses), 'no usable line is the top course');
}
{
  const g=L.tileGrid({planeLength:5000, planeWidth:8000, gauge:330, coverWidth:300, excludeTopCourses:2});
  ok(g.usableLines.length===13, 'excluding two top courses is configurable');
}

console.log('\n=== Rows are always 20mm apart ===');
{
  const r=L.packRows(J,{usableLength:4000,usableWidth:6000,allowed:['portrait']});
  console.log(`   ${r.rows.length} rows, ${r.panels} panels, depth used ${r.depthUsed} of 4000mm`);
  ok(r.rows.length===2, 'two portrait rows fit in 4000mm');
  ok(r.depthUsed===1906*2+20, `depth = 2 panels + one 20mm gap (${1906*2+20})`);
  ok(L.ROW_GAP===20, 'row gap is 20mm');
}

console.log('\n=== Mixing orientations raises the panel count ===');
{
  // 3400mm up-slope: portrait-only fits 1 row (1906). Adding a landscape row
  // (1134) uses 1906+20+1134 = 3060 and picks up a second row of panels.
  const opts={usableLength:3400,usableWidth:7000};
  const pOnly=L.packRows(J,{...opts,allowed:['portrait']});
  const mixed=L.packRows(J,{...opts,allowed:['portrait','landscape']});
  console.log(`   portrait only : ${pOnly.rows.length} row(s), ${pOnly.panels} panels`);
  console.log(`   mixed         : ${mixed.rows.map(r=>r.orientation).join(' + ')} = ${mixed.panels} panels`);
  ok(mixed.panels>pOnly.panels, 'mixing beats portrait-only on this roof');
  ok(mixed.mixed===true, 'result is flagged as a mixed-orientation layout');
  ok(mixed.depthUsed<=opts.usableLength, 'stays inside the available up-slope length');
}

console.log('\n=== Never longer than the roof ===');
{
  for(const len of [1500,2000,3000,4000,6000,9000]){
    const r=L.packRows(A,{usableLength:len,usableWidth:5000});
    const okFit = r.depthUsed<=len;
    if(!okFit) console.log(`   OVERRUN at ${len}: used ${r.depthUsed}`);
    ok(okFit, `${len}mm roof: layout depth ${r.depthUsed} fits`);
  }
  const tiny=L.packRows(A,{usableLength:800,usableWidth:5000});
  ok(tiny.panels===0, 'a roof too short for any row yields nothing rather than overhanging');
  const narrow=L.packRows(A,{usableLength:5000,usableWidth:900});
  ok(narrow.panels===0, 'a roof too narrow for any panel yields nothing');
}

console.log('\n=== Landscape on tile is not viable for these panels ===');
{
  const w=E.railSeparationWindow(J);
  for(const truss of [450,600,900,1200]){
    const opts=[]; for(let k=1;k*truss<=w.max;k++) if(k*truss>=w.min) opts.push(k*truss);
    ok(opts.length===0, `landscape on tile at ${truss}mm trusses has no compliant rail separation`);
  }
  // ...but portrait on tile at a normal tile gauge does work.
  ok(E.railLineOptions(J,330).options.length>0, 'portrait on tile at 330mm gauge works');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
