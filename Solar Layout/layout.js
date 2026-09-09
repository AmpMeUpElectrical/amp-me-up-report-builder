/* Amp Me Up Electrical — orientation, tile grid and row packing
 *
 * Sits on top of engine.js. Deals with what physically fits on the roof face,
 * given that the compliance engine has already said what spacings are legal.
 */

const E = require('./engine.js');

/* A standard tile interface hook has 120 mm between its furthest screw holes,
 * so the hook body — and therefore the rail bearing point — can sit up to 60 mm
 * either side of the truss centreline. This is a hard physical limit. */
const HOOK_SLOT_SPAN = 120;
const HOOK_MAX_OFFSET = HOOK_SLOT_SPAN / 2;   // 60 mm

/* No panel edge closer than 200 mm to the gutter line or any roof edge.
 * The certification separately forbids a panel within 2s of an edge or the ridge
 * (s = 50-300 mm panel underside gap), so the governing setback is the larger. */
const EDGE_SETBACK_MIN = 200;

const ROW_GAP = 20;          // mm between rows, Amp Me Up standard (>= AIKO's 10mm min)
const PANEL_GAP = 20;        // mm between panels within a row

/* ---------- orientation ---------- */

/**
 * Both panels in the library clamp on the LONG side with rails parallel to the
 * SHORT side. That fixes rail direction to the panel, so choosing orientation
 * also chooses which way the rails run — and therefore which structural member
 * the feet land on.
 *
 *   portrait  : long axis up-slope  -> rails run horizontally (across-slope),
 *               the two rails separated UP-SLOPE
 *   landscape : long axis across    -> rails run UP-SLOPE,
 *               the two rails separated ACROSS-SLOPE
 */
function orientation(panel, o) {
  if (o !== 'portrait' && o !== 'landscape') throw new Error(`bad orientation ${o}`);
  const portrait = o === 'portrait';
  return {
    orientation: o,
    upSlope: portrait ? panel.length : panel.width,
    acrossSlope: portrait ? panel.width : panel.length,
    railRun: portrait ? 'across-slope' : 'up-slope',
    // Clamps are on the long side either way, so separation is always measured
    // along the panel's long axis — but that axis points a different way.
    separationAxis: portrait ? 'up-slope' : 'across-slope',
    separation: E.railSeparationWindow(panel),
  };
}

/* ---------- tile grid ---------- */

/**
 * The tile courses on one roof face.
 *
 * `gauge` is the exposed length of each tile — the up-slope distance from one
 * row of tiles to the next. Measured on the roof.
 *
 * The top course cannot take a tile interface: the ridge cap is bedded over it
 * and the tile cannot be lifted. That is the ONLY exclusion applied here.
 *
 * Orientation-specific exclusions are NOT applied here. A course too low for a
 * portrait rail is still perfectly usable for a hook on an up-slope landscape
 * rail, because in landscape the panel position does not follow the rail.
 * Pass `band` only when laying out portrait.
 *
 * NOTE ON WIDTH: `planeWidth` must be measured capping edge to capping edge, and
 * `tilesPerCourse` is informational only. Do not derive the width by counting
 * tiles — the first tile often overlaps a large part of the edge capping, and
 * the 200 mm setback runs from the capping edge, not from the first full tile.
 */
function tileGrid({ planeLength, planeWidth, gauge, coverWidth,
                    excludeTopCourses = 1, excludeBottomCourses = 0, band = null }) {
  const courses = Math.floor(planeLength / gauge);
  const tilesPerCourse = Math.floor(planeWidth / coverWidth);

  const hookLines = [];
  for (let n = 1; n <= courses; n++) {
    const y = n * gauge;
    const blockedTop = n > courses - excludeTopCourses;
    const blockedBottom = n <= excludeBottomCourses;
    const belowBand = band && y < band.minY;
    const aboveBand = band && y > band.maxY;
    hookLines.push({
      course: n, y,
      usable: !blockedTop && !blockedBottom && !belowBand && !aboveBand,
      reason: blockedTop ? 'top course — ridge cap prevents lifting the tile'
            : blockedBottom ? 'bottom course excluded'
            : belowBand ? `too low — ${band.reason}`
            : aboveBand ? `too high — ${band.reason}`
            : null,
    });
  }
  return {
    gauge, coverWidth, courses, tilesPerCourse,
    tilesOnFace: courses * tilesPerCourse,
    tilesPerCourseIsApproximate: true,   // edge tiles overlap the capping
    hookLines,
    usableLines: hookLines.filter(l => l.usable),
    highestUsableY: Math.max(...hookLines.filter(l => l.usable).map(l => l.y)),
  };
}

/* ---------- setbacks ---------- */

/** Governing edge setback: the 200 mm site rule vs the certification's 2s rule. */
function edgeSetback({ panelGapS = 50 }) {
  const twoS = 2 * panelGapS;
  return {
    mm: Math.max(EDGE_SETBACK_MIN, twoS),
    governedBy: twoS > EDGE_SETBACK_MIN ? `certification 2s (s = ${panelGapS} mm)` : '200 mm edge rule',
    twoS, siteRule: EDGE_SETBACK_MIN,
  };
}

/**
 * The band of the roof face in which a RAIL may sit.
 *
 * A rail is never at the panel's edge — the clamp zone puts the panel edge a
 * further `minFromEnd` beyond it. So the lowest legal rail is the setback PLUS
 * that overhang. This is why the bottom tile course is unusable in practice:
 * a rail down there would push the panel edge inside the 200 mm setback.
 */
function railBand(panel, { planeLength, setback }) {
  const over = panel.clamp.minFromEnd;          // smallest possible panel overhang past a rail
  return {
    minY: setback + over,
    maxY: planeLength - setback - over,
    overhang: over,
    reason: `a rail must clear the ${setback} mm setback plus the ${over} mm minimum panel overhang past the clamp`,
  };
}

/**
 * Can this roof face hold a panel at all?
 *
 * Two rails must both sit inside the rail band AND be separated by a distance
 * the clamp zone allows. A face can have usable courses and still be too short
 * for a single panel.
 */
function canFitRailPair(panel, band) {
  const sep = require('./engine.js').railSeparationWindow(panel);
  const bandWidth = band.maxY - band.minY;
  const ok = bandWidth >= sep.min;
  return {
    ok, bandWidth: Math.round(bandWidth), needed: sep.min,
    shortBy: ok ? 0 : Math.round(sep.min - bandWidth),
    reason: ok ? null
      : `the rail band is only ${Math.round(bandWidth)} mm deep but the two rails must be at least ${sep.min} mm apart — ${Math.round(sep.min - bandWidth)} mm short`,
  };
}

/* ---------- row packing ---------- */

/**
 * How many panels fit across one row, and how much up-slope depth it costs.
 */
function rowSpec(panel, o, usableWidth) {
  const g = orientation(panel, o);
  const perRow = Math.floor((usableWidth + PANEL_GAP) / (g.acrossSlope + PANEL_GAP));
  return {
    orientation: o, panels: Math.max(0, perRow),
    depth: g.upSlope, acrossSlope: g.acrossSlope,
    widthUsed: perRow > 0 ? perRow * g.acrossSlope + (perRow - 1) * PANEL_GAP : 0,
    railRun: g.railRun, separationAxis: g.separationAxis,
  };
}

/**
 * Best mix of portrait and landscape rows for maximum panel count.
 *
 * Unbounded knapsack over up-slope depth: each row type costs its own depth
 * plus a ROW_GAP for every row after the first, and yields its panel count.
 * `allowed` lets the caller drop an orientation that the roof cannot support
 * (e.g. landscape on tile, where the rails would have to sit on truss lines).
 */
function packRows(panel, { usableLength, usableWidth, allowed = ['portrait', 'landscape'] }) {
  const specs = allowed.map(o => rowSpec(panel, o, usableWidth)).filter(s => s.panels > 0);
  if (!specs.length) return { rows: [], panels: 0, note: 'No orientation fits the available width.' };

  const STEP = 1;
  const N = Math.floor(usableLength / STEP);
  // best[d] = { panels, rows[] } using depth <= d
  const best = new Array(N + 1).fill(null).map(() => ({ panels: 0, rows: [] }));

  for (let d = 0; d <= N; d++) {
    for (const s of specs) {
      // adding this row to an empty stack costs depth; to a non-empty one, +gap
      for (const fromEmpty of [true, false]) {
        const cost = s.depth + (fromEmpty ? 0 : ROW_GAP);
        const prev = d - cost;
        if (prev < 0) continue;
        const base = best[prev];
        if (fromEmpty && base.rows.length !== 0) continue;
        if (!fromEmpty && base.rows.length === 0) continue;
        const cand = base.panels + s.panels;
        if (cand > best[d].panels) best[d] = { panels: cand, rows: [...base.rows, s] };
      }
    }
    if (d > 0 && best[d - 1].panels > best[d].panels) best[d] = best[d - 1];
  }

  const result = best[N];
  const depthUsed = result.rows.reduce((a, r) => a + r.depth, 0)
                  + Math.max(0, result.rows.length - 1) * ROW_GAP;
  return {
    rows: result.rows, panels: result.panels, depthUsed,
    depthSpare: usableLength - depthUsed,
    mixed: new Set(result.rows.map(r => r.orientation)).size > 1,
  };
}


/* ---------- where a tile interface may actually land ---------- */

/**
 * Across-slope positions where a tile interface can be fixed.
 *
 * The hook is ALWAYS screwed to a truss top chord (cert Note 2) — no truss is
 * skipped. On a profiled tile (Malibu and similar) the hook body is then slid
 * along the slotted holes until it sits in a trough rather than on a crown.
 *
 * The consequence that matters: the foot ends up at the TROUGH, not on the
 * truss centreline, so consecutive spans are no longer exactly the truss pitch.
 * Those real spans are what must be checked against the certified maximum.
 */
function interfacePositions({ planeWidth, trussPitch, trussOffset = 0, slide = 0,
                              tile = { profile: 'flat' } }) {
  const trusses = [];
  for (let x = trussOffset; x <= planeWidth + 1e-6; x += trussPitch) if (x >= 0) trusses.push(x);

  if (tile.profile !== 'profiled') {
    const positions = trusses.map(x => ({ x, truss: x, trough: null, shift: 0 }));
    return { positions, trusses, troughs: [], blocked: [], spans: spansOf(positions) };
  }

  const { coverWidth, troughOffset = 0, troughWidth = 0, hookWidth = 0 } = tile;
  const troughPlay = Math.max(0, (troughWidth - hookWidth) / 2);

  const troughs = [];
  for (let x = troughOffset - coverWidth; x <= planeWidth + coverWidth; x += coverWidth) troughs.push(x);

  const positions = [], blocked = [];
  for (const t of trusses) {
    const lo = t - slide, hi = t + slide;
    let best = null;
    for (const g of troughs) {
      const l = Math.max(lo, g - troughPlay), h = Math.min(hi, g + troughPlay);
      if (l > h) continue;
      // Stay on the roof face, then slide as little as possible.
      const l2 = Math.max(l, 0), h2 = Math.min(h, planeWidth);
      if (l2 > h2) continue;
      const x = Math.min(Math.max(t, l2), h2);
      const cand = { x: round1(x), truss: t, trough: g, shift: round1(x - t) };
      if (!best || Math.abs(cand.shift) < Math.abs(best.shift)) best = cand;
    }
    if (best) positions.push(best);
    else {
      // Distinguish the two ways this can fail: the hook can shift left OR right,
      // so "blocked" means neither direction works.
      const reachable = troughs.filter(g =>
        Math.max(t - slide, g - troughPlay) <= Math.min(t + slide, g + troughPlay));
      const nearest = troughs.reduce((a, g) => Math.abs(g - t) < Math.abs(a - t) ? g : a, troughs[0]);
      const shortBy = Math.round(Math.abs(nearest - t) - troughPlay - slide);
      if (reachable.length) {
        // A trough is within reach, but only outside the roof face.
        blocked.push({ truss: t, nearestTrough: nearest, shortBy, offFace: true,
          reason: `truss at ${Math.round(t)} mm — the trough it can reach (${Math.round(reachable[0])} mm) falls outside the roof face` });
      } else {
        blocked.push({ truss: t, nearestTrough: nearest, shortBy, offFace: false,
          reason: `truss at ${Math.round(t)} mm cannot reach a trough in either direction — nearest is ${Math.round(Math.abs(nearest - t))} mm away, ${shortBy} mm beyond the ${slide} mm shift` });
      }
    }
  }
  return { positions, trusses, troughs, blocked, troughPlay, spans: spansOf(positions) };
}

const round1 = (v) => Math.round(v * 10) / 10;

/** Actual centre-to-centre spans between consecutive interfaces. */
function spansOf(positions) {
  const xs = positions.map(p => p.x).sort((a, b) => a - b);
  return xs.slice(1).map((x, i) => round1(x - xs[i]));
}

/**
 * Slide needed so that every truss can always reach a trough, whatever the
 * phase between the truss grid and the tile grid.
 */
function slideRequired(tile) {
  const play = Math.max(0, (tile.troughWidth - tile.hookWidth) / 2);
  return Math.max(0, tile.coverWidth / 2 - play);
}

/**
 * Can EVERY truss reach a trough, given the hook's 60 mm physical limit?
 *
 * Tile geometry is measured per job — every tile run is different — so this is
 * the first thing to check once those measurements are entered. If it fails,
 * some trusses simply cannot take an interface and the spans open up.
 */
function troughReachability(tile, slide = HOOK_MAX_OFFSET) {
  const play = Math.max(0, (tile.troughWidth - tile.hookWidth) / 2);
  const reach = play + slide;               // how far from a trough centre we can be
  const worstCase = tile.coverWidth / 2;    // worst phase between truss and tile grids
  return {
    slide, troughPlay: play, reach, worstCase,
    always: reach >= worstCase,
    shortBy: Math.max(0, Math.round(worstCase - reach)),
    minTroughWidthForAlways: Math.round(2 * (worstCase - slide) + tile.hookWidth),
  };
}

/**
 * Rail separations reachable when each rail may shift `tolerance` mm off its
 * truss line — the landscape-on-tile case.
 */
function railSeparationsWithTolerance(panel, trussPitch, tolerance) {
  const w = require('./engine.js').railSeparationWindow(panel);
  const out = [];
  for (let k = 1; k * trussPitch - 2 * tolerance <= w.max; k++) {
    const lo = k * trussPitch - 2 * tolerance;
    const hi = k * trussPitch + 2 * tolerance;
    const from = Math.max(lo, w.min), to = Math.min(hi, w.max);
    if (from <= to) out.push({ bays: k, nominal: k * trussPitch, usable: [Math.round(from), Math.round(to)] });
  }
  return { window: w, options: out };
}

module.exports = { ROW_GAP, PANEL_GAP, orientation, tileGrid, rowSpec, packRows,
  interfacePositions, railSeparationsWithTolerance, slideRequired, spansOf,
  EDGE_SETBACK_MIN, edgeSetback, railBand, canFitRailPair,
  troughReachability, HOOK_SLOT_SPAN, HOOK_MAX_OFFSET };
