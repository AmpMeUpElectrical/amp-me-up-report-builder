/* Amp Me Up Electrical — roof face as an arbitrary polygon with typed edges
 *
 * A cut-up roof does not give you rectangles. Faces get sliced by valleys,
 * hips and returns, so a face here is any closed polygon whose edges each know
 * what they are.
 *
 * Edge types and what they mean:
 *
 *   gutter   eave line. Always a wind edge. Setback plus the rail sag allowance.
 *   ridge    a wind edge once the pitch reaches 10 deg (certification Figure 2).
 *   hip      a wind edge — it is a perimeter edge of the building and flow
 *            separates over it.
 *   gable    the raking edge at a gable/barge. A wind edge.
 *   valley   NOT a wind edge. Two planes meet at an internal angle; flow does
 *            not separate there. It still takes a setback, for water flow and
 *            access — Logan's call, 200 mm, same as anywhere else.
 *
 * Coordinates: x across the face, y up the slope from the gutter. All mm.
 */

const WIND_EDGES = new Set(['gutter', 'ridge', 'hip', 'gable']);

/** Is this edge one the wind zone bands are measured from? */
function isWindEdge(type, pitch) {
  if (type === 'ridge') return pitch >= 10;     // Figure 2: ridge counts at 10 deg and over
  return WIND_EDGES.has(type);
}

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a, b) => a.x * b.y - a.y * b.x;
const len = (a) => Math.hypot(a.x, a.y);

/** Perpendicular distance from a point to a SEGMENT (not the infinite line). */
function distToSegment(A, B, x, y) {
  const vx = B.x - A.x, vy = B.y - A.y;
  const L2 = vx * vx + vy * vy;
  if (L2 === 0) return Math.hypot(x - A.x, y - A.y);
  let t = ((x - A.x) * vx + (y - A.y) * vy) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (A.x + t * vx), y - (A.y + t * vy));
}

/** Angle of a segment, folded to [0, 180) so opposite directions match. */
function edgeAngle(A, B) {
  let a = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI;
  a = ((a % 180) + 180) % 180;
  return a;
}

/** Smallest angle between two edge directions, 0..90. */
function angleBetween(a, b) {
  let d = Math.abs(a - b) % 180;
  return d > 90 ? 180 - d : d;
}

/**
 * Build a face.
 *
 * `points` are the corners in order (either winding). `edgeTypes[i]` is the type
 * of the edge from points[i] to points[i+1], wrapping at the end.
 */
function polyFace({ points, edgeTypes, pitch = 22 }) {
  const n = points.length;
  if (n < 3) throw new Error('A face needs at least three corners.');
  if (edgeTypes.length !== n) throw new Error('One edge type per corner is required.');

  const edges = points.map((p, i) => {
    const q = points[(i + 1) % n];
    return { i, A: p, B: q, type: edgeTypes[i],
             wind: isWindEdge(edgeTypes[i], pitch),
             angle: edgeAngle(p, q), length: len(sub(q, p)) };
  }).filter(e => e.length > 1e-6);

  // Signed area tells us the winding, which fixes which side is "inward".
  let area2 = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i], q = points[(i + 1) % n];
    area2 += p.x * q.y - q.x * p.y;
  }
  const ccw = area2 > 0;

  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const bounds = { minX: Math.min(...xs), maxX: Math.max(...xs),
                   minY: Math.min(...ys), maxY: Math.max(...ys) };

  const face = {
    points, edges, pitch, ccw,
    area: Math.abs(area2) / 2,
    bounds,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,

    contains(x, y) {
      // Ray casting, with points on the boundary counted as inside.
      for (const e of edges) if (distToSegment(e.A, e.B, x, y) < 1e-7) return true;
      let inside = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const pi = points[i], pj = points[j];
        if ((pi.y > y) !== (pj.y > y)) {
          const xx = pi.x + (y - pi.y) / (pj.y - pi.y) * (pj.x - pi.x);
          if (x < xx) inside = !inside;
        }
      }
      return inside;
    },

    /** Distance to the nearest edge of each kind. */
    distances(x, y) {
      let nearestWind = Infinity, nearestAny = Infinity;
      const perEdge = [];
      for (const e of edges) {
        const d = distToSegment(e.A, e.B, x, y);
        perEdge.push({ type: e.type, d, wind: e.wind, angle: e.angle });
        if (d < nearestAny) nearestAny = d;
        if (e.wind && d < nearestWind) nearestWind = d;
      }
      return { nearestWind, nearestAny, perEdge };
    },

    /**
     * Is this point clear of every edge by that edge's setback?
     * `setbackFor(type)` returns the required clearance for an edge type — the
     * gutter carries the sag allowance, a valley carries the water clearance.
     */
    clearOfEdges(x, y, setbackFor) {
      if (!this.contains(x, y)) return false;
      for (const e of edges) {
        if (distToSegment(e.A, e.B, x, y) < setbackFor(e.type) - 1e-6) return false;
      }
      return true;
    },

    /**
     * The usable spans across the face at height y, after setbacks.
     *
     * Exact rather than sampled: candidate boundaries come from where the line
     * meets each edge and each edge's inward offset, then each interval between
     * them is tested at its midpoint.
     */
    spansAt(y, setbackFor) {
      const cands = new Set([bounds.minX - 1, bounds.maxX + 1]);
      for (const e of edges) {
        const sb = setbackFor(e.type);
        const dx = e.B.x - e.A.x, dy = e.B.y - e.A.y;
        if (Math.abs(dy) > 1e-9) {
          const t = (y - e.A.y) / dy;
          if (t >= -0.001 && t <= 1.001) cands.add(e.A.x + t * dx);
        }
        // Where the offset of this edge crosses the line y, both sides.
        const L = Math.hypot(dx, dy);
        if (L > 1e-9) {
          const nx = -dy / L, ny = dx / L;      // unit normal
          for (const s of [1, -1]) {
            const ox = s * nx * sb, oy = s * ny * sb;
            const ay = e.A.y + oy, by = e.B.y + oy;
            if (Math.abs(by - ay) > 1e-9) {
              const t = (y - ay) / (by - ay);
              if (t >= -0.5 && t <= 1.5) cands.add(e.A.x + ox + t * dx);
            }
          }
        }
      }
      const sorted = [...cands].sort((a, b) => a - b);
      const spans = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const lo = sorted[i], hi = sorted[i + 1];
        if (hi - lo < 0.5) continue;
        if (this.clearOfEdges((lo + hi) / 2, y, setbackFor)) {
          const last = spans[spans.length - 1];
          if (last && Math.abs(last.max - lo) < 0.5) last.max = hi;      // merge
          else spans.push({ min: lo, max: hi });
        }
      }
      return spans.map(s => ({ ...s, width: s.max - s.min }));
    },

    /** The widest span common to a whole row — its narrowest point governs. */
    bandOver(y0, y1, setbackFor, steps = 12) {
      let best = null;
      const at = [];
      for (let k = 0; k <= steps; k++) at.push(y0 + (y1 - y0) * k / steps);
      // Take the spans at the bottom, then trim by every other height.
      let running = this.spansAt(at[0], setbackFor);
      for (let k = 1; k < at.length; k++) {
        const here = this.spansAt(at[k], setbackFor);
        const next = [];
        for (const a of running) for (const b of here) {
          const min = Math.max(a.min, b.min), max = Math.min(a.max, b.max);
          if (max - min > 0.5) next.push({ min, max, width: max - min });
        }
        running = next;
        if (!running.length) break;
      }
      for (const s of running) if (!best || s.width > best.width) best = s;
      return best || { min: 0, max: 0, width: 0 };
    },

    polygon() { return points; },
  };
  return face;
}

/**
 * Zones on a polygon face.
 *
 * `a` still comes from the building's plan dimensions. A point is in the corner
 * zone when it is within a/2 of TWO wind edges that actually turn a corner —
 * two parallel edges of a narrow face do not make a corner. Valleys are not
 * wind edges, so a panel may sit closer to a valley than to a hip; it still has
 * to clear the valley setback for water.
 */
function zoneMapPoly(job, face) {
  const b = job.b * 1000, d = job.d * 1000, h = job.h * 1000;
  const a = (h / b >= 0.2 || h / d >= 0.2) ? Math.min(0.2 * b, 0.2 * d) : 2 * h;
  const half = a / 2;

  return {
    a, half,
    at(x, y) {
      const wind = face.edges.filter(e => e.wind)
        .map(e => ({ d: distToSegment(e.A, e.B, x, y), angle: e.angle }))
        .sort((p, q) => p.d - q.d);
      if (!wind.length) return 'internal';           // a face with no wind edge at all
      const nearest = wind[0].d;
      // Corner: inside a/2 of two wind edges that genuinely turn.
      let corner = false;
      if (nearest < half) {
        for (let i = 1; i < wind.length; i++) {
          if (wind[i].d >= half) break;
          if (angleBetween(wind[0].angle, wind[i].angle) > 30) { corner = true; break; }
        }
      }
      if (corner) return 'corner';
      if (nearest < half) return 'edge';
      if (nearest < a) return 'intermediate';
      return 'internal';
    },
  };
}

module.exports = { polyFace, zoneMapPoly, isWindEdge, distToSegment, angleBetween, WIND_EDGES };
