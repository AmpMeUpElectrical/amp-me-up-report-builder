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
- **Setback** = `max(200 mm, 2s)` from gutter, ridge and rake.
- **Panel size.** Neither panel is a certified size (both are 1134 mm wide). Each is read
  against the smallest certified size at least as large in *both* dimensions —
  2200×1200 — which is conservative. Worth chasing a Gamcorp addendum.

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

- Roof face **capping edge to capping edge**. Do not derive the width by counting whole
  tiles — the edge tile usually overlaps the capping, and on a 6150 mm face that costs a
  whole panel.
- Tile gauge is the **exposed length of a tile** — the up-slope distance from one row to
  the next.

## Files

| File | |
|---|---|
| `Amp_Me_Up_Electrical_Solar_Layout_Planner.html` | The app. Self-contained. |
| `engine.js` | Certified spacing lookup, zones, derates, foot solver |
| `layout.js` | Tile grid, interface positions, setbacks, row packing |
| `placement.js` | Orientation-aware placement, capping datum |
| `spacing_tables.json` | All 30 extracted tables (tin, tile, Klip-Lok) |
| `tables_compact.json` | Tin + tile only, the form embedded in the app |
| `panels.json` | Panel library with clamp zones |
| `test*.js` | 145 tests across six suites |

`engine.js` / `layout.js` / `placement.js` are the tested reference implementation; the
app carries its own copy of the same logic so it can be one file. They are cross-checked:
the app's spacing lookup was compared against the modules across **8,640** combinations
of roof, terrain, region, height, h/d, fixing, panel and zone — zero mismatches.

Run the tests with the portable node:

```bash
"$HOME/AppData/Local/node-portable/node-v24.16.0-win-x64/node.exe" test.js
```

## Not yet verified on a roof

The geometry has not been checked against a real installation. Numbers to confirm first
time out: the 60 mm hook shift, the measured tile trough figures, and whether the
mark-up dimensions land where expected.
