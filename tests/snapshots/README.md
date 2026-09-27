# Snapshots

- `phase1/` — a frozen Phase 1 baseline. No current spec writes to this directory; it is kept for reference only.
- `phase2a/` — a frozen Phase 2a baseline (vegetation per era, before the ferry). No current spec writes to it.
- `phase3/` — written by `tests/e2e/world.spec.ts`: the Phase 2a framings plus one shot per vessel kind, the ferry
  docked with slack ropes, the moored 1986 barge and the default view. Regenerate by running that spec's
  Playwright suite; it overwrites these PNGs on every run.
- `phase2b-before/` — frozen baseline taken before Phase 2b (dev shot script, not a spec). Kept for before/after comparison.
