# Phase 5 — rulings, frame rate, fact check, deferred

Spec: `docs/superpowers/specs/2026-09-30-phase-5-fauna-design.md`. Plan: `docs/superpowers/plans/2026-09-30-phase-5-fauna.md`.

## Frame rate — baseline (Task 1, commit 8375a76)

All numbers from `node scripts/dev/perf.mjs "<query>" 10 2` (`10 1` for low), against `npm run build && npm run preview`.

| query | tier | fps | mean ms | p95 ms |
|---|---|---|---|---|
| 1975 ride c=95 | high | 79.9 | 12.52 | 15.4 |
| 1984 ride c=95 | high | 80.1 | 12.48 | 15.2 |
| 1984 ride c=5 | high | 81.5 | 12.27 | 14.7 |
| 1975 ride c=95 | medium | 129.7 | 7.71 | 10.6 |
| 1984 ride c=95 | medium | 130.4 | 7.67 | 10.6 |
| 1984 ride c=5 | medium | 136.4 | 7.33 | 10.4 |
| 1975 ride c=95 | low | 399.3 | 2.50 | 4.9 |
| 1984 ride c=95 | low | 404.8 | 2.47 | 4.6 |
| 1984 ride c=5 | low | 379.1 | 2.64 | 4.7 |

## Plan deviations

## Art gate

## Frame rate — after

## Fact check

## Review

## Deferred
