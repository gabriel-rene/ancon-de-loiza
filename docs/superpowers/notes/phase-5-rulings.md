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
- **Task 11 shots:** the four new shots are marked `heavy` in `world.spec.ts` (renamed from `slow` in Task 11b, which clashed with the `@slow` tag): they need about 2 min each on the software GPU, over the 90 s wait, so they get `test.slow()` and a 300 s ready wait. Task 11 moved the flush shots to the `station` camera; Task 10c moved them back to `ride` (below).
- **Task 10c added: the animals brought closer** (user decision "bring them closer", 2026-09-30; spec §1.1 amendment "closer").
  - Size-aware ride-view gates (projected size on a 900 px tall view): pelicans ≥ 30 % of the time at ≥ 25 px, frigatebirds ≥ 40 % at ≥ 10 px, waders ≥ 40 % at ≥ 10 px; take-off ≥ 2 flying waders in view (≥ 8 px) 2–6 s after each dock; manatee ≥ 30 % of its surfacings.
  - Pelican flock: each pass crosses the crossing line 40–70 m ahead of the ferry, in the direction the ride camera faces.
  - Pelican fishers: circles at 0.3 and 0.7 of the span, 32–40 m out to the side, radius 10–12 m.
  - Waders: flushers stand 10–22 m from the pad in pairs (the stay-behind bird 22–30 m), and fly across the front of the pad, ≥ 4 m over the docked deck, landing ≤ 30 m from it.
  - Frigatebirds: the figure-eight's centre keeps ~220 m ahead of the ferry toward its bank, 60–63 m up.
  - Low tier hides the fauna in the reflection pass.
  - The flush shots are `ride` again (`1975-ride-flush`, `1840-ride-flush`, 4 s after the ferry starts docking at the Loíza landing on leg 1).

## Art gate

Re-shot in Task 11b on the final (Task 10c) placements: `npx playwright test tests/e2e/world.spec.ts --grep-invert @slow` gave 40 passed, 9 skipped, no console errors. The Task 11 station-flush shots are gone (Task 10c moved the flush back to `ride`).

Fauna shots in `tests/snapshots/phase5/`: `1975-ride-flush`, `1840-ride-flush`, `1975-ride-manatee`, `1975-ride-dive`, plus every `*-ride*.png`. Every shot was pixel-diffed against `tests/snapshots/phase5-before/` (changes are only the animals) and the changed regions read zoomed. Real-GPU checks with `scripts/dev/shot.mjs` (not committed). Before choosing shot times, each one was projected through the gate's ride camera, over the medium tier's own 384 ground (the app's placement is the fixed 512 grid on every tier, so only ground heights differ). The medium counts equal the high ones.

**Shot choices**

- **Flush, `ride`, leg 1, after the ferry starts docking at the Loíza landing.**
  - 1840: 4 s after (c = 396). All four flushers are in the frustum, 13–17 m away, 43–93 px, 5.5–6 m up. In the shot they fly low across the pad front, wings open, legs trailing: two egrets and a heron on the left, two on the right.
  - 1975: 3 s after (c = 413), not 4 s. All four are in the frustum at both times, 23–28 m away, 26–50 px. At 4 s, though, the landing house hides two of them, and the other two cross right over its roof, where they read as perched on the ridge. At 3 s three birds show apart, against the sky and trees: two white egrets and a small dark heron. `flushAt(era, after)` in `world.spec.ts`.
- **Manatee: unchanged.** The first surfacing after clock 300 (k = 4, 1975 c = 309.2) is still framed after 10c, 84 m away, 42 px: a low brown hump with faint ring arcs, left of centre. A pelican fisher circles above it.
- **Dive: unchanged.** Fisher 0's first impact after clock 300, + 0.3 s (1975 c = 322). It is framed, 80 m away: a pale-headed brown pelican sitting on the water where it hit, near the left edge.
- The four fauna shots keep the `heavy` flag (renamed from `slow`).

**Checklist**

- **White egrets vs the bank:** they read as white birds against the sky, trees and bank at golden hour (the flush shots, `1975-bank`). At noon, over pale water, they read faintly (`1975-bank-noon`). **Dark herons:** slate-blue and visible, not black holes (`1984-ride-unload`, standing on the bank; the 1840 flush).
- **Flushed birds:** they fly low (5.5 m) with wings open and legs trailing, across the pad front (flush shots).
- **Pelicans at 30–80 m:** the fishers read as brown pelicans with a pale head (`1975-ride`, `1840-ride`, the manatee shot; sitting on the water in `1984-ride-board` and the dive). The flock is 40–70 m ahead, and backlit at golden hour it reads as dark bird shapes over the far-bank water (`1935-ride`, `1975-ride`). A probe confirms the flock is always over the river whenever it is in view. **Frigatebirds:** thin dark crosses high in the frame, never a blob (`1984-ride-unload`, `1975-ride-line`).
- **No animal inside a tree, the ferry, a car or a person; none under the ground.** Fixed: the flock, one case below.
- **Rings:** faint short pale dashes on the water, none in the reflection (`1984-ride-board`, the manatee shot). Birds themselves do reflect on medium and high, as they should: dark soft shapes on the water under the flock and fishers.
- **Manatee back and mullet:** small and subtle.
- **Colours at golden hour and at noon:** they hold.

**Fix (Task 11b): the flock no longer passes a few metres from the camera.**
- **What failed:** in the first re-shoot of `1975-ride-flush` (c = 414), a flock pelican filled the top-left corner: 7 m from the camera, 333 px. At that size the low-poly bird reads as a toy.
- **Cause:** when the ferry nears the bank it faces, "40–70 m ahead" is clamped to 20 m inside the bank, so the pass crosses at the ferry.
- **Extent:** over 20 legs, 1 loop in 8 passed within 25 m of the camera in view, in every river era (1975, 1840, 1984, 1900, 1935, 1959).
- **Fix:** `flockAlong` (`src/fauna/flyers.ts`) now checks the clamped crossing point. If it lies less than `FLOCK.near` = 30 m ahead of the ferry, the pass crosses 40–70 m behind it instead, out of the ride view.
- **Tests:**
  - New test in `flyers.test.ts`: a pass is never 0–30 m ahead.
  - The 40–70 m-ahead test now skips the behind passes.
  - Afterwards the nearest in-view flock bird is ≥ 35 m away in every era.
  - Ride-view gates: pelican 1975 40 → 39 %, 1840 37 → 36 % (gate 30 %). The other kinds are unchanged.
- **Re-shot:** only the two shots whose flock loop changed, `1975-ride-flush` and `1959-ride-unload`. The latter is pixel-identical apart from a frigatebird, since its flock was out of frame either way.

**Still open from Task 11 (not changed here):** at the east landing the red-mangrove fringe begins 22 m from the pad (`LANDING_CLEARING`). The stay-behind birds (22–30 m) and the flush landings (≤ 30 m) can sit at its edge.

## Frame rate — after

Measured in Task 11b on the final placements (Task 10c + the 11b flock fix). The Task 11 table (2 runs per side, before 10c) is superseded.

`node scripts/dev/perf.mjs "<query>" 10 2` (`10 1` for low): 10 s, vsync and frame cap off, `freeze=1`, real GPU (Metal). The Task 1 commit 8375a76 was built in a scratch worktree and served on `:4174` (`BASE=http://localhost:4174/ancon-de-loiza/`). This branch's build was served on `:4173`. Each query ran 3 interleaved pairs, back to back: base, after, base, after, base, after. Change = after median / base median − 1. A tier passes if the change is ≤ +5 % on all three of its queries.

| query | tier | base runs ms | after runs ms | base median | after median | change |
|---|---|---|---|---|---|---|
| 1975 ride c=95 | high | 12.76, 12.56, 12.73 | 12.57, 12.81, 12.26 | 12.73 | 12.57 | −1.3 % |
| 1984 ride c=95 | high | 12.32, 12.73, 12.64 | 12.66, 12.72, 12.50 | 12.64 | 12.66 | +0.2 % |
| 1984 ride c=5 | high | 12.43, 12.45, 10.94 | 12.60, 12.46, 9.55 | 12.43 | 12.46 | +0.2 % |
| 1975 ride c=95 | medium | 5.99, 5.98, 5.99 | 6.00, 6.04, 6.10 | 5.99 | 6.04 | +0.8 % |
| 1984 ride c=95 | medium | 6.00, 5.95, 5.92 | 5.97, 5.95, 6.07 | 5.95 | 5.97 | +0.3 % |
| 1984 ride c=5 | medium | 5.67, 5.69, 5.67 | 5.68, 5.70, 5.65 | 5.67 | 5.68 | +0.2 % |
| 1975 ride c=95 | low | 1.92, 1.86, 1.82 | 1.85, 1.98, 1.86 | 1.86 | 1.86 | +0.0 % |
| 1984 ride c=95 | low | 1.91, 1.93, 1.93 | 1.96, 1.97, 1.97 | 1.93 | 1.97 | +2.1 % |
| 1984 ride c=5 | low | 2.00, 2.01, 2.05 | 2.04, 2.04, 2.04 | 2.01 | 2.04 | +1.5 % |

**All three tiers pass.** The worst change is +2.1 % (low, 1984 c = 95). Task 11 measured the low tier over budget (+7.9 %, +6.0 %), before Task 10c stopped drawing the fauna in the low tier's reflection pass. That change is the likely reason it now passes, but this was not isolated. The third 1984 c = 5 high pair ran faster on both sides (10.9 and 9.6 ms), which looks like a GPU state change; the medians ignore it.

## Fact check

17 confirmed, 5 unconfirmed, 0 wrong, 0 blocked (S4, S17, S18, S22 opened; S18 body paywalled). Full table: `.superpowers/sdd/2026-09-30-phase-5-fauna/factcheck.md`.

**Applied fixes** (`src/data/facts.ts`, spec §6):

- **1984:** the fishermen are scaling the shark, not cleaning it (the caption's "removiéndole las escamas"). Tony Croatto was photographed carrying the trap, not filmed. The shark photo is undated, so the fact now places it in Archivo Negro's "El Ancón de Loíza" collection instead of the 1980s. Added S22, the source for the *cocolía* = blue crab gloss.
- **1986:** 1995 removed (see below). The channel is now "about 8 feet wide so they could return to the sea" (S17), not "to free them".

**Flagged for the user:**

- 1995 manatee event — S18's subtitle says "hace 31 años" (≈ 1995) but the paywalled body was not read; research §1.2 lists a 1995 rescue (H). Re-add "1995" if confirmed.

## Review

## Deferred
