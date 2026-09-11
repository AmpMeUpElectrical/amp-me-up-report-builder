/* Amp Me Up Electrical — roof face shape
 *
 * A face is a quadrilateral: a bottom edge at the gutter, a top edge at the
 * ridge, and two raking edges. One model covers the lot:
 *
 *   rectangle   top width = bottom width, top offset 0   (gable end to end)
 *   trapezium   top width < bottom width                 (hip main face)
 *   triangle    top width = 0                            (hip end)
 *
 * Asymmetric shapes fall out of it too — a face with a gable one side and a hip
 * the other is a right trapezoid, which is just a top offset of 0.
 *
 * Coordinates: x across from the bottom-left corner at the capping edge,
 * y up the slope from the gutter line. All mm.
 */

/** Build the face geometry from a job. */
function face(job) {
  const Wb = job.faceW;
  const L = job.faceL;
  const Wt = job.faceShape === 'rectangle' ? Wb
           : job.faceShape === 'triangle'  ? 0
           : job.faceTopW;
  // Centred unless an explicit offset is given.
  const offL = (job.faceTopOffset === null || job.faceTopOffset === undefined)
                 ? (Wb - Wt) / 2 : job.faceTopOffset;

  const BL = { x: 0, y: 0 }, BR = { x: Wb, y: 0 };
  const TL = { x: offL, y: L }, TR = { x: offL + Wt, y: L };

  const leftAt  = (y) => BL.x + (TL.x - BL.x) * (y / L);
  const rightAt = (y) => BR.x + (TR.x - BR.x) * (y / L);

  // Perpendicular distance from a point to the infinite line through A and B.
  const perp = (A, B, x, y) => {
    const vx = B.x - A.x, vy = B.y - A.y;
    const len = Math.hypot(vx, vy);
    if (!len) return Math.hypot(x - A.x, y - A.y);
    return Math.abs(vx * (y - A.y) - vy * (x - A.x)) / len;
  };

  /**
   * A setback is measured PERPENDICULAR to the edge, but the array is laid out
   * in horizontal coordinates. On a raking edge the horizontal inset needed is
   * larger than the setback by 1/cos of the rake angle.
   */
  const rakeFactor = (dx) => Math.hypot(dx, L) / L;
  const leftRakeDx  = TL.x - BL.x;
  const rightRakeDx = TR.x - BR.x;

  return {
    Wb, Wt, L, offL, corners: { BL, BR, TL, TR },
    isTriangle: Wt <= 0,
    leftAt, rightAt,
    widthAt: (y) => rightAt(y) - leftAt(y),

    leftRakeFactor:  rakeFactor(leftRakeDx),
    rightRakeFactor: rakeFactor(rightRakeDx),

    /** Horizontal inset from each rake that gives `setback` measured perpendicular. */
    insets(setback) {
      return { left: setback * rakeFactor(leftRakeDx),
               right: setback * rakeFactor(rightRakeDx) };
    },

    /**
     * The usable band across the face at height y, after setbacks. On a face
     * that narrows going up, a row is limited by its TOP edge — check the whole
     * band, not just one height.
     */
    bandAt(y, setback) {
      const i = this.insets(setback);
      return { min: leftAt(y) + i.left, max: rightAt(y) - i.right };
    },

    /** The usable band over a whole row, i.e. the worst of its y range. */
    bandOver(y0, y1, setback) {
      const a = this.bandAt(y0, setback), b = this.bandAt(y1, setback);
      const min = Math.max(a.min, b.min), max = Math.min(a.max, b.max);
      return { min, max, width: Math.max(0, max - min) };
    },

    /** Perpendicular distance to each edge — what the zone bands are measured from. */
    distances(x, y) {
      return {
        gutter: y,
        ridge: this.isTriangle ? Infinity : (L - y),
        left:  perp(BL, TL, x, y),
        right: perp(BR, TR, x, y),
      };
    },

    contains(x, y) {
      if (y < -1e-6 || y > L + 1e-6) return false;
      return x >= leftAt(y) - 1e-6 && x <= rightAt(y) + 1e-6;
    },

    /** Plan area of the face, for a sanity figure on the report. */
    area() { return (Wb + Wt) / 2 * L; },

    /** SVG polygon points, gutter at the bottom. */
    polygon() {
      return this.isTriangle
        ? [BL, BR, { x: offL, y: L }]
        : [BL, BR, TR, TL];
    },
  };
}

/**
 * Zones on a face of any shape.
 *
 * `a` still comes from the building's plan dimensions — the shape of the roof
 * face does not change it. What changes is that the bands are measured
 * perpendicular to the real edges, so on a hip the band follows the rake in
 * rather than running straight up the roof.
 */
function zoneMapFace(job, f) {
  const b = job.b * 1000, d = job.d * 1000, h = job.h * 1000;
  const a = (h / b >= 0.2 || h / d >= 0.2) ? Math.min(0.2 * b, 0.2 * d) : 2 * h;
  const half = a / 2;
  const ridgeIsEdge = job.pitch >= 10;

  const bandOf = (t) => (t < half ? 0 : t < a ? 1 : 2);

  return {
    a, half, ridgeIsEdge,
    at(x, y) {
      const dist = f.distances(x, y);
      const dx = Math.min(dist.left, dist.right);
      const dy = ridgeIsEdge ? Math.min(dist.gutter, dist.ridge) : dist.gutter;
      const bx = bandOf(dx), by = bandOf(dy);
      if (bx === 0 && by === 0) return 'corner';
      const worst = Math.min(bx, by);
      return worst === 0 ? 'edge' : worst === 1 ? 'intermediate' : 'internal';
    },
  };
}

module.exports = { face, zoneMapFace };
