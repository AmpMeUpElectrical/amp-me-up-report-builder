const L = require('./layout.js');
const E = require('./engine.js');
const P = require('./placement.js');
const panels = require('./panels.json');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); };
const J = panels.find(p => p.id === 'jinko-51QL6-DV');
const A = panels.find(p => p.id === 'aiko-MCE54Mw');

console.log('\n=== Rail sag: the gutter needs more setback than the ridge ===');
{
  const sb = L.edgeSetback({ panelGapS: 50, sag: 30 });
  console.log(`   gutter ${sb.gutter} mm, ridge ${sb.ridge} mm, rakes ${sb.rake} mm`);
  ok(sb.mm === 200, 'the governing setback is still 200 mm');
  ok(sb.gutter === 230, 'the gutter gets the 30 mm sag allowance');
  ok(sb.ridge === 200 && sb.rake === 200, 'the ridge and rakes do not — sag moves the panel away');
  ok(L.edgeSetback({ panelGapS: 50, sag: 0 }).gutter === 200, 'no allowance set, no change');
  // 2s still takes over when the panel sits high off the roof.
  const big = L.edgeSetback({ panelGapS: 150, sag: 30 });
  ok(big.mm === 300 && big.gutter === 330, 's = 150 mm gives 300 mm, plus sag at the gutter');
}

console.log('\n=== Which is what stops a 200 mm set-out finishing at 170 ===');
{
  const sb = L.edgeSetback({ panelGapS: 50, sag: 30 });
  const setOut = sb.gutter, finished = setOut - sb.sag;
  console.log(`   set out at ${setOut} mm, finishes at ${finished} mm`);
  ok(finished >= sb.mm, 'the finished panel still clears the 200 mm rule');
  // The old behaviour, for contrast.
  const naive = sb.mm, naiveFinished = naive - sb.sag;
  ok(naiveFinished < sb.mm, `setting out at ${naive} mm would finish at ${naiveFinished} mm — a breach`);
}

console.log('\n=== A row must respect the gutter setback, not the plain one ===');
{
  const lines = [];
  for (let n = 1; n <= 15; n++) lines.push({ y: n * 330 });
  const strict = P.portraitRows(J, { lines, planeLength: 5000, setback: 200,
                                     gutterSetback: 230, ridgeSetback: 200 });
  const loose  = P.portraitRows(J, { lines, planeLength: 5000, setback: 200 });
  console.log(`   with sag, lowest row at ${strict[0].panelBottom} mm; without, ${loose[0].panelBottom} mm`);
  ok(strict.every(r => r.panelBottom >= 230), 'every row clears the sag-adjusted gutter setback');
  ok(strict[0].panelBottom > loose[0].panelBottom, 'the sag allowance pushes the first row up');
}

console.log('\n=== Clamp tolerance widens the window, and says by how much ===');
{
  const spec = L.clampWindow(J, 0);
  ok(spec.min === 382 && spec.max === 476, 'at 0% the window is the manual, 382-476 mm');
  ok(spec.tolMm === 0, 'no tolerance in millimetres');

  const t5 = L.clampWindow(J, 5);
  const mm = 5 / 100 * J.length;
  console.log(`   5% of ${J.length} mm = ${Math.round(mm)} mm -> ${Math.round(t5.min)}-${Math.round(t5.max)} mm`);
  ok(Math.abs(t5.tolMm - mm) < 0.01, 'tolerance is a percentage of panel length');
  ok(t5.min < spec.min && t5.max > spec.max, 'the window opens both ways');
  ok(t5.specMin === 382 && t5.specMax === 476, 'the manufacturer spec is still carried');

  // It can never run past the middle of the panel, nor off the end.
  const huge = L.clampWindow(J, 60);
  ok(huge.min >= 0 && huge.max <= J.length / 2, 'an absurd tolerance is still bounded by the panel');
}

console.log('\n=== outsideSpec reports the breach honestly ===');
{
  ok(L.outsideSpec(J, 420) === null, 'a clamp inside the zone is not a breach');
  const near = L.outsideSpec(J, 350);
  ok(near && near.by === 32 && near.side.includes('closer to the end'),
     '350 mm is 32 mm closer to the end than the 382 mm minimum');
  const far = L.outsideSpec(J, 500);
  ok(far && far.by === 24 && far.side.includes('further in'),
     '500 mm is 24 mm further in than the 476 mm maximum');
  ok(L.outsideSpec(J, 382) === null && L.outsideSpec(J, 476) === null,
     'the bounds themselves are inside spec');
}

console.log('\n=== A wider clamp window offers more rail separations ===');
{
  const spec = E.railSeparationWindow(J, 0);
  const t5   = E.railSeparationWindow(J, 5);
  console.log(`   spec ${spec.min}-${spec.max} mm, at 5% ${Math.round(t5.min)}-${Math.round(t5.max)} mm`);
  ok(spec.min === 954 && spec.max === 1142, 'the manual gives 954-1142 mm');
  ok(t5.min < spec.min && t5.max > spec.max, '5% opens it both ways');
  ok(t5.spec[0] === 382 && t5.spec[1] === 476, 'the spec bounds are still reported');

  // The point of it: course pitches that had no answer now have one.
  const strictOpts = E.railLineOptions(J, 300).options;
  const wideWindow = t5;
  const looseOpts = [];
  for (let k = 1; k * 300 <= wideWindow.max; k++) {
    const sep = k * 300;
    if (sep >= wideWindow.min) looseOpts.push(sep);
  }
  console.log(`   300 mm courses: ${strictOpts.length} option(s) in spec, ${looseOpts.length} at 5%`);
  ok(strictOpts.length === 0, '300 mm courses have no compliant separation in spec');
  ok(looseOpts.length > 0, 'and do have one once the tolerance is allowed');
}

console.log('\n=== Both panels behave the same way ===');
{
  for (const p of [J, A]) {
    const w = L.clampWindow(p, 5);
    ok(w.min < p.clamp.minFromEnd && w.max > p.clamp.maxFromEnd, `${p.brand}: window opens`);
    ok(L.outsideSpec(p, w.min) !== null, `${p.brand}: the widened bound is reported as a breach`);
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
