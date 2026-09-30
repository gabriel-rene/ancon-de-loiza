# Phase 4c — Things that move: the ferry's load and the 1986 bridge traffic (approved in chat 2026-09-29)

Parent spec: [`2026-09-26-ancon-loiza-design.md`](2026-09-26-ancon-loiza-design.md) (§3 eras, §13 crossing). Previous phases: [`2026-09-28-phase-4a-ferry-place-design.md`](2026-09-28-phase-4a-ferry-place-design.md), [`2026-09-28-phase-4b-town-design.md`](2026-09-28-phase-4b-town-design.md). Research base: [`docs/research/ancon-research.md`](../../research/ancon-research.md) §2, §6, §9; source IDs `[S#]` refer to it and to `src/data/sources.ts`.

## 1. Scope

Phase 4 is split in three (ruling in chat 2026-09-28): **4a** the ferry's place (shipped), **4b** the town (shipped), **4c** things that move. This spec is 4c only.

User rulings in chat, 2026-09-29:

- 4c = **the load on the ferry** (cars, carts, animals, bicycles) **plus the 1986 bridge traffic**. Life on land (street traffic in town, people on the landings) is not in 4c.
- The load **drives on and off** at each dock stop. It does not fade in or out.
- Vehicles, carts and animals are **built in code** from simple shapes, like the rest of the sim. No model files.
- The next load **waits in a line** at the far landing while the ferry crosses.

4c builds:

- A vehicle kit and the period vehicle models (§3).
- Oxen, horse, ox cart, cane cart, bicycle (§3).
- A load plan per era and per leg (§2).
- Routes and motion for boarding, riding, leaving and waiting (§4).
- A `sit` pose for drivers (§5).
- Bridge traffic in 1986 (§6).
- Longer dock stops in the busy eras (§4.3).

Branch: `phase-4c-traffic`. Merge to `main` only after the user approves.

Not in 4c: street traffic in town; people on the landings or roads other than the load and its people; the barge sinking under load; sounds; birds and other fauna (Phase 5); new info-panel facts; the drivable first-person car (a later release; §8 keeps its hooks).

### 1.1 Frame rule (user ruling, 2026-09-28)

Build only what the `ride` camera shows. So:

- Deck load and the waiting line get full detail: they are 2–150 m from the camera.
- Vehicles appear and disappear only at road points the ride camera does not frame, or where they are too far away to see the change (§4.2).
- Bridge cars use a low-detail version of the same models: the bridge is ≥ 150 m from the ferry.

## 2. The load per era

All vehicle models, colours and mixes are inferred (L) unless a source is named. Each value is `Sourced` in `eras.ts` (new field `ancon.load`); inferred values carry `inferred: true`.

| Era | Deck slots (existing data) | Load per leg | Sources |
|---|---|---|---|
| `1840` | 0 (cargo) | even legs: ox cart (2 yoked oxen + driver on foot); odd legs: led horse | carts and animals inferred from function [S3] L |
| `1900` | 0 (cargo) | even legs: cane cart (2 yoked oxen + driver on foot); odd legs: cane workers only | cane workers [S1] H; cane cart inferred L |
| `1925` | 1 | legs cycle: ox cart → Model T → led horse | "1 car or ox cart plus people and horses" [S4] L (caption not found in the fact check, 2026-09-29); model inferred L |
| `1935` | 1 | one car, Model A type | one-vehicle platform [S4] H; model inferred L |
| `1959` | 4 | 4 cars, one of them a público (sedan with a roof sign) | público car ~1959 [S4] H; other models inferred L |
| `1975` | 6 | 6 cars (sedans, station wagons); every 4th leg, 2 of them are TV vans | a TV crew crossed with 2 vehicles [S4] L ("vans" unconfirmed, fact check 2026-09-29); models inferred L |
| `1984` | 8 | 8 cars (US sedans, Japanese compacts); 2 bicycles pushed on by hand | 6–8 cars [S1][S4] H; bicycles on the barge inferred L (S4 shows bicycles at the station, none on board; fact check 2026-09-29); models inferred L |
| `1986` | — | none (ferry moored); bridge traffic (§6) | bridge open [S1] H |

Rules:

- **Per leg.** The load of leg `n` is a pure function of the era and `legIndex` (seeded hash): which model sits in which slot, and its paint. Same clock → same load.
- **Slots.** Cars park on the existing `car` seat anchors (`src/ancon/seats.ts`). Carts and animals use the `cargo` anchor, which grows to fit an ox pair and cart (≈ 5.5 × 1.8 m) on the 8–8.5 m timber barges, clear of the helmsman at both ends. The 1925 platform's single slot takes the ox cart or the car.
- **Paint.** Each era gets a small palette of period paint colours (inferred L): muted dark colours before 1950; two-tone and pastels in 1959; bolder solids and white in 1975–86. Públicos keep one fixed look per era.
- **People with the load.** Each car has a seated driver (§5). The ox driver walks beside the oxen. The horse is led by a walking person. Each bicycle is pushed by a walking person. These people are extra to the era's `passengers` count.
- **Fit (plan ruling, 2026-09-29).** Cars are at most 4.1 m long (the 4.4 m slots). A passenger whose standing spot, or whose walk to it, meets the leg's parked load is not on board that leg. With a helmsman (1840–1925), he waits ashore beside the trailing end while the load drives on, then steps aboard. Rope haulers step to the rail (0.25 m outboard) while the ferry is docked. On two-lane decks passengers walk the centre corridor between the car lanes. 1984 bicycles park along the rail on the side without the hauler.

## 3. Vehicle kit and models

New folder `src/traffic/`. All geometry is made in code.

- **Car kit.** A car is: a body from a side profile, extruded and rounded in plan; a cabin (glasshouse) with glass panes; wheels (tyre, rim, hubcap); bumpers and trim in chrome or black; head and tail lights; for públicos, a roof sign. Parameters: length, width, heights, wheelbase, wheel size, profile points, cabin profile.
- **Models** (all inferred L): Model T (1925), Model A-type (1935), 1950s sedan and público (1959), 1970s sedan and station wagon, TV van (1975), 1980s US sedan and Japanese compact (1984, 1986 bridge).
- **Look.** Paint uses the scene's standard lit material with a clear-coat feel (roughness and environment reflection), glass is dark and reflective, chrome is bright. Up close from the deck, cars must not read as toys: bevelled edges, a visible wheel arch gap, and window frames.
- **Two detail levels.** `hi` for the deck, the ramps and the waiting line; `lo` for the bridge and far points.
- **Animals.** Ox and horse built from shaped parts (body, neck, head, legs in two segments, tail), with a 4-leg walk cycle and a stand idle. Oxen walk yoked in pairs.
- **Carts.** Ox cart (two big spoked wheels, plank bed, side rails, tongue to the yoke). Cane cart: the same with high side stakes and a load of cane.
- **Bicycle.** Frame, two wheels, handlebar, seat.

## 4. Routes and motion

### 4.1 One dock stop, in order

A leg ends with `unload` at the arrival bank and the next leg starts with `load` at the same bank. In that stop:

1. The ferry docks.
2. Vehicles drive straight off the far end of the deck, down the ramp and up the road. The ferry has two ends, so no vehicle turns on deck: each vehicle parks facing the way the ferry is going.
3. Passengers walk off (existing Phase 3 logic).
4. The waiting line drives on, one by one, and parks in the slots (the farthest slot first, as passengers do now).
5. Passengers walk on (existing logic), then the crew casts off.

Carts: the ox driver leads the oxen on; the oxen stop at the cargo anchor; they leave the same way. The horse and bicycles move like passengers, in the passenger lane.

### 4.2 Routes

- **Path.** Each vehicle follows a path made of: the story road (Calle Carlos Escobar on the east, the Antigua road on the west, from `src/infrastructure/roads.ts`) → the landing pad centre line → the deck slot → the other pad → the other story road.
- **Heights.** Wheels sit on the terrain along roads, on `landingTop` on the pads and ramps, and on the deck (vessel pose) on board. The body follows the slope (pitch from front and rear axles).
- **Ends.** Each road has an end point ≥ 60 m inland, chosen so that the ride camera does not frame it or the change cannot be seen at that distance. Vehicles appear there on the way in and go away there on the way out. Screenshots check this (§9).
- **Waiting line.** The next leg's load drives down the road during the crossing and stops in a line on the pad and road, nose to tail with a 1.5 m gap, the first vehicle at the top of the ramp. Carts and animals wait at the side of the line.
- **Speeds** (inferred L): 2.8 m/s on ramps and deck (ruling 2026-09-29: at 2 m/s the 1984 stop runs past 50 s; 2.8 is the lowest that fits), up to 6 m/s on the road, smooth starts and stops; oxen 0.9 m/s; horse and bicycles at walking speed (1.3 m/s).
- **Lanes** (ruling 2026-09-29). Roads keep right: the waiting line and the movers driving on use the right-hand lane, movers driving off the other lane, offset sideways along the road and the pad. Bicycles wait and leave on the verge on the side of the deck's bicycle rail. The queue head waits 10 m up the pad, where each mover can line up with its deck lane before the ramp.
- **No overlaps.** Vehicles in a line keep their gap; no vehicle passes through another, a person, the crew, or a hauler's rope station.

### 4.3 Timing

- Everything is a pure function of the crossing clock and the era, as the crew is now (`src/ancon/crew.ts`). Same clock → same picture.
- `load` and `unload` get longer where there is a load: a per-era timing, computed from the drive-on and drive-off plan, capped at 50 s each, never shorter than today's (load 20 s, unload 16 s). Passengers walk on after the load has parked and off after it has left (ruling 2026-09-29), so every era with a load gets a longer stop; an era without a load keeps today's timings.
- Everything that reads `CROSSING_TIMINGS` today (`crossing.ts`, `crew.ts`, `rideCamera.ts`, the URL clock) takes the era's timings. Crew and passenger schedules move with the longer stop.

## 5. People

- **`sit` pose.** New pose in `src/people/rig.ts`: seated, hands on the wheel. Only the upper body shows through the glass.
- Drivers, ox drivers, horse leaders and bicycle pushers use the existing figure batch and era clothing.
- The ox driver walks with a goad (a thin stick, reusing the pole part). Horse leaders and bicycle pushers use `walk` with hand targets.

## 6. Bridge traffic (1986)

- About 10 cars on the open bridge, both lanes, in both directions, from the 1984–86 models, `lo` detail.
- Cars follow the bridge's arched deck (`deckTop` in `bridge.ts`) and its approach roads, and appear and go away at approach-road points past both abutments.
- Speed about 11 m/s (40 km/h, inferred L), with fixed gaps; a pure function of the clock.
- The 1984 bridge under construction has no traffic.
- Check: does the 1986 `ride` view frame the bridge? If not, record it with the 4b deferred item about the 1986 moored heading, and tell the user. Do not change the ride rig in 4c without a ruling.

## 7. Performance

- 4c adds at most **14 draw calls** (plus their shadows) and **80 000 triangles** in any era.
- Instanced meshes: one per model and material part; people join the existing figure batch.
- On the low quality tier, the bridge loop drops to 6 cars. The deck load and the waiting line stay true to §2 on every tier.
- No new downloaded files.
- Frame rate on every tier stays within **5 %** of the 4b numbers. Measure before and after with the 2c method; record the numbers in `docs/superpowers/notes/phase-4c-rulings.md`.

## 8. Hooks kept

- The `car` seat anchors stay the only place a car parks on deck. A later drivable car will park on one.
- Vehicle poses are computed in world space from the vessel pose (`anchorToWorld`), so a later first-person camera can sit in a driver's seat.

## 9. Testing

- **Unit (vitest):**
  - `eras.ts`: every era has a `load`; its car count matches `ancon.cars`; schema test covers it.
  - Load plan: same era + leg → same load; 1925 alternates cart and car; 1975 TV vans every 4th leg; 1984 has 2 bicycles.
  - Paths: wheels on the pad, ramp and deck surfaces (within 3 cm); no two vehicles overlap at any sampled time; no vehicle overlaps a person, a hauler station or the helmsman; parked cars face the travel direction.
  - Timing: each vehicle is parked before cast-off and off the deck before the next load starts; load and unload ≤ 50 s and ≥ today's; an era whose plan fits keeps today's timings.
  - Waiting line: gaps ≥ 1.5 m; the first vehicle is at the ramp top when the ferry docks.
  - Bridge: cars stay on their lane and on the deck surface; gaps hold.
  - The §7 limits hold in every era.
- **Screenshots (Playwright):** `ride` view per era at cast-off, mid-crossing (waiting line in view) and during the dock stop; the 1986 bridge. Art gate against the quality-bar image and the research photos (V1), as in 4a/4b. Check that no vehicle pops in or out in frame.
- **Fact check:** a review agent checks the §2 claims against the named sources. The user sees only flagged items.
- **Frame rate:** as §7.
- **Code review** at the end, as in earlier phases.

## 10. Done when

- Each era shows the load in §2, driving on and off as in §4, with the waiting line.
- 1986 shows bridge traffic as in §6.
- The §7 limits hold.
- All tests pass, and the review has no open Important items.
