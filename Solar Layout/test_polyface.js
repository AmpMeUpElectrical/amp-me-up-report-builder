const PF = require('./polyface.js');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); };
const near = (a, b, t = 1) => Math.abs(a - b) <= t;

const P = (x, y) => ({ x, y });
const JOB = { b: 14, d: 10, h: 5, pitch: 22 };
const SB = (mm = 200) => () => mm;

// A plain rectangle, so the new model can be checked against the old answers.
const RECT = PF.polyFace({
  points: [P(0,0), P(8000,0), P(8000,5000), P(0,5000)],
  edgeTypes: ['gutter', 'gable', 'ridge', 'gable'], pitch: 22,
});

// Hip main face: gutter, hip, ridge, hip.
const HIP = PF.polyFace({
  points: [P(0,0), P(12000,0), P(8000,5000), P(4000,5000)],
  edgeTypes: ['gutter', 'hip', 'ridge', 'hip'], pitch: 22,
});

// A face with a valley slicing the left-hand corner off.
const VALLEY = PF.polyFace({
  points: [P(3000,0), P(12000,0), P(12000,5000), P(0,5000), P(0,2000)],
  edgeTypes: ['gutter', 'gable', 'ridge', 'gable', 'valley'], pitch: 22,
});

console.log('\n=== A rectangle gives the same answers as before ===');
{
  ok(RECT.area === 8000 * 5000, 'area is right');
  ok(RECT.contains(4000, 2500) && !RECT.contains(-10, 2500), 'containment works');
  const zm = PF.zoneMapPoly(JOB, RECT);
  ok(zm.a === 2000 && zm.half === 1000, 'a = 2000 mm as before');
  const cases = [[100,100,'corner'],[4000,100,'edge'],[4000,2500,'internal'],
                 [100,2500,'edge'],[4000,4900,'edge'],[1500,2500,'intermediate'],
                 [2500,2500,'internal']];
  cases.forEach(([x,y,want]) => ok(zm.at(x,y) === want, `(${x},${y}) is ${want}`));
  const sp = RECT.spansAt(2500, SB());
  ok(sp.length === 1 && near(sp[0].min, 200) && near(sp[0].max, 7800),
     'usable span is 200-7800, the old inset');
}

console.log('\n=== Parallel edges of a narrow face are not a corner ===');
{
  // 1500 wide, so a point mid-way is inside a/2 of BOTH long edges.
  const NARROW = PF.polyFace({
    points: [P(0,0), P(1500,0), P(1500,5000), P(0,5000)],
    edgeTypes: ['gutter', 'gable', 'ridge', 'gable'], pitch: 22,
  });
  const zm = PF.zoneMapPoly(JOB, NARROW);
  ok(zm.at(750, 2500) === 'edge', 'mid-way up a narrow face is edge, not corner');
  ok(zm.at(100, 100) === 'corner', 'an actual corner still reads corner');
}

console.log('\n=== Hip face: the hip is a wind edge and the band follows it ===');
{
  const zm = PF.zoneMapPoly(JOB, HIP);
  ok(HIP.edges.filter(e => e.wind).length === 4, 'all four edges are wind edges');
  ok(zm.at(6000, 2500) === 'internal', 'the middle is internal');
  ok(zm.at(200, 100) === 'corner', 'gutter meets hip = corner');
  // 300 mm in from the hip, high up, must still read as an edge zone.
  const e = HIP.edges.find(x => x.type === 'hip');
  const mid = { x: (e.A.x + e.B.x) / 2, y: (e.A.y + e.B.y) / 2 };
  const inward = HIP.contains(mid.x - 300, mid.y) ? mid.x - 300 : mid.x + 300;
  ok(zm.at(inward, mid.y) === 'edge', '300 mm off a hip is an edge zone wherever it is');
}

console.log('\n=== A valley is NOT a wind edge, but still takes a setback ===');
{
  const zm = PF.zoneMapPoly(JOB, VALLEY);
  const v = VALLEY.edges.find(e => e.type === 'valley');
  ok(v && !v.wind, 'the valley edge is flagged as not a wind edge');
  ok(VALLEY.edges.filter(e => e.wind).length === 4, 'the other four are');

  // A point just inside the valley setback: no edge band from the valley...
  const mid = { x: (v.A.x + v.B.x) / 2, y: (v.A.y + v.B.y) / 2 };
  const px = mid.x + 900, py = mid.y + 900;          // well inside the face
  const dv = PF.distToSegment(v.A, v.B, px, py);
  console.log(`   test point is ${Math.round(dv)} mm off the valley, zone ${zm.at(px,py)}`);
  ok(dv < 2000, 'the point is genuinely close to the valley');
  ok(zm.at(px, py) !== 'corner', 'being near a valley does not make a corner zone');

  // ...but it must still clear 200 mm of it for water.
  const onValley = { x: mid.x + 50, y: mid.y + 50 };
  ok(!VALLEY.clearOfEdges(onValley.x, onValley.y, SB()), 'a point 70 mm off the valley is rejected');
  ok(VALLEY.clearOfEdges(px, py, SB()), 'a point well clear of it is accepted');
}

console.log('\n=== Setbacks can differ by edge type ===');
{
  const byType = (t) => t === 'gutter' ? 230 : t === 'valley' ? 200 : 200;
  const sp = RECT.spansAt(2500, byType);
  ok(near(sp[0].min, 200), 'a rake still uses 200 mm');
  // The gutter setback only bites near the gutter.
  const low = RECT.spansAt(215, byType);
  ok(low.length === 0, 'at 215 mm up, the 230 mm gutter setback leaves nothing');
  const ok2 = RECT.spansAt(240, byType);
  ok(ok2.length === 1, 'at 240 mm up it opens again');
}

console.log('\n=== Spans on a face cut by a valley ===');
{
  const sp0 = VALLEY.spansAt(500, SB());
  const sp1 = VALLEY.spansAt(4000, SB());
  console.log(`   at y=500: ${sp0.map(s=>`${Math.round(s.min)}-${Math.round(s.max)}`).join(', ')}`);
  console.log(`   at y=4000: ${sp1.map(s=>`${Math.round(s.min)}-${Math.round(s.max)}`).join(', ')}`);
  ok(sp0.length >= 1 && sp1.length >= 1, 'both heights have usable width');
  ok(sp1[0].width > sp0[0].width, 'above the valley cut the face is wider');
  ok(sp0.every(s => VALLEY.clearOfEdges((s.min+s.max)/2, 500, SB())),
     'every reported span really is clear of every edge');
}

console.log('\n=== bandOver takes the narrowest point of a row ===');
{
  const low = VALLEY.bandOver(300, 2200, SB());
  const top = VALLEY.spansAt(2200, SB())[0];
  const bot = VALLEY.spansAt(300, SB())[0];
  console.log(`   row 300-2200 usable ${Math.round(low.width)} mm (bottom ${Math.round(bot.width)}, top ${Math.round(top.width)})`);
  ok(low.width <= bot.width + 1 && low.width <= top.width + 1,
     'the band is no wider than either end');
  ok(low.min >= Math.max(bot.min, top.min) - 1, 'and starts at the tighter of the two');
}

console.log('\n=== Winding order does not matter ===');
{
  const rev = PF.polyFace({
    points: [P(0,5000), P(8000,5000), P(8000,0), P(0,0)],
    edgeTypes: ['ridge', 'gable', 'gutter', 'gable'], pitch: 22,
  });
  ok(near(rev.area, RECT.area, 1), 'same area whichever way round');
  ok(rev.contains(4000,2500), 'containment unaffected');
  const z1 = PF.zoneMapPoly(JOB, RECT).at(100,100);
  const z2 = PF.zoneMapPoly(JOB, rev).at(100,100);
  ok(z1 === z2, 'same zone at the same point');
}

console.log('\n=== Ridge only counts as a wind edge at 10 degrees and over ===');
{
  ok(PF.isWindEdge('ridge', 22) === true, 'ridge at 22 deg is a wind edge');
  ok(PF.isWindEdge('ridge', 5) === false, 'ridge at 5 deg is not');
  ok(PF.isWindEdge('gutter', 5) === true, 'the gutter always is');
  ok(PF.isWindEdge('hip', 5) === true, 'a hip always is');
  ok(PF.isWindEdge('valley', 45) === false, 'a valley never is');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
