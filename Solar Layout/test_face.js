const F = require('./face.js');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); };
const near = (a, b, t = 0.6) => Math.abs(a - b) <= t;

const RECT  = { faceShape:'rectangle', faceW:8000, faceL:5000, faceTopOffset:null,
                b:12, d:10, h:5, pitch:22 };
const TRAP  = { faceShape:'trapezium', faceW:12000, faceTopW:4000, faceL:5000, faceTopOffset:null,
                b:14, d:10, h:5, pitch:22 };
const TRI   = { faceShape:'triangle',  faceW:8000, faceL:4000, faceTopOffset:null,
                b:12, d:10, h:5, pitch:22 };
const RIGHT = { faceShape:'trapezium', faceW:10000, faceTopW:6000, faceL:5000, faceTopOffset:0,
                b:12, d:10, h:5, pitch:22 };

console.log('\n=== A rectangle still behaves exactly as before ===');
{
  const f = F.face(RECT);
  ok(f.Wt===8000 && f.offL===0, 'top width equals bottom width, no offset');
  ok(f.widthAt(0)===8000 && f.widthAt(5000)===8000, 'width constant up the slope');
  ok(f.leftRakeFactor===1 && f.rightRakeFactor===1, 'vertical rakes need no setback correction');
  const d = f.distances(3000, 2000);
  ok(d.left===3000 && d.right===5000, 'edge distances are just x and W-x');
  const b = f.bandOver(0, 5000, 200);
  ok(b.min===200 && b.max===7800, 'usable band is the old 200mm inset');
}

console.log('\n=== Trapezium: a hip main face narrows going up ===');
{
  const f = F.face(TRAP);
  ok(f.offL===4000, 'top edge centred: (12000-4000)/2');
  ok(f.widthAt(0)===12000 && f.widthAt(5000)===4000, '12000 at the gutter, 4000 at the ridge');
  ok(near(f.widthAt(2500), 8000), 'half way up it is 8000');
  ok(f.leftAt(2500)===2000 && f.rightAt(2500)===10000, 'both rakes close in evenly');
  ok(f.area()===(12000+4000)/2*5000, 'area is the trapezium formula');
}

console.log('\n=== The setback must be perpendicular to the rake, not horizontal ===');
{
  const f = F.face(TRAP);
  // Rake runs 4000 across over 5000 up, so it is 1.28x longer than vertical.
  ok(near(f.leftRakeFactor, Math.hypot(4000,5000)/5000, 0.001), 'rake factor is hyp/L');
  const i = f.insets(200);
  ok(i.left > 200, `200mm perpendicular needs ${Math.round(i.left)}mm horizontal, not 200`);
  ok(near(i.left, 256, 1), 'which is about 256mm on this rake');
  // Prove it: a point inset horizontally by that much really is 200mm off the rake.
  const y = 2500, x = f.leftAt(y) + i.left;
  ok(near(f.distances(x,y).left, 200, 0.5), 'the inset point measures 200mm perpendicular to the rake');
  // A naive 200mm horizontal inset would be too close.
  const naive = f.leftAt(y) + 200;
  ok(f.distances(naive,y).left < 200, 'a flat 200mm horizontal inset would breach the setback');
  console.log(`   horizontal 200mm gives only ${f.distances(naive,y).left.toFixed(0)}mm perpendicular`);
}

console.log('\n=== A row is limited by its narrowest edge, not its bottom ===');
{
  const f = F.face(TRAP);
  const low  = f.bandOver(200, 2106, 200);     // a portrait row low down
  const high = f.bandOver(2500, 4406, 200);    // the same row higher up
  console.log(`   low row usable ${Math.round(low.width)}mm, high row usable ${Math.round(high.width)}mm`);
  ok(low.width > high.width, 'the higher row has less width to play with');
  const top = f.bandAt(2106, 200), bottom = f.bandAt(200, 200);
  ok(low.min===top.min && low.max===top.max, 'the band over a row is taken at its top edge');
  ok(bottom.max > top.max, 'using the bottom edge alone would overhang the rake');
}

console.log('\n=== Triangle: a hip end ===');
{
  const f = F.face(TRI);
  ok(f.isTriangle===true, 'flagged as a triangle');
  ok(f.widthAt(4000)===0, 'zero width at the apex');
  ok(near(f.widthAt(2000), 4000), 'half height, half width');
  ok(f.distances(4000,2000).ridge===Infinity, 'no ridge edge — the rakes meet at a point');
  const b = f.bandOver(200, 1200, 200);
  ok(b.width>0, 'there is usable width low down');
  const high = f.bandOver(3000, 3800, 200);
  ok(high.width<=0, 'nothing usable near the apex');
  console.log(`   low band ${Math.round(b.width)}mm, near apex ${Math.round(high.width)}mm`);
}

console.log('\n=== Asymmetric: gable one side, hip the other ===');
{
  const f = F.face(RIGHT);
  ok(f.offL===0, 'top offset 0 keeps the left edge vertical');
  ok(f.leftAt(0)===0 && f.leftAt(5000)===0, 'left rake is vertical');
  ok(f.rightAt(0)===10000 && f.rightAt(5000)===6000, 'right rake rakes in');
  ok(f.leftRakeFactor===1, 'no correction on the vertical side');
  ok(f.rightRakeFactor>1, 'correction only on the raking side');
  const i = f.insets(200);
  ok(i.left===200 && i.right>200, 'setbacks differ side to side');
}

console.log('\n=== contains() bounds the face ===');
{
  const f = F.face(TRAP);
  ok(f.contains(6000,2500)===true, 'centre is inside');
  ok(f.contains(500,4500)===false, 'outside the rake high up is outside');
  ok(f.contains(500,100)===true, 'the same x low down is inside');
  ok(f.contains(6000,5200)===false, 'above the ridge is outside');
}

console.log('\n=== Zones follow the rake ===');
{
  const f = F.face(TRAP);
  const zm = F.zoneMapFace(TRAP, f);
  console.log(`   a = ${zm.a} mm, band = ${zm.half} mm`);
  ok(zm.at(6000,2500)!=='corner', 'centre of the face is not a corner');
  ok(zm.at(100,100)==='corner', 'bottom-left is a corner');
  // A point a fixed horizontal distance in from the rake changes zone with height,
  // because the rake moves — this is the thing a rectangle model gets wrong.
  const zLow  = zm.at(f.leftAt(500)+300, 500);
  const zHigh = zm.at(f.leftAt(4000)+300, 4000);
  ok(zLow==='edge' || zLow==='corner', 'near the rake low down is an edge zone');
  ok(zHigh==='edge' || zHigh==='corner', 'near the rake high up is also an edge zone');
  // And the rectangle model would have called the high point internal.
  const rectLike = f.leftAt(4000)+300;
  ok(rectLike > 3000, `at 4000mm up, 300mm off the rake is x=${Math.round(rectLike)} — a rectangle model would read that as mid-roof`);
}

console.log('\n=== Rectangle via the general model equals the old special case ===');
{
  const f = F.face(RECT);
  const zm = F.zoneMapFace(RECT, f);
  const pts = [[100,100],[4000,100],[4000,2500],[100,2500],[4000,4900],[1500,2500],[2500,2500]];
  const expect = ['corner','edge','internal','edge','edge','intermediate','internal'];
  pts.forEach((p,i)=>ok(zm.at(p[0],p[1])===expect[i],
    `(${p[0]},${p[1]}) is ${expect[i]}`));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
