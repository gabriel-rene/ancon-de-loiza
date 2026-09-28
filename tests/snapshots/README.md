# Snapshots

- `phase1/` — a frozen Phase 1 baseline. No current spec writes to this directory; it is kept for reference only.
- `phase2a/` — a frozen Phase 2a baseline (vegetation per era, before the ferry). No current spec writes to it.
- `phase3/` — a frozen Phase 3 baseline (the Phase 2a framings plus one shot per vessel kind, docked, moored and the
  default view). No current spec writes to it.
- `phase2b/` — written by `tests/e2e/world.spec.ts`: the Phase 3 framings plus two noon bank shots (1975, 1840).
  Regenerate by running that spec's Playwright suite; it overwrites these PNGs on every run. Also holds the Phase 2b
  gate's `after-*.png` shots (dev shot script, not the spec), the counterparts of `phase2b-before/`.
- `phase2b-before/` — frozen baseline taken before Phase 2b (dev shot script, not a spec). Kept for before/after comparison.
  `1986-mouth-morning.png` was added at the Phase 2b gate from a build of the baseline commit `9403740` (the
  `1984-mouth-dawn` framing is pre-dawn black, so a 7.2 h morning pair was added).
