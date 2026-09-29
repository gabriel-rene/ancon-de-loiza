# Phase 4a rulings and notes

Spec: `docs/superpowers/specs/2026-09-28-phase-4a-ferry-place-design.md`. Plan: `docs/superpowers/plans/2026-09-28-phase-4a-ferry-place.md`.

## Baseline (Task 1)

`station` camera: pos `[ex * 0.3, 6, ez * 0.3]`, target `[ex + 12, 2, ez + 10]`. `bridge` camera: pos `[60, 30, 230]`, target `[-164, 4, 120]`. Both met their targets unchanged (checked at 1975 noon, q=medium).

| query | tier | fps | mean ms | p95 ms |
|---|---|---|---|---|
| `?era=1975&cam=ride&t=17&c=95&freeze=1&q=high` (dpr 2) | high | 103.5 | 9.66 | 10.4 |
| `?era=1984&cam=ride&t=17&c=95&freeze=1&q=high` (dpr 2) | high | 105.4 | 9.49 | 10.4 |
| `?era=1975&cam=bank&t=12&c=5&freeze=1&q=high` (dpr 2) | high | 120.7 | 8.28 | 9.2 |
| `?era=1975&cam=ride&t=17&c=95&freeze=1&q=medium` (dpr 2) | medium | 167.4 | 5.97 | 6.8 |
| `?era=1984&cam=ride&t=17&c=95&freeze=1&q=medium` (dpr 2) | medium | 172.2 | 5.81 | 6.8 |
| `?era=1975&cam=bank&t=12&c=5&freeze=1&q=medium` (dpr 2) | medium | 202.2 | 4.94 | 5.7 |
| `?era=1975&cam=ride&t=17&c=95&freeze=1&q=low` (dpr 1) | low | 515.3 | 1.94 | 2.8 |
| `?era=1984&cam=ride&t=17&c=95&freeze=1&q=low` (dpr 1) | low | 535.5 | 1.87 | 2.8 |
| `?era=1975&cam=bank&t=12&c=5&freeze=1&q=low` (dpr 1) | low | 618 | 1.62 | 1.8 |

## Rulings

- Landing-pad math lives in `src/terrain/landingPads.ts` (it edits the terrain height field), not in
  `src/infrastructure/landing.ts` as the spec §4 table says; `landing.ts` keeps the landing meshes.
- The station footprints use research [S9] (street address) only; [S10] is not in `sources.ts`.
- File names differ from spec §4: `roadMesh.ts` → `roadStrip.ts`, `roadMask.ts` → `groundMask.ts` (the mask
  also carries trodden dirt); new helpers `parts.ts` and `build.ts`.
- Needed by the bridge, not in spec §1: in eras with a bridge, woody plants are kept off its line (deck
  half-width + 3 m) so no crown pierces the deck (Task 10). No other plant changes.

## Deferred

## Station shots and the software GPU

- The 5 `station` shots time out in Playwright (swiftshader software GPU: the close water reflection is too slow for 30 frames in 90 s). The `bridge` shots pass.
- Ruling: the station shots are taken with the real GPU instead: `PORT=4173 node scripts/dev/shot.mjs "?era=…&cam=station&…&freeze=1&q=medium" tests/snapshots/<dir>/<name>.png 2000`, against `npm run preview`. The before set was made this way. Task 11 does the same for the after set.

## Task 10

- Station corners passed the clearing (22 m) and dry-ground test for all 8 eras with the existing `stationLayout` numbers; no `a`/`v` shifts were needed and `LANDING_CLEARING` is unchanged.
- Ground mask: soft edge of a road segment is clamped to its half-width (`soft = min(MASK.soft, half)`) so 1.5 m paths keep a firm centre.
- Budget per era (draw calls / triangles): 1840 3/630, 1900 3/630, 1925 3/786, 1935 3/1530, 1959 3/1530, 1975 5/1870, 1984 5/4144, 1986 4/4172.

## After (Task 11)

Same queries as the baseline, preview build, mean of two runs (mean ms; % vs baseline).

| query | tier | fps | mean ms | baseline ms | change |
|---|---|---|---|---|---|
| 1975 ride | high | 104.2 | 9.60 | 9.66 | -0.6 % |
| 1984 ride | high | 106.0 | 9.44 | 9.49 | -0.6 % |
| 1975 bank | high | 120.6 | 8.30 | 8.28 | +0.2 % |
| 1975 ride | medium | 168.0 | 5.95 | 5.97 | -0.3 % |
| 1984 ride | medium | 172.3 | 5.81 | 5.81 | 0.0 % |
| 1975 bank | medium | 203.1 | 4.93 | 4.94 | -0.3 % |
| 1975 ride | low | 505 | 1.98 | 1.94 | +2.1 % |
| 1984 ride | low | 519 | 1.93 | 1.87 | +3.2 % |
| 1975 bank | low | 595 | 1.68 | 1.62 | +3.7 % |

Tier means: high -0.3 %, medium -0.2 %, low +2.9 % (1.81 to 1.86 ms, sub-ms noise at dpr 1). All within 5 %.

## Art gate (Task 11)

No Important problems found; no code changes. One line per shot (after vs before):

- 1900-station-noon: thatch shelter on bare bank, sand road curving inland, reflected in water; before was empty bank. Fine.
- 1925-station-noon: wooden Cortijo house with thatched hip roof and the sand road; reflected. Fine.
- 1959-station-docked: teal and pink zinc-roofed houses either side of the timber landing, ferry docked; clearing is plant-free. Fine.
- 1975-station (golden hour): concrete house with bar terrace, neighbour's wooden house, concrete ramp; reflections good. The ramp reads as a flat dark slab (see Deferred).
- 1984-station-noon: neighbour's house gone, terraced house, pale concrete ramp; road curves inland without flicker. Ramp flat (Deferred).
- 1984-bridge-noon: two half-built spans from each bank, gap between, crane on the east span end; crane is a small yellow accent, does not dominate; piers reflect in water; no tree through deck.
- 1986-bridge: continuous deck with lamps and piers, reflected in water; approach road fades into the plain; no tree through deck.
- 1984-ride / 1975-ride / other ride, bank, aerial, fields, farm shots: landing and roads appear as small features at the far bank; nothing else changed.

Checked from the parked list: no road-strip flicker seen in any shot; bridge in the reflection: yes (1984 and 1986); no tree through the deck: confirmed; station buildings inside the clearing: yes; crane not dominating: yes; bridge ends: the west end enters the tree line and the east end meets the road, no visible burial at shot scale.

Test runs: `world.spec.ts` 26 passed, 5 skipped (station, taken with the real GPU via shot.mjs). `leak.spec.ts` FAILS, but not because of 4a: with `<Infrastructure>` removed from World the same deltas appear (+90 buffers, +18 geometries, +18 textures over one cycle), so the leak pre-dates 4a (see report).

## Deferred (Task 11)

- Minor: the landing concrete ramp is a flat single-tone slab from low cameras (no slope shading, no expansion joints); add a subtle ramp gradient or joint lines.
- Minor: painted textures in `src/infrastructure/textures.ts` are not wrap-tiled; no seams visible at shot scale, but check zinc roofs and concrete in a close camera.
- Minor: 1984 and 1986 low-detail road ends are unlit paint; fine at the frame's distance.
- Existing (not 4a): era-cycle GPU resource growth in `leak.spec.ts`: +90 buffers, +18 geometries, +18 textures per cycle; present with Infrastructure removed. Needs its own investigation.

## Final review fixes

- I1 bridge approaches: story roads carry their own `surface`; while the bridge is `building` (1984) the
  approaches are `sand`, drawn as a second strip (one strip mesh per surface in use, at most 2) and painted
  into the dirt channel (G) instead of the road channel, so their shoulders are not the era's asphalt.
  1986: the era surface (asphalt).
- I2 west approach: the modern PR-187 (528811967) is cut at the Antigua PR-187 junction (its point 26)
  when there is no bridge; with a bridge its ~145 m tail to the bridge's west end is painted with the same
  surface rule (dirt 1984, asphalt 1986). Spec §3 row updated.
- I3 docking: the pad's shore level is per bank offset (`padShoreY`), lowered until every ferry docking
  there fits over it: bank 8 (1840–1935) 0.11 m (the barges' floor 4 cm above), bank 0 (1959–86)
  0.25 m (the wood aprons' hinge underside 1 cm above the timber/concrete surface). Docked, each apron
  tilts so its tip's underside lies 1 cm above the landing, following heave and pitch (`docking.ts`);
  docked, the hull's periodic motion is damped by 80 % (`DOCK_HOLD`), its end held by the landing. Before,
  the 1959/1975 apron tips were also ~20 cm inside the landing, not only 1840/1900/1925.
- M1: 1986 bridge `open` cites S1 only. M2: pads flatten at full weight one target grid cell past their
  edges (low tier no longer pokes through the ramp/log sides).
- Budget per era (draw calls / triangles): 1840 3/630, 1900 3/630, 1925 3/786, 1935 3/1530,
  1959 3/1530, 1975 5/4030, 1984 6/6304 (+1 strip: the dirt approach), 1986 4/6332.

## Deferred (reviews)

Minor items parked by the task and final reviews (none block 4a):

- Textures (`src/infrastructure/textures.ts`) are not wrap-tiled; road `wrapS` could clamp; thatch course step does not divide 512. No seams seen at shot scale.
- 1.5 m paths are faint in the 2.5 m-texel ground mask.
- Story strips cover whole ways (cheap); could be clipped to ~120 m from each end under the frame rule.
- Strip width shrinks at sharp bends (no miter).
- Bridge crest sits at t = 0.5, not over the river centre; the first ~20 m of deck at each end is partly buried (reads as an embankment); unfinished 1984 spans carry the asphalt top.
- The neighbour's house stands by the east landing, ~246 m from the OSM bridge line; "demolished for the bridge" [S4] is not visible as such on screen.
- The PR-951 gate before 1935 also hides older streets that carry that number (revisit in 4b).
- Heights for infrastructure read the tier's `near` terrain; tests check only the 512 fields.
- The station `fitInland` slide is capped at 10 m; real layouts needed no slide, and `build.test` guards the clearing.
- Test gaps: no multi-road strip index test; no rotated-pad landing test; bridge open-state test does not assert rails and lamps; vegetation corridor and placement key have no test.
- Pre-existing (not 4a): `tests/e2e/leak.spec.ts` fails with the same numbers on the pre-4a base (+18 geometries, +18 textures per era cycle).
- Content (not changed in 4a): `src/data/facts.ts` and the 1986 era summary say the bridge opened in 1985; S1 gives 1986, S3 gives 1985. For the user to decide.
