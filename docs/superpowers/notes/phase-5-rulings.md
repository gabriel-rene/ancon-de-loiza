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

Controller changes to the plan, 2026-09-30:

- **Task 10b added: the animals moved into the ride view** (spec §1.1 amendment, `src/fauna/view.test.ts`).
  - Frigatebirds 60–75 m up, circling 190–220 m beyond the landings (some over each bank).
  - Pelican fishers near the crossing ends, 40–60 m to the side, circle radius 12–18 m (spec §2 now reads 20–200 m from the crossing line).
  - Manatee strip 25.5–29.5 m to the side, on the river-mouth side. The spec was amended from the approved "40–100 m from the ferry".
  - Ride-view test gates: frigatebirds 40 %, pelicans 30 %, waders 50 % of the time; manatee 30 % of its surfacings, long-run (300 surfacings).
- **Task 8: left-wing winding fix** (the mirrored wing's triangles were inside out; `wing()` now swaps winding for the left side, with a test).
- **Task 11: Steps 5 (fact check) and 6 (code review) moved to the controller.**
- **Task 11 shots** (this task): the flush shots use the `station` camera on leg 1, not `ride` on leg 0 (see Art gate); the four new shots are marked `slow` in `world.spec.ts` (they need about 2 min each on the software GPU, over the 90 s wait).

## Art gate

New shots in `tests/snapshots/phase5/`: `1975-station-flush`, `1840-station-flush`, `1975-ride-manatee`, `1975-ride-dive`. Every phase-5 shot was pixel-diffed against `tests/snapshots/phase5-before/` (changes are only the animals: at most a few hundred pixels per shot) and the changed regions read, and the animals were read at their closest in-frame moments in extra real-GPU shots (`scripts/dev/shot.mjs`, not committed), against the quality-bar image and research §6.

**Shot choices**

- **Flush: moved from `ride` leg 0 to `station` leg 1.** At the plan's `flushAt` (2 s after the ferry starts docking at the west landing) the ride camera frames none of the flushing birds. Projected through the app's ride camera, they are 28–52 m from the camera and off its sides (NDC x −1.6 to −2.8 and +2.3 to +9.2 in 1975 and 1840), and they fly outward, away from the frame, from dock start to landing. The `station` camera looks at the Loíza (east) landing from the river. 2 s after the ferry starts docking there on leg 1 (1975 c = 412, 1840 c = 394), two birds (1975) or all three (1840) are in the air in frame, 60–90 m away and 1.5–2.6 m up.
- **Manatee: first surfacing after clock 300 (k = 4, 1975 c = 309.2), unchanged.** It is framed: NDC (−0.52, 0.13), 84 m.
- **Dive: fisher 0's first impact after clock 300, + 0.3 s (1975 c = 322), unchanged.** It is framed near the left edge: NDC (−0.88, 0.16), 97 m.
- The manatee, the dive and both station shots each need about 2 min to reach the ready flag on the software GPU, over the 90 s wait. They are marked `slow` (`test.slow()`, 300 s wait). The station camera is otherwise skipped in the suite; the `slow` flag lets the two flush shots through.

**Checklist**

- **White egrets vs the bank:** read clearly as white birds at noon, and bluish-grey in shade at golden hour. **Dark herons:** slate-blue and visible, not black holes (1986 `bank`, 1975 ride c = 395).
- **Flushed birds:** they fly low along the bank (peak 3.5 m), wings open, legs trailing (station shots).
- **Pelicans at 50–150 m:** heavy tan-brown body, pale head and long bill at golden hour (1975 ride c = 248, 1840 ride c = 314). At noon the body reads silver-grey, as brown pelicans do in flight. **Frigatebirds:** at 290 m they are a few dark pixels high in the sky, thin, never a blob.
- **No bird inside the ferry, a car or a person, and none under the ground.** Waders at the east landing stand and fly among red-mangrove prop roots (see flagged below).
- **Rings:** faint short pale dashes, not white discs; none in the reflection (manatee and dive shots, mullet rings in 1984 `ride` board). A fisher mid-dive reads as a pointed brown body (1840 `ride` board).
- **Manatee back and mullet:** small and subtle (a low brown hump with two faint ring arcs; the mullet shows only as its rings in the shots).
- **Colours at golden hour and at noon:** they hold.

**Fixes:** none needed in `src/fauna/`. The only change was to the shot list (above).

**Flagged for the controller (not fixed; these would move placements):**

- **The flush never shows in the ride view.** The ride camera looks ahead along the crossing; birds 12–40 m along the bank are off its sides once the ferry is within about 40 m of the landing, and they flee outward. The spec's one reaction to the ferry (§3.3) is visible only from the `station`, `bank` or aerial cameras.
- **Waders among mangroves.** Spec §2 says the flushers stand "in the landing clearing where no mangrove hides them". The clearing is plant-free only within 22 m of its centre (`LANDING_CLEARING` [22, 40]) and red mangroves fringe the bank beyond it. So at the east landing:
  - birds at 25–40 m stand partly behind prop roots (1975 `bank` noon);
  - their 30–60 m flights end inside the mangrove fringe (1840 station flush: a heron among the roots).

  Herons do forage in mangrove roots, but it does not match the spec's wording.

## Frame rate — after

`node scripts/dev/perf.mjs "<query>" 10 2` (`10 1` for low): 10 s, vsync and frame cap off, `freeze=1`, real GPU (Metal). The runs were back to back:
- the Task 1 commit 8375a76 was built in a scratch worktree and served on `:4174` (`BASE=…`);
- this branch's build (798423b + shot list) was served on `:4173`;
- the runs were interleaved base, after, base, after for each query.

Each mean is over 2 runs. The Task 1 numbers above were measured on another day and are not the reference here.

| query | tier | base runs ms | after runs ms | base mean ms | after mean ms | change |
|---|---|---|---|---|---|---|
| 1975 ride c=95 | high | 12.31, 16.76 | 16.82, 13.09 | 14.54 | 14.96 | +2.9 % |
| 1984 ride c=95 | high | 11.44, 11.62 | 11.58, 11.74 | 11.53 | 11.66 | +1.1 % |
| 1984 ride c=5 | high | 11.36, 10.72 | 11.26, 11.15 | 11.04 | 11.21 | +1.5 % |
| 1975 ride c=95 | medium | 6.95, 6.63 | 6.97, 6.73 | 6.79 | 6.85 | +0.9 % |
| 1984 ride c=95 | medium | 6.59, 8.36 | 7.07, 6.86 | 7.48 | 6.97 | −6.8 % |
| 1984 ride c=5 | medium | 6.39, 5.92 | 6.18, 5.79 | 6.16 | 5.99 | −2.8 % |
| 1975 ride c=95 | low | 1.88, 1.90 | 2.11, 1.97 | 1.89 | 2.04 | **+7.9 %** |
| 1984 ride c=95 | low | 1.94, 1.94 | 2.03, 2.04 | 1.94 | 2.04 | +4.9 % |
| 1984 ride c=5 | low | 2.01, 2.01 | 2.13, 2.13 | 2.01 | 2.13 | **+6.0 %** |

**Low tier fails the 5 % budget on 2 of 3 queries** (+7.9 %, +6.0 %; the third is at +4.9 %). High and medium are within budget.

On low, every "after" run is slower than both base runs of its query. The cost is a steady 0.10–0.15 ms per frame at about 2 ms, above the ±0.05 ms noise seen in 4c. So it is a real cost, not noise. The two noisy pairs (1975 high, 1984 medium) each had one base or after run hit by a GPU state change (16.8 and 8.4 ms outliers); their means are within budget either way.

Not investigated or fixed (Task 11 ruling: stop and report).

## Fact check

## Review

## Deferred
