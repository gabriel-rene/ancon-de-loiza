# Phase 2c rulings and notes

Spec: `docs/superpowers/specs/2026-09-28-phase-2c-landscapes-design.md`. Plan: `docs/superpowers/plans/2026-09-28-phase-2c-landscapes.md`.

## Baseline (Task 1)

`fields` camera: pos [-500, 170, 250], target [-1800, 0, 1500]. Verified against `?era=1975&cam=fields&t=12&freeze=1&q=medium`: open, flat grassland fills the frame centre — the brief's values needed no tuning.

| query | tier | fps | mean ms | p95 ms |
|---|---|---|---|---|
| `?era=1900&cam=ride&t=17.5&c=95&freeze=1&q=high` | high | 103.0 | 9.71 | 10.40 |
| `?era=1900&cam=fields&t=12&freeze=1&q=high` | high | 119.2 | 8.39 | 9.10 |
| `?era=1975&cam=aerial&t=12&freeze=1&q=high` | high | 108.6 | 9.21 | 10.00 |
| `?era=1900&cam=ride&t=17.5&c=95&freeze=1&q=medium` | medium | 165.2 | 6.05 | 6.80 |
| `?era=1900&cam=fields&t=12&freeze=1&q=medium` | medium | 184.5 | 5.42 | 6.50 |
| `?era=1975&cam=aerial&t=12&freeze=1&q=medium` | medium | 165.7 | 6.04 | 6.50 |
| `?era=1900&cam=ride&t=17.5&c=95&freeze=1&q=low` (dpr=1) | low | 518.6 | 1.93 | 2.80 |
| `?era=1900&cam=fields&t=12&freeze=1&q=low` (dpr=1) | low | 548.8 | 1.82 | 2.80 |
| `?era=1975&cam=aerial&t=12&freeze=1&q=low` (dpr=1) | low | 475.6 | 2.10 | 2.90 |

All numbers from `node scripts/dev/perf.mjs "<query>" 10 2` (`10 1` for the low tier), against `npm run build && npm run preview` on this dev machine. `fields` and `aerial` are already the cheapest and second-cheapest of the three at every tier — the empty grassland has less geometry on screen than the `ride` view's river/vegetation/vessel. This baseline predates any phase-2c feature (cane fields, farm blocks, palm age) landing, so it's the "before" comparison point for perf regressions introduced by later tasks.

## Rulings

**Task 5: Cane geometry triangle count**

Real-layout cane mesh: 10,650 triangles (4,266 top + 6,384 sides) for all 96 fields shown. This is 17.8% of the 60,000-triangle budget.

## Deferred
