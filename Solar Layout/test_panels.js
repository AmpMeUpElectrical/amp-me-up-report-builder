const E = require('./engine.js');
const panels = require('./panels.json');
let pass=0, fail=0;
const ok=(c,m)=>{c?pass++:fail++;console.log(`  ${c?'PASS':'FAIL'}  ${m}`);};
const P = id => panels.find(p=>p.id===id);

console.log('\n=== Clamp zones read off the manuals ===');
{
  const j=P('jinko-51QL6-DV'), a=P('aiko-MCE54Mw');
  ok(j.model==='JKM510N-51QL6-DV-F2-OC', 'Jinko is the 51QL6-DV, not the superseded 60HL4-V');
  ok(j.length===1906 && j.width===1134 && j.weightKg===23.0, 'Jinko 1906x1134x30, 23.0 kg');
  // Table 5 column for JKMxxxN-51QL6-DV is L = A/5 ~ A/4, bounds rounded inward.
  ok(j.clamp.minFromEnd===Math.ceil(1906/5),  'Jinko min = A/5 rounded in (382)');
  ok(j.clamp.maxFromEnd===Math.floor(1906/4), 'Jinko max = A/4 rounded in (476)');
  ok(a.model==='AIKO-A495-MCE54Mw', 'Aiko pinned to the A495 variant');
  ok(a.length===1762 && a.clamp.minFromEnd===310 && a.clamp.maxFromEnd===410,
     'Aiko 1762 long, clamp 310-410');
}

console.log('\n=== Type-code traps ===');
{
  const j=P('jinko-51QL6-DV');
  // The retired 60HL4-V is the same 1906x1134x30 but uses A/5+/-50 = 332-431.
  ok(j.clamp.minFromEnd!==332 && j.clamp.maxFromEnd!==431,
     'Jinko did NOT inherit the 60HL4-V range despite the identical module size');
  ok(j.note.includes('60HL4-V'), 'library records why the 60HL4-V figures must not be reused');
  ok(P('aiko-MCE54Mw').note.includes('MAH54Tm'),
     'library warns MAH54Tm shares 1762x1134x30 but needs 400-500mm');
  ok(!panels.some(p=>p.id==='jinko-60HL4-V'), 'superseded 60HL4-V removed from the library');
  const sizes = panels.map(p=>`${p.length}x${p.width}`);
  ok(new Set(sizes).size===sizes.length, 'no two library panels share a size (nothing to confuse)');
}

console.log('\n=== Rail separation windows ===');
{
  const j=E.railSeparationWindow(P('jinko-51QL6-DV'));
  const a=E.railSeparationWindow(P('aiko-MCE54Mw'));
  console.log(`   Jinko ${j.min}-${j.max} mm     Aiko ${a.min}-${a.max} mm`);
  ok(j.min===954 && j.max===1142, 'Jinko rail separation 954-1142');
  ok(a.min===942 && a.max===1142, 'Aiko rail separation 942-1142');
  const lo=Math.max(j.min,a.min), hi=Math.min(j.max,a.max);
  console.log(`   overlap usable on both panels: ${lo}-${hi} mm`);
  ok(lo<hi, 'the two panels share a usable rail separation band');
}

console.log('\n=== Neither panel is a certified size ===');
{
  for(const p of panels){
    const env=E.certifiedEnvelope(p);
    console.log(`   ${p.model.padEnd(24)} -> ${env.key}${env.exact?' (exact)':' (substituted)'}`);
    ok(!env.exact && env.key==='2.2mx1.2m', `${p.brand} falls back to the 2.2x1.2 envelope`);
    ok(env.notes.length>0, `${p.brand} substitution recorded`);
  }
  ok(E.certifiedEnvelope({length:2100,width:1050,model:'t'}).exact===true, 'exact size used directly');
  ok(E.certifiedEnvelope({length:2500,width:1300,model:'t'}).key===null, 'oversize panel refused');
}

console.log('\n=== 15 kg/m2 cert condition ===');
{
  for(const p of panels){
    const w=E.checkPanelWeight(p);
    console.log(`   ${p.brand.padEnd(11)} ${w.kgm2} kg/m2`);
    ok(w.ok, `${p.brand} within 15 kg/m2`);
  }
}

console.log('\n=== Rail lines must land on structure AND inside the clamp zone ===');
{
  const j=P('jinko-51QL6-DV'), a=P('aiko-MCE54Mw');
  // 330mm tile courses now suit BOTH panels at 3 courses = 990mm.
  const rj=E.railLineOptions(j,330), ra=E.railLineOptions(a,330);
  console.log(`   330mm courses -> Jinko ${rj.options.map(o=>o.lines+'x='+o.separation).join(',')||'--'} | Aiko ${ra.options.map(o=>o.lines+'x='+o.separation).join(',')||'--'}`);
  ok(rj.options.length===1 && rj.options[0].separation===990, 'Jinko works at 3 x 330 = 990mm');
  ok(ra.options.length===1 && ra.options[0].separation===990, 'Aiko works at 3 x 330 = 990mm');

  // Centred rails must sit inside the manufacturer clamp zone.
  for(const p of [j,a]){
    const r=E.railLineOptions(p,330);
    ok(r.options.every(o=>o.fromEndIfCentred>=p.clamp.minFromEnd && o.fromEndIfCentred<=p.clamp.maxFromEnd),
       `${p.brand} centred rails land inside the clamp zone`);
  }

  // Real gaps stay gaps rather than being rounded away.
  ok(E.railLineOptions(j,300).options.length===0, '300mm lines genuinely have no compliant separation');
  ok(E.railLineOptions(j,900).options.length===0, '900mm lines have none either');
  ok(E.railLineOptions(a,700).options.length===0, 'Aiko on 700mm lines reports none');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
