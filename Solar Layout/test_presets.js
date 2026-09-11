const PR = require('./presets.js');
const PF = require('./polyface.js');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); };
const near = (a, b, t = 1) => Math.abs(a - b) <= t;
const JOB = { b: 14, d: 10, h: 5, pitch: 22 };

console.log('\n=== Every preset builds a valid face ===');
{
  for (const p of PR.PRESETS) {
    const shape = PR.buildShape(p.id, {});
    const face = PF.polyFace({ ...shape, pitch: 22 });
    const zm = PF.zoneMapPoly(JOB, face);
    const c = face.points.reduce((a, pt) => ({ x: a.x + pt.x / face.points.length,
                                               y: a.y + pt.y / face.points.length }), { x: 0, y: 0 });
    console.log(`   ${p.id.padEnd(13)} ${face.points.length} corners, ${Math.round(face.area/1e6*10)/10} m2, zone at centre: ${zm.at(c.x, c.y)}`);
    ok(face.points.length >= 3, `${p.id}: at least three corners`);
    ok(face.area > 0, `${p.id}: positive area`);
    ok(shape.edgeTypes.length === shape.points.length, `${p.id}: one edge type per corner`);
    ok(face.contains(c.x, c.y), `${p.id}: its own centroid is inside it`);
  }
}

console.log('\n=== Every preset has exactly one gutter ===');
{
  for (const p of PR.PRESETS) {
    const shape = PR.buildShape(p.id, {});
    const n = shape.edgeTypes.filter(t => t === 'gutter').length;
    ok(n === 1, `${p.id}: one gutter edge`);
  }
}

console.log('\n=== The gutter is at the bottom of every preset ===');
{
  for (const p of PR.PRESETS) {
    const shape = PR.buildShape(p.id, {});
    const i = shape.edgeTypes.indexOf('gutter');
    const A = shape.points[i], B = shape.points[(i + 1) % shape.points.length];
    ok(A.y === 0 && B.y === 0, `${p.id}: the gutter edge sits on y = 0`);
  }
}

console.log('\n=== Rectangle matches the old rectangle exactly ===');
{
  const shape = PR.buildShape('rect', { W: 8000, L: 5000 });
  const face = PF.polyFace({ ...shape, pitch: 22 });
  ok(face.area === 8000 * 5000, 'area 40 m2');
  const zm = PF.zoneMapPoly(JOB, face);
  ok(zm.at(100, 100) === 'corner' && zm.at(4000, 2500) === 'internal',
     'the same zones as the rectangle model gave');
}

console.log('\n=== Hip end really is a triangle that closes at a point ===');
{
  const shape = PR.buildShape('hip-end', { W: 8000, L: 4000 });
  const face = PF.polyFace({ ...shape, pitch: 22 });
  ok(face.points.length === 3, 'three corners');
  ok(near(face.area, 8000 * 4000 / 2), 'half base times height');
  ok(face.spansAt(3900, () => 200).length === 0, 'nothing usable right at the apex');
  ok(face.spansAt(400, () => 200).length === 1, 'usable width down near the gutter');
}

console.log('\n=== Valley presets mark the valley, and only the valley ===');
{
  for (const id of ['valley-one', 'valley-both', 'valley-trap']) {
    const shape = PR.buildShape(id, {});
    const face = PF.polyFace({ ...shape, pitch: 22 });
    const valleys = face.edges.filter(e => e.type === 'valley');
    ok(valleys.length >= 1, `${id}: has a valley edge`);
    ok(valleys.every(e => !e.wind), `${id}: no valley counts as a wind edge`);
    ok(face.edges.filter(e => e.type === 'gutter').every(e => e.wind), `${id}: the gutter does`);
  }
}

console.log('\n=== A valley lets panels sit closer than a hip would ===');
{
  // Same trapezium twice: once with valleys each side, once with hips.
  const dims = { W: 7000, T: 2500, L: 4000 };
  const vShape = PR.buildShape('valley-trap', dims);
  const hShape = PR.buildShape('hip-main', { W: 7000, T: 2500, L: 4000 });
  const v = PF.polyFace({ ...vShape, pitch: 22 });
  const h = PF.polyFace({ ...hShape, pitch: 22 });
  const zv = PF.zoneMapPoly(JOB, v), zh = PF.zoneMapPoly(JOB, h);

  // A point 400 mm in from the left raking edge, half way up.
  const y = 2000;
  const x = v.spansAt(y, () => 200)[0].min + 200;
  console.log(`   at (${Math.round(x)}, ${y}): valley face = ${zv.at(x,y)}, hip face = ${zh.at(x,y)}`);
  ok(zh.at(x, y) === 'corner' || zh.at(x, y) === 'edge', 'next to a hip it is an edge or corner zone');
  ok(zv.at(x, y) !== 'corner', 'next to a valley it is not a corner zone');
  // Both still have to clear the 200 mm setback.
  ok(!v.clearOfEdges(v.spansAt(y, () => 200)[0].min - 100, y, () => 200),
     'the valley setback is still enforced');
}

console.log('\n=== Defaults fill in, and given values win ===');
{
  const a = PR.buildShape('rect', {});
  ok(a.dims.W === 8000 && a.dims.L === 5000, 'defaults used when nothing is given');
  const b = PR.buildShape('rect', { W: 9999 });
  ok(b.dims.W === 9999 && b.dims.L === 5000, 'a given value overrides just that field');
  const c = PR.buildShape('rect', { W: '' });
  ok(c.dims.W === 8000, 'a blank falls back to the default');
  // A centred ridge unless told otherwise.
  const d = PR.buildShape('hip-main', { W: 12000, T: 4000, L: 5000 });
  ok(d.points[3].x === 4000, 'hip ridge centred by default');
  const e = PR.buildShape('hip-main', { W: 12000, T: 4000, L: 5000, off: 0 });
  ok(e.points[3].x === 0, 'an explicit offset is honoured');
}

console.log('\n=== Left and right variants mirror properly ===');
{
  const l = PF.polyFace({ ...PR.buildShape('valley-one', { side: 'l' }), pitch: 22 });
  const r = PF.polyFace({ ...PR.buildShape('valley-one', { side: 'r' }), pitch: 22 });
  ok(near(l.area, r.area, 1), 'both sides give the same area');
  const lowL = l.spansAt(300, () => 200)[0], lowR = r.spansAt(300, () => 200)[0];
  ok(near(lowL.width, lowR.width, 1), 'same usable width low down');
  ok(lowL.min > lowR.min, 'the left-hand cut pushes the usable band right, and vice versa');

  const gl = PF.polyFace({ ...PR.buildShape('gable-hip', { side: 'l' }), pitch: 22 });
  const gr = PF.polyFace({ ...PR.buildShape('gable-hip', { side: 'r' }), pitch: 22 });
  ok(near(gl.area, gr.area, 1), 'gable/hip mirrors too');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
