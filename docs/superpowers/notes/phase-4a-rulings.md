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
