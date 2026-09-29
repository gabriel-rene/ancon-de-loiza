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
- The four `town` shots time out (90 s ready wait) under the Playwright software GPU, like the 4a `station` shots (close water reflection). The 1840 and 1925 ones passed in the first run; 1959 and 1986 timed out, and all four timed out on a rerun. The baseline PNGs for 1959 and 1986 were taken with `scripts/dev/shot.mjs` on the real GPU (same query, 1440x900, 6 s wait), so they include the HUD.

## Deferred
