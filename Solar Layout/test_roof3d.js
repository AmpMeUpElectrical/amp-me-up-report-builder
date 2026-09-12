const R3 = require('./roof3d.js');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); };
const near = (a, b, t = 2) => Math.abs(a - b) <= t;
const V = R3.V;

const P = 22;
const COS = Math.cos(P * Math.PI / 180);
const TAN = Math.tan(P * Math.PI / 180);

const hipBoth = { centre: V(0,0), span: 8000, length: 14000, pitch: P, ends: ['hip','hip'] };
const gableBoth = { centre: V(0,0), span: 8000, length: 14000, pitch: P, ends: ['gable','gable'] };
const halfHip = { centre: V(0,0), span: 8000, length: 14000, pitch: P, ends: ['hip','gable'] };

console.log('\n=== Gable both ends: two rectangles ===');
{
  const r = R3.buildRoof({ wings: [gableBoth] });
  ok(r.faces.length === 2, 'two faces');
  for (const f of r.faces) {
    ok(near(f.planArea, 14000 * 4000), 'each covers half the footprint in plan');
    const xs = f.facePoly.map(p=>p.x), ys = f.facePoly.map(p=>p.y);
    const wide = Math.max(...xs) - Math.min(...xs);
    const up   = Math.max(...ys) - Math.min(...ys);
    ok(near(wide, 14000), 'face is 14000 along the gutter');
    ok(near(up, 4000 / COS), `face is ${Math.round(4000/COS)} mm up the slope, not 4000`);
    ok(f.edgeTypes.filter(t=>t==='gutter').length === 1, 'one gutter edge');
    ok(f.edgeTypes.filter(t=>t==='ridge').length === 1, 'one ridge edge');
    ok(f.edgeTypes.filter(t=>t==='gable').length === 2, 'two gable edges');
  }
}

console.log('\n=== Plan versus slope is the whole point ===');
{
  const r = R3.buildRoof({ wings: [gableBoth] });
  const f = r.faces[0];
  const up = Math.max(...f.facePoly.map(p=>p.y));
  console.log(`   4000 mm across the ground becomes ${Math.round(up)} mm up a ${P}deg slope`);
  ok(up > 4000, 'the slope length exceeds the plan length');
  ok(near(up, 4000/COS), 'by exactly 1/cos(pitch)');
  ok(near(f.slopeArea, f.planArea/COS), 'and the area scales the same way');
}

console.log('\n=== Hip both ends: two trapeziums and two triangles ===');
{
  const r = R3.buildRoof({ wings: [hipBoth] });
  ok(r.faces.length === 4, 'four faces');
  const sides = r.faces.filter(f=>f.kind==='side');
  const endsF = r.faces.filter(f=>f.kind==='end');
  ok(sides.length === 2 && endsF.length === 2, 'two sides, two ends');

  for (const f of sides) {
    ok(f.planPoly.length === 4, 'a side is a quadrilateral');
    // ridge is shortened by the span at each hipped end
    const ridgeLen = f.edgeTypes.map((t,i)=>({t,i})).filter(o=>o.t==='ridge')
      .map(o=>{ const A=f.planPoly[o.i], B=f.planPoly[(o.i+1)%f.planPoly.length];
                return Math.hypot(B.x-A.x,B.y-A.y); })[0];
    ok(near(ridgeLen, 14000-8000), 'the ridge is shortened by the span — 6000 mm');
    ok(f.edgeTypes.filter(t=>t==='hip').length === 2, 'a hip each side');
  }
  for (const f of endsF) {
    ok(f.planPoly.length === 3, 'a hip end is a triangle');
    ok(f.edgeTypes.filter(t=>t==='hip').length === 2, 'two hips meeting at a point');
    ok(f.edgeTypes.filter(t=>t==='gutter').length === 1, 'and a gutter');
  }
  const total = r.faces.reduce((a,f)=>a+f.planArea,0);
  ok(near(total, 8000*14000, 50), 'the faces tile the footprint exactly');
}

console.log('\n=== Half hip: one hipped end, one gable ===');
{
  const r = R3.buildRoof({ wings: [halfHip] });
  ok(r.faces.length === 3, 'three faces — two sides and one hip end');
  const endsF = r.faces.filter(f=>f.kind==='end');
  ok(endsF.length === 1, 'only the hipped end makes a face');
  const sides = r.faces.filter(f=>f.kind==='side');
  ok(sides.every(f=>f.edgeTypes.includes('gable')), 'each side runs out to the gable');
  ok(sides.every(f=>f.edgeTypes.filter(t=>t==='hip').length === 1), 'and hips at the other end');
  ok(near(r.faces.reduce((a,f)=>a+f.planArea,0), 8000*14000, 50), 'still tiles the footprint');
}

console.log('\n=== Ridge height comes out of span and pitch ===');
{
  const r = R3.buildRoof({ wings: [hipBoth] });
  const side = r.faces.find(f=>f.kind==='side');
  const hs = side.planPoly.map(p=>side.plane.h(p));
  const peak = Math.max(...hs);
  console.log(`   span 8000, pitch ${P}deg -> ridge ${Math.round(peak)} mm above the eave`);
  ok(near(peak, 4000*TAN), 'ridge height is half the span times tan(pitch)');
}

console.log('\n=== Pitch changes the slope but not the plan ===');
{
  for (const pitch of [10, 22, 35]) {
    const r = R3.buildRoof({ wings: [{...gableBoth, pitch}] });
    const f = r.faces[0];
    const up = Math.max(...f.facePoly.map(p=>p.y));
    const c = Math.cos(pitch*Math.PI/180);
    ok(near(f.planArea, 14000*4000), `pitch ${pitch}: plan area unchanged`);
    ok(near(up, 4000/c), `pitch ${pitch}: slope length ${Math.round(up)} mm`);
  }
}

console.log('\n=== A rotated wing gives the same faces, just turned ===');
{
  const a = R3.buildRoof({ wings: [hipBoth] });
  const b = R3.buildRoof({ wings: [{...hipBoth, rot: 37}] });
  ok(a.faces.length === b.faces.length, 'same number of faces');
  const areaA = a.faces.map(f=>Math.round(f.planArea)).sort((x,y)=>x-y);
  const areaB = b.faces.map(f=>Math.round(f.planArea)).sort((x,y)=>x-y);
  ok(JSON.stringify(areaA) === JSON.stringify(areaB), 'same face areas');
  const upA = a.faces.map(f=>Math.round(Math.max(...f.facePoly.map(p=>p.y)))).sort((x,y)=>x-y);
  const upB = b.faces.map(f=>Math.round(Math.max(...f.facePoly.map(p=>p.y)))).sort((x,y)=>x-y);
  ok(JSON.stringify(upA) === JSON.stringify(upB), 'same slope lengths');
}

console.log('\n=== Face coordinates are what the layout engine expects ===');
{
  const r = R3.buildRoof({ wings: [hipBoth] });
  for (const f of r.faces) {
    const xs = f.facePoly.map(p=>p.x), ys = f.facePoly.map(p=>p.y);
    ok(Math.min(...xs) >= -0.01 && Math.min(...ys) >= -0.01, 'origin at the bottom-left');
    ok(f.edgeTypes.length === f.facePoly.length, 'one edge type per corner');
    // the gutter edge must sit along y = 0
    const gi = f.edgeTypes.indexOf('gutter');
    const A = f.facePoly[gi], B = f.facePoly[(gi+1)%f.facePoly.length];
    ok(near(A.y, 0, 1) && near(B.y, 0, 1), 'the gutter runs along y = 0');
  }
}

console.log('\n=== A square footprint hipped all round is a pyramid ===');
{
  const r = R3.buildRoof({ wings: [{ centre:V(0,0), span:8000, length:8000, pitch:P, ends:['hip','hip'] }] });
  ok(r.faces.length === 4, 'four faces');
  ok(r.faces.every(f=>f.planPoly.length===3), 'every face is a triangle');
  ok(r.faces.every(f=>!f.edgeTypes.includes('ridge')), 'no ridge — they meet at a point');
  ok(near(r.faces.reduce((a,f)=>a+f.planArea,0), 8000*8000, 50), 'tiles the square');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
