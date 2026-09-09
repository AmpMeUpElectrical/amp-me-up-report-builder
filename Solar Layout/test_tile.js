const L=require('./layout.js'), E=require('./engine.js'), panels=require('./panels.json');
const tables=require('./spacing_tables.json');
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log(`  ${c?'PASS':'FAIL'}  ${m}`);};
const J=panels.find(p=>p.id==='jinko-51QL6-DV');

// Tile geometry is MEASURED PER JOB - every tile run is different. These are two
// example measurement sets, not a database.
const WIDE={profile:'profiled',coverWidth:330,troughOffset:165,troughWidth:250,hookWidth:40};
const NARROW={profile:'profiled',coverWidth:330,troughOffset:165,troughWidth:120,hookWidth:40};

console.log('\n=== The hook is physically limited to +/-60mm ===');
{
  ok(L.HOOK_SLOT_SPAN===120, '120mm between the furthest screw holes');
  ok(L.HOOK_MAX_OFFSET===60, 'so 60mm is the largest offset from the truss centreline');
}

console.log('\n=== Whether every truss can reach a trough is a per-job question ===');
{
  const w=L.troughReachability(WIDE), n=L.troughReachability(NARROW);
  console.log(`   wide trough (250mm):   reach ${w.reach}mm vs worst case ${w.worstCase}mm -> ${w.always?'always':'short by '+w.shortBy}`);
  console.log(`   narrow trough (120mm): reach ${n.reach}mm vs worst case ${n.worstCase}mm -> ${n.always?'always':'short by '+n.shortBy}`);
  ok(w.always===true, 'a 250mm trough on a 330mm cover always reaches at 60mm offset');
  ok(n.always===false, 'a 120mm trough does NOT — some trusses are unreachable');
  ok(n.minTroughWidthForAlways===250, 'tool states the trough width needed (250mm)');
}

console.log('\n=== Wide trough: every interior truss gets an interface ===');
{
  const r=L.interfacePositions({planeWidth:6000,trussPitch:600,slide:L.HOOK_MAX_OFFSET,tile:WIDE});
  const interior=r.trusses.filter(t=>t>0&&t<6000);
  console.log(`   feet: ${r.positions.map(p=>p.x).join(', ')}`);
  console.log(`   spans: ${r.spans.join(', ')}  (nominal 600)`);
  ok(interior.every(t=>r.positions.some(p=>p.truss===t)), 'no interior truss skipped');
  ok(r.positions.every(p=>Math.abs(p.shift)<=60), 'no hook slid beyond 60mm');
  ok(r.positions.every(p=>p.x>=0&&p.x<=6000), 'every interface on the roof face');
}

console.log('\n=== Narrow trough: the tool names the trusses it cannot use ===');
{
  const r=L.interfacePositions({planeWidth:6000,trussPitch:600,slide:L.HOOK_MAX_OFFSET,tile:NARROW});
  console.log(`   usable ${r.positions.length}/${r.trusses.length}, blocked ${r.blocked.length}`);
  if(r.blocked.length) console.log(`   e.g. ${r.blocked[0].reason}`);
  ok(r.blocked.length>0, 'blocked trusses are reported, not silently dropped');
  ok(r.blocked.every(b=>typeof b.reason==='string'&&b.reason.length>0), 'each has a reason');
  ok(r.spans.some(s=>s>600), 'losing trusses opens the spans beyond the nominal pitch');
}

console.log('\n=== The measured tile decides compliance, on the same roof ===');
{
  // tile / TC3 / region A / h=4 / edge zone -> 940mm certified maximum
  const job={roof:'tile',panel:'1.67mx1m',terrainCategory:3,region:'A',h:4,d:12,fixing:'timber-35+'};
  const lim=E.maxSpacing(tables,job,'edge').mm;
  const at=(tile)=>{
    const r=L.interfacePositions({planeWidth:6000,trussPitch:900,slide:L.HOOK_MAX_OFFSET,tile});
    return {max:Math.max(...r.spans), blocked:r.blocked.length, r};
  };
  const w=at(WIDE), n=at(NARROW);
  console.log(`   certified maximum: ${lim} mm; nominal 900mm trusses look fine either way`);
  console.log(`   wide trough   -> max span ${w.max} mm, ${w.blocked} blocked -> ${w.max<=lim?'COMPLIANT':'NON-COMPLIANT'}`);
  console.log(`   narrow trough -> max span ${n.max} mm, ${n.blocked} blocked -> ${n.max<=lim?'COMPLIANT':'NON-COMPLIANT'}`);
  ok(900<=lim, 'nominal 900mm pitch sits inside the 940mm certified maximum');
  ok(w.max>900 && w.max<=lim, 'wide trough: shifted spans grow but stay compliant');
  ok(n.max>lim, 'narrow trough: same roof, same trusses, NON-compliant');
  for(const c of [w,n]){
    const xs=c.r.positions.map(p=>p.x);
    const s=E.solveFeet({mode:'quantised',start:xs[0],end:xs.at(-1),members:xs,maxAt:()=>lim});
    ok(!s.ok||s.spans.every(v=>v<=lim), 'solver judges only on real interface positions');
  }
}

console.log('\n=== The hook shifts either way, whichever reaches ===');
{
  const r=L.interfacePositions({planeWidth:6000,trussPitch:600,slide:L.HOOK_MAX_OFFSET,tile:WIDE});
  const shifts=r.positions.map(p=>p.shift);
  console.log(`   shifts: ${shifts.join(', ')}`);
  ok(shifts.some(v=>v>0) && shifts.some(v=>v<0), 'shifts occur in both directions');
  ok(shifts.every(v=>Math.abs(v)<=60), 'never beyond the 60mm physical limit');
  ok(shifts.some(v=>v===0), 'and stays on the truss centreline where the trough allows');
  const n=L.interfacePositions({planeWidth:6000,trussPitch:600,slide:L.HOOK_MAX_OFFSET,tile:NARROW});
  ok(n.blocked.filter(b=>!b.offFace).every(b=>b.reason.includes('either direction')),
     'a blocked truss is reported as unreachable in either direction');
}

console.log('\n=== Landscape on tile at the real 60mm offset ===');
{
  for(const tp of [450,600,900]){
    const r30=L.railSeparationsWithTolerance(J,tp,30);
    const r60=L.railSeparationsWithTolerance(J,tp,60);
    const range=o=>o.reduce((a,x)=>a+(x.usable[1]-x.usable[0]),0);
    console.log(`   ${tp}mm trusses: +/-30mm gives ${range(r30.options)}mm of range, +/-60mm gives ${range(r60.options)}mm`);
    ok(r60.options.length>0, `${tp}mm centres workable in landscape at 60mm offset`);
    ok(range(r60.options)>range(r30.options), `${tp}mm centres get real margin at 60mm`);
    ok(r60.options.every(o=>o.usable[0]>=954&&o.usable[1]<=1142),
       `${tp}mm separations stay inside the clamp window`);
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
