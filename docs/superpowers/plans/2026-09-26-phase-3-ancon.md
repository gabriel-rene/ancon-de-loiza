# Phase 3 — The ancón, crossing loop, crew, decade picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the hand-powered ferry on the river: one code-built vessel per era kind (timber barge, plank platform, growing wooden platform, steel pontoon, moored barge), a deterministic load → cast off → cross → dock → unload loop between the two real landings, poles or taut hauling ropes, a stylised crew and a few passengers in era clothing, a wake in the water, a `ride` camera that travels on the deck, and a minimal decade picker that switches eras instantly.

**Architecture:** Pure, unit-tested TypeScript decides everything that moves: era data → `VesselSpec` + `DeckLayout`; landing coordinates + world fields → `CrossingGeometry`; a crossing clock → `CrossingState` → `VesselPose` (drift, crab, pitch/roll/heave); rope sag, crew choreography, figure poses (FK + two-bone IK), wake samples and the ride camera are pure functions of that pose/state. Browser-side, one `<Ancon>` component owns a single `useFrame` that computes the pose, then updates imperative helpers (`RopeSet`, `CrewSet`, wake uniforms) and notifies pose listeners (the ride camera, future first-person hooks). Geometry is generated in code: vessel builders return `VesselPart[]` merged per material; people are instanced per body-part geometry.

**Tech Stack:** three 0.186, R3F 9, drei 10 (`CameraControls`), three-custom-shader-material 6, zustand 5, vitest 5 (node environment), Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-26-ancon-loiza-design.md` (§13 Phase 3 is binding; also §3 era table, §6, §7, §8) · Research: `docs/research/ancon-research.md` (§1.1 landings, §2 vessels + propulsion, §7 clothing, §9 decade table) · Carry-over: `docs/superpowers/notes/phase-1-carryover.md`, `docs/superpowers/notes/phase-2a-rulings.md`

## Global Constraints

- World frame: origin lat 18.43485, lon -65.8823; 1 unit = 1 m; +X east, +Y up, +Z south.
- Trade wind blows from the ENE toward the WSW: wind direction vector (XZ) = normalize(-1, 0.35). River flows SW→NE: normalize(1, -1) (`RIVER_DIR`, `WIND_DIR` in `src/geo/constants.ts` — import them, never re-declare).
- Every era fact carries `sources` + `confidence`; inferred values set `inferred: true`. New era fields go through the `s(value, sources, confidence, inferred)` helper in `src/data/eras.ts` and are covered by the "every fact is sourced or explicitly inferred" test.
- All art is generated in code — vessels, rigging, people, textures: no downloaded models, textures or animation clips.
- The crossing is deterministic: every moving thing is a pure function of the crossing clock + era (same clock ⇒ same pixels). `?freeze=1` stops the clock; `?c=<seconds>` pins its start.
- Quality tiers `high | medium | low` (from `src/quality.ts`) scale rope tessellation and passenger count — never the crossing itself: crossing geometry, docks, bank posts and the landing clearings are computed from the fixed 512 placement fields (`src/terrain/placementFields.ts`, the grid Phase 2a places vegetation on), whatever the tier's terrain grid.
- Tests that need the map use the shared 512 fixtures in `src/ancon/testing.ts` (`fields512`, `geom512`, `ctxFor`) — never a local `buildFields` copy.
- Performance budget: vessel + crew + ropes ≤ 1.5 ms per frame at q=high, DPR 2, and the site still runs ≥ 60 fps on the `ride` camera on the dev Mac (Apple M4 Pro). No per-frame allocation in `useFrame` paths (module-level or instance-level temporaries only).
- Units: seconds, metres, radians. Vessel-local frame: origin = hull centre at the waterline, +X toward the west (Torrecilla Baja) landing, +Y up, +Z = world direction (−dir.z, dir.x) (right-handed).
- Visual checks: run `npx vite --port 5173 --strictPort` and `node scripts/dev/shot.mjs "<query>" <out.png> [waitMs]` (queries start with `?`). Put scratch shots in the session scratchpad, not in the repo.
- Verification per task: `npm test` and `npm run build` pass. The full E2E suite (`npm run e2e`) runs in the final task; Task 10 may run its own `tests/e2e/picker.spec.ts` alone (accepted, preflight F21: the picker is UI-only and has no unit-level substitute).
- Commit message bodies end, after a blank line, with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push — the controller pushes.

---

## File map

```
src/data/eras.ts                    + Era.ancon (VesselKind, Propulsion, ClothingStyle, AnconEra), Sourced per era          T1
src/terrain/placementFields.ts      placementFields(bankOffset, near?) — the fixed 512 grid (shared with vegetation)        T1
src/ancon/spec.ts                   VesselSpec, vesselSpec(era), DeckLayout, deckLayout(spec), APRON, CAR_SLOT, GUIDE_H     T1
src/ancon/geometry.ts               CrossingGeometry, crossingGeometry, nearestShore, waterAt, dockPoint, landingClearings  T1
src/ancon/testing.ts                shared test fixtures (fields512, geom512, ctxFor, tris) — not a test file              T1, T2
src/ancon/ease.ts                   clamp01, smooth, smoothIntegral, lerp, fract, lerpAngle (one copy)                     T2
src/ancon/crossing.ts               CrossingPhase, CROSSING_TIMINGS, legDuration, crossingState, mooredState, advanceClock  T2
src/ancon/pose.ts                   PoseContext, makePoseContext, VesselPose, computeVesselPose, apronLift                  T2
src/ancon/vesselPose.ts             useVesselPose(), onVesselPose(), emitVesselPose() (future first-person hook)          T2
src/ancon/seats.ts                  SeatAnchor, seatAnchors, anchorToWorld, haulerStationX, haulerZ                        T2
src/ancon/vessels/common.ts         VesselPart, PartBuilder, WOOD/STEEL palettes, tone, plankApron, bittXZ, BITT_H          T3
src/ancon/vessels/suite.ts          vesselSuite(kinds), bounds — shared builder test suite (not a test file)                T3
src/ancon/vessels/timberBarge.ts    1840, 1900                                                                              T3
src/ancon/vessels/plankPlatform.ts  1925                                                                                    T3
src/ancon/vessels/woodPlatform.ts   1935, 1959, 1975                                                                        T3
src/ancon/vessels/vessels.test.ts   suite for the wooden kinds                                                              T3
src/ancon/vessels/index.ts          buildVessel(spec, layout, seed), TRI_BUDGET                                             T3, T4
src/ancon/vessels/steelPontoon.ts   1984, 1986                                                                              T4
src/ancon/vessels/steel.test.ts     suite + colour/bitt tests for the steel pontoon                                         T4
src/ancon/textures.ts               paintPlanks() (T3), paintSteel() (T4) — browser canvas                                  T3, T4
src/ancon/materials.ts              vesselMaterials(), canvasTexture() (browser, cached)                                    T3, T4
src/ancon/stats.ts                  anconTiming (EMA of the ancón's per-frame CPU cost + frame count)                      T3
src/ancon/Ancon.tsx                 the component: clock → pose → vessel/ropes/crew/wake → listeners                        T3, T5, T7, T8
src/ancon/rope.ts                   spanSag, writeSpan, writeRopeLine, writeTube, tubeIndex (pure)                          T5
src/ancon/rigging.ts                ropeRig (bank posts on land), shoreRopePost, guideLocal/mooringLocal/cleatLocal (out)   T5
src/ancon/pole.ts                   POLE_LEN, buildPole(seed)                                                               T5
src/ancon/RopeSet.ts                imperative ropes + posts (three objects, updated per frame)                            T5
src/people/rig.ts                   PARTS, proportions, poseFigure, solveTwoBone, segmentMatrix, ZERO_MATRIX (pure)         T6
src/people/palettes.ts              ClothingStyle palettes, SKINS, dressFigure (pure)                                      T6
src/people/geometry.ts              buildFigureGeometries, buildHatGeometries, PART_GEO                                     T6
src/people/figureBatch.ts           FigureBatch, PER_KIND: instanced figures per body-part geometry                         T6
src/ancon/crew.ts                   Actor, castActors, ActorFrame, actorFrame (pure choreography)                           T7
src/ancon/CrewSet.ts                imperative figures + poles                                                              T7
src/ancon/wake.ts                   WAKE_N, WAKE_DT, WAKE_REF, writeWake (pure)                                             T8
src/ancon/wakeUniforms.ts           shared water-shader uniforms for the hull + wake                                        T8
src/ancon/rideCamera.ts             RIDE, rideYaw, rideView, carryCamera, clampAboveGround (pure)                           T9
src/ui/picker.ts                    stepEra, withEra, isTypingTarget (pure)                                                 T10
src/ui/DecadePicker.tsx             bottom rail of 8 era buttons + ← → keys                                                 T10
src/vegetation/placementCache.ts    KeyedCache, placementKey                                                                T10
tests/e2e/picker.spec.ts            picker e2e                                                                              T10
src/scene/FrameSampler.tsx          ?perf=1 frame-time sampler                                                              T11
scripts/dev/perf.mjs                vsync-off frame-time measurement                                                        T11
modified: src/vegetation/masks.ts + placement.test.ts + Vegetation.tsx (T1: clearings on the shore points, shared 512 fields),
          src/state/url.ts + store.ts (+ tests) (T3, T10, T11), src/quality.ts (T3), src/scene/World.tsx (T3), src/ui/DebugPanel.tsx (T3),
          src/scene/water/Water.tsx + waterShader.ts (T8), src/scene/Cameras.tsx (T9), src/scene/useWorldFields.ts, src/vegetation/Vegetation.tsx,
          src/vegetation/stats.ts, src/App.tsx, src/styles.css (T10), src/App.tsx (T11), tests/e2e/world.spec.ts, tests/snapshots/README.md, README.md (T11)
```

Directory note: spec §8 lists `scene/ancon/`; the repo put Phase 2 in `src/vegetation/` (top-level, pure + components side by side). Phase 3 follows the repo: `src/ancon/` and `src/people/` (people are reused by Phase 4 passengers and townsfolk).

---

### Task 1: Era vessel data, deck layout, crossing geometry

**Files:**
- Modify: `src/data/eras.ts`, `src/data/eras.test.ts`, `src/vegetation/masks.ts`, `src/vegetation/placement.test.ts`, `src/vegetation/Vegetation.tsx`
- Create: `src/ancon/spec.ts`, `src/ancon/spec.test.ts`, `src/ancon/geometry.ts`, `src/ancon/geometry.test.ts`, `src/terrain/placementFields.ts`, `src/ancon/testing.ts`

**Interfaces:**
- Consumes: `Sourced`, `s()` (eras.ts), `landmarkXZ('eastLanding' | 'westLanding')`, `WorldFields`, `WATER` (terrain/fields.ts).
- Produces:
  - `type VesselKind = 'timberBarge' | 'plankPlatform' | 'woodPlatform' | 'steelPontoon'`
  - `type Propulsion = 'poles' | 'ropes' | 'moored'`
  - `type ClothingStyle = 'colonial' | 'earlyCentury' | 'midCentury' | 'modern'`
  - `interface AnconEra { kind; length; beam; freeboard; cars; propulsion; crew; helmsman; anconera; shoreRope; passengers; clothing }` (each `Sourced<…>`), `Era.ancon: AnconEra`
  - `interface VesselSpec { kind: VesselKind; length: number; beam: number; freeboard: number; cars: number; propulsion: Propulsion; crew: number; helmsman: boolean; anconera: boolean; shoreRope: boolean; passengers: number; clothing: ClothingStyle; moored: boolean }`, `vesselSpec(era: Era): VesselSpec`
  - `interface DeckLayout { halfLength: number; halfBeam: number; deckY: number; apron: number; reach: number; lanes: number; rows: number; guideY: number; ropeZ: number }`, `deckLayout(spec: VesselSpec): DeckLayout`
  - `APRON: Record<VesselKind, number>`, `CAR_SLOT = { length: 4.4, width: 2.5 }`, `GUIDE_H = 0.95`
  - `type XZ = readonly [number, number]`; `interface CrossingGeometry { east: XZ; west: XZ; dir: XZ; shoreEast: XZ; shoreWest: XZ; span: number; yaw: number }`
  - `waterAt(f, x, z): number`, `nearestShore(f: WorldFields, p: XZ): XZ`, `crossingGeometry(f: WorldFields): CrossingGeometry` (f = the 512 placement fields), `dockPoint(g: CrossingGeometry, side: 'east' | 'west', reach: number): XZ`, `APRON_REST = 0.8`, `CLEAR_INLAND = 6`, `landingClearings(g): [XZ, XZ]`
  - `PLACE_SIZE = 512`, `PLACE_EXTENT = 2560`, `placementFields(bankOffset: number, near?: WorldFields): WorldFields` (terrain/placementFields.ts; replaces Vegetation's private copy)
  - `buildVegMasks` now clears around `landingClearings(crossingGeometry(f))` instead of the raw landing coordinates
  - test fixtures (src/ancon/testing.ts): `fields512(bankOffset?)`, `geom512(bankOffset?)`, `tris(geometry)` (Task 2 adds `ctxFor`)

Where the ferry docks (spec §13, preflight F1): the research §1.1 landing coordinates are street/track ends on land — the west one lies 52–59 m from the water. The crossing therefore runs between the **river waterline nearest each landing coordinate** (`nearestShore`), the vessel docks there, and the Phase-2a landing clearings (`LANDING_CLEARING = [22, 40]`) are re-centred `CLEAR_INLAND` = 6 m inland of those shore points, so the docked hull (4–11 m out), the bank posts (4 m in) and the docked ride camera (8.8 m in, Task 9) all fall inside the 22 m fully-cleared radius. On the 512 fields the shore-to-shore span is ≈ 146 m post-dam and ≈ 160 m pre-dam.

- [ ] **Step 1: Failing era tests.** In `src/data/eras.test.ts`, extend `sourcedFields` with every `ancon` field and add the new tests:

```ts
// src/data/eras.test.ts — add to sourcedFields(e):
  ...(Object.values(e.ancon) as Sourced<unknown>[]),
```

```ts
// src/data/eras.test.ts — new tests inside describe('eras')
  test('vessel kind and propulsion follow the decade table (research §9, spec §3)', () => {
    expect(ERAS.map((e) => e.ancon.kind.value)).toEqual([
      'timberBarge', 'timberBarge', 'plankPlatform', 'woodPlatform', 'woodPlatform', 'woodPlatform', 'steelPontoon', 'steelPontoon',
    ]);
    expect(ERAS.map((e) => e.ancon.propulsion.value)).toEqual(['poles', 'poles', 'poles', 'ropes', 'ropes', 'ropes', 'ropes', 'moored']);
  });
  test('the wooden platform grows 1 → 4 → 6 cars and the steel barge carries 8', () => {
    const [a, b, c] = (['1935', '1959', '1975'] as const).map((id) => getEra(id).ancon);
    expect([a.cars.value, b.cars.value, c.cars.value]).toEqual([1, 4, 6]);
    expect(a.length.value).toBeLessThan(b.length.value); expect(b.length.value).toBeLessThan(c.length.value);
    expect(getEra('1984').ancon.cars.value).toBe(8);
  });
  test('sizes stay inside research §2.2 (1-car ≈ 7–8 × 3–3.5 m; steel ≈ 20–22 × 7–8 m)', () => {
    const one = getEra('1935').ancon, steel = getEra('1984').ancon;
    expect(one.length.value).toBeGreaterThanOrEqual(7); expect(one.length.value).toBeLessThanOrEqual(8);
    expect(one.beam.value).toBeGreaterThanOrEqual(3); expect(one.beam.value).toBeLessThanOrEqual(3.5);
    expect(steel.length.value).toBeGreaterThanOrEqual(20); expect(steel.length.value).toBeLessThanOrEqual(22);
    expect(steel.beam.value).toBeGreaterThanOrEqual(7); expect(steel.beam.value).toBeLessThanOrEqual(8);
  });
  test('era details: Lombera shore rope, push + steer poles, anconera, idle 1986', () => {
    expect(getEra('1840').ancon.shoreRope.value).toBe(true);
    expect(ERAS.filter((e) => e.ancon.shoreRope.value).map((e) => e.id)).toEqual(['1840']);
    expect(getEra('1925').ancon.crew.value).toBe(1); expect(getEra('1925').ancon.helmsman.value).toBe(true);
    expect(getEra('1984').ancon.anconera.value).toBe(true);
    const idle = getEra('1986').ancon;
    expect([idle.crew.value, idle.passengers.value]).toEqual([0, 0]);
    for (const e of ERAS) if (e.ancon.propulsion.value === 'ropes') {
      expect(e.ancon.crew.value).toBeGreaterThanOrEqual(2); expect(e.ancon.crew.value).toBeLessThanOrEqual(3); // "two or three" [S1]
    }
  });
  test('clothing style per era (research §7, inferred)', () => {
    expect(ERAS.map((e) => e.ancon.clothing.value)).toEqual([
      'colonial', 'earlyCentury', 'earlyCentury', 'earlyCentury', 'midCentury', 'modern', 'modern', 'modern',
    ]);
    for (const e of ERAS) expect(e.ancon.clothing.inferred).toBe(true);
  });
```

Run: `npx vitest run src/data/eras.test.ts` — Expected: FAIL (`e.ancon` undefined / type errors).

- [ ] **Step 2: Era data.** In `src/data/eras.ts` add the types, the `ancon` field on `Era`, one `ancon:` entry per era. Values and citations (sizes of the wooden platforms derive from CAR_SLOT rows/lanes; see research §2.2 "[INFERRED] dimensions"):

```ts
export type VesselKind = 'timberBarge' | 'plankPlatform' | 'woodPlatform' | 'steelPontoon';
export type Propulsion = 'poles' | 'ropes' | 'moored';
export type ClothingStyle = 'colonial' | 'earlyCentury' | 'midCentury' | 'modern';
export interface AnconEra {
  kind: Sourced<VesselKind>;
  /** Hull/deck length without the hinged end aprons, m. */
  length: Sourced<number>;
  beam: Sourced<number>;
  /** Walking surface above the waterline, m. */
  freeboard: Sourced<number>;
  /** Vehicle slots on deck (0 = walkers, carts and animals only). Vehicles themselves arrive in Phase 4. */
  cars: Sourced<number>;
  propulsion: Sourced<Propulsion>;
  /** Polers or rope haulers (the helmsman is counted separately). */
  crew: Sourced<number>;
  /** A second pole "keeps the course" as a rudder (research §2.3). */
  helmsman: Sourced<boolean>;
  /** 1978–86: María Luisa Cortijo, the only woman to run the ancón, is one of the haulers. */
  anconera: Sourced<boolean>;
  /** 1840s Lombera inset: a rope from the craft's side to the shore. */
  shoreRope: Sourced<boolean>;
  /** People standing on deck per trip (Phase 3: people only). */
  passengers: Sourced<number>;
  clothing: Sourced<ClothingStyle>;
}
// in interface Era:
  ancon: AnconEra;
```

```ts
// Clothing: research §7 is general Puerto Rican dress by period, [INFERRED] (L) — no ancón-specific source.
const WEAR = (c: ClothingStyle) => s(c, [], 'L', true);
const NO = (src: string[]) => s(false, src, 'H');
const ANCON = {
  '1840': { kind: s<VesselKind>('timberBarge', ['S3'], 'M'), length: s(8, ['S3'], 'L', true), beam: s(3, ['S3'], 'L', true),
    freeboard: s(0.15, [], 'L', true), cars: s(0, ['S3'], 'L', true), propulsion: s<Propulsion>('poles', ['S3'], 'M'),
    crew: s(2, ['S3'], 'L', true), helmsman: s(true, ['S1'], 'L', true), anconera: NO(['S11']),
    shoreRope: s(true, ['S3'], 'M'), passengers: s(3, ['S3'], 'L', true), clothing: WEAR('colonial') },
  '1900': { kind: s<VesselKind>('timberBarge', ['S3'], 'M'), length: s(8.5, ['S3'], 'L', true), beam: s(3.2, ['S3'], 'L', true),
    freeboard: s(0.15, [], 'L', true), cars: s(0, ['S1'], 'L', true), propulsion: s<Propulsion>('poles', ['S1', 'S3'], 'M'),
    crew: s(2, ['S1'], 'L', true), helmsman: s(true, ['S1'], 'L', true), anconera: NO(['S11']),
    shoreRope: s(false, ['S3'], 'L', true), passengers: s(5, ['S1'], 'L', true), clothing: WEAR('earlyCentury') },
  '1925': { kind: s<VesselKind>('plankPlatform', ['S1', 'S4'], 'H'), length: s(7, ['S4'], 'L', true), beam: s(3.2, ['S4'], 'L', true),
    freeboard: s(0.35, [], 'L', true), cars: s(1, ['S4'], 'H'), propulsion: s<Propulsion>('poles', ['S1', 'S4'], 'H'),
    crew: s(1, ['S1'], 'H'), helmsman: s(true, ['S1'], 'H'), anconera: NO(['S11']),
    shoreRope: s(false, ['S1'], 'M'), passengers: s(3, ['S1'], 'L', true), clothing: WEAR('earlyCentury') },
  '1935': { kind: s<VesselKind>('woodPlatform', ['S1', 'S4'], 'H'), length: s(7.5, ['S4'], 'L', true), beam: s(3.2, ['S4'], 'L', true),
    freeboard: s(0.45, [], 'L', true), cars: s(1, ['S4'], 'H'), propulsion: s<Propulsion>('ropes', ['S1', 'S4'], 'H'),
    crew: s(2, ['S1'], 'H'), helmsman: s(false, ['S1'], 'M', true), anconera: NO(['S11']),
    shoreRope: s(false, ['S1'], 'M'), passengers: s(3, ['S1'], 'L', true), clothing: WEAR('earlyCentury') },
  '1959': { kind: s<VesselKind>('woodPlatform', ['S1'], 'H'), length: s(12.5, ['S1'], 'L', true), beam: s(6.2, ['S1'], 'L', true),
    freeboard: s(0.45, [], 'L', true), cars: s(4, ['S1'], 'M', true), propulsion: s<Propulsion>('ropes', ['S1'], 'H'),
    crew: s(3, ['S1'], 'H'), helmsman: s(false, ['S1'], 'M', true), anconera: NO(['S11']),
    shoreRope: s(false, ['S1'], 'M'), passengers: s(4, ['S1', 'S4'], 'L', true), clothing: WEAR('midCentury') },
  '1975': { kind: s<VesselKind>('woodPlatform', ['S1'], 'H'), length: s(17, ['S1'], 'L', true), beam: s(6.6, ['S1'], 'L', true),
    freeboard: s(0.5, [], 'L', true), cars: s(6, ['S1'], 'H'), propulsion: s<Propulsion>('ropes', ['S1'], 'H'),
    crew: s(3, ['S1'], 'H'), helmsman: s(false, ['S1'], 'M', true), anconera: NO(['S11']),
    shoreRope: s(false, ['S1'], 'M'), passengers: s(7, ['S1'], 'M', true), clothing: WEAR('modern') },
  '1984': { kind: s<VesselKind>('steelPontoon', ['S1', 'S4'], 'H'), length: s(20, ['S1', 'S4'], 'M', true), beam: s(7.5, ['S1', 'S4'], 'M', true),
    freeboard: s(0.7, [], 'L', true), cars: s(8, ['S1'], 'H'), propulsion: s<Propulsion>('ropes', ['S1', 'S2', 'S4'], 'H'),
    crew: s(2, ['S1', 'S4', 'S11'], 'M', true), helmsman: s(false, ['S1'], 'M', true), anconera: s(true, ['S4', 'S11'], 'H'),
    shoreRope: s(false, ['S1'], 'M'), passengers: s(6, ['S4'], 'M', true), clothing: WEAR('modern') },
  '1986': { kind: s<VesselKind>('steelPontoon', ['S4'], 'H'), length: s(20, ['S1', 'S4'], 'M', true), beam: s(7.5, ['S1', 'S4'], 'M', true),
    freeboard: s(0.7, [], 'L', true), cars: s(8, ['S1'], 'H'), propulsion: s<Propulsion>('moored', ['S1', 'S4'], 'H'),
    crew: s(0, ['S1', 'S4'], 'H'), helmsman: s(false, ['S1', 'S4'], 'H'), anconera: s(false, ['S1', 'S4'], 'H'),
    shoreRope: s(false, ['S4'], 'M', true), passengers: s(0, ['S1', 'S4'], 'H'), clothing: WEAR('modern') },
} satisfies Record<EraId, AnconEra>;
```

Add `ancon: ANCON['<id>']` to each entry of `ERAS`. Comment the 1959 choice next to the entry: *spec §13 lists 1 → 2 → 4 → 6 but has three wooden-platform eras; 1959 takes 4 (upper end of the 1950s "2–4 cars incl. público" row), the builder supports 2 as well.* (Accepted, preflight F14: research §9 gives 1950s "~2–4 cars", so 1935 = 1, 1959 = 4, 1975 = 6.) Run the era tests → PASS.

- [ ] **Step 3: Failing spec + geometry tests**

```ts
// src/ancon/spec.test.ts
import { expect, test } from 'vitest';
import { ERAS, getEra } from '../data/eras';
import { APRON, CAR_SLOT, deckLayout, GUIDE_H, vesselSpec } from './spec';

test('vesselSpec flattens the Sourced era values', () => {
  const s = vesselSpec(getEra('1984'));
  expect(s).toMatchObject({ kind: 'steelPontoon', length: 20, beam: 7.5, cars: 8, propulsion: 'ropes', crew: 2, anconera: true, moored: false });
  expect(vesselSpec(getEra('1986')).moored).toBe(true);
});
test('every deck fits its car slots with a 0.3 m margin all round', () => {
  for (const e of ERAS) {
    const s = vesselSpec(e), L = deckLayout(s);
    expect(L.lanes * L.rows, e.id).toBeGreaterThanOrEqual(s.cars);
    expect(L.rows * CAR_SLOT.length, e.id).toBeLessThanOrEqual(s.length - 0.6);
    expect(L.lanes * CAR_SLOT.width, e.id).toBeLessThanOrEqual(s.beam - 0.6);
  }
});
test('layout: reach = half length + apron, guides above the deck, rope lines inside the beam', () => {
  for (const e of ERAS) {
    const s = vesselSpec(e), L = deckLayout(s);
    expect(L.reach).toBeCloseTo(s.length / 2 + APRON[s.kind], 9);
    expect(L.guideY).toBeCloseTo(s.freeboard + GUIDE_H, 9);
    expect(L.ropeZ).toBeLessThan(L.halfBeam); expect(L.ropeZ).toBeGreaterThan(L.halfBeam - 0.5);
  }
  expect(deckLayout(vesselSpec(getEra('1840'))).lanes).toBe(0);
});
```

The map tests share one fixture module (512 placement fields, preflight F2/F11). Create it with the shared 512 fields first:

```ts
// src/terrain/placementFields.ts
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { buildFields, type WorldFields } from './fields';

/**
 * The fixed 512 × 512 near fields (2560 m) that vegetation placement and the ferry's crossing
 * geometry are computed from, whatever the quality tier's terrain resolution — so plants, docks,
 * bank posts and the crossing line never move with the tier (Phase 2a ruling, Phase 3 F11).
 */
export const PLACE_SIZE = 512, PLACE_EXTENT = 2560;
const cache = new Map<number, WorldFields>();
/** Returns `near` itself when it already is the 512 grid (high tier), else a cached build per bank offset. */
export function placementFields(bankOffset: number, near?: WorldFields): WorldFields {
  if (near && near.grid.size === PLACE_SIZE && near.grid.cell * near.grid.size === PLACE_EXTENT) return near;
  let f = cache.get(bankOffset);
  if (!f) {
    f = buildFields(geo as unknown as GeoBundle, { extent: PLACE_EXTENT, size: PLACE_SIZE, bankOffset });
    cache.set(bankOffset, f);
  }
  return f;
}
```

```ts
// src/ancon/testing.ts
// Shared test fixtures for src/ancon (imported by *.test.ts only; not collected as a test file).
import type * as THREE from 'three';
import { placementFields } from '../terrain/placementFields';
import { crossingGeometry } from './geometry';

/** The 512 placement fields — the grid the app computes the crossing from. */
export const fields512 = (bankOffset = 0) => placementFields(bankOffset);
export const geom512 = (bankOffset = 0) => crossingGeometry(fields512(bankOffset));
export const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
```

```ts
// src/ancon/geometry.test.ts
import { describe, expect, test } from 'vitest';
import { ERAS } from '../data/eras';
import { landmarkXZ } from '../data/landmarks';
import { RIVER_DIR } from '../geo/constants';
import { WATER, type WorldFields } from '../terrain/fields';
import { LANDING_CLEARING } from '../vegetation/masks';
import { dockPoint, landingClearings, waterAt, type XZ } from './geometry';
import { deckLayout, vesselSpec } from './spec';
import { fields512, geom512 } from './testing';

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Brute force: distance from p to the nearest RIVER cell centre. */
const nearestRiverCell = (f: WorldFields, p: XZ) => {
  const g = f.grid;
  let best = Infinity;
  for (let j = 0; j < g.size; j++) for (let i = 0; i < g.size; i++) if (f.water[j * g.size + i] === WATER.RIVER)
    best = Math.min(best, Math.hypot(g.minX + (i + 0.5) * g.cell - p[0], g.minZ + (j + 0.5) * g.cell - p[1]));
  return best;
};

describe.each([0, 8])('crossing geometry, bankOffset %i (512 placement fields)', (bank) => {
  const f = fields512(bank), g = geom512(bank);
  test('landings are the research §1.1 coordinates, on land, ~220 m apart', () => {
    expect(g.east).toEqual(landmarkXZ('eastLanding')); expect(g.west).toEqual(landmarkXZ('westLanding'));
    expect(dist(g.east, g.west)).toBeGreaterThan(200); expect(dist(g.east, g.west)).toBeLessThan(235);
    expect(waterAt(f, ...g.east)).toBe(WATER.LAND); expect(waterAt(f, ...g.west)).toBe(WATER.LAND);
  });
  test('each shore point is the waterline nearest its landing coordinate (within one cell)', () => {
    for (const [s, l] of [[g.shoreEast, g.east], [g.shoreWest, g.west]] as const) {
      expect(waterAt(f, s[0], s[1])).toBe(WATER.RIVER);
      const ux = (l[0] - s[0]) / dist(s, l), uz = (l[1] - s[1]) / dist(s, l);
      expect(waterAt(f, s[0] + ux * 0.5, s[1] + uz * 0.5)).not.toBe(WATER.RIVER);     // next step toward the landing leaves the river
      const d = nearestRiverCell(f, l);
      expect(dist(s, l)).toBeLessThanOrEqual(d + 1e-9); expect(dist(s, l)).toBeGreaterThan(d - f.grid.cell);
    }
  });
  test('dir is the unit shore→shore vector, yaw maps local +X onto it, and it crosses the current', () => {
    expect(Math.hypot(...g.dir)).toBeCloseTo(1, 9);
    expect(Math.cos(g.yaw)).toBeCloseTo(g.dir[0], 9); expect(-Math.sin(g.yaw)).toBeCloseTo(g.dir[1], 9);
    expect(Math.abs(g.dir[0] * RIVER_DIR[0] + g.dir[1] * RIVER_DIR[1])).toBeLessThan(0.3);
    expect(g.span).toBeCloseTo(dist(g.shoreEast, g.shoreWest), 9);
    expect(g.span).toBeGreaterThan(120); expect(g.span).toBeLessThan(200);
  });
  test('the whole line between the shores is river', () => {
    for (let k = 1; k < 50; k++) {
      const t = k / 50;
      expect(waterAt(f, g.shoreEast[0] + (g.shoreWest[0] - g.shoreEast[0]) * t, g.shoreEast[1] + (g.shoreWest[1] - g.shoreEast[1]) * t)).toBe(WATER.RIVER);
    }
  });
  test('every era docks in the water, inside its landing clearing, apron tip APRON_REST onto the bank', () => {
    const [cE, cW] = landingClearings(g);
    for (const e of ERAS) {
      const L = deckLayout(vesselSpec(e)), de = dockPoint(g, 'east', L.reach), dw = dockPoint(g, 'west', L.reach);
      expect(waterAt(f, de[0], de[1])).toBe(WATER.RIVER); expect(waterAt(f, dw[0], dw[1])).toBe(WATER.RIVER);
      expect(dist(de, cE)).toBeLessThan(LANDING_CLEARING[0]); expect(dist(dw, cW)).toBeLessThan(LANDING_CLEARING[0]);
      expect(dist(de, g.shoreEast)).toBeCloseTo(L.reach - 0.8, 6);
    }
  });
});
test('the pre-dam river is wider at the crossing', () => {
  expect(geom512(8).span).toBeGreaterThan(geom512(0).span + 8);
});
```

Run: `npx vitest run src/ancon` — Expected: FAIL (modules not found).

- [ ] **Step 4: Implement**

```ts
// src/ancon/spec.ts
import type { ClothingStyle, Era, Propulsion, VesselKind } from '../data/eras';

export interface VesselSpec {
  kind: VesselKind; length: number; beam: number; freeboard: number; cars: number; propulsion: Propulsion;
  crew: number; helmsman: boolean; anconera: boolean; shoreRope: boolean; passengers: number; clothing: ClothingStyle;
  moored: boolean;
}
export interface DeckLayout {
  halfLength: number; halfBeam: number;
  /** Walking surface height above the waterline (local y). */
  deckY: number;
  /** Hinged end apron/ramp length (0 = none, the barge noses onto the bank). */
  apron: number;
  /** Hull centre → apron tip along local X. */
  reach: number;
  lanes: number; rows: number;
  /** Height of the rope line where it runs over the deck guides (local y). */
  guideY: number;
  /** |z| of the two rope lines (just inside the hull sides). */
  ropeZ: number;
}
/** End apron length per kind (m). Inferred from research §2.2 ("ramp/apron boards at each end", "hinged or loose end ramps"). */
export const APRON: Record<VesselKind, number> = { timberBarge: 0, plankPlatform: 0.9, woodPlatform: 1.1, steelPontoon: 1.6 };
/** One parked vehicle incl. walking clearance (inferred; compact cars of each era). */
export const CAR_SLOT = { length: 4.4, width: 2.5 } as const;
/** Rope guides/rollers stand this high above the deck. */
export const GUIDE_H = 0.95;

export function vesselSpec(era: Era): VesselSpec {
  const a = era.ancon;
  return {
    kind: a.kind.value, length: a.length.value, beam: a.beam.value, freeboard: a.freeboard.value, cars: a.cars.value,
    propulsion: a.propulsion.value, crew: a.crew.value, helmsman: a.helmsman.value, anconera: a.anconera.value,
    shoreRope: a.shoreRope.value, passengers: a.passengers.value, clothing: a.clothing.value,
    moored: a.propulsion.value === 'moored',
  };
}

export function deckLayout(s: VesselSpec): DeckLayout {
  const lanes = s.cars === 0 ? 0 : s.cars >= 4 ? 2 : 1;
  const rows = lanes === 0 ? 0 : Math.ceil(s.cars / lanes);
  const apron = APRON[s.kind];
  return {
    halfLength: s.length / 2, halfBeam: s.beam / 2, deckY: s.freeboard, apron, reach: s.length / 2 + apron,
    lanes, rows, guideY: s.freeboard + GUIDE_H, ropeZ: s.beam / 2 - 0.25,
  };
}
```

```ts
// src/ancon/geometry.ts
import { landmarkXZ } from '../data/landmarks';
import { WATER, type WorldFields } from '../terrain/fields';

export type XZ = readonly [number, number];
export interface CrossingGeometry {
  /** Landing coordinates (research §1.1), projected. They lie on land, some way from the water. */
  east: XZ; west: XZ;
  /** The river waterline nearest each landing coordinate (depends on the era's bankOffset). The crossing runs between them. */
  shoreEast: XZ; shoreWest: XZ;
  /** Unit vector shoreEast → shoreWest (= vessel-local +X). */
  dir: XZ;
  /** Shore-to-shore distance, m. */
  span: number;
  /** Rotation about +Y that takes local +X onto `dir` (three.js convention: +X → (cos, 0, −sin)). */
  yaw: number;
}
/** The docked apron tip (or barge bow) rests this far onto the bank. */
export const APRON_REST = 0.8;
/** Each landing clearing is centred this far inland of its shore point: docked hull, bank posts and the ride camera then all fall inside LANDING_CLEARING[0]. */
export const CLEAR_INLAND = 6;
const SEARCH = 150, STEP = 0.25;

/** Water class at a world point (WATER.LAND outside the grid). */
export function waterAt(f: WorldFields, x: number, z: number): number {
  const g = f.grid, i = Math.floor((x - g.minX) / g.cell), j = Math.floor((z - g.minZ) / g.cell);
  return i >= 0 && j >= 0 && i < g.size && j < g.size ? f.water[j * g.size + i] : WATER.LAND;
}

/** The river waterline nearest `p`: the nearest RIVER cell centre within 150 m, then walk from it toward `p` to the last river sample. */
export function nearestShore(f: WorldFields, p: XZ): XZ {
  const g = f.grid, r = Math.ceil(SEARCH / g.cell);
  const ci = Math.floor((p[0] - g.minX) / g.cell), cj = Math.floor((p[1] - g.minZ) / g.cell);
  let best = Infinity, bx = 0, bz = 0;
  for (let j = Math.max(0, cj - r); j <= Math.min(g.size - 1, cj + r); j++) for (let i = Math.max(0, ci - r); i <= Math.min(g.size - 1, ci + r); i++) {
    if (f.water[j * g.size + i] !== WATER.RIVER) continue;
    const x = g.minX + (i + 0.5) * g.cell, z = g.minZ + (j + 0.5) * g.cell, d = Math.hypot(x - p[0], z - p[1]);
    if (d < best) { best = d; bx = x; bz = z; }
  }
  if (best === Infinity) throw new Error(`no river within ${SEARCH} m of ${p}`);
  const ux = (p[0] - bx) / best, uz = (p[1] - bz) / best;
  let s = 0;
  while (s + STEP <= best && waterAt(f, bx + ux * (s + STEP), bz + uz * (s + STEP)) === WATER.RIVER) s += STEP;
  return [bx + ux * s, bz + uz * s];
}

/** Compute from the fixed 512 placement fields (terrain/placementFields.ts), never the tier's grid. */
export function crossingGeometry(f: WorldFields): CrossingGeometry {
  const east = landmarkXZ('eastLanding'), west = landmarkXZ('westLanding');
  const shoreEast = nearestShore(f, east), shoreWest = nearestShore(f, west);
  const span = Math.hypot(shoreWest[0] - shoreEast[0], shoreWest[1] - shoreEast[1]);
  const dir: XZ = [(shoreWest[0] - shoreEast[0]) / span, (shoreWest[1] - shoreEast[1]) / span];
  return { east, west, shoreEast, shoreWest, dir, span, yaw: Math.atan2(-dir[1], dir[0]) };
}

/** Vessel centre (XZ) when docked on `side`, its end (apron tip) `APRON_REST` m onto the bank. */
export function dockPoint(g: CrossingGeometry, side: 'east' | 'west', reach: number): XZ {
  const s = side === 'east' ? g.shoreEast : g.shoreWest, k = (side === 'east' ? 1 : -1) * (reach - APRON_REST);
  return [s[0] + g.dir[0] * k, s[1] + g.dir[1] * k];
}

/** Centres of the two landing clearings (vegetation masks), CLEAR_INLAND m inland of each shore point. */
export function landingClearings(g: CrossingGeometry): [XZ, XZ] {
  return [
    [g.shoreEast[0] - g.dir[0] * CLEAR_INLAND, g.shoreEast[1] - g.dir[1] * CLEAR_INLAND],
    [g.shoreWest[0] + g.dir[0] * CLEAR_INLAND, g.shoreWest[1] + g.dir[1] * CLEAR_INLAND],
  ];
}
```

- [ ] **Step 5: Clearings on the shore points; one shared 512 grid.** In `src/vegetation/masks.ts` replace the landing centres:

```ts
import { crossingGeometry, landingClearings } from '../ancon/geometry';
/** Ferry landings are kept clear of plants: fully within the first radius (m) of each `landingClearings` centre, fading out by the second. */
export const LANDING_CLEARING: [number, number] = [22, 40];
// in buildVegMasks, replacing `const landings = [landmarkXZ('eastLanding'), landmarkXZ('westLanding')];`
  // Clearings centre on the ferry's shore points (just inland of the waterline), not the raw landing coordinates.
  const landings = landingClearings(crossingGeometry(f));
```

(`landmarkXZ` stays imported for the plaza.) In `src/vegetation/placement.test.ts` the clearing test measures from the same centres:

```ts
import { crossingGeometry, landingClearings } from '../ancon/geometry';   // replaces the landmarkXZ import
  test('ferry landings are kept clear', () => {
    const cell = f.grid.cell * Math.SQRT1_2; // mask is per cell: allow half a cell diagonal
    for (const [lx, lz] of landingClearings(crossingGeometry(f))) {
      for (const p of Object.values(all).flat()) expect(Math.hypot(p.x - lx, p.z - lz)).toBeGreaterThan(LANDING_CLEARING[0] - cell);
    }
  });
```

In `src/vegetation/Vegetation.tsx` delete the private `PLACE_SIZE` / `placeFields` / `placementFields` and import the shared one: `const pf = placementFields(bankOffset, near);` (argument order: bank offset first). `buildFields` is no longer imported there.

- [ ] **Step 6: Verify.** `npx vitest run src/ancon src/data src/vegetation` → PASS; `npm test`; `npm run build`. Commit:

```bash
git add src/data/eras.ts src/data/eras.test.ts src/ancon/spec.ts src/ancon/spec.test.ts src/ancon/geometry.ts src/ancon/geometry.test.ts src/ancon/testing.ts src/terrain/placementFields.ts src/vegetation
git commit -m "$(cat <<'EOF'
feat(ancon): sourced vessel data per era, deck layout, crossing geometry on the real waterline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Crossing state machine, vessel pose, seat anchors, `useVesselPose()`

**Files:**
- Create: `src/ancon/ease.ts`, `src/ancon/crossing.ts` (+ `crossing.test.ts`), `src/ancon/pose.ts` (+ `pose.test.ts`), `src/ancon/seats.ts` (+ `seats.test.ts`), `src/ancon/vesselPose.ts` (+ `vesselPose.test.ts`)
- Modify: `src/ancon/testing.ts` (+ `ctxFor`)

**Interfaces:**
- Consumes: `CrossingGeometry`, `dockPoint` (Task 1); `VesselSpec`, `DeckLayout`, `CAR_SLOT` (Task 1); `RIVER_DIR`; `hash3` (vegetation/rng.ts).
- Produces:
  - `type CrossingPhase = 'load' | 'castOff' | 'cross' | 'dock' | 'unload'`, `PHASES`
  - `type CrossingTimings = Record<CrossingPhase, number>`; `CROSSING_TIMINGS: CrossingTimings` = `{ load: 20, castOff: 8, cross: 126, dock: 10, unload: 16 }` (180 s per crossing), `RAMP_UP = 18`, `RAMP_DOWN = 20`, `legDuration(T?) → number`, `DEFAULT_CROSSING_START = 12`
  - `ease.ts`: `clamp01`, `smooth`, `smoothIntegral`, `lerp`, `fract`, `lerpAngle(a, b, w)` — the only copies (crossing, crew, rideCamera import them)
  - `interface CrossingState { legIndex: number; leg: 0 | 1; travel: 1 | -1; phase: CrossingPhase; phaseT: number; tLeg: number; p: number; s: number; v: number; a: number; slack: number; effort: number }`
  - `createCrossingState(): CrossingState`, `crossingState(clock: number, out: CrossingState, T?: CrossingTimings): CrossingState`, `mooredState(out): CrossingState` (in place), `advanceClock(clock: number, dt: number, frozen: boolean, speed: number): number`
  - `interface PoseContext { geom; spec; layout; flow; dockEast: XZ; dockWest: XZ; lineLen: number; groundAt?: (x, z) => number }` built only by `makePoseContext(geom: CrossingGeometry, spec: VesselSpec, flow: number, groundAt?): PoseContext` (docks precomputed: no per-frame allocation)
  - `interface VesselPose { position: THREE.Vector3; quaternion: THREE.Quaternion; matrix: THREE.Matrix4; yaw: number; pitch: number; roll: number; heave: number; speed: number; drift: number; travel: 1 | -1; clock: number; state: CrossingState }`
  - `createVesselPose(): VesselPose`, `computeVesselPose(clock: number, ctx: PoseContext, out: VesselPose): VesselPose`, `apronLift(st: CrossingState, end: 1 | -1): number`, `DRIFT_PER_FLOW`, `CRAB_PER_FLOW`, `PITCH_PER_ACCEL`
  - `type SeatKind = 'car' | 'cargo' | 'standing'`, `interface SeatAnchor { id: string; kind: SeatKind; pos: [number, number, number]; yaw: number }`, `seatAnchors(spec: VesselSpec, layout: DeckLayout): SeatAnchor[]` (car slots → one cargo slot when `cars = 0` → standing spots in a deterministic shuffled order), `anchorToWorld(pose: VesselPose, a: SeatAnchor, out: THREE.Matrix4): THREE.Matrix4`, `haulerStationX(k: number, perSide: number, L: DeckLayout, side: number): number` (never inside a car slot), `haulerZ(side: number, L: DeckLayout): number`
  - fixture `ctxFor(id: EraId, flow?: number): PoseContext` (testing.ts; the era on its own pre/post-dam river)
  - `useVesselPose(): Readonly<VesselPose>`, `sharedVesselPose: VesselPose`, `type PoseListener = (pose: VesselPose, ctx: PoseContext) => void`, `onVesselPose(fn: PoseListener): () => void`, `emitVesselPose(ctx: PoseContext): void`

Timing note: spec §13 asks ≈ 3 min per crossing; 20 + 8 + 126 + 10 + 16 = 180 s. The moving part (castOff + cross + dock = 144 s) is one smooth trapezoid (smoothstep ramps, v_max = 1/125 of the line per second); phases are labels over that motion. The real dock-to-dock line is the shore span (≈ 146 m, ≈ 160 m pre-dam) minus 2·(reach − APRON_REST): **122–138 m post-dam** (steel pontoon … one-car platform), so the ferry cruises at **≈ 1.0–1.1 m/s** (≈ 3.6–4 km/h, the pace of haulers walking hand over hand; pre-dam ≈ 1.1–1.2 m/s). `unload` is 16 s so the farthest passenger on the 20 m steel deck can walk off at 1.4 m/s (Task 7).

- [ ] **Step 1: Failing crossing tests**

```ts
// src/ancon/crossing.test.ts
import { describe, expect, test } from 'vitest';
import { advanceClock, createCrossingState, CROSSING_TIMINGS as T, crossingState, legDuration, mooredState, PHASES } from './crossing';

const L = legDuration();
const at = (c: number) => ({ ...crossingState(c, createCrossingState()) });

describe('crossing state machine', () => {
  test('one crossing ≈ 3 min, round trip = 2 legs', () => {
    expect(L).toBe(180);
    expect(T.load + T.castOff + T.cross + T.dock + T.unload).toBe(L);
  });
  test('phases run in order through each leg', () => {
    let t0 = 0;
    for (const ph of PHASES) {
      const st = at(t0 + T[ph] / 2);
      expect(st.phase).toBe(ph); expect(st.phaseT).toBeCloseTo(0.5, 6); expect(st.leg).toBe(0);
      expect(at(L + t0 + T[ph] / 2).phase).toBe(ph);
      t0 += T[ph];
    }
  });
  test('leg 0 goes east → west (s 0 → 1), leg 1 comes back', () => {
    expect(at(5).s).toBe(0); expect(at(L - 5).s).toBe(1);
    expect(at(L + 5).s).toBe(1); expect(at(2 * L - 5).s).toBe(0);
    expect(at(5).travel).toBe(1); expect(at(L + 5).travel).toBe(-1);
  });
  test('s is monotonic within a leg, continuous everywhere, and v/a are its derivatives', () => {
    let prev = at(0);
    for (let c = 0.1; c <= 2 * L; c += 0.1) {
      const st = at(c);
      if (st.legIndex === prev.legIndex) expect((st.s - prev.s) * st.travel).toBeGreaterThanOrEqual(-1e-12);
      expect(Math.abs(st.s - prev.s)).toBeLessThan(0.002);
      expect(Math.abs(st.v - prev.v)).toBeLessThan(2e-4);
      expect((st.s - prev.s) / 0.1).toBeCloseTo((st.v + prev.v) / 2, 4);
      expect((st.v - prev.v) / 0.1).toBeCloseTo((st.a + prev.a) / 2, 4);
      prev = st;
    }
  });
  test('cruise ≈ 1 m/s on the real 122–138 m dock-to-dock line', () => {
    const st = at(T.load + T.castOff + T.cross / 2);
    expect(st.v * 122).toBeGreaterThan(0.9); expect(st.v * 138).toBeLessThan(1.2);
  });
  test('ropes slack while docked, taut mid-crossing; effort continuous 0 → 1 → 0', () => {
    expect(at(5).slack).toBe(1); expect(at(T.load + T.castOff + 40).slack).toBe(0); expect(at(L - 3).slack).toBe(1);
    expect(at(5).effort).toBe(0); expect(at(T.load + T.castOff + 40).effort).toBe(1);
    let prev = at(0);
    for (let c = 0.05; c <= L; c += 0.05) {
      const st = at(c);
      expect(Math.abs(st.slack - prev.slack)).toBeLessThan(0.02);
      expect(Math.abs(st.effort - prev.effort)).toBeLessThan(0.03);
      prev = st;
    }
  });
  test('deterministic, periodic over a round trip, negative clocks wrap', () => {
    const a = at(123.4), b = at(123.4 + 2 * L), n = at(123.4 - 2 * L);
    for (const k of ['phaseT', 's', 'v', 'a', 'slack', 'effort'] as const) { expect(b[k]).toBeCloseTo(a[k], 9); expect(n[k]).toBeCloseTo(a[k], 9); }
    for (const k of ['phase', 'leg', 'travel'] as const) { expect(b[k]).toBe(a[k]); expect(n[k]).toBe(a[k]); }
  });
  test('reuses the out object', () => {
    const o = createCrossingState(); expect(crossingState(10, o)).toBe(o);
  });
  test('crossing clock: integrates dt × speed, holds when frozen, stays continuous when the speed changes', () => {
    expect(advanceClock(12, 0.5, false, 1)).toBe(12.5);
    expect(advanceClock(12, 0.5, false, 4)).toBe(14);
    expect(advanceClock(12, 0.5, true, 4)).toBe(12);
    let c = 12;
    for (let i = 0; i < 100; i++) c = advanceClock(c, 0.1, false, 1);
    const before = c;
    c = advanceClock(c, 0.1, false, 8);                     // speed jumps 1 → 8: one frame advances 0.8 s, no jump
    expect(c - before).toBeCloseTo(0.8, 12);
  });
  test('moored state writes in place: docked east, slack, idle', () => {
    const o = at(90) as ReturnType<typeof createCrossingState>;
    expect(mooredState(o)).toBe(o);
    expect([o.phase, o.s, o.v, o.slack, o.effort]).toEqual(['load', 0, 0, 1, 0]);
  });
});
```

- [ ] **Step 2: Implement `ease.ts` and `crossing.ts`**

```ts
// src/ancon/ease.ts
/** Small shared easing / interpolation helpers for the ferry modules (one copy, no per-module duplicates). */
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Smoothstep on [0, 1]. */
export const smooth = (u: number) => u * u * (3 - 2 * u);
/** ∫₀ᵘ smoothstep = u³ − u⁴/2 (a ramp whose speed eases in and out). */
export const smoothIntegral = (u: number) => u * u * u - 0.5 * u * u * u * u;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const fract = (x: number) => x - Math.floor(x);
/** Blend angles the short way (a fixed direction when exactly opposite). */
export function lerpAngle(a: number, b: number, w: number) {
  const d = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + d * w;
}
```

```ts
// src/ancon/crossing.ts
import { clamp01, smooth, smoothIntegral as S } from './ease';

export type CrossingPhase = 'load' | 'castOff' | 'cross' | 'dock' | 'unload';
export const PHASES: readonly CrossingPhase[] = ['load', 'castOff', 'cross', 'dock', 'unload'];
export type CrossingTimings = Record<CrossingPhase, number>;
/** Seconds per phase at 1× (spec §13: ≈ 3 min per crossing). */
export const CROSSING_TIMINGS: CrossingTimings = { load: 20, castOff: 8, cross: 126, dock: 10, unload: 16 };
/** Smooth acceleration / deceleration ramps (s) of the moving part (castOff + cross + dock). */
export const RAMP_UP = 18, RAMP_DOWN = 20;
/** Default crossing clock at page load: 8 s before cast-off, so the first thing seen is the ferry leaving. */
export const DEFAULT_CROSSING_START = 12;
export const legDuration = (T: CrossingTimings = CROSSING_TIMINGS) => T.load + T.castOff + T.cross + T.dock + T.unload;

export interface CrossingState {
  /** Legs completed since clock 0 (floor(clock / leg)); may be negative. */
  legIndex: number;
  /** 0: east (Loíza) → west (Torrecilla Baja); 1: back. */
  leg: 0 | 1;
  /** +1 while travelling toward local +X (west), −1 back. */
  travel: 1 | -1;
  phase: CrossingPhase;
  /** 0..1 within the phase. */
  phaseT: number;
  /** Seconds since the leg started. */
  tLeg: number;
  /** Progress along this leg, 0..1. */
  p: number;
  /** Absolute position on the line: 0 at the east dock, 1 at the west dock. */
  s: number;
  /** ds/dt (1/s) and d²s/dt² (1/s²), signed like s. */
  v: number; a: number;
  /** Ropes: 0 taut … 1 slack (sagging into the water while the vessel waits). */
  slack: number;
  /** Crew effort 0..1, continuous. */
  effort: number;
}

export const createCrossingState = (): CrossingState =>
  ({ legIndex: 0, leg: 0, travel: 1, phase: 'load', phaseT: 0, tLeg: 0, p: 0, s: 0, v: 0, a: 0, slack: 1, effort: 0 });

/** Leg progress p, dp/dt, d²p/dt² at τ seconds after cast-off; M = moving time. */
function motion(tau: number, M: number, out: CrossingState) {
  const A = RAMP_UP, D = RAMP_DOWN, vmax = 1 / (M - A / 2 - D / 2);
  if (tau <= 0) { out.p = 0; out.v = 0; out.a = 0; }
  else if (tau < A) { const u = tau / A; out.p = vmax * A * S(u); out.v = vmax * smooth(u); out.a = (vmax * 6 * u * (1 - u)) / A; }
  else if (tau < M - D) { out.p = vmax * (A / 2 + tau - A); out.v = vmax; out.a = 0; }
  else if (tau < M) { const u = (M - tau) / D; out.p = 1 - vmax * D * S(u); out.v = vmax * smooth(u); out.a = (-vmax * 6 * u * (1 - u)) / D; }
  else { out.p = 1; out.v = 0; out.a = 0; }
}

/** The crossing at `clock` seconds. Pure: same clock ⇒ same state. Writes into and returns `out`. */
export function crossingState(clock: number, out: CrossingState, T: CrossingTimings = CROSSING_TIMINGS): CrossingState {
  const L = legDuration(T);
  out.legIndex = Math.floor(clock / L);
  out.leg = (((out.legIndex % 2) + 2) % 2) as 0 | 1;
  out.travel = out.leg === 0 ? 1 : -1;
  const tau = clock - out.legIndex * L;
  out.tLeg = tau;
  let t0 = 0;
  for (const ph of PHASES) {
    if (tau < t0 + T[ph] || ph === 'unload') { out.phase = ph; out.phaseT = clamp01((tau - t0) / T[ph]); break; }
    t0 += T[ph];
  }
  motion(tau - T.load, T.castOff + T.cross + T.dock, out);
  out.s = out.leg === 0 ? out.p : 1 - out.p;
  out.v *= out.travel; out.a *= out.travel;
  const u = out.phaseT;
  switch (out.phase) {
    case 'load': case 'unload': out.slack = 1; out.effort = 0; break;
    case 'castOff': out.slack = 1 - smooth(u); out.effort = smooth(clamp01(u / 0.35)); break;
    case 'cross': out.slack = 0; out.effort = 1 - 0.4 * smooth(clamp01((u - 0.7) / 0.3)); break;
    case 'dock': out.slack = smooth(u); out.effort = 0.6 * (1 - u); break;
  }
  return out;
}

/** 1986: the barge sits at the east (Loíza) landing, ropes slack, nobody working. Allocation-free. */
export function mooredState(out: CrossingState): CrossingState {
  out.legIndex = 0; out.leg = 0; out.travel = 1; out.phase = 'load'; out.phaseT = 0; out.tLeg = 0;
  out.p = 0; out.s = 0; out.v = 0; out.a = 0; out.slack = 1; out.effort = 0;
  return out;
}

/**
 * Advance the crossing clock by one frame (s). Time-scalable: integrating dt·speed keeps the
 * phase continuous when the speed changes mid-run; ?freeze=1 holds it at its start (?c).
 */
export const advanceClock = (clock: number, dt: number, frozen: boolean, speed: number) => (frozen ? clock : clock + dt * speed);
```

Run the crossing tests → PASS.

- [ ] **Step 3: Failing pose, seat and listener tests.** First add the pose fixture to `src/ancon/testing.ts`:

```ts
import { getEra, type EraId } from '../data/eras';
import { makePoseContext } from './pose';
import { vesselSpec } from './spec';
/** Pose context for an era on its own (pre- or post-dam) river; `flow` overrides the era's current. */
export const ctxFor = (id: EraId, flow?: number) => {
  const e = getEra(id);
  return makePoseContext(geom512(e.river.bankOffset.value), vesselSpec(e), flow ?? e.river.flow.value);
};
```

```ts
// src/ancon/pose.test.ts
import { describe, expect, test } from 'vitest';
import { type EraId } from '../data/eras';
import { RIVER_DIR } from '../geo/constants';
import { CROSSING_TIMINGS as T, createCrossingState, crossingState, legDuration } from './crossing';
import { apronLift, computeVesselPose, createVesselPose } from './pose';
import { ctxFor } from './testing';

const L = legDuration(), MID = T.load + T.castOff + T.cross / 2;
const poseAt = (id: EraId, c: number, flow?: number) => computeVesselPose(c, ctxFor(id, flow), createVesselPose());

describe('vessel pose', () => {
  test('docked at the east landing loading leg 0, at the west landing unloading it', () => {
    const ctx = ctxFor('1975'), e = ctx.dockEast, w = ctx.dockWest;
    const a = poseAt('1975', 5), b = poseAt('1975', L - 3);
    expect(Math.hypot(a.position.x - e[0], a.position.z - e[1])).toBeLessThan(1e-6);
    expect(Math.hypot(b.position.x - w[0], b.position.z - w[1])).toBeLessThan(1e-6);
  });
  test('mid-river the current pushes it downstream (along RIVER_DIR); ropes hold better than poles', () => {
    for (const id of ['1925', '1935'] as const) {
      const ctx = ctxFor(id), p = poseAt(id, MID), st = crossingState(MID, createCrossingState());
      const e = ctx.dockEast, w = ctx.dockWest;
      const sx = e[0] + (w[0] - e[0]) * st.s, sz = e[1] + (w[1] - e[1]) * st.s;
      expect((p.position.x - sx) * RIVER_DIR[0] + (p.position.z - sz) * RIVER_DIR[1]).toBeCloseTo(p.drift, 6);
    }
    expect(poseAt('1925', MID, 0.6).drift).toBeGreaterThan(2);
    expect(poseAt('1935', MID, 0.6).drift).toBeGreaterThan(0);
    expect(poseAt('1935', MID, 0.6).drift).toBeLessThan(poseAt('1925', MID, 0.6).drift);
    expect(poseAt('1925', 5).drift).toBeCloseTo(0, 9);
  });
  test('the crew crabs the leading end slightly upstream', () => {
    const p = poseAt('1925', MID), up = [-RIVER_DIR[0], -RIVER_DIR[1]];
    const h = [Math.cos(p.yaw), -Math.sin(p.yaw)], h0 = ctxFor('1925').geom.dir;
    expect(h[0] * up[0] + h[1] * up[1]).toBeGreaterThan(h0[0] * up[0] + h0[1] * up[1]);
    expect(Math.abs(p.yaw - ctxFor('1925').geom.yaw)).toBeLessThan(0.06);
  });
  test('small motion: |pitch|, |roll| < 0.05 rad, |heave| < 0.06 m; the steel barge moves less than the 1840 barge', () => {
    let big = 0, small = 0;
    for (let c = 0; c < 2 * L; c += 0.5) {
      for (const id of ['1840', '1984'] as const) {
        const p = poseAt(id, c);
        expect(Math.abs(p.pitch)).toBeLessThan(0.05); expect(Math.abs(p.roll)).toBeLessThan(0.05); expect(Math.abs(p.heave)).toBeLessThan(0.06);
      }
      small = Math.max(small, Math.abs(poseAt('1840', c).roll)); big = Math.max(big, Math.abs(poseAt('1984', c).roll));
    }
    expect(big).toBeLessThan(small);
  });
  test('cruise ≈ 1 m/s (dock-to-dock line = span − 2·(reach − APRON_REST), 122–138 m) and a matrix that matches position', () => {
    for (const id of ['1935', '1984'] as EraId[]) {
      const ctx = ctxFor(id);
      expect(ctx.lineLen).toBeGreaterThan(115); expect(ctx.lineLen).toBeLessThan(160);
      expect(Math.abs(poseAt(id, MID).speed)).toBeGreaterThan(0.85); expect(Math.abs(poseAt(id, MID).speed)).toBeLessThan(1.3);
    }
    const p = poseAt('1984', MID);
    expect(p.matrix.elements[12]).toBeCloseTo(p.position.x, 9); expect(p.matrix.elements[14]).toBeCloseTo(p.position.z, 9);
  });
  test('deterministic, writes into out', () => {
    const ctx = ctxFor('1959'), o = createVesselPose();
    expect(computeVesselPose(77.7, ctx, o)).toBe(o);
    const m = o.matrix.elements.slice();
    computeVesselPose(12, ctx, o); computeVesselPose(77.7, ctx, o);
    expect(o.matrix.elements).toEqual(m);
  });
  test('1986: moored at the Loíza landing, bobbing only', () => {
    const ctx = ctxFor('1986'), e = ctx.dockEast;
    for (const c of [0, 100, 250, 900]) {
      const p = poseAt('1986', c);
      expect(Math.hypot(p.position.x - e[0], p.position.z - e[1])).toBeLessThan(1e-9); expect(p.speed).toBe(0);
    }
  });
  test('aprons: the docked end rests down, both are raised mid-crossing', () => {
    const st = crossingState(5, createCrossingState());          // at the east dock
    expect(apronLift(st, -1)).toBeLessThan(0); expect(apronLift(st, 1)).toBeGreaterThan(0);
    const mid = crossingState(MID, createCrossingState());
    expect(apronLift(mid, -1)).toBeGreaterThan(0); expect(apronLift(mid, 1)).toBeGreaterThan(0);
    const west = crossingState(L - 3, createCrossingState());
    expect(apronLift(west, 1)).toBeLessThan(0);
  });
});
```

```ts
// src/ancon/seats.test.ts
import { expect, test } from 'vitest';
import * as THREE from 'three';
import { ERAS, getEra } from '../data/eras';
import { createVesselPose } from './pose';
import { anchorToWorld, haulerStationX, haulerZ, seatAnchors } from './seats';
import { CAR_SLOT, deckLayout, vesselSpec } from './spec';

for (const e of ERAS) test(`${e.id}: car slots, standing spots, all on the deck`, () => {
  const s = vesselSpec(e), L = deckLayout(s), seats = seatAnchors(s, L);
  const cars = seats.filter((a) => a.kind === 'car'), standing = seats.filter((a) => a.kind === 'standing');
  expect(cars.length).toBe(s.cars);
  expect(seats.filter((a) => a.kind === 'cargo').length).toBe(s.cars === 0 ? 1 : 0);
  expect(standing.length).toBeGreaterThanOrEqual(Math.max(s.passengers, 2));
  for (const a of seats) {
    expect(Math.abs(a.pos[0])).toBeLessThanOrEqual(L.halfLength); expect(Math.abs(a.pos[2])).toBeLessThanOrEqual(L.halfBeam);
    expect(a.pos[1]).toBeCloseTo(L.deckY, 9);
  }
  for (const p of standing) for (const c of cars) {
    const inside = Math.abs(p.pos[0] - c.pos[0]) < CAR_SLOT.length / 2 && Math.abs(p.pos[2] - c.pos[2]) < CAR_SLOT.width / 2;
    expect(inside).toBe(false);
  }
  for (let i = 0; i < standing.length; i++) for (let j = i + 1; j < standing.length; j++)
    expect(Math.hypot(standing[i].pos[0] - standing[j].pos[0], standing[i].pos[2] - standing[j].pos[2])).toBeGreaterThan(0.6);
  expect(seatAnchors(s, L)).toEqual(seats);
});
test('anchorToWorld composes the vessel pose with the deck-local anchor', () => {
  const s = vesselSpec(getEra('1975')), a = seatAnchors(s, deckLayout(s))[0], p = createVesselPose();
  p.matrix.makeRotationY(Math.PI / 2).setPosition(10, 0, -5);
  const v = new THREE.Vector3().setFromMatrixPosition(anchorToWorld(p, a, new THREE.Matrix4()));
  expect(v.x).toBeCloseTo(10 + a.pos[2], 9); expect(v.z).toBeCloseTo(-5 - a.pos[0], 9); expect(v.y).toBeCloseTo(a.pos[1], 9);
});
test('rope haulers stand on the deck and outside every car slot (Phase 4 parks cars there)', () => {
  for (const e of ERAS) {
    const s = vesselSpec(e), L = deckLayout(s);
    if (s.propulsion !== 'ropes') continue;
    const cars = seatAnchors(s, L).filter((a) => a.kind === 'car'), perSide = Math.ceil(s.crew / 2);
    for (const side of [1, -1]) for (let k = 0; k < perSide; k++) {
      const x = haulerStationX(k, perSide, L, side), z = haulerZ(side, L);
      expect(Math.abs(x), e.id).toBeLessThanOrEqual(L.halfLength - 0.5);
      for (const c of cars) expect(Math.abs(x - c.pos[0]) < CAR_SLOT.length / 2 && Math.abs(z - c.pos[2]) < CAR_SLOT.width / 2, e.id).toBe(false);
    }
  }
});
```

```ts
// src/ancon/vesselPose.test.ts
import { expect, test, vi } from 'vitest';
import { emitVesselPose, onVesselPose, sharedVesselPose, useVesselPose } from './vesselPose';
import type { PoseContext } from './pose';

test('listeners get the shared pose; unsubscribe stops them', () => {
  const fn = vi.fn(), off = onVesselPose(fn), ctx = {} as PoseContext;
  emitVesselPose(ctx); expect(fn).toHaveBeenCalledWith(sharedVesselPose, ctx);
  off(); emitVesselPose(ctx); expect(fn).toHaveBeenCalledTimes(1);
  expect(useVesselPose()).toBe(sharedVesselPose);
});
```

Run: `npx vitest run src/ancon` — Expected: FAIL (modules missing).

- [ ] **Step 4: Implement `pose.ts`, `seats.ts`, `vesselPose.ts`**

```ts
// src/ancon/pose.ts
import * as THREE from 'three';
import { RIVER_DIR } from '../geo/constants';
import { createCrossingState, crossingState, mooredState, type CrossingState } from './crossing';
import { dockPoint, type CrossingGeometry, type XZ } from './geometry';
import { deckLayout, type DeckLayout, type VesselSpec } from './spec';
import type { Propulsion } from '../data/eras';

/** Everything the pose needs that does not change per frame (docks precomputed: no per-frame allocation). */
export interface PoseContext {
  geom: CrossingGeometry; spec: VesselSpec; layout: DeckLayout;
  /** Surface current, m/s (era.river.flow). */
  flow: number;
  dockEast: XZ; dockWest: XZ;
  /** Dock-to-dock distance, m. */
  lineLen: number;
  /** Terrain height (m) at a world point; set by <Ancon> for the ride camera (Task 9). */
  groundAt?: (x: number, z: number) => number;
}
export function makePoseContext(geom: CrossingGeometry, spec: VesselSpec, flow: number, groundAt?: (x: number, z: number) => number): PoseContext {
  const layout = deckLayout(spec), dockEast = dockPoint(geom, 'east', layout.reach), dockWest = dockPoint(geom, 'west', layout.reach);
  return { geom, spec, layout, flow, dockEast, dockWest, lineLen: Math.hypot(dockWest[0] - dockEast[0], dockWest[1] - dockEast[1]), groundAt };
}
export interface VesselPose {
  /** World position of the local origin (hull centre at the waterline). */
  position: THREE.Vector3; quaternion: THREE.Quaternion;
  /** world ← vessel-local. */
  matrix: THREE.Matrix4;
  yaw: number; pitch: number; roll: number; heave: number;
  /** Signed speed along local +X, m/s. */
  speed: number;
  /** Downstream offset from the straight line, m (along RIVER_DIR). */
  drift: number;
  travel: 1 | -1; clock: number; state: CrossingState;
}
/** Mid-river drift (m) per m/s of current. Poles can only correct so much; the ropes hold the line (inferred). */
export const DRIFT_PER_FLOW: Record<Propulsion, number> = { poles: 6, ropes: 1.5, moored: 0 };
/** Crab angle (rad) per m/s of current: the crew points the leading end upstream (research §2.3: the helmsman "moves with the river's flow"). */
export const CRAB_PER_FLOW: Record<Propulsion, number> = { poles: 0.05, ropes: 0.015, moored: 0 };
/** Bow-up pitch (rad) per m/s² of surge acceleration. */
export const PITCH_PER_ACCEL = 0.15;
const APRON_UP = 0.12, APRON_DOWN = -0.14;

export const createVesselPose = (): VesselPose => ({
  position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), matrix: new THREE.Matrix4(),
  yaw: 0, pitch: 0, roll: 0, heave: 0, speed: 0, drift: 0, travel: 1, clock: 0, state: createCrossingState(),
});

const euler = new THREE.Euler(0, 0, 0, 'YZX');   // matrix = Ry(yaw) · Rz(pitch) · Rx(roll)
const ONE = new THREE.Vector3(1, 1, 1);

export function computeVesselPose(clock: number, ctx: PoseContext, out: VesselPose): VesselPose {
  const { geom: g, spec, flow, dockEast: e, dockWest: w, lineLen } = ctx, st = out.state;
  if (spec.moored) mooredState(st); else crossingState(clock, st);
  const bump = Math.sin(Math.PI * st.s);                        // 0 at both docks: the crew corrects the drift
  const drift = flow * DRIFT_PER_FLOW[spec.propulsion] * bump;
  const x = e[0] + (w[0] - e[0]) * st.s + RIVER_DIR[0] * drift;
  const z = e[1] + (w[1] - e[1]) * st.s + RIVER_DIR[1] * drift;
  // Periodic motion, smaller for bigger hulls; half as much moored.
  const k = Math.sqrt(8 / Math.max(spec.length, 4)) * (spec.moored ? 0.5 : 1), t = clock;
  const heave = k * (0.025 * Math.sin(1.3 * t) + 0.012 * Math.sin(2.9 * t + 1));
  const pitch = k * 0.012 * Math.sin(0.9 * t + 0.4) + PITCH_PER_ACCEL * st.a * lineLen;
  const roll = k * 0.018 * Math.sin(0.7 * t + 2);
  // +yaw turns the heading toward (dir.z, −dir.x); pick the sign that points the leading end upstream.
  const up = -(g.dir[1] * RIVER_DIR[0] - g.dir[0] * RIVER_DIR[1]);
  const crab = flow * CRAB_PER_FLOW[spec.propulsion] * bump * st.travel * (up >= 0 ? 1 : -1);
  out.yaw = g.yaw + crab; out.pitch = pitch; out.roll = roll; out.heave = heave;
  euler.set(roll, out.yaw, pitch);
  out.quaternion.setFromEuler(euler);
  out.position.set(x, heave, z);
  out.matrix.compose(out.position, out.quaternion, ONE);
  out.speed = st.v * lineLen; out.drift = drift; out.travel = st.travel; out.clock = clock;
  return out;
}

/** Apron angle (rad, + raised) of the end at local x sign `end` (−1 east, +1 west). */
export function apronLift(st: CrossingState, end: 1 | -1): number {
  const nearEast = st.s < 0.5, docked = (end === -1) === nearEast ? st.slack : 0;
  return APRON_UP + (APRON_DOWN - APRON_UP) * docked;
}
```

```ts
// src/ancon/seats.ts
import * as THREE from 'three';
import { hash3 } from '../vegetation/rng';
import type { VesselPose } from './pose';
import { CAR_SLOT, type DeckLayout, type VesselSpec } from './spec';

export type SeatKind = 'car' | 'cargo' | 'standing';
/** A deck-local anchor (y = deck surface). Future release: a drivable car parks on a 'car' anchor; a first-person camera sits on any anchor. */
export interface SeatAnchor { id: string; kind: SeatKind; pos: [number, number, number]; yaw: number }
const GRID = 0.65, EDGE = 0.45;

/** Deck-local z of the haulers on rope line `side` (+1 / −1): 0.35 m inboard of the rope. */
export const haulerZ = (side: number, L: DeckLayout) => side * (L.ropeZ - 0.35);
/**
 * Deck-local x of rope hauler station k (of `perSide` on the rope line `side`). Stations spread along
 * the deck, but never inside the car slots (Phase 4 parks cars there): a station that would fall
 * inside is moved just past the slot rows, toward its own end (or toward `side` when centred).
 * Shared with the crew choreography (Task 7).
 */
export function haulerStationX(k: number, perSide: number, L: DeckLayout, side: number): number {
  const x = ((k + 0.5) / perSide - 0.5) * L.halfLength, slotHalf = (L.rows * CAR_SLOT.length) / 2;
  if (L.rows === 0 || Math.abs(x) >= slotHalf + 0.45) return x;
  return (x === 0 ? Math.sign(side) : Math.sign(x)) * (slotHalf + 0.45);
}

export function seatAnchors(spec: VesselSpec, L: DeckLayout): SeatAnchor[] {
  const out: SeatAnchor[] = [], rects: [number, number, number, number][] = [];
  const addRect = (x: number, z: number, hx: number, hz: number) => rects.push([x - hx, x + hx, z - hz, z + hz]);
  if (spec.cars > 0) {
    for (let r = 0; r < L.rows; r++) for (let l = 0; l < L.lanes; l++) {
      const idx = r * L.lanes + l;
      if (idx >= spec.cars) break;
      const x = (r + 0.5 - L.rows / 2) * CAR_SLOT.length, z = (l + 0.5 - L.lanes / 2) * CAR_SLOT.width * 1.08;
      out.push({ id: `car${idx}`, kind: 'car', pos: [x, L.deckY, z], yaw: 0 });
      addRect(x, z, CAR_SLOT.length / 2, CAR_SLOT.width / 2);
    }
  } else {
    out.push({ id: 'cargo', kind: 'cargo', pos: [0, L.deckY, 0], yaw: 0 });  // ox cart / animals (Phase 4)
    addRect(0, 0, 1.6, 0.8);
  }
  // Crew space stays free: the rope itself and the hauler stations, the polers' walking lanes
  // along the sides (|z| = halfBeam − 0.45), the helmsman at either end.
  const ropes = spec.propulsion === 'ropes', poles = spec.propulsion === 'poles';
  const zMax = ropes ? L.ropeZ - 0.35 : poles ? L.halfBeam - 0.75 : L.halfBeam - EDGE;
  const xMax = poles ? L.halfLength - 0.35 : L.halfLength - 0.6;
  const perSide = Math.ceil(spec.crew / 2);
  const blocked = (x: number, z: number) =>
    (poles && Math.abs(x) > L.halfLength - 1.2 && Math.abs(z) < 0.75) ||   // the helmsman at either end
    (ropes && Math.abs(z) > L.ropeZ - 1.0 && haulerNear(x, Math.sign(z), perSide, L));
  const cand: { x: number; z: number; h: number }[] = [];
  const EPS = 1e-9;   // strict "inside a slot" test that does not depend on float rounding at the slot edge
  for (let i = 0; ; i++) {
    const x = -L.halfLength + 0.5 + i * GRID;
    if (x > L.halfLength - 0.35 + 1e-9) break;
    for (let j = 0; ; j++) {
      const z = -L.halfBeam + EDGE + j * GRID;
      if (z > L.halfBeam - EDGE + 1e-9) break;
      if (Math.abs(z) > zMax || Math.abs(x) > xMax || blocked(x, z)) continue;
      if (rects.some(([x0, x1, z0, z1]) => x > x0 - EPS && x < x1 + EPS && z > z0 - EPS && z < z1 + EPS)) continue;
      cand.push({ x, z, h: hash3(Math.round(x * 10), Math.round(z * 10), 77) });
    }
  }
  cand.sort((a, b) => a.h - b.h);
  cand.forEach((c, k) => out.push({ id: `stand${k}`, kind: 'standing', pos: [c.x, L.deckY, c.z], yaw: (c.h / 2 ** 32) * 2 * Math.PI - Math.PI }));
  return out;
}

/** A hauler of rope line `side` stands within 0.8 m of x. */
function haulerNear(x: number, side: number, perSide: number, L: DeckLayout) {
  for (let k = 0; k < perSide; k++) if (Math.abs(x - haulerStationX(k, perSide, L, side)) < 0.8) return true;
  return false;
}

export function anchorToWorld(pose: VesselPose, a: SeatAnchor, out: THREE.Matrix4): THREE.Matrix4 {
  return out.makeRotationY(a.yaw).setPosition(a.pos[0], a.pos[1], a.pos[2]).premultiply(pose.matrix);
}
```

```ts
// src/ancon/vesselPose.ts
import { createVesselPose, type PoseContext, type VesselPose } from './pose';

/** The ferry's pose this frame, updated in place by <Ancon> before any listener runs. */
export const sharedVesselPose: VesselPose = createVesselPose();
export type PoseListener = (pose: VesselPose, ctx: PoseContext) => void;
const listeners = new Set<PoseListener>();

/**
 * Future-release hook (spec §13): a first-person camera or a drivable car reads the vessel pose
 * without touching the vessel code. Returns the shared mutable pose (no re-render per frame) —
 * read it inside useFrame, or subscribe with onVesselPose to run right after it updates.
 */
export const useVesselPose = (): Readonly<VesselPose> => sharedVesselPose;
export function onVesselPose(fn: PoseListener): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function emitVesselPose(ctx: PoseContext) { listeners.forEach((fn) => fn(sharedVesselPose, ctx)); }
```

- [ ] **Step 5: Verify + commit.** `npx vitest run src/ancon` → PASS. (Worked check, 1925 plank platform 7 × 3.2 m, one car slot |x| ≤ 2.2 (edges count as inside, compared with a 1e-9 epsilon): the grid gives x ∈ {−3.0, −2.35, …, 2.2, 2.85} and z ∈ {−0.5, 0.15, 0.8}; the slot removes |x| ≤ 2.2 and the helmsman box (|x| > 2.3, |z| < 0.75) removes the centre-line spots, leaving (−3.0, 0.8), (−2.35, 0.8), (2.85, 0.8) — exactly the 3 passengers. 1935 (1 car, rope haulers at x = ±2.65): (2.6, −0.5), (2.6, 0.15), (−2.6, 0.15), (−2.6, 0.8). If an era comes up short, shrink `GRID` toward 0.62 before touching the crew exclusions.) `npm test`, `npm run build`.

```bash
git add src/ancon/ease.ts src/ancon/testing.ts src/ancon/crossing.ts src/ancon/crossing.test.ts src/ancon/pose.ts src/ancon/pose.test.ts src/ancon/seats.ts src/ancon/seats.test.ts src/ancon/vesselPose.ts src/ancon/vesselPose.test.ts
git commit -m "$(cat <<'EOF'
feat(ancon): deterministic crossing loop, vessel pose, seat anchors, useVesselPose

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wooden vessel builders, `<Ancon>` on the river, crossing-clock URL params

**Files:**
- Create: `src/ancon/vessels/common.ts`, `src/ancon/vessels/timberBarge.ts`, `src/ancon/vessels/plankPlatform.ts`, `src/ancon/vessels/woodPlatform.ts`, `src/ancon/vessels/index.ts`, `src/ancon/vessels/suite.ts` (shared suite, not a test file), `src/ancon/vessels/vessels.test.ts`, `src/ancon/textures.ts`, `src/ancon/materials.ts`, `src/ancon/stats.ts`, `src/ancon/Ancon.tsx`
- Modify: `src/state/url.ts` (+ `url.test.ts`), `src/state/store.ts` (+ `store.test.ts`), `src/quality.ts`, `src/scene/World.tsx`, `src/ui/DebugPanel.tsx`

**Interfaces:**
- Consumes: `VesselSpec`, `DeckLayout`, `vesselSpec`, `deckLayout`, `CAR_SLOT` (Task 1); `crossingGeometry`, `placementFields` (Task 1); `computeVesselPose`, `apronLift`, `makePoseContext` (Task 2); `advanceClock`, `DEFAULT_CROSSING_START` (Task 2); `tris` (testing.ts); `sharedVesselPose`, `emitVesselPose` (Task 2); `cellRng` (vegetation/rng.ts).
- Produces:
  - `type VesselMaterialId = 'wood' | 'steel' | 'iron'`; `interface VesselPart { material: VesselMaterialId; geometry: THREE.BufferGeometry; apron?: { end: 1 | -1; hinge: [number, number] } }`
  - `class PartBuilder { box(size, at, color, rotZ?, rotY?): this; cylinder(rTop, rBottom, length, at, color, axis?, radial?): this; add(geometry, color): this; build(): THREE.BufferGeometry; readonly empty: boolean }`, `worldUv(g)`, `tone(base, dark, light, r, amount?)`, `woodTone(r, amount?, base?)`, `TEX_M = 2`
  - one palette for every builder: `WOOD = { base, dark, bleach, strake, tar, iron }`, `STEEL = { deck, shell, rust, foul, antifoul }` (THREE.Color); `plankApron(end, L, r, { plankW, gap, thick, beams }): VesselPart`; `BITT_H = 0.35`, `bittXZ(L, end, side): [x, z]`
  - `buildTimberBarge`, `buildPlankPlatform`, `buildWoodPlatform` (all `(spec: VesselSpec, L: DeckLayout, seed: number) => VesselPart[]`); `buildVessel(spec, L, seed): VesselPart[]`; `TRI_BUDGET: Record<VesselKind, number>`
  - `vesselSuite(kinds: VesselKind[])` (test helper in `vessels/suite.ts`, reused by Task 4)
  - `paintPlanks(): HTMLCanvasElement` (browser); `vesselMaterials(): Record<VesselMaterialId, THREE.MeshStandardMaterial>` (module cache)
  - `anconTiming: { cpuMs: number; frames: number; add(ms: number): void }` (EMA + frame count), exposed as `window.__ANCON_ANCON__`
  - `<Ancon near era q frozen castShadow />` — owns the only ancón `useFrame`: `advanceClock` → `computeVesselPose(…, sharedVesselPose)` → hull/apron transforms → (later tasks: ropes, crew, wake) → `anconTiming.add` → `emitVesselPose(ctx)`; its `ctx` comes from `makePoseContext(crossingGeometry(placementFields(bank, near)), spec, flow, groundAt)` (`groundAt` samples the tier's terrain for the ride camera)
  - URL: `?c=<seconds>` → `UrlState.crossingStart`, `?ancon=0` → `UrlState.showAncon = false`. Store: `crossingStart` (default `DEFAULT_CROSSING_START`), `crossingSpeed` (default 1), `showAncon` (default true), `setCrossingSpeed(v: number)`.
  - `QualitySettings.ancon: { ropeSegments: number; ropeRadial: number; passengers: number }` — high {40, 6, 1}, medium {32, 6, 1}, low {20, 4, 0.5}

Why a new `?c` (accepted, preflight F15): spec §13 wants reproducible screenshots with `?freeze=1` / `?t=`. `?t` already means time of day (the sun), and the sun must stay at golden hour while the ferry moves, so the crossing gets its own clock start `?c` (seconds into the 360 s round trip). `?freeze=1` stops both clocks. The clock is integrated per frame (`advanceClock`: clock += dt · speed), so changing the debug speed mid-run keeps the crossing phase continuous (preflight F24).

- [ ] **Step 1: Failing URL/store tests**

```ts
// src/state/url.test.ts — add
test('parses the crossing clock start and the ancón toggle', () => {
  expect(parseUrlState('?c=95.5&ancon=0')).toEqual({ crossingStart: 95.5, showAncon: false });
  expect(parseUrlState('?c=-3&ancon=1')).toEqual({});
  expect(parseUrlState('?c=abc')).toEqual({});
});
test('round-trips crossingStart and showAncon', () => {
  const s = { crossingStart: 42, showAncon: false } as const;
  expect(parseUrlState(toSearch(s))).toEqual(s);
});
```

```ts
// src/state/store.test.ts — add
import { DEFAULT_CROSSING_START } from '../ancon/crossing';
test('defaults: ride camera, crossing clock about to cast off, 1× speed, ancón shown', () => {
  const s = useStore.getState();
  expect(s.camera).toBe('ride');
  expect(s.crossingStart).toBe(DEFAULT_CROSSING_START);
  expect(s.crossingSpeed).toBe(1);
  expect(s.showAncon).toBe(true);
});
```

Run `npx vitest run src/state` → FAIL.

- [ ] **Step 2: Implement URL/store/quality.** In `url.ts` add to `UrlState`: `crossingStart: number; showAncon: boolean;`; in `parseUrlState`:

```ts
  const c = Number(p.get('c'));
  if (p.has('c') && Number.isFinite(c) && c >= 0 && c < 1e6) out.crossingStart = c;
  if (p.get('ancon') === '0') out.showAncon = false;
```

and in `toSearch`:

```ts
  if (s.crossingStart !== undefined) p.set('c', String(s.crossingStart));
  if (s.showAncon === false) p.set('ancon', '0');
```

In `store.ts` add `crossingStart: number; crossingSpeed: number; showAncon: boolean; setCrossingSpeed: (v: number) => void` to `AppState`, defaults `crossingStart: DEFAULT_CROSSING_START, crossingSpeed: 1, showAncon: true` before `...fromUrl`, and `setCrossingSpeed: (crossingSpeed) => set({ crossingSpeed })`. In `quality.ts` add to `QualitySettings`:

```ts
  /** Ferry detail: rope tube segments per water span, tube sides, passenger count multiplier. */
  ancon: { ropeSegments: number; ropeRadial: number; passengers: number };
```

with `high: ancon: { ropeSegments: 40, ropeRadial: 6, passengers: 1 }`, `medium: { 32, 6, 1 }`, `low: { 20, 4, 0.5 }`. `npx vitest run src/state` → PASS.

- [ ] **Step 3: Failing builder tests.** The suite lives in a helper module so Task 4 can reuse it without importing a test file.

```ts
// src/ancon/vessels/suite.ts
import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { ERAS, type VesselKind } from '../../data/eras';
import { deckLayout, vesselSpec } from '../spec';
import type { VesselPart } from './common';
import { buildVessel, TRI_BUDGET } from './index';
import { tris } from '../testing';
export const bounds = (parts: VesselPart[]) => {
  const b = new THREE.Box3();
  for (const p of parts) { p.geometry.computeBoundingBox(); b.union(p.geometry.boundingBox!); }
  return b;
};
const hasVertexNear = (parts: VesselPart[], q: [number, number, number], r: number) => parts.some((p) => {
  const a = p.geometry.attributes.position.array as Float32Array;
  for (let i = 0; i < a.length; i += 3) if (Math.hypot(a[i] - q[0], a[i + 1] - q[1], a[i + 2] - q[2]) < r) return true;
  return false;
});

/** Size, budget, determinism, aprons and rope-guide checks for every era whose vessel is one of `kinds`. */
export function vesselSuite(kinds: VesselKind[]) {
  for (const era of ERAS.filter((e) => kinds.includes(e.ancon.kind.value))) describe(`${era.id} ${era.ancon.kind.value}`, () => {
    const spec = vesselSpec(era), L = deckLayout(spec), parts = buildVessel(spec, L, 1);
    test('geometry carries position, normal, uv, colour — no NaN', () => {
      expect(parts.length).toBeGreaterThan(0);
      for (const p of parts) {
        for (const a of ['position', 'normal', 'uv', 'color']) expect(p.geometry.getAttribute(a), a).toBeDefined();
        expect((p.geometry.attributes.position.array as Float32Array).every(Number.isFinite)).toBe(true);
      }
    });
    test('size matches the era: length incl. aprons, beam, draft, height', () => {
      const b = bounds(parts);
      expect(b.max.x - b.min.x).toBeGreaterThan(2 * L.reach - 0.3); expect(b.max.x - b.min.x).toBeLessThan(2 * L.reach + 0.6);
      expect(b.max.z - b.min.z).toBeGreaterThan(spec.beam - 0.2); expect(b.max.z - b.min.z).toBeLessThan(spec.beam + 0.5);
      expect(b.min.y).toBeLessThan(-0.15); expect(b.min.y).toBeGreaterThan(-1.0);
      expect(b.max.y).toBeLessThan(L.deckY + 1.6);
    });
    test('triangle budget', () => {
      expect(parts.reduce((n, p) => n + tris(p.geometry), 0)).toBeLessThan(TRI_BUDGET[spec.kind]);
    });
    test('deterministic by seed', () => {
      const again = buildVessel(spec, L, 1);
      expect(again.map((p) => p.geometry.attributes.position.array)).toEqual(parts.map((p) => p.geometry.attributes.position.array));
    });
    test('two hinged aprons when the kind has aprons, none otherwise', () => {
      const ends = parts.filter((p) => p.apron).map((p) => p.apron!.end).sort();
      expect(ends).toEqual(L.apron > 0 ? [-1, 1] : []);
      for (const p of parts) if (p.apron) expect(Math.abs(p.apron.hinge[0])).toBeCloseTo(L.halfLength, 1);
    });
    test('rope eras carry four deck guides where the ropes run', () => {
      if (spec.propulsion !== 'ropes') return;
      for (const sx of [-1, 1]) for (const sz of [-1, 1])
        expect(hasVertexNear(parts, [sx * (L.halfLength - 0.3), L.guideY, sz * L.ropeZ], 0.25)).toBe(true);
    });
  });
}
```

```ts
// src/ancon/vessels/vessels.test.ts
import { vesselSuite } from './suite';
vesselSuite(['timberBarge', 'plankPlatform', 'woodPlatform']);
```

Run `npx vitest run src/ancon/vessels` → FAIL (modules missing).

- [ ] **Step 4: Shared builder kit**

```ts
// src/ancon/vessels/common.ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type VesselMaterialId = 'wood' | 'steel' | 'iron';
export interface VesselPart {
  material: VesselMaterialId;
  /** Vessel-local frame: origin hull centre at the waterline, +X west, +Y up. */
  geometry: THREE.BufferGeometry;
  /** Hinged end apron/ramp, built flat; it rotates about local Z through `hinge` = (x, y). end −1 = east (−X), +1 = west. */
  apron?: { end: 1 | -1; hinge: [number, number] };
}
/** One texture tile covers TEX_M × TEX_M metres (world-scaled planar UVs). */
export const TEX_M = 2;
type V3 = [number, number, number];
const _c = new THREE.Color();

/** Planar UVs from the dominant normal axis, in metres / TEX_M, so texel density is the same on every part. */
export function worldUv(g: THREE.BufferGeometry) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u / TEX_M; uv[i * 2 + 1] = v / TEX_M;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Collects primitive pieces (non-indexed, vertex-coloured, world-UV'd) and merges them into one geometry. */
export class PartBuilder {
  private geos: THREE.BufferGeometry[] = [];
  get empty() { return this.geos.length === 0; }
  box(size: V3, at: V3, color: THREE.ColorRepresentation, rotZ = 0, rotY = 0) {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
    if (rotZ) g.rotateZ(rotZ);
    if (rotY) g.rotateY(rotY);
    g.translate(at[0], at[1], at[2]);
    return this.add(g, color);
  }
  /** Cylinder along `axis` (default Y), centred at `at`. */
  cylinder(rTop: number, rBottom: number, length: number, at: V3, color: THREE.ColorRepresentation, axis: 'x' | 'y' | 'z' = 'y', radial = 8) {
    const g = new THREE.CylinderGeometry(rTop, rBottom, length, radial, 1);
    if (axis === 'x') g.rotateZ(-Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(at[0], at[1], at[2]);
    return this.add(g, color);
  }
  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    _c.set(color);
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) { col[i] = _c.r; col[i + 1] = _c.g; col[i + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    worldUv(g);
    this.geos.push(g);
    return this;
  }
  build(): THREE.BufferGeometry {
    const m = mergeGeometries(this.geos, false);
    if (!m) throw new Error('PartBuilder: incompatible pieces');
    this.geos.forEach((g) => g.dispose());
    this.geos = [];
    return m;
  }
}

/** Shared vessel palette (sRGB hex → linear THREE.Color). One copy for every builder. */
export const WOOD = {
  base: new THREE.Color(0x7c6a52), dark: new THREE.Color(0x4f4234), bleach: new THREE.Color(0xa39580),
  strake: new THREE.Color(0x5e5040), tar: new THREE.Color(0x221d19), iron: new THREE.Color(0x2b2826),
};
/**
 * Steel pontoon paint. In linear space: FOUL (g/r ≈ 1.8) is greener than SHELL (g/r ≈ 1.4), the
 * side-panel base; RUST (luminance ≈ 0.02) is darker than SHELL (≈ 0.065) and DECK, so lerping
 * toward RUST darkens — the idle 1986 barge (more rust) is darker than the working 1984 one.
 */
export const STEEL = {
  deck: new THREE.Color(0x6f746c), shell: new THREE.Color(0x3f4a4c), rust: new THREE.Color(0x3a2618),
  foul: new THREE.Color(0x34461f), antifoul: new THREE.Color(0x5a2a22),
};

/** A tone between `base` and a random partner (weathering / sun bleaching), deterministic in `r`. */
export function tone(base: THREE.Color, dark: THREE.Color, light: THREE.Color, r: () => number, amount = 0.45) {
  return base.clone().lerp(r() < 0.5 ? dark : light, r() * amount);
}
export const woodTone = (r: () => number, amount = 0.45, base = WOOD.base) => tone(base, WOOD.dark, WOOD.bleach, r, amount);

/** Mooring bitts (1986) and corner bitts: deck-local x/z of the bitt at `end` (−1 east, +1 west) on `side`; posts are BITT_H tall. */
export const BITT_H = 0.35;
export const bittXZ = (L: { halfLength: number; halfBeam: number }, end: 1 | -1, side: 1 | -1): [number, number] =>
  [end * (L.halfLength - 0.9), side * (L.halfBeam - 0.45)];

/** Hinged plank apron for the wooden kinds, built flat from the hinge (x = end·halfLength) outward. */
export function plankApron(end: 1 | -1, L: { halfLength: number; halfBeam: number; deckY: number; apron: number },
  r: () => number, o: { plankW: number; gap: number; thick: number; beams: boolean }): VesselPart {
  const a = new PartBuilder(), x0 = end * L.halfLength, top = L.deckY, m = Math.max(2, Math.round(L.apron / o.plankW));
  if (o.beams) for (const sz of [-1, 1]) a.box([L.apron, 0.12, 0.16], [x0 + (end * L.apron) / 2, top - o.thick - 0.06, sz * (L.halfBeam - 0.5)], WOOD.dark);
  for (let i = 0; i < m; i++) a.box([L.apron / m - o.gap, o.thick, 2 * L.halfBeam - 0.4], [x0 + end * (i + 0.5) * (L.apron / m), top - o.thick / 2, 0], woodTone(r));
  return { material: 'wood', geometry: a.build(), apron: { end, hinge: [x0, top - o.thick / 2] } };
}
```

- [ ] **Step 5: Wooden platform builder (1935–1975) — the reference builder**

```ts
// src/ancon/vessels/woodPlatform.ts
import { cellRng } from '../../vegetation/rng';
import type { DeckLayout, VesselSpec } from '../spec';
import { PartBuilder, plankApron, WOOD, woodTone, type VesselPart } from './common';

const PLANK_W = 0.25, GAP = 0.012, PLANK_T = 0.06, DRAFT = 0.45, STRINGER_H = 0.18;

/** Wooden platform on stringers over a tarred pontoon hull, hinged plank aprons at both ends (research §2.2). */
export function buildWoodPlatform(spec: VesselSpec, L: DeckLayout, seed: number): VesselPart[] {
  const r = cellRng(seed, 3, 701), hl = L.halfLength, hb = L.halfBeam, top = L.deckY;
  const wood = new PartBuilder(), iron = new PartBuilder();
  const hullTop = top - PLANK_T - STRINGER_H;
  // Pontoon hull (tarred), shorter than the deck, with raked end blocks.
  wood.box([2 * hl - 1.2, hullTop + DRAFT, 2 * hb - 0.3], [0, (hullTop - DRAFT) / 2, 0], WOOD.tar);
  for (const sx of [-1, 1]) wood.box([0.8, (hullTop + DRAFT) * 0.8, 2 * hb - 0.3], [sx * (hl - 0.75), hullTop - (hullTop + DRAFT) * 0.4, 0], WOOD.tar, sx * 0.55);
  // Longitudinal stringers under the planks, visible along the sides.
  const nStr = Math.max(3, Math.round((2 * hb) / 1.1));
  for (let i = 0; i < nStr; i++) {
    const z = -hb + 0.12 + (i * (2 * hb - 0.24)) / (nStr - 1);
    wood.box([2 * hl, STRINGER_H, 0.2], [0, hullTop + STRINGER_H / 2, z], woodTone(r, 0.6));
  }
  // Transverse deck planks with gaps and slight height/tone variation.
  const n = Math.floor((2 * hl) / PLANK_W);
  for (let i = 0; i < n; i++) {
    const t = PLANK_T * (0.9 + 0.2 * r());
    wood.box([PLANK_W - GAP, t, 2 * hb - 0.02 * r()], [-hl + (i + 0.5) * PLANK_W, top - PLANK_T + t / 2, 0], woodTone(r));
  }
  // Rub rails and corner bitts.
  for (const sz of [-1, 1]) wood.box([2 * hl, 0.14, 0.1], [0, top - 0.06, sz * (hb + 0.03)], WOOD.dark);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wood.box([0.16, 0.5, 0.16], [sx * (hl - 0.3), top + 0.25, sz * (hb - 0.25)], WOOD.dark);
  // Rope guides: a post pair around each rope line with an iron roller; the rope rests on the roller top at guideY.
  if (spec.propulsion === 'ropes') for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const dz of [0.16, -0.16]) wood.box([0.14, L.guideY - top + 0.05, 0.14], [sx * (hl - 0.3), (top + L.guideY) / 2, sz * L.ropeZ + dz], WOOD.dark);
    iron.cylinder(0.07, 0.07, 0.34, [sx * (hl - 0.3), L.guideY - 0.07, sz * L.ropeZ], WOOD.iron, 'z', 10);
  }
  const parts: VesselPart[] = [{ material: 'wood', geometry: wood.build() }];
  if (!iron.empty) parts.push({ material: 'iron', geometry: iron.build() });
  for (const end of [-1, 1] as const) parts.push(plankApron(end, L, r, { plankW: PLANK_W, gap: GAP, thick: PLANK_T, beams: true }));
  return parts;
}
```

- [ ] **Step 6: Timber barge (1840, 1900) and plank platform (1925).** Both use the shared kit and palette. The barge's hull ends (gunwale caps, top strake, transom tops) reach exactly x = ±halfLength — the point `dockPoint` assumes (preflight F13).

```ts
// src/ancon/vessels/timberBarge.ts
import * as THREE from 'three';
import { cellRng } from '../../vegetation/rng';
import type { DeckLayout, VesselSpec } from '../spec';
import { PartBuilder, tone, WOOD, woodTone, type VesselPart } from './common';

const BOTTOM = -0.3, RAKE = 0.8, SIDE_T = 0.06;

/**
 * Colonial / early-1900s ancón de pasaje: a flat-bottomed plank scow, no aprons — its raked bow
 * noses onto the bank (APRON = 0). Hull ends (gunwale caps, top strake, transom tops) reach exactly
 * x = ±halfLength, the point dockPoint() assumes.
 */
export function buildTimberBarge(spec: VesselSpec, L: DeckLayout, seed: number): VesselPart[] {
  const r = cellRng(seed, 1, 703), hl = L.halfLength, hb = L.halfBeam, floor = L.deckY, top = floor + 0.45;
  const wood = new PartBuilder(), iron = new PartBuilder();
  /** |x| of the raked hull end at height y. */
  const xAt = (y: number) => hl - (RAKE * (top - y)) / (top - BOTTOM);
  // Bottom (tarred).
  wood.box([2 * xAt(BOTTOM), SIDE_T, 2 * hb - 2 * SIDE_T], [0, BOTTOM + SIDE_T / 2, 0], WOOD.tar);
  // Sides: three strakes, each a trapezoid following the rake, tar below the waterline.
  const sh = (top - BOTTOM) / 3;
  for (const sz of [-1, 1]) for (let k = 0; k < 3; k++) {
    const y0 = BOTTOM + k * sh, y1 = y0 + sh;
    const shape = new THREE.Shape([new THREE.Vector2(-xAt(y0), y0), new THREE.Vector2(xAt(y0), y0), new THREE.Vector2(xAt(y1), y1), new THREE.Vector2(-xAt(y1), y1)]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: SIDE_T, bevelEnabled: false }).translate(0, 0, sz > 0 ? hb - SIDE_T : -hb);
    wood.add(g, (y0 + y1) / 2 < 0.05 ? WOOD.tar : tone(WOOD.strake, WOOD.dark, WOOD.bleach, r, 0.16));
  }
  // Raked end panels (transoms) from the bottom edge up to the gunwale at x = ±hl.
  const rakeLen = Math.hypot(RAKE, top - BOTTOM), ang = Math.atan2(top - BOTTOM, RAKE);
  for (const sx of [-1, 1]) wood.box([rakeLen, SIDE_T, 2 * hb - 2 * SIDE_T], [sx * (hl - RAKE / 2), (top + BOTTOM) / 2, 0], WOOD.tar, sx * ang);
  // Floorboards, ribs, gunwale caps, tholes.
  const nf = Math.floor((2 * hb - 0.3) / 0.22);
  for (let i = 0; i < nf; i++) wood.box([2 * (hl - 0.45), 0.04, 0.2], [0, floor - 0.02, -hb + 0.15 + (i + 0.5) * 0.22], woodTone(r));
  for (let x = -(hl - RAKE) + 0.35; x <= hl - RAKE - 0.35 + 1e-9; x += 0.7) for (const sz of [-1, 1])
    wood.box([0.06, top - floor, 0.08], [x, (top + floor) / 2, sz * (hb - SIDE_T - 0.04)], WOOD.dark);
  for (const sz of [-1, 1]) wood.box([2 * hl, 0.05, 0.1], [0, top + 0.025, sz * (hb - 0.05)], WOOD.dark);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wood.cylinder(0.03, 0.03, 0.25, [sx * (hl - 0.25), top + 0.175, sz * (hb - 0.05)], WOOD.dark, 'y', 6);
  // Lombera (1840s): a cleat amidships on each gunwale; RopeSet ties the shore rope to the upstream one.
  if (spec.shoreRope) for (const sz of [-1, 1]) {
    iron.box([0.3, 0.06, 0.08], [0, top + 0.13, sz * (hb - 0.05)], WOOD.iron);
    for (const dx of [-0.1, 0.1]) iron.box([0.06, 0.1, 0.06], [dx, top + 0.05, sz * (hb - 0.05)], WOOD.iron);
  }
  const parts: VesselPart[] = [{ material: 'wood', geometry: wood.build() }];
  if (!iron.empty) parts.push({ material: 'iron', geometry: iron.build() });
  return parts;
}
```

```ts
// src/ancon/vessels/plankPlatform.ts
import { cellRng } from '../../vegetation/rng';
import type { DeckLayout, VesselSpec } from '../spec';
import { PartBuilder, plankApron, WOOD, woodTone, type VesselPart } from './common';

const PLANK_W = 0.28, GAP = 0.02, PLANK_T = 0.06, BOTTOM = -0.3, LOG_R = 0.14;

/** 1920s Cortijo platform: rough planks on three log stringers over a shallow tarred scow, single-plank aprons, no rails. */
export function buildPlankPlatform(spec: VesselSpec, L: DeckLayout, seed: number): VesselPart[] {
  void spec;
  const r = cellRng(seed, 2, 704), hl = L.halfLength, hb = L.halfBeam, top = L.deckY;
  const wood = new PartBuilder();
  const scowTop = top - PLANK_T - 2 * LOG_R;
  wood.box([2 * hl - 0.8, scowTop - BOTTOM, 2 * hb - 0.3], [0, (scowTop + BOTTOM) / 2, 0], WOOD.tar);
  for (const sx of [-1, 1]) wood.box([0.5, (scowTop - BOTTOM) * 0.8, 2 * hb - 0.3], [sx * (hl - 0.55), (scowTop + BOTTOM) / 2, 0], WOOD.tar, sx * 0.4);
  for (const z of [-hb + 0.4, 0, hb - 0.4]) wood.cylinder(LOG_R, LOG_R, 2 * hl - 0.2, [0, top - PLANK_T - LOG_R, z], woodTone(r, 0.6), 'x', 8);
  const n = Math.floor((2 * hl) / PLANK_W);
  for (let i = 0; i < n; i++) {
    const t = PLANK_T * (0.85 + 0.3 * r()), len = 2 * hb - 0.1 + 0.2 * r();
    wood.box([PLANK_W - GAP, t, len], [-hl + (i + 0.5) * PLANK_W, top - t / 2, (r() - 0.5) * 0.1], woodTone(r));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wood.box([0.14, 0.45, 0.14], [sx * (hl - 0.25), top + 0.225, sz * (hb - 0.25)], WOOD.dark);
  const parts: VesselPart[] = [{ material: 'wood', geometry: wood.build() }];
  for (const end of [-1, 1] as const) parts.push(plankApron(end, L, r, { plankW: PLANK_W, gap: GAP, thick: PLANK_T, beams: false }));
  return parts;
}
```

  - `index.ts`:

```ts
// src/ancon/vessels/index.ts
import type { VesselKind } from '../../data/eras';
import type { DeckLayout, VesselSpec } from '../spec';
import type { VesselPart } from './common';
import { buildPlankPlatform } from './plankPlatform';
import { buildTimberBarge } from './timberBarge';
import { buildWoodPlatform } from './woodPlatform';

export const TRI_BUDGET: Record<VesselKind, number> = { timberBarge: 4000, plankPlatform: 4000, woodPlatform: 7000, steelPontoon: 6000 };
type Builder = (s: VesselSpec, L: DeckLayout, seed: number) => VesselPart[];
const BUILDERS: Partial<Record<VesselKind, Builder>> = {
  timberBarge: buildTimberBarge, plankPlatform: buildPlankPlatform, woodPlatform: buildWoodPlatform,
};
export function buildVessel(spec: VesselSpec, L: DeckLayout, seed: number): VesselPart[] {
  const b = BUILDERS[spec.kind];
  if (!b) throw new Error(`no builder for ${spec.kind}`);
  return b(spec, L, seed);
}
```

(Task 4 adds `steelPontoon` and makes the record total.) Run `npx vitest run src/ancon/vessels` → PASS (barge x-extent = 2·hl + 0.06 from the transom thickness; all three kinds stay far under their triangle budgets).

- [ ] **Step 7: Textures, materials, timing**

```ts
// src/ancon/stats.ts
/** Exponential moving average of the ancón's per-frame CPU cost (pose + rigging + crew + wake), ms, and frames run. */
export const anconTiming = { cpuMs: 0, frames: 0, add(ms: number) { this.frames++; this.cpuMs = this.cpuMs * 0.95 + ms * 0.05; } };
declare global { interface Window { __ANCON_ANCON__?: typeof anconTiming } }
if (typeof window !== 'undefined') window.__ANCON_ANCON__ = anconTiming;
```

`src/ancon/textures.ts` (browser only, like `vegetation/textures.ts`): `paintPlanks()` — 1024 × 1024 canvas, one tile = `TEX_M` = 2 m (a 0.25 m plank is 128 px). Fill a light neutral (#cfc6b8; vertex colours carry the tone). Grain runs along the canvas **v** axis (deck planks lie along local Z and `worldUv` maps top faces to (x, z)): 2 000 streaks 1–2 px wide, 40–400 px long, alpha 0.05–0.18, colour #6d5f4f, with a slight sinusoidal waver; 25 knots (dark ellipses 6–14 px with 2–3 concentric rings); weathering: soft light blotches (alpha 0.06) and silver-grey bleaching; dark nail pairs every 128 px along u. Seamless: draw every stroke again at ±1024 px offsets.

```ts
// src/ancon/materials.ts
import * as THREE from 'three';
import type { VesselMaterialId } from './vessels/common';
import { paintPlanks } from './textures';

let cache: Record<VesselMaterialId, THREE.MeshStandardMaterial> | null = null;
export const canvasTexture = (c: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
};
/** Vessel materials, built once for the app's life (vertex colours × painted detail maps). */
export function vesselMaterials() {
  cache ??= {
    wood: new THREE.MeshStandardMaterial({ map: canvasTexture(paintPlanks()), vertexColors: true, roughness: 0.88 }),
    steel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.3 }),   // Task 4 adds its painted map
    iron: new THREE.MeshStandardMaterial({ color: 0x2b2826, roughness: 0.7, metalness: 0.5 }),
  };
  return cache;
}
```

- [ ] **Step 8: `<Ancon>` and wiring**

```tsx
// src/ancon/Ancon.tsx
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import type { Era } from '../data/eras';
import type { QualitySettings } from '../quality';
import { useStore } from '../state/store';
import { sampleField, type WorldFields } from '../terrain/fields';
import { placementFields } from '../terrain/placementFields';
import { advanceClock } from './crossing';
import { crossingGeometry } from './geometry';
import { vesselMaterials } from './materials';
import { apronLift, computeVesselPose, makePoseContext } from './pose';
import { vesselSpec } from './spec';
import { anconTiming } from './stats';
import { emitVesselPose, sharedVesselPose } from './vesselPose';
import { buildVessel } from './vessels';

/**
 * The ferry for the current era. One useFrame drives everything, in order: crossing clock →
 * vessel pose (shared, see useVesselPose) → hull + apron transforms → [ropes, crew, wake: later
 * tasks] → timing → pose listeners (the ride camera). Nothing else computes the live pose.
 */
export function Ancon({ near, era, q, frozen, castShadow }: {
  near: WorldFields; era: Era; q: QualitySettings; frozen: boolean; castShadow: boolean;
}) {
  const start = useStore((s) => s.crossingStart), speed = useStore((s) => s.crossingSpeed);
  const bank = era.river.bankOffset.value;
  const spec = useMemo(() => vesselSpec(era), [era]);
  // Crossing geometry always comes from the fixed 512 placement fields (never the tier's grid).
  const place = useMemo(() => placementFields(bank, near), [bank, near]);
  const ctx = useMemo(() => makePoseContext(crossingGeometry(place), spec, era.river.flow.value,
    (x: number, z: number) => sampleField(near, near.height, x, z)), [place, spec, era, near]);
  const layout = ctx.layout;
  const parts = useMemo(() => buildVessel(spec, layout, 1), [spec, layout]);
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  const mats = vesselMaterials();
  const hull = useRef<THREE.Group>(null);
  const aprons = useRef<(THREE.Group | null)[]>([]);
  const clock = useRef(start);
  useEffect(() => { clock.current = start; }, [start]);

  useFrame((_, dt) => {
    const t0 = performance.now();
    clock.current = advanceClock(clock.current, Math.min(dt, 0.1), frozen, speed);
    const pose = computeVesselPose(clock.current, ctx, sharedVesselPose);
    const g = hull.current;
    if (g) { g.matrix.copy(pose.matrix); g.matrixWorldNeedsUpdate = true; }
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], a = aprons.current[i];
      if (p.apron && a) a.rotation.z = p.apron.end * apronLift(pose.state, p.apron.end);
    }
    anconTiming.add(performance.now() - t0);
    emitVesselPose(ctx);
  });

  void q; // rope and crew tiers are used from Tasks 5 and 7
  return (
    <group ref={hull} matrixAutoUpdate={false}>
      {parts.map((p, i) => p.apron ? (
        <group key={i} ref={(el) => { aprons.current[i] = el; }} position={[p.apron.hinge[0], p.apron.hinge[1], 0]}>
          <mesh geometry={p.geometry} material={mats[p.material]} position={[-p.apron.hinge[0], -p.apron.hinge[1], 0]} castShadow={castShadow} receiveShadow />
        </group>
      ) : (
        <mesh key={i} geometry={p.geometry} material={mats[p.material]} castShadow={castShadow} receiveShadow />
      ))}
    </group>
  );
}
```

In `World.tsx`: `const showAncon = useStore((s) => s.showAncon);` and render `{showAncon && <Ancon near={near} era={era} q={q} frozen={frozen} castShadow={q.shadowMap > 0} />}` after `<Vegetation …/>`. In `DebugPanel.tsx` add

```ts
    'crossing ×': { value: init.crossingSpeed, min: 0, max: 8, step: 0.25, onChange: (v: number) => useStore.getState().setCrossingSpeed(v) },
    'ancón ms': monitor(() => anconTiming.cpuMs.toFixed(3), { graph: false, interval: 250 }),
```

- [ ] **Step 9: Visual check.** With `npx vite --port 5173 --strictPort` running (scratch paths in the session scratchpad):
  - `node scripts/dev/shot.mjs "?era=1975&cam=bank&c=70&freeze=1" <scratch>/t3-1975.png`
  - `node scripts/dev/shot.mjs "?era=1840&cam=bank&c=70&freeze=1" <scratch>/t3-1840.png`
  - `node scripts/dev/shot.mjs "?era=1925&cam=bank&c=5&freeze=1" <scratch>/t3-1925-docked.png`
  - `node scripts/dev/shot.mjs "?era=1959&cam=aerial&c=120&freeze=1" <scratch>/t3-aerial.png`

  Acceptance (quality bar: a wooden boat on reflective water in cinematic golden light): the hull sits on the water (no floating gap, no deck under water) and crosses along the landing line; docked, the apron/bow meets the Loíza bank inside the vegetation clearing; the wood reads as heavy weathered timber — plank seams catch the low sun, the tarred hull is darker at the waterline; the vessel shows, inverted and softly rippled, in the river reflection; no console errors. A small hull/terrain overlap at the dock is acceptable only where it reads as the apron resting on the bank (Phase 4 builds the landings). `npm test`, `npm run build`. Commit:

```bash
git add src/ancon src/state src/quality.ts src/scene/World.tsx src/ui/DebugPanel.tsx
git commit -m "$(cat <<'EOF'
feat(ancon): wooden vessel builders, the ferry on the river, ?c crossing clock

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Steel pontoon (1980–86) and the moored barge (1986)

**Files:**
- Create: `src/ancon/vessels/steelPontoon.ts`, `src/ancon/vessels/steel.test.ts`
- Modify: `src/ancon/vessels/index.ts`, `src/ancon/textures.ts` (+ `paintSteel`), `src/ancon/materials.ts`

**Interfaces:**
- Consumes: `PartBuilder`, `STEEL`, `WOOD`, `BITT_H`, `bittXZ`, `VesselPart` (Task 3 common.ts); `vesselSuite`, `bounds` (Task 3 `suite.ts`); `DeckLayout`, `VesselSpec`, `CAR_SLOT`.
- Produces: `buildSteelPontoon(spec: VesselSpec, L: DeckLayout, seed: number): VesselPart[]`; `BUILDERS` total over `VesselKind`; `paintSteel(): HTMLCanvasElement`; `vesselMaterials().steel.map` set.

Research §2.2: "metal barge with steel plates", 6–8 cars, hauled out by crane ~1982 because snails and growth fouled the hull [S1][S4]; inferred modelling defaults: flat pontoon ≈ 20 × 7.5 m, welded plate hull, hinged end ramps, low perimeter curb, rope guides.

- [ ] **Step 1: Failing tests**

```ts
// src/ancon/vessels/steel.test.ts
import { expect, test } from 'vitest';
import { getEra } from '../../data/eras';
import { deckLayout, vesselSpec } from '../spec';
import { BITT_H, bittXZ, type VesselPart } from './common';
import { buildVessel } from './index';
import { bounds, vesselSuite } from './suite';

vesselSuite(['steelPontoon']);

/**
 * Mean colour luminance and g/r ratio of the hull's outer skin: side triangles (|normal.z| > 0.9,
 * centroid |z| > halfBeam − 0.02) whose centroid y lies in `band`. Non-indexed geometry (PartBuilder).
 */
const colourStats = (parts: VesselPart[], hb: number, band: [number, number]) => {
  let lum = 0, g = 0, r = 0, n = 0;
  for (const p of parts) {
    const pos = p.geometry.attributes.position, nrm = p.geometry.attributes.normal, col = p.geometry.attributes.color;
    for (let t = 0; t < pos.count; t += 3) {
      const y = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3, z = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
      if (Math.abs(nrm.getZ(t)) < 0.9 || Math.abs(z) < hb - 0.02 || y < band[0] || y > band[1]) continue;
      lum += 0.2126 * col.getX(t) + 0.7152 * col.getY(t) + 0.0722 * col.getZ(t); g += col.getY(t); r += col.getX(t); n++;
    }
  }
  expect(n).toBeGreaterThan(0);
  return { lum: lum / n, greenness: g / Math.max(r, 1e-6) };
};
const HB = 7.5 / 2;
const build = (id: '1984' | '1986') => { const s = vesselSpec(getEra(id)); return buildVessel(s, deckLayout(s), 1); };

test('the fouling band at the waterline is greener and darker than the topsides', () => {
  const parts = build('1984');
  expect(parts.some((p) => p.material === 'steel')).toBe(true);
  const band = colourStats(parts, HB, [-0.3, 0.05]), top = colourStats(parts, HB, [0.25, 0.65]);
  expect(band.greenness).toBeGreaterThan(top.greenness);
  expect(band.lum).toBeLessThan(top.lum);
});
test('the idle 1986 barge is rustier (darker topsides) than the working 1984 one', () => {
  expect(colourStats(build('1986'), HB, [0.25, 0.65]).lum).toBeLessThan(colourStats(build('1984'), HB, [0.25, 0.65]).lum);
});
test('steel ramps, longer than the wooden aprons', () => {
  const ramps = build('1984').filter((p) => p.apron);
  expect(ramps.map((p) => p.material)).toEqual(['steel', 'steel']);
  const b = bounds([ramps[0]]);
  expect(b.max.x - b.min.x).toBeGreaterThan(1.4);
});
test('bitts stand where the 1986 mooring lines start (bittXZ, BITT_H)', () => {
  const s = vesselSpec(getEra('1986')), L = deckLayout(s), iron = buildVessel(s, L, 1).find((p) => p.material === 'iron')!;
  const a = iron.geometry.attributes.position.array as Float32Array;
  for (const side of [1, -1] as const) {
    const [bx, bz] = bittXZ(L, -1, side), y = L.deckY + BITT_H;
    let best = Infinity;
    for (let i = 0; i < a.length; i += 3) best = Math.min(best, Math.hypot(a[i] - bx, a[i + 1] - y, a[i + 2] - bz));
    expect(best).toBeLessThan(0.12);
  }
});
```

Run `npx vitest run src/ancon/vessels` → FAIL (`no builder for steelPontoon`).

- [ ] **Step 2: Builder.** The palette is `STEEL` in `common.ts` (Task 3): side panels are SHELL-based and lerp toward RUST (darker than SHELL), the fouling strip is FOUL (greener than SHELL, no rust), so the colour tests hold in linear space; the idle 1986 barge draws the same random numbers with a larger rust share, so every panel is darker (preflight F5/F12). The main shell is the straight 2·(hl − 1.2) m middle; the raked ends are extruded blocks; bitts stand at `bittXZ` where Task 5's mooring lines start (F26).

```ts
// src/ancon/vessels/steelPontoon.ts
import * as THREE from 'three';
import { cellRng } from '../../vegetation/rng';
import { CAR_SLOT, type DeckLayout, type VesselSpec } from '../spec';
import { BITT_H, bittXZ, PartBuilder, STEEL, WOOD, type VesselPart } from './common';

const BOTTOM = -0.9, RAKE = 1.2, FOUL_TOP = 0.05, FOUL_BOTTOM = -0.3, PANEL_T = 0.03;

/**
 * 1980–86 steel-plate pontoon (research §2.2): welded plate hull with raked ends, deck plating,
 * low curb, rope guides, bitts, hinged steel ramps, a fouling band at the waterline. The idle 1986
 * barge uses the same random draws with more rust (so every panel is darker).
 */
export function buildSteelPontoon(spec: VesselSpec, L: DeckLayout, seed: number): VesselPart[] {
  const r = cellRng(seed, 4, 702), hl = L.halfLength, hb = L.halfBeam, top = L.deckY, rust = spec.moored ? 0.35 : 0.15;
  const steel = new PartBuilder(), iron = new PartBuilder();
  /** ±6 % tone, then a random share (0..k) of rust. Always draws two numbers (same stream for 1984 and 1986). */
  const worn = (base: THREE.Color, k: number) => { const a = r(), b = r(); return base.clone().multiplyScalar(0.94 + 0.12 * a).lerp(STEEL.rust, k * b); };
  const straight = hl - RAKE, shellTop = top - 0.012;
  // Core shell, 3 cm inside the side panels (the panels form the whole outer skin), antifouling below −0.3.
  steel.box([2 * straight, shellTop - FOUL_BOTTOM, 2 * hb - 0.06], [0, (shellTop + FOUL_BOTTOM) / 2, 0], STEEL.shell);
  steel.box([2 * straight, FOUL_BOTTOM - BOTTOM, 2 * hb - 0.06], [0, (FOUL_BOTTOM + BOTTOM) / 2, 0], STEEL.antifoul);
  // Raked ends: the bottom rises from BOTTOM at |x| = straight to −0.25 at |x| = hl.
  for (const sx of [-1, 1]) {
    const pts = [[straight, BOTTOM], [hl, -0.25], [hl, shellTop], [straight, shellTop]].map(([x, y]) => new THREE.Vector2(sx * x, y));
    steel.add(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 2 * hb - 0.06, bevelEnabled: false }).translate(0, 0, -(hb - 0.03)), STEEL.shell);
  }
  // Side plating: 2 m panels (0.1 m weld gaps) in SHELL + rust above FOUL_TOP, a fouling strip below it.
  const m = Math.max(1, Math.round((2 * straight) / 2)), pitch = (2 * straight) / m;
  for (const sz of [-1, 1]) for (let i = 0; i < m; i++) {
    const x = -straight + (i + 0.5) * pitch, z = sz * (hb - PANEL_T / 2);
    steel.box([pitch - 0.1, top - 0.02 - FOUL_TOP, PANEL_T], [x, (top - 0.02 + FOUL_TOP) / 2, z], worn(STEEL.shell, rust));
    steel.box([pitch - 0.1, FOUL_TOP - FOUL_BOTTOM, PANEL_T], [x, (FOUL_TOP + FOUL_BOTTOM) / 2, z], STEEL.foul.clone().multiplyScalar(0.94 + 0.12 * r()));
  }
  // Deck plates 1.5 × 3.75 m with 8 mm weld seams; worn wheel lanes.
  const nx = Math.ceil((2 * hl) / 1.5), nz = Math.max(1, Math.round((2 * hb) / 3.75)), px = (2 * hl) / nx, pz = (2 * hb) / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++)
    steel.box([px - 0.008, 0.012, pz - 0.008], [-hl + (i + 0.5) * px, top - 0.006, -hb + (j + 0.5) * pz], worn(STEEL.deck, rust));
  for (let l = 0; l < L.lanes; l++) for (const dz of [-0.8, 0.8])
    steel.box([2 * hl - 1, 0.002, 0.5], [0, top + 0.001, (l + 0.5 - L.lanes / 2) * CAR_SLOT.width * 1.08 + dz], STEEL.deck.clone().multiplyScalar(0.8));
  // Curb along both sides, open at the corners (drainage).
  for (const sz of [-1, 1]) steel.box([2 * hl - 0.6, 0.2, 0.15], [0, top + 0.1, sz * (hb - 0.075)], worn(STEEL.shell, rust));
  // Rope guides (kept on the idle barge): post pair + roller, roller top at guideY — same place as the wooden guides.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const dz of [0.16, -0.16]) steel.box([0.12, L.guideY - top + 0.05, 0.12], [sx * (hl - 0.3), (top + L.guideY) / 2, sz * L.ropeZ + dz], STEEL.shell);
    iron.cylinder(0.08, 0.08, 0.34, [sx * (hl - 0.3), L.guideY - 0.08, sz * L.ropeZ], WOOD.iron, 'z', 10);
  }
  // Bitts at bittXZ (the 1986 mooring lines start at the east pair's tops).
  for (const end of [-1, 1] as const) for (const side of [-1, 1] as const) {
    const [bx, bz] = bittXZ(L, end, side);
    iron.cylinder(0.1, 0.1, BITT_H, [bx, top + BITT_H / 2, bz], WOOD.iron, 'y', 8);
  }
  const parts: VesselPart[] = [{ material: 'steel', geometry: steel.build() }, { material: 'iron', geometry: iron.build() }];
  // Hinged steel ramps with anti-slip bars and hinge knuckles.
  for (const end of [-1, 1] as const) {
    const a = new PartBuilder(), x0 = end * hl, y = top - 0.05;
    a.box([L.apron, 0.1, 2 * hb - 1.0], [x0 + (end * L.apron) / 2, y, 0], worn(STEEL.deck, rust));
    for (let i = 0; i < 6; i++) a.box([0.04, 0.03, 2 * hb - 1.1], [x0 + end * (i + 0.5) * (L.apron / 6), y + 0.065, 0], STEEL.shell);
    for (const dz of [-(hb - 1.2), hb - 1.2]) a.cylinder(0.07, 0.07, 0.5, [x0, y, dz], WOOD.iron, 'z', 8);
    parts.push({ material: 'steel', geometry: a.build(), apron: { end, hinge: [x0, y] } });
  }
  return parts;
}
```

Register it and make the record total:

```ts
// src/ancon/vessels/index.ts
import type { VesselKind } from '../../data/eras';
import type { DeckLayout, VesselSpec } from '../spec';
import type { VesselPart } from './common';
import { buildPlankPlatform } from './plankPlatform';
import { buildSteelPontoon } from './steelPontoon';
import { buildTimberBarge } from './timberBarge';
import { buildWoodPlatform } from './woodPlatform';

export const TRI_BUDGET: Record<VesselKind, number> = { timberBarge: 4000, plankPlatform: 4000, woodPlatform: 7000, steelPontoon: 6000 };
type Builder = (s: VesselSpec, L: DeckLayout, seed: number) => VesselPart[];
const BUILDERS: Record<VesselKind, Builder> = {
  timberBarge: buildTimberBarge, plankPlatform: buildPlankPlatform, woodPlatform: buildWoodPlatform, steelPontoon: buildSteelPontoon,
};
export const buildVessel = (spec: VesselSpec, L: DeckLayout, seed: number): VesselPart[] => BUILDERS[spec.kind](spec, L, seed);
```

Run `npx vitest run src/ancon/vessels` → PASS.

- [ ] **Step 3: Steel texture.** `paintSteel()` — 1024², one tile = 2 m. Light neutral base (#c9c9c2); mottled paint wear (400 soft blotches, alpha 0.04–0.1, darker and lighter); rust: 120 drip streaks along canvas **v** (2–5 px wide, 30–200 px long, #8a4a22 fading to transparent, alpha 0.15–0.45), half of them starting on two horizontal lines per tile (plate edges); 3 000 one-pixel dark pits; a few bright scratches (alpha 0.25). Seamless like `paintPlanks`. In `materials.ts` add `map: canvasTexture(paintSteel())` to `steel`.

- [ ] **Step 4: Visual check** (quality bar: industrial steel against golden haze, a soft specular sheen on the worn deck, a dark fouling line where hull meets water, a clean reflection):
  - `node scripts/dev/shot.mjs "?era=1984&cam=bank&c=70&freeze=1" <scratch>/t4-1984.png`
  - `node scripts/dev/shot.mjs "?era=1986&cam=bank&c=0&freeze=1" <scratch>/t4-1986.png` — moored against the Loíza bank, east ramp down on the bank, west ramp raised, visibly rustier than 1984.

  The pontoon must read as ~20 m long (compare with the 1975 platform from Task 3 and the bank trees). `npm test`, `npm run build`. Commit:

```bash
git add src/ancon
git commit -m "$(cat <<'EOF'
feat(ancon): steel pontoon and the moored 1986 barge

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Rigging — hauling ropes with sag, bank posts, the 1840 shore rope, 1986 mooring lines, pole geometry

**Files:**
- Create: `src/ancon/rope.ts` (+ `rope.test.ts`), `src/ancon/rigging.ts` (+ `rigging.test.ts`), `src/ancon/pole.ts` (+ `pole.test.ts`), `src/ancon/RopeSet.ts` (+ `RopeSet.test.ts`)
- Modify: `src/ancon/Ancon.tsx`

**Interfaces:**
- Consumes: `CrossingGeometry`, `XZ`, `waterAt`, `landingClearings` (Task 1); `DeckLayout`, `VesselSpec` (Task 1); `VesselPose`, `ctxFor`, `fields512` (Task 2 / testing.ts); `BITT_H`, `bittXZ` (Task 3/4 common.ts); `QualitySettings.ancon` (Task 3); `sampleField`, `WorldFields`; `RIVER_DIR`; `cellRng`.
- Produces:
  - `type V3 = [number, number, number]` (rope.ts)
  - `MAX_SAG = 2.4`, `spanSag(span: number, slack: number): number`
  - `writeSpan(a: V3, b: V3, sag: number, n: number, out: Float32Array, offset: number): number` (writes n + 1 points, returns the next point offset)
  - `writeRopeLine(postA: V3, guideA: V3, guideB: V3, postB: V3, slack: number, segs: number, out: Float32Array): number` (2·(segs + 1) points)
  - `writeTube(pts: Float32Array, count: number, radius: number, radial: number, pos: Float32Array, nrm: Float32Array): void`, `tubeIndex(count: number, radial: number): Uint16Array`
  - `POST_BACK = 4`, `POST_H = 1.1`, `interface RopeRig { east: [V3, V3]; west: [V3, V3] }` (index 0 = local +Z line, 1 = −Z line), `lateral(g): XZ`, `ropeRig(g, L, f): RopeRig` (posts snapped inland onto land), `upstreamSide(g): 1 | -1`, `shoreRopePost(g, f): V3`, `guideLocal(L, end, line, out): V3`, `mooringLocal(L, line, out): V3` (top of the east bitt), `cleatLocal(L, side, out): V3` — all write into `out` (no per-frame allocation)
  - `POLE_LEN = 5.5`, `buildPole(seed: number): THREE.BufferGeometry` (unit length along −Y: y = 0 top … y = −1 tip, real radii)
  - `class RopeSet { readonly group: THREE.Group; constructor(o: { spec: VesselSpec; layout: DeckLayout; geom: CrossingGeometry; fields: WorldFields; segments: number; radial: number }); update(pose: VesselPose, pxScale: number): void; lineCount: number; dispose(): void }`

Physical model (research §2.3, inferred rig): two marine ropes kept taut from bank to bank, passing over the four deck guides; hauled hand over hand. While the vessel waits, `slack` → 1 and the long water span sags into the river (so boats could pass). The rope is a parabola between its end points (catenary approximation, error < 1 % at these sag/span ratios).

- [ ] **Step 1: Failing tests**

```ts
// src/ancon/rope.test.ts
import { expect, test } from 'vitest';
import { MAX_SAG, spanSag, tubeIndex, writeRopeLine, writeSpan, writeTube, type V3 } from './rope';

test('sag grows with span and slack, capped', () => {
  expect(spanSag(150, 0)).toBeCloseTo(0.6, 9);
  expect(spanSag(150, 1)).toBeGreaterThan(spanSag(150, 0.5));
  expect(spanSag(1000, 1)).toBe(MAX_SAG);
});
test('a taut 150 m span stays above the water, a slack one dips into it (ends 1.4 m up)', () => {
  const a: V3 = [0, 1.4, 0], b: V3 = [150, 1.4, 0], out = new Float32Array(3 * 41);
  writeSpan(a, b, spanSag(150, 0), 40, out, 0);
  expect(Math.min(...Array.from({ length: 41 }, (_, i) => out[i * 3 + 1]))).toBeGreaterThan(0.5);
  writeSpan(a, b, spanSag(150, 1), 40, out, 0);
  expect(out[20 * 3 + 1]).toBeLessThan(0);
});
test('span endpoints exact, midpoint lowered by the sag, symmetric', () => {
  const out = new Float32Array(3 * 11), a: V3 = [1, 2, 3], b: V3 = [11, 4, -7];
  expect(writeSpan(a, b, 0.5, 10, out, 0)).toBe(11);
  expect(Array.from(out.slice(0, 3))).toEqual(a);
  expect(Array.from(out.slice(30, 33))).toEqual(b);
  expect(out[5 * 3 + 1]).toBeCloseTo(3 - 0.5, 9);
  expect(out[2 * 3 + 1] - (2 + 0.2 * 2)).toBeCloseTo(out[8 * 3 + 1] - (2 + 0.8 * 2), 5);   // float32 output
});
test('rope line = post → guide, guide → post; the deck run is the straight segment between the spans', () => {
  const out = new Float32Array(3 * 2 * 21);
  const n = writeRopeLine([0, 1, 0], [50, 1.4, 0], [57, 1.4, 0], [200, 1, 0], 0, 20, out);
  expect(n).toBe(42);
  expect(Array.from(out.slice(20 * 3, 21 * 3))).toEqual([50, 1.4, 0].map(Math.fround));
  expect(Array.from(out.slice(21 * 3, 22 * 3))).toEqual([57, 1.4, 0].map(Math.fround));
});
test('tube: rings at the radius, unit normals, outward winding', () => {
  const pts = new Float32Array([0, 0, 0, 1, 0, 0, 2, 0.2, 0]), r = 0.03, radial = 6;
  const pos = new Float32Array(3 * radial * 3), nrm = new Float32Array(pos.length);
  writeTube(pts, 3, r, radial, pos, nrm);
  for (let i = 0; i < 3; i++) for (let j = 0; j < radial; j++) {
    const k = (i * radial + j) * 3;
    expect(Math.hypot(pos[k] - pts[i * 3], pos[k + 1] - pts[i * 3 + 1], pos[k + 2] - pts[i * 3 + 2])).toBeCloseTo(r, 6);
    expect(Math.hypot(nrm[k], nrm[k + 1], nrm[k + 2])).toBeCloseTo(1, 6);
  }
  const idx = tubeIndex(3, radial);
  expect(idx.length).toBe(2 * radial * 6);
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]].map((v) => v * 3);
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    expect(fn[0] * nrm[a] + fn[1] * nrm[a + 1] + fn[2] * nrm[a + 2]).toBeGreaterThan(0);
  }
});
```

```ts
// src/ancon/rigging.test.ts
import { expect, test } from 'vitest';
import { ERAS } from '../data/eras';
import { RIVER_DIR } from '../geo/constants';
import { sampleField, WATER } from '../terrain/fields';
import { LANDING_CLEARING } from '../vegetation/masks';
import { landingClearings, waterAt } from './geometry';
import { POST_H, ropeRig, shoreRopePost } from './rigging';
import { deckLayout, vesselSpec } from './spec';
import { fields512, geom512 } from './testing';

test.each([0, 8])('bank posts: on land, eye POST_H above the ground, inside the landing clearing, one per rope line (bankOffset %i)', (bank) => {
  const f = fields512(bank), g = geom512(bank), [cE, cW] = landingClearings(g);
  for (const e of ERAS.filter((x) => x.ancon.propulsion.value === 'ropes' || x.ancon.propulsion.value === 'moored')) {
    const L = deckLayout(vesselSpec(e)), rig = ropeRig(g, L, f);
    for (const [posts, c] of [[rig.east, cE], [rig.west, cW]] as const) for (const p of posts) {
      expect(waterAt(f, p[0], p[2]), e.id).toBe(WATER.LAND);
      expect(p[1]).toBeCloseTo(sampleField(f, f.height, p[0], p[2]) + POST_H, 6);
      expect(Math.hypot(p[0] - c[0], p[2] - c[1]), e.id).toBeLessThan(LANDING_CLEARING[0]);
    }
  }
  const s = shoreRopePost(g, f);
  expect(waterAt(f, s[0], s[2])).toBe(WATER.LAND);
  expect((s[0] - g.shoreEast[0]) * -RIVER_DIR[0] + (s[2] - g.shoreEast[1]) * -RIVER_DIR[1]).toBeGreaterThan(0); // upstream side
});
```

```ts
// src/ancon/pole.test.ts
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { buildPole } from './pole';

test('pole: unit length along −Y, real radii, cheap, deterministic', () => {
  const g = buildPole(3);
  const b = new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute);
  expect(b.max.y).toBeCloseTo(0, 3); expect(b.min.y).toBeCloseTo(-1, 3);
  expect(b.max.x - b.min.x).toBeLessThan(0.14);
  expect((g.index ? g.index.count : g.attributes.position.count) / 3).toBeLessThan(300);
  expect(g.getAttribute('color')).toBeDefined();
  expect(buildPole(3).attributes.position.array).toEqual(g.attributes.position.array);
});
```

```ts
// src/ancon/RopeSet.test.ts
import type * as THREE from 'three';
import { expect, test } from 'vitest';
import { getEra, type EraId } from '../data/eras';
import { computeVesselPose, createVesselPose } from './pose';
import { RopeSet } from './RopeSet';
import { mooringLocal, ropeRig } from './rigging';
import { ctxFor, fields512 } from './testing';

const make = (id: EraId) => {
  const ctx = ctxFor(id), bank = getEra(id).river.bankOffset.value;
  return { ctx, bank, set: new RopeSet({ spec: ctx.spec, layout: ctx.layout, geom: ctx.geom, fields: fields512(bank), segments: 32, radial: 6 }) };
};
const firstRing = (set: RopeSet, line = 0) => {
  const mesh = set.group.children.filter((c) => (c as THREE.Mesh).isMesh && !(c as THREE.InstancedMesh).isInstancedMesh)[line] as THREE.Mesh;
  const p = mesh.geometry.attributes.position.array as Float32Array;
  let cx = 0, cy = 0, cz = 0;
  for (let j = 0; j < 6; j++) { cx += p[j * 3] / 6; cy += p[j * 3 + 1] / 6; cz += p[j * 3 + 2] / 6; }
  return { p, c: [cx, cy, cz] };
};

test('line count per era kind', () => {
  expect(make('1935').set.lineCount).toBe(2);   // two hauling ropes
  expect(make('1840').set.lineCount).toBe(1);   // Lombera shore rope
  expect(make('1986').set.lineCount).toBe(2);   // mooring lines
  expect(make('1925').set.lineCount).toBe(0);
});
test('hauling rope starts at its east post and stays finite while crossing', () => {
  const { ctx, bank, set } = make('1975');
  set.update(computeVesselPose(90, ctx, createVesselPose()), 0.001);
  const { p, c } = firstRing(set), post = ropeRig(ctx.geom, ctx.layout, fields512(bank)).east[0];
  expect(p.every(Number.isFinite)).toBe(true);
  expect(Math.hypot(c[0] - post[0], c[1] - post[1], c[2] - post[2])).toBeLessThan(1e-3);
});
test('1986 mooring lines start at the top of an east bitt', () => {
  const { ctx, set } = make('1986'), pose = computeVesselPose(0, ctx, createVesselPose());
  set.update(pose, 0.001);
  const { c } = firstRing(set, 0), b = mooringLocal(ctx.layout, 0, [0, 0, 0]);
  const v = { x: b[0], y: b[1], z: b[2] };
  const e = pose.matrix.elements, w = [e[0] * v.x + e[4] * v.y + e[8] * v.z + e[12], e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13], e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14]];
  expect(Math.hypot(c[0] - w[0], c[1] - w[1], c[2] - w[2])).toBeLessThan(1e-3);
});
```

Run `npx vitest run src/ancon` → FAIL (modules missing). Posts are computed from the 512 placement fields and snapped inland onto land (0.5 m steps, ≤ 20 m), so they are on land for both bank offsets and stay inside the landing clearing (preflight F3).

- [ ] **Step 2: `rope.ts`**

```ts
// src/ancon/rope.ts
export type V3 = [number, number, number];
/** Largest mid-span sag, m: a slack rope rests about a metre under the surface instead of on the bed. */
export const MAX_SAG = 2.4;
/** Mid-span sag (m): taut ≈ 0.4 % of the span, slack adds up to 2 %. */
export const spanSag = (span: number, slack: number) => Math.min(MAX_SAG, span * (0.004 + 0.02 * slack));

/** n + 1 points from a to b sagging by `sag` at mid-span (parabolic catenary approximation). Returns offset + n + 1. */
export function writeSpan(a: V3, b: V3, sag: number, n: number, out: Float32Array, offset: number): number {
  for (let i = 0; i <= n; i++) {
    const s = i / n, k = (offset + i) * 3;
    out[k] = a[0] + (b[0] - a[0]) * s;
    out[k + 1] = a[1] + (b[1] - a[1]) * s - 4 * sag * s * (1 - s);
    out[k + 2] = a[2] + (b[2] - a[2]) * s;
  }
  return offset + n + 1;
}

const dist = (a: V3, b: V3) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
/** A hauling rope: bank post A → deck guide A (water span), straight over the deck, guide B → post B. */
export function writeRopeLine(postA: V3, guideA: V3, guideB: V3, postB: V3, slack: number, segs: number, out: Float32Array): number {
  const o = writeSpan(postA, guideA, spanSag(dist(postA, guideA), slack), segs, out, 0);
  return writeSpan(guideB, postB, spanSag(dist(guideB, postB), slack), segs, out, o);
}

/** Tube vertices around a polyline (rings of `radial` vertices, outward unit normals). */
export function writeTube(pts: Float32Array, count: number, radius: number, radial: number, pos: Float32Array, nrm: Float32Array) {
  for (let i = 0; i < count; i++) {
    const i0 = Math.max(0, i - 1) * 3, i1 = Math.min(count - 1, i + 1) * 3;
    let tx = pts[i1] - pts[i0], ty = pts[i1 + 1] - pts[i0 + 1], tz = pts[i1 + 2] - pts[i0 + 2];
    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    let rx = 0, ry = 1, rz = 0;
    if (Math.abs(ty) > 0.95) { rx = 1; ry = 0; }
    // b = normalize(t × r); n = b × t
    let bx = ty * rz - tz * ry, by = tz * rx - tx * rz, bz = tx * ry - ty * rx;
    const bl = Math.hypot(bx, by, bz); bx /= bl; by /= bl; bz /= bl;
    const nx = by * tz - bz * ty, ny = bz * tx - bx * tz, nz = bx * ty - by * tx;
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), k = (i * radial + j) * 3;
      const ox = c * nx + s * bx, oy = c * ny + s * by, oz = c * nz + s * bz;
      nrm[k] = ox; nrm[k + 1] = oy; nrm[k + 2] = oz;
      pos[k] = pts[i * 3] + ox * radius; pos[k + 1] = pts[i * 3 + 1] + oy * radius; pos[k + 2] = pts[i * 3 + 2] + oz * radius;
    }
  }
}

/** Static index for a tube of `count` rings (outward-facing winding). */
export function tubeIndex(count: number, radial: number): Uint16Array {
  const idx = new Uint16Array((count - 1) * radial * 6);
  let o = 0;
  for (let i = 0; i < count - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = a + radial, d = b + radial;
    idx[o++] = a; idx[o++] = b; idx[o++] = c;
    idx[o++] = b; idx[o++] = d; idx[o++] = c;
  }
  return idx;
}
```

- [ ] **Step 3: `rigging.ts` and `pole.ts`**

```ts
// src/ancon/rigging.ts
import { RIVER_DIR } from '../geo/constants';
import { sampleField, WATER, type WorldFields } from '../terrain/fields';
import { waterAt, type CrossingGeometry, type XZ } from './geometry';
import type { V3 } from './rope';
import type { DeckLayout } from './spec';
import { BITT_H, bittXZ } from './vessels/common';

/** Bank posts stand this far inland of the waterline (snapped further inland onto land if needed), rope eye POST_H above the ground (inferred). */
export const POST_BACK = 4, POST_H = 1.1;
const SNAP_STEP = 0.5, SNAP_MAX = 20;
export interface RopeRig { east: [V3, V3]; west: [V3, V3] }
/** World XZ direction of vessel-local +Z. */
export const lateral = (g: CrossingGeometry): XZ => [-g.dir[1], g.dir[0]];
/** +1 when local +Z points upstream. */
export const upstreamSide = (g: CrossingGeometry): 1 | -1 => {
  const n = lateral(g);
  return -(n[0] * RIVER_DIR[0] + n[1] * RIVER_DIR[1]) >= 0 ? 1 : -1;
};
/** A post at (x, z), moved inland along (ix, iz) in 0.5 m steps until it stands on land. */
function post(f: WorldFields, x: number, z: number, ix: number, iz: number): V3 {
  for (let s = 0; s <= SNAP_MAX && waterAt(f, x, z) !== WATER.LAND; s += SNAP_STEP) { x += ix * SNAP_STEP; z += iz * SNAP_STEP; }
  return [x, sampleField(f, f.height, x, z) + POST_H, z];
}

/** Two bank posts per shore, one per rope line (line 0 on local +Z, line 1 on −Z). */
export function ropeRig(g: CrossingGeometry, L: DeckLayout, f: WorldFields): RopeRig {
  const n = lateral(g);
  const at = (s: XZ, inland: number, zo: number) =>
    post(f, s[0] + g.dir[0] * inland + n[0] * zo, s[1] + g.dir[1] * inland + n[1] * zo, g.dir[0] * Math.sign(inland), g.dir[1] * Math.sign(inland));
  return {
    east: [at(g.shoreEast, -POST_BACK, L.ropeZ), at(g.shoreEast, -POST_BACK, -L.ropeZ)],
    west: [at(g.shoreWest, POST_BACK, L.ropeZ), at(g.shoreWest, POST_BACK, -L.ropeZ)],
  };
}
/** 1840s Lombera inset: one post on the Loíza bank, 3 m to the upstream side of the line. */
export function shoreRopePost(g: CrossingGeometry, f: WorldFields): V3 {
  const n = lateral(g), k = upstreamSide(g) * 3;
  return post(f, g.shoreEast[0] - g.dir[0] * POST_BACK + n[0] * k, g.shoreEast[1] - g.dir[1] * POST_BACK + n[1] * k, -g.dir[0], -g.dir[1]);
}
const set3 = (o: V3, x: number, y: number, z: number) => { o[0] = x; o[1] = y; o[2] = z; return o; };
/** Deck-local point where rope `line` crosses the guide roller at `end` (writes into `out`). */
export const guideLocal = (L: DeckLayout, end: 1 | -1, line: 0 | 1, out: V3): V3 => set3(out, end * (L.halfLength - 0.3), L.guideY, (line === 0 ? 1 : -1) * L.ropeZ);
/** 1986: a mooring line leaves the top of the east bitt on `line`'s side (bittXZ, BITT_H — the steel builder puts the bitt there). */
export const mooringLocal = (L: DeckLayout, line: 0 | 1, out: V3): V3 => {
  const [x, z] = bittXZ(L, -1, line === 0 ? 1 : -1);
  return set3(out, x, L.deckY + BITT_H, z);
};
/** 1840: the shore rope ties to the gunwale cleat amidships on `side`. */
export const cleatLocal = (L: DeckLayout, side: 1 | -1, out: V3): V3 => set3(out, 0, L.deckY + 0.5, side * L.halfBeam);
```

```ts
// src/ancon/pole.ts
import * as THREE from 'three';
import { cellRng } from '../vegetation/rng';

/** Mangrove / majagüilla push pole (research §2.3); length inferred from the 1.5–3 m depth (research §1.2). */
export const POLE_LEN = 5.5;
const RADIAL = 8, SEGS = 12, BARK = new THREE.Color(0x6b5a45), GRIP = new THREE.Color(0xa39580);

/** Unit-length pole along −Y (y = 0 top … y = −1 tip/butt) with real radii (0.03 → 0.045 m); scale y by POLE_LEN. */
export function buildPole(seed: number): THREE.BufferGeometry {
  const r = cellRng(seed, 5, 705), crook = Array.from({ length: 5 }, () => [(r() - 0.5) * 0.03, (r() - 0.5) * 0.03]);
  const pos: number[] = [], nrm: number[] = [], col: number[] = [], idx: number[] = [], c = new THREE.Color();
  for (let i = 0; i <= SEGS; i++) {
    const t = i / SEGS, y = -t, rad = 0.03 + 0.015 * t;
    const k = t * 4, k0 = Math.min(3, Math.floor(k)), u = k - k0, s = u * u * (3 - 2 * u);
    const ox = crook[k0][0] + (crook[k0 + 1][0] - crook[k0][0]) * s, oz = crook[k0][1] + (crook[k0 + 1][1] - crook[k0][1]) * s;
    c.copy(y > -0.35 && y < -0.1 ? GRIP : BARK).multiplyScalar(0.92 + 0.16 * r());
    for (let j = 0; j < RADIAL; j++) {
      const a = (j / RADIAL) * Math.PI * 2, nx = Math.cos(a), nz = Math.sin(a);
      pos.push(ox + nx * rad, y, oz + nz * rad); nrm.push(nx, 0, nz); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < SEGS; i++) for (let j = 0; j < RADIAL; j++) {
    const a = i * RADIAL + j, b = i * RADIAL + ((j + 1) % RADIAL), d = a + RADIAL, e = b + RADIAL;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
```

- [ ] **Step 4: `RopeSet`**

```ts
// src/ancon/RopeSet.ts
import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import type { WorldFields } from '../terrain/fields';
import type { CrossingGeometry } from './geometry';
import type { VesselPose } from './pose';
import { cleatLocal, guideLocal, mooringLocal, ropeRig, shoreRopePost, upstreamSide, type RopeRig } from './rigging';
import { spanSag, tubeIndex, writeRopeLine, writeSpan, writeTube, type V3 } from './rope';
import type { DeckLayout, VesselSpec } from './spec';

const ROPE_R = 0.022;
interface Line { mesh: THREE.Mesh; pts: Float32Array; count: number }
const _v = new THREE.Vector3();
const toWorld = (p: V3, m: THREE.Matrix4, out: V3): V3 => { _v.set(p[0], p[1], p[2]).applyMatrix4(m); out[0] = _v.x; out[1] = _v.y; out[2] = _v.z; return out; };

/**
 * Ropes for the era, rebuilt in place every frame: 'haul' (1935–1984, two ropes bank to bank over
 * the deck guides), 'shore' (1840, one slack rope from the Loíza bank to the gunwale), 'moor'
 * (1986, two short lines to the Loíza posts). One draw call per rope + one for the posts.
 */
export class RopeSet {
  readonly group = new THREE.Group();
  private lines: Line[] = [];
  private mode: 'haul' | 'shore' | 'moor' | 'none';
  private rig: RopeRig | null = null;
  private shorePost: V3 | null = null;
  private readonly a: V3 = [0, 0, 0]; private readonly b: V3 = [0, 0, 0];
  private readonly material: THREE.Material;
  private postMaterial: THREE.Material | null = null;
  private readonly local: V3 = [0, 0, 0];
  private readonly shoreSide: 1 | -1;
  private readonly uPx = { value: 0.001 };

  constructor(private o: { spec: VesselSpec; layout: DeckLayout; geom: CrossingGeometry; fields: WorldFields; segments: number; radial: number }) {
    const { spec } = o;
    this.shoreSide = upstreamSide(o.geom);
    this.mode = spec.moored ? 'moor' : spec.propulsion === 'ropes' ? 'haul' : spec.shoreRope ? 'shore' : 'none';
    // Ropes stay at least ~0.6 px wide on screen: grow along the normal with distance (no shimmer at bank range).
    this.material = new CustomShaderMaterial({
      baseMaterial: THREE.MeshStandardMaterial,
      color: spec.kind === 'steelPontoon' ? 0x4a4036 : 0x8a7652, roughness: 0.95,
      uniforms: { uPx: this.uPx, uR: { value: ROPE_R } },
      vertexShader: /* glsl */ `
        uniform float uPx; uniform float uR;
        void main() {
          float d = length((modelViewMatrix * vec4(position, 1.0)).xyz);
          csm_Position = position + normal * max(0.0, 0.6 * uPx * d - uR);
        }`,
    });
    const count = this.mode === 'haul' ? 2 * (o.segments + 1) : this.mode === 'shore' ? 2 * o.segments + 1 : this.mode === 'moor' ? 9 : 0;
    const nLines = this.mode === 'haul' || this.mode === 'moor' ? 2 : this.mode === 'shore' ? 1 : 0;
    for (let i = 0; i < nLines; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * o.radial * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * o.radial * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setIndex(new THREE.BufferAttribute(tubeIndex(count, o.radial), 1));
      const mesh = new THREE.Mesh(g, this.material);
      mesh.frustumCulled = false; mesh.receiveShadow = true;
      this.group.add(mesh);
      this.lines.push({ mesh, pts: new Float32Array(count * 3), count });
    }
    if (this.mode === 'haul' || this.mode === 'moor') this.rig = ropeRig(o.geom, o.layout, o.fields);
    if (this.mode === 'shore') this.shorePost = shoreRopePost(o.geom, o.fields);
    this.addPosts();
  }
  get lineCount() { return this.lines.length; }

  private addPosts() {
    const tops: V3[] = this.rig ? (this.mode === 'moor' ? [...this.rig.east] : [...this.rig.east, ...this.rig.west]) : this.shorePost ? [this.shorePost] : [];
    if (!tops.length) return;
    this.postMaterial = new THREE.MeshStandardMaterial({ color: 0x4f4234, roughness: 0.9 });
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.12, 1.8, 8), this.postMaterial, tops.length);
    const m = new THREE.Matrix4();
    for (let i = 0; i < tops.length; i++) posts.setMatrixAt(i, m.makeTranslation(tops[i][0], tops[i][1] + 0.1 - 0.9, tops[i][2]));   // 1.8 m post, top 0.1 m above the rope eye
    posts.castShadow = true; posts.receiveShadow = true;
    this.group.add(posts);
  }

  /** Rebuild every rope for this pose. `pxScale` = world metres per pixel at 1 m distance (2·tan(fov/2)/viewport height). */
  update(pose: VesselPose, pxScale: number) {
    this.uPx.value = pxScale;
    const { layout: L, segments, radial } = this.o, m = pose.matrix, slack = pose.state.slack;
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i], k = i as 0 | 1;
      if (this.mode === 'haul' && this.rig) {
        const gE = toWorld(guideLocal(L, -1, k, this.local), m, this.a), gW = toWorld(guideLocal(L, 1, k, this.local), m, this.b);
        writeRopeLine(this.rig.east[k], gE, gW, this.rig.west[k], slack, segments, line.pts);
      } else if (this.mode === 'moor' && this.rig) {
        const bitt = toWorld(mooringLocal(L, k, this.local), m, this.a), p = this.rig.east[k];
        writeSpan(bitt, p, spanSag(Math.hypot(p[0] - bitt[0], p[2] - bitt[2]), 0.6), line.count - 1, line.pts, 0);
      } else if (this.shorePost) {
        const cleat = toWorld(cleatLocal(L, this.shoreSide, this.local), m, this.a), p = this.shorePost;
        writeSpan(p, cleat, spanSag(Math.hypot(cleat[0] - p[0], cleat[2] - p[2]), 1), line.count - 1, line.pts, 0);
      }
      const g = line.mesh.geometry;
      writeTube(line.pts, line.count, ROPE_R, radial, g.attributes.position.array as Float32Array, g.attributes.normal.array as Float32Array);
      g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
    }
  }

  dispose() {
    this.group.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    this.material.dispose();
    this.postMaterial?.dispose();
  }
}
```

(The post material is kept and disposed with the ropes. Ropes do not cast shadows: a 4.4 cm rope in a 4096 map over ±140 m is sub-texel and would flicker.)

- [ ] **Step 5: Wire into `<Ancon>`.** Switch `import type * as THREE` to a value import; build `const ropes = useMemo(() => new RopeSet({ spec, layout, geom: ctx.geom, fields: place, segments: q.ancon.ropeSegments, radial: q.ancon.ropeRadial }), [spec, layout, ctx, place, q.ancon.ropeSegments, q.ancon.ropeRadial]);` (posts sit on the same 512 fields as the crossing) with `useEffect(() => () => ropes.dispose(), [ropes])`; the frame callback takes `(state, dt)` and, after the hull transforms, calls `ropes.update(pose, (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / state.size.height)` (`cam = state.camera as THREE.PerspectiveCamera`); render `<primitive object={ropes.group} />` **outside** the hull group (world space; wrap the return in a fragment). Remove the `void q` line. (The full component after Task 8 is shown in Task 8, Step 4.)

- [ ] **Step 6: Visual check** (quality bar: ropes are the signature of the 1935–84 ancón; they must read as two thin, taut, slightly drooping lines catching the golden light, and as slack lines dipping into the water while the ferry waits):
  - `?era=1975&cam=bank&c=90&freeze=1` — two taut ropes from the posts on both banks through the deck guides.
  - `?era=1959&cam=bank&c=5&freeze=1` — docked: the long span sags into the river (the submerged part is hidden by the water surface).
  - `?era=1840&cam=bank&c=90&freeze=1` — one slack shore rope from the Loíza bank to the barge's upstream side.
  - `?era=1986&cam=bank&c=0&freeze=1` — two short mooring lines.

  No rope passes through the deck or hull; ropes appear in the reflection; no shimmer at bank distance. `npm test`, `npm run build`. Commit:

```bash
git add src/ancon
git commit -m "$(cat <<'EOF'
feat(ancon): hauling ropes with sag, bank posts, shore rope, mooring lines, poles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: People — rig, poses, two-bone IK, era clothing, instanced figures

**Files:**
- Create: `src/people/rig.ts` (+ `rig.test.ts`), `src/people/palettes.ts` (+ `palettes.test.ts`), `src/people/geometry.ts` (+ `geometry.test.ts`), `src/people/figureBatch.ts` (+ `figureBatch.test.ts`)

**Interfaces:**
- Consumes: `ClothingStyle` (Task 1); `cellRng` (vegetation/rng.ts).
- Produces:
  - `type V3 = [number, number, number]`; `PARTS` (14 names: `hips torso head upperArmL foreArmL upperArmR foreArmR thighL shinL thighR shinR footL footR skirt`), `type PartName`, `PART_INDEX: Record<PartName, number>`
  - `type PoseKind = 'stand' | 'walk' | 'haul' | 'pole'`; `interface Body { height: number; build: number; dress: boolean }`; `interface PoseInput { kind: PoseKind; phase: number; lean?: number; handL?: V3; handR?: V3 }` (hand targets figure-local; when given they override the FK arm for any kind)
  - `interface FigurePose { parts: Float32Array /* 16 × 14, figure-local, column-major */; handL: V3; handR: V3; headTop: number }`, `createFigurePose()`
  - `interface Proportions`, `proportions(b: Body, out?: Proportions): Proportions`, `segmentMatrix(from: V3, to: V3, rx: number, rz: number, out: THREE.Matrix4): THREE.Matrix4` (maps local (0,0,0) → from, (0,−1,0) → to), `solveTwoBone(root, target, l1, l2, hint, mid, end): boolean`, `poseFigure(body: Body, input: PoseInput, out: FigurePose): FigurePose` (no allocation), `ZERO_MATRIX` (all 16 elements 0 — hides a part or an instance)
  - `type HatKind = 'none' | 'straw' | 'fedora' | 'cap' | 'wrap'`; `interface FigureLook { female: boolean; dress: boolean; height: number; build: number; hat: HatKind; colors: Record<PartName, number>; hatColor: number }`; `SKINS: number[]`; `PALETTES: Record<ClothingStyle, Palette>`; `dressFigure(style: ClothingStyle, seed: number, female: boolean): FigureLook`
  - `type GeoKind = 'hips' | 'torso' | 'head' | 'limb' | 'foot' | 'skirt'`; `PART_GEO: Record<PartName, GeoKind>`; `buildFigureGeometries(): Record<GeoKind, THREE.BufferGeometry>`; `buildHatGeometries(): Record<Exclude<HatKind, 'none'>, THREE.BufferGeometry>` (head units: head radius 1, crown top y = 1.15); `FIGURE_TRI_BUDGET = 720`
  - `PER_KIND: Record<GeoKind, number>` (from `PART_GEO`: limb 8, foot 2, others 1); `class FigureBatch { readonly group: THREE.Group; readonly meshes: Record<GeoKind, THREE.InstancedMesh>; readonly hats: Record<Exclude<HatKind, 'none'>, THREE.InstancedMesh>; constructor(max: number, material: THREE.Material); setLook(i: number, look: FigureLook): void; set(i: number, world: THREE.Matrix4, pose: FigurePose, hat: HatKind): void; hide(i: number): void; commit(): void; dispose(): void }`

Figure frame: origin on the ground between the feet, +Y up, +Z forward (the figure faces +Z), +X = the figure's left. Stylised, faceless (spec §2): a head is an egg, hands end the forearms. Proportions (fractions of height H): hip joint 0.53, thigh 0.245, shin 0.245, foot height 0.04, torso 0.30, neck 0.035, head radius 0.065, upper arm 0.175, forearm (incl. hand) 0.20, shoulder half-width 0.12·build, hip half-width 0.055·build.

- [ ] **Step 1: Failing tests**

```ts
// src/people/rig.test.ts
import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { createFigurePose, PART_INDEX, PARTS, poseFigure, solveTwoBone, type FigurePose, type PartName, type PoseKind, type V3 } from './rig';

const body = { height: 1.7, build: 1, dress: false };
const mat = (p: FigurePose, n: PartName) => new THREE.Matrix4().fromArray(p.parts, PART_INDEX[n] * 16);
const footY = (p: FigurePose) => Math.min(mat(p, 'footL').elements[13], mat(p, 'footR').elements[13]);
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('two-bone IK', () => {
  test('reaches a reachable target, keeps both bone lengths, bends toward the hint', () => {
    const mid: V3 = [0, 0, 0], end: V3 = [0, 0, 0], t: V3 = [0.1, -0.2, 0.35];
    expect(solveTwoBone([0, 0, 0], t, 0.3, 0.34, [0, -1, 0], mid, end)).toBe(true);
    expect(dist(end, t)).toBeLessThan(1e-9);
    expect(dist(mid, [0, 0, 0])).toBeCloseTo(0.3, 9); expect(dist(end, mid)).toBeCloseTo(0.34, 9);
    const m2: V3 = [0, 0, 0], e2: V3 = [0, 0, 0];
    solveTwoBone([0, 0, 0], [0, 0, 0.4], 0.3, 0.3, [0, -1, 0], m2, e2);
    expect(m2[1]).toBeLessThan(0);
  });
  test('stretches straight toward an unreachable target and reports it', () => {
    const mid: V3 = [0, 0, 0], end: V3 = [0, 0, 0];
    expect(solveTwoBone([0, 0, 0], [0, 0, 2], 0.3, 0.3, [0, -1, 0], mid, end)).toBe(false);
    expect(Math.hypot(...end)).toBeCloseTo(0.6, 3); expect(end[2]).toBeGreaterThan(0.59);
  });
});

describe('poseFigure', () => {
  test('a standing figure is its height tall with its feet on the ground', () => {
    const p = poseFigure(body, { kind: 'stand', phase: 0 }, createFigurePose());
    expect(p.headTop).toBeGreaterThan(1.7 * 0.97); expect(p.headTop).toBeLessThan(1.7 * 1.03);
    expect(footY(p)).toBeCloseTo(0, 6);
  });
  test('walking alternates the feet and keeps one on the ground', () => {
    const a = poseFigure(body, { kind: 'walk', phase: 0.25 }, createFigurePose());
    expect(mat(a, 'footL').elements[14]).toBeGreaterThan(mat(a, 'footR').elements[14]);
    const b = poseFigure(body, { kind: 'walk', phase: 0.75 }, createFigurePose());
    expect(mat(b, 'footL').elements[14]).toBeLessThan(mat(b, 'footR').elements[14]);
    for (let ph = 0; ph < 1; ph += 0.05) expect(footY(poseFigure(body, { kind: 'walk', phase: ph }, createFigurePose()))).toBeCloseTo(0, 6);
  });
  test('hand targets are reached (haul, pole) and leaning follows the pose', () => {
    const tL: V3 = [0.15, 1.2, 0.45], tR: V3 = [-0.12, 1.2, 0.45];
    const p = poseFigure(body, { kind: 'haul', phase: 0.3, handL: tL, handR: tR }, createFigurePose());
    expect(dist(p.handL, tL)).toBeLessThan(1e-3); expect(dist(p.handR, tR)).toBeLessThan(1e-3);
    const q = poseFigure(body, { kind: 'pole', phase: 0.3, handL: [0.1, 1.0, 0.6], handR: [0.05, 1.25, 0.4] }, createFigurePose());
    expect(mat(q, 'torso').elements[6]).toBeGreaterThan(0.1);   // torso Y axis tilts forward (+Z)
  });
  test('a dress hides the thighs and shows the skirt; trousers the reverse', () => {
    const d = poseFigure({ ...body, dress: true }, { kind: 'stand', phase: 0 }, createFigurePose());
    expect(mat(d, 'thighL').elements.every((v) => v === 0)).toBe(true);
    expect(mat(d, 'skirt').elements[5]).toBeGreaterThan(0.5);
    const t = poseFigure(body, { kind: 'stand', phase: 0 }, createFigurePose());
    expect(mat(t, 'skirt').elements.every((v) => v === 0)).toBe(true);
  });
  test('finite and deterministic for every kind', () => {
    for (const kind of ['stand', 'walk', 'haul', 'pole'] as PoseKind[]) {
      const a = poseFigure(body, { kind, phase: 0.37 }, createFigurePose()), b = poseFigure(body, { kind, phase: 0.37 }, createFigurePose());
      expect(a.parts.every(Number.isFinite)).toBe(true); expect(Array.from(a.parts)).toEqual(Array.from(b.parts));
      expect(a.parts.length).toBe(16 * PARTS.length);
    }
  });
});
```

```ts
// src/people/palettes.test.ts
import { expect, test } from 'vitest';
import type { ClothingStyle } from '../data/eras';
import { dressFigure, PALETTES, SKINS } from './palettes';

const STYLES: ClothingStyle[] = ['colonial', 'earlyCentury', 'midCentury', 'modern'];
const looks = (style: ClothingStyle, female: boolean) => Array.from({ length: 40 }, (_, i) => dressFigure(style, i, female));

test('deterministic by seed', () => {
  expect(dressFigure('modern', 7, true)).toEqual(dressFigure('modern', 7, true));
});
test('skin from SKINS, clothes from the style palette', () => {
  for (const s of STYLES) for (const f of [false, true]) for (const l of looks(s, f)) {
    expect(SKINS).toContain(l.colors.head);
    const P = PALETTES[s];
    expect([...P.shirts, ...P.dresses]).toContain(l.colors.torso);
    expect(l.height).toBeGreaterThan(f ? 1.5 : 1.6); expect(l.height).toBeLessThan(f ? 1.72 : 1.84);
  }
});
test('hats by period: straw brims early, fedoras mid-century, caps only modern, head wraps on early women', () => {
  const hats = (s: ClothingStyle, f: boolean) => new Set(looks(s, f).map((l) => l.hat));
  expect(hats('colonial', false).has('straw')).toBe(true);
  expect(hats('earlyCentury', true).has('wrap')).toBe(true);
  expect(hats('midCentury', false).has('fedora')).toBe(true);
  expect(hats('modern', false).has('cap')).toBe(true);
  for (const s of ['colonial', 'earlyCentury', 'midCentury'] as const) expect(hats(s, false).has('cap')).toBe(false);
  for (const s of ['colonial', 'earlyCentury', 'modern'] as const) expect(hats(s, false).has('fedora')).toBe(false);
  for (const s of ['midCentury', 'modern'] as const) expect(hats(s, true).has('wrap')).toBe(false);
});
test('women wear dresses before 1950; short sleeves show skin on the forearms', () => {
  for (const s of ['colonial', 'earlyCentury'] as const) for (const l of looks(s, true)) expect(l.dress).toBe(true);
  const modern = looks('modern', false);
  expect(modern.some((l) => l.colors.foreArmL === l.colors.head)).toBe(true);
  for (const l of looks('colonial', false)) expect(l.colors.foreArmL).not.toBe(l.colors.head);
});
test('a varied crowd: at least 4 skin tones over 40 people', () => {
  expect(new Set(looks('modern', false).map((l) => l.colors.head)).size).toBeGreaterThanOrEqual(4);
});
```

```ts
// src/people/geometry.test.ts
import { expect, test } from 'vitest';
import { buildFigureGeometries, buildHatGeometries, FIGURE_TRI_BUDGET, PART_GEO } from './geometry';
import { PARTS } from './rig';

const tris = (g: import('three').BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
test('one figure (all parts + the biggest hat) fits the triangle budget', () => {
  const g = buildFigureGeometries(), h = buildHatGeometries();
  const body = PARTS.reduce((n, p) => n + tris(g[PART_GEO[p]]), 0);
  expect(body + Math.max(...Object.values(h).map(tris))).toBeLessThanOrEqual(FIGURE_TRI_BUDGET);
});
test('limb geometry spans y 0 → −1 (segmentMatrix convention)', () => {
  const g = buildFigureGeometries().limb;
  g.computeBoundingBox();
  expect(g.boundingBox!.max.y).toBeCloseTo(0, 6); expect(g.boundingBox!.min.y).toBeCloseTo(-1, 6);
});
```

```ts
// src/people/figureBatch.test.ts
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { FigureBatch, PER_KIND } from './figureBatch';
import { dressFigure } from './palettes';
import { createFigurePose, PART_INDEX, poseFigure } from './rig';

test('instances = world × part; hats go to their own mesh; hidden figures collapse', () => {
  const batch = new FigureBatch(3, new THREE.MeshStandardMaterial());
  const look = dressFigure('earlyCentury', 1, false), pose = poseFigure({ height: look.height, build: look.build, dress: look.dress }, { kind: 'stand', phase: 0 }, createFigurePose());
  const world = new THREE.Matrix4().makeTranslation(5, 0, -2);
  batch.setLook(0, look); batch.set(0, world, pose, 'straw'); batch.hide(1); batch.commit();
  const m = new THREE.Matrix4(), head = new THREE.Matrix4().fromArray(pose.parts, PART_INDEX.head * 16).premultiply(world);
  const same = (x: THREE.Matrix4) => x.elements.forEach((v, k) => expect(v).toBeCloseTo(head.elements[k], 5)); // float32 storage
  batch.meshes.head.getMatrixAt(0, m); same(m);
  batch.hats.straw.getMatrixAt(0, m); same(m);
  batch.hats.cap.getMatrixAt(0, m); expect(m.elements.every((v) => v === 0)).toBe(true);
  batch.meshes.head.getMatrixAt(1, m); expect(m.elements.every((v) => v === 0)).toBe(true);
  const c = new THREE.Color(); batch.meshes.head.getColorAt(0, c); expect(c.getHex()).toBe(look.colors.head);
});
test('two foot slots per figure: feet never land in another figure slot', () => {
  expect(PER_KIND).toEqual({ hips: 1, torso: 1, head: 1, limb: 8, foot: 2, skirt: 1 });
  const batch = new FigureBatch(2, new THREE.MeshStandardMaterial());
  const look = dressFigure('modern', 3, false), pose = poseFigure({ height: look.height, build: look.build, dress: false }, { kind: 'walk', phase: 0.25 }, createFigurePose());
  batch.hide(0); batch.set(1, new THREE.Matrix4(), pose, 'none');
  const m = new THREE.Matrix4();
  for (const slot of [0, 1]) { batch.meshes.foot.getMatrixAt(slot, m); expect(m.elements.every((v) => v === 0)).toBe(true); }   // figure 0 stays hidden
  batch.meshes.foot.getMatrixAt(3, m);
  const footR = new THREE.Matrix4().fromArray(pose.parts, PART_INDEX.footR * 16);
  m.elements.forEach((v, k) => expect(v).toBeCloseTo(footR.elements[k], 5));
});
```

Run `npx vitest run src/people` → FAIL.

- [ ] **Step 2: `rig.ts`**

```ts
// src/people/rig.ts
import * as THREE from 'three';

export type V3 = [number, number, number];
export const PARTS = ['hips', 'torso', 'head', 'upperArmL', 'foreArmL', 'upperArmR', 'foreArmR',
  'thighL', 'shinL', 'thighR', 'shinR', 'footL', 'footR', 'skirt'] as const;
export type PartName = (typeof PARTS)[number];
export const PART_INDEX = Object.fromEntries(PARTS.map((p, i) => [p, i])) as Record<PartName, number>;
export type PoseKind = 'stand' | 'walk' | 'haul' | 'pole';
export interface Body { height: number; build: number; dress: boolean }
export interface PoseInput { kind: PoseKind; phase: number; lean?: number; handL?: V3; handR?: V3 }
export interface FigurePose { parts: Float32Array; handL: V3; handR: V3; headTop: number }
export const createFigurePose = (): FigurePose => ({ parts: new Float32Array(16 * PARTS.length), handL: [0, 0, 0], handR: [0, 0, 0], headTop: 0 });

export interface Proportions {
  H: number; thigh: number; shin: number; footH: number; footLen: number; footW: number; torso: number; neck: number; headR: number;
  upperArm: number; foreArm: number; shoulderHalf: number; hipHalf: number; rUpperArm: number; rForeArm: number; rThigh: number; rShin: number;
}
/** Segment lengths and radii (m) for a body; writes into `out` (no allocation when one is passed). */
export function proportions(b: Body, out = {} as Proportions): Proportions {
  const H = b.height, w = b.build;
  out.H = H; out.thigh = 0.245 * H; out.shin = 0.245 * H; out.footH = 0.04 * H; out.footLen = 0.15 * H; out.footW = 0.06 * H * w;
  out.torso = 0.3 * H; out.neck = 0.035 * H; out.headR = 0.065 * H; out.upperArm = 0.175 * H; out.foreArm = 0.2 * H;
  out.shoulderHalf = 0.12 * H * w; out.hipHalf = 0.055 * H * w;
  out.rUpperArm = 0.028 * H * w; out.rForeArm = 0.022 * H * w; out.rThigh = 0.045 * H * w; out.rShin = 0.032 * H * w;
  return out;
}

const DOWN = new THREE.Vector3(0, -1, 0), X = new THREE.Vector3(1, 0, 0);
const _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _m = new THREE.Matrix4(), _up = new THREE.Vector3(), _fw = new THREE.Vector3();
/** A matrix with all 16 elements 0 — hides an instance / a part (makeScale(0,0,0) would keep element 15 = 1). */
export const ZERO_MATRIX = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

/** Matrix taking a unit segment geometry (y 0 → −1, radius 1) onto from → to with radii rx, rz. */
export function segmentMatrix(from: V3, to: V3, rx: number, rz: number, out: THREE.Matrix4): THREE.Matrix4 {
  _d.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const len = _d.length();
  if (len < 1e-9) _q.identity(); else _q.setFromUnitVectors(DOWN, _d.multiplyScalar(1 / len));
  return out.compose(_p.set(from[0], from[1], from[2]), _q, _s.set(rx, Math.max(len, 1e-6), rz));
}

/** Analytic two-bone IK. Writes the middle joint and the end effector; returns false if the target was out of reach (end stretches toward it). */
export function solveTwoBone(root: V3, target: V3, l1: number, l2: number, hint: V3, mid: V3, end: V3): boolean {
  let dx = target[0] - root[0], dy = target[1] - root[1], dz = target[2] - root[2];
  const dist = Math.hypot(dx, dy, dz), lo = Math.abs(l1 - l2) + 1e-6, hi = l1 + l2 - 1e-6;
  const reached = dist >= lo && dist <= hi;
  if (dist < 1e-9) { dx = 0; dy = -1; dz = 0; } else { dx /= dist; dy /= dist; dz /= dist; }
  const D = Math.min(hi, Math.max(lo, dist));
  const cosA = Math.min(1, Math.max(-1, (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D))), sinA = Math.sqrt(1 - cosA * cosA);
  const hd = hint[0] * dx + hint[1] * dy + hint[2] * dz;
  let hx = hint[0] - dx * hd, hy = hint[1] - dy * hd, hz = hint[2] - dz * hd, hl = Math.hypot(hx, hy, hz);
  if (hl < 1e-9) { hx = -dy; hy = dx; hz = 0; hl = Math.hypot(hx, hy); if (hl < 1e-9) { hx = 1; hy = 0; hl = 1; } }
  hx /= hl; hy /= hl; hz /= hl;
  mid[0] = root[0] + dx * l1 * cosA + hx * l1 * sinA;
  mid[1] = root[1] + dy * l1 * cosA + hy * l1 * sinA;
  mid[2] = root[2] + dz * l1 * cosA + hz * l1 * sinA;
  if (reached) { end[0] = target[0]; end[1] = target[1]; end[2] = target[2]; }
  else { end[0] = root[0] + dx * D; end[1] = root[1] + dy * D; end[2] = root[2] + dz * D; }
  return reached;
}

const TAU = Math.PI * 2, SIDES = [1, -1] as const, _P = {} as Proportions;
const hip: V3 = [0, 0, 0], knee: V3 = [0, 0, 0], ankle: V3 = [0, 0, 0], sh: V3 = [0, 0, 0], el: V3 = [0, 0, 0], hint: V3 = [0, 0, 0];

/** Figure-local part matrices for a pose (see PARTS). Legs are FK with the longer leg on the ground; arms are FK or IK to hand targets. */
function put(out: FigurePose, n: PartName, m: THREE.Matrix4) { m.toArray(out.parts, PART_INDEX[n] * 16); }
/** Vertical extent of a leg (thigh swing sw, knee bend k). */
function legExt(P: Proportions, sw: number, k: number) { return P.thigh * Math.cos(sw) + P.shin * Math.cos(sw - k); }

export function poseFigure(body: Body, input: PoseInput, out: FigurePose): FigurePose {
  const P = proportions(body, _P), H = P.H, c = Math.sin(TAU * input.phase);
  let swingL = 0.04, swingR = -0.03, kneeL = 0.05, kneeR = 0.05, sway = 0, armSwing = 0, lean = input.lean ?? 0.03;
  switch (input.kind) {
    case 'stand': sway = 0.007 * H * c; break;
    case 'walk': case 'pole':
      swingL = 0.42 * c; swingR = -0.42 * c;
      kneeL = 0.1 + 0.6 * Math.max(0, Math.sin(TAU * input.phase + 1.9));
      kneeR = 0.1 + 0.6 * Math.max(0, Math.sin(TAU * input.phase + 1.9 + Math.PI));
      armSwing = -0.35 * c;
      if (input.kind === 'pole') lean = input.lean ?? 0.45;
      break;
    case 'haul':
      swingL = 0.35; kneeL = 0.3; swingR = -0.25; kneeR = 0.12;
      lean = input.lean ?? -0.12 - 0.08 * c;
      break;
  }
  const hipH = Math.max(legExt(P, swingL, kneeL), legExt(P, swingR, kneeR)) + P.footH;
  for (const s of SIDES) {
    const sw = s > 0 ? swingL : swingR, k = s > 0 ? kneeL : kneeR;
    hip[0] = s * P.hipHalf + sway; hip[1] = hipH; hip[2] = 0;
    knee[0] = hip[0]; knee[1] = hipH - P.thigh * Math.cos(sw); knee[2] = P.thigh * Math.sin(sw);
    ankle[0] = hip[0]; ankle[1] = knee[1] - P.shin * Math.cos(sw - k); ankle[2] = knee[2] + P.shin * Math.sin(sw - k);
    put(out, s > 0 ? 'thighL' : 'thighR', body.dress ? ZERO_MATRIX : segmentMatrix(hip, knee, P.rThigh, P.rThigh, _m));
    put(out, s > 0 ? 'shinL' : 'shinR', segmentMatrix(knee, ankle, P.rShin, P.rShin, _m));
    put(out, s > 0 ? 'footL' : 'footR', _m.makeScale(P.footW, P.footH, P.footLen).setPosition(ankle[0], ankle[1] - P.footH, ankle[2]));
  }
  // Pelvis and torso (lean = rotation about X; + bends forward).
  _up.set(0, Math.cos(lean), Math.sin(lean)); _fw.set(0, -Math.sin(lean), Math.cos(lean));
  put(out, 'torso', _m.makeBasis(X, _up, _fw).scale(_s.set(P.shoulderHalf, P.torso, P.shoulderHalf)).setPosition(sway, hipH, 0));
  put(out, 'hips', _m.makeScale(P.hipHalf * 1.7, 0.07 * H, 0.09 * H).setPosition(sway, hipH, 0));
  put(out, 'skirt', body.dress ? _m.makeScale(P.hipHalf * 2.4, hipH - 0.08 * H, P.hipHalf * 2.4).setPosition(sway, hipH + 0.02 * H, 0) : ZERO_MATRIX);
  const hx = sway, hy = hipH + _up.y * (P.torso + P.neck) + P.headR * 1.1, hz = _up.z * (P.torso + P.neck);
  _q.setFromAxisAngle(X, lean * 0.3);
  put(out, 'head', _m.compose(_p.set(hx, hy, hz), _q, _s.set(P.headR, P.headR, P.headR)));
  out.headTop = hy + P.headR * 1.15;
  // Arms.
  for (const s of SIDES) {
    const ts = P.torso - 0.03 * H;
    sh[0] = sway + s * P.shoulderHalf * 0.92; sh[1] = hipH + _up.y * ts; sh[2] = _up.z * ts;
    const target = s > 0 ? input.handL : input.handR, hand = s > 0 ? out.handL : out.handR;
    if (target) { hint[0] = s * 0.4; hint[1] = -1; hint[2] = -0.5; solveTwoBone(sh, target, P.upperArm, P.foreArm, hint, el, hand); }
    else {
      const a = s > 0 ? armSwing : -armSwing, b = a + 0.25;
      el[0] = sh[0] + s * P.upperArm * 0.08; el[1] = sh[1] - P.upperArm * Math.cos(a); el[2] = sh[2] + P.upperArm * Math.sin(a);
      hand[0] = el[0] + s * P.foreArm * 0.05; hand[1] = el[1] - P.foreArm * Math.cos(b); hand[2] = el[2] + P.foreArm * Math.sin(b);
    }
    put(out, s > 0 ? 'upperArmL' : 'upperArmR', segmentMatrix(sh, el, P.rUpperArm, P.rUpperArm, _m));
    put(out, s > 0 ? 'foreArmL' : 'foreArmR', segmentMatrix(el, hand, P.rForeArm, P.rForeArm, _m));
  }
  return out;
}
```

- [ ] **Step 3: `palettes.ts`** (research §7, all inferred general Puerto Rican dress by period; Loíza is ~64 % Afro-descendant [S12], so the skin range leans dark):

```ts
// src/people/palettes.ts
import type { ClothingStyle } from '../data/eras';
import { cellRng } from '../vegetation/rng';
import type { PartName } from './rig';

export type HatKind = 'none' | 'straw' | 'fedora' | 'cap' | 'wrap';
export interface FigureLook { female: boolean; dress: boolean; height: number; build: number; hat: HatKind; hatColor: number; colors: Record<PartName, number> }
export interface Palette {
  shirts: number[]; trousers: number[]; dresses: number[]; shoes: number[];
  menHats: [HatKind, number][]; womenHats: [HatKind, number][]; hatColors: Partial<Record<HatKind, number[]>>;
  /** Probabilities. */
  shortSleeves: number; barefoot: number; womenDress: number;
}
export const SKINS = [0x3a2317, 0x4b2d1e, 0x5d3a27, 0x6e4631, 0x80563b, 0x93674a, 0xa87c5a];
export const PALETTES: Record<ClothingStyle, Palette> = {
  // 1820s–1890s: undyed/white cotton, straw brims, many barefoot; women in long dresses with head wraps.
  colonial: { shirts: [0xe9e2d0, 0xdcd2bb, 0xcbbfa4], trousers: [0xd9d0bc, 0xbcae92, 0x8e7d63], dresses: [0xe8dfcf, 0xcdb99c, 0xa06d50, 0x6f7f96],
    shoes: [0x3b2a1e], menHats: [['straw', 0.8], ['none', 0.2]], womenHats: [['wrap', 0.85], ['none', 0.15]],
    hatColors: { straw: [0xd6bd86, 0xc9ae74], wrap: [0xe9e2d0, 0xb3402c, 0x2f4b7a, 0xd8a33c] }, shortSleeves: 0, barefoot: 0.7, womenDress: 1 },
  // 1900s–1930s: white/light cotton shirts and trousers, straw brims; long cotton dresses, head wraps.
  earlyCentury: { shirts: [0xefe9dc, 0xe2dccd, 0xd4dbe0, 0xcfc4ad], trousers: [0xe6e0d2, 0xc9bda4, 0x5b5a55, 0x8b7b62], dresses: [0xeee7da, 0xd9c7a8, 0x9fb3c8, 0xb07a5c],
    shoes: [0x2e2219, 0x4a3526], menHats: [['straw', 0.75], ['none', 0.25]], womenHats: [['wrap', 0.6], ['none', 0.4]],
    hatColors: { straw: [0xdcc48c, 0xcdb27a], wrap: [0xf0ebe0, 0xb3402c, 0x2f4b7a] }, shortSleeves: 0.15, barefoot: 0.3, womenDress: 1 },
  // 1940s–50s: guayaberas, fedoras; knee-length print dresses.
  midCentury: { shirts: [0xf1ecdf, 0xd9e3ea, 0xefe2b5, 0xe8d6c4], trousers: [0x3c3b38, 0x5a5146, 0x2f3542, 0x9a8f7c], dresses: [0xc5523f, 0x3f6f8f, 0xe0b54a, 0x6c8f5a, 0xe9e0d0],
    shoes: [0x241a14, 0x4a3526, 0xd9d2c4], menHats: [['fedora', 0.45], ['straw', 0.2], ['none', 0.35]], womenHats: [['none', 1]],
    hatColors: { fedora: [0x6b5d4c, 0x3d3a36, 0xd8c79f], straw: [0xd6bd86] }, shortSleeves: 0.6, barefoot: 0, womenDress: 0.9 },
  // 1970s–80s: flared jeans, printed shirts, sneakers, baseball caps.
  modern: { shirts: [0xc8553d, 0xf2a541, 0x4b8f8c, 0x7d4e9e, 0xe9e2d0, 0x2d6a4f, 0xd8d3c8, 0x1f3b5c], trousers: [0x3d5a80, 0x2f4466, 0x51606e, 0x8a6d4b, 0x2b2b2b],
    dresses: [0xd1495b, 0xedae49, 0x00798c, 0x30638e, 0xf4f1de], shoes: [0xf0eee8, 0x2b2b2b, 0x8b5e3c],
    menHats: [['cap', 0.4], ['none', 0.6]], womenHats: [['none', 1]], hatColors: { cap: [0xb33a3a, 0x2f4466, 0xe9e2d0, 0x2d6a4f] },
    shortSleeves: 0.85, barefoot: 0.05, womenDress: 0.4 },
};

/** A deterministic period outfit for one person. */
export function dressFigure(style: ClothingStyle, seed: number, female: boolean): FigureLook {
  const r = cellRng(seed, 17, 604), P = PALETTES[style];
  const pick = <T>(a: T[]) => a[Math.min(a.length - 1, Math.floor(r() * a.length))];
  const weighted = (a: [HatKind, number][]) => { let x = r(); for (const [k, w] of a) { if ((x -= w) < 0) return k; } return a[a.length - 1][0]; };
  const skin = pick(SKINS), dress = female && r() < P.womenDress;
  const top = dress ? pick(P.dresses) : pick(P.shirts), lower = dress ? top : pick(P.trousers);
  const sleeve = r() < P.shortSleeves ? skin : top, feet = r() < P.barefoot ? skin : pick(P.shoes);
  const hat = weighted(female ? P.womenHats : P.menHats);
  return {
    female, dress, hat, hatColor: hat === 'none' ? 0 : pick(P.hatColors[hat] ?? [0xd6bd86]),
    height: female ? 1.52 + 0.18 * r() : 1.62 + 0.2 * r(), build: 0.92 + 0.18 * r(),
    colors: {
      head: skin, torso: top, hips: lower, skirt: lower, upperArmL: top, upperArmR: top, foreArmL: sleeve, foreArmR: sleeve,
      thighL: lower, thighR: lower, shinL: dress ? skin : lower, shinR: dress ? skin : lower, footL: feet, footR: feet,
    },
  };
}
```

- [ ] **Step 4: `geometry.ts` and `figureBatch.ts`**

```ts
// src/people/geometry.ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HatKind } from './palettes';
import type { PartName } from './rig';

export type GeoKind = 'hips' | 'torso' | 'head' | 'limb' | 'foot' | 'skirt';
export const PART_GEO: Record<PartName, GeoKind> = {
  hips: 'hips', torso: 'torso', head: 'head', upperArmL: 'limb', foreArmL: 'limb', upperArmR: 'limb', foreArmR: 'limb',
  thighL: 'limb', shinL: 'limb', thighR: 'limb', shinR: 'limb', footL: 'foot', footR: 'foot', skirt: 'skirt',
};
export const FIGURE_TRI_BUDGET = 720;
const clean = (g: THREE.BufferGeometry) => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };

/** Unit body-part geometries (see poseFigure for how each is scaled). */
export function buildFigureGeometries(): Record<GeoKind, THREE.BufferGeometry> {
  return {
    limb: clean(new THREE.CylinderGeometry(1, 0.8, 1, 7, 1).translate(0, -0.5, 0)),
    torso: clean(new THREE.LatheGeometry([0.8, 0.85, 1.0, 0.95, 0.5].map((x, i) => new THREE.Vector2(x, [0, 0.3, 0.75, 0.95, 1][i])), 10).scale(1, 1, 0.62)),
    head: clean(new THREE.IcosahedronGeometry(1, 1).scale(1, 1.15, 1)),
    hips: clean(new THREE.SphereGeometry(1, 8, 6)),
    foot: clean(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0.25)),
    skirt: clean(new THREE.CylinderGeometry(0.55, 1, 1, 12, 1, true).translate(0, -0.5, 0)),
  };
}

/** Hats in head units (head radius 1, crown top at y = 1.15). */
export function buildHatGeometries(): Record<Exclude<HatKind, 'none'>, THREE.BufferGeometry> {
  const m = (...g: THREE.BufferGeometry[]) => mergeGeometries(g.map((x) => clean(x.index ? x.toNonIndexed() : x)))!;
  return {
    straw: m(new THREE.CylinderGeometry(1.9, 1.9, 0.06, 18).translate(0, 0.75, 0), new THREE.CylinderGeometry(0.95, 1.05, 0.55, 14, 1).translate(0, 1.05, 0)),
    fedora: m(new THREE.CylinderGeometry(1.45, 1.45, 0.05, 16).translate(0, 0.8, 0), new THREE.CylinderGeometry(0.85, 1.0, 0.6, 12, 1).scale(1, 1, 0.85).translate(0, 1.1, 0)),
    cap: m(new THREE.SphereGeometry(1.06, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.35, 0), new THREE.BoxGeometry(1.0, 0.05, 0.8).translate(0, 0.5, 1.2)),
    wrap: m(new THREE.SphereGeometry(1.1, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 0.9, 1.05).translate(0, 0.25, 0), new THREE.SphereGeometry(0.35, 6, 4).translate(0, 1.05, -0.6)),
  };
}
```

`FigureBatch` — slots per geometry kind come from `PART_GEO` (two foot slots per figure, preflight F9); hidden slots are written with `ZERO_MATRIX` (all 16 elements 0, preflight F4):

```ts
// src/people/figureBatch.ts
import * as THREE from 'three';
import { buildFigureGeometries, buildHatGeometries, PART_GEO, type GeoKind } from './geometry';
import type { FigureLook, HatKind } from './palettes';
import { PART_INDEX, PARTS, ZERO_MATRIX, type FigurePose } from './rig';

type Hat = Exclude<HatKind, 'none'>;
const GEO_KINDS: GeoKind[] = ['hips', 'torso', 'head', 'limb', 'foot', 'skirt'];
const HATS: Hat[] = ['straw', 'fedora', 'cap', 'wrap'];
/** Parts per figure of each geometry kind, counted from PART_GEO (limb 8, foot 2, the rest 1). */
export const PER_KIND = GEO_KINDS.reduce((o, k) => { o[k] = PARTS.filter((p) => PART_GEO[p] === k).length; return o; }, {} as Record<GeoKind, number>);
/** Rank of each part among the parts of its kind (PARTS order): slot = figure · PER_KIND[kind] + rank. */
const RANK = PARTS.map((p, i) => PARTS.slice(0, i).filter((q) => PART_GEO[q] === PART_GEO[p]).length);
let geoCache: { body: Record<GeoKind, THREE.BufferGeometry>; hats: Record<Hat, THREE.BufferGeometry> } | null = null;
const _m = new THREE.Matrix4(), _c = new THREE.Color();

/** Up to `max` stylised figures, drawn as one InstancedMesh per body-part geometry and per hat kind (≈ 10 draw calls). */
export class FigureBatch {
  readonly group = new THREE.Group();
  readonly meshes: Record<GeoKind, THREE.InstancedMesh>;
  readonly hats: Record<Hat, THREE.InstancedMesh>;
  private looksDirty = false;

  constructor(readonly max: number, material: THREE.Material) {
    geoCache ??= { body: buildFigureGeometries(), hats: buildHatGeometries() };
    const make = (g: THREE.BufferGeometry, n: number) => {
      const m = new THREE.InstancedMesh(g, material, n);
      m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
      for (let i = 0; i < n; i++) { m.setMatrixAt(i, ZERO_MATRIX); m.setColorAt(i, _c.set(0xffffff)); }
      this.group.add(m);
      return m;
    };
    this.meshes = {} as Record<GeoKind, THREE.InstancedMesh>;
    for (const k of GEO_KINDS) this.meshes[k] = make(geoCache.body[k], max * PER_KIND[k]);
    this.hats = {} as Record<Hat, THREE.InstancedMesh>;
    for (const h of HATS) this.hats[h] = make(geoCache.hats[h], max);
  }

  setLook(i: number, look: FigureLook) {
    for (let p = 0; p < PARTS.length; p++) {
      const k = PART_GEO[PARTS[p]];
      this.meshes[k].setColorAt(i * PER_KIND[k] + RANK[p], _c.set(look.colors[PARTS[p]]));
    }
    if (look.hat !== 'none') this.hats[look.hat].setColorAt(i, _c.set(look.hatColor));
    this.looksDirty = true;
  }

  /** Figure i at `world` (figure → world) in `pose`, wearing `hat`. */
  set(i: number, world: THREE.Matrix4, pose: FigurePose, hat: HatKind) {
    for (let p = 0; p < PARTS.length; p++) {
      const k = PART_GEO[PARTS[p]];
      this.meshes[k].setMatrixAt(i * PER_KIND[k] + RANK[p], _m.fromArray(pose.parts, p * 16).premultiply(world));
    }
    _m.fromArray(pose.parts, PART_INDEX.head * 16).premultiply(world);
    for (const h of HATS) this.hats[h].setMatrixAt(i, h === hat ? _m : ZERO_MATRIX);
  }

  hide(i: number) {
    for (const k of GEO_KINDS) for (let r = 0; r < PER_KIND[k]; r++) this.meshes[k].setMatrixAt(i * PER_KIND[k] + r, ZERO_MATRIX);
    for (const h of HATS) this.hats[h].setMatrixAt(i, ZERO_MATRIX);
  }

  commit() {
    for (const k of GEO_KINDS) this.meshes[k].instanceMatrix.needsUpdate = true;
    for (const h of HATS) this.hats[h].instanceMatrix.needsUpdate = true;
    if (this.looksDirty) {
      for (const k of GEO_KINDS) this.meshes[k].instanceColor!.needsUpdate = true;
      for (const h of HATS) this.hats[h].instanceColor!.needsUpdate = true;
      this.looksDirty = false;
    }
  }

  /** Disposes the instance buffers; the shared part geometries stay cached for the app's life. */
  dispose() { for (const m of [...Object.values(this.meshes), ...Object.values(this.hats)]) m.dispose(); }
}
```

- [ ] **Step 5: Visual check (standalone).** Temporarily mount a `FigureBatch` with 8 figures in `World.tsx` on the Loíza bank (x ≈ landing + 6 m), two of each pose (`stand`, `walk` phase 0.25, `haul` with hand targets 0.4 m ahead at 1 m height, `pole` with targets along a 30° pole line), styles cycling through the four palettes. Shot at `?cam=bank` golden hour and a close orbit (`?debug=1`, orbit in the browser pane). Acceptance: faceless stylised silhouettes that read clearly as people at 10–40 m — correct proportions, grounded feet, readable hats and period clothing colours; the haul and pole poses read as effort (lean, braced legs); backlit figures keep their silhouette against the water. Remove the temporary mount. `npm test`, `npm run build`. Commit:

```bash
git add src/people
git commit -m "$(cat <<'EOF'
feat(people): stylised figures — rig, IK poses, era clothing, instanced batch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Crew and passengers — who stands where, and what they do in each phase

**Files:**
- Create: `src/ancon/crew.ts` (+ `crew.test.ts`), `src/ancon/CrewSet.ts` (+ `CrewSet.test.ts`)
- Modify: `src/ancon/Ancon.tsx`

**Interfaces:**
- Consumes: `CrossingState`, `CROSSING_TIMINGS`, `legDuration` (Task 2); `clamp01`, `fract`, `lerp`, `lerpAngle`, `smooth` (ease.ts); `SeatAnchor`, `seatAnchors`, `haulerStationX`, `haulerZ` (Task 2); `ctxFor` (testing.ts); `VesselPose` (Task 2); `DeckLayout`, `VesselSpec` (Task 1); `POLE_LEN`, `buildPole` (Task 5); `dressFigure`, `FigureLook` (Task 6); `PoseInput`, `V3`, `Body`, `poseFigure`, `createFigurePose`, `segmentMatrix` (Task 6); `FigureBatch` (Task 6); `hash3`.
- Produces:
  - `type Role = 'hauler' | 'poler' | 'helmsman' | 'passenger'`; `interface Actor { role: Role; index: number; look: FigureLook; spot: SeatAnchor | null }`
  - `interface ActorFrame { visible: boolean; pos: V3; yaw: number; pose: PoseInput; handL: V3; handR: V3; hasPole: boolean; poleTop: V3; poleTip: V3 }` (deck-local; hand targets figure-local), `createActorFrame()`, `interface ActorCtx { spec: VesselSpec; layout: DeckLayout }`
  - `castActors(spec: VesselSpec, seats: SeatAnchor[], eraSeed: number, passengerScale?: number): Actor[]`
  - `actorFrame(a: Actor, st: CrossingState, clock: number, ctx: ActorCtx, out: ActorFrame): ActorFrame` (pure)
  - constants `HAUL_HZ = 0.5`, `STROKE_S = 7`, `PUSH = 0.65`, `POLE_BED = 2.1`, `STEER_DEPTH = 0.5`, `WALK_SPEED = 1.4`, `STRIDE = 1.1`, `TURN_S = 0.8`, `MOVE_END`; helpers `faceDir(dx, dz)`, `toFigure(p, pos, yaw, out)`
  - `class CrewSet { readonly group: THREE.Group; constructor(actors: Actor[]); update(pose: VesselPose, ctx: ActorCtx): void; poleCount: number; dispose(): void }`

Choreography (spec §13, research §2.3):
- **Rope haulers** (1935–1984): one or two per rope line at `haulerStationX(k, perSide, L, side)`, `haulerZ` = 0.35 m inboard of the rope — never inside a car slot (on the one-car 1935 deck they stand at the ends, x = ±2.65; preflight F20); while hauling they face the direction of travel and pull hand over hand (each hand reaches 0.4 m ahead on the rope, grips, pulls back to 0.2 m behind; the hands alternate); while docked they stand facing the centreline. In 1984 hauler 0 is María Luisa Cortijo, the anconera.
- **Polers** (≤ 1925): walk the side lane (|z| = halfBeam − 0.45). A 7 s stroke: plant the pole ahead, then walk aft facing aft, leaning into it, the pole biting the bed `POLE_BED` m down outside the hull (65 %); then walk forward carrying the pole raised (35 %). Idle holding the pole upright while loading; during unloading they carry it to the next leg's first stroke position.
- **Helmsman** (≤ 1925): at the trailing end, facing the side, a steering pole trailing in the water as a rudder, sweeping slowly; during unloading he waits until the passengers have gone ashore, then walks the centre line to the other end (the next leg's trailing end), finishing 0.5 s before the leg ends (preflight F25).
- **Passengers**: during `load` they walk on from the departure end to their standing spot (staggered), along a lane 0.6 m off the centre line (clear of the helmsman), stand through the crossing, and during `unload` walk off at the arrival end the same way (they vanish at the deck edge — landings/banks come in Phase 4). Standing spots keep ≥ 0.75 m from the helmsman's end positions (seats.ts).
- Nothing teleports: feet move < 0.3 m and heading < 0.8 rad per 0.1 s, across phases and legs (test).

- [ ] **Step 1: Failing tests**

```ts
// src/ancon/crew.test.ts
import { describe, expect, test } from 'vitest';
import { ERAS, getEra, type EraId } from '../data/eras';
import type { V3 } from '../people/rig';
import { createCrossingState, CROSSING_TIMINGS as T, crossingState, legDuration } from './crossing';
import { actorFrame, castActors, createActorFrame, POLE_BED, PUSH, STROKE_S, TURN_S, type Actor, type ActorFrame } from './crew';
import { POLE_LEN } from './pole';
import { seatAnchors } from './seats';
import { deckLayout, vesselSpec } from './spec';

const L = legDuration(), MID = T.load + T.castOff + T.cross / 2;
const setup = (id: EraId, scale = 1) => {
  const spec = vesselSpec(getEra(id)), layout = deckLayout(spec);
  return { spec, layout, actors: castActors(spec, seatAnchors(spec, layout), Number(id), scale) };
};
type Setup = ReturnType<typeof setup>;
const frame = (s: Setup, a: Actor, c: number) => actorFrame(a, crossingState(c, createCrossingState()), c, s, createActorFrame());
const toDeck = (p: V3, f: ActorFrame): V3 => {
  const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
  return [f.pos[0] + p[0] * c + p[2] * s, f.pos[1] + p[1], f.pos[2] - p[0] * s + p[2] * c];
};
const wrap = (a: number) => Math.abs(((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI);

describe('cast', () => {
  test('roles per era', () => {
    const n = (id: EraId, role: string) => setup(id).actors.filter((a) => a.role === role).length;
    expect([n('1925', 'poler'), n('1925', 'helmsman')]).toEqual([1, 1]);
    expect([n('1840', 'poler'), n('1840', 'helmsman')]).toEqual([2, 1]);
    expect(n('1975', 'hauler')).toBe(3); expect(n('1975', 'passenger')).toBe(7);
    expect(setup('1986').actors).toEqual([]);
    expect(setup('1984').actors.find((a) => a.role === 'hauler' && a.index === 0)!.look.female).toBe(true);
    expect(setup('1975', 0.5).actors.filter((a) => a.role === 'passenger').length).toBe(4);
  });
});

describe('choreography', () => {
  test('haulers keep both hands on the rope line while hauling', () => {
    for (const id of ['1935', '1975', '1984'] as EraId[]) {
      const s = setup(id);
      for (const a of s.actors.filter((x) => x.role === 'hauler')) for (let c = MID; c < MID + 4; c += 0.37) {
        const f = frame(s, a, c);
        expect(f.pose.kind).toBe('haul');
        for (const h of [f.handL, f.handR]) {
          const d = toDeck(h, f);
          expect(Math.abs(Math.abs(d[2]) - s.layout.ropeZ)).toBeLessThan(1e-9);
          expect(d[1] - s.layout.guideY).toBeGreaterThanOrEqual(-1e-9);
          expect(d[1] - s.layout.guideY).toBeLessThan(0.09);
          expect(Math.abs(d[0] - f.pos[0])).toBeLessThanOrEqual(0.41);
        }
      }
    }
  });
  test('polers push with the pole biting the bed outside the hull, and lift it to recover', () => {
    for (const id of ['1840', '1925'] as EraId[]) {
      const s = setup(id);
      let pushes = 0, recoveries = 0;
      for (const a of s.actors.filter((x) => x.role === 'poler')) for (let c = MID; c < MID + 14; c += 0.25) {
        const f = frame(s, a, c), psi = (((c - T.load) / STROKE_S + a.index * 0.5) % 1 + 1) % 1, blend = TURN_S / STROKE_S + 0.01;
        expect(Math.hypot(f.poleTop[0] - f.poleTip[0], f.poleTop[1] - f.poleTip[1], f.poleTop[2] - f.poleTip[2])).toBeCloseTo(POLE_LEN, 6);
        if (psi > blend && psi < PUSH) {
          pushes++;
          expect(f.poleTip[1]).toBeCloseTo(-POLE_BED, 6);
          expect(Math.abs(f.poleTip[2])).toBeGreaterThan(s.layout.halfBeam);
        } else if (psi > PUSH + blend) { recoveries++; expect(f.poleTip[1]).toBeGreaterThan(0); }
      }
      expect(pushes).toBeGreaterThan(10); expect(recoveries).toBeGreaterThan(3);
    }
  });
  test('the helmsman steers from the trailing end, his pole in the water', () => {
    const s = setup('1925'), a = s.actors.find((x) => x.role === 'helmsman')!;
    for (const c of [MID, L + MID]) {
      const f = frame(s, a, c), st = crossingState(c, createCrossingState());
      expect(Math.sign(f.pos[0])).toBe(-st.travel);
      expect(f.poleTip[1]).toBeLessThan(0);
    }
  });
  test('passengers board during load, stand through the crossing, leave during unload', () => {
    for (const e of ERAS) {
      const s = setup(e.id);
      for (const a of s.actors.filter((x) => x.role === 'passenger')) {
        expect(frame(s, a, 0.5).visible).toBe(false);
        const standing = frame(s, a, T.load - 0.01);
        expect(standing.visible, `${e.id} p${a.index} aboard by cast-off`).toBe(true);
        expect(standing.pose.kind).toBe('stand');
        expect(standing.pos[0]).toBeCloseTo(a.spot!.pos[0], 9); expect(standing.pos[2]).toBeCloseTo(a.spot!.pos[2], 9);
        expect(frame(s, a, MID).pos).toEqual(standing.pos);
        expect(frame(s, a, L - 0.01).visible, `${e.id} p${a.index} ashore by the end of unload`).toBe(false);
      }
    }
  });
  test('everyone stays on the deck; feet and heading move continuously over a round trip', () => {
    for (const e of ERAS) {
      const s = setup(e.id);
      for (const a of s.actors) {
        let prev: ActorFrame | null = null;
        for (let c = 0; c <= 2 * L; c += 0.1) {
          const f = frame(s, a, c), tag = `${e.id} ${a.role}${a.index} @${c.toFixed(1)}`;
          if (f.visible) {
            expect(Math.abs(f.pos[0]), tag).toBeLessThanOrEqual(s.layout.halfLength + 1e-9);
            expect(Math.abs(f.pos[2]), tag).toBeLessThanOrEqual(s.layout.halfBeam + 1e-9);
            if (prev?.visible) {
              expect(Math.hypot(f.pos[0] - prev.pos[0], f.pos[2] - prev.pos[2]), tag).toBeLessThan(0.3);
              expect(wrap(f.yaw - prev.yaw), tag).toBeLessThan(0.8);
            }
          }
          prev = f;
        }
      }
    }
  });
  test('deterministic', () => {
    const s = setup('1975');
    for (const a of s.actors) expect(frame(s, a, 123.45)).toEqual(frame(s, a, 123.45));
  });
  test('the helmsman crosses the deck only after the passengers have left (unload)', () => {
    for (const id of ['1840', '1900', '1925'] as EraId[]) {
      const s = setup(id), helm = s.actors.find((x) => x.role === 'helmsman')!, pax = s.actors.filter((x) => x.role === 'passenger');
      for (let c = T.load + T.castOff + T.cross + T.dock; c < L; c += 0.1) {
        const h = frame(s, helm, c);
        for (const p of pax) {
          const f = frame(s, p, c);
          if (f.visible) expect(Math.hypot(f.pos[0] - h.pos[0], f.pos[2] - h.pos[2]), `${id} @${c.toFixed(1)}`).toBeGreaterThan(0.6);
        }
      }
    }
  });
});
```

```ts
// src/ancon/CrewSet.test.ts
import type * as THREE from 'three';
import { expect, test } from 'vitest';
import type { EraId } from '../data/eras';
import { castActors } from './crew';
import { CrewSet } from './CrewSet';
import { computeVesselPose, createVesselPose } from './pose';
import { seatAnchors } from './seats';
import { ctxFor } from './testing';

test.each([['1925', 2], ['1935', 0], ['1840', 3]] as [EraId, number][])('%s: one pole per poler/helmsman, all matrices finite', (id, poles) => {
  const ctx = ctxFor(id), set = new CrewSet(castActors(ctx.spec, seatAnchors(ctx.spec, ctx.layout), 1));
  set.update(computeVesselPose(90, ctx, createVesselPose()), ctx);
  expect(set.poleCount).toBe(poles);
  set.group.traverse((o) => {
    if ((o as THREE.InstancedMesh).isInstancedMesh) expect(Array.from((o as THREE.InstancedMesh).instanceMatrix.array).every(Number.isFinite)).toBe(true);
  });
});
```

Run `npx vitest run src/ancon/crew.test.ts src/ancon/CrewSet.test.ts` → FAIL.

- [ ] **Step 2: `crew.ts`**

```ts
// src/ancon/crew.ts
import { dressFigure, type FigureLook } from '../people/palettes';
import type { PoseInput, PoseKind, V3 } from '../people/rig';
import { hash3 } from '../vegetation/rng';
import { CROSSING_TIMINGS as T, type CrossingState } from './crossing';
import { clamp01, fract, lerp, lerpAngle, smooth } from './ease';
import { POLE_LEN } from './pole';
import { haulerStationX, haulerZ, type SeatAnchor } from './seats';
import type { DeckLayout, VesselSpec } from './spec';

export type Role = 'hauler' | 'poler' | 'helmsman' | 'passenger';
export interface Actor { role: Role; index: number; look: FigureLook; spot: SeatAnchor | null }
export interface ActorFrame {
  visible: boolean;
  /** Feet, deck-local. */
  pos: V3;
  /** Rotation about +Y; the figure faces local +Z at yaw 0. */
  yaw: number;
  pose: PoseInput;
  /** Figure-local hand targets (pose.handL / handR point at these when set). */
  handL: V3; handR: V3;
  hasPole: boolean; poleTop: V3; poleTip: V3;
}
export interface ActorCtx { spec: VesselSpec; layout: DeckLayout }

export const HAUL_HZ = 0.5, STROKE_S = 7, PUSH = 0.65, POLE_BED = 2.1, STEER_DEPTH = 0.5;
export const WALK_SPEED = 1.4, STRIDE = 1.1, TURN_S = 0.8;
/** Seconds into a leg when unloading starts. */
export const MOVE_END = T.load + T.castOff + T.cross + T.dock;

export const createActorFrame = (): ActorFrame => ({
  visible: true, pos: [0, 0, 0], yaw: 0, pose: { kind: 'stand', phase: 0 }, handL: [0, 0, 0], handR: [0, 0, 0],
  hasPole: false, poleTop: [0, 0, 0], poleTip: [0, 0, 0],
});

const set3 = (o: V3, x: number, y: number, z: number) => { o[0] = x; o[1] = y; o[2] = z; return o; };
/** Yaw that faces deck direction (dx, dz). */
export const faceDir = (dx: number, dz: number) => Math.atan2(dx, dz);
/** Deck point → figure-local for a figure at `pos` facing `yaw`. */
export function toFigure(p: V3, pos: V3, yaw: number, out: V3): V3 {
  const dx = p[0] - pos[0], dz = p[2] - pos[2], c = Math.cos(yaw), s = Math.sin(yaw);
  return set3(out, dx * c - dz * s, p[1] - pos[1], dx * s + dz * c);
}

export function castActors(spec: VesselSpec, seats: SeatAnchor[], eraSeed: number, passengerScale = 1): Actor[] {
  const out: Actor[] = [];
  if (spec.moored) return out;
  const add = (role: Role, index: number, female: boolean, spot: SeatAnchor | null) =>
    out.push({ role, index, spot, look: dressFigure(spec.clothing, eraSeed * 97 + out.length, female) });
  if (spec.propulsion === 'ropes') for (let i = 0; i < spec.crew; i++) add('hauler', i, spec.anconera && i === 0, null);
  if (spec.propulsion === 'poles') {
    for (let i = 0; i < spec.crew; i++) add('poler', i, false, null);
    if (spec.helmsman) add('helmsman', 0, false, null);
  }
  const standing = seats.filter((s) => s.kind === 'standing');
  const n = Math.min(standing.length, Math.round(spec.passengers * passengerScale));
  for (let i = 0; i < n; i++) add('passenger', i, hash3(eraSeed, i, 9) / 2 ** 32 < 0.45, standing[i]);
  return out;
}

// ---- pole shapes (deck-local): top, tip and where the two hands hold it ----
interface PoleShape { top: V3; tip: V3; hl: V3; hr: V3 }
const shape = (): PoleShape => ({ top: [0, 0, 0], tip: [0, 0, 0], hl: [0, 0, 0], hr: [0, 0, 0] });
const sA = shape(), sB = shape(), sC = shape(), sD = shape(), sE = shape();
const hL: V3 = [0, 0, 0], hR: V3 = [0, 0, 0];

function poleShape(kind: 'upright' | 'push' | 'carry', x: number, z: number, side: number, tr: number, alpha: number, L: DeckLayout, o: PoleShape): PoleShape {
  const y = L.deckY;
  if (kind === 'upright') {
    const pz = z + side * 0.3;
    set3(o.tip, x, y, pz); set3(o.top, x, y + POLE_LEN, pz); set3(o.hr, x, y + 1.4, pz); set3(o.hl, x, y + 1.05, pz);
    return o;
  }
  let dx: number, dy: number, dz: number;
  if (kind === 'push') { dx = -tr * Math.sin(alpha); dy = -Math.cos(alpha); dz = side * 0.3; set3(o.hr, x - tr * 0.35, y + 1.25, z + side * 0.05); }
  else { dx = -tr * 0.9; dy = -0.22; dz = side * 0.15; set3(o.hr, x + tr * 0.25, y + 1.05, z); }
  const n = Math.hypot(dx, dy, dz); dx /= n; dy /= n; dz /= n;
  const along = kind === 'push' ? (o.hr[1] + POLE_BED) / -dy : 3.6;
  set3(o.hl, o.hr[0] + dx * 0.42, o.hr[1] + dy * 0.42, o.hr[2] + dz * 0.42);
  set3(o.tip, o.hr[0] + dx * along, o.hr[1] + dy * along, o.hr[2] + dz * along);
  set3(o.top, o.tip[0] - dx * POLE_LEN, o.tip[1] - dy * POLE_LEN, o.tip[2] - dz * POLE_LEN);
  return o;
}
function steerShape(xEnd: number, tr: number, sweep: number, L: DeckLayout, o: PoleShape): PoleShape {
  set3(o.hl, xEnd + tr * 0.25, L.deckY + 1.15, 0.3);
  const c = Math.cos(sweep), s = Math.sin(sweep), bx = -tr * 0.88, bz = 0.05;
  let dx = bx * c + bz * s, dy = -0.45, dz = -bx * s + bz * c;
  const n = Math.hypot(dx, dy, dz); dx /= n; dy /= n; dz /= n;
  set3(o.hr, o.hl[0] + dx * 0.5, o.hl[1] + dy * 0.5, o.hl[2] + dz * 0.5);
  const along = (o.hl[1] + STEER_DEPTH) / -dy;
  set3(o.tip, o.hl[0] + dx * along, o.hl[1] + dy * along, o.hl[2] + dz * along);
  set3(o.top, o.tip[0] - dx * POLE_LEN, o.tip[1] - dy * POLE_LEN, o.tip[2] - dz * POLE_LEN);
  return o;
}
function mixShape(a: PoleShape, b: PoleShape, w: number, o: PoleShape): PoleShape {
  for (let k = 0; k < 3; k++) {
    o.top[k] = lerp(a.top[k], b.top[k], w); o.tip[k] = lerp(a.tip[k], b.tip[k], w);
    o.hl[k] = lerp(a.hl[k], b.hl[k], w); o.hr[k] = lerp(a.hr[k], b.hr[k], w);
  }
  return o;
}
/** Write the pole (renormalised to its true length) and the hand targets; f.pos / f.yaw must already be set. */
function applyShape(s: PoleShape, f: ActorFrame) {
  const dx = s.top[0] - s.tip[0], dy = s.top[1] - s.tip[1], dz = s.top[2] - s.tip[2], n = Math.hypot(dx, dy, dz) || 1;
  set3(f.poleTip, s.tip[0], s.tip[1], s.tip[2]);
  set3(f.poleTop, s.tip[0] + (dx / n) * POLE_LEN, s.tip[1] + (dy / n) * POLE_LEN, s.tip[2] + (dz / n) * POLE_LEN);
  f.hasPole = true;
  f.pose.handL = toFigure(set3(hL, s.hl[0], s.hl[1], s.hl[2]), f.pos, f.yaw, f.handL);
  f.pose.handR = toFigure(set3(hR, s.hr[0], s.hr[1], s.hr[2]), f.pos, f.yaw, f.handR);
}

// ---- rope haulers ----
function ropeHand(p: number, tr: number, x: number, side: number, L: DeckLayout, out: V3): V3 {
  const pull = p < 0.5, u = pull ? p / 0.5 : (p - 0.5) / 0.5;
  const h = pull ? 0.4 - 0.6 * smooth(u) : -0.2 + 0.6 * smooth(u);
  return set3(out, x + tr * h, L.guideY + (pull ? 0 : 0.08 * Math.sin(Math.PI * u)), side * L.ropeZ);
}
function hauler(a: Actor, st: CrossingState, clock: number, { spec, layout: L }: ActorCtx, f: ActorFrame) {
  const side = a.index % 2 === 0 ? 1 : -1, perSide = Math.ceil(spec.crew / 2), x = haulerStationX(Math.floor(a.index / 2), perSide, L, side);
  set3(f.pos, x, L.deckY, haulerZ(side, L));
  const w = smooth(clamp01(st.effort / 0.3));
  f.yaw = lerpAngle(side > 0 ? Math.PI : 0, faceDir(st.travel, 0), w);
  if (w < 0.5) { f.pose.kind = 'stand'; f.pose.phase = fract(clock * 0.12 + a.index * 0.31); return; }
  const phi = fract(clock * HAUL_HZ + a.index * 0.37);
  f.pose.kind = 'haul'; f.pose.phase = phi;
  f.pose.handL = toFigure(ropeHand(phi, st.travel, x, side, L, hL), f.pos, f.yaw, f.handL);
  f.pose.handR = toFigure(ropeHand(fract(phi + 0.5), st.travel, x, side, L, hR), f.pos, f.yaw, f.handR);
}

// ---- polers ----
const strokeAt = (t: number, i: number) => fract(t / STROKE_S + i * 0.5);
function polerX(psi: number, tr: number, L: DeckLayout) {
  const xf = tr * (L.halfLength - 0.9), xb = -tr * (L.halfLength - 1.8);
  return psi < PUSH ? lerp(xf, xb, psi / PUSH) : lerp(xb, xf, (psi - PUSH) / (1 - PUSH));
}
const strokeOut = { x: 0, yaw: 0, kind: 'pole' as PoseKind, phase: 0 };
/** The stroke t s after cast-off: deck x, facing, leg pose, pole shape into `out` (blended over TURN_S at each switch). */
function stroke(t: number, i: number, side: number, z: number, tr: number, L: DeckLayout, out: PoleShape) {
  const psi = strokeAt(t, i), push = psi < PUSH, u = push ? psi / PUSH : (psi - PUSH) / (1 - PUSH);
  const w = smooth(clamp01(((push ? psi : psi - PUSH) * STROKE_S) / TURN_S)), x = polerX(psi, tr, L);
  mixShape(poleShape(push ? 'carry' : 'push', x, z, side, tr, push ? 0.35 : 0.75, L, sB),
    poleShape(push ? 'push' : 'carry', x, z, side, tr, lerp(0.35, 0.75, u), L, sA), w, out);
  strokeOut.x = x;
  strokeOut.yaw = lerpAngle(faceDir(push ? tr : -tr, 0), faceDir(push ? -tr : tr, 0), w);
  strokeOut.kind = push ? 'pole' : 'walk';
  strokeOut.phase = fract((u * (2 * L.halfLength - 2.7)) / STRIDE);
  return strokeOut;
}
function poler(a: Actor, st: CrossingState, { layout: L }: ActorCtx, f: ActorFrame) {
  const i = a.index, side = i % 2 === 0 ? 1 : -1, z = side * (L.halfBeam - 0.45), tr = st.travel, tau = st.tLeg;
  const inboard = side > 0 ? Math.PI : 0, tEnd = MOVE_END - T.load;
  if (tau < T.load) {
    // Idle at this leg's first stroke position, pole upright; finish the turn from the walk that brought him here.
    const x = polerX(strokeAt(0, i), tr, L), from = polerX(strokeAt(tEnd, i), -tr, L), k = smooth(clamp01(tau / TURN_S));
    set3(f.pos, x, L.deckY, z);
    f.yaw = lerpAngle(faceDir(x - from, 0), inboard, k);
    f.pose.kind = 'stand'; f.pose.phase = fract(tau * 0.1 + i * 0.3);
    applyShape(mixShape(poleShape('carry', x, z, side, Math.sign(x - from) || tr, 0, L, sA), poleShape('upright', x, z, side, tr, 0, L, sB), k, sE), f);
    return;
  }
  if (tau < MOVE_END) {
    const t = tau - T.load, s = stroke(t, i, side, z, tr, L, sC);
    const x = s.x, yaw = s.yaw, kind = s.kind, phase = s.phase;
    set3(f.pos, x, L.deckY, z);
    f.pose.kind = kind; f.pose.phase = phase;
    if (t < TURN_S) {   // cast-off: out of the idle stance, toward where the stroke will be at TURN_S
      const k = smooth(t / TURN_S), target = stroke(TURN_S, i, side, z, tr, L, sD).yaw;
      f.yaw = lerpAngle(inboard, target, k);
      applyShape(mixShape(poleShape('upright', x, z, side, tr, 0, L, sB), sC, k, sE), f);
    } else { f.yaw = yaw; applyShape(sC, f); }
    return;
  }
  // Unload: carry the pole to the next leg's first stroke position.
  const e = stroke(tEnd, i, side, z, tr, L, sC), fromX = e.x, endYaw = e.yaw;
  const toX = polerX(strokeAt(0, i), -tr, L), dir = Math.sign(toX - fromX) || -tr;
  const since = tau - MOVE_END, u = smooth(clamp01(since / (T.unload * 0.8))), x = lerp(fromX, toX, u), k = smooth(clamp01(since / TURN_S));
  set3(f.pos, x, L.deckY, z);
  f.yaw = lerpAngle(endYaw, faceDir(toX - fromX, 0), k);
  f.pose.kind = u < 1 ? 'walk' : 'stand'; f.pose.phase = fract(Math.abs(x - fromX) / STRIDE);
  applyShape(mixShape(sC, poleShape('carry', x, z, side, dir, 0, L, sB), k, sE), f);
}

// ---- helmsman ----
/** The helmsman crosses the deck at the very end of unloading, after the passengers have gone ashore (they leave by ≈ MOVE_END + 8 s). */
const helmWalkStart = (L: DeckLayout) => MOVE_END + T.unload - 0.5 - (2 * (L.halfLength - 0.5)) / WALK_SPEED;
function helmsman(st: CrossingState, clock: number, { layout: L }: ActorCtx, f: ActorFrame) {
  const tr = st.travel, tau = st.tLeg, xEnd = -tr * (L.halfLength - 0.5);
  const sweep = 0.22 * Math.sin(clock * 0.45) * (0.3 + 0.7 * st.effort);
  if (tau < MOVE_END) {
    const k = smooth(clamp01(tau / TURN_S));
    set3(f.pos, xEnd, L.deckY, 0);
    f.yaw = lerpAngle(faceDir(-tr, 0), 0, k);
    f.pose.kind = 'stand'; f.pose.phase = fract(clock * 0.1);
    applyShape(mixShape(poleShape('carry', xEnd, 0.3, 1, -tr, 0, L, sA), steerShape(xEnd, tr, sweep, L, sB), k, sE), f);
    return;
  }
  // Unload: stand at the trailing end (pole now carried), then walk to the far end — next leg's trailing end.
  const t0 = helmWalkStart(L), d = 2 * (L.halfLength - 0.5), walked = clamp01((tau - t0) / (d / WALK_SPEED)) * d, x = xEnd + tr * walked;
  const kPole = smooth(clamp01((tau - MOVE_END) / TURN_S)), kTurn = smooth(clamp01((tau - t0) / TURN_S));
  set3(f.pos, x, L.deckY, 0);
  f.yaw = lerpAngle(0, faceDir(tr, 0), kTurn);
  f.pose.kind = tau > t0 && walked < d ? 'walk' : 'stand'; f.pose.phase = fract(tau > t0 ? walked / STRIDE : clock * 0.1);
  applyShape(mixShape(steerShape(xEnd, tr, sweep, L, sA), poleShape('carry', x, 0.3, 1, tr, 0, L, sB), kPole, sE), f);
}

// ---- passengers ----
/** Passengers board and leave 0.6 m off the centreline (clear of the helmsman, who stands on it at the ends). */
const LANE_Z = 0.6;
function passenger(a: Actor, st: CrossingState, clock: number, { layout: L }: ActorCtx, f: ActorFrame) {
  const spot = a.spot!, tau = st.tLeg, i = a.index, sx = spot.pos[0], sz = spot.pos[2], ze = sz >= 0 ? LANE_Z : -LANE_Z;
  const xIn = -st.travel * L.halfLength, xOut = st.travel * L.halfLength;
  const board0 = 1 + i * 0.9, boardDist = Math.hypot(sx - xIn, sz - ze), board1 = board0 + boardDist / WALK_SPEED;
  const leave0 = MOVE_END + 0.5 + i * 0.25, leaveDist = Math.hypot(xOut - sx, ze - sz), leave1 = leave0 + leaveDist / WALK_SPEED;
  const walkIn = faceDir(sx - xIn, sz - ze), walkOut = faceDir(xOut - sx, ze - sz);
  if (tau < board0 || tau >= leave1) { f.visible = false; set3(f.pos, xIn, L.deckY, ze); return; }
  if (tau < board1) {
    const u = (tau - board0) * WALK_SPEED, k = u / boardDist;
    set3(f.pos, xIn + (sx - xIn) * k, L.deckY, ze + (sz - ze) * k);
    f.yaw = walkIn; f.pose.kind = 'walk'; f.pose.phase = fract(u / STRIDE);
    return;
  }
  if (tau < leave0) {
    set3(f.pos, sx, L.deckY, sz);
    f.yaw = lerpAngle(walkIn, spot.yaw, smooth(clamp01((tau - board1) / TURN_S)));
    f.pose.kind = 'stand'; f.pose.phase = fract(clock * 0.1 + i * 0.37);
    return;
  }
  const u = (tau - leave0) * WALK_SPEED, k = u / leaveDist;
  set3(f.pos, sx + (xOut - sx) * k, L.deckY, sz + (ze - sz) * k);
  f.yaw = lerpAngle(spot.yaw, walkOut, smooth(clamp01((tau - leave0) / TURN_S)));
  f.pose.kind = 'walk'; f.pose.phase = fract(u / STRIDE);
}

/** Where actor `a` is and what they do at this crossing state. Pure; writes into and returns `out`. */
export function actorFrame(a: Actor, st: CrossingState, clock: number, ctx: ActorCtx, out: ActorFrame): ActorFrame {
  out.visible = true; out.hasPole = false;
  out.pose.handL = undefined; out.pose.handR = undefined; out.pose.lean = undefined;
  if (a.role === 'hauler') hauler(a, st, clock, ctx, out);
  else if (a.role === 'poler') poler(a, st, ctx, out);
  else if (a.role === 'helmsman') helmsman(st, clock, ctx, out);
  else passenger(a, st, clock, ctx, out);
  return out;
}
```

If the continuity test fails for a passenger's heading when `spot.yaw` is almost opposite to the walk direction (a π turn within `TURN_S`), extend that turn to `1.2 · TURN_S` rather than raising the test bound.

- [ ] **Step 3: `CrewSet`**

```ts
// src/ancon/CrewSet.ts
import * as THREE from 'three';
import { FigureBatch } from '../people/figureBatch';
import { createFigurePose, poseFigure, segmentMatrix, type Body, type FigurePose } from '../people/rig';
import { actorFrame, createActorFrame, type Actor, type ActorCtx, type ActorFrame } from './crew';
import { buildPole } from './pole';
import type { VesselPose } from './pose';

const _w = new THREE.Matrix4(), _p = new THREE.Matrix4();

/** The crew and passengers of one era: figures (instanced per body part) and their poles. */
export class CrewSet {
  readonly group = new THREE.Group();
  poleCount = 0;
  private batch: FigureBatch;
  private poles: THREE.InstancedMesh;
  private frames: ActorFrame[]; private bodies: Body[]; private poses: FigurePose[];
  private figMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  private poleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

  constructor(private actors: Actor[]) {
    const n = Math.max(1, actors.length);
    this.batch = new FigureBatch(n, this.figMat);
    actors.forEach((a, i) => this.batch.setLook(i, a.look));
    for (let i = actors.length; i < n; i++) this.batch.hide(i);
    this.poles = new THREE.InstancedMesh(buildPole(1), this.poleMat, n);
    this.poles.count = 0; this.poles.castShadow = true; this.poles.frustumCulled = false;
    this.frames = actors.map(createActorFrame);
    this.bodies = actors.map((a) => ({ height: a.look.height, build: a.look.build, dress: a.look.dress }));
    this.poses = actors.map(createFigurePose);
    this.group.add(this.batch.group, this.poles);
  }

  update(pose: VesselPose, ctx: ActorCtx) {
    let pi = 0;
    for (let i = 0; i < this.actors.length; i++) {
      const f = actorFrame(this.actors[i], pose.state, pose.clock, ctx, this.frames[i]);
      if (!f.visible) { this.batch.hide(i); continue; }
      _w.makeRotationY(f.yaw).setPosition(f.pos[0], f.pos[1], f.pos[2]).premultiply(pose.matrix);
      this.batch.set(i, _w, poseFigure(this.bodies[i], f.pose, this.poses[i]), this.actors[i].look.hat);
      if (f.hasPole) this.poles.setMatrixAt(pi++, segmentMatrix(f.poleTop, f.poleTip, 1, 1, _p).premultiply(pose.matrix));
    }
    this.poles.count = pi; this.poleCount = pi;
    this.poles.instanceMatrix.needsUpdate = true;
    this.batch.commit();
  }

  dispose() { this.batch.dispose(); this.poles.geometry.dispose(); this.figMat.dispose(); this.poleMat.dispose(); }
}
```

- [ ] **Step 4: Wire into `<Ancon>`.** `const seats = useMemo(() => seatAnchors(spec, layout), [spec, layout]);` `const crew = useMemo(() => new CrewSet(castActors(spec, seats, Number(era.id), q.ancon.passengers)), [spec, seats, era.id, q.ancon.passengers]);` + `useEffect(() => () => crew.dispose(), [crew])`; in the frame callback after `ropes.update(...)`: `crew.update(pose, ctx);` (a `PoseContext` is an `ActorCtx`); render `<primitive object={crew.group} />` next to the ropes (world space).

- [ ] **Step 5: Visual check** (quality bar: the "boatman on a wooden boat" moment — people must sell the effort and the scale):
  - `?era=1925&cam=bank&c=70&freeze=1` — the poler leaning into his pole on the far side, the helmsman at the trailing end with the steering pole in the water, three passengers in white cotton and straw hats.
  - `?era=1975&cam=bank&c=90&freeze=1` — three haulers braced and leaning back on the ropes, passengers in 1970s colours standing at the ends.
  - `?era=1984&cam=bank&c=90&freeze=1` — the anconera among the haulers.
  - `?era=1959&cam=bank&c=10&freeze=1` — mid-boarding: passengers walking on from the Loíza end.
  - Unfrozen in the browser pane (`?era=1840&cam=bank&c=15`): watch one full cast-off — no pops, poles swing from upright into the first stroke.

  Hands meet the rope/pole (≤ 3 cm visible gap), feet on the deck, nobody inside the hull or another person. `npm test`, `npm run build`. Commit:

```bash
git add src/ancon
git commit -m "$(cat <<'EOF'
feat(ancon): crew and passengers — polers, helmsman, rope haulers, boarding

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Wake, hull foam and ripples in the water shader; the ferry in the reflection

**Files:**
- Create: `src/ancon/wake.ts` (+ `wake.test.ts`), `src/ancon/wakeUniforms.ts`
- Modify: `src/scene/water/waterShader.ts`, `src/scene/water/Water.tsx`, `src/ancon/Ancon.tsx`

**Interfaces:**
- Consumes: `computeVesselPose`, `createVesselPose`, `PoseContext`, `VesselPose` (Task 2).
- Produces:
  - `WAKE_N = 16`, `WAKE_DT = 1.5`, `WAKE_REF = 1.1`; `writeWake(clock: number, ctx: PoseContext, out: Float32Array, scratch: VesselPose): Float32Array` — `[x, z, age s, strength 0..1] × WAKE_N`, sample 0 = the trailing end now, sample i = the trailing end `i · WAKE_DT` s ago; strength = |speed| / WAKE_REF × (1 − current slack), i.e. exactly 0 whenever the ferry is docked or moored (pure: recomputes past poses, so `?freeze` / `?c` shots are reproducible)
  - `wakeUniforms = { uWake: { value: Float32Array(4·WAKE_N) }, uHull: { value: Vector4 /* x, z, cos yaw, sin yaw */ }, uHullSize: { value: Vector3 /* reach, halfBeam, |speed| */ }, uWakeOn: { value: 0 | 1 } }`; `updateWakeUniforms(pose: VesselPose, ctx: PoseContext): void`; `clearWakeUniforms(): void`
  - GLSL `vec3 vesselWake(vec2 p)` in `waterFragment` → (hull-contact foam, ripple height, trailing-wake foam)

- [ ] **Step 1: Failing tests**

```ts
// src/ancon/wake.test.ts
import { expect, test } from 'vitest';
import { waterFragment } from '../scene/water/waterShader';
import { CROSSING_TIMINGS as T, legDuration } from './crossing';
import { computeVesselPose, createVesselPose } from './pose';
import { ctxFor } from './testing';
import { WAKE_DT, WAKE_N, writeWake } from './wake';

const ctx = ctxFor('1975'), layout = ctx.layout;
const MID = T.load + T.castOff + T.cross / 2, L = legDuration();
const run = (c: number, context = ctx) => writeWake(c, context, new Float32Array(4 * WAKE_N), createVesselPose());

test('sample 0 is the trailing end now; ages step by WAKE_DT', () => {
  const w = run(MID), p = computeVesselPose(MID, ctx, createVesselPose());
  const hx = Math.cos(p.yaw), hz = -Math.sin(p.yaw);
  expect(w[0]).toBeCloseTo(p.position.x - hx * layout.reach * p.travel, 4);
  expect(w[1]).toBeCloseTo(p.position.z - hz * layout.reach * p.travel, 4);
  for (let i = 0; i < WAKE_N; i++) expect(w[i * 4 + 2]).toBeCloseTo(i * WAKE_DT, 9);
});
test('mid-crossing the trail lies behind at full strength; exactly 0 whenever the ferry is docked', () => {
  const w = run(MID), p = computeVesselPose(MID, ctx, createVesselPose());
  const hx = Math.cos(p.yaw) * p.travel, hz = -Math.sin(p.yaw) * p.travel;
  for (let i = 1; i < WAKE_N; i++) expect((w[i * 4] - w[0]) * hx + (w[i * 4 + 1] - w[1]) * hz).toBeLessThan(0);
  expect(w[3]).toBeGreaterThan(0.8);
  for (const c of [5, T.load - 0.5, L - 3, L + 5]) {          // loading / unloading on both banks, just after a crossing
    const d = run(c);
    for (let i = 0; i < WAKE_N; i++) expect(d[i * 4 + 3], `c=${c} sample ${i}`).toBe(0);
  }
  const moored = run(MID, ctxFor('1986'));
  for (let i = 0; i < WAKE_N; i++) expect(moored[i * 4 + 3]).toBe(0);
});
test('deterministic', () => { expect(Array.from(run(123.4))).toEqual(Array.from(run(123.4))); });
test('the water shader declares the same number of wake samples', () => {
  expect(waterFragment).toContain(`uniform vec4 uWake[${WAKE_N}]`);
  expect(waterFragment).toContain(`i < ${WAKE_N - 1}`);
  expect(waterFragment).not.toMatch(/pow\(\s*\(dd/);   // no pow() with a possibly negative base
});
```

Run → FAIL.

- [ ] **Step 2: `wake.ts`, `wakeUniforms.ts`**

```ts
// src/ancon/wake.ts
import { computeVesselPose, type PoseContext, type VesselPose } from './pose';

export const WAKE_N = 16, WAKE_DT = 1.5;
/** Speed (m/s) that draws a full-strength wake: the cruise on the 122–138 m dock-to-dock line is ≈ 1.0–1.1 m/s. */
export const WAKE_REF = 1.1;
/**
 * Trailing-end track: [x, z, age s, strength 0..1] × WAKE_N; sample i is the trailing end i·WAKE_DT s ago.
 * Strength = |speed| / WAKE_REF, faded by the *current* state (× (1 − slack)): exactly 0 whenever the
 * ferry is docked (slack = 1 in load/unload and for the moored barge), easing in at cast-off and out
 * while docking. Pure: recomputes past poses into `scratch`; no allocation.
 */
export function writeWake(clock: number, ctx: PoseContext, out: Float32Array, scratch: VesselPose): Float32Array {
  const live = 1 - computeVesselPose(clock, ctx, scratch).state.slack;
  for (let i = 0; i < WAKE_N; i++) {
    const p = computeVesselPose(clock - i * WAKE_DT, ctx, scratch), r = ctx.layout.reach * p.travel;
    out[i * 4] = p.position.x - Math.cos(p.yaw) * r;
    out[i * 4 + 1] = p.position.z + Math.sin(p.yaw) * r;
    out[i * 4 + 2] = i * WAKE_DT;
    out[i * 4 + 3] = Math.min(1, Math.abs(p.speed) / WAKE_REF) * live;
  }
  return out;
}
```

```ts
// src/ancon/wakeUniforms.ts
import * as THREE from 'three';
import { createVesselPose, type PoseContext, type VesselPose } from './pose';
import { WAKE_N, writeWake } from './wake';

/** Shared with the water material (Water.tsx swaps these objects into the Reflector's uniforms). */
export const wakeUniforms = {
  uWake: { value: new Float32Array(4 * WAKE_N) },
  uHull: { value: new THREE.Vector4() },
  uHullSize: { value: new THREE.Vector3() },
  uWakeOn: { value: 0 },
};
const scratch = createVesselPose();
export function updateWakeUniforms(pose: VesselPose, ctx: PoseContext) {
  writeWake(pose.clock, ctx, wakeUniforms.uWake.value, scratch);
  wakeUniforms.uHull.value.set(pose.position.x, pose.position.z, Math.cos(pose.yaw), Math.sin(pose.yaw));
  wakeUniforms.uHullSize.value.set(ctx.layout.reach, ctx.layout.halfBeam, Math.abs(pose.speed));
  wakeUniforms.uWakeOn.value = 1;
}
export function clearWakeUniforms() { wakeUniforms.uWakeOn.value = 0; }
```

(`computeVesselPose` into a scratch pose never touches `sharedVesselPose`.)

- [ ] **Step 3: Water shader.** In `waterShader.ts`, add after the existing uniform declarations and `waterInfo()`:

```glsl
uniform vec4 uWake[16]; uniform vec4 uHull; uniform vec3 uHullSize; uniform float uWakeOn;
// The ferry in the water: x = foam hugging the hull, y = ripple height (signed), z = foam along the wake.
vec3 vesselWake(vec2 p) {
  if (uWakeOn < 0.5) return vec3(0.0);
  vec2 d = p - uHull.xy;
  if (dot(d, d) > 8100.0) return vec3(0.0);                       // > 90 m away: nothing to do
  vec2 q = vec2(dot(d, vec2(uHull.z, -uHull.w)), dot(d, vec2(uHull.w, uHull.z)));   // hull-local (x along the crossing)
  vec2 b = abs(q) - uHullSize.xy;
  float sd = length(max(b, 0.0)) + min(max(b.x, b.y), 0.0);       // signed distance to the hull footprint
  float spd = uHullSize.z;
  float contact = (1.0 - smoothstep(0.0, 0.45 + 0.5 * spd, sd)) * step(-0.05, sd);
  float ripple = sin(sd * 4.0 - uTime * 2.6) * exp(-max(sd, 0.0) * 0.35) * (0.25 + 0.75 * min(spd, 1.5));
  float trail = 0.0;
  for (int i = 0; i < 15; i++) {
    vec4 a = uWake[i], c = uWake[i + 1];
    vec2 ab = c.xy - a.xy;
    float h = clamp(dot(p - a.xy, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    float age = mix(a.z, c.z, h), str = mix(a.w, c.w, h);
    float w = uHullSize.y * 0.6 + age * 0.35;                       // the wake spreads as it ages
    float dd = length(p - a.xy - ab * h);
    float e = (dd - w) * 2.0;                                       // (dd − w) / 0.5, squared below: no pow() of a negative base
    float edge = exp(-e * e) + 0.5 * (1.0 - smoothstep(0.0, w, dd));
    trail = max(trail, str * exp(-age / 12.0) * edge);
  }
  return vec3(contact, ripple, trail);
}
```

In `main()`, right after `vec2 g = mix(gs * 0.16, gr * riverAmp, river);` add

```glsl
  vec3 wk = vesselWake(vWorld.xz);
  g += normalize(vWorld.xz - uHull.xy + vec2(1e-4)) * wk.y * 0.05;
```

and right after `float foam = band * smoothstep(0.45, 0.85, fn) * mix(0.8, 0.12, river);` add

```glsl
  float wn = snoise(vWorld.xz * 1.7 - uTime * vec2(0.3, 0.2)) * 0.5 + 0.5;
  foam = max(foam, clamp(wk.x * 0.85 + wk.z * 0.75, 0.0, 1.0) * smoothstep(0.25, 0.75, wn + 0.25 * wk.x));
```

The `16` / `15` literals must match `WAKE_N` / `WAKE_N − 1` (the test reads the shader string); use `${WAKE_N}` interpolation only if the import does not create a cycle (`waterShader.ts` → `ancon/wake.ts` → `pose.ts` is fine, but keep literals if in doubt — the test guards them).

- [ ] **Step 4: Wire.** In `Water.tsx`, inside the `useMemo` right after `new Reflector(...)`: `Object.assign((r.material as THREE.ShaderMaterial).uniforms, wakeUniforms);` — the Reflector clones `shader.uniforms`, so the shared objects are swapped in before the first compile. In `<Ancon>`'s frame callback, after `crew.update(...)`: `updateWakeUniforms(pose, ctx);` and add `useEffect(() => () => clearWakeUniforms(), [])`. The component after this task (Tasks 3, 5, 7, 8 combined; it type-checks as written):

```tsx
// src/ancon/Ancon.tsx
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Era } from '../data/eras';
import type { QualitySettings } from '../quality';
import { useStore } from '../state/store';
import { sampleField, type WorldFields } from '../terrain/fields';
import { placementFields } from '../terrain/placementFields';
import { castActors } from './crew';
import { CrewSet } from './CrewSet';
import { advanceClock } from './crossing';
import { crossingGeometry } from './geometry';
import { vesselMaterials } from './materials';
import { apronLift, computeVesselPose, makePoseContext } from './pose';
import { RopeSet } from './RopeSet';
import { seatAnchors } from './seats';
import { vesselSpec } from './spec';
import { anconTiming } from './stats';
import { emitVesselPose, sharedVesselPose } from './vesselPose';
import { buildVessel } from './vessels';
import { clearWakeUniforms, updateWakeUniforms } from './wakeUniforms';

/**
 * The ferry for the current era. One useFrame drives everything, in order: crossing clock →
 * vessel pose (shared, see useVesselPose) → hull + apron transforms → ropes → crew → wake →
 * timing → pose listeners (the ride camera). Nothing else computes the live pose.
 */
export function Ancon({ near, era, q, frozen, castShadow }: {
  near: WorldFields; era: Era; q: QualitySettings; frozen: boolean; castShadow: boolean;
}) {
  const start = useStore((s) => s.crossingStart), speed = useStore((s) => s.crossingSpeed);
  const bank = era.river.bankOffset.value;
  const spec = useMemo(() => vesselSpec(era), [era]);
  // Crossing geometry always comes from the fixed 512 placement fields (never the tier's grid).
  const place = useMemo(() => placementFields(bank, near), [bank, near]);
  const ctx = useMemo(() => makePoseContext(crossingGeometry(place), spec, era.river.flow.value,
    (x: number, z: number) => sampleField(near, near.height, x, z)), [place, spec, era, near]);
  const layout = ctx.layout;
  const parts = useMemo(() => buildVessel(spec, layout, 1), [spec, layout]);
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  const ropes = useMemo(() => new RopeSet({ spec, layout, geom: ctx.geom, fields: place, segments: q.ancon.ropeSegments, radial: q.ancon.ropeRadial }),
    [spec, layout, ctx, place, q.ancon.ropeSegments, q.ancon.ropeRadial]);
  useEffect(() => () => ropes.dispose(), [ropes]);
  const seats = useMemo(() => seatAnchors(spec, layout), [spec, layout]);
  const crew = useMemo(() => new CrewSet(castActors(spec, seats, Number(era.id), q.ancon.passengers)), [spec, seats, era.id, q.ancon.passengers]);
  useEffect(() => () => crew.dispose(), [crew]);
  useEffect(() => () => clearWakeUniforms(), []);
  const mats = vesselMaterials();
  const hull = useRef<THREE.Group>(null);
  const aprons = useRef<(THREE.Group | null)[]>([]);
  const clock = useRef(start);
  useEffect(() => { clock.current = start; }, [start]);

  useFrame((state, dt) => {
    const t0 = performance.now();
    clock.current = advanceClock(clock.current, Math.min(dt, 0.1), frozen, speed);
    const pose = computeVesselPose(clock.current, ctx, sharedVesselPose);
    const g = hull.current;
    if (g) { g.matrix.copy(pose.matrix); g.matrixWorldNeedsUpdate = true; }
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], a = aprons.current[i];
      if (p.apron && a) a.rotation.z = p.apron.end * apronLift(pose.state, p.apron.end);
    }
    const cam = state.camera as THREE.PerspectiveCamera;
    ropes.update(pose, (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / state.size.height);
    crew.update(pose, ctx);
    updateWakeUniforms(pose, ctx);
    anconTiming.add(performance.now() - t0);
    emitVesselPose(ctx);
  });

  return (
    <>
      <group ref={hull} matrixAutoUpdate={false}>
        {parts.map((p, i) => p.apron ? (
          <group key={i} ref={(el) => { aprons.current[i] = el; }} position={[p.apron.hinge[0], p.apron.hinge[1], 0]}>
            <mesh geometry={p.geometry} material={mats[p.material]} position={[-p.apron.hinge[0], -p.apron.hinge[1], 0]} castShadow={castShadow} receiveShadow />
          </group>
        ) : (
          <mesh key={i} geometry={p.geometry} material={mats[p.material]} castShadow={castShadow} receiveShadow />
        ))}
      </group>
      <primitive object={ropes.group} />
      <primitive object={crew.group} />
    </>
  );
}
```

- [ ] **Step 5: Visual check** (quality bar: reflective water that reacts to the vessel — a soft foam line where hull meets water, gentle rings when idle, a fading V-shaped wake behind a moving ferry, and the hull, crew and ropes mirrored in the river):
  - `?era=1984&cam=bank&c=90&freeze=1`, `?era=1840&cam=bank&c=90&freeze=1` — wake behind the trailing end, fading over ~20 s of track.
  - `?era=1986&cam=bank&c=0&freeze=1` — moored: only a faint contact line and slow rings.
  - `?era=1975&cam=aerial&c=90&freeze=1` — the trail follows the (drifting) track, no artefacts at 90 m, nothing on land.
  - `?view=water&era=1975&cam=aerial&c=90` — debug view unchanged (wake does not leak into the raw water-info view).

  Check the reflection explicitly: the inverted hull, crew and ropes must be visible under the vessel in every shot. `npm test`, `npm run build`. Commit:

```bash
git add src/ancon src/scene/water
git commit -m "$(cat <<'EOF'
feat(water): ferry wake, hull foam and ripples; the ancón in the reflection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `ride` becomes a deck camera on the moving vessel (the default view)

**Files:**
- Create: `src/ancon/rideCamera.ts` (+ `rideCamera.test.ts`)
- Modify: `src/scene/Cameras.tsx`, `src/state/store.test.ts`

**Interfaces:**
- Consumes: `VesselPose`, `PoseContext` (incl. `groundAt`, set by `<Ancon>` since Task 3), `computeVesselPose` (Task 2); `CROSSING_TIMINGS`, `legDuration`, `crossingState`, `DEFAULT_CROSSING_START` (Task 2); `smooth` (ease.ts); `DeckLayout` (Task 1); `landingClearings`, `LANDING_CLEARING` (Task 1); `onVesselPose` (Task 2); `ctxFor` (testing.ts).
- Produces:
  - `RIDE = { back: 8, up: 4.2, side: 2.6, ahead: 22, lookY: 1.2, minClear: 1.8 }`
  - `rideYaw(clock: number, moored: boolean, T?: CrossingTimings): number` — 0 (camera behind the east end) on leg 0, π on leg 1, a smooth half-orbit around the deck across `unload` + next `load`; continuous and monotonic
  - `rideView(pose: VesselPose, L: DeckLayout, yaw: number, pos: THREE.Vector3, target: THREE.Vector3, groundAt?): void`
  - `carryCamera(prev: THREE.Matrix4, next: THREE.Matrix4, dYaw: number, pos: THREE.Vector3, target: THREE.Vector3): void` — moves a camera (and its orbit target) rigidly with the vessel, plus the scheduled yaw swing; user orbiting in between is preserved
  - `clampAboveGround(pos: THREE.Vector3, groundAt: (x: number, z: number) => number): void`

Spec §13: `ride` is third-person on the deck, like the quality-bar reference (a figure on a boat, seen from behind and above, the water and far bank ahead). The camera stays behind the trailing end on each leg and orbits half-way round the deck while the ferry is docked, so it is behind again when the ferry leaves. Default view on load = `ride` at golden hour (already the store defaults: `camera: 'ride'`, `timeOfDay: defaultTime(era)`; Task 3 set the crossing clock to start 8 s before cast-off).

- [ ] **Step 1: Failing tests**

```ts
// src/ancon/rideCamera.test.ts
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { ERAS } from '../data/eras';
import { LANDING_CLEARING } from '../vegetation/masks';
import { CROSSING_TIMINGS as T, legDuration } from './crossing';
import { landingClearings } from './geometry';
import { computeVesselPose, createVesselPose } from './pose';
import { carryCamera, rideView, rideYaw } from './rideCamera';
import { ctxFor } from './testing';

const ctx = ctxFor('1975'), layout = ctx.layout;
const L = legDuration(), MID = T.load + T.castOff + T.cross / 2;
const poseAt = (c: number) => computeVesselPose(c, ctx, createVesselPose());

test('rideYaw: behind the trailing end on each leg, a slow continuous swing while docked', () => {
  expect(Math.cos(rideYaw(MID, false))).toBeCloseTo(1, 9);
  expect(Math.cos(rideYaw(L + MID, false))).toBeCloseTo(-1, 9);
  let prev = rideYaw(0, false);
  for (let c = 0.1; c <= 4 * L; c += 0.1) {
    const y = rideYaw(c, false);
    expect(Math.abs(y - prev)).toBeLessThan(0.02); expect(y).toBeGreaterThanOrEqual(prev - 1e-12);
    prev = y;
  }
  expect(rideYaw(500, true)).toBe(0);
});
test('rideView: behind and above the trailing end, looking ahead, on both legs', () => {
  for (const c of [MID, L + MID]) {
    const p = poseAt(c), pos = new THREE.Vector3(), tgt = new THREE.Vector3();
    rideView(p, layout, rideYaw(c, false), pos, tgt);
    const hx = Math.cos(p.yaw) * p.travel, hz = -Math.sin(p.yaw) * p.travel;
    expect((pos.x - p.position.x) * hx + (pos.z - p.position.z) * hz).toBeLessThan(-layout.reach);
    expect((tgt.x - p.position.x) * hx + (tgt.z - p.position.z) * hz).toBeGreaterThan(0);
    expect(pos.y).toBeGreaterThan(layout.deckY + 3);
  }
});
test('carrying the camera with the vessel equals re-deriving the view', () => {
  const a = poseAt(60), b = poseAt(170), ya = rideYaw(60, false), yb = rideYaw(170, false);
  const pos = new THREE.Vector3(), tgt = new THREE.Vector3(), pos2 = new THREE.Vector3(), tgt2 = new THREE.Vector3();
  rideView(a, layout, ya, pos, tgt);
  carryCamera(a.matrix, b.matrix, yb - ya, pos, tgt);
  rideView(b, layout, yb, pos2, tgt2);
  expect(pos.distanceTo(pos2)).toBeLessThan(1e-6); expect(tgt.distanceTo(tgt2)).toBeLessThan(1e-6);
});
test('the camera never dips under the bank', () => {
  const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
  rideView(poseAt(5), layout, 0, pos, tgt, () => 10);
  expect(pos.y).toBeCloseTo(11.8, 9);
});
test('docked, the ride camera stands inside the landing clearing (no trees in the lens)', () => {
  for (const e of ERAS) {
    const c = ctxFor(e.id), [cE, cW] = landingClearings(c.geom), pos = new THREE.Vector3(), tgt = new THREE.Vector3();
    for (const [clock, centre] of (c.spec.moored ? [[5, cE]] : [[5, cE], [L + 5, cW]]) as [number, readonly [number, number]][]) {   // 1986 stays at Loíza
      rideView(computeVesselPose(clock, c, createVesselPose()), c.layout, rideYaw(clock, c.spec.moored), pos, tgt);
      expect(Math.hypot(pos.x - centre[0], pos.z - centre[1]), `${e.id} @${clock}`).toBeLessThan(LANDING_CLEARING[0]);
    }
  }
});
```

```ts
// src/state/store.test.ts — add (with `CROSSING_TIMINGS, createCrossingState, crossingState` imported from '../ancon/crossing')
test('the page opens on the ferry loading at Loíza, casting off within 10 s', () => {
  const st = crossingState(useStore.getState().crossingStart, createCrossingState());
  expect([st.phase, st.leg]).toEqual(['load', 0]);
  const wait = CROSSING_TIMINGS.load - st.tLeg;
  expect(wait).toBeGreaterThan(0); expect(wait).toBeLessThanOrEqual(10);
});
```

(The ride camera and golden-hour defaults are already asserted by the Task 3 store test and the existing golden-hour test; this one pins the new behaviour: the first thing the visitor sees is the cast-off.)

Run → FAIL (module missing).

- [ ] **Step 2: Implement**

```ts
// src/ancon/rideCamera.ts
import * as THREE from 'three';
import { CROSSING_TIMINGS, legDuration, type CrossingTimings } from './crossing';
import { smooth as sm } from './ease';
import type { VesselPose } from './pose';
import type { DeckLayout } from './spec';

/** Third-person deck camera: behind the trailing end, raised, a little to one side, looking over the crew ahead. */
export const RIDE = { back: 8, up: 4.2, side: 2.6, ahead: 22, lookY: 1.2, minClear: 1.8 };

/** Orbit angle about the deck: π·(legs done), easing half a turn across unload + the next load. */
export function rideYaw(clock: number, moored: boolean, T: CrossingTimings = CROSSING_TIMINGS): number {
  if (moored) return 0;
  const L = legDuration(T), U = T.unload, W = T.unload + T.load;
  const k = Math.floor(clock / L), tau = clock - k * L;
  if (tau < T.load) return Math.PI * (k - 1) + Math.PI * sm((tau + U) / W);
  if (tau > L - U) return Math.PI * k + Math.PI * sm((tau - (L - U)) / W);
  return Math.PI * k;
}

export function clampAboveGround(pos: THREE.Vector3, groundAt: (x: number, z: number) => number) {
  pos.y = Math.max(pos.y, groundAt(pos.x, pos.z) + RIDE.minClear);
}

/** The ride view for this pose, orbited by `yaw` about the deck's vertical axis. */
export function rideView(pose: VesselPose, L: DeckLayout, yaw: number, pos: THREE.Vector3, target: THREE.Vector3, groundAt?: (x: number, z: number) => number) {
  const c = Math.cos(yaw), s = Math.sin(yaw), bx = -(L.reach + RIDE.back), bz = RIDE.side;
  pos.set(bx * c + bz * s, L.deckY + RIDE.up, -bx * s + bz * c).applyMatrix4(pose.matrix);
  target.set(RIDE.ahead * c, RIDE.lookY, -RIDE.ahead * s).applyMatrix4(pose.matrix);
  if (groundAt) clampAboveGround(pos, groundAt);
}

const inv = new THREE.Matrix4(), rot = new THREE.Matrix4();
/** Move pos/target rigidly from the vessel's previous frame to the next, adding the scheduled orbit dYaw. */
export function carryCamera(prev: THREE.Matrix4, next: THREE.Matrix4, dYaw: number, pos: THREE.Vector3, target: THREE.Vector3) {
  inv.copy(prev).invert();
  pos.applyMatrix4(inv); target.applyMatrix4(inv);
  if (dYaw !== 0) { rot.makeRotationY(dYaw); pos.applyMatrix4(rot); target.applyMatrix4(rot); }
  pos.applyMatrix4(next); target.applyMatrix4(next);
}
```

`PoseContext.groundAt` is already set by `<Ancon>` (Task 3). The docked camera stands 8.8 m inland of the shore (back 8 m behind a hull whose tip rests 0.8 m on the bank), 2.8 m from the clearing centre — inside the 22 m clear radius (test).

`Cameras.tsx`:

```tsx
export function Cameras() {
  const ref = useRef<CameraControls>(null);
  const preset = useStore((s) => s.camera);
  const eraId = useStore((s) => s.eraId);
  const riding = useStore((s) => s.camera === 'ride' && s.showAncon);
  const first = useRef(true);

  // Fixed presets (and `ride` when the ferry is hidden with ?ancon=0).
  useEffect(() => {
    if (riding) return;
    const p = CAMERA_POSES[preset];
    ref.current?.setLookAt(...p.pos, ...p.target, !first.current);
    first.current = false;
  }, [preset, riding]);

  // Ride: the vessel carries the camera. Runs right after <Ancon> updates the pose each frame.
  useEffect(() => {
    if (!riding) return;
    const prev = new THREE.Matrix4(), pos = new THREE.Vector3(), tgt = new THREE.Vector3();
    let init = true, lastYaw = 0;
    return onVesselPose((pose, ctx) => {
      const c = ref.current;
      if (!c) return;
      const yaw = rideYaw(pose.clock, ctx.spec.moored);
      if (init) { rideView(pose, ctx.layout, yaw, pos, tgt, ctx.groundAt); init = false; }
      else {
        c.getPosition(pos); c.getTarget(tgt);
        carryCamera(prev, pose.matrix, yaw - lastYaw, pos, tgt);
        if (ctx.groundAt) clampAboveGround(pos, ctx.groundAt);
      }
      c.setLookAt(pos.x, pos.y, pos.z, tgt.x, tgt.y, tgt.z, false);
      c.update(0);
      prev.copy(pose.matrix); lastYaw = yaw;
      first.current = false;
    });
  }, [riding, eraId]);

  return <CameraControls ref={ref} makeDefault minDistance={1} maxDistance={6000} maxPolarAngle={Math.PI * 0.495} />;
}
```

(`CAMERA_POSES.ride` stays as the `?ancon=0` fallback; the listener allocates only on (re)subscribe.)

- [ ] **Step 3: Verify.** `npx vitest run src/ancon/rideCamera.test.ts src/state` → PASS; `npm test`; `npm run build`. In the browser pane (`http://localhost:5173/ancon-de-loiza/?era=1975`): the page opens on the ferry at golden hour; it casts off, the camera travels with it; dragging orbits around the carried target and the ride continues; at the far landing the camera swings round the deck during unload/load; switching `?cam=bank` and back works; no jitter (the camera must not lag the hull by a frame — if it does, check that `c.update(0)` runs after `setLookAt`).

- [ ] **Step 4: Visual check** (the composition gate — the quality-bar reference is a figure on a wooden boat seen from behind and above in misty golden light, reflective water ahead):
  - `?era=1975&cam=ride&c=95&freeze=1`, `?era=1935&cam=ride&c=95&freeze=1`, `?era=1840&cam=ride&c=95&freeze=1`, `?era=1984&cam=ride&c=95&freeze=1`
  - `?era=1975&cam=ride&c=175&freeze=1` (mid-swing at the Torrecilla Baja landing) and `?era=1975&cam=ride&freeze=1` (the default load: docked at Loíza, about to cast off).

  Acceptance: deck and crew in the lower third, horizon and the far bank across the upper third, sun-side glitter or the reflected tree line on the water ahead; the crew is readable (hauler silhouettes against the bright water); no camera inside vegetation or under the bank at either landing; the ropes lead the eye to the far landing in rope eras. Tune `RIDE` only (not the vessel). Commit:

```bash
git add src/ancon src/scene/Cameras.tsx src/state/store.test.ts
git commit -m "$(cat <<'EOF'
feat(camera): ride camera carried by the ferry, the default view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Decade picker; instant era switches (placement + fields caches)

**Files:**
- Create: `src/ui/picker.ts` (+ `picker.test.ts`), `src/ui/DecadePicker.tsx`, `src/vegetation/placementCache.ts` (+ `placementCache.test.ts`), `tests/e2e/picker.spec.ts`
- Modify: `src/state/store.ts` (+ `store.test.ts`), `src/vegetation/Vegetation.tsx`, `src/vegetation/stats.ts`, `src/scene/useWorldFields.ts`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `ERAS`, `ERA_IDS`, `EraId`, `getEra` (eras.ts); `useStore`, `defaultTime`; `PLACEMENT_ORDER`, `SpeciesId`, `PlantInstance`; `buildFields`, `WorldFields`.
- Produces:
  - `stepEra(id: EraId, delta: -1 | 1): EraId` (clamped, no wrap), `withEra(search: string, id: EraId, timeOfDay?: number): string` (sets `era`; rewrites `t` only if the URL already pins it; keeps every other param), `isTypingTarget(t: EventTarget | null): boolean`
  - `<DecadePicker />` — `nav[aria-label="Choose an era"]` with 8 `button`s (`aria-pressed`, `aria-label = "<years> · <label>"`)
  - `shiftTime(t: number, from: EraId, to: EraId): number` (store.ts); `setEra` now keeps the time relative to golden hour (the Phase-6 carry-over "era switch keeps absolute clock time", pulled forward because the picker makes era switches routine)
  - `class KeyedCache<T> { constructor(cap: number); get(key: string, build: () => T): T; readonly size: number }`, `placementKey(dens: Record<SpeciesId, number>, bankOffset: number, tier: string): string`
  - `window.__ANCON_VEG__` also exposed when the URL has `debug=1` (so the prod-build e2e can read `placeRuns`)

Spec §13: a bottom rail of 8 decade buttons, touch-sized for phones, keyboard ← →, updates the URL; the switch is instant (no crossfade — Phase 6); vegetation placement is cached per (densities, bankOffset, tier) so a switch does not stall. The world fields are cached per (extent, size, bankOffset) too — there are only two bank offsets (carry-over from Phase 1).

- [ ] **Step 1: Failing unit tests**

```ts
// src/ui/picker.test.ts
import { expect, test } from 'vitest';
import { isTypingTarget, stepEra, withEra } from './picker';

test('stepEra walks the eras and stops at both ends', () => {
  expect(stepEra('1840', -1)).toBe('1840'); expect(stepEra('1840', 1)).toBe('1900');
  expect(stepEra('1975', 1)).toBe('1984'); expect(stepEra('1986', 1)).toBe('1986');
});
test('withEra sets the era, keeps other params, rewrites t only when the URL pins it', () => {
  expect(withEra('?cam=bank&q=low&freeze=1', '1984')).toBe('?cam=bank&q=low&freeze=1&era=1984');
  expect(withEra('?era=1935&t=17.5&c=40', '1959', 18.123)).toBe('?era=1959&t=18.12&c=40');
  expect(withEra('', '1900', 18)).toBe('?era=1900');
});
test('isTypingTarget is false without an element', () => { expect(isTypingTarget(null)).toBe(false); });
```

```ts
// src/vegetation/placementCache.test.ts
import { expect, test } from 'vitest';
import { getEra, type EraId } from '../data/eras';
import { KeyedCache, placementKey } from './placementCache';
import { PLACEMENT_ORDER } from './rules';
import type { SpeciesId } from './types';

test('builds once per key and evicts the least recently used', () => {
  const c = new KeyedCache<object>(2);
  let builds = 0;
  const mk = () => { builds++; return {}; };
  const a = c.get('a', mk);
  expect(c.get('a', mk)).toBe(a); expect(builds).toBe(1);
  c.get('b', mk); c.get('a', mk); c.get('c', mk);   // b is the least recently used → evicted
  expect(c.size).toBe(2);
  c.get('a', mk); expect(builds).toBe(3);
  c.get('b', mk); expect(builds).toBe(4);
});
test('placement key: equal densities share an entry; bank offset and tier separate them', () => {
  const d = (id: EraId) => Object.fromEntries(PLACEMENT_ORDER.map((s) => [s, getEra(id).vegetation[s].value])) as Record<SpeciesId, number>;
  expect(placementKey(d('1959'), 0, 'high')).toBe(placementKey(d('1975'), 0, 'high'));
  expect(placementKey(d('1935'), 8, 'high')).not.toBe(placementKey(d('1959'), 0, 'high'));
  expect(placementKey(d('1975'), 0, 'high')).not.toBe(placementKey(d('1975'), 0, 'low'));
});
```

```ts
// src/state/store.test.ts — add (after the default-time tests; it mutates the store)
import { shiftTime } from './store';
test('switching era keeps the time relative to that era’s golden hour', () => {
  useStore.setState({ eraId: '1975', timeOfDay: defaultTime('1975') + 0.25 });
  useStore.getState().setEra('1984');
  expect(useStore.getState().eraId).toBe('1984');
  expect(useStore.getState().timeOfDay).toBeCloseTo(defaultTime('1984') + 0.25, 9);
  expect(shiftTime(23.9, '1984', '1975')).toBeLessThanOrEqual(24);
});
```

Run → FAIL.

- [ ] **Step 2: Implement the pure parts**

```ts
// src/ui/picker.ts
import { ERA_IDS, type EraId } from '../data/eras';

export function stepEra(id: EraId, delta: -1 | 1): EraId {
  const i = ERA_IDS.indexOf(id);
  return ERA_IDS[Math.min(ERA_IDS.length - 1, Math.max(0, i + delta))];
}
/** New search string for `id`: other params survive; a pinned ?t follows the era's golden-hour shift. */
export function withEra(search: string, id: EraId, timeOfDay?: number): string {
  const p = new URLSearchParams(search);
  p.set('era', id);
  if (timeOfDay !== undefined && p.has('t')) p.set('t', timeOfDay.toFixed(2));
  return `?${p.toString()}`;
}
export function isTypingTarget(t: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
}
```

```ts
// src/vegetation/placementCache.ts
import { PLACEMENT_ORDER } from './rules';
import type { SpeciesId } from './types';

/** Small LRU cache keyed by string. */
export class KeyedCache<T> {
  private map = new Map<string, T>();
  constructor(private cap: number) {}
  get size() { return this.map.size; }
  get(key: string, build: () => T): T {
    const hit = this.map.get(key);
    if (hit !== undefined) { this.map.delete(key); this.map.set(key, hit); return hit; }
    const v = build();
    this.map.set(key, v);
    if (this.map.size > this.cap) this.map.delete(this.map.keys().next().value as string);
    return v;
  }
}
/** Placement results depend only on (densities, bank offset, tier) — spec §13. */
export const placementKey = (dens: Record<SpeciesId, number>, bankOffset: number, tier: string) =>
  `${tier}|${bankOffset}|${PLACEMENT_ORDER.map((id) => dens[id].toFixed(4)).join(',')}`;
```

`store.ts`:

```ts
export const shiftTime = (t: number, from: EraId, to: EraId) => Math.min(24, Math.max(0, defaultTime(to) + (t - defaultTime(from))));
// in the store:
  setEra: (eraId) => set((s) => ({ eraId, timeOfDay: shiftTime(s.timeOfDay, s.eraId, eraId) })),
```

- [ ] **Step 3: Caches in the scene.** In `Vegetation.tsx`:

```ts
import { KeyedCache, placementKey } from './placementCache';
/** Placement sets for every (densities, bank offset, tier) seen this session (8 eras × 3 tiers at most). */
const placements = new KeyedCache<Record<SpeciesId, PlantInstance[]>>(24);
// inside Vegetation():
  const dens = useMemo(() => {
    const d = {} as Record<SpeciesId, number>;
    for (const id of PLACEMENT_ORDER) d[id] = era.vegetation[id].value * density;
    return d;
  }, [era, density]);
  const key = placementKey(dens, bankOffset, `${near.grid.size}|${far.grid.size}|${farCards}|${farRing}`);
  const sets = useMemo(() => placements.get(key, () => {
    /* the existing body of the old useMemo, using `dens` instead of recomputing it */
  }), [key, near, far]);
```

In `useWorldFields.ts`:

```ts
const fieldsCache = new KeyedCache<WorldFields>(6);
const fieldsFor = (extent: number, size: number, bankOffset: number) =>
  fieldsCache.get(`${extent}|${size}|${bankOffset}`, () => buildFields(geo as unknown as GeoBundle, { extent, size, bankOffset }));
// useMemo body:
  near: fieldsFor(NEAR_EXTENT, q.nearSize, bank), far: fieldsFor(FAR_EXTENT, q.farSize, bank),
```

In `stats.ts` expose `window.__ANCON_VEG__` when `import.meta.env?.DEV || new URLSearchParams(window.location.search).get('debug') === '1'`.

- [ ] **Step 4: The rail**

```tsx
// src/ui/DecadePicker.tsx
import { useCallback, useEffect } from 'react';
import { ERAS, type EraId } from '../data/eras';
import { useStore } from '../state/store';
import { isTypingTarget, stepEra, withEra } from './picker';

/** Minimal era rail (spec §13): 8 buttons, ← → keys, URL kept in sync, instant switch. */
export function DecadePicker() {
  const eraId = useStore((s) => s.eraId);
  const choose = useCallback((id: EraId) => {
    const st = useStore.getState();
    if (id === st.eraId) return;
    st.setEra(id);
    window.history.replaceState(null, '', withEra(window.location.search, id, useStore.getState().timeOfDay));
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || isTypingTarget(e.target)) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      choose(stepEra(useStore.getState().eraId, e.key === 'ArrowLeft' ? -1 : 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose]);
  return (
    <nav className="decade-rail" aria-label="Choose an era">
      {ERAS.map((e) => (
        <button key={e.id} type="button" className="decade-rail__btn" aria-pressed={e.id === eraId}
          aria-label={`${e.years} · ${e.label}`} title={`${e.years} · ${e.label}`} onClick={() => choose(e.id)}>
          <span className="decade-rail__year">{e.id}</span>
          <span className="decade-rail__label">{e.label}</span>
        </button>
      ))}
    </nav>
  );
}
```

Mount `<DecadePicker />` in `App.tsx` after `<TitleCard />`. Styles (`styles.css`) — warm glass rail on the haze, 48 px tall targets, labels hidden on phones, safe-area aware, the title card and OSM credit lifted above it:

```css
.decade-rail { position: fixed; left: 50%; transform: translateX(-50%); bottom: max(12px, env(safe-area-inset-bottom)); z-index: 15;
  width: min(880px, calc(100vw - 16px)); box-sizing: border-box; display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 2px;
  padding: 3px; border-radius: 12px; background: rgba(12, 15, 15, 0.42); border: 1px solid rgba(244, 236, 223, 0.14);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.decade-rail__btn { min-height: 48px; min-width: 0; padding: 4px 2px; border: 0; border-radius: 9px; background: transparent; color: #f4ecdf;
  font: 600 14px/1.1 ui-serif, Georgia, serif; letter-spacing: 0.02em; cursor: pointer; touch-action: manipulation;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; transition: background-color 120ms ease; }
.decade-rail__btn:hover { background: rgba(244, 236, 223, 0.1); }
.decade-rail__btn[aria-pressed='true'] { background: #f4ecdf; color: #1b1a17; }
.decade-rail__btn:focus-visible { outline: 2px solid #f2c46d; outline-offset: 1px; }
.decade-rail__label { font: 500 10px/1.1 ui-sans-serif, system-ui, sans-serif; opacity: 0.75; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 720px) { .decade-rail__label { display: none; } }
@media (prefers-reduced-motion: reduce) { .decade-rail__btn { transition: none; } }
```

and change `.title-card { … bottom: 88px; }`, `.osm-credit { … bottom: calc(max(12px, env(safe-area-inset-bottom)) + 60px); }`.

- [ ] **Step 5: E2E for the picker**

```ts
// tests/e2e/picker.spec.ts
import { expect, test } from '@playwright/test';

test('decade picker switches era, updates the URL, steps with ← →, revisits hit the cache', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('?era=1975&freeze=1&q=low&debug=1');
  await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
  const rail = page.getByRole('navigation', { name: 'Choose an era' });
  await expect(rail.getByRole('button')).toHaveCount(8);
  await expect(rail.getByRole('button', { pressed: true })).toHaveAttribute('aria-label', /1960s–1970s/);
  const runsOf = () => page.evaluate(() => window.__ANCON_VEG__!.placeRuns.length);
  const before = await runsOf();
  await rail.getByRole('button', { name: /1980–1986/ }).click();
  await expect(page).toHaveURL(/era=1984/);
  // 1984 has new densities: wait until its placement has actually run (it happens inside the R3F tree, not with the DOM title).
  await page.waitForFunction((n) => window.__ANCON_VEG__!.placeRuns.length > n, before, { timeout: 30_000 });
  await expect(page.locator('.title-card__era')).toContainText('The steel barge');
  const runs = await runsOf();
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/era=1975/);
  await expect(page.locator('.title-card__era')).toContainText('Weekend outings');
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/era=1984/);
  await expect(page.locator('.title-card__era')).toContainText('The steel barge');
  await page.waitForTimeout(1500);                                                          // let both switches render
  expect(await runsOf()).toBe(runs);   // revisits: no new placement
  await expect(page).toHaveURL(/freeze=1/);
  const box = await rail.getByRole('button').first().boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(errors).toEqual([]);
});

test('phone: the rail fits 375 px without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('?freeze=1&q=low');
  await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  for (const b of await page.getByRole('navigation', { name: 'Choose an era' }).getByRole('button').all()) {
    const r = (await b.boundingBox())!;
    expect(r.width).toBeGreaterThanOrEqual(40); expect(r.height).toBeGreaterThanOrEqual(44);
  }
});
```

- [ ] **Step 6: Verify.** `npm test`, `npm run build`, `npx playwright test tests/e2e/picker.spec.ts` → PASS. In the browser pane at q=high: click through all 8 eras, then again; on the second pass every switch is visually instant (record the main-thread time of one revisit switch with the Performance panel or `performance.now()` around a click in `javascript_tool`, target < 100 ms, and note it in the report; the first visit to a new bank offset still builds fields once). The ferry, rigging, crew and camera rebuild for the new era with no console errors. Commit:

```bash
git add src/ui src/vegetation src/scene/useWorldFields.ts src/state src/App.tsx src/styles.css tests/e2e/picker.spec.ts
git commit -m "$(cat <<'EOF'
feat(ui): decade picker rail with ← → keys; cached placement and fields for instant era switches

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Integration, performance, e2e per vessel kind, README — Phase 3 gate

**Files:**
- Create: `src/scene/FrameSampler.tsx`, `scripts/dev/perf.mjs`, `tests/snapshots/phase3/*.png` (generated)
- Modify: `src/state/url.ts` (+ `url.test.ts`: `perf`), `src/state/store.ts`, `src/App.tsx`, `tests/e2e/world.spec.ts`, `tests/snapshots/README.md`, `README.md`

**Interfaces:**
- Consumes: everything above; `anconTiming` (`window.__ANCON_ANCON__`).
- Produces: `?perf=1` → `UrlState.perf: boolean` / store `perf`; `<FrameSampler />` → `window.__ANCON_PERF__ = { frames: number[] }` (frame times, ms); `node scripts/dev/perf.mjs "<query>" [seconds] [dpr]` → one JSON line `{ query, dpr, fps, meanMs, p95Ms, anconCpuMs }`.

- [ ] **Step 1: Perf plumbing (test first).**

```ts
// src/state/url.test.ts — add
test('parses ?perf=1', () => {
  expect(parseUrlState('?perf=1')).toEqual({ perf: true });
  expect(parseUrlState(toSearch({ perf: true }))).toEqual({ perf: true });
});
```

Implement `perf` in `url.ts` (`if (p.get('perf') === '1') out.perf = true;` / `if (s.perf) p.set('perf', '1');`) and the store (default `false`). Then:

```tsx
// src/scene/FrameSampler.tsx
import { useFrame } from '@react-three/fiber';

declare global { interface Window { __ANCON_PERF__?: { frames: number[] } } }
/** ?perf=1: records frame times (ms) for scripts/dev/perf.mjs. */
export function FrameSampler() {
  const perf = (window.__ANCON_PERF__ ??= { frames: [] });
  useFrame((_, dt) => {
    perf.frames.push(dt * 1000);
    if (perf.frames.length > 6000) perf.frames.splice(0, 1000);
  });
  return null;
}
```

Mount `{perf && <FrameSampler />}` inside the `<Canvas>` in `App.tsx` (`const perf = useStore((s) => s.perf)`).

```js
// scripts/dev/perf.mjs — dev helper (not part of the app).
//   npm run build && npm run preview   (serves :4173)
//   node scripts/dev/perf.mjs "<query>" [seconds=10] [dpr=2]
// Frame times with vsync and the frame-rate cap off; BASE env overrides the server URL.
import { chromium } from '@playwright/test';

const [query = '', secs = '10', dpr = '2'] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://localhost:4173/ancon-de-loiza/';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(dpr) });
await page.goto(`${base}${query}${query.includes('?') ? '&' : '?'}perf=1`);
await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90000 });
await page.waitForTimeout(3000);
await page.evaluate(() => { window.__ANCON_PERF__.frames.length = 0; });
await page.waitForTimeout(Number(secs) * 1000);
const r = await page.evaluate(() => {
  const f = window.__ANCON_PERF__.frames.slice().sort((a, b) => a - b);
  const mean = f.reduce((a, b) => a + b, 0) / f.length;
  return { n: f.length, mean, p95: f[Math.floor(f.length * 0.95)], ancon: window.__ANCON_ANCON__?.cpuMs ?? null };
});
console.log(JSON.stringify({ query, dpr: Number(dpr), fps: +(1000 / r.mean).toFixed(1), meanMs: +r.mean.toFixed(2), p95Ms: +r.p95.toFixed(2), anconCpuMs: r.ancon && +r.ancon.toFixed(3) }));
await browser.close();
```

`npx vitest run src/state` → PASS.

- [ ] **Step 2: Measure.** `npm run build && npm run preview`, then for each of `1840`, `1975`, `1984` (poles, largest wooden platform, steel + most crew):
  - `node scripts/dev/perf.mjs "?era=<id>&cam=ride&q=high" 10 2`
  - `node scripts/dev/perf.mjs "?era=<id>&cam=ride&q=high&ancon=0" 10 2`

  Budget: `meanMs(with) − meanMs(ancon=0) ≤ 1.5` and `fps(with) ≥ 60` at q=high, DPR 2. Also record q=low for 1975 and `anconCpuMs` for all. If over budget, in this order: rope `segments` 40 → 28 on high; figures stop casting shadows beyond 60 m from the camera (a per-frame distance check in `CrewSet`); `uWakeOn = 0` when the camera is > 400 m from the hull; poles/figures skipped in the reflection pass via `reflectionHooks` (hide `crew.group` in `before`, restore in `after`) — the reflection is the costliest extra pass. Report the table (era × with/without × fps/mean/p95/anconCpuMs) in the task report.

- [ ] **Step 3: E2E per vessel kind.** Replace the `SHOTS` table in `tests/e2e/world.spec.ts` and write to `tests/snapshots/phase3/` (keep `phase2a/` as a frozen baseline):

```ts
const SHOTS: { era: EraId; cam: string; t: number; c: number; name?: string }[] = [
  { era: '1935', cam: 'ride', t: golden('1935'), c: 95 },                        // 1-car platform on two taut ropes
  { era: '1975', cam: 'bank', t: golden('1975'), c: 95 },
  { era: '1984', cam: 'aerial', t: +(golden('1984') - 1).toFixed(2), c: 95 },     // wake from above
  { era: '1986', cam: 'mouth', t: golden('1986', 'am'), c: 0 },
  { era: '1840', cam: 'bank', t: golden('1840'), c: 95 },
  { era: '1975', cam: 'ride', t: golden('1975'), c: 95 },
  // Phase 3: one shot per vessel kind, plus docked-with-slack-ropes and moored.
  { era: '1840', cam: 'ride', t: golden('1840'), c: 95 },                        // timber barge, polers, helmsman, Lombera shore rope
  { era: '1925', cam: 'bank', t: golden('1925'), c: 70 },                        // plank platform, push + steer poles
  { era: '1959', cam: 'bank', t: golden('1959'), c: 5, name: '1959-bank-docked' }, // loading, ropes sagging into the water
  { era: '1984', cam: 'ride', t: golden('1984'), c: 95 },                        // steel pontoon, the anconera hauling
  { era: '1986', cam: 'bank', t: golden('1986'), c: 0 },                         // moored and idle
];

for (const s of SHOTS) {
  test(`renders ${s.era} ${s.cam} @${s.t} c=${s.c}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`?era=${s.era}&cam=${s.cam}&t=${s.t}&c=${s.c}&freeze=1&q=medium`);
    await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
    await page.screenshot({ path: `tests/snapshots/phase3/${s.name ?? `${s.era}-${s.cam}`}.png` });
    expect(errors).toEqual([]);
  });
}

test('default view: ride camera at golden hour, the ferry running', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('?freeze=1&q=medium');
  await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
  await page.screenshot({ path: 'tests/snapshots/phase3/default.png' });
  expect(await page.evaluate(() => window.__ANCON_ANCON__?.frames ?? 0)).toBeGreaterThan(0);   // the ferry's frame loop runs
  expect(errors).toEqual([]);
});
```

Run `npm run e2e` → all world + picker tests pass. Update `tests/snapshots/README.md`: `phase2a/` becomes a frozen baseline like `phase1/`; `phase3/` is written by `world.spec.ts`.

- [ ] **Step 4: Art gate.** Review `tests/snapshots/phase3/*.png` next to the quality bar (cinematic golden light and haze, reflective water, a strong third-person composition of people working a wooden boat) and the research (§2.2/§2.3/§7): the vessel reads as its era (small poled barge → plank platform → growing wooden platform → steel pontoon → idle barge), the ropes and poles are legible and physically plausible, the crew's effort reads, clothes and hats read as period, the wake and reflection sit the ferry in the water. Fix in the owning module (builders, `RIDE`, palettes, shader constants) — no new features. Re-run the e2e after tuning.

- [ ] **Step 5: README + ship.** README status line → **Phase 3**: "the hand-powered ferry per era — poled barges, the growing rope-hauled platform, the 1980s steel barge and the idle 1986 barge — crossing between the real landings with its crew and passengers; a decade picker switches eras". Roadmap: `- [x] Phase 3 — The ancón, per era (crossing loop, crew, decade picker)` and note under the list that Phase 3 ran before 2b. If the README documents URL parameters, add `c` (crossing clock start, s), `ancon=0`, `perf=1`. `npm test`, `npm run build`, `npm run e2e`. Commit (do not push — the controller pushes):

```bash
git add README.md tests src scripts
git commit -m "$(cat <<'EOF'
feat(ancon): integrate the ferry per era; perf, e2e per vessel kind; phase 3 gate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review

- **Spec §13 coverage.** Art in code (T3–T6) ✔. Vessel builder per kind with Sourced per-era values: 1840/1900 barge + 1840 shore rope (T1 data, T3 builder, T5 rope), 1925 plank platform with push + steer poles (T3, T7), 1935–1975 wooden platform on stringers with end aprons growing 1 → 4 → 6 cars (T1, T3), 1984 steel pontoon 20 × 7.5 m with welded seams, hinged ramps, curb, rope guides, fouling (T4), 1986 moored idle at Loíza (T2 `mooredState`, T4, T5 mooring lines) ✔. Crossing geometry from the two landings — docks on the waterline nearest each landing coordinate, the 2a clearings re-centred on them (T1) ✔. Propulsion: poles ≤ 1925 (T7), two taut ropes bank post to bank post through deck guides, 2–3 haulers, sag while waiting, one draw call per rope (T5, T7) ✔. Deterministic loop load → castOff → cross → dock → unload + reverse, ~3 min, time-scalable, `?freeze`/`?c` (T2, T3) ✔. Drift along `RIVER_DIR` + crew correction + crab (T2) ✔. Pitch/roll/heave (T2) ✔. Wake/foam in the water shader, vessel in the reflection (T8) ✔. People: primitives, no faces, era palettes, `pole`/`haul`/`stand`/`walk`, crew + a few passengers, no vehicles (T6, T7) ✔. Picker: 8 buttons, touch-sized, ← →, URL, instant, placement cache per (densities, bankOffset, tier) (T10) ✔. `ride` = deck camera on the moving vessel, default view ride at golden hour (T9; store defaults + e2e default shot in T11) ✔. Perf ≤ 1.5 ms / ≥ 60 fps measured (T11) ✔. Tests: state machine (T2), builders sizes + triangle budgets (T3, T4, T6), rope sag (T5), e2e per vessel kind (T11), picker (T10) ✔. Future hook: `useVesselPose()`, `onVesselPose`, deck-local `seatAnchors` with car slots (T2) ✔.
- **Preflight (2026-09-26-phase-3-ancon/preflight.md) — all 26 findings addressed.** F1 docks at the waterline nearest each landing (`nearestShore`), clearings re-centred on the shore points (`landingClearings`, masks.ts), posts and the docked ride camera tested inside the 22 m radius; F2/F3/F11 crossing from the fixed 512 placement fields (`placementFields`), one shared fixture module (`testing.ts`), posts snapped onto land; F4 `ZERO_MATRIX` all zeros; F5/F12 one `STEEL` palette (FOUL greener, RUST darker than the SHELL panels), shell/rake geometry and panel base stated in code; F6/F8 wake strength × (1 − current slack), no `pow` of a negative base; F7 docks precomputed in `makePoseContext`, out-params in rigging, allocation-free `mooredState`/`proportions`/`poseFigure`/RopeSet loops; F9 `PER_KIND` from `PART_GEO`; F10 picker e2e waits for the new era's placement; F13 barge ends at ±hl in code; F14/F15/F21 accepted with rationale lines (T1, T3, Global Constraints); F16 timing note (122–138 m, ≈ 1.0–1.1 m/s) and tests; F17 seat example + epsilon slot test; F18 store test replaced (cast-off within 10 s); F19 `ease.ts`, shared palette/apron helpers, shared fixtures; F20 hauler stations outside car slots (+ test); F22 file map; F23 post material disposed; F24 `advanceClock` integrates dt·speed; F25 helmsman walks after the passengers leave, passengers use a 0.6 m side lane (+ test); F26 bitts at `bittXZ`, mooring lines start at their tops (+ tests).
- **Test code was executed** against the plan's code in a scratch copy of the repo outside `src/` (all unit tests pass, `tsc --noEmit` clean for the modules and the final `<Ancon>`); browser-only painters, the Cameras/DecadePicker/Vegetation wiring and the e2e specs are verified by `npm run build` / `npm run e2e` in the tasks.
- **Carry-over.** Phase 6 items pulled forward because the picker needs them: era switch keeps time relative to golden hour (T10), fields cached per bankOffset (T10). Still parked: crossfade transition (Phase 6), placement in a worker (not needed once cached), noon teal grade and 2b polish.
- **Placeholder scan.** Art steps describe exact dimensions/colours where code is repetitive (barge, plank platform, steel pontoon, textures), following the Phase 2a plan's convention for art generators; every pure module has full code and tests.
- **Names checked across tasks:** `vesselSpec`, `deckLayout`, `DeckLayout.{halfLength, halfBeam, deckY, apron, reach, guideY, ropeZ, lanes, rows}`, `placementFields`, `crossingGeometry`, `nearestShore`, `waterAt`, `dockPoint`, `landingClearings`, `APRON_REST`, `CLEAR_INLAND`, `fields512`, `geom512`, `ctxFor`, `tris`, `clamp01`/`smooth`/`smoothIntegral`/`lerp`/`fract`/`lerpAngle`, `crossingState`, `createCrossingState`, `mooredState`, `advanceClock`, `CROSSING_TIMINGS`, `CrossingTimings`, `legDuration`, `makePoseContext`, `computeVesselPose`, `createVesselPose`, `PoseContext.{dockEast, dockWest, lineLen, groundAt}`, `apronLift`, `sharedVesselPose`, `emitVesselPose`, `onVesselPose`, `useVesselPose`, `seatAnchors`, `haulerStationX`, `haulerZ`, `buildVessel`, `TRI_BUDGET`, `vesselSuite`, `bounds`, `WOOD`, `STEEL`, `woodTone`, `plankApron`, `bittXZ`, `BITT_H`, `vesselMaterials`, `canvasTexture`, `anconTiming`, `spanSag`, `writeSpan`, `writeRopeLine`, `writeTube`, `tubeIndex`, `ropeRig`, `shoreRopePost`, `upstreamSide`, `guideLocal`, `mooringLocal`, `cleatLocal`, `POLE_LEN`, `buildPole`, `RopeSet`, `poseFigure`, `proportions`, `solveTwoBone`, `segmentMatrix`, `ZERO_MATRIX`, `dressFigure`, `FigureBatch`, `PER_KIND`, `castActors`, `actorFrame`, `CrewSet`, `writeWake`, `WAKE_REF`, `wakeUniforms`, `updateWakeUniforms`, `clearWakeUniforms`, `rideYaw`, `rideView`, `carryCamera`, `clampAboveGround`, `stepEra`, `withEra`, `shiftTime`, `KeyedCache`, `placementKey`.
