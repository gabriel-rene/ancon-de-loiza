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
