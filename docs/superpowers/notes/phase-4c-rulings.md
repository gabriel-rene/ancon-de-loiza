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

## Preflight rulings and plan deviations (2026-09-29)

The preflight scan (`.superpowers/sdd/2026-09-29-phase-4c-traffic/preflight.md`) found 18 blocking and 9 risky items in the first plan; each has a ruling (`progress.md`), applied in the amended plan and verified in a scratch copy.

- **Deck speed (R4).** Spec §4.2 says 2 m/s on ramps and deck. At 2 m/s the 1984 load takes 57 s (cap 50). `SPEED.deck` = 2.8 m/s, the lowest speed ≤ 3 m/s (0.1 steps) that keeps every era within 50 s (at 2.7 m/s 1984 loads in 51 s). Spec §4.2 amended (Task 6). Horse and bicycles 1.3 m/s, oxen 0.9 m/s, cars 5.5 m/s on the road.
- **Dock stops (R5).** Passengers stay serial (on after the load parks, off after it leaves), so every era with a load gets a longer stop: load/unload 1840 43/28, 1900 43/28, 1925 43/28, 1935 30/23, 1959 39/34, 1975 45/42, 1984 50/50 s; 1986 keeps 20/16. Spec §4.3 amended (Task 6). (The plan listed unload stops 1 s shorter; Task 8's fix round raised `PAX_UNLOAD` to 17 s, so each unload with a load grew by 1 s and 1984 sits on the 50 s cap.)
- **Lanes (B9, R1).** Roads keep right: the waiting line in the right-hand lane, leaving movers in the other, offset sideways along the road and pad connectors (mitred corners). Both story roads run 10–15 m beside their pad, so the lanes leave the road 28 m inland and run diagonally to the pad top. The queue head waits 10 m up the pad (spec §4.2 says "the top of the ramp"), where each mover lines up with its deck lane one wheelbase before the apron. Spec §4.2 amended (Task 6).
- **Bicycles (B5; spec §4.1 deviation).** Spec §4.1 moves bicycles "like passengers, in the passenger lane". They ride the rail lane on deck and use the verge on the rail side ashore: they wait 2 m outside the lanes and leave 3.2 m outside them, in their own leave chain, never crossing the car lanes.
- **Horse (spec §4.1, §5 deviations).** The led horse follows the vehicle route and parks on the cargo line (not the passenger lane); its leader walks without a hand target (spec §5 says "walk with hand targets").
- **Spawns (B6).** Spawns are timed back from the docking deadline (5 s margin) and never let a mover catch the one ahead; places in line are measured back from each path's own queue head (B7).
- **Passengers (B11, B12).** On two-lane decks nobody stands within 0.45 m of the centre corridor, and passengers take the spots at the deck ends first. A spot in the lane a mover drives off along keeps that passenger ashore for the leg.
- **Leg cycles (N5).** Even cycles are kept: each rule always runs the same way (1840 ox cart east → west, led horse west → east; 1900 cane cart east → west only; 1975 TV vans on east → west legs only).
- **Cart wheels (N6).** Solid plank discs, not the "two big spoked wheels" of spec §3.
- **Cargo anchor (N6).** Not grown to 5.5 × 1.8 m in `seats.ts`; the load's footprint and `paxBlocked` keep passengers clear instead.
- **Animal sizes (R3).** Ox cart 5.8 m, cane cart 6.0 m, horse 2.65 m (`front` 1.0 m, the drawn muzzle); the 1925 platform still fits the ox cart.
- **Bridge (R9).** The car count scales by lane length / bridge length so about 10 (low tier 6) are on the bridge at once.
- **Files.** The bridge component is `src/traffic/BridgeTrafficMesh.tsx` (a case-insensitive disk resolves `./BridgeTraffic` to `bridgeTraffic.ts`). The shot list reads the dock stops from `src/traffic/dockStops.ts` (tested equal to `eraTimings`), because Playwright's ESM loader cannot import the geo JSON through `schedule.ts`.

## Art gate (Task 14)

Shots in `tests/snapshots/phase4c/` (the ten 4c shots listed in `tests/e2e/world.spec.ts`), read against the quality-bar image and the V1 photos (research §10). Fixes:

- **Board shots showed an empty deck.** At 6 s into boarding the load is still up the road, out of frame (1840 and 1984 `ride`, 1925 `bank`), and in 1975 `bank` a queued car sat right under the camera. `at(era, 'board')` is now 40 % into the era's load stop (1840/1925 17 s, 1975 18 s, 1984 20 s): the load is on the ramp and the deck in every board shot.
- **Oxen read as lumps** (1925 ox cart boarding). `buildAnimalBody('ox')`: a straight-backed capsule barrel with a brisket, a small hump over the withers, a thin dewlap, a long face carried low and forward (a shade lighter than the coat), ears, a tail with a dark switch. The horns are pale and drawn with the cart (`buildCart`), because the body is multiplied by the coat tint and could only be darker than the coat. Lower legs are slimmer (`ANATOMY.rLower`: ox 0.05 m, was 0.06). 806 tris (budget 1200); carts 300 / 536 (800). `DIMS` unchanged.
- **Horse** (same pass): barrel and chest, a long head set at an angle on a crested neck, ears, a visible mane, a full tail with an end; upper legs 0.07 m, cannons 0.042 m. 564 tris (budget 1000).
- **Seat backs read as black boxes through the rear windows** (1959 `ride` unload). Seat backs are thinner (0.07 m), lower (at most 0.22 m, `SEAT_BACK_MAX`), split in the middle (`SEAT_GAP` 0.14 m) and warm brown (0x6a5a4c, was 0x3a3430); the cabin floor and dash are grey-brown (0x3a3632, was 0x1e1c1a). Glass: colour 0x1a2226, opacity 0.34 (was 0x0e1215, 0.42), metalness 0.35. From behind the rear window shows the cabin, the gap and the drivers' heads; drivers still show from the side (1984 `ride` board).
- **The 1935 Model A read as a black box from behind.** Vintage 'hi' cabins get a small rear window (0.5 × 0.24 m) in the back wall, so the driver's head shows through it. (Its black paint is the era's.)
- **Bridge glass cast shadows.** `BridgeTrafficMesh` now excludes the glass from shadow casting, as `TrafficSet` does.
- **Checked, no change needed:** no car floats, sinks or pops in the shots; the 1975 waiting line reads as a line of cars down the far-bank road; drivers' heads show; hooves meet the deck; paints stay within the 4b town's range (muted reds, creams, blues, greens, whites); the crew stay visible working (poles 1900, rope 1935, rails 1959–1984).

## Frame rate after (Task 14)

`perf.mjs`, 10 s, vsync and cap off, `freeze=1`, dpr 2 (low dpr 1), real GPU (Metal), build of 0973a99.

| query | tier | mean ms | baseline ms | change |
|---|---|---|---|---|
| `?era=1975&cam=ride&t=17&c=95&freeze=1&q=high` | high | 14.59 | 12.39 | +17.8 % |
| `?era=1984&cam=ride&t=17&c=95&freeze=1&q=high` | high | 14.68 | 12.19 | +20.4 % |
| `?era=1984&cam=ride&t=17&c=5&freeze=1&q=high` | high | 14.55 | 12.16 | +19.7 % |
| `?era=1975&cam=ride&t=17&c=95&freeze=1&q=medium` | medium | 8.76 | 7.63 | +14.8 % |
| `?era=1984&cam=ride&t=17&c=95&freeze=1&q=medium` | medium | 8.57 | 7.37 | +16.3 % |
| `?era=1984&cam=ride&t=17&c=5&freeze=1&q=medium` | medium | 8.39 | 6.96 | +20.5 % |
| `?era=1975&cam=ride&t=17&c=95&freeze=1&q=low` | low | 2.49 | 2.35 | +6.0 % |
| `?era=1984&cam=ride&t=17&c=95&freeze=1&q=low` | low | 2.42 | 2.34 | +3.4 % |
| `?era=1984&cam=ride&t=17&c=5&freeze=1&q=low` | low | 2.65 | 2.51 | +5.6 % |

Back to back (the Task 1 commit e9e2930 built in a scratch worktree on `:4174`, each query before then after):

| query | tier | before ms | after ms | change |
|---|---|---|---|---|
| 1975 c=95 | high | 12.50 | 14.44 | +15.5 % |
| 1984 c=95 | high | 12.20 | 14.31 | +17.3 % |
| 1984 c=5 | high | 11.87 | 14.20 | +19.6 % |
| 1975 c=95 | medium | 7.58 | 8.58 | +13.2 % |
| 1984 c=95 | medium | 7.43 | 8.56 | +15.2 % |
| 1984 c=5 | medium | 6.89 | 8.26 | +19.9 % |
| 1975 c=95 | low | 2.38 | 2.42 | +1.7 % |
| 1984 c=95 | low | 2.32 | 2.49 | +7.3 % |
| 1984 c=5 | low | 2.53 | 2.67 | +5.5 % |

**Fails the 5 % budget** on high and medium (+13 to +20 %) and marginally on low (two of three rows over 5 %). Stopped here as the brief says; open for the user. The art-gate fixes add no draw calls, and in 1975/1984 only a few boxes per car (split seat backs); the measured queries have no animals.

## Fact check

(pending)
