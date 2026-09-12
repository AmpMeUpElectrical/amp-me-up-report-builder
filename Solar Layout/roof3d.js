/* Amp Me Up Electrical — build a roof from its footprint
 *
 * Measure the footprint from the ground and set the pitch, and the faces fall
 * out of it. That is the one thing 3D genuinely buys you: a face 5000 mm up a
 * 22 deg slope is only 4636 mm across the ground, so measuring from the ground
 * and deriving the slope beats dragging a tape up a roof.
 *
 * THE IDEA
 *
 * Every roof plane is a linear height function of the plan position:
 *
 *     h(x, y) = tan(pitch) * (distance inward from that plane's eave)
 *
 * Within one wing the roof is the MINIMUM of its planes — the lowest plane that
 * still covers the point. Minimum of planes is what produces ridges and hips.
 * Because every plane is linear, "plane i is the minimum" is just a set of
 * linear inequalities, so each face is the footprint clipped by half planes.
 * That is exact and robust, with no special cases.
 *
 * Between two wings the roof is the MAXIMUM — the higher surface wins and the
 * lower one is inside the building. Maximum of planes is what produces valleys.
 * That one is a real polygon boolean rather than half-plane clipping, so it is
 * handled separately; see cutWings().
 *
 * Plan coordinates are metres-free: everything is mm, x east, y north, z up
 * from the eave line.
 */

const EPS = 1e-7;

/* ---------- small vector helpers ---------- */
const V = (x, y) => ({ x, y });
const add = (a, b) => V(a.x + b.x, a.y + b.y);
const sub = (a, b) => V(a.x - b.x, a.y - b.y);
const mul = (a, k) => V(a.x * k, a.y * k);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const nrm = (a) => { const l = Math.hypot(a.x, a.y) || 1; return V(a.x / l, a.y / l); };
const rot = (a, deg) => {
  const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return V(a.x * c - a.y * s, a.x * s + a.y * c);
};

/**
 * A roof plane, as a height function over the plan.
 * `eaveA`/`eaveB` are two points on its eave line; `inward` points up the slope.
 */
function plane({ eaveA, inward, pitchDeg, id, kind, wing }) {
  const t = Math.tan(pitchDeg * Math.PI / 180);
  const n = nrm(inward);
  return {
    id, kind, wing, pitchDeg, eaveA, inward: n, slope: t,
    /** Height above the eave at a plan point. */
    h(p) { return t * dot(sub(p, eaveA), n); },
    /** Gradient of h — constant, since h is linear. */
    grad() { return mul(n, t); },
  };
}

/** Sutherland–Hodgman: clip a convex-or-simple polygon by the half plane f(p) <= 0. */
function clipHalfPlane(poly, f) {
  if (!poly.length) return poly;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length];
    const fa = f(A), fb = f(B);
    const inA = fa <= EPS, inB = fb <= EPS;
    if (inA) out.push(A);
    if (inA !== inB) {
      const t = fa / (fa - fb);
      out.push(V(A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t));
    }
  }
  return dedupe(out);
}

function dedupe(poly) {
  const out = [];
  for (const p of poly) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p.x - q.x, p.y - q.y) > 1e-6) out.push(p);
  }
  if (out.length > 1) {
    const a = out[0], b = out[out.length - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) out.pop();
  }
  return out;
}

function areaOf(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/**
 * One wing: a rectangular footprint with a ridge along its length, and each end
 * either hipped or gabled.
 *
 *   centre  plan centre of the footprint
 *   span    across the ridge (eave to eave)
 *   length  along the ridge
 *   rot     rotation of the ridge from east, degrees
 *   ends    ['hip'|'gable', 'hip'|'gable'] for the low-x and high-x ends
 */
function wingPlanes(wing, index) {
  const { centre, span, length, rot: rotDeg = 0, pitch, ends = ['hip', 'hip'] } = wing;
  const along = rot(V(1, 0), rotDeg);          // ridge direction
  const across = rot(V(0, 1), rotDeg);         // eave to eave

  const at = (u, v) => add(centre, add(mul(along, u), mul(across, v)));
  const hs = span / 2, hl = length / 2;

  const planes = [];
  // The two long faces, rising from each eave toward the ridge.
  planes.push(plane({ eaveA: at(0, -hs), inward: across, pitchDeg: pitch,
                      id: `${index}:side-`, kind: 'side', wing: index }));
  planes.push(plane({ eaveA: at(0, +hs), inward: mul(across, -1), pitchDeg: pitch,
                      id: `${index}:side+`, kind: 'side', wing: index }));
  // A hipped end adds a plane; a gable end does not — the roof just runs out to
  // the gable wall, which is why a gable face is a rectangle and a hipped one
  // is a trapezium.
  if (ends[0] === 'hip')
    planes.push(plane({ eaveA: at(-hl, 0), inward: along, pitchDeg: pitch,
                        id: `${index}:end-`, kind: 'end', wing: index }));
  if (ends[1] === 'hip')
    planes.push(plane({ eaveA: at(+hl, 0), inward: mul(along, -1), pitchDeg: pitch,
                        id: `${index}:end+`, kind: 'end', wing: index }));

  const footprint = [at(-hl, -hs), at(+hl, -hs), at(+hl, +hs), at(-hl, +hs)];
  return { planes, footprint, along, across, ends, wing, index };
}

/**
 * The faces of one wing: each plane clipped to where it is the lowest.
 * Every constraint is linear, so this is exact.
 */
function wingFaces(w) {
  const faces = [];
  for (const pl of w.planes) {
    let poly = w.footprint.slice();
    for (const other of w.planes) {
      if (other === pl) continue;
      // keep where h_pl <= h_other
      poly = clipHalfPlane(poly, (p) => pl.h(p) - other.h(p));
      if (!poly.length) break;
    }
    if (poly.length >= 3 && areaOf(poly) > 1) faces.push({ plane: pl, poly, wing: w.index });
  }
  return faces;
}

/**
 * Name each edge of a face: eave, ridge, hip or gable.
 *
 *  - an edge that lies on the footprint boundary is an eave, unless that end of
 *    the wing is gabled, in which case it is a gable
 *  - an edge shared with another plane of the same wing is a crease: level
 *    along its length means a ridge, rising means a hip
 */
function classifyEdges(face, w) {
  const out = [];
  const n = face.poly.length;
  for (let i = 0; i < n; i++) {
    const A = face.poly[i], B = face.poly[(i + 1) % n];
    const mid = mul(add(A, B), 0.5);
    let type = null;

    // On the footprint boundary?
    for (let k = 0; k < 4; k++) {
      const P = w.footprint[k], Q = w.footprint[(k + 1) % 4];
      const d = distPointSeg(mid, P, Q);
      if (d < 1) {
        const alongEdge = Math.abs(dot(nrm(sub(Q, P)), w.along));
        const isEnd = alongEdge < 0.5;            // the edge runs across the ridge
        const endIdx = dot(sub(mid, w.wing.centre ?? mid), w.along) < 0 ? 0 : 1;
        type = isEnd && w.ends[endIdx] === 'gable' ? 'gable' : 'gutter';
        break;
      }
    }

    if (!type) {
      // A crease with another plane. Level along its length = ridge, else hip.
      const dz = Math.abs(face.plane.h(A) - face.plane.h(B));
      type = dz < 1 ? 'ridge' : 'hip';
    }
    out.push(type);
  }
  return out;
}

function distPointSeg(p, A, B) {
  const v = sub(B, A), L2 = dot(v, v);
  if (L2 < EPS) return Math.hypot(p.x - A.x, p.y - A.y);
  let t = dot(sub(p, A), v) / L2;
  t = Math.max(0, Math.min(1, t));
  const q = add(A, mul(v, t));
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/**
 * Turn a face's plan polygon into the face's OWN 2D coordinates — x across,
 * y up the slope from its eave — which is what the layout engine works in.
 *
 * This is where the plan-to-slope conversion happens: a point d mm inward from
 * the eave in plan is d/cos(pitch) mm up the slope.
 */
function toFaceCoords(face) {
  const pl = face.plane;
  const up = pl.inward;                       // plan direction up the slope
  const rightV = V(up.y, -up.x);              // across the face
  const cos = Math.cos(pl.pitchDeg * Math.PI / 180);

  const pts = face.poly.map(p => {
    const d = sub(p, pl.eaveA);
    return V(dot(d, rightV), dot(d, up) / cos);   // <- plan inward becomes slope distance
  });
  const minX = Math.min(...pts.map(p => p.x));
  const minY = Math.min(...pts.map(p => p.y));
  return pts.map(p => V(p.x - minX, p.y - minY));
}

/** Build every face of a roof made of wings. */
function buildRoof({ wings }) {
  const built = wings.map((w, i) => {
    const wp = wingPlanes(w, i);
    wp.wing = w;
    return wp;
  });

  const faces = [];
  for (const w of built) {
    for (const f of wingFaces(w)) {
      const edgeTypes = classifyEdges(f, w);
      faces.push({
        wing: w.index,
        plane: f.plane,
        kind: f.plane.kind,
        planPoly: f.poly,
        planArea: areaOf(f.poly),
        edgeTypes,
        facePoly: toFaceCoords(f),
        pitch: f.plane.pitchDeg,
        get slopeArea() { return this.planArea / Math.cos(this.pitch * Math.PI / 180); },
      });
    }
  }
  return { faces, wings: built };
}

module.exports = { buildRoof, wingPlanes, wingFaces, classifyEdges, toFaceCoords,
                   plane, clipHalfPlane, areaOf, V };
