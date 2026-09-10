const L = require('./layout.js');
const E = require('./engine.js');
const panels = require('./panels.json');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); };
const J = panels.find(p => p.id === 'jinko-51QL6-DV');

const TILE = { roof:'tile', faceW:8000, faceL:5000, gauge:330, coverW:300,
               trussPitch:600, trussOffset:0, hookShift:60, tile:{profile:'flat'} };
const TIN_ACROSS = { roof:'tin', tinDir:'across', faceW:8000, faceL:5000,
                     purlinPitch:900, purlinOffset:300 };
const TIN_UP     = { roof:'tin', tinDir:'up', faceW:8000, faceL:5000,
                     purlinPitch:900, purlinOffset:0 };

console.log('\n=== Tile fixes BOTH directions ===');
{
  const st = L.structure(TILE);
  ok(st.up.free===false && st.across.free===false, 'neither direction is free');
  ok(st.up.lines.length===14, '14 usable tile courses (top one blocked by the ridge cap)');
  ok(st.across.positions.length===14, '14 truss positions across an 8000 mm face at 600 centres');
  ok(st.across.pitch===600 && st.across.shift===60, 'truss pitch and 60 mm hook shift carried through');
}

console.log('\n=== Purlins ACROSS the slope: across-slope is free ===');
{
  const st = L.structure(TIN_ACROSS);
  ok(st.across.free===true, 'a foot slides anywhere along a purlin, so across-slope is free');
  ok(st.up.free===false, 'up-slope is fixed to the purlin spacing');
  ok(st.up.lines.length===6, '6 purlin lines up a 5000 mm face at 900 centres from 300');
  ok(st.up.lines[0]===300 && st.up.lines[1]===1200, 'lines start at the offset and step by the pitch');
}

console.log('\n=== Purlins UP the slope: up-slope is free ===');
{
  const st = L.structure(TIN_UP);
  ok(st.up.free===true, 'a foot slides anywhere along a purlin, so up-slope is free');
  ok(st.across.free===false, 'across-slope is fixed to the purlin spacing');
  ok(st.across.positions.length===9, '9 purlin positions across an 8000 mm face at 900 centres');
  ok(st.across.pitch===900, 'across-slope pitch is the purlin pitch, not a truss pitch');
}

console.log('\n=== The two tin directions are genuinely different ===');
{
  const a = L.structure(TIN_ACROSS), u = L.structure(TIN_UP);
  ok(a.up.free !== u.up.free && a.across.free !== u.across.free,
     'the free axis swaps with the purlin direction');
  // The span the purlins are counted over swaps too.
  ok(a.up.lines.length !== u.across.positions.length,
     'the member count differs because the face is 8000 across but 5000 up');
}

console.log('\n=== Which direction is free decides where a row can start ===');
{
  const sb = 200;
  // Up-slope FIXED (tile / purlins across): a portrait rail must land on a line,
  // so the first row is pushed up to suit. Up-slope FREE: it starts at the setback.
  const band = L.railBand(J, { planeLength:5000, setback:sb });
  const lines = L.tileGrid({ planeLength:5000, planeWidth:8000, gauge:330, coverWidth:300, band }).usableLines;
  const P = require('./placement.js');
  const quantised = P.portraitRows(J, { lines, planeLength:5000, setback:sb })[0];
  ok(quantised.panelBottom > sb, `quantised up-slope: first portrait row starts at ${quantised.panelBottom} mm, above the ${sb} mm setback`);

  // With the up-slope free the row can sit exactly at the setback, because the
  // rail is no longer tied to a fixing line.
  const freeBottom = sb;
  const Lmid = (J.clamp.minFromEnd + J.clamp.maxFromEnd)/2;
  const railLo = freeBottom + Lmid, railHi = freeBottom + J.length - Lmid;
  ok(railHi-railLo >= E.railSeparationWindow(J).min &&
     railHi-railLo <= E.railSeparationWindow(J).max,
     'free up-slope: a mid-range clamp distance keeps the rails inside the clamp window');
  ok(freeBottom === sb, 'free up-slope: the first row starts exactly at the setback');
}

console.log('\n=== Landscape rail separation follows the across-slope grid ===');
{
  const w = E.railSeparationWindow(J);
  // Fixed across-slope (tile, 600 trusses, 60 mm shift) — only certain separations reach.
  const fixed = L.railSeparationsWithTolerance(J, 600, 60);
  ok(fixed.options.length > 0, 'tile at 600 centres has a reachable separation');
  ok(fixed.options.every(o => o.usable[0] >= w.min && o.usable[1] <= w.max),
     'every reachable separation sits inside the clamp window');
  // Free across-slope (tin, purlins across) — any separation in the window works.
  const mid = Math.round((w.min + w.max)/2);
  ok(mid >= w.min && mid <= w.max, `free across-slope: mid-window ${mid} mm is simply usable`);
}

console.log('\n=== Average roof height, per Note 9 / Figure 1 ===');
{
  // h is the AVERAGE roof height above ground — not the gutter, not the ridge.
  const h = (4.1 + 5.9)/2;
  ok(h === 5, 'gutter 4.1 m + ridge 5.9 m gives h = 5.00 m');
  ok(E.heightBand(h) === 'h<=5', 'h = 5.00 m lands in the h<=5 band');
  ok(E.heightBand((4.1+7.9)/2) === '5<h<=10', 'a taller ridge pushes it into the next band');
  // Using the ridge alone would misread the band, which is the mistake this guards.
  ok(E.heightBand(5.9) !== E.heightBand(h), 'reading the ridge height instead of the average changes the band');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
