/* Amp Me Up Electrical — Solar flush-mount layout engine
 *
 * Turns engineered rail spacings (Gamcorp certifications) plus real roof
 * structure spacings into compliant foot positions.
 *
 * Two certifications, deliberately kept as separate rule sets:
 *   tin / tile : MA PRO Rail,  AS/NZS 1170.2:2021, regions A B1 B2 C D
 *   kliplok    : MA Rail,      AS/NZS 1170.2:2011, regions A B C D  (EXPIRED 05/07/2023)
 */

const CERTS = {
  tin: {
    id: 'gamcorp-14022-MAPRO-2023',
    rail: 'MA PRO Rail',
    standard: 'AS/NZS 1170.2:2021',
    regions: ['A', 'B1', 'B2', 'C', 'D'],
    validUntil: '2027-11-30',
    // Fig 2, tin/tile sheet
    zoneA: ({ b, d, h }) =>
      (h / b >= 0.2 || h / d >= 0.2) ? Math.min(0.2 * b, 0.2 * d) : 2 * h,
  },
  tile: {
    id: 'gamcorp-14022-MAPRO-2023',
    rail: 'MA PRO Rail',
    standard: 'AS/NZS 1170.2:2021',
    regions: ['A', 'B1', 'B2', 'C', 'D'],
    validUntil: '2027-11-30',
    zoneA: ({ b, d, h }) =>
      (h / b >= 0.2 || h / d >= 0.2) ? Math.min(0.2 * b, 0.2 * d) : 2 * h,
  },
  // PARKED 2026-09-10 — Logan: rib pitch varies by roof and by profile, and it is
  // an uncommon roof. Tables stay loaded and the engine works; the app just does
  // not offer it until a rib pitch can be supplied per job.
  kliplok: {
    parked: true,
    parkedReason: 'full-rib pitch varies per roof/profile and has not been supplied',
    id: 'gamcorp-9981-03-01-KlipLok-2021',
    rail: 'MA Rail',
    standard: 'AS/NZS 1170.2:2011(R2016)',
    regions: ['A', 'B', 'C', 'D'],
    validUntil: '2023-07-05',          // EXPIRED — banner every output
    zoneA: ({ b, d, h }) => Math.min(0.2 * b, 0.2 * d, h),
  },
};

// AS/NZS 1170.2:2021 split region B into B1/B2. The Klip-Lok cert predates that,
// so B1 and B2 both read against the 2011 region B.
function mapRegion(roof, region) {
  if (roof === 'kliplok' && (region === 'B1' || region === 'B2')) return 'B';
  return region;
}

function heightBand(h) {
  if (h <= 5) return 'h<=5';
  if (h <= 10) return '5<h<=10';
  if (h <= 15) return '10<h<=15';
  if (h <= 20) return '15<h<=20';
  return null;                          // >20m is outside every certification
}

/* Derates — Note 2. Tin is punishing, tile is mostly neutral, Klip-Lok has none
 * (its clamp grips the rib, so purlin gauge never enters the fixing capacity). */
const DERATES = {
  tin: {
    'steel-0.55': () => 0.27,
    'steel-0.75': () => 0.36,
    'steel-1.2': () => 0.70,
    'steel-1.5': () => 0.79,
    'steel-1.9+': () => 1.00,
    'timber-20': (r) => (r === 'C' || r === 'D' ? 0.79 : 0.63),
    'timber-35+': () => 1.00,
  },
  tile: {
    'steel-0.55': (r) => (r === 'C' || r === 'D' ? 0.53 : 0.66),
    'steel-0.75': (r) => (r === 'C' || r === 'D' ? 0.72 : 0.90),
    'steel-1.2': () => 1.00,
    'steel-1.5': () => 1.00,
    'steel-1.9+': () => 1.00,
    'timber-20': () => 1.00,
    'timber-35+': () => 1.00,
  },
  kliplok: { 'full-rib-over-purlin': () => 1.00 },
};

const ZONES = ['corner', 'edge', 'intermediate', 'internal'];

/** Roof types the app offers. Klip-Lok is parked — see CERTS.kliplok. */
const ACTIVE_ROOFS = Object.keys(CERTS).filter(k => !CERTS[k].parked);

/* ---------- spacing lookup ---------- */

function lookupBlock(tables, { roof, panel, terrainCategory }) {
  const t = tables.find(x =>
    x.roof === roof && x.panel === panel && x.terrain_category === terrainCategory);
  if (!t) throw new Error(`No table for ${roof} / ${panel} / TC${terrainCategory}`);
  return t;
}

/**
 * Maximum permitted interface (foot) spacing for one zone, in mm.
 * Returns { mm, notes[] } — mm === null means NOT SUITABLE FOR INSTALLATION.
 */
function maxSpacing(tables, job, zone) {
  const { roof, panel, terrainCategory, region, h, d, fixing } = job;
  const notes = [];
  const cert = CERTS[roof];
  const reg = mapRegion(roof, region);
  const band = heightBand(h);
  if (!band) return { mm: null, notes: [`Building height ${h}m exceeds the 20m certification limit.`] };

  const table = lookupBlock(tables, { roof, panel, terrainCategory });
  const lo = table.data['h/d<=0.5'][reg];
  const hi = table.data['h/d>=1.0'][reg];
  if (!lo || !hi) return { mm: null, notes: [`Wind region ${reg} is not in this certification.`] };

  const vLo = lo[band][zone];
  const vHi = hi[band][zone];

  // h/d interpolation (both certs: "for intermediate values of h/d, linear interpolation")
  const ratio = h / d;
  let base;
  if (ratio <= 0.5) base = vLo;
  else if (ratio >= 1.0) base = vHi;
  else if (vLo === null || vHi === null) {
    // One bound is "not suitable" — cannot interpolate into or out of that.
    base = null;
    notes.push(`h/d = ${ratio.toFixed(2)} falls between tabulated ratios and one bound is "--" (not suitable); taking the conservative result.`);
  } else {
    const f = (ratio - 0.5) / 0.5;
    base = vLo + (vHi - vLo) * f;
    notes.push(`h/d = ${ratio.toFixed(2)} → interpolated between ${vLo} and ${vHi} mm.`);
  }
  if (base === null) return { mm: null, notes };

  // Derate for the actual fixing condition (Note 2)
  const table_d = DERATES[roof] || {};
  const fn = table_d[fixing];
  if (!fn) throw new Error(`Unknown fixing condition "${fixing}" for ${roof}`);
  const factor = fn(reg);
  let mm = base * factor;
  if (factor !== 1) notes.push(`Fixing "${fixing}" derates to ${Math.round(factor * 100)}% → ${Math.round(mm)} mm.`);

  // Note 2 footnote: spacing shall not be less than one third of the panel width.
  const panelWidth = panelDims(panel).width;
  const floor = panelWidth / 3;
  let belowFloor = false;
  if (mm < floor) {
    belowFloor = true;
    notes.push(`Derated spacing ${Math.round(mm)} mm is below one third of panel width (${Math.round(floor)} mm) — outside the certification, refer to the engineer.`);
  }

  return { mm: Math.floor(mm), notes, belowFloor, cert: cert.id, regionUsed: reg, band };
}

function panelDims(panel) {
  const m = panel.match(/^([\d.]+)m[x×]([\d.]+)m$/);
  return { length: Math.round(parseFloat(m[1]) * 1000), width: Math.round(parseFloat(m[2]) * 1000) };
}

/* ---------- roof zone map ---------- */

/**
 * Zones across one rectangular roof plane, as bands measured in from each
 * relevant edge. `a` per the governing certification; Edge = outer a/2,
 * Intermediate = next a/2, Internal = the remainder. Corner = within the outer
 * a/2 of BOTH directions.
 *
 * On pitch >= 10 deg the ridge is treated as an edge as well (Fig 2), so a plane
 * running gutter-to-ridge carries bands at both the bottom and top.
 */
function zoneMap(job) {
  const { roof, b, d, h, pitch, planeWidth, planeLength, ridgeAtTop = true } = job;
  const a = CERTS[roof].zoneA({ b, d, h });
  const half = a / 2;
  const ridgeIsEdge = pitch >= 10;

  return {
    a,
    half,
    ridgeIsEdge,
    /** zone at a point on the plane; x across the slope, y up from the gutter */
    at(x, y) {
      const dx = Math.min(x, planeWidth - x);                 // distance to nearest raking edge
      let dy = y;                                             // distance to gutter
      if (ridgeIsEdge && ridgeAtTop) dy = Math.min(y, planeLength - y);
      const bandOf = (dist) => (dist < half ? 0 : dist < a ? 1 : 2);
      const bx = bandOf(dx), by = bandOf(dy);
      if (bx === 0 && by === 0) return 'corner';
      const worst = Math.min(bx, by);
      return worst === 0 ? 'edge' : worst === 1 ? 'intermediate' : 'internal';
    },
  };
}

/* ---------- foot solver ---------- */

/**
 * Place feet along one rail run.
 *
 * mode 'quantised': feet may only land on structure (trusses/rafters/purlins, or
 *   Klip-Lok full ribs over purlins) at `pitch`, first member at `offset`.
 *   This is the case that bites — two truss bays may overshoot the zone maximum,
 *   forcing every truss.
 * mode 'free': the rail runs along a continuous member, so a foot can go anywhere.
 *
 * `maxAt(pos)` returns the permitted spacing at a position; a span must satisfy
 * the tightest zone it crosses, not just its endpoints.
 */
function solveFeet({ mode, start, end, pitch, offset = 0, maxAt, sampleStep = 25,
                    members: explicitMembers = null }) {
  const notes = [];

  // tightest permitted spacing anywhere in [p, q]
  const limitOver = (p, q) => {
    let lim = Infinity;
    for (let s = p; s <= q; s += sampleStep) lim = Math.min(lim, maxAt(s) ?? -Infinity);
    return Math.min(lim, maxAt(q) ?? -Infinity);
  };

  if (mode === 'free') {
    const feet = [start];
    let cur = start;
    let guard = 0;
    while (cur < end && guard++ < 5000) {
      const lim = maxAt(cur);
      if (lim === null || lim <= 0) return { ok: false, feet, notes: [`Not suitable for installation at ${Math.round(cur)} mm along the run.`] };
      // step to the limit, but never past the end
      let next = Math.min(cur + lim, end);
      // honour the tightest zone crossed
      while (next > cur && limitOver(cur, next) < next - cur) next -= sampleStep;
      if (next <= cur) return { ok: false, feet, notes: [`Cannot advance past ${Math.round(cur)} mm.`] };
      feet.push(next);
      cur = next;
    }
    return { ok: true, feet, notes };
  }

  // quantised — either a uniform pitch, or an explicit list of candidate positions
  // (used when two grids intersect, e.g. truss lines AND tile troughs).
  let members = [];
  if (Array.isArray(explicitMembers)) {
    members = explicitMembers.filter(p => p >= start - 1e-6 && p <= end + 1e-6).sort((a, b) => a - b);
  } else {
    for (let p = offset; p <= end + 1e-6; p += pitch) if (p >= start - 1e-6) members.push(p);
  }
  if (!members.length) return { ok: false, feet: [], notes: ['No usable fixing position falls within this rail run.'] };

  const feet = [members[0]];
  let i = 0;
  while (members[i] < end) {
    const cur = members[i];
    let chosen = -1;
    // furthest member still inside the tightest limit across the span
    for (let j = members.length - 1; j > i; j--) {
      const span = members[j] - cur;
      const lim = limitOver(cur, members[j]);
      if (lim > 0 && span <= lim) { chosen = j; break; }
    }
    if (chosen === -1) {
      const nextGap = members[i + 1] !== undefined ? members[i + 1] - cur : null;
      const lim = maxAt(cur);
      return {
        ok: false,
        feet,
        notes: [nextGap === null
          ? `Run ends at ${Math.round(cur)} mm with no further member.`
          : `Available fixing positions cannot meet the ${lim} mm maximum at ${Math.round(cur)} mm along the run — the next usable position is ${nextGap} mm away. Additional blocking/noggin required.`],
      };
    }
    feet.push(members[chosen]);
    i = chosen;
    if (members[chosen] >= end) break;
  }

  const spans = feet.slice(1).map((f, k) => Math.round(f - feet[k]));
  notes.push(`${feet.length} feet, spans: ${spans.join(', ')} mm`);
  return { ok: true, feet, spans, notes };
}


/* ---------- panels ---------- */

/** Panel sizes the Gamcorp certifications actually cover, [length, width] mm. */
const CERTIFIED_SIZES = [
  [1670, 1000], [1970, 1000], [2100, 1050], [2200, 1200], [2400, 1200],
];
const SIZE_KEY = { '1670x1000': '1.67mx1m', '1970x1000': '1.97mx1m',
  '2100x1050': '2.1mx1.05m', '2200x1200': '2.2mx1.2m', '2400x1200': '2.4mx1.2m' };

/**
 * Which certified panel size governs a real panel.
 *
 * Nothing may be read off a table for a size the engineer did not certify, so a
 * panel that is not an exact match is run against the smallest certified size
 * that is at least as large in BOTH dimensions. Larger panel = more tributary
 * area per foot = tighter spacing, so this errs the safe way.
 */
function certifiedEnvelope(panel) {
  const exact = CERTIFIED_SIZES.find(c => c[0] === panel.length && c[1] === panel.width);
  if (exact) return { key: SIZE_KEY[exact.join('x')], exact: true, substituted: false, notes: [] };

  const bigger = CERTIFIED_SIZES
    .filter(c => c[0] >= panel.length && c[1] >= panel.width)
    .sort((a, b) => a[0] * a[1] - b[0] * b[1])[0];

  if (!bigger) {
    return { key: null, exact: false, substituted: false, notes: [
      `${panel.length}x${panel.width} mm exceeds every certified panel size. Outside the certification — refer to the engineer.`] };
  }
  return {
    key: SIZE_KEY[bigger.join('x')], exact: false, substituted: true,
    notes: [`${panel.model} is ${panel.length}x${panel.width} mm, which is not a certified panel size. Read against the next-larger certified size ${bigger[0]}x${bigger[1]} mm (conservative).`],
  };
}

/** Cert condition: PV panel + array frame must not exceed 15 kg/m2. */
function checkPanelWeight(panel) {
  const areaM2 = (panel.length / 1000) * (panel.width / 1000);
  const kgm2 = panel.weightKg / areaM2;
  return { kgm2: +kgm2.toFixed(2), ok: kgm2 <= 15, limit: 15 };
}

/**
 * Permitted centre-to-centre distance between the two rails, from the panel
 * manufacturer's clamp zone. Both clamps sit `minFromEnd..maxFromEnd` in from
 * the short edges, so the rails may sit anywhere in this window.
 */
function railSeparationWindow(panel, tolPct = 0) {
  // A tolerance widens the clamp window, and therefore the rail separations the
  // roof can offer. tolPct is a percentage of panel length; 0 is the manual.
  const t = tolPct / 100 * panel.length;
  const minFromEnd = Math.max(0, panel.clamp.minFromEnd - t);
  const maxFromEnd = Math.min(panel.length / 2, panel.clamp.maxFromEnd + t);
  return {
    min: panel.length - 2 * maxFromEnd,
    max: panel.length - 2 * minFromEnd,
    fromEnd: [minFromEnd, maxFromEnd],
    tolPct, tolMm: t,
    spec: [panel.clamp.minFromEnd, panel.clamp.maxFromEnd],
  };
}

/**
 * Can two rails land on the roof's structure lines AND stay inside the clamp
 * zone? `linePitch` is the tile course / screw line / rib pitch across the slope.
 * Returns every workable whole-line separation.
 */
function railLineOptions(panel, linePitch, lineOffset = 0) {
  const w = railSeparationWindow(panel);
  const options = [];
  for (let k = 1; k * linePitch <= w.max; k++) {
    const sep = k * linePitch;
    if (sep >= w.min) {
      const fromEnd = (panel.length - sep) / 2;
      options.push({ lines: k, separation: sep, fromEndIfCentred: Math.round(fromEnd) });
    }
  }
  return { window: w, options };
}

module.exports = {
  CERTS, DERATES, ZONES, ACTIVE_ROOFS, mapRegion, heightBand, panelDims,
  maxSpacing, zoneMap, solveFeet,
  CERTIFIED_SIZES, certifiedEnvelope, checkPanelWeight,
  railSeparationWindow, railLineOptions,
};
