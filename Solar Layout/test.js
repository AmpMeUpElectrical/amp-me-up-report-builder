const E = require('./engine.js');
const tables = require('./spacing_tables.json');
const NODE = 1;
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); };

console.log('\n=== 1. Logan\'s worked example: 1280 max, 700 truss bays ===');
{
  const r = E.solveFeet({
    mode: 'quantised', start: 0, end: 5600, pitch: 700, offset: 0,
    maxAt: () => 1280,
  });
  console.log('   feet at:', r.feet.join(', '));
  console.log('   spans  :', r.spans.join(', '));
  ok(r.ok && r.spans.every(s => s === 700), 'forced to every truss (700), not 1400');
  ok(r.spans.every(s => s <= 1280), 'every span within the 1280 mm maximum');
}

console.log('\n=== 2. Same max, 600 truss bays — two bays fit ===');
{
  const r = E.solveFeet({ mode:'quantised', start:0, end:4800, pitch:600, maxAt:()=>1280 });
  console.log('   spans  :', r.spans.join(', '));
  ok(r.spans.every(s => s === 1200), 'skips every second truss (1200 <= 1280)');
}

console.log('\n=== 3. Structure too coarse to ever comply ===');
{
  const r = E.solveFeet({ mode:'quantised', start:0, end:3600, pitch:1200, maxAt:()=>900 });
  ok(!r.ok, 'reports infeasible rather than silently overspanning');
  console.log('   ->', r.notes[0]);
}

console.log('\n=== 4. Rail crossing zones: tightens locally ===');
{
  // first 1500mm is edge (900 max), remainder internal (1800 max)
  const maxAt = (x) => (x < 1500 ? 900 : 1800);
  const r = E.solveFeet({ mode:'quantised', start:0, end:6000, pitch:600, maxAt });
  console.log('   feet at:', r.feet.join(', '));
  console.log('   spans  :', r.spans.join(', '));
  ok(r.spans.every((s,i) => s <= maxAt(r.feet[i])), 'no span exceeds the limit at its start');
  ok(Math.max(...r.spans) > 900, 'opens up once clear of the edge zone');
}

console.log('\n=== 5. Cert lookup: tin, 2.2x1.2, TC2, region B2, h=6, d=12 ===');
{
  const job = { roof:'tin', panel:'2.2mx1.2m', terrainCategory:2, region:'B2',
                h:6, d:12, fixing:'steel-1.9+' };
  for (const z of E.ZONES) {
    const r = E.maxSpacing(tables, job, z);
    console.log(`   ${z.padEnd(13)} ${r.mm === null ? 'NOT SUITABLE' : r.mm + ' mm'}`);
  }
  const c = E.maxSpacing(tables, job, 'corner'), i = E.maxSpacing(tables, job, 'internal');
  ok(c.mm < i.mm, 'corner tighter than internal');
  ok(c.band === '5<h<=10', 'h=6 selects the 5-10 m band');
}

console.log('\n=== 6. Tin derate bites hard (0.55 mm purlin = 27%) ===');
{
  const base = { roof:'tin', panel:'2.2mx1.2m', terrainCategory:2, region:'A', h:4, d:10 };
  const full = E.maxSpacing(tables, {...base, fixing:'steel-1.9+'}, 'internal');
  const thin = E.maxSpacing(tables, {...base, fixing:'steel-0.55'}, 'internal');
  console.log(`   1.9mm: ${full.mm} mm   ->   0.55mm: ${thin.mm} mm`);
  ok(Math.abs(thin.mm / full.mm - 0.27) < 0.01, 'applies the 27% derate');
  ok(thin.belowFloor !== true, '483 mm is still above the 400 mm floor for a 1200 mm panel');
}

console.log('\n=== 6b. Derate driven under panel-width/3 is flagged ===');
{
  const r = E.maxSpacing(tables, { roof:'tin', panel:'1.67mx1m', terrainCategory:2,
                                   region:'A', h:4, d:10, fixing:'steel-0.55' }, 'corner');
  console.log(`   corner = ${r.mm} mm, floor = ${Math.round(E.panelDims('1.67mx1m').width/3)} mm`);
  ok(r.belowFloor === true, 'flags falling under panel-width/3');
  console.log('   ->', r.notes.find(n => n.includes('one third')));
}

console.log('\n=== 7. Tile is NOT derated the same way ===');
{
  const base = { roof:'tile', panel:'2.2mx1.2m', terrainCategory:2, region:'A', h:4, d:10 };
  const a = E.maxSpacing(tables, {...base, fixing:'steel-1.9+'}, 'internal');
  const b = E.maxSpacing(tables, {...base, fixing:'timber-20'}, 'internal');
  ok(a.mm === b.mm, 'tile: 20 mm timber embedment stays at 100%');
}

console.log('\n=== 8. Klip-Lok region + standard handling ===');
{
  const job = { roof:'kliplok', panel:'1.67mx1m', terrainCategory:2, region:'B2',
                h:4, d:10, fixing:'full-rib-over-purlin' };
  const r = E.maxSpacing(tables, job, 'internal');
  ok(r.regionUsed === 'B', 'B2 maps to the 2011 cert\'s region B');
  ok(r.mm === 1805, `internal = 1805 mm (got ${r.mm})`);
  ok(E.CERTS.kliplok.validUntil === '2023-07-05', 'expiry recorded for the banner');
}

console.log('\n=== 9. "--" cells surface as NOT SUITABLE ===');
{
  const job = { roof:'tin', panel:'1.67mx1m', terrainCategory:2, region:'D',
                h:4, d:10, fixing:'steel-1.9+' };
  const r = E.maxSpacing(tables, job, 'corner');
  ok(r.mm === null, 'region D corner on tin = not suitable for installation');
}

console.log('\n=== 10. h/d interpolation ===');
{
  const base = { roof:'tin', panel:'2.4mx1.2m', terrainCategory:2, region:'A', h:4, fixing:'steel-1.9+' };
  const lo  = E.maxSpacing(tables, {...base, d: 8},  'internal');   // h/d = 0.5
  const mid = E.maxSpacing(tables, {...base, d: 5.33},'internal');  // h/d = 0.75
  const hi  = E.maxSpacing(tables, {...base, d: 4},  'internal');   // h/d = 1.0
  console.log(`   h/d 0.50=${lo.mm}  0.75=${mid.mm}  1.00=${hi.mm}`);
  ok(mid.mm < lo.mm && mid.mm > hi.mm, 'interpolates between the two tabulated ratios');
}

console.log('\n=== 11. Zone map geometry ===');
{
  const z = E.zoneMap({ roof:'tin', b:12000, d:10000, h:5000, pitch:22,
                        planeWidth:12000, planeLength:5000 });
  console.log(`   a = ${z.a} mm, band = ${z.half} mm`);
  ok(z.at(50, 50) === 'corner', 'bottom-left is corner');
  ok(z.at(6000, 2500) === 'internal', 'centre is internal');
  ok(z.at(50, 2500) === 'edge', 'mid-height at the rake is edge');
  ok(z.at(6000, 50) === 'edge', 'gutter line is edge');
  ok(z.at(6000, 4950) === 'edge', 'ridge is an edge too at pitch >= 10 deg');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
