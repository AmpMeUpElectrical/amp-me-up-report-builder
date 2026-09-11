# Solar Array Layout Planner

Works out a compliant flush-mount set-out for tin and tile roofs: certified rail
spacings by wind zone, panel clamp zones, tile courses and truss centres — then a
scale plan, a mark-up sheet, a compliance report and a materials list.

Open `Amp_Me_Up_Electrical_Solar_Layout_Planner.html`. Single file, works offline.

## What it is built on

| Source | Covers |
|---|---|
| Gamcorp 14022-MA PRO-F1 (AS/NZS 1170.2:2021) | MA PRO Rail on tin (L-Feet) and tile (Standard Tile Interface). Valid to 30/11/2027. |
| Jinko TÜV Installation Manual, Table 5 p17 | `JKMxxxN-51QL6-DV` clamp zone — `L = A/5 ~ A/4` |
| AIKO Installation Manual, s6.2.3 p10 | `AIKO-Axxx-MCE54Mw` clamp zone — Method 6, 310–410 mm |

**Klip-Lok is parked.** Its certification (Gamcorp 9981-03-01, MA Rail, AS/NZS
1170.2:2011) **expired 05/07/2023**, its wind regions are the old A/B/C/D, and the
usable full-rib pitch varies by roof and profile. The 10 tables are still in
`spacing_tables.json` and `engine.js` still handles it — `ACTIVE_ROOFS` just does not
offer it. Supply a rib pitch and it can be switched back on.

## The rules it enforces

- **Zones.** `a = min(0.2b, 0.2d)` if h/b or h/d ≥ 0.2, else `2h`. Edge = outer a/2,
  Intermediate = next a/2, Corner = outer a/2 both ways. At pitch ≥ 10° the ridge is an
  edge too, so one rail can cross three zones and must tighten locally.
- **A span must satisfy the tightest zone it crosses**, not just its endpoints.
- **"--" means prohibited**, not unknown. No foot may be fixed in such a zone and no
  panel may sit over one.
- **Derates (Note 2)** differ by roof. Tin 0.55 mm steel = 27% of the table value; tile
  is mostly 100%.
- **Spacing floor.** Never below one third of the panel width — below that the tool
  refers you to the engineer rather than returning a smaller number.
- **Setback** = `max(200 mm, 2s)` from gutter, ridge and rake, plus a **rail sag allowance
  at the gutter only** (default 30 mm). A loaded rail pulls down, so a panel set out at
  exactly 200 mm finishes lower than that and breaches. The ridge and rakes get no
  allowance — sagging carries the panel *away* from the ridge. The gutter line is the one
  that must always be compliant.
- **Building height h** is the *average roof height above ground* (Note 9, Figure 1) — not
  the gutter and not the ridge, but halfway between, so the roof is included. Enter the
  gutter and ridge heights and the planner takes the average; reading the ridge alone can
  put you in the wrong height band.
- **Panel size.** Neither panel is a certified size (both are 1134 mm wide). Each is read
  against the smallest certified size at least as large in *both* dimensions —
  2200×1200 — which is conservative. Worth chasing a Gamcorp addendum.

## Face shape — pick a preset

**One face at a time.** A cut-up roof is designed face by face, not all at once.

A face is any closed polygon whose edges each know what they are. You pick a preset and
type a few lengths; the preset builds the polygon and labels every edge.

| Preset | You type |
|---|---|
| Rectangle | width, length |
| Hip main face | gutter width, ridge width, length, ridge offset |
| Hip end | gutter width, length to the point, apex offset |
| Gable one side, hip the other | gutter width, ridge width, length, which side hips |
| Dutch gable / half hip | gutter width, gable width, length |
| Valley cutting one corner | width, length, valley run, valley rise, side |
| Valley cutting both corners | width, length, both runs and rises |
| Return face between two valleys | gutter width, ridge width, length |

Adding a preset is one entry in `PRESETS` — fields plus a `build()` returning corners and
edge types. The library is meant to grow as new faces turn up.

Lengths take **tile counts as well as millimetres**: type `12t` for 12 tiles across or
`15c` for 15 courses up and it converts using the tile figures. On a cut-up roof counting
beats measuring.

The set-up tab draws the shape as you type, with every edge named and dimensioned, so a
wrong number is obvious before you go any further.

### Edge types carry the rules

| Edge | Wind zone band? | Setback |
|---|---|---|
| Gutter | always | setback **+ rail sag allowance** |
| Ridge | at pitch ≥ 10° | setback |
| Hip | always | setback |
| Gable | always | setback |
| **Valley** | **no** | setback (water and access) |

A valley is an internal junction where two planes meet — flow does not separate there the
way it does over a hip or a gable, so no edge band comes off it. It still takes its
clearance for water. Same trapezium, same point 400 mm in from the raking edge half way
up: **next to a hip it reads `edge`, next to a valley it reads `internal`.**

A corner is now *within a/2 of two wind edges that actually turn*, which reduces exactly
to the old rectangle answers and fixes a case the old rule got wrong: on a face narrower
than `a`, a point mid-way is inside a/2 of both long parallel edges and was being called a
corner when it is only an edge.

Setbacks are measured **perpendicular to each edge**, not horizontally, so a raking edge
needs more horizontal inset than its setback. A row is limited by its **narrowest** point,
not its bottom, and the array is centred in whatever band is left.

## Clamp zone tolerance

The manufacturer's clamp zone can be widened by a percentage of panel length, at the
designer's discretion. Logan's reasoning: a clamp slightly outside the stated zone risks
micro-fracturing the panel rather than the wind integrity of the array, and the roof
sometimes leaves no choice. Wind loading is governed by the 200 mm edge setback, which is
never relaxed.

The tool will not spend tolerance that buys nothing — among layouts with the same panel
count it takes the one furthest inside the manufacturer's zone — and it always states
what the tolerance is worth:

> *The clamp tolerance is buying you 2 extra panels. Within the manufacturer's zone this
> roof takes 9; at 5% it takes 11.*

Every breach is listed per row with the actual distance and direction, e.g. *"Row 1:
clamp 353 mm from the short edge, 29 mm closer to the end than the stated zone
(382–476 mm)"*, and the compliance tab marks it **Outside spec**, not Pass.

On an 8000 × 5000 tile face with 600 mm trusses, portrait only:

| Tile gauge | In spec | At 2.5% | At 5% | At 10% |
|---|---|---|---|---|
| 300 mm | 0 | 11 (+29 mm) | 11 (+29 mm) | 11 (+29 mm) |
| 330 mm | 11 | 11 | 11 | 11 |
| 360 mm | 11 | 11 | 11 | 12 (+117 mm) |
| 400 mm | 0 | 11 (+29 mm) | 12 (+77 mm) | 12 (+77 mm) |

A 300 mm gauge goes from impossible to a full array for 29 mm. A 330 mm gauge gains
nothing at any tolerance, so it uses none.

## Which direction is fixed, which is free

A structural member is continuous along its own length, so placement *along* it is free
and placement *across* it is fixed to the member spacing. That one idea covers every roof:

| Roof | Up-slope | Across-slope |
|---|---|---|
| Tile | fixed — tile courses | fixed — trusses (hook shifted up to ±60 mm) |
| Tin, purlins **across** the slope | fixed — purlin spacing | **free** |
| Tin, purlins **up** the slope | **free** | fixed — purlin spacing |

Purlins do not always run parallel to the gutter, so the direction is an input. It
changes the answer: on the same face, tin with purlins running up the slope starts a
portrait row at exactly the 200 mm setback, where tile (quantised to courses) starts at
202 mm and a coarser grid pushes it much higher.

## The two things that catch people

**Orientation flips which direction is free.** Both panels clamp on the long side with
rails parallel to the short side, so:

- *Portrait* — rails run across-slope, quantised to tile courses. The panel edge sits a
  further 382–476 mm beyond each rail. Up-slope constrained, across-slope free.
- *Landscape* — rails run up-slope and are continuous, so a panel clamps anywhere along
  them. Up-slope placement is free; the first row starts exactly at the setback at any
  gauge. Across-slope is the constrained direction instead.

At a 330 mm gauge that is worth 2 mm. At 320 mm it is worth 287 mm. At 300 and 400 mm
portrait cannot place a row at all.

**Profiled (Malibu) tiles shift the real spans.** The hook is always screwed to a truss,
then slid — up to ±60 mm, either direction (120 mm between the furthest screw holes) —
until it sits in a trough. The foot ends up *at the trough*, so spans are not the truss
pitch. Judge compliance on the shifted positions. Tile geometry is measured per job;
whether every truss can reach a trough depends on it (a 330 mm cover needs a ≥250 mm
trough at 60 mm of shift).

## Measuring

The app has a **What to measure** tab with the full checklist and why each number
matters. The short version:

- Roof face **capping edge to capping edge**. Do not derive the width by counting whole
  tiles — the edge tile usually overlaps the capping, and on a 6150 mm face that costs a
  whole panel.
- Tile gauge is the **exposed length of a tile** — the up-slope distance from one row to
  the next.
- On a hip, measure the width **at the gutter and at the ridge** (0 at the ridge for a
  hip end). If the face is not symmetrical, give the top edge's offset from the left;
  leave it blank and it is centred.
- Gutter height **and** ridge height above ground — the planner averages them.
- Member spacing, and on tin **which way the purlins run**.
- The panel's exact model code, not just its wattage.

## Files

| File | |
|---|---|
| `Amp_Me_Up_Electrical_Solar_Layout_Planner.html` | The app. Self-contained. |
| `engine.js` | Certified spacing lookup, zones, derates, foot solver |
| `layout.js` | Tile grid, interface positions, setbacks, row packing |
| `placement.js` | Orientation-aware placement, capping datum |
| `face.js` | Earlier quadrilateral face model, kept for its tests |
| `polyface.js` | Face as any polygon with typed edges; per-edge setbacks, spans, zones |
| `presets.js` | The preset shape library |
| `spacing_tables.json` | All 30 extracted tables (tin, tile, Klip-Lok) |
| `tables_compact.json` | Tin + tile only, the form embedded in the app |
| `panels.json` | Panel library with clamp zones |
| `test*.js` | 357 tests across eleven suites |

`engine.js` / `layout.js` / `placement.js` are the tested reference implementation; the
app carries its own copy of the same logic so it can be one file. They are cross-checked:
the app's spacing lookup was compared against the modules across **8,640** combinations
of roof, terrain, region, height, h/d, fixing, panel and zone, and its face geometry
across **960** shape/point combinations — zero mismatches in either.

Run the tests with the portable node:

```bash
"$HOME/AppData/Local/node-portable/node-v24.16.0-win-x64/node.exe" test.js
```

## Not yet verified on a roof

The geometry has not been checked against a real installation. Numbers to confirm first
time out: the 60 mm hook shift, the measured tile trough figures, and whether the
mark-up dimensions land where expected.
