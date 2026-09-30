# Phase 4c rulings and notes

Spec: `docs/superpowers/specs/2026-09-29-phase-4c-traffic-design.md`. Plan: `docs/superpowers/plans/2026-09-29-phase-4c-traffic.md`.

## Fit rulings (Task 1)

Spec §2 amended: 1840 alternates ox cart / led horse; 1900 alternates cane cart / workers only; 1925 cycles ox cart → Model T → led horse; cars ≤ 4.1 m; passengers whose spot or walk meets the parked load stay ashore that leg; the helmsman waits ashore while the load boards; haulers step to the rail while docked; two-lane decks walk the centre corridor; 1984 bicycles along the hauler-free rail. Reason: deck sizes in `eras.ts` / `seats.ts` (8 m × 3 m colonial barge, 7 m × 3.2 m 1925 platform, 4.4 m car slots).

## Baseline (Task 1)

Frame rate before 4c (`perf.mjs`, 10 s, vsync and cap off, `freeze=1`, dpr 2 except low at dpr 1; real GPU, Metal).

| query | tier | fps | mean ms | p95 ms |
|---|---|---|---|---|
| `?era=1975&cam=ride&t=17&c=95&freeze=1&q=high` | high | 80.7 | 12.39 | 14.7 |
| `?era=1984&cam=ride&t=17&c=95&freeze=1&q=high` | high | 82.1 | 12.19 | 14.3 |
| `?era=1984&cam=ride&t=17&c=5&freeze=1&q=high` | high | 82.2 | 12.16 | 14.4 |
| `?era=1975&cam=ride&t=17&c=95&freeze=1&q=medium` | medium | 131.1 | 7.63 | 10 |
| `?era=1984&cam=ride&t=17&c=95&freeze=1&q=medium` | medium | 135.8 | 7.37 | 9.8 |
| `?era=1984&cam=ride&t=17&c=5&freeze=1&q=medium` | medium | 143.6 | 6.96 | 9.6 |
| `?era=1975&cam=ride&t=17&c=95&freeze=1&q=low` | low | 425.6 | 2.35 | 3.3 |
| `?era=1984&cam=ride&t=17&c=95&freeze=1&q=low` | low | 427.3 | 2.34 | 3.8 |
| `?era=1984&cam=ride&t=17&c=5&freeze=1&q=low` | low | 398.9 | 2.51 | 4.2 |

## Task 13: bridge traffic (1986)
- Glass on the bridge cars: same `renderOrder` 2 as TrafficSet (transparent `glass` material, 'lo' detail cabins stay solid).
- The 1986 `ride` view does NOT frame the bridge (spec 4c §6): it looks along the moored ferry deck across the river with no bridge in shot. Deferred, next to the 4b item about the 1986 moored heading; the ride rig is unchanged. `cam=bridge` frames the bridge and shows the cars.
