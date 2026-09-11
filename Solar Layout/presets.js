/* Amp Me Up Electrical — roof face presets
 *
 * A cut-up roof is a handful of shapes repeated. Rather than draw each face,
 * pick the shape and type in a few lengths. Each preset turns those into a
 * polygon with typed edges for polyface.js.
 *
 * Adding a preset later is one entry in this list: give it fields, and a build()
 * that returns points (x across, y up the slope from the gutter) and the edge
 * type of each one.
 *
 * Every length is in mm. On a tile roof most of them are easier counted than
 * measured — courses up the slope, tiles across — and the app converts.
 */

const P = (x, y) => ({ x, y });

const f = (key, label, def, hint) => ({ key, label, def, hint });

const PRESETS = [
  {
    id: 'rect',
    name: 'Rectangle',
    note: 'Gable both ends, or a simple skillion. Ridge at the top, gutter at the bottom.',
    fields: [
      f('W', 'Width, capping to capping', 8000, 'across the face'),
      f('L', 'Gutter to ridge', 5000, 'up the slope'),
    ],
    build: ({ W, L }) => ({
      points: [P(0, 0), P(W, 0), P(W, L), P(0, L)],
      edgeTypes: ['gutter', 'gable', 'ridge', 'gable'],
    }),
  },
  {
    id: 'hip-main',
    name: 'Hip main face',
    note: 'The long face of a hip roof. Wide at the gutter, narrower at the ridge, a hip each side.',
    fields: [
      f('W', 'Width at the gutter', 12000),
      f('T', 'Width at the ridge', 4000),
      f('L', 'Gutter to ridge', 5000),
      f('off', 'Ridge offset from left', null, 'blank = centred'),
    ],
    build: ({ W, T, L, off }) => {
      const o = (off === null || off === undefined) ? (W - T) / 2 : off;
      return {
        points: [P(0, 0), P(W, 0), P(o + T, L), P(o, L)],
        edgeTypes: ['gutter', 'hip', 'ridge', 'hip'],
      };
    },
  },
  {
    id: 'hip-end',
    name: 'Hip end',
    note: 'The triangular end of a hip roof. Two hips meeting at a point.',
    fields: [
      f('W', 'Width at the gutter', 8000),
      f('L', 'Gutter to the point', 4000),
      f('off', 'Apex offset from left', null, 'blank = centred'),
    ],
    build: ({ W, L, off }) => {
      const o = (off === null || off === undefined) ? W / 2 : off;
      return {
        points: [P(0, 0), P(W, 0), P(o, L)],
        edgeTypes: ['gutter', 'hip', 'hip'],
      };
    },
  },
  {
    id: 'gable-hip',
    name: 'Gable one side, hip the other',
    note: 'A face that runs into a gable at one end and hips off at the other.',
    fields: [
      f('W', 'Width at the gutter', 10000),
      f('T', 'Width at the ridge', 6000),
      f('L', 'Gutter to ridge', 5000),
      f('side', 'Which side hips (l/r)', 'r', 'l or r'),
    ],
    build: ({ W, T, L, side }) => {
      const hipRight = String(side).toLowerCase() !== 'l';
      return hipRight
        ? { points: [P(0, 0), P(W, 0), P(T, L), P(0, L)],
            edgeTypes: ['gutter', 'hip', 'ridge', 'gable'] }
        : { points: [P(0, 0), P(W, 0), P(W, L), P(W - T, L)],
            edgeTypes: ['gutter', 'gable', 'ridge', 'hip'] };
    },
  },
  {
    id: 'dutch',
    name: 'Dutch gable / half hip',
    note: 'Hips part way up, then a small gable at the top. The top edge is a gable, not a ridge.',
    fields: [
      f('W', 'Width at the gutter', 10000),
      f('T', 'Width of the gable at the top', 3000),
      f('L', 'Gutter to the gable', 4500),
    ],
    build: ({ W, T, L }) => {
      const o = (W - T) / 2;
      return {
        points: [P(0, 0), P(W, 0), P(o + T, L), P(o, L)],
        edgeTypes: ['gutter', 'hip', 'gable', 'hip'],
      };
    },
  },
  {
    id: 'valley-one',
    name: 'Valley cutting one corner',
    note: 'A rectangle with a wing running into it, so a valley slices one bottom corner off.',
    fields: [
      f('W', 'Width, capping to capping', 12000),
      f('L', 'Gutter to ridge', 5000),
      f('run', 'Valley run along the gutter', 3000, 'how far in it starts'),
      f('rise', 'Valley rise up the side', 2000, 'how far up it reaches'),
      f('side', 'Which side (l/r)', 'l', 'l or r'),
    ],
    build: ({ W, L, run, rise, side }) => {
      const left = String(side).toLowerCase() !== 'r';
      return left
        ? { points: [P(run, 0), P(W, 0), P(W, L), P(0, L), P(0, rise)],
            edgeTypes: ['gutter', 'gable', 'ridge', 'gable', 'valley'] }
        : { points: [P(0, 0), P(W - run, 0), P(W, rise), P(W, L), P(0, L)],
            edgeTypes: ['gutter', 'valley', 'gable', 'ridge', 'gable'] };
    },
  },
  {
    id: 'valley-both',
    name: 'Valley cutting both corners',
    note: 'A wing each side, so a valley slices both bottom corners off.',
    fields: [
      f('W', 'Width, capping to capping', 14000),
      f('L', 'Gutter to ridge', 5000),
      f('runL', 'Left valley run along the gutter', 3000),
      f('riseL', 'Left valley rise', 2000),
      f('runR', 'Right valley run along the gutter', 3000),
      f('riseR', 'Right valley rise', 2000),
    ],
    build: ({ W, L, runL, riseL, runR, riseR }) => ({
      points: [P(runL, 0), P(W - runR, 0), P(W, riseR), P(W, L), P(0, L), P(0, riseL)],
      edgeTypes: ['gutter', 'valley', 'gable', 'ridge', 'gable', 'valley'],
    }),
  },
  {
    id: 'valley-trap',
    name: 'Return face between two valleys',
    note: 'The face of a wing, bounded by a valley each side, narrowing as it climbs.',
    fields: [
      f('W', 'Width at the gutter', 7000),
      f('T', 'Width at the ridge', 2500),
      f('L', 'Gutter to ridge', 4000),
    ],
    build: ({ W, T, L }) => {
      const o = (W - T) / 2;
      return {
        points: [P(0, 0), P(W, 0), P(o + T, L), P(o, L)],
        edgeTypes: ['gutter', 'valley', 'ridge', 'valley'],
      };
    },
  },
];

function preset(id) {
  const p = PRESETS.find(x => x.id === id);
  if (!p) throw new Error(`No preset "${id}"`);
  return p;
}

/** Build a face's polygon from a preset and its dimensions. */
function buildShape(id, dims) {
  const p = preset(id);
  const filled = {};
  for (const fld of p.fields) {
    const v = dims[fld.key];
    filled[fld.key] = (v === undefined || v === '' || v === null) ? fld.def : v;
  }
  const shape = p.build(filled);
  // Guard against a shape that folds in on itself from bad numbers.
  const bad = shape.points.some(pt => !isFinite(pt.x) || !isFinite(pt.y));
  if (bad) throw new Error('Those dimensions do not make a closed shape.');
  return { ...shape, preset: p, dims: filled };
}

module.exports = { PRESETS, preset, buildShape };
