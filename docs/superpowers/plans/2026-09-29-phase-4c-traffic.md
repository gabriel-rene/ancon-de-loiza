# Phase 4c — Things that move Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per era, the ferry's load (cars, ox and cane carts, a led horse, pushed bicycles) waits in a line at the far landing, drives on at each dock stop, rides across on the deck and drives off up the road; in 1986, cars cross the open bridge.

**Architecture:** A new `src/traffic/` folder, pure units first: `models.ts` (sizes), `plan.ts` (which movers ride each leg and where they park), `trip.ts` (speed profiles), `env.ts` (the era's docks, frames and routes), `schedule.ts` (when each mover queues, boards and leaves; the era's dock timings), `motion.ts` (a mover's contact points and model matrix at a clock). Geometry: `carKit.ts`, `animals.ts`. Rendering: `TrafficSet.ts` (instanced meshes, driven from the ferry's `useFrame`, people drawn in the existing crew figure batch) and `BridgeTrafficMesh.tsx`. The crossing clock gets per-era timings (`VesselSpec.timings`), and the crew makes room for the load (`crew.ts`). Everything is a pure function of era + crossing clock.

**Tech Stack:** three 0.186, R3F 9, zustand, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-29-phase-4c-traffic-design.md` · Previous: `docs/superpowers/specs/2026-09-28-phase-4b-town-design.md`, `docs/superpowers/specs/2026-09-28-phase-4a-ferry-place-design.md` · Research: `docs/research/ancon-research.md` §2, §6, §9

## Global Constraints

- World frame: 1 unit = 1 m; +X east, +Y up, +Z south. `WATER_Y = 0`. three.js rotY: local +X → (cos, 0, −sin), local +Z → (sin, 0, cos).
- Model frame of every mover: origin on the ground under the midpoint of its two contact points, **+X forward, +Y up, +Z to the right** (so a driver in a left-hand-drive car sits at z < 0).
- Frame rule (user ruling 2026-09-28): build only what the `ride` camera shows. No street traffic in town, no people on the landings other than the load's own people, no fauna, no sounds.
- The load drives on and off; nothing fades in or out in frame. Movers appear and go away only at road ends ≥ 60 m inland (cars 110 m, animals 60 m) and at bridge approach ends.
- Every era value is `Sourced`; guesses set `inferred: true`. Source IDs must exist in `src/data/sources.ts`.
- All geometry is made in code. No downloaded files.
- Everything is a pure function of the era and the crossing clock (same clock ⇒ same picture). No per-frame allocation in `TrafficSet.update`, `moverFrame` or `BridgeTraffic`.
- Car length ≤ `CAR_SLOT.length − 0.3` = **4.1 m** (they park in the existing 4.4 m slots).
- Dock timings per era: `load` and `unload` each **≤ 50 s**, never shorter than today's (20 s, 16 s).
- Budget, any era: at most **14 draw calls** from 4c (plus shadow twins) and **80 000 triangles** visible at once. The crew figure batch is shared (its draw calls are not 4c's).
- Frame rate on every tier stays within **5 %** of the Task 1 baseline mean frame time.
- Branch `phase-4c-traffic` (already created; the spec is committed on it). Never push to `main`. Merge only after the user approves.
- Commit message bodies end, after a blank line, with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File map

```
docs/superpowers/notes/phase-4c-rulings.md          baseline numbers, rulings, deferred items (new)
docs/superpowers/specs/2026-09-29-phase-4c-traffic-design.md   §2 fit rulings (Task 1)
tests/snapshots/phase4c-before/, phase4c/           baseline and after screenshots (new)
tests/e2e/world.spec.ts                             default SNAP_DIR phase4c, 4c shots
src/ancon/crossing.ts, spec.ts, pose.ts, rideCamera.ts, crew.ts, Ancon.tsx   per-era timings (Task 2)
src/state/store.ts (+ test)                         crossingStart null = era default
src/data/eras.ts (+ eras.test.ts)                   ancon.load (Task 3)
src/traffic/models.ts (+ test)                      mover sizes (new)
src/traffic/plan.ts (+ test)                        one leg's movers, parking, paint, people (new)
src/traffic/trip.ts (+ test)                        trapezoid speed profiles (new)
src/traffic/env.ts (+ test)                         dock frames, routes, surfaces (new)
src/traffic/schedule.ts (+ test)                    queue / board / leave times, deck load, era timings (new)
src/traffic/motion.ts (+ test)                      mover frame at a clock (new)
src/traffic/testing.ts                              shared test fixtures (new)
src/ancon/crew.ts (+ crew.test.ts)                  crew makes room (Task 8)
src/people/rig.ts (+ rig.test.ts)                   'sit' pose (Task 9)
src/traffic/carKit.ts (+ test)                      car geometry, 9 models, hi/lo, wheel (new)
src/traffic/animals.ts (+ test)                     ox, horse, carts, bicycle geometry, gait (new)
src/traffic/materials.ts                            paint, glass, trim, dark, wheel, hide, wood (new)
src/traffic/TrafficSet.ts (+ test)                  instanced meshes, people, budget (new)
src/ancon/CrewSet.ts                                extra figure slots for the load's people
src/ancon/Ancon.tsx                                 mounts TrafficSet, era timings
src/traffic/bridgeTraffic.ts (+ test)               1986 bridge routes and cars (new)
src/traffic/BridgeTrafficMesh.tsx                       1986 bridge meshes (new)
src/quality.ts                                      traffic.bridgeCars per tier
src/scene/World.tsx                                 mounts <BridgeTraffic>
```

---

### Task 1: Baseline, shot list, spec fit rulings

**Files:**
- Modify: `tests/e2e/world.spec.ts:6`, `docs/superpowers/specs/2026-09-29-phase-4c-traffic-design.md` (§2 table and rules)
- Create: `docs/superpowers/notes/phase-4c-rulings.md`, `tests/snapshots/phase4c-before/*.png`

**Interfaces:**
- Produces: `world.spec.ts` default folder `phase4c`; the rulings note with the baseline table (Task 14 compares against it).

- [ ] **Step 1: Check the branch**

```bash
git branch --show-current
```

Expected: `phase-4c-traffic`.

- [ ] **Step 2: Record the spec fit rulings**

The decks are too small for some approved loads (measured from `eras.ts` and `seats.ts`): the 8 m colonial barge cannot hold an ox pair with cart **and** a horse, and its standing spots all lie inside the cart's footprint; the helmsman stands on the centre line where carts and the Model T drive on. Edit spec §2:

Replace the `1840`, `1900` and `1925` rows of the table with:

```markdown
| `1840` | 0 (cargo) | even legs: ox cart (2 yoked oxen + driver on foot); odd legs: led horse | carts and animals inferred from function [S3] L |
| `1900` | 0 (cargo) | even legs: cane cart (2 yoked oxen + driver on foot); odd legs: cane workers only | cane workers [S1] H; cane cart inferred L |
| `1925` | 1 | legs cycle: ox cart → Model T → led horse | "1 car or ox cart plus people and horses" [S4] H; model inferred L |
```

Append to the §2 **Rules** list:

```markdown
- **Fit (plan ruling, 2026-09-29).** Cars are at most 4.1 m long (the 4.4 m slots). A passenger whose standing spot, or whose walk to it, meets the leg's parked load is not on board that leg. With a helmsman (1840–1925), he waits ashore beside the trailing end while the load drives on, then steps aboard. Rope haulers step to the rail (0.25 m outboard) while the ferry is docked. On two-lane decks passengers walk the centre corridor between the car lanes. 1984 bicycles park along the rail on the side without the hauler.
```

- [ ] **Step 3: Point the shots at the 4c folder**

`tests/e2e/world.spec.ts:6`:

```ts
/** Output folder under tests/snapshots (SNAP_DIR=phase4c-before for the baseline run). */
const DIR = `tests/snapshots/${process.env.SNAP_DIR ?? 'phase4c'}`;
```

- [ ] **Step 4: Take the baseline screenshots**

```bash
SNAP_DIR=phase4c-before npx playwright test tests/e2e/world.spec.ts --grep-invert @slow
```

Expected: PASS (station and town shots skipped as before). Files in `tests/snapshots/phase4c-before/`.

- [ ] **Step 5: Measure the baseline frame rate**

Terminal A: `npm run build && npm run preview`. Terminal B, each query, recording the JSON line (dpr `2`; for `q=low` dpr `1`):

```bash
node scripts/dev/perf.mjs "?era=1975&cam=ride&t=17&c=95&freeze=1&q=high" 10 2
node scripts/dev/perf.mjs "?era=1984&cam=ride&t=17&c=95&freeze=1&q=high" 10 2
node scripts/dev/perf.mjs "?era=1984&cam=ride&t=17&c=5&freeze=1&q=high" 10 2
node scripts/dev/perf.mjs "?era=1975&cam=ride&t=17&c=95&freeze=1&q=medium" 10 2
node scripts/dev/perf.mjs "?era=1984&cam=ride&t=17&c=95&freeze=1&q=medium" 10 2
node scripts/dev/perf.mjs "?era=1984&cam=ride&t=17&c=5&freeze=1&q=medium" 10 2
node scripts/dev/perf.mjs "?era=1975&cam=ride&t=17&c=95&freeze=1&q=low" 10 1
node scripts/dev/perf.mjs "?era=1984&cam=ride&t=17&c=95&freeze=1&q=low" 10 1
node scripts/dev/perf.mjs "?era=1984&cam=ride&t=17&c=5&freeze=1&q=low" 10 1
```

- [ ] **Step 6: Write the rulings note**

Create `docs/superpowers/notes/phase-4c-rulings.md`:

```markdown
# Phase 4c rulings and notes

Spec: `docs/superpowers/specs/2026-09-29-phase-4c-traffic-design.md`. Plan: `docs/superpowers/plans/2026-09-29-phase-4c-traffic.md`.

## Fit rulings (Task 1)

Spec §2 amended: 1840 alternates ox cart / led horse; 1900 alternates cane cart / workers only; 1925 cycles ox cart → Model T → led horse; cars ≤ 4.1 m; passengers whose spot or walk meets the parked load stay ashore that leg; the helmsman waits ashore while the load boards; haulers step to the rail while docked; two-lane decks walk the centre corridor; 1984 bicycles along the hauler-free rail. Reason: deck sizes in `eras.ts` / `seats.ts` (8 m × 3 m colonial barge, 7 m × 3.2 m 1925 platform, 4.4 m car slots).

## Baseline (Task 1)

Frame rate before 4c (`perf.mjs`, 10 s, vsync and cap off, `freeze=1`, dpr 2 except low at dpr 1; real GPU, Metal).

| query | tier | fps | mean ms | p95 ms |
|---|---|---|---|---|
(one row per Step 5 line)
```

Fill the table from Step 5.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/world.spec.ts tests/snapshots/phase4c-before docs/superpowers/notes/phase-4c-rulings.md docs/superpowers/specs/2026-09-29-phase-4c-traffic-design.md
git commit -m "chore(4c): baseline shots and frame rate, spec fit rulings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Per-era crossing timings (no visible change)

The crossing clock reads one global `CROSSING_TIMINGS`. 4c lengthens the dock stop in busy eras, so the timings move onto `VesselSpec`. This task only moves them; every era still uses today's values.

**Files:**
- Modify: `src/ancon/crossing.ts:11`, `src/ancon/spec.ts`, `src/ancon/pose.ts:55`, `src/ancon/rideCamera.ts:101`, `src/ancon/crew.ts` (all `T.` / `MOVE_END` / `LEAVE0` uses), `src/ancon/Ancon.tsx`, `src/state/store.ts`, `src/state/store.test.ts`
- Test: `src/ancon/crew.test.ts`, `src/ancon/rideCamera.test.ts`, `src/ancon/crossing.test.ts`

**Interfaces:**
- Produces:
  - `VesselSpec.timings: CrossingTimings`; `vesselSpec(era: Era, timings?: CrossingTimings): VesselSpec` (default `CROSSING_TIMINGS`).
  - `defaultCrossingStart(T: CrossingTimings): number` = `T.load − 8`; `DEFAULT_CROSSING_START` stays `12`.
  - `moveEnd(T: CrossingTimings): number` (crew.ts) = `T.load + T.castOff + T.cross + T.dock`. `MOVE_END` is removed.
  - `PassengerWalk.leave` now holds seconds **after unload start** (was: seconds into the leg).
  - Store: `crossingStart: number | null` (null = the era's default).

- [ ] **Step 1: Write the failing tests**

In `src/ancon/crossing.test.ts`, replace:

```ts
import { advanceClock, createCrossingState, CROSSING_TIMINGS as T, crossingState, legDuration, mooredState, PHASES } from './crossing';
```

with:

```ts
import { advanceClock, createCrossingState, CROSSING_TIMINGS, CROSSING_TIMINGS as T, crossingState, legDuration, mooredState, PHASES } from './crossing';
```

Append to `src/ancon/crossing.test.ts`:

```ts
import { defaultCrossingStart } from './crossing';

test('the default start is 8 s before cast-off for any timings', () => {
  expect(defaultCrossingStart(CROSSING_TIMINGS)).toBe(12);
  expect(defaultCrossingStart({ ...CROSSING_TIMINGS, load: 45 })).toBe(37);
});
```

Append to `src/ancon/crew.test.ts`:

```ts
import { moveEnd } from './crew';

describe('per-era timings', () => {
  test('a longer dock stop moves the whole choreography with it', () => {
    const era = getEra('1975'), T2 = { ...T, load: 40, unload: 30 };
    const spec = vesselSpec(era, T2), layout = deckLayout(spec), actors = castActors(spec, seatAnchors(spec, layout), 1975);
    const ctx = { spec, layout };
    const at = (c: number, a: Actor) => actorFrame(a, crossingState(c, createCrossingState(), T2), c, ctx, createActorFrame());
    const pax = actors.filter((a) => a.role === 'passenger');
    // Nobody leaves before unload starts, and everybody is off before the leg ends.
    const U = moveEnd(T2), Lg = legDuration(T2);
    for (const a of pax) {
      expect(at(U - 0.5, a).visible).toBe(true);
      expect(at(Lg - 0.01, a).visible).toBe(false);
    }
    // Haulers still haul mid-crossing.
    const mid = T2.load + T2.castOff + T2.cross / 2;
    for (const a of actors.filter((x) => x.role === 'hauler')) expect(at(mid, a).pose.kind).toBe('haul');
  });
});
```

In `src/ancon/rideCamera.test.ts`, replace:

```ts
import { CROSSING_TIMINGS as T, legDuration } from './crossing';
```

with:

```ts
import { CROSSING_TIMINGS, CROSSING_TIMINGS as T, legDuration } from './crossing';
```

Append to `src/ancon/rideCamera.test.ts`:

```ts
test('rideYaw follows the timings it is given', () => {
  const T2 = { ...CROSSING_TIMINGS, load: 40, unload: 30 }, L2 = legDuration(T2);
  const mid2 = T2.load + T2.castOff + T2.cross / 2;
  expect(Math.cos(rideYaw(mid2, false, T2))).toBeCloseTo(1, 9);
  expect(Math.cos(rideYaw(L2 + mid2, false, T2))).toBeCloseTo(-1, 9);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/ancon/crossing.test.ts src/ancon/crew.test.ts src/ancon/rideCamera.test.ts`
Expected: FAIL — `defaultCrossingStart` / `moveEnd` not exported; `vesselSpec` ignores its second argument.

- [ ] **Step 3: Move the timings**

Every edit below is exact; together they are the whole change (`tsc` reports nothing else).

In `src/ancon/crossing.ts`, replace:

```ts
export const DEFAULT_CROSSING_START = 12;
```

with:

```ts
export const defaultCrossingStart = (T: CrossingTimings) => T.load - 8;
export const DEFAULT_CROSSING_START = defaultCrossingStart(CROSSING_TIMINGS);
```

In `src/ancon/spec.ts`, replace:

```ts
import type { ClothingStyle, Era, Propulsion, VesselKind } from '../data/eras';
```

with:

```ts
import type { ClothingStyle, Era, Propulsion, VesselKind } from '../data/eras';
import { CROSSING_TIMINGS, type CrossingTimings } from './crossing';
```

In `src/ancon/spec.ts`, replace:

```ts
  moored: boolean;
}
```

with:

```ts
  moored: boolean;
  /** This era's crossing phase lengths (4c: longer dock stops where the load needs them, src/traffic/schedule.ts). */
  timings: CrossingTimings;
}
```

In `src/ancon/spec.ts`, replace:

```ts
export function vesselSpec(era: Era): VesselSpec {
```

with:

```ts
export function vesselSpec(era: Era, timings: CrossingTimings = CROSSING_TIMINGS): VesselSpec {
```

In `src/ancon/spec.ts`, replace:

```ts
moored: a.propulsion.value === 'moored',
```

with:

```ts
moored: a.propulsion.value === 'moored', timings,
```

In `src/ancon/pose.ts`, replace:

```ts
else crossingState(clock, st);
```

with:

```ts
else crossingState(clock, st, spec.timings);
```

In `src/ancon/rideCamera.ts`, replace:

```ts
rideYaw(pose.clock, ctx.spec.moored)
```

with:

```ts
rideYaw(pose.clock, ctx.spec.moored, ctx.spec.timings)
```

In `src/ancon/crew.ts`, replace:

```ts
import { CROSSING_TIMINGS as T, type CrossingState } from './crossing';
```

with:

```ts
import { type CrossingState, type CrossingTimings } from './crossing';
```

In `src/ancon/crew.ts`, replace:

```ts
/** Seconds into a leg when unloading starts. */
export const MOVE_END = T.load + T.castOff + T.cross + T.dock;
```

with:

```ts
/** Seconds into a leg when unloading starts. */
export const moveEnd = (T: CrossingTimings) => T.load + T.castOff + T.cross + T.dock;
```

In `src/ancon/crew.ts`, replace:

```ts
/** Boarding: first start (s into the leg) and the interval between passengers; leaving: earliest start; spacing in single file (m). */
export const BOARD0 = 1, BOARD_GAP = 0.9, LEAVE0 = MOVE_END + 0.3, FILE_GAP = 0.8;
```

with:

```ts
/** Boarding: first start (s into the leg) and the interval between passengers; leaving: earliest start (s after unload starts); spacing in single file (m). */
export const BOARD0 = 1, BOARD_GAP = 0.9, LEAVE0 = 0.3, FILE_GAP = 0.8;
```

In `src/ancon/crew.ts`, replace:

```ts
function poler(a: Actor, st: CrossingState, { spec, layout: L }: ActorCtx, f: ActorFrame) {
```

with:

```ts
function poler(a: Actor, st: CrossingState, { spec, layout: L }: ActorCtx, f: ActorFrame) {
  const T = spec.timings, MOVE_END = moveEnd(T);
```

In `src/ancon/crew.ts`, replace:

```ts
const polerWalkStart = (spec: VesselSpec, L: DeckLayout) => (spec.helmsman ? helmWalkStart(L) : MOVE_END) + 0.5;
```

with:

```ts
const polerWalkStart = (spec: VesselSpec, L: DeckLayout) => (spec.helmsman ? helmWalkStart(L, spec.timings) : moveEnd(spec.timings)) + 0.5;
```

In `src/ancon/crew.ts`, replace:

```ts
const helmWalkStart = (L: DeckLayout) => MOVE_END + T.unload - 0.5 - (2 * (L.halfLength - 0.5)) / WALK_SPEED;
```

with:

```ts
const helmWalkStart = (L: DeckLayout, T: CrossingTimings) => moveEnd(T) + T.unload - 0.5 - (2 * (L.halfLength - 0.5)) / WALK_SPEED;
```

In `src/ancon/crew.ts`, replace:

```ts
function helmsman(st: CrossingState, clock: number, { layout: L, groundLocal }: ActorCtx, f: ActorFrame) {
```

with:

```ts
function helmsman(st: CrossingState, clock: number, { spec, layout: L, groundLocal }: ActorCtx, f: ActorFrame) {
  const T = spec.timings, MOVE_END = moveEnd(T);
```

In `src/ancon/crew.ts`, replace:

```ts
const t0 = helmWalkStart(L), d =
```

with:

```ts
const t0 = helmWalkStart(L, T), d =
```

In `src/ancon/crew.ts`, replace:

```ts
function passenger(a: Actor, st: CrossingState, clock: number, { layout: L }: ActorCtx, f: ActorFrame) {
```

with:

```ts
function passenger(a: Actor, st: CrossingState, clock: number, { spec, layout: L }: ActorCtx, f: ActorFrame) {
  const T = spec.timings, MOVE_END = moveEnd(T);
```

In `src/ancon/crew.ts`, replace:

```ts
const l0 = w.leave[k], lc
```

with:

```ts
const l0 = MOVE_END + w.leave[k], lc
```

In `src/ancon/crew.ts`, replace:

```ts
to the spot; leaving, the reverse toward the arrival end. Start times (s into the leg) per travel direction
```

with:

```ts
to the spot; leaving, the reverse toward the arrival end. Start times per travel direction (boarding: s into the leg; leaving: s after unload starts)
```

In `src/state/store.ts`, replace:

```ts
import { DEFAULT_CROSSING_START } from '../ancon/crossing';
```

with:

```ts

```

In `src/state/store.ts`, replace:

```ts
crossingStart: number; crossingSpeed
```

with:

```ts
crossingStart: number | null; crossingSpeed
```

In `src/state/store.ts`, replace:

```ts
crossingStart: DEFAULT_CROSSING_START,
```

with:

```ts
crossingStart: null,
```

In `src/ancon/Ancon.tsx`, replace:

```tsx
import { advanceClock } from './crossing';
```

with:

```tsx
import { advanceClock, defaultCrossingStart } from './crossing';
```

In `src/ancon/Ancon.tsx`, replace:

```tsx
const clock = useRef(start);
  useEffect(() => { clock.current = start; }, [start]);
```

with:

```tsx
const clock = useRef(start ?? defaultCrossingStart(spec.timings));
  useEffect(() => { clock.current = start ?? defaultCrossingStart(spec.timings); }, [start]);   // era switches keep the running clock (as before)
```

In `src/state/store.test.ts`, replace:

```ts
expect(s.crossingStart).toBe(DEFAULT_CROSSING_START);
```

with:

```ts
expect(s.crossingStart).toBeNull();
```

In `src/state/store.test.ts`, replace:

```ts
crossingState(useStore.getState().crossingStart, createCrossingState())
```

with:

```ts
crossingState(useStore.getState().crossingStart ?? DEFAULT_CROSSING_START, createCrossingState())
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run && npx tsc -p tsconfig.json --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/ancon src/state
git commit -m "refactor(4c): crossing timings per vessel spec; default start follows the era's load

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The load per era in `eras.ts`

**Files:**
- Modify: `src/data/eras.ts` (types after line 29, `AnconEra`, `ANCON`)
- Test: `src/data/eras.test.ts`

**Interfaces:**
- Produces:

```ts
export type CarModel = 'modelT' | 'modelA' | 'sedan50' | 'publico' | 'sedan70' | 'wagon70' | 'tvVan' | 'sedan80' | 'compact80';
export type AnimalLoad = 'oxCart' | 'caneCart' | 'horse';
export interface LegRule { animal?: AnimalLoad; cars: number; fixed: CarModel[]; pool: CarModel[]; bicycles: number }
AnconEra.load: Sourced<LegRule[]>   // leg n uses load.value[n mod length]; [] = no load
```

- [ ] **Step 1: Write the failing test**

Append to `src/data/eras.test.ts` inside `describe('eras', …)`:

```ts
  test('the ferry load per era (spec 4c §2)', () => {
    const load = (id: EraId) => getEra(id).ancon.load.value;
    for (const e of ERAS) for (const r of e.ancon.load.value) {
      expect(r.cars, e.id).toBeLessThanOrEqual(e.ancon.cars.value);
      expect(r.fixed.length, e.id).toBeLessThanOrEqual(r.cars);
      if (r.cars > r.fixed.length) expect(r.pool.length, e.id).toBeGreaterThan(0);
      if (r.animal) expect(r.cars, e.id).toBe(0);
    }
    expect(load('1840').map((r) => r.animal)).toEqual(['oxCart', 'horse']);
    expect(load('1900').map((r) => r.animal)).toEqual(['caneCart', undefined]);
    expect(load('1925').map((r) => r.animal ?? r.fixed[0])).toEqual(['oxCart', 'modelT', 'horse']);
    expect(load('1935')).toEqual([{ cars: 1, fixed: [], pool: ['modelA'], bicycles: 0 }]);
    expect(load('1959')[0].fixed).toEqual(['publico']);
    expect(load('1975').length).toBe(4);
    expect(load('1975')[0].fixed).toEqual(['tvVan', 'tvVan']);
    expect(load('1975').slice(1).every((r) => r.fixed.length === 0 && r.cars === 6)).toBe(true);
    expect(load('1984')).toEqual([{ cars: 8, fixed: [], pool: ['sedan80', 'compact80'], bicycles: 2 }]);
    expect(load('1986')).toEqual([]);
    expect(getEra('1984').ancon.load.sources).toContain('S4');
    expect(getEra('1975').ancon.load.sources).toEqual(expect.arrayContaining(['S1', 'S4']));
  });
```

(Import `type EraId` from `./eras`.)

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/data/eras.test.ts`
Expected: FAIL — `load` is undefined.

- [ ] **Step 3: Add the data**

`src/data/eras.ts`, after the `Infrastructure` interface:

```ts
/** Phase 4c vehicles (spec 4c §3). Models are inferred period types (L), sized for the 4.4 m deck slots. */
export type CarModel = 'modelT' | 'modelA' | 'sedan50' | 'publico' | 'sedan70' | 'wagon70' | 'tvVan' | 'sedan80' | 'compact80';
export type AnimalLoad = 'oxCart' | 'caneCart' | 'horse';
/**
 * One leg's load (spec 4c §2). Leg n of an era uses `load.value[n mod length]`. `fixed` models take the first
 * slots in boarding order; the other `cars − fixed.length` slots draw from `pool` (seeded by the leg).
 */
export interface LegRule { animal?: AnimalLoad; cars: number; fixed: CarModel[]; pool: CarModel[]; bicycles: number }
```

In `AnconEra`, after `clothing`:

```ts
  /** Phase 4c: the vehicles, carts and animals each leg carries (cycled by leg). [] = none. */
  load: Sourced<LegRule[]>;
```

Above `const ANCON`:

```ts
// Phase 4c (spec 4c §2, fit rulings in docs/superpowers/notes/phase-4c-rulings.md). Carts and animals before the
// cars are inferred from the crossing's function [S3] and the 1920s caption "1 car or ox cart plus people and horses"
// [S4]; públicos about 1959 [S4]; TV vans two at a time in the 1970s [S1][S4]; bicycles in the 1980s photos [S4].
// Every model and the leg cycles are inferred.
const leg = (r: Partial<LegRule>): LegRule => ({ cars: 0, fixed: [], pool: [], bicycles: 0, ...r });
const LOAD = {
  '1840': s([leg({ animal: 'oxCart' }), leg({ animal: 'horse' })], ['S3'], 'L', true),
  '1900': s([leg({ animal: 'caneCart' }), leg({})], ['S1'], 'L', true),
  '1925': s([leg({ animal: 'oxCart' }), leg({ cars: 1, fixed: ['modelT'] }), leg({ animal: 'horse' })], ['S4'], 'M', true),
  '1935': s([leg({ cars: 1, pool: ['modelA'] })], ['S4'], 'M', true),
  '1959': s([leg({ cars: 4, fixed: ['publico'], pool: ['sedan50'] })], ['S4'], 'M', true),
  '1975': s([
    leg({ cars: 6, fixed: ['tvVan', 'tvVan'], pool: ['sedan70', 'wagon70'] }),
    ...[1, 2, 3].map(() => leg({ cars: 6, pool: ['sedan70', 'wagon70'] })),
  ], ['S1', 'S4'], 'M', true),
  '1984': s([leg({ cars: 8, pool: ['sedan80', 'compact80'], bicycles: 2 })], ['S1', 'S4'], 'M', true),
  '1986': s<LegRule[]>([], ['S1', 'S4'], 'H'),
} satisfies Record<EraId, Sourced<LegRule[]>>;
```

Add `load: LOAD['<id>']` to each of the eight `ANCON` entries (e.g. `…, clothing: WEAR('colonial'), load: LOAD['1840'] },`).

Note: `leg({ cars: 1, pool: ['modelA'] })` must deep-equal `{ cars: 1, fixed: [], pool: ['modelA'], bicycles: 0 }` (key order does not matter to `toEqual`).

- [ ] **Step 4: Run the era tests**

Run: `npx vitest run src/data`
Expected: PASS (the generic "sourced or inferred" test now covers `load` too).

- [ ] **Step 5: Commit**

```bash
git add src/data/eras.ts src/data/eras.test.ts
git commit -m "feat(4c): ferry load per era in eras.ts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Mover sizes and one leg's movers

**Files:**
- Create: `src/traffic/models.ts`, `src/traffic/models.test.ts`, `src/traffic/plan.ts`, `src/traffic/plan.test.ts`

**Preflight rulings applied:** B1 (the boarding-order test compares body centres, not the contact-midpoint origin), B2 (a one-poler deck checks only the poler's side), B3 (a bicycle's pusher walks on its outboard side whichever way it faces), R3 (an animal's `front` reaches its drawn muzzle, about 1.0 m past the front hooves; the 1925 platform still fits), N2 (`PAINT` exported for the bridge cars).

**Interfaces:**
- Consumes: `LegRule`, `CarModel`, `AnimalLoad` (Task 3); `VesselSpec`, `DeckLayout`, `CAR_SLOT`, `seatAnchors`, `SeatAnchor` (`src/ancon`); `hash3` (`src/vegetation/rng.ts`). (Looks for the load's people are per figure slot, Task 12, not per mover.)
- Produces (`models.ts`):

```ts
export type MoverKind = CarModel | AnimalLoad | 'bicycle';
export interface MoverDims { length: number; width: number; height: number; wheelbase: number; front: number; wheelR: number; track: number }
export const DIMS: Record<MoverKind, MoverDims>;              // oxCart 5.8 m, caneCart 6.0 m, horse 2.65 m (front 1.0)
export const rearOverhang: (d: MoverDims) => number;          // length − front − wheelbase
export const isCar: (k: MoverKind) => k is CarModel;
export const isAnimal: (k: MoverKind) => k is AnimalLoad;
export const MAX_CAR_LENGTH = 4.1;
```

- Produces (`plan.ts`):

```ts
export interface MoverPerson { role: 'driver' | 'attendant'; at: [number, number, number]; goad: boolean }
export interface Mover {
  id: string; leg: number; order: number; kind: MoverKind; paint: number; dims: MoverDims;
  /** Parked model origin, travel frame: x' toward the leading end (deck-local x = travel · x'), z deck-local. */
  park: { x: number; z: number };
  people: MoverPerson[];
}
export const travelOf: (leg: number) => 1 | -1;              // even legs +1 (east → west)
export const PAINT: Record<number, number[]>;                // period paint per era (the 1986 bridge cars use PAINT[1984])
export function legMovers(rules: readonly LegRule[], spec: VesselSpec, L: DeckLayout, seats: readonly SeatAnchor[], era: number, leg: number): Mover[];
export function footprint(m: Mover, travel: 1 | -1, pad?: number): [number, number, number, number];   // parked, deck-local [x0, x1, z0, z1], people included
export const ATTEND_AHEAD = 0.55, ATTEND_SIDE = 0.35, BIKE_RAIL = 0.75, BIKE_PUSH = 0.45;
```

- [ ] **Step 1: Write the failing tests**

Create `src/traffic/models.test.ts`:

```ts
import { expect, test } from 'vitest';
import { CAR_SLOT } from '../ancon/spec';
import { DIMS, isAnimal, isCar, MAX_CAR_LENGTH, rearOverhang, type MoverKind } from './models';

test('every car fits a deck slot with room to spare', () => {
  expect(MAX_CAR_LENGTH).toBeCloseTo(CAR_SLOT.length - 0.3, 9);
  for (const k of Object.keys(DIMS) as MoverKind[]) if (isCar(k)) {
    expect(DIMS[k].length, k).toBeLessThanOrEqual(MAX_CAR_LENGTH);
    expect(DIMS[k].width, k).toBeLessThanOrEqual(CAR_SLOT.width - 0.5);
  }
});

test('contacts lie inside the body and overhangs are positive', () => {
  for (const k of Object.keys(DIMS) as MoverKind[]) {
    const d = DIMS[k];
    expect(d.front, k).toBeGreaterThan(0);
    expect(rearOverhang(d), k).toBeGreaterThan(0);
    expect(d.wheelbase, k).toBeGreaterThan(0.5);
  }
  expect(isAnimal('horse')).toBe(true); expect(isCar('horse')).toBe(false); expect(isCar('publico')).toBe(true);
});

test('carts clear the polers on the narrow colonial barge (half width ≤ 0.8 m)', () => {
  expect(DIMS.oxCart.width / 2).toBeLessThanOrEqual(0.8);
  expect(DIMS.caneCart.width / 2).toBeLessThanOrEqual(0.8);
  expect(DIMS.horse.width / 2).toBeLessThanOrEqual(0.3);
});
```

Create `src/traffic/plan.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { ERAS, getEra, type EraId } from '../data/eras';
import { seatAnchors } from '../ancon/seats';
import { deckLayout, vesselSpec } from '../ancon/spec';
import { rearOverhang, type MoverDims } from './models';
import { footprint, legMovers, travelOf } from './plan';

const planFor = (id: EraId, leg: number) => {
  const era = getEra(id), spec = vesselSpec(era), L = deckLayout(spec);
  return { spec, L, movers: legMovers(era.ancon.load.value, spec, L, seatAnchors(spec, L), Number(id), leg) };
};
/** Body centre along x' (the parked origin is the contact midpoint, which sits off-centre by (front − rear) / 2). */
const centre = (x: number, d: MoverDims) => x + (d.front - rearOverhang(d)) / 2;
const overlap = (a: number[], b: number[]) => a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3];

describe('legMovers', () => {
  test('same era and leg ⇒ same movers; legs cycle', () => {
    expect(planFor('1975', 5)).toEqual(planFor('1975', 5));
    expect(planFor('1975', 4).movers.filter((m) => m.kind === 'tvVan').length).toBe(2);
    expect(planFor('1975', 5).movers.filter((m) => m.kind === 'tvVan').length).toBe(0);
    expect(planFor('1925', 0).movers.map((m) => m.kind)).toEqual(['oxCart']);
    expect(planFor('1925', 1).movers.map((m) => m.kind)).toEqual(['modelT']);
    expect(planFor('1925', 2).movers.map((m) => m.kind)).toEqual(['horse']);
    expect(planFor('1925', -1).movers.map((m) => m.kind)).toEqual(['horse']);   // negative legs cycle too
    expect(planFor('1900', 1).movers).toEqual([]);
    expect(planFor('1986', 0).movers).toEqual([]);
  });

  test('counts, drivers and attendants', () => {
    const p = planFor('1984', 0).movers;
    expect(p.filter((m) => m.kind === 'bicycle').length).toBe(2);
    expect(p.length).toBe(10);
    for (const m of p) expect(m.people.length).toBe(1);
    expect(p.filter((m) => m.people[0].role === 'driver').length).toBe(8);
    expect(planFor('1959', 3).movers[0].kind).toBe('publico');
    const ox = planFor('1840', 0).movers[0];
    expect(ox.people[0]).toMatchObject({ role: 'attendant', goad: true });
    expect(planFor('1840', 1).movers[0].people[0].goad).toBe(false);   // the horse is led, not goaded
    // Drivers sit on the left (left-hand drive: model z < 0).
    for (const m of p.filter((x) => x.people[0].role === 'driver')) expect(m.people[0].at[2]).toBeLessThan(0);
  });

  test('boarding order: the farthest from the entry end first', () => {
    for (const id of ['1959', '1975', '1984'] as const) {
      const cars = planFor(id, 0).movers.filter((m) => m.kind !== 'bicycle');
      for (let k = 1; k < cars.length; k++) expect(centre(cars[k].park.x, cars[k].dims)).toBeLessThanOrEqual(centre(cars[k - 1].park.x, cars[k - 1].dims) + 1e-9);
      expect(cars.map((m) => m.order)).toEqual(cars.map((_, k) => k));
    }
  });

  test('parked loads stay on deck, clear of each other, the helmsman and the crew lanes', () => {
    for (const e of ERAS) for (let leg = 0; leg < 4; leg++) {
      const { spec, L, movers } = planFor(e.id, leg), tr = travelOf(leg);
      const fps = movers.map((m) => footprint(m, tr));
      for (const f of fps) {
        expect(Math.max(Math.abs(f[0]), Math.abs(f[1])), e.id).toBeLessThanOrEqual(L.halfLength + 1e-9);
        expect(Math.max(Math.abs(f[2]), Math.abs(f[3])), e.id).toBeLessThanOrEqual(L.halfBeam + 1e-9);
      }
      for (let i = 0; i < fps.length; i++) for (let j = i + 1; j < fps.length; j++) expect(overlap(fps[i], fps[j]), `${e.id} ${leg}`).toBe(false);
      if (spec.helmsman) {   // the helmsman's station at the trailing end (x = −tr·(hl − 0.5), z = 0, r 0.25)
        const hx = -tr * (L.halfLength - 0.5), helm = [hx - 0.25, hx + 0.25, -0.25, 0.25];
        for (const f of fps) expect(overlap(f, helm), e.id).toBe(false);
      }
      if (spec.propulsion === 'poles') for (const f of fps) {   // polers walk the side lanes (r 0.25); one poler walks side +z only
        const lane = L.halfBeam - 0.45 - 0.25 + 1e-9;
        expect(f[3], e.id).toBeLessThanOrEqual(lane);
        if (spec.crew >= 2) expect(-f[2], e.id).toBeLessThanOrEqual(lane);
      }
    }
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/traffic`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write `models.ts`**

Create `src/traffic/models.ts`:

```ts
import type { AnimalLoad, CarModel } from '../data/eras';
import { CAR_SLOT } from '../ancon/spec';

/** Every thing that rides the ferry (spec 4c §3). */
export type MoverKind = CarModel | AnimalLoad | 'bicycle';
/**
 * Sizes (m). Two contact points carry every mover: axles for cars, carts and bicycles (a cart's front contact is
 * its oxen's front hooves, its rear the cart axle), hoof pairs for a horse. `front`: nose ahead of the front contact;
 * `track`: half the distance between left and right wheels (0 on a bicycle). Animals: `front` reaches the
 * drawn muzzle (src/traffic/animals.ts, about 0.93 m ahead of the front hooves). All inferred period types (L), sized
 * for the 4.4 m deck slots.
 */
export interface MoverDims { length: number; width: number; height: number; wheelbase: number; front: number; wheelR: number; track: number }
export const MAX_CAR_LENGTH = CAR_SLOT.length - 0.3;
export const DIMS: Record<MoverKind, MoverDims> = {
  modelT: { length: 3.4, width: 1.68, height: 2.05, wheelbase: 2.54, front: 0.45, wheelR: 0.38, track: 0.72 },
  modelA: { length: 3.85, width: 1.71, height: 1.85, wheelbase: 2.63, front: 0.62, wheelR: 0.36, track: 0.72 },
  sedan50: { length: 4.1, width: 1.8, height: 1.55, wheelbase: 2.6, front: 0.72, wheelR: 0.34, track: 0.74 },
  publico: { length: 4.1, width: 1.8, height: 1.55, wheelbase: 2.6, front: 0.72, wheelR: 0.34, track: 0.74 },
  sedan70: { length: 4.1, width: 1.85, height: 1.38, wheelbase: 2.62, front: 0.78, wheelR: 0.33, track: 0.76 },
  wagon70: { length: 4.1, width: 1.85, height: 1.42, wheelbase: 2.62, front: 0.78, wheelR: 0.33, track: 0.76 },
  tvVan: { length: 4.1, width: 1.9, height: 2.05, wheelbase: 2.5, front: 0.55, wheelR: 0.36, track: 0.78 },
  sedan80: { length: 4.1, width: 1.8, height: 1.36, wheelbase: 2.55, front: 0.8, wheelR: 0.32, track: 0.74 },
  compact80: { length: 3.95, width: 1.63, height: 1.38, wheelbase: 2.37, front: 0.72, wheelR: 0.3, track: 0.68 },
  oxCart: { length: 5.8, width: 1.55, height: 1.6, wheelbase: 3.6, front: 1.0, wheelR: 0.7, track: 0.72 },
  caneCart: { length: 6.0, width: 1.6, height: 2.1, wheelbase: 3.7, front: 1.0, wheelR: 0.72, track: 0.74 },
  horse: { length: 2.65, width: 0.6, height: 1.6, wheelbase: 1.2, front: 1.0, wheelR: 0, track: 0.18 },
  bicycle: { length: 1.75, width: 0.55, height: 1.05, wheelbase: 1.08, front: 0.34, wheelR: 0.34, track: 0 },
};
export const rearOverhang = (d: MoverDims) => d.length - d.front - d.wheelbase;
const CARS = new Set<MoverKind>(['modelT', 'modelA', 'sedan50', 'publico', 'sedan70', 'wagon70', 'tvVan', 'sedan80', 'compact80']);
export const isCar = (k: MoverKind): k is CarModel => CARS.has(k);
export const isAnimal = (k: MoverKind): k is AnimalLoad => k === 'oxCart' || k === 'caneCart' || k === 'horse';
```

- [ ] **Step 4: Write `plan.ts`**

Create `src/traffic/plan.ts`:

```ts
import type { SeatAnchor } from '../ancon/seats';
import type { DeckLayout, VesselSpec } from '../ancon/spec';
import type { CarModel, LegRule } from '../data/eras';
import { hash3 } from '../vegetation/rng';
import { DIMS, rearOverhang, type MoverDims, type MoverKind } from './models';

/** A driver (seated, model-local seat point) or an attendant on foot (model-local stand point). */
export interface MoverPerson { role: 'driver' | 'attendant'; at: [number, number, number]; goad: boolean }
export interface Mover {
  id: string; leg: number;
  /** Boarding order (0 boards first). */
  order: number;
  kind: MoverKind;
  /** Body paint, sRGB hex (cars); coat tint (animals); frame colour (bicycles). */
  paint: number;
  dims: MoverDims;
  /** Parked model origin in the travel frame: x' toward the leading end (deck-local x = travel · x'), z deck-local. */
  park: { x: number; z: number };
  people: MoverPerson[];
}

/** Leg n runs east → west (+1) when even. */
export const travelOf = (leg: number): 1 | -1 => (((leg % 2) + 2) % 2 === 0 ? 1 : -1);
/** Attendant ahead of the animal's nose (m); beside it (gap to the flank, m); bicycles ride this far inboard of the rope line;
 * a bicycle's pusher walks this far to its outboard side (deck −z, whichever way it faces). */
export const ATTEND_AHEAD = 0.55, ATTEND_SIDE = 0.35, BIKE_RAIL = 0.75, BIKE_PUSH = 0.45;
/** Margins: the helmsman's disc (0.25) + 0.15 at the trailing end; 0.2 at the leading end. */
const TRAIL_CLEAR = 0.5 + 0.25 + 0.15, LEAD_CLEAR = 0.2;

/** Period paint (inferred L): dark before 1950, pastels and two-tones in 1959, bold solids and white in 1975–86. */
export const PAINT: Record<number, number[]> = {
  1925: [0x1b1b1b, 0x23262b, 0x2e3a2f],
  1935: [0x1c1c1c, 0x2d3440, 0x3b2f2a, 0x33402f],
  1959: [0x7fa3b8, 0xd9d2c0, 0xb8453a, 0x6e8f6a, 0xe0c890, 0x2f3b52],
  1975: [0xe8e4da, 0x8a5a2b, 0x2f5d3a, 0xb58b2a, 0x7a2e2a, 0x3c5f8a, 0xc6c0b0],
  1984: [0xdcdcd6, 0x9a1f1f, 0x1f3a5f, 0x7a7d80, 0x2b2b2b, 0xb8a27a],
};
const FIXED_PAINT: Partial<Record<CarModel, number>> = { publico: 0xe4d7b0, tvVan: 0xe6e3dc };
const COATS: Record<string, number[]> = { oxCart: [0x8a5a36, 0x6b4a33, 0xb08a5e], caneCart: [0x8a5a36, 0x6b4a33, 0xb08a5e], horse: [0x5a3a24, 0x7a4a2a, 0x3a2c22, 0x9a8f84] };
const BIKES = [0x2b2b2b, 0x7a1f1f, 0x1f3a5f];

const r01 = (era: number, leg: number, k: number, salt: number) => hash3(era * 131 + k, leg, salt) / 2 ** 32;
const pick = <T>(a: readonly T[], u: number) => a[Math.min(a.length - 1, Math.floor(u * a.length))];
const origin = (d: MoverDims, centre: number) => centre - (d.front - rearOverhang(d)) / 2;

/** Driver seat (model-local): left-hand drive, a third of the wheelbase behind the front axle, cushion 0.5 m up. */
const seat = (d: MoverDims): [number, number, number] => [d.wheelbase / 2 - 0.62 * d.wheelbase, 0.5, -0.2 * d.width];

/**
 * The movers of leg `leg`. Cars take the 'car' seat anchors, farthest from the entry end first, in `fixed` then
 * pool order; animals take the cargo anchor's line (centred where they clear the helmsman and the leading edge);
 * bicycles line up along the rail on the side without a hauler (−z), behind the cars. Pure.
 */
export function legMovers(rules: readonly LegRule[], spec: VesselSpec, L: DeckLayout, seats: readonly SeatAnchor[], era: number, leg: number): Mover[] {
  if (!rules.length || spec.moored) return [];
  const rule = rules[((leg % rules.length) + rules.length) % rules.length], out: Mover[] = [];
  const add = (kind: MoverKind, park: { x: number; z: number }, paint: number, people: MoverPerson[]) =>
    out.push({ id: `${leg}:${out.length}`, leg, order: out.length, kind, paint, dims: DIMS[kind], park, people });
  const person = (role: MoverPerson['role'], at: [number, number, number], goad = false): MoverPerson => ({ role, at, goad });
  if (rule.animal) {
    const d = DIMS[rule.animal], ahead = !(spec.propulsion === 'poles' && spec.crew < 2);   // one poler: the free side is beside the animal
    const noseMax = L.halfLength - LEAD_CLEAR - (ahead ? ATTEND_AHEAD + 0.25 : 0), tailMin = -(L.halfLength - TRAIL_CLEAR);
    const lo = tailMin + d.length / 2, hi = noseMax - d.length / 2;
    if (lo > hi + 1e-9) throw new Error(`${rule.animal} does not fit the ${spec.kind} deck`);
    const at: [number, number, number] = ahead
      ? [d.wheelbase / 2 + d.front + ATTEND_AHEAD, 0, 0]
      : [d.wheelbase / 2 + d.front - 0.6, 0, -travelOf(leg) * (d.width / 2 + ATTEND_SIDE)];   // on deck side −1 (model left when travel +1)
    add(rule.animal, { x: origin(d, (lo + hi) / 2), z: 0 }, pick(COATS[rule.animal], r01(era, leg, 0, 3)), [person('attendant', at, rule.animal !== 'horse')]);
    return out;
  }
  const slots = seats.filter((s) => s.kind === 'car').slice().sort((a, b) => b.pos[0] - a.pos[0] || a.pos[2] - b.pos[2]);
  for (let k = 0; k < rule.cars; k++) {
    const kind: CarModel = k < rule.fixed.length ? rule.fixed[k] : pick(rule.pool, r01(era, leg, k, 1));
    const d = DIMS[kind], s = slots[k];
    const paint = FIXED_PAINT[kind] ?? pick(PAINT[era] ?? PAINT[1984], r01(era, leg, k, 2));
    add(kind, { x: origin(d, s.pos[0]), z: s.pos[2] }, paint, [person('driver', seat(d))]);
  }
  if (rule.bicycles) {
    const d = DIMS.bicycle, rows = Math.max(1, L.rows), last = -(rows / 2 - 0.5) * 4.4;   // nose behind the last car row's centre, walking in single file
    for (let b = 0; b < rule.bicycles; b++) {
      const centre = last - b * (d.length + 0.6) + 0.5;
      add('bicycle', { x: origin(d, centre), z: -(L.ropeZ - BIKE_RAIL) }, pick(BIKES, r01(era, leg, 40 + b, 4)),
        [person('attendant', [d.wheelbase / 2 - 0.4, 0, -travelOf(leg) * BIKE_PUSH])]);   // model −z faces deck −z only when travel is +1
    }
  }
  return out;
}

/** Parked deck-local rectangle [x0, x1, z0, z1] of `m` (body plus its people on foot), grown by `pad`. */
export function footprint(m: Mover, travel: 1 | -1, pad = 0): [number, number, number, number] {
  const d = m.dims, rear = rearOverhang(d);
  let a = -(d.wheelbase / 2 + rear), b = d.wheelbase / 2 + d.front, zl = -d.width / 2, zr = d.width / 2;   // model-local x, z
  for (const p of m.people) if (p.role === 'attendant') {
    a = Math.min(a, p.at[0] - 0.25); b = Math.max(b, p.at[0] + 0.25);
    zl = Math.min(zl, p.at[2] - 0.25); zr = Math.max(zr, p.at[2] + 0.25);
  }
  // Facing +x (travel +1) the right side (model +z) is deck +z; facing −x (travel −1) it is deck −z: deck z = park.z + travel·zModel.
  const x0 = m.park.x + a, x1 = m.park.x + b, zs = [m.park.z + travel * zl, m.park.z + travel * zr];
  const xs = travel > 0 ? [x0, x1] : [-x1, -x0];
  return [xs[0] - pad, xs[1] + pad, Math.min(zs[0], zs[1]) - pad, Math.max(zs[0], zs[1]) + pad];
}
```

Note the bicycle row: 1984 has 4 rows → `last = −6.6` (the entry-side row's centre in the travel frame); bicycles sit at x' ≈ −6.1 and −8.45 along the −z rail, outside the car slots (car slot outer edge |z| ≤ 2.6, bicycle lane z = −(3.5 − 0.75) = −2.75, half width 0.275).

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/traffic`
Expected: PASS (verified in a scratch copy).

- [ ] **Step 6: Commit**

```bash
git add src/traffic/models.ts src/traffic/models.test.ts src/traffic/plan.ts src/traffic/plan.test.ts
git commit -m "feat(4c): mover sizes and one leg's load plan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Trips, dock frames and routes

**Files:**
- Create: `src/traffic/trip.ts`, `src/traffic/trip.test.ts`, `src/traffic/env.ts`, `src/traffic/env.test.ts`, `src/traffic/testing.ts`

**Preflight rulings applied:** B4/B9a (both story roads run 10–15 m beside their pad, so the lanes leave the road 28 m inland and run diagonally to the pad top: an S-bend, no hairpin; the test checks where the lanes meet the pad instead of the road end), B9b (roads keep right: the waiting line in the right-hand lane, leaving movers in the other lane, offset sideways along road and pad connectors with mitred corners), R1 (the queue head waits 10 m up the pad; each mover lines up with its deck lane at a lead-in point one wheelbase before the apron point), B13 (a leaving mover runs straight until its tail is 1 m past the apron tip), B5 (bicycles have their own verge lines on the side of the deck's bicycle rail: they wait there and leave further out, so they never cross the car lanes), N2 (`offsetRight` is shared with the bridge lanes).

**Interfaces:**
- Consumes: `PoseContext` (`src/ancon/pose.ts`); `LandingPad`, `PAD`, `padPoint`, `padFrame` (`src/terrain/landingPads.ts`); `landingPadsFor` (`src/terrain/placementFields.ts`); `eraRoads` (`src/infrastructure/roads.ts`); `Mover`, `travelOf` (Task 4); `rearOverhang` (Task 4).
- Produces (`trip.ts`):

```ts
export interface Trip { t0: number; s0: number; s1: number; v0: number; vmax: number; accel: number; stop: boolean }
export interface TripPoint { s: number; v: number }
export function tripAt(t: Trip, time: number, out: TripPoint): TripPoint;   // clamps before t0 / after the end
export function tripDuration(t: Trip): number;
export function tripTimeAt(t: Trip, s: number): number;                      // first time the trip reaches s (absolute)
export function tripEndSpeed(t: Trip): number;
```

- Produces (`env.ts`):

```ts
export type XZ = readonly [number, number];
export interface DockFrame { side: 'east' | 'west'; pos: XZ; yaw: number; pad: LandingPad }
export const deckToWorld: (f: DockFrame, x: number, z: number) => [number, number];
export const worldToDeck: (f: DockFrame, wx: number, wz: number) => [number, number];
export interface Polyline { pts: XZ[]; cum: number[]; len: number }
export function polyline(pts: readonly XZ[]): Polyline;
export function pointAt(p: Polyline, s: number, out: [number, number]): [number, number];
export function offsetRight(pts: readonly XZ[], off: number | readonly number[]): XZ[];   // mitred; per-vertex offsets allowed
export const PAD_KEEP = 2.5, QUEUE_A = 10, ROAD_LEAVE = 28, CAR_ROAD = 110, ANIMAL_ROAD = 60, VERGE_WAIT = 2, VERGE_LEAVE = 3.2;
export const LEAD = 1.5, RUN_OUT = 1;
export interface BankRoads { inRoad: XZ[]; outRoad: XZ[]; waitVerge: XZ[]; leaveVerge: XZ[]; padPart: number; railV: 1 | -1 }
export interface DockEnv {
  era: Era; spec: VesselSpec; layout: DeckLayout; ctx: PoseContext; seats: SeatAnchor[];
  pads: [LandingPad, LandingPad]; look: LandingLook; frames: [DockFrame, DockFrame];   // east, west
  roads: [BankRoads, BankRoads];
  groundAt: (x: number, z: number) => number;
}
export function dockEnv(era: Era, ctx: PoseContext, groundAt: (x: number, z: number) => number): DockEnv;
export const departFrame: (env: DockEnv, leg: number) => DockFrame;   // east for travel +1
export const arriveFrame: (env: DockEnv, leg: number) => DockFrame;
export const roadsOf: (env: DockEnv, f: DockFrame) => BankRoads;
export function boardPath(env: DockEnv, m: Mover, roadLen: number): Polyline;   // s = front contact; starts with the rear contact roadLen m up the road
export function leavePath(env: DockEnv, m: Mover, roadLen: number): Polyline;   // starts at the parked rear contact
export const queueHeadS: (path: Polyline) => number;      // boarding path: the queue head (pad a = QUEUE_A)
export const leaveRoadS: (path: Polyline) => number;      // leaving path: the pad top (road speed from here)
export const leaveOffDeckS: (path: Polyline) => number;   // leaving path: tail RUN_OUT m past the apron tip
```

- Produces (`testing.ts`): `envFor(id: EraId): DockEnv` (placement fields, the era's pads, `sampleField` ground).

- [ ] **Step 1: Write the failing tests**

Create `src/traffic/trip.test.ts`:

```ts
import { expect, test } from 'vitest';
import { tripAt, tripDuration, tripEndSpeed, tripTimeAt, type Trip } from './trip';

const pt = { s: 0, v: 0 };
test('a stopping trip starts and ends at rest and never exceeds vmax', () => {
  const t: Trip = { t0: 2, s0: 5, s1: 45, v0: 0, vmax: 3, accel: 1, stop: true };
  const T = tripDuration(t);
  expect(tripAt(t, 0, pt)).toEqual({ s: 5, v: 0 });
  expect(tripAt(t, 2 + T + 5, pt)).toEqual({ s: 45, v: 0 });
  let prev = 5;
  for (let x = 2; x <= 2 + T; x += 0.05) {
    const p = tripAt(t, x, pt);
    expect(p.v).toBeLessThanOrEqual(3 + 1e-9); expect(p.s).toBeGreaterThanOrEqual(prev - 1e-9); prev = p.s;
  }
  expect(T).toBeCloseTo(31 / 3 + 6, 6);   // 3 s up (4.5 m), 31 m at 3 m/s, 3 s down (4.5 m)
});
test('a short trip peaks below vmax (triangle)', () => {
  const t: Trip = { t0: 0, s0: 0, s1: 2, v0: 0, vmax: 3, accel: 1, stop: true };
  expect(tripDuration(t)).toBeCloseTo(2 * Math.sqrt(2), 6);
  expect(tripAt(t, Math.sqrt(2), pt).v).toBeCloseTo(Math.sqrt(2), 6);
});
test('a non-stopping trip keeps its end speed; tripTimeAt inverts tripAt', () => {
  const t: Trip = { t0: 1, s0: 0, s1: 30, v0: 2, vmax: 5, accel: 1, stop: false };
  expect(tripEndSpeed(t)).toBeCloseTo(5, 9);
  for (const s of [0, 3, 10.5, 29.9]) expect(tripAt(t, tripTimeAt(t, s), pt).s).toBeCloseTo(s, 6);
});
```

Create `src/traffic/env.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { padFrame } from '../terrain/landingPads';
import { deckToWorld, polyline, pointAt, worldToDeck, CAR_ROAD, PAD_KEEP, QUEUE_A, VERGE_LEAVE, VERGE_WAIT, boardPath, leavePath, queueHeadS, departFrame, arriveFrame, roadsOf } from './env';
import { legMovers, travelOf } from './plan';
import { envFor } from './testing';

describe('frames', () => {
  test('deckToWorld and worldToDeck are inverse; the frame sits on the dock point', () => {
    const env = envFor('1975'), f = env.frames[0];
    const [wx, wz] = deckToWorld(f, 3.2, -1.1), [x, z] = worldToDeck(f, wx, wz);
    expect(x).toBeCloseTo(3.2, 9); expect(z).toBeCloseTo(-1.1, 9);
    expect(deckToWorld(f, 0, 0)).toEqual([env.ctx.dockEast[0], env.ctx.dockEast[1]]);
    expect(departFrame(env, 0).side).toBe('east'); expect(arriveFrame(env, 0).side).toBe('west');
    expect(departFrame(env, 1).side).toBe('west');
  });
});

describe('routes', () => {
  test('roads keep right, are long enough, and meet the pad at the queue head', () => {
    for (const id of ['1840', '1975'] as const) {
      const env = envFor(id);
      env.roads.forEach((r, i) => {
        const pad = env.pads[i], inL = polyline(r.inRoad), outL = polyline(r.outRoad);
        expect(inL.len - r.padPart).toBeGreaterThanOrEqual(CAR_ROAD); expect(outL.len - r.padPart).toBeGreaterThanOrEqual(CAR_ROAD);
        const pf = (p: readonly [number, number]) => padFrame(pad, p[0], p[1]);
        const [qa, qv] = pf(r.inRoad[r.inRoad.length - 1]), [oa, ov] = pf(r.outRoad[0]);
        expect(qa).toBeCloseTo(QUEUE_A, 6); expect(qv).toBeCloseTo(-PAD_KEEP, 6);
        expect(oa).toBeCloseTo(QUEUE_A, 6); expect(ov).toBeCloseTo(PAD_KEEP, 6);
        // On the road the outbound lane lies to the left of the inbound direction (right-hand traffic).
        const a = r.inRoad[1], b = r.inRoad[2], o = r.outRoad[r.outRoad.length - 3];
        const cross = (b[0] - a[0]) * (o[1] - a[1]) - (b[1] - a[1]) * (o[0] - a[0]);   // > 0: o is right of a→b (x east, z south)
        expect(cross).toBeLessThan(0);
        // Bicycles wait and leave on the verge on the side of the deck's bicycle rail, leaving outside the waiting ones.
        expect(pf(r.waitVerge[r.waitVerge.length - 1])[1]).toBeCloseTo(r.railV * (PAD_KEEP + VERGE_WAIT), 6);
        expect(pf(r.leaveVerge[0])[1]).toBeCloseTo(r.railV * (PAD_KEEP + VERGE_LEAVE), 6);
      });
    }
  });

  test('a boarding path ends at the parked front contact; a leaving path starts at the parked rear contact', () => {
    const env = envFor('1984');
    for (const leg of [0, 1]) {
      const tr = travelOf(leg);
      for (const m of legMovers(env.era.ancon.load.value, env.spec, env.layout, env.seats, 1984, leg)) {
        const b = boardPath(env, m, CAR_ROAD), end = pointAt(b, b.len, [0, 0]);
        const [x, z] = worldToDeck(departFrame(env, leg), end[0], end[1]);
        expect(x).toBeCloseTo(tr * (m.park.x + m.dims.wheelbase / 2), 6); expect(z).toBeCloseTo(m.park.z, 6);
        const l = leavePath(env, m, CAR_ROAD), start = pointAt(l, 0, [0, 0]);
        const [x2, z2] = worldToDeck(arriveFrame(env, leg), start[0], start[1]);
        expect(x2).toBeCloseTo(tr * (m.park.x - m.dims.wheelbase / 2), 6); expect(z2).toBeCloseTo(m.park.z, 6);
        // the queue head waits QUEUE_A m inland, in the right-hand lane (bicycles: on the verge, rail side)
        const f = departFrame(env, leg), q = pointAt(b, queueHeadS(b), [0, 0]), [qa, qv] = padFrame(f.pad, q[0], q[1]);
        const v = m.kind === 'bicycle' ? roadsOf(env, f).railV * (PAD_KEEP + VERGE_WAIT) : -PAD_KEEP;
        expect(qa).toBeCloseTo(QUEUE_A, 6); expect(qv).toBeCloseTo(v, 6);
      }
    }
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/traffic/trip.test.ts src/traffic/env.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write `trip.ts`**

Create `src/traffic/trip.ts`:

```ts
/**
 * A trip along a path: from arc length s0 at time t0 (speed v0) to s1, accelerating at `accel` up to `vmax`,
 * then (if `stop`) braking at `accel` to rest exactly at s1. Pure, allocation-free (tripAt writes `out`).
 */
export interface Trip { t0: number; s0: number; s1: number; v0: number; vmax: number; accel: number; stop: boolean }
export interface TripPoint { s: number; v: number }

interface Shape { vp: number; ta: number; da: number; tc: number; dc: number; td: number }
function shape(t: Trip): Shape {
  const d = Math.max(0, t.s1 - t.s0), a = t.accel, v0 = Math.min(t.v0, t.vmax);
  let vp = t.vmax, da = (vp * vp - v0 * v0) / (2 * a), dd = t.stop ? (vp * vp) / (2 * a) : 0;
  if (da + dd > d) {   // no cruise: peak where the ramps meet
    vp = t.stop ? Math.sqrt((2 * a * d + v0 * v0) / 2) : Math.sqrt(v0 * v0 + 2 * a * d);
    da = (vp * vp - v0 * v0) / (2 * a); dd = t.stop ? (vp * vp) / (2 * a) : 0;
  }
  const dc = Math.max(0, d - da - dd);
  return { vp, ta: (vp - v0) / a, da, tc: vp > 0 ? dc / vp : 0, dc, td: t.stop ? vp / a : 0 };
}
export const tripDuration = (t: Trip) => { const h = shape(t); return h.ta + h.tc + h.td; };
export const tripEndSpeed = (t: Trip) => (t.stop ? 0 : shape(t).vp);

export function tripAt(t: Trip, time: number, out: TripPoint): TripPoint {
  const h = shape(t), a = t.accel, v0 = Math.min(t.v0, t.vmax);
  let u = time - t.t0;
  if (u <= 0) { out.s = t.s0; out.v = 0; return out; }   // at rest until the trip starts
  if (u < h.ta) { out.s = t.s0 + v0 * u + 0.5 * a * u * u; out.v = v0 + a * u; return out; }
  u -= h.ta;
  if (u < h.tc) { out.s = t.s0 + h.da + h.vp * u; out.v = h.vp; return out; }
  u -= h.tc;
  if (u < h.td) { out.s = t.s0 + h.da + h.dc + h.vp * u - 0.5 * a * u * u; out.v = h.vp - a * u; return out; }
  out.s = t.s1; out.v = t.stop ? 0 : h.vp;
  return out;
}

/** Absolute time the trip first reaches arc length s (clamped to [s0, s1]). */
export function tripTimeAt(t: Trip, s: number): number {
  const h = shape(t), a = t.accel, v0 = Math.min(t.v0, t.vmax), d = Math.min(Math.max(s - t.s0, 0), t.s1 - t.s0);
  if (d <= h.da) return t.t0 + (h.ta > 0 ? (-v0 + Math.sqrt(v0 * v0 + 2 * a * d)) / a : 0);
  if (d <= h.da + h.dc) return t.t0 + h.ta + (d - h.da) / h.vp;
  const e = d - h.da - h.dc;   // braking: e = vp·u − a u²/2
  return t.t0 + h.ta + h.tc + (h.vp - Math.sqrt(Math.max(0, h.vp * h.vp - 2 * a * e))) / a;
}
```

- [ ] **Step 4: Write `env.ts` and `testing.ts`**

Create `src/traffic/env.ts`:

```ts
import type { PoseContext } from '../ancon/pose';
import { seatAnchors, type SeatAnchor } from '../ancon/seats';
import type { DeckLayout, VesselSpec } from '../ancon/spec';
import type { Era, LandingLook } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { eraRoads } from '../infrastructure/roads';
import { PAD, padFrame, padPoint, type LandingPad } from '../terrain/landingPads';
import { landingPadsFor } from '../terrain/placementFields';
import { travelOf, type Mover } from './plan';
import { rearOverhang } from './models';

export type XZ = readonly [number, number];
const G = geo as unknown as GeoBundle;

/** The ferry's docked frame on a bank: deck-local (x, z) ↔ world XZ, where computeVesselPose puts the hull at s = 0 / 1 (no drift, no crab). */
export interface DockFrame { side: 'east' | 'west'; pos: XZ; yaw: number; pad: LandingPad }
export const deckToWorld = (f: DockFrame, x: number, z: number): [number, number] => {
  const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
  return [f.pos[0] + c * x + s * z, f.pos[1] - s * x + c * z];
};
export const worldToDeck = (f: DockFrame, wx: number, wz: number): [number, number] => {
  const c = Math.cos(f.yaw), s = Math.sin(f.yaw), dx = wx - f.pos[0], dz = wz - f.pos[1];
  return [c * dx - s * dz, s * dx + c * dz];
};

export interface Polyline { pts: XZ[]; cum: number[]; len: number }
export function polyline(pts: readonly XZ[]): Polyline {
  const out: XZ[] = [], cum: number[] = [];
  let len = 0;
  for (const p of pts) {
    const q = out[out.length - 1];
    if (q) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < 1e-6) continue; len += d; }
    out.push(p); cum.push(len);
  }
  return { pts: out, cum, len };
}
/** Point at arc length s (clamped; beyond the ends it extends the end segments). */
export function pointAt(p: Polyline, s: number, out: [number, number]): [number, number] {
  const n = p.pts.length;
  let k = 1;
  while (k < n - 1 && p.cum[k] < s) k++;
  const a = p.pts[k - 1], b = p.pts[k], l = p.cum[k] - p.cum[k - 1], u = (s - p.cum[k - 1]) / l;
  out[0] = a[0] + (b[0] - a[0]) * u; out[1] = a[1] + (b[1] - a[1]) * u;
  return out;
}
/**
 * A polyline offset to the right of its own direction (right of (dx, dz) is (−dz, dx)) by `off` m, one value per
 * vertex or one for all (negative = left). Corners are mitred, so the offset lane stays parallel to the line (the
 * mitre is capped at 3× the offset). Shared with the bridge lanes (src/traffic/bridgeTraffic.ts).
 */
export function offsetRight(pts: readonly XZ[], off: number | readonly number[]): XZ[] {
  const n = pts.length, right = (i: number): [number, number] => {   // right normal of segment i → i + 1
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  };
  return pts.map((p, i) => {
    const o = typeof off === 'number' ? off : off[i];
    const n1 = right(Math.max(0, i - 1)), n2 = right(Math.min(n - 2, i));
    let mx = n1[0] + n2[0], mz = n1[1] + n2[1];
    const ml = Math.hypot(mx, mz);
    if (ml < 1e-6) { mx = n1[0]; mz = n1[1]; } else { mx /= ml; mz /= ml; }
    const k = o / Math.max(1 / 3, mx * n1[0] + mz * n1[1]);
    return [p[0] + mx * k, p[1] + mz * k] as const;
  });
}

/**
 * Routes (inferred L). Roads keep right (spec 4c §4.2, B9b ruling): the waiting line and every mover driving on use
 * the right-hand lane of the inbound direction, movers driving off the other lane. Lanes sit `width / 4` off a story
 * road's centre line and PAD_KEEP off the pad's axis. Both story roads run beside their pad, 10–15 m to one side, so
 * the lanes leave the road where it is ROAD_LEAVE m inland (pad frame a), run diagonally to the pad top and down the
 * pad's axis to the queue head (a = QUEUE_A): a gentle S-bend, no hairpin. Bicycles are pushed along the verge on the side of the deck's bicycle rail, so they never cross the
 * car lanes: they wait VERGE_WAIT m outside the lanes and leave VERGE_LEAVE m outside them (past the next leg's
 * waiting bicycles). Cars spawn and go away CAR_ROAD m up the road (measured from its pad end), animals and bicycles
 * ANIMAL_ROAD m.
 */
export const PAD_KEEP = 2.5, QUEUE_A = 10, ROAD_LEAVE = 28, CAR_ROAD = 110, ANIMAL_ROAD = 60, VERGE_WAIT = 2, VERGE_LEAVE = 3.2;
/** The boarding line's point just off the apron tip (m past `reach`); a leaving mover runs straight until its tail is RUN_OUT m past the apron tip. */
export const LEAD = 1.5, RUN_OUT = 1;
/** One bank's lanes, world XZ. `inRoad`/`waitVerge` run far → queue head; `outRoad`/`leaveVerge` run pad → far. `padPart`: length of the pad part (where the lanes leave the road → queue head), measured on the centre line. */
export interface BankRoads { inRoad: XZ[]; outRoad: XZ[]; waitVerge: XZ[]; leaveVerge: XZ[]; padPart: number; railV: 1 | -1 }
export interface DockEnv {
  era: Era; spec: VesselSpec; layout: DeckLayout; ctx: PoseContext; seats: SeatAnchor[];
  pads: [LandingPad, LandingPad]; look: LandingLook; frames: [DockFrame, DockFrame];   // east, west
  roads: [BankRoads, BankRoads];
  groundAt: (x: number, z: number) => number;
}

/** The first `len` m of `pts` measured from its end nearest `near` (returned far → near). */
function nearestRun(pts: readonly XZ[], near: XZ, len: number): XZ[] {
  const d0 = Math.hypot(pts[0][0] - near[0], pts[0][1] - near[1]), d1 = Math.hypot(pts[pts.length - 1][0] - near[0], pts[pts.length - 1][1] - near[1]);
  const run = d0 < d1 ? [...pts] : [...pts].reverse();   // near first
  const out: XZ[] = [run[0]];
  let acc = 0;
  for (let k = 1; k < run.length && acc < len; k++) {
    const a = run[k - 1], b = run[k], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (acc + d >= len) { const u = (len - acc) / d; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); acc = len; break; }
    out.push(b); acc += d;
  }
  return out.reverse();   // far → near
}

/** Pad side (±1, pad frame v) of the deck's −z rail (where the bicycles ride) with the ferry docked at `f`. */
function railSide(f: DockFrame): 1 | -1 {
  const [x0, z0] = deckToWorld(f, 0, 0), [x1, z1] = deckToWorld(f, 0, -1);
  return padFrame(f.pad, x1, z1)[1] - padFrame(f.pad, x0, z0)[1] > 0 ? 1 : -1;
}

/** The road (far → near) cut where it first comes within ROAD_LEAVE m of the shore along the pad's axis (pad frame a). */
function cutRoad(run: readonly XZ[], pad: LandingPad): XZ[] {
  const out: XZ[] = [run[0]];
  for (let k = 1; k < run.length; k++) {
    const a0 = padFrame(pad, run[k - 1][0], run[k - 1][1])[0], a1 = padFrame(pad, run[k][0], run[k][1])[0];
    if (a1 < ROAD_LEAVE && a0 >= ROAD_LEAVE) {
      const u = (a0 - ROAD_LEAVE) / (a0 - a1);
      out.push([run[k - 1][0] + (run[k][0] - run[k - 1][0]) * u, run[k - 1][1] + (run[k][1] - run[k - 1][1]) * u]);
      return out;
    }
    out.push(run[k]);
  }
  return out;
}

function bankRoads(r: { points: readonly XZ[]; width: number }, f: DockFrame): BankRoads {
  const pad = f.pad, run = cutRoad(nearestRun(r.points, pad.shore, CAR_ROAD + 60), pad), end = run[run.length - 1];
  const centre: XZ[] = [...run, padPoint(pad, PAD.length, 0), padPoint(pad, QUEUE_A, 0)];
  const keep = centre.map((_, i) => (i < run.length ? r.width / 4 : PAD_KEEP)), rev = [...centre].reverse(), keepRev = [...keep].reverse();
  const railV = railSide(f);
  const padPart = Math.hypot(centre[run.length][0] - end[0], centre[run.length][1] - end[1]) + (PAD.length - QUEUE_A);
  return {
    inRoad: offsetRight(centre, keep), outRoad: offsetRight(rev, keepRev),
    // Right of the inbound direction is pad side −1, right of the outbound direction pad side +1.
    waitVerge: offsetRight(centre, keep.map((k) => -railV * (k + VERGE_WAIT))),
    leaveVerge: offsetRight(rev, keepRev.map((k) => railV * (k + VERGE_LEAVE))),
    padPart, railV,
  };
}

export function dockEnv(era: Era, ctx: PoseContext, groundAt: (x: number, z: number) => number): DockEnv {
  const bank = era.river.bankOffset.value, pads = landingPadsFor(bank), spec = ctx.spec, layout = ctx.layout;
  const frames: [DockFrame, DockFrame] = [
    { side: 'east', pos: ctx.dockEast, yaw: ctx.geom.yaw, pad: pads[0] },
    { side: 'west', pos: ctx.dockWest, yaw: ctx.geom.yaw, pad: pads[1] },
  ];
  const story = eraRoads(G, era).story;
  const road = (id: 'escobar' | 'antigua') => story.find((r) => r.id === id)!;
  return {
    era, spec, layout, ctx, seats: seatAnchors(spec, layout), pads, look: era.infrastructure.landing.value, frames,
    roads: [bankRoads(road('escobar'), frames[0]), bankRoads(road('antigua'), frames[1])], groundAt,
  };
}
export const departFrame = (env: DockEnv, leg: number) => env.frames[travelOf(leg) > 0 ? 0 : 1];
export const arriveFrame = (env: DockEnv, leg: number) => env.frames[travelOf(leg) > 0 ? 1 : 0];
export const roadsOf = (env: DockEnv, f: DockFrame) => env.roads[f.side === 'east' ? 0 : 1];

/** The last `len` m of a polyline (its start trimmed, the cut point interpolated). */
function tail(pts: readonly XZ[], len: number): XZ[] {
  const p = polyline(pts), start = Math.max(0, p.len - len), out: XZ[] = [pointAt(p, start, [0, 0])];
  for (let k = 0; k < p.pts.length; k++) if (p.cum[k] > start) out.push(p.pts[k]);
  return out;
}
/** The first `len` m of a polyline (its end trimmed, the cut point interpolated). */
function head(pts: readonly XZ[], len: number): XZ[] {
  const p = polyline(pts), end = Math.min(p.len, len), out: XZ[] = [];
  for (let k = 0; k < p.pts.length && p.cum[k] < end; k++) out.push(p.pts[k]);
  out.push(pointAt(p, end, [0, 0]));
  return out;
}

/**
 * Boarding route (world XZ), for the FRONT contact: the inbound lane (cars and animals) or the waiting verge
 * (bicycles), from `roadLen` m up the road to the queue head on the pad (a = QUEUE_A) → a lead-in point in line
 * with the mover's deck lane, one wheelbase before the apron point (so the whole mover is straight before the ramp)
 * → the apron point LEAD m off the apron tip → along the lane to its parked front contact. Starts one wheelbase
 * further back so the rear contact has road under it at spawn.
 */
export function boardPath(env: DockEnv, m: Mover, roadLen: number): Polyline {
  const f = departFrame(env, m.leg), tr = travelOf(m.leg), L = env.layout, r = roadsOf(env, f), wb = m.dims.wheelbase;
  const lane = m.park.z, fx = tr * (m.park.x + wb / 2), line = m.kind === 'bicycle' ? r.waitVerge : r.inRoad;
  return polyline([
    ...tail(line, roadLen + r.padPart + wb),
    deckToWorld(f, -tr * (L.reach + LEAD + wb), lane), deckToWorld(f, -tr * (L.reach + LEAD), lane), deckToWorld(f, fx, lane),
  ]);
}
/**
 * Leaving route: parked rear contact → straight along the lane until the tail is RUN_OUT m past the apron tip → the
 * outbound lane (bicycles: the leaving verge) from the pad's queue-head level out to `roadLen` m up the road.
 */
export function leavePath(env: DockEnv, m: Mover, roadLen: number): Polyline {
  const f = arriveFrame(env, m.leg), tr = travelOf(m.leg), L = env.layout, r = roadsOf(env, f), d = m.dims;
  const lane = m.park.z, rx = tr * (m.park.x - d.wheelbase / 2), line = m.kind === 'bicycle' ? r.leaveVerge : r.outRoad;
  return polyline([
    deckToWorld(f, rx, lane), deckToWorld(f, tr * (L.reach + RUN_OUT + d.wheelbase + rearOverhang(d)), lane),
    ...head(line, roadLen + r.padPart),
  ]);
}
/** Arc length (front contact) of the queue head on a boarding path: its fourth-last point (see boardPath). */
export const queueHeadS = (path: Polyline) => path.cum[path.pts.length - 4];
/** Arc length on a leaving path where the mover leaves the pad for the road (its pad top; see leavePath): road speed from here. */
export const leaveRoadS = (path: Polyline) => path.cum[3];
/** Arc length on a leaving path where the mover's tail is RUN_OUT m past the apron tip (off the deck). */
export const leaveOffDeckS = (path: Polyline) => path.cum[1];
```

Create `src/traffic/testing.ts`:

```ts
// Shared test fixtures for src/traffic (imported by *.test.ts only).
import { getEra, type EraId } from '../data/eras';
import { ctxFor, fields512 } from '../ancon/testing';
import { sampleField } from '../terrain/fields';
import { dockEnv } from './env';

export const envFor = (id: EraId) => {
  const e = getEra(id), f = fields512(e.river.bankOffset.value);
  return dockEnv(e, ctxFor(id), (x, z) => sampleField(f, f.height, x, z));
};
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/traffic`
Expected: PASS (verified in a scratch copy).

- [ ] **Step 6: Commit**

```bash
git add src/traffic/trip.ts src/traffic/trip.test.ts src/traffic/env.ts src/traffic/env.test.ts src/traffic/testing.ts
git commit -m "feat(4c): trip speed profiles, dock frames and boarding/leaving routes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The dock schedule and the era's timings

**Files:**
- Create: `src/traffic/schedule.ts`, `src/traffic/schedule.test.ts`
- Modify: `src/ancon/Ancon.tsx` (spec from `eraTimings`), `docs/superpowers/specs/2026-09-29-phase-4c-traffic-design.md` (§4.2 speeds and lanes, §4.3)

**Preflight rulings applied:** R4 (ramps and deck 2 m/s by the spec, but the lowest speed ≤ 3 m/s that keeps every stop within 50 s is 2.8 m/s, so `SPEED.deck = 2.8`; horse and bicycles 1.3 m/s, oxen 0.9 m/s), B5 (bicycles leave in their own chain), B6 (spawns timed back from the docking deadline, each mover never catching the one ahead), B7 (places in line are measured back from each path's own queue head; the queue test compares those), R5 (passengers stay serial; spec §4.3 amended in Step 5), R8 (`eraTimings` takes the placement fields and is memoised per era), N5 (one pass of an even leg cycle: each rule runs one way).

**Interfaces:**
- Consumes: Tasks 4–5; `CROSSING_TIMINGS`, `legDuration` (`src/ancon/crossing.ts`).
- Produces:

```ts
export const SPEED = { deck: 2.8, road: 5.5, oxen: 0.9, walk: 1.3, accel: 1 };
export const BOARD_START = 1, ASHORE_START = 3.2, BOARD_STAGGER = 0.8, OFF_START = 0.5, OFF_GAP = 1.1, QUEUE_GAP = 1.5;
export const SPAWN_AFTER = 10, SPAWN_MIN = 1, SPAWN_STEP = 0.25, QUEUE_MARGIN = 5, PAX_LOAD = 20, PAX_UNLOAD = 16, MAX_STOP = 50;
export interface MoverSched {
  m: Mover; board: Polyline; leave: Polyline;
  spawn: Trip; boardTrip: Trip;      // times relative to the mover's own leg start (negative: during the previous leg)
  leave1: Trip; leave2: Trip;        // times relative to unload start (moveEnd)
  queueS: number; queueBack: number; // queue head arc length on `board`; metres behind it in line
  boardEnd: number;                  // parked, s into the leg
  offDeck: number;                   // tail past the deck end, s after unload start
  gone: number;                      // at the road end, s after unload start
}
/** What the crew needs from a leg's load (src/ancon/crew.ts). */
export interface DeckLoad { rects: [number, number, number, number][]; boardEnd: number; offEnd: number; helmAshore: boolean }
export interface LegPlan { leg: number; movers: MoverSched[]; load: DeckLoad }
export function planLeg(env: DockEnv, leg: number): LegPlan;
export const EMPTY_LOAD: DeckLoad;
export function eraTimings(era: Era, fields?: WorldFields): CrossingTimings;   // memoised per era
export class LegCache { constructor(env: DockEnv); get(leg: number): LegPlan }   // keeps the last 4 legs
```

Resulting dock stops (load / unload, s): 1840 43/27, 1900 43/27, 1925 43/27, 1935 30/22, 1959 39/33, 1975 45/41, 1984 50/49, 1986 20/16 (today's).

- [ ] **Step 1: Write the failing tests**

Create `src/traffic/schedule.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { CROSSING_TIMINGS, legDuration } from '../ancon/crossing';
import { ERAS, getEra, type EraId } from '../data/eras';
import { tripAt, tripDuration } from './trip';
import { eraTimings, LegCache, MAX_STOP, planLeg, QUEUE_GAP, type MoverSched } from './schedule';
import { rearOverhang } from './models';
import { envFor } from './testing';

describe('eraTimings', () => {
  test('never shorter than today, never over 50 s, and today where nothing boards', () => {
    for (const e of ERAS) {
      const T = eraTimings(e);
      expect(T.load, e.id).toBeGreaterThanOrEqual(CROSSING_TIMINGS.load);
      expect(T.unload, e.id).toBeGreaterThanOrEqual(CROSSING_TIMINGS.unload);
      expect(T.load, e.id).toBeLessThanOrEqual(MAX_STOP); expect(T.unload, e.id).toBeLessThanOrEqual(MAX_STOP);
      expect([T.castOff, T.cross, T.dock]).toEqual([CROSSING_TIMINGS.castOff, CROSSING_TIMINGS.cross, CROSSING_TIMINGS.dock]);
    }
    expect(eraTimings(getEra('1986'))).toEqual(CROSSING_TIMINGS);
    expect(eraTimings(getEra('1984')).load).toBeGreaterThan(CROSSING_TIMINGS.load);
    expect(eraTimings(getEra('1975'))).toBe(eraTimings(getEra('1975')));   // memoised
  });
});

describe('planLeg', () => {
  const envT = (id: EraId) => { const e = envFor(id); return { ...e, spec: { ...e.spec, timings: eraTimings(e.era) } }; };
  test('every mover is parked with room for the passengers, and off the deck with room for them to leave', () => {
    for (const id of ['1840', '1900', '1925', '1935', '1959', '1975', '1984'] as const) for (const leg of [0, 1, 2, 3, 4]) {
      const env = envT(id), T = env.spec.timings, p = planLeg(env, leg);
      for (const s of p.movers) {
        expect(s.boardEnd, `${id} ${leg}`).toBeLessThanOrEqual(T.load - 20 + 1e-6);
        expect(s.offDeck, `${id} ${leg}`).toBeLessThanOrEqual(T.unload - 16 + 1e-6);
        expect(s.spawn.t0, id).toBeLessThan(0);                                   // queues during the previous leg
        expect(s.spawn.t0, id).toBeGreaterThan(-legDuration(T) + T.load + T.castOff);   // …after it cast off
        expect(tripDuration(s.spawn) + s.spawn.t0, id).toBeLessThan(-T.unload - T.dock);   // …and is in line before it docks
      }
      expect(p.load.boardEnd).toBe(Math.max(0, ...p.movers.map((s) => s.boardEnd)));
      expect(p.load.helmAshore).toBe(env.spec.helmsman && p.movers.length > 0);
    }
  });

  test('the waiting line keeps its gaps and its head at the queue point when the ferry docks', () => {
    const env = envT('1984'), T = env.spec.timings, p = planLeg(env, 2), pt = { s: 0, v: 0 }, dock = -T.unload - T.dock;
    const back = (s: MoverSched) => s.queueS - tripAt(s.spawn, dock, pt).s;
    for (const line of [p.movers.filter((s) => s.m.kind !== 'bicycle'), p.movers.filter((s) => s.m.kind === 'bicycle')]) {
      expect(back(line[0])).toBeCloseTo(0, 6);
      for (let k = 1; k < line.length; k++) {
        const a = line[k - 1].m.dims, b = line[k].m.dims;
        // front-to-front spacing ≥ leader's wheelbase + rear overhang + gap + follower's front
        expect(back(line[k]) - back(line[k - 1])).toBeGreaterThanOrEqual(a.wheelbase + rearOverhang(a) + QUEUE_GAP + b.front - 1e-6);
      }
    }
  });

  test('cache returns the same plan object for the same leg', () => {
    const c = new LegCache(envT('1975'));
    expect(c.get(3)).toBe(c.get(3));
    expect(c.get(4).movers.length).toBe(6);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/traffic/schedule.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write `schedule.ts`**

Create `src/traffic/schedule.ts`:

```ts
import { CROSSING_TIMINGS, legDuration, type CrossingTimings } from '../ancon/crossing';
import { makePoseContext } from '../ancon/pose';
import { crossingGeometry } from '../ancon/geometry';
import { vesselSpec } from '../ancon/spec';
import type { Era, EraId } from '../data/eras';
import type { WorldFields } from '../terrain/fields';
import { placementFields } from '../terrain/placementFields';
import { ANIMAL_ROAD, boardPath, CAR_ROAD, dockEnv, leaveOffDeckS, leavePath, leaveRoadS, queueHeadS, type DockEnv, type Polyline } from './env';
import { isAnimal, rearOverhang } from './models';
import { footprint, legMovers, travelOf, type Mover } from './plan';
import { tripAt, tripDuration, tripEndSpeed, tripTimeAt, type Trip, type TripPoint } from './trip';

/**
 * Speeds (m/s) and acceleration (m/s²), inferred (L; spec 4c §4.2): oxen 0.9, a led horse and pushed bicycles 1.3
 * (walking), cars up to 5.5 on the road. `deck` (ramps, pad and deck) is 2.8, not the spec's 2: the lowest speed
 * ≤ 3 m/s (0.1 steps) that keeps every era's dock stop within MAX_STOP — at 2 m/s the 1984 load takes 57 s, at 2.7 m/s
 * 51 s (ruling R4; spec 4c §4.2 amended, rulings note).
 */
export const SPEED = { deck: 2.8, road: 5.5, oxen: 0.9, walk: 1.3, accel: 1 };
/**
 * Dock stop (s): boarding starts BOARD_START into the leg (ASHORE_START when the helmsman first steps ashore), each
 * next mover BOARD_STAGGER later (bicycles board along the rail, beside the cars).
 * Leaving starts OFF_START after unload starts; each next car when the one ahead is its length + OFF_GAP m ahead;
 * bicycles run their own chain, along the rail and out on the verge (src/traffic/env.ts), beside the cars. The queue:
 * QUEUE_GAP m nose to tail; spawns are timed so each mover reaches its place in line QUEUE_MARGIN s before the ferry
 * docks, never before SPAWN_AFTER s after the previous leg's cast-off, and no mover catches up with the one ahead
 * (checked every SPAWN_STEP s; at least SPAWN_MIN s apart). Passengers need PAX_LOAD / PAX_UNLOAD s after the load
 * (Phase 3's whole stop). A stop is at most MAX_STOP s.
 */
export const BOARD_START = 1, ASHORE_START = 3.2, BOARD_STAGGER = 0.8, OFF_START = 0.5, OFF_GAP = 1.1, QUEUE_GAP = 1.5;
export const SPAWN_AFTER = 10, SPAWN_MIN = 1, SPAWN_STEP = 0.25, QUEUE_MARGIN = 5, PAX_LOAD = 20, PAX_UNLOAD = 16, MAX_STOP = 50;

export interface MoverSched {
  m: Mover; board: Polyline; leave: Polyline;
  /** Queue: times relative to the mover's own leg start (negative: during the previous leg). */
  spawn: Trip; boardTrip: Trip;
  /** Leaving: times relative to unload start (moveEnd). */
  leave1: Trip; leave2: Trip;
  /** Arc length (front contact) of the queue head on `board`; the mover waits `queueBack` m behind it. */
  queueS: number; queueBack: number;
  /** Parked (s into the leg); tail past the deck end, at the road end (s after unload starts). */
  boardEnd: number; offDeck: number; gone: number;
}
/** What the crew needs from a leg's load (src/ancon/crew.ts). */
export interface DeckLoad { rects: [number, number, number, number][]; boardEnd: number; offEnd: number; helmAshore: boolean }
export interface LegPlan { leg: number; movers: MoverSched[]; load: DeckLoad }
export const EMPTY_LOAD: DeckLoad = { rects: [], boardEnd: 0, offEnd: 0, helmAshore: false };

const isBike = (m: Mover) => m.kind === 'bicycle';
const walks = (m: Mover) => m.kind === 'horse' || isBike(m);
const deckVmax = (m: Mover) => (walks(m) ? SPEED.walk : isAnimal(m.kind) ? SPEED.oxen : SPEED.deck);
const roadVmax = (m: Mover) => (walks(m) ? SPEED.walk : isAnimal(m.kind) ? SPEED.oxen : SPEED.road);
const roadLen = (m: Mover) => (isAnimal(m.kind) || isBike(m) ? ANIMAL_ROAD : CAR_ROAD);
/** Front-to-front spacing (m) of `m` waiting behind `ahead`. */
const spacing = (ahead: Mover, m: Mover) => ahead.dims.wheelbase + rearOverhang(ahead.dims) + QUEUE_GAP + m.dims.front;
const _tp: TripPoint = { s: 0, v: 0 };
/** Distance (m) of the front contact behind the queue head at time t. */
const behind = (s: MoverSched, t: number) => s.queueS - tripAt(s.spawn, t, _tp).s;

/**
 * Earliest spawn (relative) for `s` behind `ahead` in the same line: at least SPAWN_MIN s after it and never
 * closer than their spacing, sampled every SPAWN_STEP s until `s` stops.
 */
function spawnAfter(ahead: MoverSched, s: MoverSched): number {
  const gap = spacing(ahead.m, s.m) - 1e-6, dur = tripDuration(s.spawn);
  for (let t0 = ahead.spawn.t0 + SPAWN_MIN; ; t0 += SPAWN_STEP) {
    s.spawn.t0 = t0;
    let ok = true;
    for (let t = t0; t <= t0 + dur + SPAWN_STEP; t += SPAWN_STEP) if (behind(s, t) - behind(ahead, t) < gap) { ok = false; break; }
    if (ok) return t0;
  }
}

/** One leg's schedule. Times: queue/board relative to the leg's start, leaving relative to unload start. Pure. */
export function planLeg(env: DockEnv, leg: number): LegPlan {
  const { spec, layout: L } = env, T = spec.timings, Lg = legDuration(T), tr = travelOf(leg);
  const movers = legMovers(env.era.ancon.load.value, spec, L, env.seats, Number(env.era.id), leg);
  if (!movers.length) return { leg, movers: [], load: EMPTY_LOAD };
  const helmAshore = spec.helmsman;
  const out: MoverSched[] = [];
  // The waiting line (lane) and the bicycles (verge), each in boarding order: places measured back from the head.
  const lastOf: { lane?: MoverSched; verge?: MoverSched } = {};
  for (const m of movers) {
    const board = boardPath(env, m, roadLen(m)), leave = leavePath(env, m, roadLen(m)), queueS = queueHeadS(board);
    const key = isBike(m) ? 'verge' : 'lane', ahead = lastOf[key];
    const queueBack = ahead ? ahead.queueBack + spacing(ahead.m, m) : 0;
    const s: MoverSched = {
      m, board, leave, queueS, queueBack,
      spawn: { t0: 0, s0: m.dims.wheelbase, s1: queueS - queueBack, v0: 0, vmax: roadVmax(m), accel: SPEED.accel, stop: true },
      boardTrip: undefined!, leave1: undefined!, leave2: undefined!, boardEnd: 0, offDeck: 0, gone: 0,
    };
    if (ahead) s.spawn.t0 = spawnAfter(ahead, s);
    lastOf[key] = s; out.push(s);
  }
  // Spawn as early as SPAWN_AFTER s after the previous leg's cast-off, later only if everyone still arrives in time.
  const first = -Lg + T.load + T.castOff + SPAWN_AFTER, due = -T.unload - T.dock - QUEUE_MARGIN;
  const shift = Math.min(first, due - Math.max(...out.map((s) => s.spawn.t0 + tripDuration(s.spawn))));
  for (const s of out) s.spawn.t0 += shift;
  // Boarding, BOARD_STAGGER apart in boarding order.
  const start = helmAshore ? ASHORE_START : BOARD_START;
  out.forEach((s, k) => {
    const t0 = start + k * BOARD_STAGGER;
    s.boardTrip = { t0, s0: s.spawn.s1, s1: s.board.len, v0: 0, vmax: deckVmax(s.m), accel: SPEED.accel, stop: true };
    s.boardEnd = t0 + tripDuration(s.boardTrip) + 0.5;
  });
  // Leaving: nearest the leading end first (largest x'), each next when the one ahead is its length + OFF_GAP along;
  // cars and animals in one chain, bicycles in their own (rail and verge).
  const chain = (list: MoverSched[]) => {
    let t = OFF_START;
    list.forEach((s, i) => {
      const m = s.m, wb = m.dims.wheelbase, road = leaveRoadS(s.leave);
      // s is the FRONT contact; the leaving path starts at the rear contact, so the front starts at s = wb.
      s.leave1 = { t0: t, s0: wb, s1: road, v0: 0, vmax: deckVmax(m), accel: SPEED.accel, stop: false };
      s.leave2 = { t0: t + tripDuration(s.leave1), s0: road, s1: s.leave.len, v0: tripEndSpeed(s.leave1), vmax: roadVmax(m), accel: SPEED.accel, stop: false };
      s.offDeck = tripTimeAt(s.leave1, leaveOffDeckS(s.leave));
      s.gone = s.leave2.t0 + tripDuration(s.leave2);
      if (i + 1 < list.length) t = tripTimeAt(s.leave1, Math.min(road, wb + m.dims.length + OFF_GAP));
    });
  };
  const byLead = (a: MoverSched, b: MoverSched) => b.m.park.x - a.m.park.x || a.m.park.z - b.m.park.z;
  chain(out.filter((s) => !isBike(s.m)).sort(byLead));
  chain(out.filter((s) => isBike(s.m)).sort(byLead));
  const rects = out.map((s) => footprint(s.m, tr));
  return {
    leg, movers: out,
    load: { rects, boardEnd: Math.max(0, ...out.map((s) => s.boardEnd)), offEnd: Math.max(0, ...out.map((s) => s.offDeck)) + 0.5, helmAshore },
  };
}

/** Keeps the last few legs' plans (a frame reads legs n − 1, n, n + 1). */
export class LegCache {
  private readonly map = new Map<number, LegPlan>();
  constructor(readonly env: DockEnv) {}
  get(leg: number): LegPlan {
    let p = this.map.get(leg);
    if (!p) { p = planLeg(this.env, leg); this.map.set(leg, p); if (this.map.size > 4) this.map.delete(this.map.keys().next().value!); }
    return p;
  }
}

const TIMINGS = new Map<EraId, CrossingTimings>();
/**
 * The era's dock timings (spec 4c §4.3): load = PAX_LOAD after the slowest boarding, unload = PAX_UNLOAD after the
 * slowest leaving, over one pass of the era's leg cycle (twice for an odd cycle, so every rule runs both ways); never
 * shorter than today's. Memoised per era. `fields`: the 512 placement fields (<Ancon> passes its own; omitted, the
 * cached build is used). Ground heights are not needed (routes are XZ only). boardEnd and offDeck do not depend on
 * the timings (only the spawn times do), so planning with today's timings here is consistent.
 */
export function eraTimings(era: Era, fields?: WorldFields): CrossingTimings {
  const hit = TIMINGS.get(era.id);
  if (hit) return hit;
  const rules = era.ancon.load.value;
  let T = CROSSING_TIMINGS;
  if (rules.length && era.ancon.propulsion.value !== 'moored') {
    const spec = vesselSpec(era), f = fields ?? placementFields(era.river.bankOffset.value);
    const env = dockEnv(era, makePoseContext(crossingGeometry(f), spec, era.river.flow.value), () => 0);
    let board = 0, off = 0;
    for (let leg = 0; leg < (rules.length % 2 ? 2 : 1) * rules.length; leg++) { const p = planLeg(env, leg); board = Math.max(board, p.load.boardEnd); off = Math.max(off, p.load.offEnd); }
    T = { ...CROSSING_TIMINGS, load: Math.max(CROSSING_TIMINGS.load, Math.ceil(board + PAX_LOAD)), unload: Math.max(CROSSING_TIMINGS.unload, Math.ceil(off + PAX_UNLOAD)) };
  }
  TIMINGS.set(era.id, T);
  return T;
}
```

- [ ] **Step 4: Use the era timings in the ferry**

In `src/ancon/Ancon.tsx`, replace:

```tsx
import { vesselSpec } from './spec';
```

with:

```tsx
import { vesselSpec } from './spec';
import { eraTimings } from '../traffic/schedule';
```

In `src/ancon/Ancon.tsx`, replace:

```tsx
  const spec = useMemo(() => vesselSpec(era), [era]);
  // Crossing geometry always comes from the fixed 512 placement fields (never the tier's grid).
  const place = useMemo(() => placementFields(bank, near), [bank, near]);
```

with:

```tsx
  // Crossing geometry always comes from the fixed 512 placement fields (never the tier's grid).
  const place = useMemo(() => placementFields(bank, near), [bank, near]);
  const spec = useMemo(() => vesselSpec(era, eraTimings(era, place)), [era, place]);
```

- [ ] **Step 5: Amend the spec (rulings R4, B9b, R5)**

In `docs/superpowers/specs/2026-09-29-phase-4c-traffic-design.md` §4.2, replace:

```markdown
- **Speeds** (inferred L): 2 m/s on ramps and deck, up to 6 m/s on the road, smooth starts and stops; oxen 0.9 m/s; horse and bicycles at walking speed.
```

with:

```markdown
- **Speeds** (inferred L): 2.8 m/s on ramps and deck (ruling 2026-09-29: at 2 m/s the 1984 stop runs past 50 s; 2.8 is the lowest that fits), up to 6 m/s on the road, smooth starts and stops; oxen 0.9 m/s; horse and bicycles at walking speed (1.3 m/s).
- **Lanes** (ruling 2026-09-29). Roads keep right: the waiting line and the movers driving on use the right-hand lane, movers driving off the other lane, offset sideways along the road and the pad. Bicycles wait and leave on the verge on the side of the deck's bicycle rail. The queue head waits 10 m up the pad, where each mover can line up with its deck lane before the ramp.
```

In §4.3, replace:

```markdown
- `load` and `unload` get longer only where the load needs it: a per-era timing, computed from the drive-on and drive-off plan, capped at 50 s each, never shorter than today's (load 20 s, unload 16 s). An era whose plan fits in today's timings keeps them.
```

with:

```markdown
- `load` and `unload` get longer where there is a load: a per-era timing, computed from the drive-on and drive-off plan, capped at 50 s each, never shorter than today's (load 20 s, unload 16 s). Passengers walk on after the load has parked and off after it has left (ruling 2026-09-29), so every era with a load gets a longer stop; an era without a load keeps today's timings.
```

- [ ] **Step 6: Run all tests and the type check**

Run: `npx vitest run && npx tsc -p tsconfig.json --noEmit`
Expected: PASS (verified in a scratch copy).

- [ ] **Step 7: Commit**

```bash
git add src/traffic/schedule.ts src/traffic/schedule.test.ts src/ancon/Ancon.tsx docs/superpowers/specs/2026-09-29-phase-4c-traffic-design.md
git commit -m "feat(4c): dock schedule (queue, board, leave) and per-era dock timings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Motion — where a mover is at a clock

**Files:**
- Create: `src/traffic/motion.ts`, `src/traffic/motion.test.ts`
- Modify: `src/traffic/testing.ts` (the era's timings, OBB helpers, `deckHeight`), `src/traffic/schedule.test.ts` (its `envT` becomes `envFor`)

**Preflight rulings applied:** B8 (both contacts are computed every frame: a short-circuit `&&` left the rear contact stale whenever the front was off the deck), R6 (a wheels-within-3 cm surface test replaces the height claim in the parking test's name).

**Interfaces:**
- Consumes: Tasks 4–6; `VesselPose`, `computeVesselPose`, `createVesselPose` (`src/ancon/pose.ts`); `landingTop` (`src/infrastructure/landing.ts`); `ROAD_LIFT` (`src/infrastructure/roadStrip.ts`); `APRON_REST` (`src/ancon/geometry.ts`).
- Produces:

```ts
export type Stage = 'hidden' | 'queue' | 'board' | 'park' | 'leave';
export interface MoverFrame {
  visible: boolean; stage: Stage;
  front: THREE.Vector3; rear: THREE.Vector3;   // contact points, world
  matrix: THREE.Matrix4;                        // model → world (origin: contact midpoint; +X forward, +Y up, +Z right)
  dist: number;                                  // metres driven since spawn (wheel spin, gait)
  speed: number;                                 // m/s along the path
  onDeck: boolean;                               // both contacts on the deck
}
export const createMoverFrame: () => MoverFrame;
export function moverFrame(s: MoverSched, env: DockEnv, clock: number, pose: VesselPose, out: MoverFrame): MoverFrame;
export function bodyMatrix(front: THREE.Vector3, rear: THREE.Vector3, up: THREE.Vector3, out: THREE.Matrix4): THREE.Matrix4;
export function surfacePoint(env: DockEnv, f: DockFrame, wx: number, wz: number, pose: VesselPose, out: THREE.Vector3): boolean;   // true = on deck
```

- Produces (`testing.ts`): `envFor` now builds the context with `eraTimings(era)`; `obbOf(fr, d, pad?)`, `obbOverlap(a, b)`, `discInObb(x, z, r, b)`, `poseFor(env, clock)`, `deckHeight(env, pose, x, z)`.

- [ ] **Step 1: Write the failing tests**

Replace the whole of `src/traffic/testing.ts` with:

```ts
// Shared test fixtures for src/traffic (imported by *.test.ts only).
import * as THREE from 'three';
import { fields512, geom512 } from '../ancon/testing';
import { computeVesselPose, createVesselPose, makePoseContext, type VesselPose } from '../ancon/pose';
import { vesselSpec } from '../ancon/spec';
import { getEra, type EraId } from '../data/eras';
import { sampleField } from '../terrain/fields';
import { dockEnv, type DockEnv } from './env';
import type { MoverFrame } from './motion';
import { rearOverhang, type MoverDims } from './models';
import { eraTimings } from './schedule';

/** An era's dock environment with its own dock timings, on the 512 placement fields (the grid the app computes the crossing from). */
export const envFor = (id: EraId) => {
  const e = getEra(id), f = fields512(e.river.bankOffset.value), groundAt = (x: number, z: number) => sampleField(f, f.height, x, z);
  const ctx = makePoseContext(geom512(e.river.bankOffset.value), vesselSpec(e, eraTimings(e)), e.river.flow.value, groundAt);
  return dockEnv(e, ctx, groundAt);
};
export const poseFor = (env: DockEnv, clock: number): VesselPose => computeVesselPose(clock, env.ctx, createVesselPose());

export interface OBB { c: [number, number]; u: [number, number]; hx: number; hz: number }
/** The body's ground rectangle (XZ): centre, forward unit axis, half length and half width (+ pad). */
export function obbOf(fr: MoverFrame, d: MoverDims, pad = 0): OBB {
  const e = fr.matrix.elements, fx = e[0], fz = e[2], l = Math.hypot(fx, fz) || 1, u: [number, number] = [fx / l, fz / l];
  const off = (d.front - rearOverhang(d)) / 2;
  return { c: [e[12] + u[0] * off, e[14] + u[1] * off], u, hx: d.length / 2 + pad, hz: d.width / 2 + pad };
}
const proj = (b: OBB, ax: [number, number]) => {
  const v: [number, number] = [-b.u[1], b.u[0]];
  return Math.abs(b.u[0] * ax[0] + b.u[1] * ax[1]) * b.hx + Math.abs(v[0] * ax[0] + v[1] * ax[1]) * b.hz;
};
export function obbOverlap(a: OBB, b: OBB): boolean {
  const d: [number, number] = [b.c[0] - a.c[0], b.c[1] - a.c[1]];
  for (const ax of [a.u, [-a.u[1], a.u[0]], b.u, [-b.u[1], b.u[0]]] as [number, number][]) {
    if (Math.abs(d[0] * ax[0] + d[1] * ax[1]) > proj(a, ax) + proj(b, ax)) return false;
  }
  return true;
}
export function discInObb(x: number, z: number, r: number, b: OBB): boolean {
  const dx = x - b.c[0], dz = z - b.c[1], lx = dx * b.u[0] + dz * b.u[1], lz = -dx * b.u[1] + dz * b.u[0];
  const qx = Math.max(-b.hx, Math.min(b.hx, lx)), qz = Math.max(-b.hz, Math.min(b.hz, lz));
  return Math.hypot(lx - qx, lz - qz) < r;
}
/** World height of deck-local (x, deck, z) under `pose`. */
export const deckHeight = (env: DockEnv, pose: VesselPose, x: number, z: number) => new THREE.Vector3(x, env.layout.deckY, z).applyMatrix4(pose.matrix).y;
```

In `src/traffic/schedule.test.ts`, replace:

```ts
  const envT = (id: EraId) => { const e = envFor(id); return { ...e, spec: { ...e.spec, timings: eraTimings(e.era) } }; };
```

with:

```ts
  const envT = envFor;
```

Create `src/traffic/motion.test.ts`:

```ts
import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { legDuration } from '../ancon/crossing';
import { moveEnd } from '../ancon/crew';
import type { EraId } from '../data/eras';
import { landingTop } from '../infrastructure/landing';
import { ROAD_LIFT } from '../infrastructure/roadStrip';
import { PAD, padFrame } from '../terrain/landingPads';
import { arriveFrame, departFrame, worldToDeck } from './env';
import { createMoverFrame, moverFrame } from './motion';
import { planLeg } from './schedule';
import { travelOf } from './plan';
import { deckHeight, envFor, obbOf, obbOverlap, poseFor } from './testing';

const ERAS_WITH_LOAD: EraId[] = ['1840', '1900', '1925', '1935', '1959', '1975', '1984'];

describe('moverFrame', () => {
  test('no teleports: consecutive samples move at most vmax·dt (+ deck heave)', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), Lg = legDuration(env.spec.timings), a = createMoverFrame(), b = createMoverFrame();
      for (const s of planLeg(env, 2).movers) {
        let prevVisible = false;
        for (let c = 1 * Lg; c < 3.5 * Lg; c += 0.1) {
          moverFrame(s, env, c, poseFor(env, c), a);
          if (a.visible && prevVisible) expect(a.front.distanceTo(b.front), `${id} ${s.m.id} @${c.toFixed(1)}`).toBeLessThan(6 * 0.1 + 0.05);
          prevVisible = a.visible; b.front.copy(a.front);
        }
      }
    }
  });

  test('movers appear and go away only far up the road', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), Lg = legDuration(env.spec.timings), fr = createMoverFrame();
      for (const s of planLeg(env, 2).movers) {
        let prev = false;
        for (let c = 1 * Lg; c < 3.6 * Lg; c += 0.25) {
          moverFrame(s, env, c, poseFor(env, c), fr);
          if (fr.visible !== prev) {
            const d = Math.min(...env.pads.map((p) => Math.hypot(fr.front.x - p.shore[0], fr.front.z - p.shore[1])));
            expect(d, `${id} ${s.m.id} ${fr.visible ? 'appears' : 'vanishes'} @${c}`).toBeGreaterThan(PAD.length + 40);
          }
          prev = fr.visible;
        }
      }
    }
  });

  test('parked at cast-off, on the deck, facing the way the ferry goes', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), T = env.spec.timings, Lg = legDuration(T), fr = createMoverFrame();
      for (const leg of [2, 3]) for (const s of planLeg(env, leg).movers) {
        const c = leg * Lg + T.load + 0.5, pose = poseFor(env, c);
        moverFrame(s, env, c, pose, fr);
        expect(fr.stage).toBe('park'); expect(fr.onDeck).toBe(true);
        const e = fr.matrix.elements, fwd = [e[0], e[2]], deckX = [Math.cos(pose.yaw), -Math.sin(pose.yaw)];
        expect(travelOf(leg) * (fwd[0] * deckX[0] + fwd[1] * deckX[1])).toBeGreaterThan(0.99);
      }
    }
  });

  test('wheels stand on the deck, the landing pad and the road (within 3 cm)', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), Lg = legDuration(env.spec.timings), fr = createMoverFrame(), L = env.layout;
      const local = new THREE.Vector3(), inv = new THREE.Matrix4();
      for (const s of planLeg(env, 2).movers) for (let c = 1.5 * Lg; c < 3.5 * Lg; c += 0.5) {
        const pose = poseFor(env, c);
        if (!moverFrame(s, env, c, pose, fr).visible) continue;
        const f = fr.stage === 'leave' ? arriveFrame(env, s.m.leg) : departFrame(env, s.m.leg);
        for (const p of [fr.front, fr.rear]) {
          if (fr.stage === 'park') {   // parked contacts ride the deck: deck-local height = the deck surface
            expect(Math.abs(local.copy(p).applyMatrix4(inv.copy(pose.matrix).invert()).y - L.deckY)).toBeLessThan(0.03);
            continue;
          }
          const [x, z] = worldToDeck(f, p.x, p.z), [a, v] = padFrame(f.pad, p.x, p.z);
          let want: number | null = null;
          if (Math.abs(x) <= L.halfLength - 0.05 && Math.abs(z) <= L.halfBeam) want = deckHeight(env, pose, x, z);
          else if (Math.abs(x) <= L.reach + 1) want = null;   // the apron / bow blend onto the bank
          else if (a >= 1 && a <= PAD.length && Math.abs(v) <= PAD.halfWidth) want = landingTop(f.pad, env.look, a);
          else if (a > PAD.length + 2 || Math.abs(v) > PAD.halfWidth + 2) want = env.groundAt(p.x, p.z) + ROAD_LIFT;
          if (want !== null) expect(Math.abs(p.y - want), `${id} ${s.m.id} ${fr.stage} @${c.toFixed(1)}`).toBeLessThan(0.03);
        }
      }
    }
  });

  test('the next load waits in line, still, when the ferry docks', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), T = env.spec.timings, Lg = legDuration(T), fr = createMoverFrame();
      for (const s of planLeg(env, 3).movers) {
        const c = 3 * Lg - T.unload - T.dock;   // leg 2 starts docking at the bank leg 3 leaves from
        moverFrame(s, env, c, poseFor(env, c), fr);
        expect(fr.stage, `${id} ${s.m.id}`).toBe('queue'); expect(fr.speed).toBe(0);
        const pad = env.frames[travelOf(3) > 0 ? 0 : 1].pad, [a] = padFrame(pad, fr.front.x, fr.front.z);
        expect(a).toBeGreaterThan(0.5);   // on land, not in the river
      }
    }
  });

  test('no two movers overlap at any time (three legs, both banks)', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), Lg = legDuration(env.spec.timings);
      const scheds = [1, 2, 3, 4].flatMap((leg) => planLeg(env, leg).movers), frs = scheds.map(createMoverFrame);
      for (let c = 2 * Lg; c < 4 * Lg; c += 0.2) {
        const pose = poseFor(env, c), boxes = scheds.map((s, i) => (moverFrame(s, env, c, pose, frs[i]).visible ? obbOf(frs[i], s.m.dims) : null));
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          if (boxes[i] && boxes[j]) expect(obbOverlap(boxes[i]!, boxes[j]!), `${id} ${scheds[i].m.id} × ${scheds[j].m.id} @${c.toFixed(1)}`).toBe(false);
        }
      }
    }
  });

  test('off the deck before the passengers leave; nothing on deck at the next cast-off', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), T = env.spec.timings, Lg = legDuration(T), fr = createMoverFrame(), p = planLeg(env, 2);
      for (const s of p.movers) {
        const c = 2 * Lg + moveEnd(T) + p.load.offEnd;
        moverFrame(s, env, c, poseFor(env, c), fr);
        expect(fr.onDeck, `${id} ${s.m.id}`).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/traffic/motion.test.ts`
Expected: FAIL — `motion.ts` missing.

- [ ] **Step 3: Write `motion.ts`**

Create `src/traffic/motion.ts`:

```ts
import * as THREE from 'three';
import { legDuration } from '../ancon/crossing';
import { moveEnd } from '../ancon/crew';
import { APRON_REST } from '../ancon/geometry';
import type { VesselPose } from '../ancon/pose';
import { landingTop } from '../infrastructure/landing';
import { ROAD_LIFT } from '../infrastructure/roadStrip';
import { PAD, padFrame } from '../terrain/landingPads';
import { arriveFrame, departFrame, pointAt, worldToDeck, type DockEnv, type DockFrame, type Polyline } from './env';
import { travelOf } from './plan';
import type { MoverSched } from './schedule';
import { tripAt, type TripPoint } from './trip';

export type Stage = 'hidden' | 'queue' | 'board' | 'park' | 'leave';
export interface MoverFrame {
  visible: boolean; stage: Stage;
  front: THREE.Vector3; rear: THREE.Vector3; matrix: THREE.Matrix4;
  dist: number; speed: number; onDeck: boolean;
}
export const createMoverFrame = (): MoverFrame => ({
  visible: false, stage: 'hidden', front: new THREE.Vector3(), rear: new THREE.Vector3(), matrix: new THREE.Matrix4(), dist: 0, speed: 0, onDeck: false,
});

const _e = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3(), _m = new THREE.Vector3(), _up = new THREE.Vector3();
const _xz: [number, number] = [0, 0], _tp: TripPoint = { s: 0, v: 0 };
const UP = new THREE.Vector3(0, 1, 0);

/**
 * World point (and height) of the ground a contact stands on at world (wx, wz), with the ferry docked at `f`:
 * the deck (through the live pose, so it rides the heave), the apron (a straight blend from the deck edge down
 * to the landing, 0.8 m onto the bank for an apron-less barge), the landing pad, or the road. Returns true on the deck.
 */
export function surfacePoint(env: DockEnv, f: DockFrame, wx: number, wz: number, pose: VesselPose, out: THREE.Vector3): boolean {
  const L = env.layout, [x, z] = worldToDeck(f, wx, wz), ax = Math.abs(x);
  if (ax <= L.halfLength) { out.set(x, L.deckY, z).applyMatrix4(pose.matrix); return true; }
  const [a, v] = padFrame(f.pad, wx, wz), land = landingTop(f.pad, env.look, a);
  const end = L.apron > 0 ? L.reach : L.halfLength + APRON_REST;
  if (ax <= end) {
    _e.set(Math.sign(x) * L.halfLength, L.deckY, z).applyMatrix4(pose.matrix);
    out.set(wx, _e.y + (land - _e.y) * ((ax - L.halfLength) / (end - L.halfLength)), wz);
    return false;
  }
  if (a <= PAD.length + 1 && Math.abs(v) <= PAD.halfWidth + 1) { out.set(wx, land, wz); return false; }
  out.set(wx, env.groundAt(wx, wz) + ROAD_LIFT, wz);
  return false;
}

/** Model → world from the two contacts: +X along rear → front, +Y as close to `up` as that allows, origin at their midpoint. */
export function bodyMatrix(front: THREE.Vector3, rear: THREE.Vector3, up: THREE.Vector3, out: THREE.Matrix4): THREE.Matrix4 {
  _f.subVectors(front, rear).normalize();
  _r.crossVectors(_f, up).normalize();
  _u.crossVectors(_r, _f);
  out.makeBasis(_f, _u, _r);
  _m.addVectors(front, rear).multiplyScalar(0.5);
  return out.setPosition(_m);
}

function onPath(env: DockEnv, f: DockFrame, p: Polyline, s: number, pose: VesselPose, out: THREE.Vector3): boolean {
  pointAt(p, s, _xz);
  return surfacePoint(env, f, _xz[0], _xz[1], pose, out);
}

/**
 * Mover `s` at crossing clock `clock`, the ferry at `pose` (this clock's pose). Queue and boarding run on the
 * boarding path at the departure dock, parking rides the deck, leaving runs on the leaving path at the arrival dock.
 * Pure and allocation-free.
 */
export function moverFrame(s: MoverSched, env: DockEnv, clock: number, pose: VesselPose, out: MoverFrame): MoverFrame {
  const T = env.spec.timings, Lg = legDuration(T), m = s.m, d = m.dims, tr = travelOf(m.leg), L = env.layout;
  const t = clock - m.leg * Lg, tl = t - moveEnd(T);
  out.visible = true; out.onDeck = false;
  if (t < s.spawn.t0 || tl > s.gone) { out.visible = false; out.stage = 'hidden'; out.speed = 0; return out; }
  if (t < s.boardEnd - 0.5) {   // queueing, then driving on (boarding path, departure dock)
    if (t < s.boardTrip.t0) { tripAt(s.spawn, t, _tp); out.stage = 'queue'; } else { tripAt(s.boardTrip, t, _tp); out.stage = 'board'; }
    const f = departFrame(env, m.leg);
    // Both contacts every frame (a short-circuit && would leave `rear` stale whenever the front is off the deck).
    const fOn = onPath(env, f, s.board, _tp.s, pose, out.front), rOn = onPath(env, f, s.board, _tp.s - d.wheelbase, pose, out.rear);
    out.onDeck = fOn && rOn;
    out.speed = _tp.v; out.dist = _tp.s - d.wheelbase;
  } else if (tl < s.leave1.t0) {   // parked: rides the deck
    out.front.set(tr * (m.park.x + d.wheelbase / 2), L.deckY, m.park.z).applyMatrix4(pose.matrix);
    out.rear.set(tr * (m.park.x - d.wheelbase / 2), L.deckY, m.park.z).applyMatrix4(pose.matrix);
    out.stage = 'park'; out.onDeck = true; out.speed = 0; out.dist = s.board.len - d.wheelbase;
  } else {   // driving off (leaving path, arrival dock)
    tripAt(tl < s.leave2.t0 ? s.leave1 : s.leave2, tl, _tp);
    const f = arriveFrame(env, m.leg);
    // Both contacts every frame (a short-circuit && would leave `rear` stale whenever the front is off the deck).
    const fOn = onPath(env, f, s.leave, _tp.s, pose, out.front), rOn = onPath(env, f, s.leave, _tp.s - d.wheelbase, pose, out.rear);
    out.onDeck = fOn && rOn;
    out.stage = 'leave'; out.speed = _tp.v; out.dist = s.board.len - d.wheelbase + (_tp.s - d.wheelbase);
  }
  if (out.onDeck) _up.set(0, 1, 0).applyQuaternion(pose.quaternion); else _up.copy(UP);
  bodyMatrix(out.front, out.rear, _up, out.matrix);
  return out;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/traffic`
Expected: PASS (verified in a scratch copy).

- [ ] **Step 5: Commit**

```bash
git add src/traffic/motion.ts src/traffic/motion.test.ts src/traffic/testing.ts src/traffic/schedule.test.ts
git commit -m "feat(4c): mover motion on road, landing, apron and deck

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The crew makes room for the load

**Files:**
- Modify: `src/ancon/crew.ts`, `src/ancon/CrewSet.ts` (`update` signature), `src/traffic/schedule.ts` (`DeckLoad` from crew.ts, `ashoreZ`)
- Create: `src/traffic/room.test.ts`

**Preflight rulings applied:** B11 (on two-lane decks no standing spot lies within 0.45 m of the centre corridor, and passengers take the spots at the deck ends first — the Phase 3 "nobody walks through anybody" test keeps passing), B12 (a spot in the lane a mover drives off along is blocked, not only its parked rectangle; the walk to the spot is checked against the parked load), N4 (`DeckLoad` lives in crew.ts so the crew does not import `src/traffic`; `Ancon.tsx` does import `src/traffic`, which is fine — there is no cycle). The cart's straight run-out past the leading poler (B13) is in `leavePath` (Task 5).

**Interfaces:**
- Produces (in `src/ancon/crew.ts`):

```ts
/** What the crew and passengers need from one leg's load (built by src/traffic/schedule.ts). */
export interface DeckLoad {
  rects: [number, number, number, number][];   // parked, deck-local [x0, x1, z0, z1]
  boardEnd: number; offEnd: number;             // s into the leg when the last mover is parked; s after unload starts when the last is off the deck
  helmAshore: boolean;
  ashoreZ: number;                              // deck-local z where the helmsman waits ashore (away from the waiting line)
}
export const NO_LOAD: DeckLoad;
ActorCtx.loadAt?: (leg: number) => DeckLoad;
export const HAUL_ASIDE = 0.25, CORRIDOR = 0.45;
export function paxBlocked(a: Actor, load: DeckLoad, spec: VesselSpec, L: DeckLayout, travel: 1 | -1): boolean;
```

- `CrewSet.update(pose, ctx, loadAt?)`.
- `schedule.ts`: `DeckLoad` / `EMPTY_LOAD` come from `crew.ts` (`export type { DeckLoad }`, `EMPTY_LOAD = NO_LOAD`); `planLeg` fills `ashoreZ`.

- [ ] **Step 1: Write the failing test**

Create `src/traffic/room.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { createCrossingState, crossingState, legDuration } from '../ancon/crossing';
import { actorFrame, castActors, createActorFrame, type ActorCtx } from '../ancon/crew';
import type { EraId } from '../data/eras';
import * as THREE from 'three';
import { createMoverFrame, moverFrame } from './motion';
import { LegCache } from './schedule';
import { discInObb, envFor, obbOf, poseFor } from './testing';

const ERAS_WITH_LOAD: EraId[] = ['1840', '1900', '1925', '1935', '1959', '1975', '1984'];

describe('crew and load', () => {
  test('nobody on board stands or walks inside a mover', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), T = env.spec.timings, Lg = legDuration(T), cache = new LegCache(env);
      const actors = castActors(env.spec, env.seats, Number(id));
      const ctx: ActorCtx = { spec: env.spec, layout: env.layout, loadAt: (l) => cache.get(l).load, groundLocal: () => 0 };
      const af = actors.map(createActorFrame), mf = [0, 1, 2, 3, 4].flatMap((l) => cache.get(l).movers).map((s) => ({ s, fr: createMoverFrame() }));
      const w = new THREE.Vector3();
      for (let c = 2 * Lg; c < 4 * Lg; c += 0.2) {
        const pose = poseFor(env, c), st = crossingState(c, createCrossingState(), T);
        const boxes = mf.map(({ s, fr }) => (moverFrame(s, env, c, pose, fr).visible ? obbOf(fr, s.m.dims) : null));
        actors.forEach((a, i) => {
          const f = actorFrame(a, st, c, ctx, af[i]);
          if (!f.visible) return;
          w.set(f.pos[0], f.pos[1], f.pos[2]).applyMatrix4(pose.matrix);
          boxes.forEach((b, j) => { if (b) expect(discInObb(w.x, w.z, 0.22, b), `${id} ${a.role}${a.index} × ${mf[j].s.m.id} @${c.toFixed(1)}`).toBe(false); });
        });
      }
    }
  });

  test('car eras keep someone standing on deck every leg', () => {
    for (const id of ['1935', '1959', '1975', '1984'] as const) {
      const env = envFor(id), T = env.spec.timings, Lg = legDuration(T), cache = new LegCache(env);
      const actors = castActors(env.spec, env.seats, Number(id)).filter((a) => a.role === 'passenger');
      const ctx: ActorCtx = { spec: env.spec, layout: env.layout, loadAt: (l) => cache.get(l).load };
      for (const leg of [0, 1, 2, 3]) {
        const c = leg * Lg + T.load + T.castOff + T.cross / 2, st = crossingState(c, createCrossingState(), T);
        expect(actors.filter((a) => actorFrame(a, st, c, ctx, createActorFrame()).visible).length, `${id} leg ${leg}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('without a load the crew is unchanged', () => {
    const env = envFor('1975'), T = env.spec.timings, actors = castActors(env.spec, env.seats, 1975);
    const a = { spec: env.spec, layout: env.layout }, b = { ...a, loadAt: () => ({ rects: [], boardEnd: 0, offEnd: 0, helmAshore: false, ashoreZ: 0 }) };
    for (let c = 0; c < legDuration(T); c += 1.3) {
      const st = crossingState(c, createCrossingState(), T);
      for (const x of actors) expect(actorFrame(x, st, c, b, createActorFrame())).toEqual(actorFrame(x, st, c, a, createActorFrame()));
    }
  });
});
```

(Without a load the crew is unchanged: haulers step aside and passengers wait only when `loadAt` reports movers — see Step 3.)

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/traffic/room.test.ts`
Expected: FAIL — `loadAt` unknown to the crew; overlaps reported.

- [ ] **Step 3: Teach the crew**

All edits are exact. `src/ancon/crew.ts` (after Task 2):

In `src/ancon/crew.ts`, replace:

```ts
  groundLocal?: (x: number, z: number) => number;
}
```

with:

```ts
  groundLocal?: (x: number, z: number) => number;
  /** Phase 4c: this leg's load (src/traffic/schedule.ts); omitted = none. */
  loadAt?: (leg: number) => DeckLoad;
}
/** What the crew and passengers need from one leg's load (built by src/traffic/schedule.ts; defined here so the crew does not import src/traffic). */
export interface DeckLoad {
  /** Parked, deck-local [x0, x1, z0, z1]. */
  rects: [number, number, number, number][];
  /** s into the leg when the last mover is parked; s after unload starts when the last mover is off the deck. */
  boardEnd: number; offEnd: number;
  helmAshore: boolean;
  /** Deck-local z where the helmsman waits ashore (away from the waiting line). */
  ashoreZ: number;
}
export const NO_LOAD: DeckLoad = { rects: [], boardEnd: 0, offEnd: 0, helmAshore: false, ashoreZ: 0 };
/** Haulers step this far outboard toward the rope (m) while a load moves on or off (spec 4c §2 fit ruling). */
export const HAUL_ASIDE = 0.25;
```

In `src/ancon/crew.ts`, replace:

```ts
  const standing = seats.filter((s) => s.kind === 'standing').map((s, k) => ({ s, k, r: room(s.pos[0], s.pos[2]) }))
```

with:

```ts
  // Two car lanes (spec 4c): passengers walk the centre corridor (laneZ), so nobody stands within CORRIDOR of it, and
  // they take the spots at the deck ends first — beside the cars the load would block the walk, and ahead of them
  // the cars drive off through the spot (paxBlocked).
  const two = L.lanes === 2, rowsHalf = (L.rows * CAR_SLOT.length) / 2, end = (s: SeatAnchor) => (two && Math.abs(s.pos[0]) > rowsHalf ? 1 : 0);
  const standing = seats.filter((s) => s.kind === 'standing' && (!two || Math.abs(s.pos[2]) >= CORRIDOR)).map((s, k) => ({ s, k, e: end(s), r: room(s.pos[0], s.pos[2]) }))
```

In `src/ancon/crew.ts`, replace:

```ts
/** Passengers walk 0.6 m off the centre line (clear of the helmsman on it at the ends); on the narrow 1935 deck, 0.5 m from the haulers. */
export const laneZ = (spec: VesselSpec, L: DeckLayout) => (spec.propulsion === 'ropes' ? Math.min(LANE_Z, Math.abs(haulerZ(1, L)) - 0.5) : LANE_Z);
```

with:

```ts
/** Passengers walk 0.6 m off the centre line (clear of the helmsman on it at the ends); on the narrow 1935 deck, 0.5 m from the haulers; between two car lanes, on the centre line. */
export const laneZ = (spec: VesselSpec, L: DeckLayout) =>
  (L.lanes === 2 ? 0 : spec.propulsion === 'ropes' ? Math.min(LANE_Z, Math.abs(haulerZ(1, L)) - 0.5) : LANE_Z);
/** On two-lane decks no standing spot lies within this of the centre corridor (a walker passes 0.44 m clear). */
export const CORRIDOR = 0.45;
```

In `src/ancon/crew.ts`, replace:

```ts
    .sort((a, b) => b.r - a.r || a.k - b.k).map((e) => e.s);
```

with:

```ts
    .sort((a, b) => b.e - a.e || b.r - a.r || a.k - b.k).map((e) => e.s);
```

In `src/ancon/crew.ts`, replace:

```ts
import { deckLayout, type DeckLayout, type VesselSpec } from './spec';
```

with:

```ts
import { CAR_SLOT, deckLayout, type DeckLayout, type VesselSpec } from './spec';
```

In `src/ancon/crew.ts`, replace:

```ts
// ---- passengers ----
const LANE_Z = 0.6, SPOT_TURN = 1.2 * TURN_S;
```

with:

```ts
// ---- passengers ----
const LANE_Z = 0.6, SPOT_TURN = 1.2 * TURN_S;
const PAX_R = 0.25 + 0.05;
const inRect = (x: number, z: number, r: [number, number, number, number]) => x > r[0] - PAX_R && x < r[1] + PAX_R && z > r[2] - PAX_R && z < r[3] + PAX_R;
/**
 * A passenger stays ashore this leg when their walk to the spot (made after the load has parked) meets the parked
 * load, or when the spot lies where a mover drives off (its rectangle stretched to the leading deck end: the load
 * leaves before the passengers do). Allocation-free.
 */
export function paxBlocked(a: Actor, load: DeckLoad, spec: VesselSpec, L: DeckLayout, travel: 1 | -1): boolean {
  if (!load.rects.length) return false;
  const sx = a.spot!.pos[0], sz = a.spot!.pos[2], lz = a.walk!.lane, xIn = -travel * L.halfLength;
  for (const r of load.rects) {
    for (let u = 0; u <= 1.0001; u += 0.02) if (inRect(xIn + (sx - xIn) * u, lz, r)) return true;
    for (let u = 0; u <= 1.0001; u += 0.1) if (inRect(sx, lz + (sz - lz) * u, r)) return true;
    _sweep[0] = travel > 0 ? r[0] : -L.halfLength; _sweep[1] = travel > 0 ? L.halfLength : r[1]; _sweep[2] = r[2]; _sweep[3] = r[3];
    if (inRect(sx, sz, _sweep)) return true;
  }
  return false;
}
const _sweep: [number, number, number, number] = [0, 0, 0, 0];
```

In `src/ancon/crew.ts`, replace:

```ts
function passenger(a: Actor, st: CrossingState, clock: number, { spec, layout: L }: ActorCtx, f: ActorFrame) {
  const T = spec.timings, MOVE_END = moveEnd(T);
  const w = a.walk!, k = st.travel > 0 ? 0 : 1, spot = a.spot!, tau = st.tLeg, tr = st.travel, V = WALK_SPEED;
```

with:

```ts
function passenger(a: Actor, st: CrossingState, clock: number, ctx: ActorCtx, f: ActorFrame) {
  const { spec, layout: L } = ctx, T = spec.timings, MOVE_END = moveEnd(T);
  const w = a.walk!, k = st.travel > 0 ? 0 : 1, spot = a.spot!, tau = st.tLeg, tr = st.travel, V = WALK_SPEED;
  const load = ctx.loadAt?.(st.legIndex) ?? NO_LOAD;
  if (paxBlocked(a, load, spec, L, st.travel)) { f.visible = false; f.pose.kind = 'stand'; return; }
```

In `src/ancon/crew.ts`, replace:

```ts
const b0 = w.board[k], bc
```

with:

```ts
const b0 = load.boardEnd + w.board[k], bc
```

In `src/ancon/crew.ts`, replace:

```ts
const l0 = MOVE_END + w.leave[k], lc
```

with:

```ts
const l0 = MOVE_END + load.offEnd + w.leave[k], lc
```

In `src/ancon/crew.ts`, replace:

```ts
function hauler(a: Actor, st: CrossingState, clock: number, { spec, layout: L }: ActorCtx, f: ActorFrame) {
```

with:

```ts
function hauler(a: Actor, st: CrossingState, clock: number, ctx: ActorCtx, f: ActorFrame) {
  const { spec, layout: L } = ctx;
```

In `src/ancon/crew.ts`, replace:

```ts
  set3(f.pos, x, L.deckY, haulerZ(side, L));
```

with:

```ts
  const load = ctx.loadAt?.(st.legIndex) ?? NO_LOAD, moving = load.rects.length > 0;
  const aside = moving ? HAUL_ASIDE * smooth(clamp01((st.slack - 0.5) / 0.5)) : 0;
  set3(f.pos, x, L.deckY, haulerZ(side, L) + side * aside);
```

In `src/ancon/crew.ts`, replace:

```ts
function helmsman(st: CrossingState, clock: number, { spec, layout: L, groundLocal }: ActorCtx, f: ActorFrame) {
  const T = spec.timings, MOVE_END = moveEnd(T);
  const tr = st.travel, tau = st.tLeg, xEnd = -tr * (L.halfLength - 0.5);
```

with:

```ts
function helmsman(st: CrossingState, clock: number, ctx: ActorCtx, f: ActorFrame) {
  const { spec, layout: L, groundLocal } = ctx, T = spec.timings, MOVE_END = moveEnd(T);
  const tr = st.travel, tau = st.tLeg, xEnd = -tr * (L.halfLength - 0.5);
  let tau0 = 0;
  const load = ctx.loadAt?.(st.legIndex) ?? NO_LOAD;
  if (load.helmAshore) {
    // Step ashore beside the trailing end (away from the waiting line), wait while the load drives on, step back.
    const xA = -tr * (L.halfLength + 1.0), zA = load.ashoreZ, legA = Math.abs(zA) / WALK_SPEED, legX = Math.abs(xA - xEnd) / WALK_SPEED;
    const out1 = legX + legA, back0 = load.boardEnd, back1 = back0 + legA + legX;
    if (tau < back1) {
      let x = xA, z = zA, dir = 0, walking = true;
      if (tau < legX) { x = xEnd + (xA - xEnd) * (tau / legX); z = 0; dir = faceDir(xA - xEnd, 0); }
      else if (tau < out1) { z = zA * ((tau - legX) / legA); dir = faceDir(0, zA); }
      else if (tau < back0) { walking = false; dir = faceDir(0, -zA); }
      else if (tau < back0 + legA) { z = zA * (1 - (tau - back0) / legA); dir = faceDir(0, -zA); }
      else { x = xA + (xEnd - xA) * ((tau - back0 - legA) / legX); z = 0; dir = faceDir(xEnd - xA, 0); }
      const onDeck = Math.abs(x) <= L.halfLength, y = onDeck || !groundLocal ? L.deckY : groundLocal(x, z);
      set3(f.pos, x, y, z); f.yaw = dir;
      f.pose.kind = walking ? 'walk' : 'stand'; f.pose.phase = fract(walking ? (Math.abs(x - xEnd) + Math.abs(z)) / STRIDE : clock * 0.1);
      applyShape(poleShape('carry', x, z + 0.3, 0, tr, 0, L, sA), f);
      return;
    }
    // Back at his station: the Phase 3 sequence (turn, lower the steering pole) runs from back1 instead of 0.
    tau0 = back1;
  }
```

In `src/ancon/crew.ts`, replace:

```ts
const k = smooth(clamp01(tau / TURN_S)), kp = smooth(clamp01(tau / POLE_SWING));
```

with:

```ts
const k = smooth(clamp01((tau - tau0) / TURN_S)), kp = smooth(clamp01((tau - tau0) / POLE_SWING));
```

`src/ancon/CrewSet.ts`:

In `src/ancon/CrewSet.ts`, replace:

```ts
import { actorFrame, createActorFrame, type Actor, type ActorCtx, type ActorFrame } from './crew';
```

with:

```ts
import { actorFrame, createActorFrame, type Actor, type ActorCtx, type ActorFrame, type DeckLoad } from './crew';
```

In `src/ancon/CrewSet.ts`, replace:

```ts
update(pose: VesselPose, ctx: ActorCtx & { groundAt?: (x: number, z: number) => number }) {
```

with:

```ts
update(pose: VesselPose, ctx: ActorCtx & { groundAt?: (x: number, z: number) => number }, loadAt?: (leg: number) => DeckLoad) {
```

In `src/ancon/CrewSet.ts`, replace:

```ts
actx.groundLocal = ctx.groundAt ? this.groundLocal : undefined;
```

with:

```ts
actx.groundLocal = ctx.groundAt ? this.groundLocal : undefined; actx.loadAt = loadAt;
```

`src/traffic/schedule.ts`:

In `src/traffic/schedule.ts`, replace:

```ts
/** What the crew needs from a leg's load (src/ancon/crew.ts). */
export interface DeckLoad { rects: [number, number, number, number][]; boardEnd: number; offEnd: number; helmAshore: boolean }
```

with:

```ts

```

In `src/traffic/schedule.ts`, replace:

```ts
export const EMPTY_LOAD: DeckLoad = { rects: [], boardEnd: 0, offEnd: 0, helmAshore: false };
```

with:

```ts
export type { DeckLoad };
export const EMPTY_LOAD = NO_LOAD;
```

In `src/traffic/schedule.ts`, replace:

```ts
import { CROSSING_TIMINGS, legDuration, type CrossingTimings } from '../ancon/crossing';
```

with:

```ts
import { CROSSING_TIMINGS, legDuration, type CrossingTimings } from '../ancon/crossing';
import { NO_LOAD, type DeckLoad } from '../ancon/crew';
```

In `src/traffic/schedule.ts`, replace:

```ts
import { ANIMAL_ROAD, boardPath, CAR_ROAD, dockEnv, leaveOffDeckS,
```

with:

```ts
import { ANIMAL_ROAD, boardPath, CAR_ROAD, departFrame, dockEnv, leaveOffDeckS,
```

In `src/traffic/schedule.ts`, replace:

```ts
queueHeadS, type DockEnv, type Polyline } from './env';
```

with:

```ts
pointAt, queueHeadS, worldToDeck, type DockEnv, type Polyline } from './env';
```

In `src/traffic/schedule.ts`, replace:

```ts
  const rects = out.map((s) => footprint(s.m, tr));
```

with:

```ts
  const rects = out.map((s) => footprint(s.m, tr));
  // The helmsman waits ashore on the deck side away from the waiting line (its head's side of the deck axis).
  const q = pointAt(out[0].board, out[0].spawn.s1, [0, 0]), [, qz] = worldToDeck(departFrame(env, leg), q[0], q[1]);
  const ashoreZ = -Math.sign(qz || 1) * (L.halfBeam + 0.6);
```

In `src/traffic/schedule.ts`, replace:

```ts
offEnd: Math.max(0, ...out.map((s) => s.offDeck)) + 0.5, helmAshore },
```

with:

```ts
offEnd: Math.max(0, ...out.map((s) => s.offDeck)) + 0.5, helmAshore, ashoreZ },
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run && npx tsc -p tsconfig.json --noEmit`
Expected: PASS, including the Phase 3 crew tests, which run without `loadAt` (verified in a scratch copy).

- [ ] **Step 5: Commit**

```bash
git add src/ancon/crew.ts src/ancon/CrewSet.ts src/traffic/schedule.ts src/traffic/room.test.ts
git commit -m "feat(4c): crew makes room — helmsman ashore, haulers at the rail, passengers clear of the load

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: A seated pose for drivers

**Files:**
- Modify: `src/people/rig.ts` (`PoseKind`, `poseFigure` switch)
- Test: `src/people/rig.test.ts`

**Preflight rulings applied:** R7 (`sitHipHeight` reuses a scratch `Proportions`: it runs per driver per frame), N3 (no filler assertion).

**Interfaces:**
- Produces: `PoseKind` gains `'sit'`; `sitHipHeight(b: Body): number` (hip joint height above the feet plane when seated; allocation-free).

- [ ] **Step 1: Write the failing test**

Append to `src/people/rig.test.ts`:

```ts
import { sitHipHeight } from './rig';

test('sit: thighs level, shins upright, hands reach a wheel ahead', () => {
  const body = { height: 1.72, build: 1, dress: false };
  const hand: V3 = [0.17, sitHipHeight(body) + 0.36, 0.45];
  const out = poseFigure(body, { kind: 'sit', phase: 0, handL: hand, handR: [-0.17, hand[1], hand[2]] }, createFigurePose());
  const col = (name: PartName, c: number) => out.parts[PART_INDEX[name] * 16 + 12 + c];
  const thighDir = (n: PartName) => { const e = out.parts.subarray(PART_INDEX[n] * 16, PART_INDEX[n] * 16 + 16); return [e[4], e[5], e[6]]; };
  const [tx, ty, tz] = thighDir('thighL'), l = Math.hypot(tx, ty, tz);
  expect(Math.abs(ty / l)).toBeLessThan(0.15);                 // near horizontal
  const [sx, sy, sz] = thighDir('shinL'), m = Math.hypot(sx, sy, sz);
  expect(Math.abs(sy / m)).toBeGreaterThan(0.95);              // near vertical
  expect(col('hips', 1)).toBeCloseTo(sitHipHeight(body), 2);
  expect(Math.hypot(out.handL[0] - hand[0], out.handL[1] - hand[1], out.handL[2] - hand[2])).toBeLessThan(0.02);
});
```

(`PART_INDEX`, `type PartName`, `type V3`, `createFigurePose` and `poseFigure` are already imported there. A segment matrix's second column is the segment direction × length; only its y share is tested, so the sign does not matter.)

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/people/rig.test.ts`
Expected: FAIL — `sitHipHeight` not exported, `'sit'` not a `PoseKind`.

- [ ] **Step 3: Add the pose**

In `src/people/rig.ts`, replace:

```ts
export type PoseKind = 'stand' | 'walk' | 'haul' | 'pole';
```

with:

```ts
export type PoseKind = 'stand' | 'walk' | 'haul' | 'pole' | 'sit';
/** Seated thigh angle (rad from straight down) — a touch below level, as on a car bench. */
const SIT_SW = 1.45, _SIT = {} as Proportions;
/** Hip joint height above the feet plane when seated: the thigh drops a little, the shin stands upright. Allocation-free. */
export const sitHipHeight = (b: Body) => { const P = proportions(b, _SIT); return P.thigh * Math.cos(SIT_SW) + P.shin + P.footH; };
```

In `src/people/rig.ts`, replace:

```ts
    case 'haul':
```

with:

```ts
    case 'sit':
      // Driver on a bench seat: thighs forward, shins upright, a slight lean back; arms go to the wheel via hand targets.
      SW[0] = SW[1] = SIT_SW; KN[0] = KN[1] = SIT_SW;
      stanceHalf = 1.2 * P.hipHalf;
      lean = input.lean ?? -0.08;
      headYaw = 0.12 * Math.sin(TAU * t / 10 + seed);
      elbow = 0.6;
      break;
    case 'haul':
```

- [ ] **Step 4: Run the people tests**

Run: `npx vitest run src/people`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/people/rig.ts src/people/rig.test.ts
git commit -m "feat(4c): seated pose for drivers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The car kit — nine period models, hi and lo, and the wheel

**Files:**
- Create: `src/traffic/carKit.ts`, `src/traffic/carKit.test.ts`

**Preflight rulings applied:** B14 (`bevelOffset: −b`, so the hi bevel no longer grows the body past its size), B15 (compact80's cabin starts inside its tail: `c0` −1.595), B16 (hi wheel 12 segments: the rim reaches ±1 on both axes), B17 (`WHEEL_TRIS.lo` = 88, the lo wheel's real count), N2 (`colored` shared with animals.ts; `wheelMatrix` shared by the ferry load and the bridge traffic).

**Interfaces:**
- Consumes: `DIMS`, `MoverDims`, `rearOverhang` (Task 4); `CarModel` (Task 3).
- Produces:

```ts
export type CarPart = 'paint' | 'glass' | 'trim' | 'dark';
export const CAR_PARTS: readonly CarPart[];      // 'paint' first
export type Detail = 'hi' | 'lo';
export interface Silhouette { /* see Step 3 */ }
export const SILHOUETTES: Record<CarModel, Silhouette>;
export function buildCar(model: CarModel, detail: Detail): Record<CarPart, THREE.BufferGeometry>;   // model frame; 'paint' has no colour attribute (instance colour), the others are vertex-coloured
export function buildWheel(detail: Detail): THREE.BufferGeometry;   // unit radius, axle along z, vertex-coloured (tyre, rim, hubcap)
export function colored(g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry;   // non-indexed, no UVs, one vertex colour
export function wheelMatrix(d: MoverDims, k: number, dist: number, body: THREE.Matrix4, out: THREE.Matrix4): THREE.Matrix4;   // wheel k (0–3) of a car body, rolled `dist` m
export const CAR_TRIS: Record<Detail, number>;   // budget per car, all four parts: hi 2400, lo 600
export const WHEEL_TRIS: Record<Detail, number>; // hi 160, lo 88
```

- [ ] **Step 1: Write the failing test**

Create `src/traffic/carKit.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import type { CarModel } from '../data/eras';
import { tris } from '../ancon/testing';
import { buildCar, buildWheel, CAR_PARTS, CAR_TRIS, WHEEL_TRIS } from './carKit';
import { DIMS, rearOverhang } from './models';

const MODELS: CarModel[] = ['modelT', 'modelA', 'sedan50', 'publico', 'sedan70', 'wagon70', 'tvVan', 'sedan80', 'compact80'];
const box = (g: Record<string, THREE.BufferGeometry>) => { const b = new THREE.Box3(); for (const x of Object.values(g)) { x.computeBoundingBox(); b.union(x.boundingBox!); } return b; };

describe('buildCar', () => {
  test('each model fills its size, sits on the ground, and stays in budget', () => {
    for (const m of MODELS) for (const detail of ['hi', 'lo'] as const) {
      const g = buildCar(m, detail), d = DIMS[m], b = box(g);
      expect(b.max.x, m).toBeCloseTo(d.wheelbase / 2 + d.front, 1);
      expect(b.min.x, m).toBeCloseTo(-(d.wheelbase / 2 + rearOverhang(d)), 1);
      expect(b.max.y, m).toBeLessThanOrEqual(d.height + 0.35);   // roof sign / mast allowed above
      expect(b.min.y, m).toBeGreaterThanOrEqual(0.1);             // wheels are separate; the body clears the ground
      expect(b.max.z - b.min.z, m).toBeLessThanOrEqual(d.width + 0.02);
      expect(CAR_PARTS.reduce((n, p) => n + tris(g[p]), 0), `${m} ${detail}`).toBeLessThanOrEqual(CAR_TRIS[detail]);
      expect(g.paint.getAttribute('color'), m).toBeUndefined();
      for (const p of ['glass', 'trim', 'dark'] as const) expect(g[p].getAttribute('position').count, `${m} ${p}`).toBeGreaterThan(0);
    }
  });
  test('the wheel is a unit disc on the z axis, in budget', () => {
    for (const detail of ['hi', 'lo'] as const) {
      const w = buildWheel(detail); w.computeBoundingBox();
      expect(w.boundingBox!.max.y).toBeCloseTo(1, 2); expect(w.boundingBox!.max.x).toBeCloseTo(1, 2);
      expect(w.boundingBox!.max.z).toBeLessThan(0.4);
      expect(tris(w)).toBeLessThanOrEqual(WHEEL_TRIS[detail]);
    }
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/traffic/carKit.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write `carKit.ts`**

Create `src/traffic/carKit.ts`:

```ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CarModel } from '../data/eras';
import { DIMS, rearOverhang, type MoverDims } from './models';

export type CarPart = 'paint' | 'glass' | 'trim' | 'dark';
export const CAR_PARTS: readonly CarPart[] = ['paint', 'glass', 'trim', 'dark'];
export type Detail = 'hi' | 'lo';
export const CAR_TRIS: Record<Detail, number> = { hi: 2400, lo: 600 };
export const WHEEL_TRIS: Record<Detail, number> = { hi: 160, lo: 88 };

/**
 * Side view of one model (model frame, m). The lower body runs from the tail to the nose along `sill`, over two
 * wheel arches, up the nose to `noseY`, back along the hood (`hoodY` at the nose, `belt` at the cowl) and the deck
 * (`deckY`), down the tail to `tailY`. The cabin sits on the belt from `c0` (rear base) to `c1` (front base) with a
 * roof at `roof`, the windshield running `ws` forward and the back window `bw` rearward at the belt. `cabinW`: cabin
 * width / body width. `glass0`: side glass starts here (vans: only the front doors). Vintage cars (Model T, A) are
 * built from boxes with separate fenders and running boards instead. All values inferred (L) from period photos.
 */
export interface Silhouette {
  sill: number; noseY: number; hoodY: number; belt: number; deckY: number; tailY: number;
  c0: number; c1: number; roof: number; ws: number; bw: number; cabinW: number; glass0?: number;
  chrome: boolean; vintage?: boolean; sign?: boolean; mast?: boolean;
}
export const SILHOUETTES: Record<CarModel, Silhouette> = {
  modelT: { sill: 0.55, noseY: 1.15, hoodY: 1.15, belt: 1.15, deckY: 1.1, tailY: 1.1, c0: -1.2, c1: 0.55, roof: 2.05, ws: 0, bw: 0, cabinW: 0.92, chrome: false, vintage: true },
  modelA: { sill: 0.5, noseY: 1.1, hoodY: 1.1, belt: 1.12, deckY: 1.05, tailY: 1.0, c0: -1.25, c1: 0.5, roof: 1.85, ws: 0.05, bw: 0, cabinW: 0.9, chrome: true, vintage: true },
  sedan50: { sill: 0.32, noseY: 0.72, hoodY: 0.86, belt: 0.9, deckY: 0.88, tailY: 0.8, c0: -1.05, c1: 0.45, roof: 1.55, ws: 0.5, bw: 0.55, cabinW: 0.86, chrome: true },
  publico: { sill: 0.32, noseY: 0.72, hoodY: 0.86, belt: 0.9, deckY: 0.88, tailY: 0.8, c0: -1.05, c1: 0.45, roof: 1.55, ws: 0.5, bw: 0.55, cabinW: 0.86, chrome: true, sign: true },
  sedan70: { sill: 0.3, noseY: 0.66, hoodY: 0.76, belt: 0.82, deckY: 0.8, tailY: 0.74, c0: -1.1, c1: 0.45, roof: 1.38, ws: 0.65, bw: 0.55, cabinW: 0.86, chrome: true },
  wagon70: { sill: 0.3, noseY: 0.66, hoodY: 0.76, belt: 0.82, deckY: 0.82, tailY: 0.8, c0: -1.89, c1: 0.45, roof: 1.42, ws: 0.65, bw: 0.12, cabinW: 0.86, chrome: true },
  tvVan: { sill: 0.35, noseY: 0.8, hoodY: 0.95, belt: 1.0, deckY: 1.0, tailY: 1.0, c0: -2.28, c1: 1.2, roof: 2.05, ws: 0.35, bw: 0.02, cabinW: 0.97, glass0: 0.2, chrome: false, mast: true },
  sedan80: { sill: 0.28, noseY: 0.62, hoodY: 0.72, belt: 0.8, deckY: 0.78, tailY: 0.72, c0: -1.05, c1: 0.55, roof: 1.36, ws: 0.6, bw: 0.45, cabinW: 0.86, chrome: false },
  compact80: { sill: 0.27, noseY: 0.6, hoodY: 0.7, belt: 0.78, deckY: 0.8, tailY: 0.78, c0: -1.595, c1: 0.45, roof: 1.38, ws: 0.6, bw: 0.35, cabinW: 0.88, chrome: false },
};

type P2 = [number, number];
const C = { chrome: 0xd8d8d4, black: 0x1c1c1c, grille: 0x2a2a28, lamp: 0xf2efe6, tail: 0x8a1a14, sign: 0xe8e2d0, under: 0x151515, glassEdge: 0x101214 };

/** Arch over a wheel at x = xc (radius r, centre height wr) cut into the bottom edge at `sill`, from rear to front. */
function arch(xc: number, wr: number, r: number, sill: number, steps: number): P2[] {
  const dy = sill - wr;
  if (Math.abs(dy) >= r) return [];
  const t0 = Math.asin(dy / r), out: P2[] = [];
  for (let i = 0; i <= steps; i++) { const t = Math.PI - t0 - ((Math.PI - 2 * t0) * i) / steps; out.push([xc + r * Math.cos(t), wr + r * Math.sin(t)]); }
  return out;
}
function extrude(pts: P2[], depth: number, bevel: number, detail: Detail): THREE.BufferGeometry {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  // bevelOffset −b keeps the bevelled outline inside the side profile (a bevel otherwise grows it by bevelSize).
  const b = detail === 'hi' ? bevel : 0, g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -(depth - 2 * b) / 2);
  g.deleteAttribute('uv');
  return g;
}
/** Non-indexed copy of `g` (disposing `g`), without UVs, every vertex coloured `hex`. Shared with src/traffic/animals.ts. */
export function colored(g: THREE.BufferGeometry, hex: number) {
  const n = g.index ? g.toNonIndexed() : g; if (n !== g) g.dispose();
  n.deleteAttribute('uv');
  const c = new THREE.Color(hex), a = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  n.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return n;
}
const boxAt = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
const cylX = (r: number, len: number, x: number, y: number, z: number, seg: number) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2).translate(x, y, z);
function merge(list: THREE.BufferGeometry[]) {
  const flat = list.map((g) => { const n = g.index ? g.toNonIndexed() : g; if (n !== g) g.dispose(); n.deleteAttribute('uv'); return n; });
  const m = mergeGeometries(flat, false)!; flat.forEach((g) => g.dispose()); return m;
}

/** A vertex-coloured window slab: the cabin outline pulled in by `inset`, extruded a hair wider than the cabin. */
function windowSlab(s: Silhouette, d: MoverDims, detail: Detail): THREE.BufferGeometry {
  const inset = 0.06, b = s.belt + 0.04, top = s.roof - inset;
  const x0 = Math.max(s.c0 - s.bw + inset, s.glass0 ?? -Infinity), x1 = s.c1 + s.ws - inset;   // raked windshield and back window
  const pts: P2[] = [[x0, b], [x1, b], [s.c1 + inset * 0.5, top], [Math.max(s.c0 + inset * 0.5, s.glass0 ?? -Infinity), top]];
  return colored(extrude(pts, d.width * s.cabinW + 0.012, 0, detail), C.glassEdge);
}

function modern(model: CarModel, detail: Detail) {
  const d = DIMS[model], s = SILHOUETTES[model], wb2 = d.wheelbase / 2, xn = wb2 + d.front, xt = -(wb2 + rearOverhang(d));
  const R = d.wheelR + 0.05, steps = detail === 'hi' ? 7 : 3;
  const body: P2[] = [
    [xt + 0.08, s.sill], ...arch(-wb2, d.wheelR, R, s.sill, steps), ...arch(wb2, d.wheelR, R, s.sill, steps), [xn - 0.08, s.sill],
    [xn, s.sill + 0.12], [xn, s.noseY], [xn - 0.14, s.hoodY], [s.c1 + s.ws, s.belt], [s.c0 - s.bw, s.belt], [xt + 0.14, s.deckY], [xt, s.tailY], [xt, s.sill + 0.12],
  ];
  const cabin: P2[] = [[s.c0 - s.bw, s.belt - 0.02], [s.c1 + s.ws, s.belt - 0.02], [s.c1, s.roof], [s.c0, s.roof]];
  const paint = merge([
    extrude(body, d.width, 0.05, detail),
    extrude(cabin, d.width * s.cabinW, 0.04, detail),
    boxAt(0.09, s.roof - s.belt - 0.02, d.width * s.cabinW + 0.014, (s.c0 + s.c1) / 2, (s.roof + s.belt) / 2, 0),   // B pillar over the glass
  ]);
  const glass = windowSlab(s, d, detail);
  const bumper = s.chrome ? C.chrome : C.black, seg = detail === 'hi' ? 10 : 6, ly = s.noseY - 0.14, lz = d.width / 2 - 0.26;
  const trim = merge([
    colored(boxAt(0.1, 0.12, d.width - 0.02, xn - 0.03, s.sill + 0.12, 0), bumper),
    colored(boxAt(0.1, 0.12, d.width - 0.02, xt + 0.03, s.sill + 0.12, 0), bumper),
    colored(cylX(0.085, 0.04, xn + 0.005, ly, lz, seg), C.chrome), colored(cylX(0.085, 0.04, xn + 0.005, ly, -lz, seg), C.chrome),
  ]);
  const darkParts = [
    colored(boxAt(0.03, Math.max(0.08, s.noseY - s.sill - 0.3), d.width - 0.7, xn - 0.005, (s.noseY + s.sill + 0.2) / 2, 0), C.grille),
    colored(boxAt(0.03, 0.12, 0.28, xt - 0.005, s.tailY - 0.12, lz), C.tail), colored(boxAt(0.03, 0.12, 0.28, xt - 0.005, s.tailY - 0.12, -lz), C.tail),
    colored(boxAt(d.wheelbase - 2 * R, Math.max(0.05, s.sill - 0.16), d.width * 0.8, 0, (s.sill + 0.16) / 2, 0), C.under),
    colored(cylX(0.075, 0.03, xn + 0.02, ly, lz, seg), C.lamp), colored(cylX(0.075, 0.03, xn + 0.02, ly, -lz, seg), C.lamp),
  ];
  if (s.sign) darkParts.push(colored(boxAt(0.55, 0.16, 0.28, (s.c0 + s.c1) / 2, s.roof + 0.08, 0), C.sign));
  if (s.mast) darkParts.push(colored(new THREE.CylinderGeometry(0.025, 0.03, 0.3, 5).translate(s.c0 + 0.4, s.roof + 0.15, -d.width * 0.3), C.black));
  return { paint, glass, trim, dark: merge(darkParts) };
}

function vintage(model: CarModel, detail: Detail) {
  const d = DIMS[model], s = SILHOUETTES[model], wb2 = d.wheelbase / 2, xn = wb2 + d.front, xt = -(wb2 + rearOverhang(d));
  const W = d.width, cw = W * s.cabinW, seg = detail === 'hi' ? 12 : 6, R = d.wheelR + 0.06;
  const hoodW = W * 0.5, hoodL = xn - 0.12 - s.c1;
  const fender = (xc: number, side: number) => new THREE.CylinderGeometry(R, R, 0.26, seg, 1, true, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(xc, d.wheelR, side * (W / 2 - 0.13));
  const paint = merge([
    boxAt(hoodL, s.hoodY - s.sill - 0.15, hoodW, s.c1 + hoodL / 2, (s.hoodY + s.sill + 0.15) / 2, 0),              // hood
    boxAt(s.c1 - s.c0, s.roof - s.sill - 0.05, cw, (s.c0 + s.c1) / 2, (s.roof + s.sill + 0.05) / 2 - 0.03, 0),      // cabin block
    boxAt(s.c0 - xt, s.deckY - s.sill, cw * 0.95, (s.c0 + xt) / 2, (s.deckY + s.sill) / 2, 0),                       // rear body
    boxAt(s.c1 - s.c0 + 0.1, 0.06, cw + 0.06, (s.c0 + s.c1) / 2, s.roof, 0),                                         // roof cap
    ...[-1, 1].flatMap((side) => [fender(-wb2, side), fender(wb2, side)]),
  ]);
  const glass = colored(merge([
    boxAt(0.03, s.roof - s.belt - 0.2, cw - 0.12, s.c1 + 0.01, (s.roof + s.belt) / 2, 0),                             // upright windshield
    boxAt(s.c1 - s.c0 - 0.3, s.roof - s.belt - 0.25, cw + 0.012, (s.c0 + s.c1) / 2, (s.roof + s.belt) / 2 + 0.02, 0),  // side glass slab
  ]), C.glassEdge);
  const trim = merge([
    colored(boxAt(0.06, s.hoodY - s.sill - 0.05, hoodW + 0.04, xn - 0.1, (s.hoodY + s.sill) / 2, 0), s.chrome ? C.chrome : C.black),   // radiator shell
    colored(cylX(0.11, 0.08, xn - 0.02, s.hoodY - 0.05, W / 2 - 0.28, seg), C.chrome), colored(cylX(0.11, 0.08, xn - 0.02, s.hoodY - 0.05, -(W / 2 - 0.28), seg), C.chrome),
  ]);
  const dark = merge([
    colored(boxAt(0.02, s.hoodY - s.sill - 0.15, hoodW - 0.1, xn - 0.07, (s.hoodY + s.sill) / 2, 0), C.grille),
    ...[-1, 1].map((side) => colored(boxAt(d.wheelbase - 2 * R, 0.04, 0.24, 0, s.sill - 0.08, side * (W / 2 - 0.12)), C.black)),   // running boards
    colored(boxAt(d.wheelbase, 0.12, cw * 0.7, 0, s.sill - 0.1, 0), C.under),
    colored(cylX(0.08, 0.03, xn - 0.0, s.hoodY - 0.05, W / 2 - 0.28, seg), C.lamp), colored(cylX(0.08, 0.03, xn - 0.0, s.hoodY - 0.05, -(W / 2 - 0.28), seg), C.lamp),
    colored(boxAt(0.03, 0.08, 0.1, xt - 0.01, s.deckY - 0.1, W * 0.3), C.tail),
  ]);
  return { paint, glass, trim, dark };
}

export function buildCar(model: CarModel, detail: Detail): Record<CarPart, THREE.BufferGeometry> {
  const g = SILHOUETTES[model].vintage ? vintage(model, detail) : modern(model, detail);
  g.paint.deleteAttribute('color');
  for (const p of CAR_PARTS) g[p].computeVertexNormals();
  return g;
}

/** Unit wheel (radius 1, axle along z): dark tyre, grey rim, chrome hubcap. Segment counts are multiples of 4, so the rim reaches ±1 on both axes. */
export function buildWheel(detail: Detail): THREE.BufferGeometry {
  const seg = detail === 'hi' ? 12 : 8, w = 0.56;
  const tyre = colored(new THREE.CylinderGeometry(1, 1, w, seg, 1).rotateX(Math.PI / 2), 0x151515);
  const rim = colored(new THREE.CylinderGeometry(0.68, 0.68, w + 0.02, seg, 1).rotateX(Math.PI / 2), 0x5a5a58);
  const cap = colored(new THREE.CylinderGeometry(0.42, 0.45, w + 0.06, detail === 'hi' ? 10 : 6, 1).rotateX(Math.PI / 2), 0xcfcfca);
  return merge([tyre, rim, cap]);
}

/** The four wheel positions (front/rear × right/left): model-local x and z signs. */
const WHEEL_SIGNS = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
const _wm = new THREE.Matrix4(), _ws = new THREE.Matrix4();
/**
 * World matrix of wheel `k` (0–3) of a car with sizes `d` whose body matrix is `body`, rolled by `dist` m. For the
 * unit wheel (buildWheel). Shared by the ferry load and the bridge traffic. Allocation-free.
 */
export function wheelMatrix(d: MoverDims, k: number, dist: number, body: THREE.Matrix4, out: THREE.Matrix4): THREE.Matrix4 {
  const [sx, sz] = WHEEL_SIGNS[k];
  _wm.makeRotationZ(-dist / d.wheelR).premultiply(_ws.makeScale(d.wheelR, d.wheelR, d.wheelR)).setPosition((sx * d.wheelbase) / 2, d.wheelR, sz * d.track);
  return out.multiplyMatrices(body, _wm);
}
```

`computeVertexNormals` on merged non-indexed geometry gives flat faces — intended (crisp panel edges read better than smoothed boxes at this size).

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/traffic/carKit.test.ts`
Expected: PASS (verified in a scratch copy). The shapes are judged by eye in Task 12's screenshots, once they are in the scene.

- [ ] **Step 5: Commit**

```bash
git add src/traffic/carKit.ts src/traffic/carKit.test.ts
git commit -m "feat(4c): car kit — nine period models (hi/lo) and the wheel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Oxen, horse, carts, bicycle

**Files:**
- Create: `src/traffic/animals.ts`, `src/traffic/animals.test.ts`

**Preflight rulings applied:** R2 (tapers the right way round: `CylinderGeometry(radiusTop, …)` lands on the segment's start), N2 (vertex colours through carKit's `colored`). R3's longer `front` (Task 4) matches the drawn heads; the anatomy is unchanged.

**Interfaces:**
- Consumes: `segmentMatrix` (`src/people/rig.ts`); `PartBuilder`, `WOOD` (`src/ancon/vessels/common.ts`); `DIMS` (Task 4); `colored` (Task 10).
- Produces:

```ts
export type Species = 'ox' | 'horse';
export interface Anatomy { length: number; shoulder: [number, number]; hip: [number, number]; legZ: number; upper: number; lower: number; r: number; stride: number }
export const ANATOMY: Record<Species, Anatomy>;
export function buildAnimalBody(sp: Species): THREE.BufferGeometry;   // one animal, its own frame (origin ground under its centre, +X forward), vertex-coloured (white coat for instance tint, horns, muzzle, hooves)
export function buildLegSegment(): THREE.BufferGeometry;              // unit segment y 0 → −1, radius 1 at the top, 0.8 at the bottom, dark hoof band
export function legMatrices(sp: Species, dist: number, moving: boolean, world: THREE.Matrix4, out: THREE.Matrix4[]): void;   // out: 8 matrices (4 upper, 4 lower), world space
export const OXEN_Z = 0.42;
export const oxenCentreX: (kind: 'oxCart' | 'caneCart') => number;   // cart-mover-local x of the two oxen
export function buildCart(kind: 'oxCart' | 'caneCart'): THREE.BufferGeometry;   // cart-mover frame, wood (PartBuilder: vertex colour + world UV)
export function buildCartWheel(): THREE.BufferGeometry;              // unit radius, axle along z, wood
export function buildBicycle(): THREE.BufferGeometry;                 // bicycle-mover frame, vertex-coloured (frame white for instance tint, tyres dark)
export const ANIMAL_TRIS = { oxBody: 1200, horseBody: 1000, leg: 60, cart: 800, cartWheel: 200, bicycle: 700 };
```

- [ ] **Step 1: Write the failing test**

Create `src/traffic/animals.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { tris } from '../ancon/testing';
import { ANATOMY, ANIMAL_TRIS, buildAnimalBody, buildBicycle, buildCart, buildCartWheel, buildLegSegment, legMatrices, oxenCentreX, OXEN_Z } from './animals';
import { DIMS } from './models';

const feet = (sp: 'ox' | 'horse', dist: number, moving: boolean) => {
  const out = Array.from({ length: 8 }, () => new THREE.Matrix4()), p = new THREE.Vector3();
  legMatrices(sp, dist, moving, new THREE.Matrix4(), out);
  return out.slice(4).map((m) => p.set(0, -1, 0).applyMatrix4(m).clone());
};

describe('animals', () => {
  test('standing, all four hooves are on the ground; walking, none goes below it', () => {
    for (const sp of ['ox', 'horse'] as const) {
      for (const f of feet(sp, 0, false)) expect(f.y).toBeCloseTo(0, 2);
      for (let d = 0; d < 3; d += 0.1) for (const f of feet(sp, d, true)) expect(f.y).toBeGreaterThanOrEqual(-0.02);
      // walking lifts at least one hoof at some point of the stride
      let lifted = false; for (let d = 0; d < ANATOMY[sp].stride; d += 0.05) if (feet(sp, d, true).some((f) => f.y > 0.05)) lifted = true;
      expect(lifted).toBe(true);
    }
  });
  test('oxen fit the cart mover: front hooves on its front contact, within its width', () => {
    for (const k of ['oxCart', 'caneCart'] as const) {
      const x = oxenCentreX(k) + ANATOMY.ox.shoulder[0];
      expect(x).toBeCloseTo(DIMS[k].wheelbase / 2, 2);
      expect(OXEN_Z + 0.3).toBeLessThanOrEqual(DIMS[k].width / 2 + 1e-9);
    }
  });
  test('budgets', () => {
    expect(tris(buildAnimalBody('ox'))).toBeLessThanOrEqual(ANIMAL_TRIS.oxBody);
    expect(tris(buildAnimalBody('horse'))).toBeLessThanOrEqual(ANIMAL_TRIS.horseBody);
    expect(tris(buildLegSegment())).toBeLessThanOrEqual(ANIMAL_TRIS.leg);
    for (const k of ['oxCart', 'caneCart'] as const) expect(tris(buildCart(k))).toBeLessThanOrEqual(ANIMAL_TRIS.cart);
    expect(tris(buildCartWheel())).toBeLessThanOrEqual(ANIMAL_TRIS.cartWheel);
    expect(tris(buildBicycle())).toBeLessThanOrEqual(ANIMAL_TRIS.bicycle);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/traffic/animals.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write `animals.ts`**

Create `src/traffic/animals.ts`:

```ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PartBuilder, WOOD } from '../ancon/vessels/common';
import { segmentMatrix, type V3 } from '../people/rig';
import { colored as tint } from './carKit';
import { DIMS } from './models';

export type Species = 'ox' | 'horse';
/**
 * Joint layout (m, the animal's own frame): shoulder and hip joints [x, y], legs at ±legZ, upper and lower leg
 * lengths (upper + lower = joint height, so a straight leg stands on the ground), leg radius, stride length.
 * Criollo oxen and a small country horse, inferred (L).
 */
export interface Anatomy { length: number; shoulder: [number, number]; hip: [number, number]; legZ: number; upper: number; lower: number; r: number; stride: number }
export const ANATOMY: Record<Species, Anatomy> = {
  ox: { length: 2.3, shoulder: [0.65, 1.0], hip: [-0.65, 1.0], legZ: 0.2, upper: 0.45, lower: 0.55, r: 0.075, stride: 1.4 },
  horse: { length: 2.4, shoulder: [0.6, 1.25], hip: [-0.6, 1.25], legZ: 0.17, upper: 0.55, lower: 0.7, r: 0.06, stride: 1.6 },
};
export const ANIMAL_TRIS = { oxBody: 1200, horseBody: 1000, leg: 60, cart: 800, cartWheel: 200, bicycle: 700 };

const COAT = 0xffffff, HORN = 0xe0d6bd, MUZZLE = 0x3a2e28, HOOF = 0x2a2420, MANE = 0x2a1f18;
const ellipsoid = (rx: number, ry: number, rz: number, x: number, y: number, z: number, seg = 10) => new THREE.SphereGeometry(1, seg, Math.max(4, seg - 4)).scale(rx, ry, rz).translate(x, y, z);
/** A tapered limb from a to b (radius r0 at a, r1 at b): a unit-height cylinder (y 0 → −1; radiusTop lands on a) placed by segmentMatrix, which stretches y only. */
const limb = (a: V3, b: V3, r0: number, r1: number, seg = 6) =>
  new THREE.CylinderGeometry(r0, r1, 1, seg).translate(0, -0.5, 0).applyMatrix4(segmentMatrix(a, b, 1, 1, new THREE.Matrix4()));
const boxy = (sx: number, sy: number, sz: number, x: number, y: number, z: number, rotZ: number) => new THREE.BoxGeometry(sx, sy, sz).rotateZ(rotZ).translate(x, y, z);
const merge = (list: THREE.BufferGeometry[]) => { const m = mergeGeometries(list, false)!; list.forEach((g) => g.dispose()); m.computeVertexNormals(); return m; };

export function buildAnimalBody(sp: Species): THREE.BufferGeometry {
  if (sp === 'ox') return merge([
    tint(ellipsoid(0.98, 0.4, 0.3, 0, 1.08, 0, 12), COAT),                   // barrel
    tint(ellipsoid(0.28, 0.2, 0.2, 0.55, 1.38, 0), COAT),                    // hump
    tint(limb([0.8, 1.2, 0], [1.1, 1.0, 0], 0.2, 0.16), COAT),               // neck
    tint(ellipsoid(0.26, 0.17, 0.14, 1.28, 0.9, 0), COAT),                   // head
    tint(ellipsoid(0.1, 0.09, 0.1, 1.48, 0.8, 0), MUZZLE),                   // muzzle
    tint(limb([1.22, 1.02, 0.1], [1.3, 1.28, 0.3], 0.035, 0.012, 5), HORN), tint(limb([1.22, 1.02, -0.1], [1.3, 1.28, -0.3], 0.035, 0.012, 5), HORN),
    tint(limb([-0.95, 1.2, 0], [-1.02, 0.55, 0], 0.03, 0.02, 5), COAT),      // tail
    tint(ellipsoid(0.18, 0.2, 0.06, 0.95, 0.75, 0), COAT),                   // dewlap
  ]);
  return merge([
    tint(ellipsoid(0.85, 0.36, 0.27, 0, 1.3, 0, 12), COAT),
    tint(limb([0.62, 1.45, 0], [1.02, 1.88, 0], 0.2, 0.13), COAT),           // neck
    tint(ellipsoid(0.3, 0.12, 0.11, 1.2, 1.78, 0), COAT),                    // head
    tint(ellipsoid(0.09, 0.08, 0.09, 1.44, 1.72, 0), MUZZLE),
    tint(boxy(0.5, 0.2, 0.06, 0.82, 1.78, 0, 0.8), MANE),                    // mane along the neck
    tint(limb([-0.84, 1.42, 0], [-0.98, 0.7, 0], 0.07, 0.03, 5), MANE),      // tail
  ]);
}

/** Unit leg segment (y 0 → −1, radius 1 at the top, 0.8 at the bottom); the lowest 12 % dark (the hoof, on the lower segment). */
export function buildLegSegment(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(1, 0.8, 1, 6, 1).translate(0, -0.5, 0).toNonIndexed();
  const p = g.attributes.position, a = new Float32Array(p.count * 3), coat = new THREE.Color(COAT), hoof = new THREE.Color(HOOF);
  for (let i = 0; i < p.count; i++) { const c = p.getY(i) < -0.88 ? hoof : coat; a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.computeVertexNormals();
  return g;
}

/** Lateral-sequence walk: left hind, left fore, right hind, right fore, a quarter stride apart. Order of `out`: LF, RF, LH, RH (upper), then the same four lower. */
const OFF = [0.25, 0.75, 0, 0.5];
const _j: V3 = [0, 0, 0], _k: V3 = [0, 0, 0], _f: V3 = [0, 0, 0], _m = new THREE.Matrix4();
export function legMatrices(sp: Species, dist: number, moving: boolean, world: THREE.Matrix4, out: THREE.Matrix4[]) {
  const A = ANATOMY[sp], ph = dist / A.stride;
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, side = i % 2 === 0 ? 1 : -1, [jx, jy] = fore ? A.shoulder : A.hip;
    const c = Math.sin(2 * Math.PI * (ph + OFF[i]));
    const swing = moving ? 0.32 * c : 0, lift = moving ? Math.max(0, Math.sin(2 * Math.PI * (ph + OFF[i]) + 0.9)) : 0;
    const bend = (fore ? 1 : -1) * 0.9 * lift;   // fore knees fold back, hocks forward
    _j[0] = jx; _j[1] = jy; _j[2] = side * A.legZ;
    _k[0] = jx + A.upper * Math.sin(swing); _k[1] = jy - A.upper * Math.cos(swing); _k[2] = _j[2];
    const lo = swing - bend;
    _f[0] = _k[0] + A.lower * Math.sin(lo); _f[1] = Math.max(0, _k[1] - A.lower * Math.cos(lo)); _f[2] = _j[2];
    out[i].copy(segmentMatrix(_j, _k, A.r, A.r, _m)).premultiply(world);
    out[i + 4].copy(segmentMatrix(_k, _f, A.r * 0.8, A.r * 0.8, _m)).premultiply(world);
  }
}

/** The two yoked oxen stand side by side at ±OXEN_Z, their front hooves on the cart mover's front contact. */
export const OXEN_Z = 0.42;
export const oxenCentreX = (kind: 'oxCart' | 'caneCart') => DIMS[kind].wheelbase / 2 - ANATOMY.ox.shoulder[0];

/** Cart (mover frame: origin between the oxen's front hooves and the cart axle, +X toward the oxen): bed, rails, tongue, yoke; cane: stakes and a load. */
export function buildCart(kind: 'oxCart' | 'caneCart'): THREE.BufferGeometry {
  const d = DIMS[kind], b = new PartBuilder(), ax = -d.wheelbase / 2, bedY = d.wheelR + 0.25, bedL = 2.4, bedW = d.width - 0.3;
  const tone = WOOD.base.getHex(), dark = WOOD.dark.getHex();
  b.box([bedL, 0.08, bedW], [ax, bedY, 0], tone);
  for (const s of [-1, 1]) b.box([bedL, 0.3, 0.05], [ax, bedY + 0.19, s * (bedW / 2)], tone);
  b.box([0.05, 0.3, bedW], [ax - bedL / 2, bedY + 0.19, 0], tone);
  b.box([0.14, 0.14, 0.2], [ax, d.wheelR, 0], dark);                      // axle block
  const yokeX = oxenCentreX(kind) + 1.05, yokeY = 1.18, tongue0 = ax + bedL / 2;
  b.cylinder(0.05, 0.05, yokeX - tongue0, [(tongue0 + yokeX) / 2, (bedY + yokeY) / 2, 0], dark, 'x', 6);   // tongue (slight slope ignored)
  b.box([0.12, 0.1, 2 * OXEN_Z + 0.5], [yokeX, yokeY, 0], dark);         // yoke across both necks
  if (kind === 'caneCart') {
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) b.cylinder(0.025, 0.025, 1.0, [ax - bedL / 2 + 0.2 + i * 0.5, bedY + 0.55, s * (bedW / 2)], dark, 'y', 5);
    for (let i = 0; i < 3; i++) b.box([bedL - 0.1, 0.28, bedW - 0.1], [ax, bedY + 0.2 + i * 0.3, 0], [0x7c6a3a, 0x6f7a3a, 0x8a7440][i]);
  }
  return b.build();
}
/** Solid country cart wheel (unit radius, axle along z): plank disc, rim, hub. */
export function buildCartWheel(): THREE.BufferGeometry {
  const b = new PartBuilder(), tone = WOOD.base.getHex();
  b.cylinder(1, 1, 0.16, [0, 0, 0], tone, 'z', 16);
  b.cylinder(0.22, 0.22, 0.3, [0, 0, 0], WOOD.dark.getHex(), 'z', 8);
  return b.build();
}
/** Bicycle (mover frame, +X forward): two wheels, diamond frame, seat, handlebar. White frame (instance tint), dark tyres and seat. */
export function buildBicycle(): THREE.BufferGeometry {
  const d = DIMS.bicycle, wx = d.wheelbase / 2, r = d.wheelR, frame = 0xffffff, dark = 0x1a1a1a;
  const tube = (a: V3, b: V3, rad = 0.018) => tint(limb(a, b, rad, rad, 5), frame);
  const wheel = (x: number) => tint(new THREE.TorusGeometry(r, 0.02, 5, 20).translate(x, r, 0), dark);
  const bb: V3 = [0, 0.32, 0], seat: V3 = [-0.18, 0.88, 0], head: V3 = [0.42, 0.9, 0];
  return merge([
    wheel(-wx), wheel(wx),
    tube(bb, seat), tube(seat, head), tube(bb, head), tube(bb, [-wx, r, 0]), tube(seat, [-wx, r, 0]), tube(head, [wx, r, 0]),
    tint(boxy(0.22, 0.05, 0.1, -0.2, 0.93, 0, 0), dark),
    tint(limb([0.45, 0.98, 0.26], [0.45, 0.98, -0.26], 0.012, 0.012, 5), dark),
  ]);
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/traffic/animals.test.ts`
Expected: PASS (verified in a scratch copy).

- [ ] **Step 5: Commit**

```bash
git add src/traffic/animals.ts src/traffic/animals.test.ts
git commit -m "feat(4c): oxen, horse, ox and cane carts, bicycle — geometry and walk

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Drawing the load — materials, TrafficSet, people, budget

**Files:**
- Create: `src/traffic/materials.ts`, `src/traffic/TrafficSet.ts`, `src/traffic/TrafficSet.test.ts`
- Modify: `src/ancon/CrewSet.ts`, `src/ancon/Ancon.tsx`

**Preflight rulings applied:** R7 (no per-frame allocation: mesh keys precomputed per model, one reused `PoseInput` per figure slot, indexed loops, a shared wheel matrix helper), N3 (the tautological "people slots" test is gone).

**Interfaces:**
- Consumes: everything above; `CrewSet` (`src/ancon/CrewSet.ts`); `poseFigure`, `createFigurePose`, `sitHipHeight` (`src/people/rig.ts`); `dressFigure` (`src/people/palettes.ts`); `wheelMatrix` (Task 10).
- Produces:

```ts
// materials.ts
export type TrafficMaterialId = 'paint' | 'glass' | 'trim' | 'dark' | 'wheel' | 'hide' | 'wood' | 'bike';
export function trafficMaterials(): Record<TrafficMaterialId, THREE.Material>;   // shared for the app's life (like infraMaterials)
// TrafficSet.ts
export type MeshKey = `${CarModel}:${CarPart}` | 'wheel' | 'oxBody' | 'oxLeg' | 'horseBody' | 'horseLeg' | 'cart:oxCart' | 'cart:caneCart' | 'cartWheel' | 'bicycle';
export function eraMeshKeys(rules: readonly LegRule[]): MeshKey[];                // meshes an era's load needs (draw calls)
export const PEOPLE_PER_LEG: (rules: readonly LegRule[]) => number;
export function trafficLooks(env: DockEnv): FigureLook[];                         // 3 legs' worth of people slots
export class TrafficSet {
  readonly group: THREE.Group;
  constructor(env: DockEnv, cache: LegCache, crew: CrewSet, castShadow: boolean);
  update(pose: VesselPose): void;   // before crew.update (which commits the shared figure batch); allocation-free
  dispose(): void;
}
// CrewSet.ts
constructor(actors: Actor[], extras?: FigureLook[]);
setExtra(k: number, world: THREE.Matrix4, pose: FigurePose, pole?: THREE.Matrix4): void;
hideExtra(k: number): void;
```

- [ ] **Step 1: Write the failing test**

Create `src/traffic/TrafficSet.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { legDuration } from '../ancon/crossing';
import { tris } from '../ancon/testing';
import { ERAS, type EraId } from '../data/eras';
import { buildAnimalBody, buildBicycle, buildCart, buildCartWheel, buildLegSegment } from './animals';
import { buildCar, buildWheel, CAR_PARTS } from './carKit';
import { isCar } from './models';
import { createMoverFrame, moverFrame } from './motion';
import { LegCache } from './schedule';
import { envFor, poseFor } from './testing';
import { eraMeshKeys } from './TrafficSet';

describe('budget (spec 4c §7)', () => {
  test('at most 14 draw calls per era (1986: the bridge traffic, Task 13, adds its own)', () => {
    for (const e of ERAS) expect(eraMeshKeys(e.ancon.load.value).length, e.id).toBeLessThanOrEqual(14);
  });
  test('at most 80 000 triangles visible at once', () => {
    const carTris = (m: Parameters<typeof buildCar>[0]) => { const g = buildCar(m, 'hi'); return CAR_PARTS.reduce((n, p) => n + tris(g[p]), 0) + 4 * tris(buildWheel('hi')); };
    const leg = tris(buildLegSegment()), cost: Record<string, number> = {
      oxCart: 2 * (tris(buildAnimalBody('ox')) + 8 * leg) + tris(buildCart('oxCart')) + 2 * tris(buildCartWheel()),
      caneCart: 2 * (tris(buildAnimalBody('ox')) + 8 * leg) + tris(buildCart('caneCart')) + 2 * tris(buildCartWheel()),
      horse: tris(buildAnimalBody('horse')) + 8 * leg, bicycle: tris(buildBicycle()),
    };
    for (const id of ['1840', '1900', '1925', '1935', '1959', '1975', '1984'] as EraId[]) {
      const env = envFor(id), Lg = legDuration(env.spec.timings), cache = new LegCache(env), fr = createMoverFrame();
      let worst = 0;
      for (let c = 2 * Lg; c < 4 * Lg; c += 0.5) {
        const pose = poseFor(env, c), n = Math.floor(c / Lg);
        let sum = 0;
        for (const l of [n - 1, n, n + 1]) for (const s of cache.get(l).movers) if (moverFrame(s, env, c, pose, fr).visible) sum += isCar(s.m.kind) ? carTris(s.m.kind) : cost[s.m.kind];
        worst = Math.max(worst, sum);
      }
      expect(worst, id).toBeLessThanOrEqual(80_000);
    }
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/traffic/TrafficSet.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Materials**

Create `src/traffic/materials.ts`:

```ts
import * as THREE from 'three';
import { vesselMaterials } from '../ancon/materials';

export type TrafficMaterialId = 'paint' | 'glass' | 'trim' | 'dark' | 'wheel' | 'hide' | 'wood' | 'bike';
let mats: Record<TrafficMaterialId, THREE.Material> | null = null;
/**
 * One set for the app's life (never disposed, like infraMaterials). Paint: clear-coated, colour per instance.
 * Glass: near-black and glossy so it takes the sky. Trim: chrome (vertex colours pick chrome, lamps).
 * Dark: rough vertex-coloured parts (grille, tyres' sidewalls, lamps' lenses, undercarriage). Hide: animal coat × instance tint.
 */
export function trafficMaterials(): Record<TrafficMaterialId, THREE.Material> {
  return (mats ??= {
    paint: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.22 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0e1215, roughness: 0.06, metalness: 0.4 }),
    trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 }),
    wheel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 }),
    hide: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
    wood: vesselMaterials().wood,
    bike: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 }),
  });
}
```

(`vesselMaterials()` in `src/ancon/materials.ts` returns a record keyed by `VesselMaterialId`, which includes `'wood'`.)

- [ ] **Step 4: CrewSet extras**

In `src/ancon/CrewSet.ts`, replace:

```ts
import { createFigurePose, poseFigure, segmentMatrix, type Body, type FigurePose } from '../people/rig';
```

with:

```ts
import type { FigureLook } from '../people/palettes';
import { createFigurePose, poseFigure, segmentMatrix, type Body, type FigurePose } from '../people/rig';
```

In `src/ancon/CrewSet.ts`, replace:

```ts
  private readonly actx: ActorCtx = { spec: undefined!, layout: undefined! };
```

with:

```ts
  private readonly actx: ActorCtx = { spec: undefined!, layout: undefined! };
  /** Phase 4c: figure slots after the actors hold the load's people (TrafficSet); their goads join the poles. */
  private readonly extraBase: number;
  private readonly extraPoles: THREE.Matrix4[];
  private extraPoleN = 0;
```

In `src/ancon/CrewSet.ts`, replace:

```ts
  constructor(private readonly actors: Actor[]) {
    const n = Math.max(1, actors.length);
    this.batch = new FigureBatch(n, this.figMat, 'hi');
    actors.forEach((a, i) => this.batch.setLook(i, a.look));
    for (let i = 0; i < n; i++) this.batch.hide(i);
```

with:

```ts
  constructor(private readonly actors: Actor[], extras: FigureLook[] = []) {
    const n = Math.max(1, actors.length + extras.length);
    this.extraBase = actors.length;
    this.batch = new FigureBatch(n, this.figMat, 'hi');
    actors.forEach((a, i) => this.batch.setLook(i, a.look));
    extras.forEach((l, k) => this.batch.setLook(this.extraBase + k, l));
    for (let i = 0; i < n; i++) this.batch.hide(i);
    this.extraPoles = extras.map(() => new THREE.Matrix4());
```

In `src/ancon/CrewSet.ts`, replace:

```ts
    this.poles.count = pi; this.poleCount = pi;
```

with:

```ts
    for (let j = 0; j < this.extraPoleN; j++) this.poles.setMatrixAt(pi++, this.extraPoles[j]);
    this.extraPoleN = 0;
    this.poles.count = pi; this.poleCount = pi;
```

In `src/ancon/CrewSet.ts`, replace:

```ts
  dispose() {
```

with:

```ts
  /** The load's people (TrafficSet): write before update(), which commits the batch. `pole`: an ox driver's goad (world). */
  setExtra(k: number, world: THREE.Matrix4, pose: FigurePose, pole?: THREE.Matrix4) {
    this.batch.set(this.extraBase + k, world, pose);
    if (pole) this.extraPoles[this.extraPoleN++].copy(pole);
  }
  hideExtra(k: number) { this.batch.hide(this.extraBase + k); }

  dispose() {
```

The goad pole is one of `CrewSet`'s poles; its capacity (actors + extras) covers every goad.

- [ ] **Step 5: TrafficSet**

Create `src/traffic/TrafficSet.ts`:

```ts
import * as THREE from 'three';
import type { CrewSet } from '../ancon/CrewSet';
import type { VesselPose } from '../ancon/pose';
import type { CarModel, LegRule } from '../data/eras';
import { dressFigure, type FigureLook } from '../people/palettes';
import { createFigurePose, poseFigure, segmentMatrix, sitHipHeight, type Body, type FigurePose, type PoseInput, type V3 } from '../people/rig';
import { buildAnimalBody, buildBicycle, buildCart, buildCartWheel, buildLegSegment, legMatrices, OXEN_Z, oxenCentreX } from './animals';
import { buildCar, buildWheel, CAR_PARTS, wheelMatrix, type CarPart } from './carKit';
import type { DockEnv } from './env';
import { trafficMaterials, type TrafficMaterialId } from './materials';
import { DIMS, isCar, type MoverKind } from './models';
import { createMoverFrame, moverFrame, type MoverFrame } from './motion';
import type { LegCache } from './schedule';

export type MeshKey = `${CarModel}:${CarPart}` | 'wheel' | 'oxBody' | 'oxLeg' | 'horseBody' | 'horseLeg' | 'cart:oxCart' | 'cart:caneCart' | 'cartWheel' | 'bicycle';

const modelsOf = (rules: readonly LegRule[]) => {
  const s = new Set<MoverKind>();
  for (const r of rules) { r.fixed.forEach((m) => s.add(m)); if (r.cars > r.fixed.length) r.pool.forEach((m) => s.add(m)); if (r.animal) s.add(r.animal); if (r.bicycles) s.add('bicycle'); }
  return s;
};
/** The meshes (= draw calls) an era's load needs. */
export function eraMeshKeys(rules: readonly LegRule[]): MeshKey[] {
  const out: MeshKey[] = [], k = modelsOf(rules);
  let cars = false;
  for (const m of k) if (isCar(m)) { cars = true; for (const p of CAR_PARTS) out.push(`${m}:${p}`); }
  if (cars) out.push('wheel');
  if (k.has('oxCart') || k.has('caneCart')) out.push('oxBody', 'oxLeg', 'cartWheel');
  if (k.has('oxCart')) out.push('cart:oxCart');
  if (k.has('caneCart')) out.push('cart:caneCart');
  if (k.has('horse')) out.push('horseBody', 'horseLeg');
  if (k.has('bicycle')) out.push('bicycle');
  return out;
}
export const PEOPLE_PER_LEG = (rules: readonly LegRule[]) => Math.max(0, ...rules.map((r) => r.cars + r.bicycles + (r.animal ? 1 : 0)));
/** Figure slots: 3 legs (n − 1, n, n + 1) × the most people any leg carries. Men in period dress (drivers, carters and horse leaders of the time, inferred L). */
export function trafficLooks(env: DockEnv): FigureLook[] {
  const n = 3 * PEOPLE_PER_LEG(env.era.ancon.load.value);
  return Array.from({ length: n }, (_, k) => dressFigure(env.spec.clothing, Number(env.era.id) * 331 + k * 7 + 5, false));
}

const HALF_PI = Math.PI / 2, STRIDE = 1.1;
/** Per car model, its part mesh keys in CAR_PARTS order (no string building per frame). */
const CAR_KEYS = {} as Record<CarModel, MeshKey[]>;
for (const m of ['modelT', 'modelA', 'sedan50', 'publico', 'sedan70', 'wagon70', 'tvVan', 'sedan80', 'compact80'] as const) CAR_KEYS[m] = CAR_PARTS.map((p) => `${m}:${p}` as MeshKey);
const CART_KEY = { oxCart: 'cart:oxCart', caneCart: 'cart:caneCart' } as const;
const OXEN_SIDES = [OXEN_Z, -OXEN_Z] as const;
const _w = new THREE.Matrix4(), _p = new THREE.Matrix4(), _q = new THREE.Matrix4(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _rot = new THREE.Matrix4().makeRotationY(HALF_PI);   // figure +Z (forward) → model +X
const _legs = Array.from({ length: 8 }, () => new THREE.Matrix4());
const _c = new THREE.Color();
/** Scratch hand targets (figure-local): steering wheel grips (y set per driver), the right handlebar grip; goad ends (world). */
const WL: V3 = [0.17, 0, 0.45], WR: V3 = [-0.17, 0, 0.45], BAR_R: V3 = [-0.21, 0.98, 0.14], GA: V3 = [0, 0, 0], GB: V3 = [0, 0, 0];

interface Slot { key: MeshKey; mesh: THREE.InstancedMesh; used: number }

/**
 * The ferry load of one era: instanced meshes per model part (created only for the kinds the era uses, eraMeshKeys),
 * written every frame for legs n − 1, n, n + 1 from moverFrame; drivers and attendants go into the crew's figure
 * batch (extra slots). World space, like the crew. Allocation-free per frame.
 */
export class TrafficSet {
  readonly group = new THREE.Group();
  private readonly slots = new Map<MeshKey, Slot>();
  private readonly list: Slot[] = [];
  private readonly frames: MoverFrame[];
  private readonly bodies: Body[];
  private readonly poses: FigurePose[];
  private readonly inputs: PoseInput[];
  private readonly perLeg: number;
  private readonly geos: THREE.BufferGeometry[] = [];

  constructor(private readonly env: DockEnv, private readonly cache: LegCache, private readonly crew: CrewSet, castShadow: boolean) {
    const rules = env.era.ancon.load.value, kinds = modelsOf(rules);
    this.perLeg = PEOPLE_PER_LEG(rules);
    const maxOf = (k: MoverKind) => Math.max(0, ...rules.map((r) => (r.animal === k ? 1 : k === 'bicycle' ? r.bicycles : isCar(k) ? r.fixed.filter((m) => m === k).length + (r.pool.includes(k as CarModel) ? r.cars - r.fixed.length : 0) : 0)));
    const add = (key: MeshKey, geo: THREE.BufferGeometry, mat: TrafficMaterialId, cap: number) => {
      if (cap <= 0) return;
      const mesh = new THREE.InstancedMesh(geo, trafficMaterials()[mat], cap);
      mesh.castShadow = castShadow; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false;
      const slot = { key, mesh, used: 0 };
      this.slots.set(key, slot); this.list.push(slot); this.group.add(mesh); this.geos.push(geo);
    };
    let carCap = 0;
    for (const k of kinds) if (isCar(k)) {
      const g = buildCar(k, 'hi'), cap = 3 * maxOf(k); carCap += cap;
      for (const p of CAR_PARTS) add(`${k}:${p}`, g[p], p, cap);
    }
    add('wheel', buildWheel('hi'), 'wheel', 4 * carCap);
    const carts = (kinds.has('oxCart') ? 3 : 0) + (kinds.has('caneCart') ? 3 : 0);
    if (carts) { add('oxBody', buildAnimalBody('ox'), 'hide', 2 * carts); add('oxLeg', buildLegSegment(), 'hide', 16 * carts); add('cartWheel', buildCartWheel(), 'wood', 2 * carts); }
    if (kinds.has('oxCart')) add('cart:oxCart', buildCart('oxCart'), 'wood', 3);
    if (kinds.has('caneCart')) add('cart:caneCart', buildCart('caneCart'), 'wood', 3);
    if (kinds.has('horse')) { add('horseBody', buildAnimalBody('horse'), 'hide', 3); add('horseLeg', buildLegSegment(), 'hide', 24); }
    if (kinds.has('bicycle')) add('bicycle', buildBicycle(), 'bike', 3 * maxOf('bicycle'));
    const looks = trafficLooks(env);
    this.frames = Array.from({ length: 3 * Math.max(1, this.perLeg) }, createMoverFrame);
    this.bodies = looks.map((l) => ({ height: l.height, build: l.build, dress: l.dress }));
    this.poses = looks.map(createFigurePose);
    this.inputs = looks.map((): PoseInput => ({ kind: 'stand', phase: 0, t: 0, seed: 0 }));
  }

  private put(key: MeshKey, m: THREE.Matrix4, color?: number) {
    const slot = this.slots.get(key)!;
    slot.mesh.setMatrixAt(slot.used, m);
    if (color !== undefined) slot.mesh.setColorAt(slot.used, _c.setHex(color));
    slot.used++;
  }

  update(pose: VesselPose) {
    for (let i = 0; i < this.list.length; i++) this.list[i].used = 0;
    const n = pose.state.legIndex, clock = pose.clock;
    let fi = 0;
    for (let dl = -1; dl <= 1; dl++) {
      const leg = n + dl, movers = this.cache.get(leg).movers, slot0 = (((leg % 3) + 3) % 3) * this.perLeg;
      let person = 0;
      for (let j = 0; j < movers.length; j++) {
        const s = movers[j], fr = moverFrame(s, this.env, clock, pose, this.frames[fi++]), m = s.m, d = m.dims;
        for (let q = 0; q < m.people.length; q++) {
          const k = slot0 + person++, p = m.people[q];
          if (!fr.visible) { this.crew.hideExtra(k); continue; }
          this.person(k, fr, p.role, p.at, p.goad, m.kind);
        }
        if (!fr.visible) continue;
        if (isCar(m.kind)) {
          const keys = CAR_KEYS[m.kind];
          for (let i = 0; i < keys.length; i++) this.put(keys[i], fr.matrix, i === 0 ? m.paint : undefined);   // CAR_PARTS[0] is 'paint'
          for (let w = 0; w < 4; w++) this.put('wheel', wheelMatrix(d, w, fr.dist, fr.matrix, _p));
        } else if (m.kind === 'oxCart' || m.kind === 'caneCart') {
          this.put(CART_KEY[m.kind], fr.matrix);
          for (let o = 0; o < 2; o++) {
            _w.makeTranslation(oxenCentreX(m.kind), 0, OXEN_SIDES[o]); _p.multiplyMatrices(fr.matrix, _w);
            this.put('oxBody', _p, m.paint);
            legMatrices('ox', fr.dist, fr.speed > 0.05, _p, _legs);
            for (let i = 0; i < 8; i++) this.put('oxLeg', _legs[i], m.paint);
          }
          const spin = fr.dist / d.wheelR;
          for (let o = 0; o < 2; o++) {
            _w.makeRotationZ(-spin).premultiply(_q.makeScale(d.wheelR, d.wheelR, 1)).setPosition(-d.wheelbase / 2, d.wheelR, o === 0 ? d.track : -d.track);
            this.put('cartWheel', _p.multiplyMatrices(fr.matrix, _w));
          }
        } else if (m.kind === 'horse') {
          this.put('horseBody', fr.matrix, m.paint);
          legMatrices('horse', fr.dist, fr.speed > 0.05, fr.matrix, _legs);
          for (let i = 0; i < 8; i++) this.put('horseLeg', _legs[i], m.paint);
        } else if (m.kind === 'bicycle') this.put('bicycle', fr.matrix, m.paint);
      }
      for (let k = slot0 + person; k < slot0 + this.perLeg; k++) this.crew.hideExtra(k);
    }
    for (let i = 0; i < this.list.length; i++) {
      const { mesh, used } = this.list[i];
      mesh.count = used; mesh.visible = used > 0; mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  /** A driver (seated in the model at `at`) or an attendant on foot (standing at `at`, facing forward). */
  private person(k: number, fr: MoverFrame, role: 'driver' | 'attendant', at: [number, number, number], goad: boolean, kind: MoverKind) {
    const body = this.bodies[k], fp = this.poses[k], input = this.inputs[k];
    input.t = fr.dist; input.seed = k; input.handL = undefined; input.handR = undefined;
    if (role === 'driver') {
      const hip = sitHipHeight(body);
      _w.makeTranslation(at[0], at[1] - hip + 0.05, at[2]).multiply(_rot);
      WL[1] = WR[1] = hip + 0.36;
      input.kind = 'sit'; input.phase = 0; input.handL = WL; input.handR = WR;
    } else {
      _w.makeTranslation(at[0], 0, at[2]).multiply(_rot);
      input.kind = fr.speed > 0.05 ? 'walk' : 'stand'; input.phase = (fr.dist / STRIDE) % 1;
      if (kind === 'bicycle') input.handR = BAR_R;
    }
    poseFigure(body, input, fp);
    _p.multiplyMatrices(fr.matrix, _w);
    let pole: THREE.Matrix4 | undefined;
    if (goad && role === 'attendant') {
      // Goad: from the right hand back toward the oxen's heads (a long thin stick).
      _v.set(fp.handR[0], fp.handR[1], fp.handR[2]).applyMatrix4(_p);
      _v2.set(DIMS[kind].wheelbase / 2 + 0.1, 1.3, 0).applyMatrix4(fr.matrix);
      GA[0] = _v.x; GA[1] = _v.y; GA[2] = _v.z; GB[0] = _v2.x; GB[1] = _v2.y; GB[2] = _v2.z;
      pole = segmentMatrix(GA, GB, 0.6, 0.6, _q);
    }
    this.crew.setExtra(k, _p, fp, pole);
  }

  dispose() {
    for (const s of this.list) { s.mesh.dispose(); this.group.remove(s.mesh); }
    for (const g of this.geos) g.dispose();
  }
}
```

- [ ] **Step 6: Mount it in the ferry**

In `src/ancon/Ancon.tsx`, replace:

```tsx
import { eraTimings } from '../traffic/schedule';
```

with:

```tsx
import { dockEnv } from '../traffic/env';
import { eraTimings, LegCache } from '../traffic/schedule';
import { TrafficSet, trafficLooks } from '../traffic/TrafficSet';
```

In `src/ancon/Ancon.tsx`, replace:

```tsx
  const crew = useMemo(() => new CrewSet(castActors(spec, seats, Number(era.id), q.ancon.passengers)), [spec, seats, era.id, q.ancon.passengers]);
  useEffect(() => () => crew.dispose(), [crew]);
```

with:

```tsx
  // Phase 4c: the load (movers on roads, landings and deck) and its people in the crew's figure batch.
  const env = useMemo(() => dockEnv(era, ctx, ctx.groundAt!), [era, ctx]);
  const legs = useMemo(() => new LegCache(env), [env]);
  const loadAt = useMemo(() => (leg: number) => legs.get(leg).load, [legs]);
  const crew = useMemo(() => new CrewSet(castActors(spec, seats, Number(era.id), q.ancon.passengers), trafficLooks(env)), [spec, seats, era.id, q.ancon.passengers, env]);
  useEffect(() => () => crew.dispose(), [crew]);
  const traffic = useMemo(() => new TrafficSet(env, legs, crew, castShadow), [env, legs, crew, castShadow]);
  useEffect(() => () => traffic.dispose(), [traffic]);
```

In `src/ancon/Ancon.tsx`, replace:

```tsx
    crew.update(pose, ctx);
```

with:

```tsx
    traffic.update(pose);   // writes the load's people into the crew batch, which crew.update commits
    crew.update(pose, ctx, loadAt);
```

In `src/ancon/Ancon.tsx`, replace:

```tsx
    <primitive object={crew.group} />
```

with:

```tsx
    <primitive object={crew.group} />
    <primitive object={traffic.group} />
```

- [ ] **Step 7: Run everything, then look**

Run: `npx vitest run && npx tsc -p tsconfig.json --noEmit`
Expected: PASS.

Then `npm run dev` and take real-GPU shots (Terminal B):

```bash
node scripts/dev/shot.mjs "?era=1984&cam=ride&t=17&c=6&freeze=1&q=high" <scratchpad>/1984-board.png 8000
node scripts/dev/shot.mjs "?era=1975&cam=station&t=17&c=6&freeze=1&q=high" <scratchpad>/1975-station-board.png 8000
node scripts/dev/shot.mjs "?era=1840&cam=ride&t=17&c=5&freeze=1&q=high" <scratchpad>/1840-cart.png 8000
node scripts/dev/shot.mjs "?era=1925&cam=bank&t=12&c=100&freeze=1&q=high" <scratchpad>/1925-bank.png 8000
```

(`<scratchpad>`: the session scratchpad directory.) Read each image. Check: cars on the deck and in line on the road, wheels on the ground (no floating, no sinking), drivers' heads visible through the glass, oxen legs on the ground, nothing black where chrome should shine. If chrome reads flat black (no environment map), set the trim `metalness` to 0.5 and log it.

- [ ] **Step 8: Commit**

```bash
git add src/traffic/materials.ts src/traffic/TrafficSet.ts src/traffic/TrafficSet.test.ts src/ancon/CrewSet.ts src/ancon/Ancon.tsx
git commit -m "feat(4c): draw the ferry load — instanced cars, carts, animals, bicycles and their people

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Bridge traffic in 1986

**Files:**
- Create: `src/traffic/bridgeTraffic.ts`, `src/traffic/bridgeTraffic.test.ts`, `src/traffic/BridgeTrafficMesh.tsx` (the file map's `BridgeTraffic.tsx`: renamed, because on a case-insensitive disk `./BridgeTraffic` resolves to `bridgeTraffic.ts` and `tsc` fails)
- Modify: `src/quality.ts`, `src/scene/World.tsx`, `src/infrastructure/roads.ts` (export `antiguaJunction`)

**Preflight rulings applied:** B18 (the component file name), R9 (the car count scales by lane length / bridge length, so about 10 — 6 on the low tier — are on the bridge at once), R7 (no per-frame allocation), N2 (lanes from `offsetRight`, paint from `PAINT[1984]`, wheels from `wheelMatrix`, spin from `BRIDGE_SPEED`).

**Interfaces:**
- Consumes: `bridgePlan`, `deckTop`, `BridgePlan` (`src/infrastructure/bridge.ts`); `bridgeWay`, `PR187_WAY`, `STORY_WAYS` (`src/infrastructure/roads.ts`); `polyline`, `pointAt`, `offsetRight`, `Polyline` (Task 5); `PAINT` (Task 4); `bodyMatrix` (Task 7); `buildCar`, `buildWheel`, `wheelMatrix` (Task 10); `trafficMaterials` (Task 12).
- Produces:

```ts
export const BRIDGE_SPEED = 11, BRIDGE_LANE = 2.4, BRIDGE_MODELS: readonly CarModel[] = ['sedan80', 'compact80'];
export interface BridgeLane { path: Polyline; y: (x: number, z: number) => number }
export function bridgeLanes(geo: GeoBundle, plan: BridgePlan, groundAt: (x: number, z: number) => number): [BridgeLane, BridgeLane];
export interface BridgeCar { lane: 0 | 1; model: CarModel; paint: number; offset: number }
export function bridgeCars(n: number): BridgeCar[];
export const bridgeCarCount: (onBridge: number, lanes: readonly BridgeLane[], plan: BridgePlan) => number;   // cars to run for ~onBridge on the bridge
export function bridgeCarAt(lane: BridgeLane, car: BridgeCar, clock: number, front: THREE.Vector3, rear: THREE.Vector3): boolean;   // false = in the hidden gap at the path end
export function BridgeTrafficMesh(props: { near: WorldFields; era: Era; n: number; castShadow: boolean }): JSX.Element;
// roads.ts
export function antiguaJunction(geo: GeoBundle): number;   // was module-private
// quality.ts
QualitySettings.traffic: { bridgeCars: number }   // cars on the bridge at once: high 10, medium 10, low 6
```

- [ ] **Step 1: Write the failing test**

Create `src/traffic/bridgeTraffic.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { bridgePlan, deckTop } from '../infrastructure/bridge';
import { bridgeWay } from '../infrastructure/roads';
import { waterAt } from '../ancon/geometry';
import { fields512 } from '../ancon/testing';
import { sampleField } from '../terrain/fields';
import { BRIDGE_LANE, bridgeCarAt, bridgeCarCount, bridgeCars, bridgeLanes } from './bridgeTraffic';
import { pointAt } from './env';
import { DIMS } from './models';

const G = geo as unknown as GeoBundle, f = fields512(0), groundAt = (x: number, z: number) => sampleField(f, f.height, x, z);
const plan = bridgePlan(bridgeWay(G), 'open', (x, z) => waterAt(f, x, z), groundAt)!;

describe('bridge traffic', () => {
  const lanes = bridgeLanes(G, plan, groundAt);
  test('lanes run past both ends and keep right of the bridge axis', () => {
    expect(lanes[0].path.len).toBeGreaterThan(plan.len);
    expect(lanes[1].path.len).toBeGreaterThan(plan.len);
    // lane 0 runs a → b; at mid-bridge it is BRIDGE_LANE right of the axis (right of dir = (−dir.z, dir.x)); lane 1 the mirror
    for (const [k, sign] of [[0, 1], [1, -1]] as const) {
      const pt: [number, number] = [0, 0];
      let best = Infinity, off = 0;
      for (let s = 0; s < lanes[k].path.len; s += 0.5) {
        const [x, z] = pointAt(lanes[k].path, s, pt), dx = x - plan.a[0], dz = z - plan.a[1];
        const along = dx * plan.dir[0] + dz * plan.dir[1], across = -dx * plan.dir[1] + dz * plan.dir[0];
        if (Math.abs(along - plan.len / 2) < best) { best = Math.abs(along - plan.len / 2); off = across; }
      }
      expect(off, `lane ${k}`).toBeCloseTo(sign * BRIDGE_LANE, 0);
    }
  });
  test('cars keep their gaps; half go each way', () => {
    const cars = bridgeCars(10), fr = new THREE.Vector3(), rr = new THREE.Vector3();
    expect(cars.filter((k) => k.lane === 0).length).toBe(5);
    for (let c = 0; c < 120; c += 0.5) for (const lane of [0, 1] as const) {
      const pos = cars.filter((k) => k.lane === lane).map((k) => (bridgeCarAt(lanes[lane], k, c, fr, rr) ? fr.clone() : null)).filter(Boolean) as THREE.Vector3[];
      for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) expect(pos[i].distanceTo(pos[j])).toBeGreaterThan(DIMS.sedan80.length + 5);
    }
  });
  test('about 10 (high) or 6 (low) cars are on the bridge at once (spec 4c §6)', () => {
    for (const want of [10, 6]) {
      const cars = bridgeCars(bridgeCarCount(want, lanes, plan)), fr = new THREE.Vector3(), rr = new THREE.Vector3();
      let sum = 0, n = 0;
      for (let c = 0; c < 200; c += 1, n++) for (const k of cars) if (bridgeCarAt(lanes[k.lane], k, c, fr, rr)) {
        const t = ((fr.x - plan.a[0]) * plan.dir[0] + (fr.z - plan.a[1]) * plan.dir[1]) / plan.len;
        if (t >= 0 && t <= 1) sum++;
      }
      expect(Math.abs(sum / n - want), `${want}`).toBeLessThan(1.5);
    }
  });
  test('on the bridge the wheels are on the deck', () => {
    const cars = bridgeCars(10), fr = new THREE.Vector3(), rr = new THREE.Vector3();
    for (let c = 0; c < 200; c += 0.7) for (const k of cars) if (bridgeCarAt(lanes[k.lane], k, c, fr, rr)) {
      const t = ((fr.x - plan.a[0]) * plan.dir[0] + (fr.z - plan.a[1]) * plan.dir[1]) / plan.len;
      if (t > 0.05 && t < 0.95) expect(Math.abs(fr.y - (deckTop(plan, t) + 0.06))).toBeLessThan(0.05);
    }
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/traffic/bridgeTraffic.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write `bridgeTraffic.ts`**

Create `src/traffic/bridgeTraffic.ts`:

```ts
import * as THREE from 'three';
import type { CarModel } from '../data/eras';
import type { GeoBundle, XZ } from '../data/geo/types';
import { deckTop, type BridgePlan } from '../infrastructure/bridge';
import { ROAD_LIFT } from '../infrastructure/roadStrip';
import { antiguaJunction, PR187_WAY, STORY_WAYS } from '../infrastructure/roads';
import { offsetRight, pointAt, polyline, type Polyline } from './env';
import { DIMS } from './models';
import { PAINT } from './plan';

/** 40 km/h (inferred L), lane centres 2.4 m either side of the bridge axis (the 9.6 m asphalt), 1984–86 models. */
export const BRIDGE_SPEED = 11, BRIDGE_LANE = 2.4;
export const BRIDGE_MODELS: readonly CarModel[] = ['sedan80', 'compact80'];
/** Deck ↔ approach blend length at each abutment (m). */
const BLEND = 8;

export interface BridgeLane { path: Polyline; y: (x: number, z: number) => number }

/** West approach (PR-187's last ~145 m) → bridge → east approach (Ruta de la Tradición), and back; each lane keeps right. */
export function bridgeLanes(geo: GeoBundle, plan: BridgePlan, groundAt: (x: number, z: number) => number): [BridgeLane, BridgeLane] {
  const way = (id: string) => geo.roads.find((r) => r.id === id)!.points;
  const west = way(PR187_WAY).slice(antiguaJunction(geo));   // PR-187 past the Antigua junction: the bridge's west approach (as eraRoads)
  const east = way(STORY_WAYS.approach);
  const centre: XZ[] = [...west, plan.b, ...east.slice(1)];
  const y = (x: number, z: number) => {
    const t = ((x - plan.a[0]) * plan.dir[0] + (z - plan.a[1]) * plan.dir[1]) / plan.len, g = groundAt(x, z) + ROAD_LIFT;
    if (t >= 0 && t <= 1) return deckTop(plan, t) + 0.06;
    const e = t < 0 ? -t * plan.len : (t - 1) * plan.len, deck = deckTop(plan, t < 0 ? 0 : 1) + 0.06;
    return e < BLEND ? deck + (g - deck) * (e / BLEND) : g;
  };
  return [{ path: polyline(offsetRight(centre, BRIDGE_LANE)), y }, { path: polyline(offsetRight([...centre].reverse(), BRIDGE_LANE)), y }];
}

export interface BridgeCar { lane: 0 | 1; model: CarModel; paint: number; offset: number }
/** n cars, half per lane, evenly spaced along it (offset = share of the lane length); 1984–86 paint (src/traffic/plan.ts). */
export function bridgeCars(n: number): BridgeCar[] {
  const per = Math.ceil(n / 2), paint = PAINT[1984];
  return Array.from({ length: n }, (_, k) => ({
    lane: (k % 2) as 0 | 1, model: BRIDGE_MODELS[(k >> 1) % 2], paint: paint[(k * 5) % paint.length], offset: Math.floor(k / 2) / per + (k % 2) * 0.37 / per,
  }));
}
/**
 * How many cars to run so about `onBridge` are on the bridge at once (spec 4c §6): the loops run the approaches too,
 * so scale by lane length / bridge length (ruling R9).
 */
export const bridgeCarCount = (onBridge: number, lanes: readonly BridgeLane[], plan: BridgePlan) =>
  2 * Math.round((onBridge / 2) * (lanes[0].path.len / plan.len));
const _xz: [number, number] = [0, 0];
/** Front and rear contacts of `car` at `clock`; false while it is in the hidden gap at the path's end. */
export function bridgeCarAt(lane: BridgeLane, car: BridgeCar, clock: number, front: THREE.Vector3, rear: THREE.Vector3): boolean {
  const L = lane.path.len, wb = DIMS[car.model].wheelbase, s = (((BRIDGE_SPEED * clock) / L + car.offset) % 1 + 1) % 1 * L;
  if (s < wb) return false;
  pointAt(lane.path, s, _xz); front.set(_xz[0], lane.y(_xz[0], _xz[1]), _xz[1]);
  pointAt(lane.path, s - wb, _xz); rear.set(_xz[0], lane.y(_xz[0], _xz[1]), _xz[1]);
  return true;
}
```

In `src/infrastructure/roads.ts`, replace:

```ts
function antiguaJunction(geo: GeoBundle) {
```

with:

```ts
export function antiguaJunction(geo: GeoBundle) {
```

- [ ] **Step 4: Quality tier and component**

In `src/quality.ts`, replace:

```ts
  ancon: { ropeSegments: number; ropeRadial: number; passengers: number };
}
```

with:

```ts
  ancon: { ropeSegments: number; ropeRadial: number; passengers: number };
  /** Phase 4c: cars on the open bridge at once (1986; spec 4c §6, §7). */
  traffic: { bridgeCars: number };
}
```

In `src/quality.ts`, replace:

```ts
ancon: { ropeSegments: 40, ropeRadial: 6, passengers: 1 } },
```

with:

```ts
ancon: { ropeSegments: 40, ropeRadial: 6, passengers: 1 }, traffic: { bridgeCars: 10 } },
```

In `src/quality.ts`, replace:

```ts
ancon: { ropeSegments: 32, ropeRadial: 6, passengers: 1 } },
```

with:

```ts
ancon: { ropeSegments: 32, ropeRadial: 6, passengers: 1 }, traffic: { bridgeCars: 10 } },
```

In `src/quality.ts`, replace:

```ts
ancon: { ropeSegments: 20, ropeRadial: 4, passengers: 0.5 } },
```

with:

```ts
ancon: { ropeSegments: 20, ropeRadial: 4, passengers: 0.5 }, traffic: { bridgeCars: 6 } },
```

Create `src/traffic/BridgeTrafficMesh.tsx`:

```tsx
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { waterAt } from '../ancon/geometry';
import { advanceClock } from '../ancon/crossing';
import type { CarModel, Era } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { bridgePlan } from '../infrastructure/bridge';
import { bridgeWay } from '../infrastructure/roads';
import { useStore } from '../state/store';
import { sampleField, type WorldFields } from '../terrain/fields';
import { placementFields } from '../terrain/placementFields';
import { BRIDGE_MODELS, BRIDGE_SPEED, bridgeCarAt, bridgeCarCount, bridgeCars, bridgeLanes } from './bridgeTraffic';
import { buildCar, buildWheel, CAR_PARTS, wheelMatrix } from './carKit';
import { trafficMaterials } from './materials';
import { DIMS } from './models';
import { bodyMatrix } from './motion';

const G = geo as unknown as GeoBundle, UP = new THREE.Vector3(0, 1, 0);
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _m = new THREE.Matrix4(), _p = new THREE.Matrix4(), _c = new THREE.Color();

/**
 * Phase 4c, 1986 only: cars cross the open bridge both ways (lo detail, ≥ 150 m from the ferry); about `n` on the
 * bridge at once. ≤ 9 draw calls. Allocation-free per frame. (Named apart from bridgeTraffic.ts: on a
 * case-insensitive disk `./BridgeTraffic` would resolve to that module.)
 */
export function BridgeTrafficMesh({ near, era, n, castShadow }: { near: WorldFields; era: Era; n: number; castShadow: boolean }) {
  const bank = era.river.bankOffset.value, place = useMemo(() => placementFields(bank, near), [bank, near]);
  const groundAt = useMemo(() => (x: number, z: number) => sampleField(near, near.height, x, z), [near]);
  const plan = useMemo(() => bridgePlan(bridgeWay(G), 'open', (x, z) => waterAt(place, x, z), groundAt)!, [place, groundAt]);
  const lanes = useMemo(() => bridgeLanes(G, plan, groundAt), [plan, groundAt]);
  const cars = useMemo(() => bridgeCars(bridgeCarCount(n, lanes, plan)), [n, lanes, plan]);
  const set = useMemo(() => {
    const mats = trafficMaterials(), group = new THREE.Group();
    const parts = {} as Record<CarModel, THREE.InstancedMesh[]>, used = {} as Record<CarModel, number>;
    for (const model of BRIDGE_MODELS) {
      const g = buildCar(model, 'lo'), cap = Math.max(1, cars.filter((c) => c.model === model).length);
      parts[model] = CAR_PARTS.map((p) => new THREE.InstancedMesh(g[p], mats[p], cap)); used[model] = 0;
    }
    const wheel = new THREE.InstancedMesh(buildWheel('lo'), mats.wheel, 4 * cars.length);
    const all = [...BRIDGE_MODELS.flatMap((m) => parts[m]), wheel];
    for (const m of all) { m.castShadow = castShadow; m.receiveShadow = true; m.frustumCulled = false; group.add(m); }
    return { group, parts, used, wheel, all };
  }, [cars, castShadow]);
  useEffect(() => () => { for (const m of set.all) { m.dispose(); m.geometry.dispose(); } }, [set]);
  const start = useStore((s) => s.crossingStart), frozen = useStore((s) => s.frozen), speed = useStore((s) => s.crossingSpeed);
  const clock = useRef(start ?? 0);
  useEffect(() => { clock.current = start ?? 0; }, [start]);
  useFrame((_, dt) => {
    clock.current = advanceClock(clock.current, Math.min(dt, 0.1), frozen, speed);
    const { parts, used, wheel } = set;
    for (let i = 0; i < BRIDGE_MODELS.length; i++) used[BRIDGE_MODELS[i]] = 0;
    let wi = 0;
    for (let k = 0; k < cars.length; k++) {
      const car = cars[k];
      if (!bridgeCarAt(lanes[car.lane], car, clock.current, _f, _r)) continue;
      bodyMatrix(_f, _r, UP, _m);
      const meshes = parts[car.model], i = used[car.model]++;
      for (let p = 0; p < meshes.length; p++) meshes[p].setMatrixAt(i, _m);
      meshes[0].setColorAt(i, _c.setHex(car.paint));   // CAR_PARTS[0] is 'paint'
      const d = DIMS[car.model], dist = BRIDGE_SPEED * clock.current;
      for (let w = 0; w < 4; w++) wheel.setMatrixAt(wi++, wheelMatrix(d, w, dist, _m, _p));
    }
    for (let i = 0; i < BRIDGE_MODELS.length; i++) {
      const meshes = parts[BRIDGE_MODELS[i]], u = used[BRIDGE_MODELS[i]];
      for (let p = 0; p < meshes.length; p++) {
        const m = meshes[p];
        m.count = u; m.visible = u > 0; m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    }
    wheel.count = wi; wheel.visible = wi > 0; wheel.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={set.group} />;
}
```

In `src/scene/World.tsx`, replace:

```tsx
import { Town } from '../town/TownMeshes';
```

with:

```tsx
import { Town } from '../town/TownMeshes';
import { BridgeTrafficMesh } from '../traffic/BridgeTrafficMesh';
```

In `src/scene/World.tsx`, replace:

```tsx
      <Town near={near} era={era} castShadow={q.shadowMap > 0} />
```

with:

```tsx
      <Town near={near} era={era} castShadow={q.shadowMap > 0} />
      {era.infrastructure.bridge.value === 'open' && <BridgeTrafficMesh near={near} era={era} n={q.traffic.bridgeCars} castShadow={q.shadowMap > 0} />}
```

- [ ] **Step 5: Run tests; look at 1986**

Run: `npx vitest run && npx tsc -p tsconfig.json --noEmit`
Expected: PASS.

With `npm run dev` running:

```bash
node scripts/dev/shot.mjs "?era=1986&cam=bridge&t=17&c=40&freeze=1&q=high" <scratchpad>/1986-bridge-traffic.png 8000
node scripts/dev/shot.mjs "?era=1986&cam=ride&t=17&c=40&freeze=1&q=high" <scratchpad>/1986-ride.png 8000
```

Read both. Record in the rulings note whether the 1986 `ride` view frames the bridge (spec §6). If it does not, add it under "Deferred" next to the 4b item about the 1986 moored heading — do **not** change the ride rig.

- [ ] **Step 6: Commit**

```bash
git add src/traffic/bridgeTraffic.ts src/traffic/bridgeTraffic.test.ts src/traffic/BridgeTrafficMesh.tsx src/quality.ts src/scene/World.tsx src/infrastructure/roads.ts docs/superpowers/notes/phase-4c-rulings.md
git commit -m "feat(4c): 1986 bridge traffic

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Shots, art gate, frame rate, fact check, review

**Files:**
- Modify: `tests/e2e/world.spec.ts` (4c shots), `docs/superpowers/notes/phase-4c-rulings.md`
- Create: `src/traffic/dockStops.ts`, `src/traffic/dockStops.test.ts`, `tests/snapshots/phase4c/*.png`

**Preflight rulings applied:** B19 (the shot list imports a plain dock-stop table, not `schedule.ts`: Playwright's ESM loader rejects the geo JSON that `schedule.ts` pulls in), N6 and the other deviations recorded in the rulings note (Step 2).

- [ ] **Step 1: Add the 4c shots**

Create `src/traffic/dockStops.ts`:

```ts
import type { EraId } from '../data/eras';

/**
 * Each era's dock stop (s), as eraTimings (src/traffic/schedule.ts) computes it — a plain table so the Playwright
 * shot list can import it without the geo bundle (Node's ESM loader rejects the JSON import). dockStops.test.ts keeps
 * it equal to eraTimings.
 */
export const DOCK_STOPS: Record<EraId, { load: number; unload: number }> = {
  '1840': { load: 43, unload: 27 }, '1900': { load: 43, unload: 27 }, '1925': { load: 43, unload: 27 }, '1935': { load: 30, unload: 22 },
  '1959': { load: 39, unload: 33 }, '1975': { load: 45, unload: 41 }, '1984': { load: 50, unload: 49 }, '1986': { load: 20, unload: 16 },
};
```

Create `src/traffic/dockStops.test.ts`:

```ts
import { expect, test } from 'vitest';
import { ERAS } from '../data/eras';
import { DOCK_STOPS } from './dockStops';
import { eraTimings } from './schedule';

test('the shot list’s dock stops match eraTimings', () => {
  for (const e of ERAS) {
    const T = eraTimings(e);
    expect(DOCK_STOPS[e.id], e.id).toEqual({ load: T.load, unload: T.unload });
  }
});
```

In `tests/e2e/world.spec.ts`, replace:

```ts
import { goldenHourAST } from '../../src/geo/sun';
```

with:

```ts
import { CROSSING_TIMINGS as T } from '../../src/ancon/crossing';
import { goldenHourAST } from '../../src/geo/sun';
import { DOCK_STOPS } from '../../src/traffic/dockStops';
```

In `tests/e2e/world.spec.ts`, replace:

```ts
const SHOTS: {
```

with:

```ts
/** Crossing clock at a moment of an era's leg 0: 6 s into boarding, mid-crossing (the waiting line ahead), 6 s into unloading. */
const at = (era: EraId, when: 'board' | 'mid' | 'unload') => {
  const { load } = DOCK_STOPS[era], move = load + T.castOff + T.cross + T.dock;
  return when === 'board' ? 6 : when === 'mid' ? Math.round(load + T.castOff + T.cross / 2) : Math.round(move + 6);
};
const SHOTS: {
```

In `tests/e2e/world.spec.ts`, replace:

```ts
  { era: '1986', cam: 'town', t: 12, c: 95, name: '1986-town-noon' },          // mostly concrete
```

with:

```ts
  { era: '1986', cam: 'town', t: 12, c: 95, name: '1986-town-noon' },          // mostly concrete
  // Phase 4c: the load driving on, riding, driving off; the waiting line; the 1986 bridge traffic.
  { era: '1840', cam: 'ride', t: golden('1840'), c: at('1840', 'board'), name: '1840-ride-board' },
  { era: '1900', cam: 'ride', t: golden('1900'), c: at('1900', 'mid'), name: '1900-ride-cane' },
  { era: '1925', cam: 'bank', t: 12, c: at('1925', 'board'), name: '1925-bank-board' },
  { era: '1935', cam: 'ride', t: golden('1935'), c: at('1935', 'mid'), name: '1935-ride-car' },
  { era: '1959', cam: 'ride', t: golden('1959'), c: at('1959', 'unload'), name: '1959-ride-unload' },
  { era: '1975', cam: 'ride', t: golden('1975'), c: at('1975', 'mid'), name: '1975-ride-line' },
  { era: '1975', cam: 'bank', t: golden('1975'), c: at('1975', 'board'), name: '1975-bank-board' },
  { era: '1984', cam: 'ride', t: golden('1984'), c: at('1984', 'board'), name: '1984-ride-board' },
  { era: '1984', cam: 'ride', t: golden('1984'), c: at('1984', 'unload'), name: '1984-ride-unload' },
  { era: '1986', cam: 'bridge', t: golden('1986'), c: 40, name: '1986-bridge-traffic' },
```

(`world.spec.ts` already writes to `phase4c` since Task 1. The existing shots keep their names; their `c` values still land in the same phases — `c = 95` is mid-crossing and `c ≤ 5` is loading in every era's timings.)

Run: `npx vitest run src/traffic/dockStops.test.ts && npx playwright test tests/e2e/world.spec.ts --list`
Expected: PASS; 45 tests listed.

- [ ] **Step 2: Record the rulings and deviations**

Add to `docs/superpowers/notes/phase-4c-rulings.md`:

```markdown
## Preflight rulings and plan deviations (2026-09-29)

The preflight scan (`.superpowers/sdd/2026-09-29-phase-4c-traffic/preflight.md`) found 18 blocking and 9 risky items in the first plan; each has a ruling (`progress.md`), applied in the amended plan and verified in a scratch copy.

- **Deck speed (R4).** Spec §4.2 says 2 m/s on ramps and deck. At 2 m/s the 1984 load takes 57 s (cap 50). `SPEED.deck` = 2.8 m/s, the lowest speed ≤ 3 m/s (0.1 steps) that keeps every era within 50 s (at 2.7 m/s 1984 loads in 51 s). Spec §4.2 amended (Task 6). Horse and bicycles 1.3 m/s, oxen 0.9 m/s, cars 5.5 m/s on the road.
- **Dock stops (R5).** Passengers stay serial (on after the load parks, off after it leaves), so every era with a load gets a longer stop: load/unload 1840 43/27, 1900 43/27, 1925 43/27, 1935 30/22, 1959 39/33, 1975 45/41, 1984 50/49 s; 1986 keeps 20/16. Spec §4.3 amended (Task 6).
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
```

- [ ] **Step 3: Take the shots**

```bash
npx playwright test tests/e2e/world.spec.ts --grep-invert @slow
```

Expected: PASS, no console errors. Files in `tests/snapshots/phase4c/`.

- [ ] **Step 4: Art gate**

Compare `phase4c/` with `phase4c-before/` (same names) and read every new 4c shot. Judge against the quality-bar image and the V1 photos (research §10: "people standing among cars", closely parked cars on a flat open deck). Check, and fix before moving on:
- no car floats, sinks into the deck or the ramp, or pops in or out in frame;
- the waiting line reads as a line on the far bank in `1975-ride-line`;
- drivers' heads show in the cabins; oxen and horse legs meet the ground;
- paint colours sit in the era's range (nothing louder than the 4b town's brightest paint);
- the ride view still shows the crew working (the load must not hide the haulers).

Record each fix in the rulings note ("Art gate" section).

- [ ] **Step 5: Frame rate after**

`npm run build && npm run preview`; rerun every Task 1 Step 5 query. Add an "After" table to the rulings note (mean ms, baseline ms, change). If a tier is more than 5 % slower, measure the before state back to back (a scratch worktree at the Task 1 commit on `:4174` with `BASE=http://localhost:4174/ancon-de-loiza/`) as in 4b; if it still fails, stop and report the numbers.

- [ ] **Step 6: Fact check**

Dispatch a review agent (general-purpose) with: the spec §2 table and rules, `docs/research/ancon-research.md` §2, §6, §9, `src/data/sources.ts`. Ask it to check each §2 claim against its named sources, open the source URLs where it can, and return only the claims it cannot confirm or finds wrong, with the source text. Add a "Fact check" section to the rulings note with its verdicts; list flagged items for the user.

- [ ] **Step 7: Code review**

Use superpowers:requesting-code-review over the branch diff (`git diff main...HEAD`). Fix every Critical and Important item; list Minor items under "Deferred" in the rulings note.

- [ ] **Step 8: Commit**

```bash
git add tests/e2e/world.spec.ts tests/snapshots/phase4c src/traffic/dockStops.ts src/traffic/dockStops.test.ts docs/superpowers/notes/phase-4c-rulings.md
git commit -m "docs(4c): shots, art gate, frame rate, fact check and review

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Hand back to the user**

Report: what each era now shows, the frame-rate table, flagged facts, deferred items, and whether 1986 `ride` frames the bridge. Do not merge; the user approves first.
