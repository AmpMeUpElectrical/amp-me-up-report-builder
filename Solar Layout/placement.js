/* Amp Me Up Electrical — orientation-aware panel placement
 *
 * The two orientations have OPPOSITE freedoms, which is what decides how far
 * down a roof the first row can start:
 *
 *   PORTRAIT   rails run across-slope, so their up-slope position is quantised
 *              to tile courses / screw lines. The panel edge then sits a further
 *              L beyond each rail (L = the clamp distance). Up-slope placement
 *              is therefore constrained; across-slope placement is free.
 *
 *   LANDSCAPE  rails run up-slope and are continuous, so a panel can be clamped
 *              anywhere along them. Up-slope placement is FREE — the first row
 *              can start exactly at the setback. Across-slope placement is the
 *              constrained one instead (rail x quantised to trusses +/- 60 mm).
 */

const E = require('./engine.js');

/**
 * Feasible portrait rows: both rails on usable lines, clamp distance in range,
 * panel edges inside the setbacks.
 *
 * `lines` are the usable up-slope fixing lines (tile courses / screw lines).
 */
function portraitRows(panel, { lines, planeLength, setback }) {
  const A = panel.length;
  const { minFromEnd: Lmin, maxFromEnd: Lmax } = panel.clamp;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const y1 = lines[i].y ?? lines[i], y2 = lines[j].y ?? lines[j];
      const sep = y2 - y1;
      const L = (A - sep) / 2;                       // symmetric clamping
      if (L < Lmin || L > Lmax) continue;
      const bottom = y1 - L, top = y2 + L;
      if (bottom < setback) continue;
      if (top > planeLength - setback) continue;
      out.push({
        orientation: 'portrait', railY: [y1, y2], separation: sep,
        clampFromEnd: Math.round(L * 10) / 10,
        panelBottom: Math.round(bottom * 10) / 10,
        panelTop: Math.round(top * 10) / 10,
        depth: A,
      });
    }
  }
  return out.sort((a, b) => a.panelBottom - b.panelBottom);
}

/**
 * Feasible landscape rows. The panel slides freely up-slope, so the lowest row
 * sits exactly at the setback. Rails run up-slope past the panel.
 */
function landscapeRows(panel, { planeLength, setback }) {
  const B = panel.width;
  const bottom = setback;
  if (bottom + B > planeLength - setback) return [];
  return [{
    orientation: 'landscape', railY: null, separation: null,
    clampFromEnd: null,                    // clamps sit on the long (horizontal) frames
    panelBottom: bottom, panelTop: bottom + B, depth: B,
    note: 'rails run up-slope and are continuous, so the panel may sit anywhere along them',
  }];
}

/**
 * How far down the roof can the first row of panels start, per orientation?
 * This is the comparison that shows why landscape reaches lower.
 */
function lowestFirstRow(panel, { lines, planeLength, setback }) {
  const p = portraitRows(panel, { lines, planeLength, setback })[0] || null;
  const l = landscapeRows(panel, { planeLength, setback })[0] || null;
  return {
    portrait: p ? { panelBottom: p.panelBottom, lowestRail: p.railY[0], clampFromEnd: p.clampFromEnd } : null,
    landscape: l ? { panelBottom: l.panelBottom, lowestRail: null } : null,
    landscapeGain: p && l ? Math.round((p.panelBottom - l.panelBottom) * 10) / 10 : null,
  };
}

module.exports = { portraitRows, landscapeRows, lowestFirstRow };

/* ---------- across-slope extent ---------- */

/**
 * The usable across-slope band on a roof face.
 *
 * The face is measured CAPPING EDGE TO CAPPING EDGE and the 200 mm setback runs
 * from the capping edge — not from the first full tile. The first tile commonly
 * overlaps a large part of the edge capping, so counting whole tiles would
 * under-measure the face and can cost a panel on a tight roof.
 */
function acrossSlopeBand({ cappingToCapping, setback }) {
  return {
    minX: setback,
    maxX: cappingToCapping - setback,
    usable: cappingToCapping - 2 * setback,
    datum: 'capping edge',
    note: `measured from the capping edge, not the first full tile — the edge tile usually overlaps the capping`,
  };
}

/**
 * Panels across one row, using the measured capping-to-capping width.
 */
function panelsAcross(panel, orientation, { cappingToCapping, setback, panelGap = 20 }) {
  const band = acrossSlopeBand({ cappingToCapping, setback });
  const w = orientation === 'portrait' ? panel.width : panel.length;
  const n = Math.floor((band.usable + panelGap) / (w + panelGap));
  return {
    panels: Math.max(0, n), band,
    widthUsed: n > 0 ? n * w + (n - 1) * panelGap : 0,
    spare: n > 0 ? band.usable - (n * w + (n - 1) * panelGap) : band.usable,
  };
}

module.exports.acrossSlopeBand = acrossSlopeBand;
module.exports.panelsAcross = panelsAcross;
