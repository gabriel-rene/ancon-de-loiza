# Phase 4b rulings and notes

Spec: `docs/superpowers/specs/2026-09-28-phase-4b-town-design.md`. Plan: `docs/superpowers/plans/2026-09-28-phase-4b-town.md`.

## Baseline (Task 1)

`town` camera: pos [ex * 0.3, 5, ez * 0.3], target [285, 6, 171] (brief values kept; checked at ?era=1975&cam=town&t=12&freeze=1&q=medium, the east bank behind the station fills the frame).

Frame rate before the town (`perf.mjs`, 10 s, vsync and cap off, `freeze=1`, dpr 2 except low at dpr 1; real GPU, Metal).

| query | tier | fps | mean ms | p95 ms |
|---|---|---|---|---|
| era=1975 cam=ride t=17 c=95 | high | 81.7 | 12.24 | 14.7 |
| era=1984 cam=ride t=17 c=95 | high | 82.0 | 12.20 | 14.4 |
| era=1975 cam=bank t=12 c=5 | high | 92.4 | 10.82 | 13.3 |
| era=1975 cam=ride t=17 c=95 | medium | 131.1 | 7.63 | 10.5 |
| era=1984 cam=ride t=17 c=95 | medium | 130.4 | 7.67 | 10.5 |
| era=1975 cam=bank t=12 c=5 | medium | 157.4 | 6.35 | 9.3 |
| era=1975 cam=ride t=17 c=95 | low (dpr 1) | 419.9 | 2.38 | 4.2 |
| era=1984 cam=ride t=17 c=95 | low (dpr 1) | 434.8 | 2.30 | 3.4 |
| era=1975 cam=bank t=12 c=5 | low (dpr 1) | 451.0 | 2.22 | 3.2 |

## Rulings

- Houses keep off every road in the town circle (story roads, main roads and town streets), not only the story roads the spec names: a house on painted street reads as a bug.
- Overlaps between lots are tested with the concrete (largest) size in every era, so a house never disappears when it turns concrete.

## Town shots and the software GPU

- The 4 `town` shots time out in Playwright (swiftshader software GPU, close water reflection), like the 4a `station` shots; `world.spec.ts` skips both.
- Ruling: town shots are taken with the real GPU against `npm run preview`, same settings for every shot (before and after sets):
  `PORT=4173 node scripts/dev/shot.mjs "?era=<era>&cam=town&t=<t>&c=95&freeze=1&q=medium" tests/snapshots/<dir>/<name>.png 2000`
  (t = 12, except 1959 = golden('1959') = 18.46). The before set was made this way and includes the HUD.

## Deferred
