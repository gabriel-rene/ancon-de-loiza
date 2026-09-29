# Phase 4a — The ferry's place Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per era, draw the roads that matter, both ferry landings, the station on the Loíza bank (shelter → Cortijo house → concrete house with bar terrace, plus the neighbour's house the bridge removed) and the PR-187 bridge (building in 1984, open in 1986); flatten the ground where the ferry docks and rest the steering pole on the bank.

**Architecture:** Terrain gets flat landing pads (`src/terrain/landingPads.ts`), applied once to every cached `WorldFields`. A new `src/infrastructure/` folder holds pure builders (roads, landing, station, bridge) that add primitive pieces to one `PartBuilder` per material, so the whole infrastructure is ≤ 6 merged meshes plus one road strip. Minor roads are not geometry: they are painted into a ground-mask texture that the terrain shader reads (the same pattern as `uCover`). `Infrastructure.tsx` builds the era's parts and writes the mask uniforms.

**Tech Stack:** three 0.186, R3F 9, three-custom-shader-material 6, zustand, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-28-phase-4a-ferry-place-design.md` · Parent: `docs/superpowers/specs/2026-09-26-ancon-loiza-design.md` §3, §4, §8 · Research: `docs/research/ancon-research.md` §1.1, §2.5, §3, §7, §9

## Global Constraints

- World frame: 1 unit = 1 m; +X east, +Y up, +Z south. `WATER_Y = 0`.
- Frame rule (user ruling 2026-09-28): build only what the `ride` camera shows. Full detail only near the landings; the bridge at medium detail; minor roads as ground paint only. Do not add content "for completeness".
- The 2c cane fields and all other plants stay as they are. Only exception: woody plants are kept out of the bridge corridor in the eras that have a bridge (Task 10), so no tree pierces the deck.
- Every era value is `Sourced` (`sources` + `confidence`); guesses set `inferred: true`. Source IDs must exist in `src/data/sources.ts` (note: `S10` is **not** there — do not use it).
- All geometry and textures are made in code. No downloaded files.
- Budget, any era: at most **12 draw calls** from 4a (plus shadow twins) and **40 000 triangles**. Minor roads add **0** triangles.
- Frame rate on every tier stays within **5 %** of the Task 1 baseline mean frame time.
- Builders are deterministic (same inputs ⇒ same geometry).
- Not in 4a: town streets and houses, church, plaza (4b); vehicles, carts, animals, traffic, crowds, passengers walking onto land (4c); aerial-view features.
- Branch `phase-4a-ferry-place`; never push to `main`. Merge only after the user approves.
- Commit message bodies end, after a blank line, with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File map

```
docs/superpowers/notes/phase-4a-rulings.md        baseline numbers, rulings, deferred items (new)
tests/snapshots/phase4a-before/                   baseline screenshots (new, frozen)
tests/snapshots/phase4a/                          after screenshots (written by world.spec.ts)
tests/e2e/world.spec.ts                           default SNAP_DIR phase4a, 4a shots
src/state/url.ts, src/scene/Cameras.tsx           `station`, `bridge` dev camera presets
src/data/eras.ts (+ eras.test.ts)                 `infrastructure` per era
src/terrain/fields.ts                             WorldFields.padded flag
src/terrain/landingPads.ts (+ test)               pure landing pads: frame, height, flatten (new)
src/terrain/placementFields.ts                    flatten pads; landingPadsFor(bank)
src/scene/useWorldFields.ts                       flatten pads on every tier's fields
src/ancon/crew.ts (+ crew.test.ts)                steering-pole tip rests on the ground
src/ancon/CrewSet.ts                              deck-local ground for the crew
src/infrastructure/roads.ts (+ test)              which roads an era shows (new)
src/infrastructure/groundMask.ts (+ test)         roads + dirt painted into a mask (new)
src/scene/groundUniforms.ts, terrainMaterial.ts   uGround, uGroundRect, uRoadSurface
src/infrastructure/roadStrip.ts (+ test)          story-road strip geometry (new)
src/infrastructure/textures.ts, materials.ts      canvas textures + materials (new, browser only)
src/infrastructure/parts.ts (+ test)              one PartBuilder per material; footprint helpers (new)
src/infrastructure/landing.ts (+ test)            landing looks (new)
src/infrastructure/station.ts (+ test)            station layout + houses (new)
src/infrastructure/bridge.ts (+ test)             bridge plan + geometry + corridor (new)
src/infrastructure/build.ts (+ test)              one era's infrastructure, budget (new)
src/infrastructure/Infrastructure.tsx             meshes + ground-mask uniforms (new)
src/scene/World.tsx                               mounts <Infrastructure>
src/vegetation/Vegetation.tsx                     bridge corridor skip
```

---

### Task 1: Branch, dev cameras, shot list, baseline

**Files:**
- Modify: `src/state/url.ts:5-6`, `src/scene/Cameras.tsx:14-25`, `tests/e2e/world.spec.ts`
- Create: `docs/superpowers/notes/phase-4a-rulings.md`, `tests/snapshots/phase4a-before/*.png`

**Interfaces:**
- Produces: camera presets `'station'` and `'bridge'` (URL `?cam=station`, `?cam=bridge`); `world.spec.ts` default folder `phase4a`.

- [ ] **Step 1: Branch**

```bash
git checkout -b phase-4a-ferry-place
```

- [ ] **Step 2: Add the two dev presets**

`src/state/url.ts`:

```ts
export type CameraPreset = 'ride' | 'bank' | 'aerial' | 'mouth' | 'fields' | 'farm' | 'station' | 'bridge';
export const CAMERA_PRESETS: CameraPreset[] = ['ride', 'bank', 'aerial', 'mouth', 'fields', 'farm', 'station', 'bridge'];
```

`src/scene/Cameras.tsx`, in `CAMERA_POSES` after `farm`:

```ts
  // Dev view (phase 4a): from the river, looking at the Loíza landing, the station and its road.
  station: { pos: [ex * 0.3, 6, ez * 0.3], target: [ex + 12, 2, ez + 10] },
  // Dev view (phase 4a): from the Loíza bank, looking upstream at the PR-187 bridge line.
  bridge: { pos: [60, 30, 230], target: [-164, 4, 120] },
```

- [ ] **Step 3: Check both views**

Run `npm run dev` and open in the Browser pane:
- `http://localhost:5173/ancon-de-loiza/?era=1975&cam=station&t=12&freeze=1&q=medium` — expected: the east landing fills the middle of the frame, with open bank on both sides of it (where the houses will stand).
- `http://localhost:5173/ancon-de-loiza/?era=1975&cam=bridge&t=12&freeze=1&q=medium` — expected: the river runs across the frame upstream of the landing, with both banks visible where the bridge line crosses (landmarks `bridgeNorth` (−241, −77) and `bridgeSouth` (−86, 316)).

If a view misses its target, change `pos`/`target` until it does, and write the final numbers in the rulings note.

- [ ] **Step 4: Snapshot folder and the 4a shots**

In `tests/e2e/world.spec.ts` change the default folder:

```ts
/** Output folder under tests/snapshots (SNAP_DIR=phase4a-before for the baseline run). */
const DIR = `tests/snapshots/${process.env.SNAP_DIR ?? 'phase4a'}`;
```

Append to `SHOTS`:

```ts
  // Phase 4a: landings, station, roads, bridge.
  { era: '1900', cam: 'station', t: 12, c: 95, name: '1900-station-noon' },     // shelter, bare bank, sand road
  { era: '1925', cam: 'station', t: 12, c: 95, name: '1925-station-noon' },     // wooden Cortijo house, thatch
  { era: '1959', cam: 'station', t: 12, c: 5, name: '1959-station-docked' },    // timber landing, zinc roofs, ferry docked
  { era: '1975', cam: 'station', t: golden('1975'), c: 95, name: '1975-station' }, // concrete house + bar terrace
  { era: '1984', cam: 'station', t: 12, c: 95, name: '1984-station-noon' },     // neighbour's house gone
  { era: '1984', cam: 'bridge', t: 12, c: 95, name: '1984-bridge-noon' },       // bridge being built, gap, crane
  { era: '1986', cam: 'bridge', t: golden('1986'), c: 0, name: '1986-bridge' }, // bridge open
```

- [ ] **Step 5: Baseline screenshots**

```bash
SNAP_DIR=phase4a-before npx playwright test tests/e2e/world.spec.ts
```

Expected: all pass; PNGs in `tests/snapshots/phase4a-before/`.

- [ ] **Step 6: Baseline frame rate**

```bash
npm run build && npm run preview
```

In a second shell, run each query below with `node scripts/dev/perf.mjs "<query>" 10 2` (for `q=low` use dpr `1`) and record the JSON lines:

- `?era=1975&cam=ride&t=17&c=95&freeze=1&q=high`
- `?era=1984&cam=ride&t=17&c=95&freeze=1&q=high`
- `?era=1975&cam=bank&t=12&c=5&freeze=1&q=high`
- the same three with `q=medium`, and with `q=low`

- [ ] **Step 7: Rulings note**

Create `docs/superpowers/notes/phase-4a-rulings.md`:

```markdown
# Phase 4a rulings and notes

Spec: `docs/superpowers/specs/2026-09-28-phase-4a-ferry-place-design.md`. Plan: `docs/superpowers/plans/2026-09-28-phase-4a-ferry-place.md`.

## Baseline (Task 1)

`station` camera: pos […], target […]. `bridge` camera: pos […], target […].

| query | tier | fps | mean ms | p95 ms |
|---|---|---|---|---|

## Rulings

- Landing-pad math lives in `src/terrain/landingPads.ts` (it edits the terrain height field), not in
  `src/infrastructure/landing.ts` as the spec §4 table says; `landing.ts` keeps the landing meshes.
- The station footprints use research [S9] (street address) only; [S10] is not in `sources.ts`.
- File names differ from spec §4: `roadMesh.ts` → `roadStrip.ts`, `roadMask.ts` → `groundMask.ts` (the mask
  also carries trodden dirt); new helpers `parts.ts` and `build.ts`.
- Needed by the bridge, not in spec §1: in eras with a bridge, woody plants are kept off its line (deck
  half-width + 3 m) so no crown pierces the deck (Task 10). No other plant changes.

## Deferred
```

Fill the table with the Step 6 numbers.

- [ ] **Step 8: Unit tests, commit**

```bash
npm test
git add src/state/url.ts src/scene/Cameras.tsx tests/e2e/world.spec.ts tests/snapshots/phase4a-before docs/superpowers/notes/phase-4a-rulings.md
git commit -m "chore(4a): station and bridge dev cameras, 4a shot list, baseline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Era infrastructure data

**Files:**
- Modify: `src/data/eras.ts`, `src/data/eras.test.ts`

**Interfaces:**
- Produces (in `src/data/eras.ts`):

```ts
export type RoadSurface = 'sand' | 'gravel' | 'asphalt';
export type LandingLook = 'bank' | 'timber' | 'concrete';
export type StationLook = 'shelter' | 'woodThatch' | 'woodZinc' | 'concrete';
export type BridgeState = 'none' | 'building' | 'open';
export interface Infrastructure {
  roadSurface: Sourced<RoadSurface>; landing: Sourced<LandingLook>; station: Sourced<StationLook>;
  neighbourHouse: Sourced<boolean>; bridge: Sourced<BridgeState>;
}
// Era gains: infrastructure: Infrastructure;
```

- [ ] **Step 1: Write the failing test**

In `src/data/eras.test.ts`, add `...(Object.values(e.infrastructure) as Sourced<unknown>[]),` to the end of the `sourcedFields` array, and add inside `describe('eras')`:

```ts
  test('infrastructure per era follows spec 4a §2', () => {
    const col = <K extends keyof (typeof ERAS)[number]['infrastructure']>(k: K) => ERAS.map((e) => e.infrastructure[k].value);
    expect(col('roadSurface')).toEqual(['sand', 'sand', 'sand', 'gravel', 'asphalt', 'asphalt', 'asphalt', 'asphalt']);
    expect(col('landing')).toEqual(['bank', 'bank', 'bank', 'timber', 'timber', 'concrete', 'concrete', 'concrete']);
    expect(col('station')).toEqual(['shelter', 'shelter', 'woodThatch', 'woodZinc', 'woodZinc', 'concrete', 'concrete', 'concrete']);
    expect(col('neighbourHouse')).toEqual([false, false, false, true, true, true, false, false]);
    expect(col('bridge')).toEqual(['none', 'none', 'none', 'none', 'none', 'none', 'building', 'open']);
    // Sourced facts (spec 4a §2): concrete house [S4], the demolition [S4], the bridge dates [S1][S3][S4].
    expect(getEra('1975').infrastructure.station.sources).toContain('S4');
    expect(getEra('1975').infrastructure.station.confidence).toBe('H');
    expect(getEra('1984').infrastructure.neighbourHouse.sources).toContain('S4');
    expect(getEra('1984').infrastructure.bridge.confidence).toBe('H');
    expect(getEra('1986').infrastructure.bridge.sources).toContain('S1');
    // Pure guesses are marked.
    for (const e of ERAS) expect(e.infrastructure.landing.inferred).toBe(true);
    expect(getEra('1935').infrastructure.roadSurface.inferred).toBe(true);
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/data/eras.test.ts`
Expected: FAIL (`infrastructure` is undefined).

- [ ] **Step 3: Implement**

In `src/data/eras.ts`, add the types from **Interfaces** after `Landscape`, add `infrastructure: Infrastructure;` to `Era` after `landscape`, and add before `const ERAS`:

```ts
// Phase 4a (spec 4a §2). Sand camino real before the 20th c. (research §9, S3); PR-187 numbered
// 1953 (S30) — gravel in 1935 and asphalt from 1959 are inferred. Landing looks are inferred from
// "street end on the riverbank" (S9, S26). The Cortijos ran the ancón from 1920 (S1); the concrete
// house is 1960s (S4, S6) with the bar's river terrace (S1, S4; shown from 1975, inferred). A
// house beside the landing was demolished for the bridge (S4); the bridge rose in the early–mid
// 1980s (S4) and opened in 1985 (S1, S3; name S27).
const road = (v: RoadSurface): Sourced<RoadSurface> =>
  v === 'sand' ? s(v, ['S3'], 'M', true) : s(v, ['S30'], 'L', true);
const landing = (v: LandingLook) => s(v, ['S9', 'S26'], 'L', true);
const STATION = {
  shelter: s<StationLook>('shelter', [], 'L', true),
  woodThatch: s<StationLook>('woodThatch', ['S1'], 'L', true),
  woodZinc: s<StationLook>('woodZinc', ['S1', 'S4'], 'L', true),
  concrete: s<StationLook>('concrete', ['S4', 'S6'], 'H'),
};
const NEIGHBOUR_NONE = s(false, [], 'L', true), NEIGHBOUR = s(true, ['S4'], 'L', true), NEIGHBOUR_GONE = s(false, ['S4'], 'H');
const NO_BRIDGE = s<BridgeState>('none', ['S1', 'S4'], 'H');
const INFRA = {
  '1840': { roadSurface: road('sand'), landing: landing('bank'), station: STATION.shelter, neighbourHouse: NEIGHBOUR_NONE, bridge: NO_BRIDGE },
  '1900': { roadSurface: road('sand'), landing: landing('bank'), station: STATION.shelter, neighbourHouse: NEIGHBOUR_NONE, bridge: NO_BRIDGE },
  '1925': { roadSurface: road('sand'), landing: landing('bank'), station: STATION.woodThatch, neighbourHouse: NEIGHBOUR_NONE, bridge: NO_BRIDGE },
  '1935': { roadSurface: road('gravel'), landing: landing('timber'), station: STATION.woodZinc, neighbourHouse: NEIGHBOUR, bridge: NO_BRIDGE },
  '1959': { roadSurface: road('asphalt'), landing: landing('timber'), station: STATION.woodZinc, neighbourHouse: NEIGHBOUR, bridge: NO_BRIDGE },
  '1975': { roadSurface: road('asphalt'), landing: landing('concrete'), station: STATION.concrete, neighbourHouse: NEIGHBOUR, bridge: NO_BRIDGE },
  '1984': { roadSurface: road('asphalt'), landing: landing('concrete'), station: STATION.concrete, neighbourHouse: NEIGHBOUR_GONE,
    bridge: s<BridgeState>('building', ['S4'], 'H') },
  '1986': { roadSurface: road('asphalt'), landing: landing('concrete'), station: STATION.concrete, neighbourHouse: NEIGHBOUR_GONE,
    bridge: s<BridgeState>('open', ['S1', 'S3', 'S27'], 'H') },
} satisfies Record<EraId, Infrastructure>;
```

Then add `infrastructure: INFRA['<id>'],` to each `ERAS` entry, after `landscape: LAND['<id>'],`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/data/eras.test.ts` → PASS. Then `npm test` and `npx tsc -p tsconfig.json --noEmit` → no errors.

- [ ] **Step 5: Commit**

```bash
git add src/data/eras.ts src/data/eras.test.ts
git commit -m "feat(eras): infrastructure per era (roads, landing, station, bridge)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Flat landing pads in the terrain

**Files:**
- Create: `src/terrain/landingPads.ts`, `src/terrain/landingPads.test.ts`
- Modify: `src/terrain/fields.ts:12-24` (interface), `src/terrain/placementFields.ts`, `src/scene/useWorldFields.ts:15-17`

**Interfaces:**
- Consumes: `crossingGeometry(f)`, `XZ` from `src/ancon/geometry.ts`; `sampleField`, `WorldFields` from `src/terrain/fields.ts`.
- Produces:

```ts
// src/terrain/landingPads.ts
export interface LandingPad {
  side: 'east' | 'west';
  /** The ferry's shore point (waterline) on this bank. */
  shore: XZ;
  /** Unit vector pointing inland (away from the river). */
  inland: XZ;
  /** Unit vector = inland turned 90° (world [-inland.z, inland.x]); local +Z of a footprint with yaw padYaw(p). */
  lateral: XZ;
  /** Original ground height 2 m past the pad's inland end (m, ≥ PAD.shoreY). */
  hInland: number;
}
export const PAD: { length: 16; halfWidth: 5; wet: 4; margin: 6; shoreY: 0.3; wetY: -0.5 };
export function padFrame(p: LandingPad, x: number, z: number): [a: number, v: number];
export function padPoint(p: LandingPad, a: number, v: number): [number, number];
export function padYaw(p: LandingPad): number;          // rotY that turns local +X onto p.inland
export function padHeight(p: LandingPad, a: number): number;
export function landingPads(f: WorldFields): [LandingPad, LandingPad];   // [east, west]
export function flattenLandings(f: WorldFields, pads: readonly LandingPad[]): void;
// src/terrain/placementFields.ts
export function landingPadsFor(bankOffset: number, fresh?: WorldFields): [LandingPad, LandingPad];
// WorldFields gains: padded?: boolean
```

- [ ] **Step 1: Write the failing test**

`src/terrain/landingPads.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { APRON_REST } from '../ancon/geometry';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { buildFields, sampleField, type WorldFields } from './fields';
import { flattenLandings, PAD, padFrame, padHeight, padPoint, type LandingPad } from './landingPads';
import { landingPadsFor, placementFields } from './placementFields';

const G = geo as unknown as GeoBundle;
const cellCentres = (f: WorldFields, p: LandingPad, keep: (a: number, v: number) => boolean) => {
  const out: { k: number; a: number; v: number }[] = [], g = f.grid;
  for (let j = 0; j < g.size; j++) for (let i = 0; i < g.size; i++) {
    const x = g.minX + (i + 0.5) * g.cell, z = g.minZ + (j + 0.5) * g.cell, [a, v] = padFrame(p, x, z);
    if (keep(a, v)) out.push({ k: j * g.size + i, a, v });
  }
  return out;
};

describe('landing pads', () => {
  for (const bank of [0, 8]) {
    const f = placementFields(bank), pads = landingPadsFor(bank);
    test(`bank ${bank}: every grid vertex inside a pad sits on the pad profile`, () => {
      for (const p of pads) {
        const inside = cellCentres(f, p, (a, v) => a >= -PAD.wet && a <= PAD.length && Math.abs(v) <= PAD.halfWidth);
        expect(inside.length).toBeGreaterThan(4);
        for (const c of inside) expect(f.height[c.k]).toBeCloseTo(padHeight(p, c.a), 5);
      }
    });
    test(`bank ${bank}: the pad is level across and never drops going inland`, () => {
      for (const p of pads) {
        for (const a of [2, 6, 10, 14]) {
          // Bilinear over 5 m cells also reads cells in the blend margin, so this is looser than the vertex test above.
          const hs = [-2, 0, 2].map((v) => padHeight(p, a) - sampleField(f, f.height, ...padPoint(p, a, v)));
          expect(Math.max(...hs) - Math.min(...hs)).toBeLessThan(0.2);
        }
        let prev = -Infinity;
        for (let a = -PAD.wet; a <= PAD.length; a += 0.5) { const h = padHeight(p, a); expect(h).toBeGreaterThanOrEqual(prev - 1e-9); prev = h; }
      }
    });
    test(`bank ${bank}: the ferry's end rests on the pad`, () => {
      for (const p of pads) {
        const [x, z] = padPoint(p, APRON_REST, 0);
        // The ferry samples the same bilinear field; within 0.2 m of the pad the apron still reads as resting on it.
        expect(Math.abs(sampleField(f, f.height, x, z) - padHeight(p, APRON_REST))).toBeLessThan(0.2);
        expect(padHeight(p, 0)).toBe(PAD.shoreY);
      }
    });
    test(`bank ${bank}: ground beyond the margin is untouched`, () => {
      const raw = buildFields(G, { extent: 2560, size: 512, bankOffset: bank });
      for (const p of pads) {
        const far = cellCentres(f, p, (a, v) => a > PAD.length + PAD.margin + 1 && a < PAD.length + 30 && Math.abs(v) < 10);
        for (const c of far) expect(f.height[c.k]).toBe(raw.height[c.k]);
      }
    });
  }
  test('flattening twice changes nothing; coarse tiers get the same pad', () => {
    const f = placementFields(0), before = f.height.slice();
    flattenLandings(f, landingPadsFor(0));
    expect(f.height).toEqual(before);
    const low = buildFields(G, { extent: 2560, size: 256, bankOffset: 0 }), pads = landingPadsFor(0);
    flattenLandings(low, pads);
    for (const p of pads) for (const c of cellCentres(low, p, (a, v) => a >= 0 && a <= PAD.length && Math.abs(v) <= PAD.halfWidth))
      expect(low.height[c.k]).toBeCloseTo(padHeight(p, c.a), 5);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/terrain/landingPads.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/terrain/fields.ts` — add to `WorldFields` (after `waterInfo`):

```ts
  /** Set once the ferry landing pads are flattened in (Phase 4a, landingPads.ts). */
  padded?: boolean;
```

`src/terrain/landingPads.ts`:

```ts
import { crossingGeometry, type XZ } from '../ancon/geometry';
import { sampleField, type WorldFields } from './fields';

/**
 * Flat landing pads (Phase 4a, carry-over from Phase 3): at each ferry shore point the bank becomes a
 * level ramp — flat across, rising gently inland — so the ferry's end boards meet flat ground and the
 * landing meshes sit on it. Pad frame: `a` metres inland from the shore point (negative = into the
 * water), `v` metres to the side. Lengths inferred (L).
 */
export interface LandingPad {
  side: 'east' | 'west';
  shore: XZ;
  inland: XZ;
  lateral: XZ;
  hInland: number;
}
export const PAD = { length: 16, halfWidth: 5, wet: 4, margin: 6, shoreY: 0.3, wetY: -0.5 } as const;

const smooth = (t: number) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };

export function padFrame(p: LandingPad, x: number, z: number): [number, number] {
  const dx = x - p.shore[0], dz = z - p.shore[1];
  return [dx * p.inland[0] + dz * p.inland[1], dx * p.lateral[0] + dz * p.lateral[1]];
}
export const padPoint = (p: LandingPad, a: number, v: number): [number, number] =>
  [p.shore[0] + p.inland[0] * a + p.lateral[0] * v, p.shore[1] + p.inland[1] * a + p.lateral[1] * v];
/** three.js rotY convention: local +X → (cos, 0, −sin). */
export const padYaw = (p: LandingPad) => Math.atan2(-p.inland[1], p.inland[0]);

/**
 * Pad surface height at `a` (clamped to the pad): level at shoreY for the first 1.5 m into the water (the
 * ferry's end rests there), then down to wetY; inland it rises to hInland.
 */
export function padHeight(p: LandingPad, a: number): number {
  if (a <= 0) return PAD.shoreY + (PAD.wetY - PAD.shoreY) * smooth((-a - 1.5) / (PAD.wet - 1.5));
  return PAD.shoreY + (p.hInland - PAD.shoreY) * smooth(Math.min(a, PAD.length) / PAD.length);
}

/** Both pads from the ferry's crossing geometry on `f` (read before `f` is flattened). */
export function landingPads(f: WorldFields): [LandingPad, LandingPad] {
  const g = crossingGeometry(f);
  const mk = (side: 'east' | 'west', shore: XZ, inland: XZ): LandingPad => {
    const x = shore[0] + inland[0] * (PAD.length + 2), z = shore[1] + inland[1] * (PAD.length + 2);
    return { side, shore, inland, lateral: [-inland[1], inland[0]], hInland: Math.max(PAD.shoreY, sampleField(f, f.height, x, z)) };
  };
  return [mk('east', g.shoreEast, [-g.dir[0], -g.dir[1]]), mk('west', g.shoreWest, [g.dir[0], g.dir[1]])];
}

/** Blend the pads into `f.height` (full inside, fading out over PAD.margin). Runs once per fields object. */
export function flattenLandings(f: WorldFields, pads: readonly LandingPad[]) {
  if (f.padded) return;
  const { size, cell, minX, minZ } = f.grid, reach = PAD.length + PAD.wet + PAD.margin + PAD.halfWidth;
  for (const p of pads) {
    const i0 = Math.max(0, Math.floor((p.shore[0] - reach - minX) / cell)), i1 = Math.min(size - 1, Math.ceil((p.shore[0] + reach - minX) / cell));
    const j0 = Math.max(0, Math.floor((p.shore[1] - reach - minZ) / cell)), j1 = Math.min(size - 1, Math.ceil((p.shore[1] + reach - minZ) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * size + i, [a, v] = padFrame(p, minX + (i + 0.5) * cell, minZ + (j + 0.5) * cell);
      const out = Math.max(0, -PAD.wet - a, a - PAD.length, Math.abs(v) - PAD.halfWidth);
      if (out >= PAD.margin) continue;
      const w = 1 - smooth(out / PAD.margin), t = padHeight(p, Math.min(PAD.length, Math.max(-PAD.wet, a)));
      f.height[k] += (t - f.height[k]) * w;
      if (f.water[k]) f.waterInfo[k * 4] = Math.min(255, (Math.max(0, -f.height[k]) / 15) * 255);
    }
  }
  f.padded = true;
}
```

`src/terrain/placementFields.ts` — replace the file body below the imports with:

```ts
import { flattenLandings, landingPads, type LandingPad } from './landingPads';

export const PLACE_SIZE = 512, PLACE_EXTENT = 2560;
const cache = new Map<number, WorldFields>();
const pads = new Map<number, [LandingPad, LandingPad]>();

/**
 * The ferry landing pads for a bank offset, from the fixed 512 placement fields (read before they are
 * flattened), so every tier gets the same pads. `fresh`: an unflattened 512 near grid to read them from.
 */
export function landingPadsFor(bankOffset: number, fresh?: WorldFields): [LandingPad, LandingPad] {
  let p = pads.get(bankOffset);
  if (!p && fresh) { p = landingPads(fresh); pads.set(bankOffset, p); }
  if (!p) { placementFields(bankOffset); p = pads.get(bankOffset)!; }
  return p;
}

/** Returns `near` itself when it already is the 512 grid (high tier), else a cached build per bank offset. */
export function placementFields(bankOffset: number, near?: WorldFields): WorldFields {
  if (near && near.grid.size === PLACE_SIZE && near.grid.cell * near.grid.size === PLACE_EXTENT) return near;
  let f = cache.get(bankOffset);
  if (!f) {
    f = buildFields(geo as unknown as GeoBundle, { extent: PLACE_EXTENT, size: PLACE_SIZE, bankOffset });
    flattenLandings(f, landingPadsFor(bankOffset, f));
    cache.set(bankOffset, f);
  }
  return f;
}
```

(Keep the existing doc comment above `PLACE_SIZE` and the existing imports.)

`src/scene/useWorldFields.ts` — replace `fieldsFor`:

```ts
import { flattenLandings } from '../terrain/landingPads';
import { landingPadsFor, PLACE_EXTENT, PLACE_SIZE } from '../terrain/placementFields';

/** Fields depend only on (extent, size, bank offset) — there are only two bank offsets (Phase 1). Landing pads are flattened in (4a). */
const fieldsCache = new KeyedCache<WorldFields>(6);
const fieldsFor = (extent: number, size: number, bankOffset: number) =>
  fieldsCache.get(`${extent}|${size}|${bankOffset}`, () => {
    const f = buildFields(geo as unknown as GeoBundle, { extent, size, bankOffset });
    flattenLandings(f, extent === PLACE_EXTENT && size === PLACE_SIZE ? landingPadsFor(bankOffset, f) : landingPadsFor(bankOffset));
    return f;
  });
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/terrain` → PASS. Then `npm test` → all pass. If a vegetation or ancon test that pins heights near a landing fails, the pad is the cause: check the failure is inside the pad or its margin (≤ 22 m from a shore point); if so, update that expectation and write a line in the rulings note; if not, stop and report.

- [ ] **Step 5: Look at it**

`npm run dev`, open `?era=1975&cam=station&t=12&freeze=1&q=medium` and `?era=1840&cam=bank&t=12&c=5&freeze=1&q=medium`. Expected: a smooth, level strip of bank where the ferry docks; no step or spike at its edges; the ferry's end boards touch it.

- [ ] **Step 6: Commit**

```bash
git add src/terrain src/scene/useWorldFields.ts
git commit -m "feat(terrain): flat landing pads where the ferry docks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The steering pole rests on the bank

The helmsman steers from the trailing end. While docked, that end faces the bank, and the pole (which trails down to 0.5 m below the waterline) goes into the ground. Now the tip stops on the ground.

**Files:**
- Modify: `src/ancon/crew.ts:35`, `:166-179`, `:337` (`helmsman`), `src/ancon/CrewSet.ts:44-58`, `src/ancon/crew.test.ts`

**Interfaces:**
- Produces:

```ts
// src/ancon/crew.ts
export interface ActorCtx {
  spec: VesselSpec; layout: DeckLayout;
  /** Deck-local ground height (m) under deck-local (x, z); omitted = no ground (poles may go anywhere). */
  groundLocal?: (x: number, z: number) => number;
}
export const TIP_REST = 0.03;   // the tip rests this far above the ground
```

- [ ] **Step 1: Write the failing test**

Append to `describe('choreography')` in `src/ancon/crew.test.ts`:

```ts
  test('docked, the steering pole tip rests on the bank instead of going into it', () => {
    for (const id of ['1840', '1900', '1925'] as const) {
      const s = setup(id), helm = s.actors.find((a) => a.role === 'helmsman')!;
      const bank = 0.45, ground = { ...s, groundLocal: (x: number) => (Math.abs(x) > s.layout.halfLength ? bank : -3) };
      for (const c of [5, 10, 15]) {   // load phase: docked
        const f = actorFrame(helm, crossingState(c, createCrossingState()), c, ground, createActorFrame());
        if (!f.hasPole) continue;
        const tip = f.poleTip;
        if (Math.abs(tip[0]) > s.layout.halfLength) expect(tip[1], `${id} c=${c}`).toBeGreaterThanOrEqual(bank + 0.03 - 0.02);
        expect(Math.hypot(f.poleTop[0] - tip[0], f.poleTop[1] - tip[1], f.poleTop[2] - tip[2])).toBeCloseTo(POLE_LEN, 3);
      }
      // Mid-river (ground far below) the pole still trails into the water as before.
      const mid = actorFrame(helm, crossingState(MID, createCrossingState()), MID, ground, createActorFrame());
      expect(mid.poleTip[1]).toBeLessThan(0);
    }
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/ancon/crew.test.ts -t "rests on the bank"`
Expected: FAIL (tip below the bank height).

- [ ] **Step 3: Implement**

`src/ancon/crew.ts`: replace the `ActorCtx` line with the interface from **Interfaces**, and add `TIP_REST` next to `STEER_DEPTH`:

```ts
/** A pole tip on the ground rests this far above it. */
export const TIP_REST = 0.03;
```

Replace `steerShape` (lines 166–179) with:

```ts
/** The steering pole is held by its top end (STEER_GRIP below the top), so none of it overhangs the deck crowd. */
const STEER_GRIP = 0.4;
/** Set the pole from the lower hand `o.hl` along the trailing direction, dropping `dy` per metre. */
function steerAlong(dy: number, along: number, tr: number, sweep: number, o: PoleShape) {
  const hz = Math.sqrt(1 - dy * dy), c = Math.cos(sweep), s = Math.sin(sweep), bx = -tr, bz = 0;
  const dx = (bx * c + bz * s) * hz, dz = (-bx * s + bz * c) * hz;
  set3(o.hr, o.hl[0] + dx * 0.5, o.hl[1] + dy * 0.5, o.hl[2] + dz * 0.5);
  set3(o.tip, o.hl[0] + dx * along, o.hl[1] + dy * along, o.hl[2] + dz * along);
  set3(o.top, o.tip[0] - dx * POLE_LEN, o.tip[1] - dy * POLE_LEN, o.tip[2] - dz * POLE_LEN);
}
function steerShape(xEnd: number, tr: number, sweep: number, L: DeckLayout, o: PoleShape, ground?: (x: number, z: number) => number): PoleShape {
  // Hands 0.25 m in front of him (he stands on the centreline facing +z): clear of the boarding lane at z = 0.6.
  set3(o.hl, xEnd + tr * 0.25, L.deckY + 1.15, 0.25);
  // Trailing aft and down to STEER_DEPTH below the waterline, swept slowly about the vertical — unless the
  // ground (the bank, while docked) is higher there: then the tip rests on it (two passes: the tip moves a little).
  const along = POLE_LEN - STEER_GRIP;
  steerAlong(-(o.hl[1] + STEER_DEPTH) / along, along, tr, sweep, o);
  if (ground) for (let i = 0; i < 2; i++) {
    const fy = ground(o.tip[0], o.tip[2]) + TIP_REST;
    if (o.tip[1] >= fy - 1e-4) break;
    steerAlong(Math.min(0, Math.max(-1, (fy - o.hl[1]) / along)), along, tr, sweep, o);
  }
  return o;
}
```

In `helmsman`, change the destructuring to `{ layout: L, groundLocal }: ActorCtx` and pass `groundLocal` as the last argument of both `steerShape(...)` calls.

`src/ancon/CrewSet.ts`: give the crew the deck-local ground. Add below the `_w, _p` line:

```ts
const _g = new THREE.Vector3();
```

Add these fields to the class (after `poleMat`):

```ts
  private ground?: (x: number, z: number) => number;
  private pose?: VesselPose;
  /** Deck-local ground height under deck-local (x, z). Docked, pitch and roll are ≈ 0, so world Y − hull Y. */
  private readonly groundLocal = (x: number, z: number) => {
    const p = this.pose!;
    _g.set(x, 0, z).applyMatrix4(p.matrix);
    return this.ground!(_g.x, _g.z) - p.position.y;
  };
  private readonly actx: ActorCtx = { spec: undefined!, layout: undefined! };
```

Replace the start of `update`:

```ts
  update(pose: VesselPose, ctx: ActorCtx & { groundAt?: (x: number, z: number) => number }) {
    this.pose = pose; this.ground = ctx.groundAt;
    const actx = this.actx;
    actx.spec = ctx.spec; actx.layout = ctx.layout; actx.groundLocal = ctx.groundAt ? this.groundLocal : undefined;
    let pi = 0;
    for (let i = 0; i < this.actors.length; i++) {
      const f = actorFrame(this.actors[i], pose.state, pose.clock, actx, this.frames[i]);
```

(The rest of `update` is unchanged. `Ancon.tsx` already passes its `PoseContext`, which carries `groundAt`.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ancon` → PASS (all existing crew tests still pass: they pass no ground).

- [ ] **Step 5: Look at it**

`npm run dev`, open `?era=1925&cam=bank&t=12&c=5&freeze=1&q=medium`. Expected: the helmsman's pole reaches back and its tip rests on the landing, not inside it.

- [ ] **Step 6: Commit**

```bash
git add src/ancon/crew.ts src/ancon/CrewSet.ts src/ancon/crew.test.ts
git commit -m "fix(ancon): docked steering pole rests on the bank

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Which roads, painted into the ground

**Files:**
- Create: `src/infrastructure/roads.ts`, `src/infrastructure/roads.test.ts`, `src/infrastructure/groundMask.ts`, `src/infrastructure/groundMask.test.ts`
- Modify: `src/scene/groundUniforms.ts`, `src/scene/terrainMaterial.ts`

**Interfaces:**
- Consumes: `GeoBundle`, `XZ` from `src/data/geo/types.ts`; `Era`, `RoadSurface` from `src/data/eras.ts`.
- Produces:

```ts
// src/infrastructure/roads.ts
export type StoryId = 'antigua' | 'escobar' | 'approach';
export const STORY_WAYS: Record<StoryId, string>;       // OSM way ids
export const BRIDGE_WAY = '204521442';
export const STORY_WIDTH: Record<StoryId, number>;
export const ROAD_WIDTH: Record<string, number>;          // by OSM kind
export interface StoryRoad { id: StoryId; points: XZ[]; width: number }
export interface SimpleRoad { id: string; points: XZ[]; width: number }
export interface EraRoads { story: StoryRoad[]; simple: SimpleRoad[]; surface: RoadSurface }
export function eraRoads(geo: GeoBundle, era: Era): EraRoads;
export const bridgeWay: (geo: GeoBundle) => XZ[];
// src/infrastructure/groundMask.ts
/** An oriented rectangle of trodden dirt: centre, unit axis of its `hu` side, half sizes (m). */
export interface DirtPatch { c: XZ; axis: XZ; hu: number; hv: number }
export const MASK: { size: 1024; extent: 2560; soft: 1.25; shoulder: 1.5 };
export interface GroundMask { data: Uint8Array; size: number; rect: [number, number, number] }  // RGBA: R road, G dirt
export function groundMask(roads: EraRoads, dirt: readonly DirtPatch[]): GroundMask;
export const SURFACE_INDEX: Record<RoadSurface, number>;  // sand 0, gravel 1, asphalt 2
// src/scene/groundUniforms.ts gains: uGround (texture), uGroundRect (Vector4), uRoadSurface ({ value: number }); export NO_GROUND
```

- [ ] **Step 1: Write the failing tests**

`src/infrastructure/roads.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { ERAS, getEra } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { BRIDGE_WAY, eraRoads, STORY_WAYS } from './roads';

const G = geo as unknown as GeoBundle;

describe('era roads', () => {
  test('story roads: both landing roads always; the bridge approach only with a bridge', () => {
    for (const e of ERAS) {
      const ids = eraRoads(G, e).story.map((r) => r.id).sort();
      expect(ids).toEqual(e.infrastructure.bridge.value === 'none' ? ['antigua', 'escobar'] : ['antigua', 'approach', 'escobar']);
    }
  });
  test('simple roads: main kinds only — no residential, service, bridges or story ways', () => {
    const story = new Set([...Object.values(STORY_WAYS), BRIDGE_WAY]);
    const byId = new Map(G.roads.map((r) => [r.id, r]));
    for (const e of ERAS) for (const r of eraRoads(G, e).simple) {
      const src = byId.get(r.id)!;
      expect(['secondary', 'secondary_link', 'tertiary', 'track', 'path', 'footway']).toContain(src.kind);
      expect(src.bridge).toBe(false);
      expect(story.has(r.id)).toBe(false);
    }
    const n = eraRoads(G, getEra('1975')).simple.length;
    expect(n).toBeGreaterThan(10); expect(n).toBeLessThan(40);   // "only a handful": ~30 of 263
  });
  test('PR-951 and PR-188 appear from 1935', () => {
    const refs = (id: '1925' | '1935') => new Set(eraRoads(G, getEra(id)).simple.map((r) => G.roads.find((x) => x.id === r.id)!.ref));
    expect(refs('1925').has('PR-951')).toBe(false);
    expect(refs('1935').has('PR-951')).toBe(true);
  });
  test('surface follows the era', () => {
    expect(ERAS.map((e) => eraRoads(G, e).surface)).toEqual(ERAS.map((e) => e.infrastructure.roadSurface.value));
  });
});
```

`src/infrastructure/groundMask.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { getEra } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle, XZ } from '../data/geo/types';
import { groundMask, MASK, type GroundMask } from './groundMask';
import { eraRoads } from './roads';

const G = geo as unknown as GeoBundle;
const at = (m: GroundMask, [x, z]: XZ, ch: 0 | 1) => {
  const i = Math.floor((x - m.rect[0]) / (m.rect[2] / m.size)), j = Math.floor((z - m.rect[1]) / (m.rect[2] / m.size));
  return m.data[(j * m.size + i) * 4 + ch];
};
const way = (id: string) => G.roads.find((r) => r.id === id)!;
const mid = (id: string): XZ => { const p = way(id).points; return p[Math.floor(p.length / 2)]; };

describe('ground mask', () => {
  const roads = eraRoads(G, getEra('1975'));
  const m = groundMask(roads, [{ c: [300, -300], axis: [1, 0], hu: 6, hv: 4 }]);
  test('covers the near extent', () => {
    expect(m.size).toBe(MASK.size);
    expect(m.rect).toEqual([-MASK.extent / 2, -MASK.extent / 2, MASK.extent]);
  });
  test('roads are painted at full weight on their centre line; far from roads nothing', () => {
    expect(at(m, mid('1058673941'), 0)).toBe(255);   // Antigua PR-187 (story, painted as its shoulder)
    expect(at(m, mid('22182312'), 0)).toBe(255);     // PR-187 through town (simple)
    expect(at(m, [1100, -1100], 0)).toBe(0);
  });
  test('residential streets are not painted', () => {
    const calleA = way('22179633').points[0];        // "Calle A", residential
    expect(at(m, calleA, 0)).toBe(0);
  });
  test('dirt patches go to G, soft at the edge', () => {
    expect(at(m, [300, -300], 1)).toBe(255);
    expect(at(m, [300 + 6 + MASK.soft + 1, -300], 1)).toBe(0);
  });
  test('no bridge approach before 1984', () => {
    const early = groundMask(eraRoads(G, getEra('1975')), []), late = groundMask(eraRoads(G, getEra('1986')), []);
    expect(at(early, mid('204521441'), 0)).toBe(0);
    expect(at(late, mid('204521441'), 0)).toBe(255);
  });
});
```

If `Calle A`'s first point or the `204521441` midpoint happens to lie on another painted road, pick another point of the same way that does not (and say so in the test comment).

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/infrastructure`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/infrastructure/roads.ts`:

```ts
import type { Era, RoadSurface } from '../data/eras';
import type { GeoBundle, XZ } from '../data/geo/types';

/**
 * Only a handful of roads (user ruling 2026-09-28, spec 4a §3): three story roads drawn as real strips
 * (roadStrip.ts), and the main roads and paths painted into the ground mask. Residential and service
 * streets are left out (4b may bring a few back).
 */
export type StoryId = 'antigua' | 'escobar' | 'approach';
export const STORY_WAYS: Record<StoryId, string> = { antigua: '1058673941', escobar: '22182236', approach: '204521441' };
export const BRIDGE_WAY = '204521442';
/** Widths (m), inferred. */
export const STORY_WIDTH: Record<StoryId, number> = { antigua: 5, escobar: 6, approach: 9 };
export const ROAD_WIDTH: Record<string, number> = { secondary: 7, secondary_link: 5, tertiary: 6, track: 3.5, path: 1.5, footway: 1.5 };
/** Numbered roads shown only from 1935 (inferred, L). */
const FROM_1935 = new Set(['PR-951', 'PR-188']);

export interface StoryRoad { id: StoryId; points: XZ[]; width: number }
export interface SimpleRoad { id: string; points: XZ[]; width: number }
export interface EraRoads { story: StoryRoad[]; simple: SimpleRoad[]; surface: RoadSurface }

const way = (geo: GeoBundle, id: string) => {
  const r = geo.roads.find((x) => x.id === id);
  if (!r) throw new Error(`OSM way ${id} missing from loiza.json`);
  return r;
};
export const bridgeWay = (geo: GeoBundle) => way(geo, BRIDGE_WAY).points;

export function eraRoads(geo: GeoBundle, era: Era): EraRoads {
  const bridge = era.infrastructure.bridge.value !== 'none';
  const ids: StoryId[] = bridge ? ['antigua', 'escobar', 'approach'] : ['antigua', 'escobar'];
  const story = ids.map((id) => ({ id, points: way(geo, STORY_WAYS[id]).points, width: STORY_WIDTH[id] }));
  const skip = new Set([...Object.values(STORY_WAYS), BRIDGE_WAY]);
  const year = Number(era.id);
  const simple = geo.roads
    .filter((r) => r.kind in ROAD_WIDTH && !r.bridge && !skip.has(r.id) && !(r.ref && FROM_1935.has(r.ref) && year < 1935))
    .map((r) => ({ id: r.id, points: r.points, width: ROAD_WIDTH[r.kind] }));
  return { story, simple, surface: era.infrastructure.roadSurface.value };
}
```

`src/infrastructure/groundMask.ts`:

```ts
import type { RoadSurface } from '../data/eras';
import type { XZ } from '../data/geo/types';
import type { EraRoads } from './roads';

/** An oriented rectangle of trodden dirt (landings, dooryards, the bare lot of a demolished house). */
export interface DirtPatch { c: XZ; axis: XZ; hu: number; hv: number }
/** 1024² over the 2560 m near extent (2.5 m texels); soft edge and story-road shoulder in metres. */
export const MASK = { size: 1024, extent: 2560, soft: 1.25, shoulder: 1.5 } as const;
export interface GroundMask { data: Uint8Array; size: number; rect: [number, number, number] }
export const SURFACE_INDEX: Record<RoadSurface, number> = { sand: 0, gravel: 1, asphalt: 2 };

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const CELL = MASK.extent / MASK.size, MIN = -MASK.extent / 2;

function stamp(data: Uint8Array, ch: number, x0: number, z0: number, x1: number, z1: number, weight: (x: number, z: number) => number) {
  const i0 = Math.max(0, Math.floor((x0 - MIN) / CELL)), i1 = Math.min(MASK.size - 1, Math.ceil((x1 - MIN) / CELL));
  const j0 = Math.max(0, Math.floor((z0 - MIN) / CELL)), j1 = Math.min(MASK.size - 1, Math.ceil((z1 - MIN) / CELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const w = weight(MIN + (i + 0.5) * CELL, MIN + (j + 0.5) * CELL);
    if (w <= 0) continue;
    const k = (j * MASK.size + i) * 4 + ch;
    data[k] = Math.max(data[k], Math.round(w * 255));
  }
}

function segment(data: Uint8Array, [ax, az]: XZ, [bx, bz]: XZ, half: number) {
  const r = half + MASK.soft, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
  stamp(data, 0, Math.min(ax, bx) - r, Math.min(az, bz) - r, Math.max(ax, bx) + r, Math.max(az, bz) + r, (x, z) => {
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
    return 1 - smooth(half - MASK.soft, half + MASK.soft, Math.hypot(x - ax - t * dx, z - az - t * dz));
  });
}

/** R: road weight (story roads with a shoulder, main roads and paths); G: trodden dirt. */
export function groundMask(roads: EraRoads, dirt: readonly DirtPatch[]): GroundMask {
  const data = new Uint8Array(MASK.size * MASK.size * 4);
  for (let k = 3; k < data.length; k += 4) data[k] = 255;
  const lines = [
    ...roads.story.map((r) => ({ pts: r.points, half: r.width / 2 + MASK.shoulder })),
    ...roads.simple.map((r) => ({ pts: r.points, half: r.width / 2 })),
  ];
  for (const l of lines) for (let k = 0; k + 1 < l.pts.length; k++) segment(data, l.pts[k], l.pts[k + 1], l.half);
  for (const d of dirt) {
    const r = Math.hypot(d.hu, d.hv) + MASK.soft, [ux, uz] = d.axis;
    stamp(data, 1, d.c[0] - r, d.c[1] - r, d.c[0] + r, d.c[1] + r, (x, z) => {
      const px = x - d.c[0], pz = z - d.c[1], u = px * ux + pz * uz, v = -px * uz + pz * ux;
      return 1 - smooth(-MASK.soft, MASK.soft, Math.max(Math.abs(u) - d.hu, Math.abs(v) - d.hv));
    });
  }
  return { data, size: MASK.size, rect: [MIN, MIN, MASK.extent] };
}
```

`src/scene/groundUniforms.ts` — add after `noneRGBA`:

```ts
const noneGround = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
noneGround.needsUpdate = true;
```

extend the doc comment with: "`uGround` is the Phase 4a ground mask (R road, G trodden dirt) over `uGroundRect`; `uRoadSurface` is 0 sand, 1 gravel, 2 asphalt (written by `<Infrastructure>`).", add to `groundUniforms`:

```ts
  uGround: { value: noneGround as THREE.Texture },
  uGroundRect: { value: new THREE.Vector4(0, 0, 1, 0) },
  uRoadSurface: { value: 0 },
```

and `export const NO_GROUND = noneGround;`.

`src/scene/terrainMaterial.ts` — in the fragment shader declare after `uCover`:

```glsl
      uniform sampler2D uGround; uniform vec4 uGroundRect; uniform float uRoadSurface;
```

and insert right before `float wet = 1.0 - smoothstep(0.05, 0.7, vW.y);`:

```glsl
        // Phase 4a: main roads and paths (R) and trodden dirt (G), painted from <Infrastructure>.
        vec2 gu = (vW.xz - uGroundRect.xy) / uGroundRect.z;
        float inG = step(0.0, gu.x) * step(gu.x, 1.0) * step(0.0, gu.y) * step(gu.y, 1.0);
        vec4 gm = texture2D(uGround, gu) * inG;
        vec3 roadSand = mix(vec3(0.50,0.41,0.27), vec3(0.62,0.51,0.35), n2) * mix(0.9, 1.05, n3);
        vec3 roadGravel = mix(vec3(0.33,0.31,0.27), vec3(0.44,0.41,0.36), n3);
        vec3 roadAsphalt = mix(vec3(0.085,0.085,0.09), vec3(0.14,0.14,0.14), n2);
        vec3 roadC = uRoadSurface < 0.5 ? roadSand : uRoadSurface < 1.5 ? roadGravel : roadAsphalt;
        vec3 dirt = mix(vec3(0.22,0.16,0.10), vec3(0.32,0.25,0.16), n2) * mix(0.9, 1.05, n3);
        c = mix(c, dirt, 0.85 * gm.g);
        c = mix(c, roadC, gm.r);
```

and change the `grassy` line to end with `* (1.0 - litter) * (1.0 - gm.r) * (1.0 - gm.g);`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/infrastructure src/scene` → PASS; `npx tsc -p tsconfig.json --noEmit` → no errors. (The terrain still looks the same: nothing writes `uGround` until Task 10.)

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/roads.ts src/infrastructure/roads.test.ts src/infrastructure/groundMask.ts src/infrastructure/groundMask.test.ts src/scene/groundUniforms.ts src/scene/terrainMaterial.ts
git commit -m "feat(infrastructure): era roads and the ground mask the terrain paints

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Story-road strips, textures and materials

**Files:**
- Create: `src/infrastructure/roadStrip.ts`, `src/infrastructure/roadStrip.test.ts`, `src/infrastructure/textures.ts`, `src/infrastructure/materials.ts`, `src/infrastructure/parts.ts`, `src/infrastructure/parts.test.ts`

**Interfaces:**
- Consumes: `StoryRoad` (Task 5); `PartBuilder`, `TEX_M` from `src/ancon/vessels/common.ts`; `vesselMaterials`, `canvasTexture` from `src/ancon/materials.ts`; `cellRng` from `src/vegetation/rng.ts`.
- Produces:

```ts
// src/infrastructure/parts.ts
export type InfraMaterialId = 'wood' | 'concrete' | 'zinc' | 'thatch' | 'iron';
export const INFRA_MATERIALS: readonly InfraMaterialId[];
export type Builders = Record<InfraMaterialId, PartBuilder>;
export type GroundAt = (x: number, z: number) => number;
export const makeBuilders: () => Builders;
export function finish(b: Builders): Partial<Record<InfraMaterialId, THREE.BufferGeometry>>;
export const triangleCount: (g: THREE.BufferGeometry) => number;
/** A rectangle on the ground: centre, yaw (local +X = (cos, 0, −sin)), half sizes along local X and Z. */
export interface Footprint { c: XZ; yaw: number; hx: number; hz: number }
export function toWorld(fp: Footprint, lx: number, lz: number): [number, number];
export function corners(fp: Footprint, pad?: number): [number, number][];
// src/infrastructure/roadStrip.ts
export const ROAD_LIFT = 0.05, ROAD_STEP = 2, ROAD_V = 4;
export function resample(points: readonly XZ[], step?: number): XZ[];
export function clipToLand(points: readonly XZ[], landAt: (x: number, z: number) => boolean): XZ[];
export function buildRoadStrip(roads: readonly StoryRoad[], groundAt: GroundAt, landAt: (x: number, z: number) => boolean): THREE.BufferGeometry | null;
// src/infrastructure/materials.ts (browser only)
export function infraMaterials(): Record<InfraMaterialId, THREE.Material>;
export function roadMaterial(s: RoadSurface): THREE.MeshStandardMaterial;
```

- [ ] **Step 1: Write the failing tests**

`src/infrastructure/parts.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { corners, finish, makeBuilders, toWorld, triangleCount } from './parts';

describe('parts', () => {
  test('toWorld follows the three.js yaw convention; corners are the rectangle', () => {
    const fp = { c: [10, 20] as [number, number], yaw: Math.PI / 2, hx: 2, hz: 1 };
    const [x, z] = toWorld(fp, 1, 0);   // local +X → (cos, −sin) = (0, −1)
    expect(x).toBeCloseTo(10); expect(z).toBeCloseTo(19);
    expect(corners(fp).length).toBe(4);
    for (const [cx, cz] of corners(fp)) expect(Math.hypot(cx - 10, cz - 20)).toBeCloseTo(Math.hypot(2, 1));
  });
  test('finish returns only the materials that got pieces', () => {
    const b = makeBuilders();
    b.wood.box([1, 1, 1], [0, 0, 0], 0xffffff);
    const out = finish(b);
    expect(Object.keys(out)).toEqual(['wood']);
    expect(triangleCount(out.wood!)).toBe(12);
  });
});
```

`src/infrastructure/roadStrip.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { buildRoadStrip, clipToLand, resample, ROAD_LIFT, ROAD_STEP } from './roadStrip';
import { triangleCount } from './parts';

const ground = (x: number, z: number) => 1 + 0.02 * x + 0.01 * z;
describe('story road strip', () => {
  test('resample keeps both ends and steps ≤ ROAD_STEP', () => {
    const r = resample([[0, 0], [10, 0], [10, 7]]);
    expect(r[0]).toEqual([0, 0]); expect(r[r.length - 1]).toEqual([10, 7]);
    for (let i = 1; i < r.length; i++) expect(Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1])).toBeLessThanOrEqual(ROAD_STEP + 1e-9);
  });
  test('clipToLand keeps the longest dry run', () => {
    const r = clipToLand([[0, 0], [40, 0]], (x) => x < 30);
    expect(Math.max(...r.map((p) => p[0]))).toBeLessThan(30);
    expect(Math.min(...r.map((p) => p[0]))).toBe(0);
  });
  test('the strip lies ROAD_LIFT above the ground, is as wide as the road, stops at the water', () => {
    const g = buildRoadStrip([{ id: 'escobar', points: [[0, 0], [60, 0]], width: 6 }], ground, (x) => x < 50)!;
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      expect(p.getY(i)).toBeCloseTo(ground(p.getX(i), p.getZ(i)) + ROAD_LIFT, 3);
      expect(p.getX(i)).toBeLessThan(50);
    }
    for (let i = 0; i < p.count; i += 2) expect(Math.hypot(p.getX(i) - p.getX(i + 1), p.getZ(i) - p.getZ(i + 1))).toBeCloseTo(6, 3);
    expect(triangleCount(g)).toBe(p.count - 2);
    expect(g.attributes.uv).toBeDefined();
  });
  test('no roads, no geometry', () => {
    expect(buildRoadStrip([], ground, () => true)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/infrastructure/parts.test.ts src/infrastructure/roadStrip.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `parts.ts`**

```ts
import * as THREE from 'three';
import { PartBuilder } from '../ancon/vessels/common';
import type { XZ } from '../data/geo/types';

/**
 * One PartBuilder per material for all of an era's infrastructure (landings, station, bridge): each
 * builder merges into one mesh, so 4a costs one draw call per material in use (≤ 5) plus the road strip.
 */
export type InfraMaterialId = 'wood' | 'concrete' | 'zinc' | 'thatch' | 'iron';
export const INFRA_MATERIALS: readonly InfraMaterialId[] = ['wood', 'concrete', 'zinc', 'thatch', 'iron'];
export type Builders = Record<InfraMaterialId, PartBuilder>;
export type GroundAt = (x: number, z: number) => number;

export const makeBuilders = (): Builders =>
  ({ wood: new PartBuilder(), concrete: new PartBuilder(), zinc: new PartBuilder(), thatch: new PartBuilder(), iron: new PartBuilder() });

export function finish(b: Builders) {
  const out: Partial<Record<InfraMaterialId, THREE.BufferGeometry>> = {};
  for (const id of INFRA_MATERIALS) if (!b[id].empty) out[id] = b[id].build();
  return out;
}
export const triangleCount = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

export interface Footprint { c: XZ; yaw: number; hx: number; hz: number }
/** Footprint-local (x, z) → world. Local +X → (cos, −sin), local +Z → (sin, cos) (three.js rotY). */
export function toWorld(fp: Footprint, lx: number, lz: number): [number, number] {
  const c = Math.cos(fp.yaw), s = Math.sin(fp.yaw);
  return [fp.c[0] + c * lx + s * lz, fp.c[1] - s * lx + c * lz];
}
export const corners = (fp: Footprint, pad = 0): [number, number][] =>
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => toWorld(fp, sx * (fp.hx + pad), sz * (fp.hz + pad)));
```

- [ ] **Step 4: Implement `roadStrip.ts`**

```ts
import * as THREE from 'three';
import type { XZ } from '../data/geo/types';
import type { GroundAt } from './parts';
import type { StoryRoad } from './roads';

/** Strip height above the terrain (plus a polygon offset in the material), sample step and texture repeat (m). */
export const ROAD_LIFT = 0.05, ROAD_STEP = 2, ROAD_V = 4;

export function resample(points: readonly XZ[], step = ROAD_STEP): XZ[] {
  const out: XZ[] = [points[0]];
  for (let k = 0; k + 1 < points.length; k++) {
    const [ax, az] = points[k], [bx, bz] = points[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let s = 1; s <= n; s++) out.push([ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n]);
  }
  return out;
}

/** The longest run of consecutive resampled points on land (a landing road ends at the river). */
export function clipToLand(points: readonly XZ[], landAt: (x: number, z: number) => boolean): XZ[] {
  const r = resample(points);
  let best: XZ[] = [], cur: XZ[] = [];
  for (const p of r) {
    if (landAt(p[0], p[1])) { cur.push(p); if (cur.length > best.length) best = cur; } else cur = [];
  }
  return best;
}

/** One strip per story road, draped on the ground: u across (0..1), v along (m / ROAD_V). */
export function buildRoadStrip(roads: readonly StoryRoad[], groundAt: GroundAt, landAt: (x: number, z: number) => boolean) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const road of roads) {
    const pts = clipToLand(road.points, landAt);
    if (pts.length < 2) continue;
    const base = pos.length / 3, h = road.width / 2;
    let v = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l, [x, z] = pts[i];
      if (i > 0) v += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
      for (const s of [1, -1]) {
        const px = x + nx * h * s, pz = z + nz * h * s;
        pos.push(px, groundAt(px, pz) + ROAD_LIFT, pz);
        uv.push(s > 0 ? 0 : 1, v / ROAD_V);
      }
      if (i > 0) { const q = base + 2 * i; idx.push(q - 2, q - 1, q, q - 1, q + 1, q); }
    }
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
```

If the normals come out pointing down (the strip renders black from above), swap the two triangles' winding (`q - 2, q, q - 1, q - 1, q, q + 1`) and re-run the test.

- [ ] **Step 5: Implement `textures.ts` (browser only)**

```ts
import type { RoadSurface } from '../data/eras';
import { cellRng } from '../vegetation/rng';

/*
 * Procedural infrastructure textures (browser only: 2D canvas). Concrete is painted near-white so the
 * per-piece vertex colours carry the paint; zinc, thatch and roads carry their own colour (vertex white).
 * One tile covers TEX_M × TEX_M metres on PartBuilder pieces (worldUv).
 */
function canvas(w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')!] as const;
}
const rgba = (r: number, g: number, b: number, a: number) => `rgba(${r | 0},${g | 0},${b | 0},${a.toFixed(3)})`;

export function paintConcrete(): HTMLCanvasElement {
  const S = 512, [c, g] = canvas(S, S), r = cellRng(0, 0, 8101);
  g.fillStyle = '#ebe8e2'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {   // damp blotches
    const x = r() * S, y = r() * S, rad = 20 + 90 * r(), grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, rgba(110, 104, 92, 0.05 + 0.08 * r())); grd.addColorStop(1, rgba(110, 104, 92, 0));
    g.fillStyle = grd; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
  }
  for (let y = 0; y < S; y += 64) { g.fillStyle = rgba(90, 86, 78, 0.06); g.fillRect(0, y, S, 2); }   // form-board lines
  for (let i = 0; i < 60; i++) {   // run-off streaks
    const x = r() * S, y = r() * S * 0.5, len = 60 + 200 * r();
    g.fillStyle = rgba(80, 76, 68, 0.03 + 0.05 * r()); g.fillRect(x, y, 2 + 4 * r(), len);
  }
  for (let i = 0; i < 6000; i++) { const v = r() < 0.5 ? 70 : 255; g.fillStyle = rgba(v, v, v, 0.06); g.fillRect(r() * S, r() * S, 1.5, 1.5); }
  return c;
}

export function paintZinc(): HTMLCanvasElement {
  const S = 512, [c, g] = canvas(S, S), r = cellRng(0, 0, 8102);
  for (let x = 0; x < S; x++) {   // corrugation: 16 px period across u
    const k = 0.5 + 0.5 * Math.sin((x / 16) * Math.PI * 2), v = 128 + 55 * k;
    g.fillStyle = rgba(v * 0.93, v * 0.96, v, 1); g.fillRect(x, 0, 1, S);
  }
  for (let i = 0; i < 70; i++) {   // rust
    const x = r() * S, y = r() * S, rad = 8 + 50 * r(), grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, rgba(122, 64, 30, 0.25 + 0.35 * r())); grd.addColorStop(1, rgba(122, 64, 30, 0));
    g.fillStyle = grd; g.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
  }
  return c;
}

export function paintThatch(): HTMLCanvasElement {
  const S = 512, [c, g] = canvas(S, S), r = cellRng(0, 0, 8103);
  g.fillStyle = '#6f5a3a'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) {   // straw strokes, near vertical
    const x = r() * S, y = r() * S, len = 10 + 30 * r(), t = 150 + 70 * r();
    g.strokeStyle = rgba(t, t * 0.82, t * 0.52, 0.25 + 0.35 * r()); g.lineWidth = 1 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + len); g.stroke();
  }
  for (let y = 0; y < S; y += 48) { g.fillStyle = rgba(40, 30, 18, 0.35); g.fillRect(0, y, S, 5); }   // courses
  return c;
}

/** Road strip tile: 256 px across the road (u), 1024 px = ROAD_V m along it (v). */
export function paintRoad(s: RoadSurface): HTMLCanvasElement {
  const W = 256, H = 1024, [c, g] = canvas(W, H), r = cellRng(0, 0, 8110 + ['sand', 'gravel', 'asphalt'].indexOf(s));
  const base = { sand: '#b39873', gravel: '#8a8276', asphalt: '#3a3a3c' }[s];
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  if (s === 'sand') for (const u of [0.28, 0.72]) {   // cart ruts
    const grd = g.createLinearGradient(u * W - 22, 0, u * W + 22, 0);
    grd.addColorStop(0, rgba(120, 96, 64, 0)); grd.addColorStop(0.5, rgba(110, 86, 56, 0.55)); grd.addColorStop(1, rgba(120, 96, 64, 0));
    g.fillStyle = grd; g.fillRect(u * W - 22, 0, 44, H);
  }
  if (s === 'asphalt') for (const side of [0, 1]) {   // crumbling, dusty edges
    const grd = g.createLinearGradient(side ? W : 0, 0, side ? W - 34 : 34, 0);
    grd.addColorStop(0, rgba(118, 104, 82, 0.9)); grd.addColorStop(1, rgba(118, 104, 82, 0));
    g.fillStyle = grd; g.fillRect(side ? W - 34 : 0, 0, 34, H);
  }
  const n = s === 'gravel' ? 16000 : 7000;
  for (let i = 0; i < n; i++) { const v = r() < 0.5 ? 40 : 230; g.fillStyle = rgba(v, v * 0.97, v * 0.9, s === 'gravel' ? 0.3 : 0.08); g.fillRect(r() * W, r() * H, 2, 2); }
  return c;
}
```

- [ ] **Step 6: Implement `materials.ts` (browser only)**

```ts
import * as THREE from 'three';
import { canvasTexture, vesselMaterials } from '../ancon/materials';
import type { RoadSurface } from '../data/eras';
import type { InfraMaterialId } from './parts';
import { paintConcrete, paintRoad, paintThatch, paintZinc } from './textures';

let cache: Record<InfraMaterialId, THREE.Material> | null = null;
/** Built once for the app's life. Wood and iron are the vessel's own (weathered plank map, dark iron). */
export function infraMaterials() {
  const v = vesselMaterials();
  cache ??= {
    wood: v.wood, iron: v.iron,
    concrete: new THREE.MeshStandardMaterial({ map: canvasTexture(paintConcrete()), vertexColors: true, roughness: 0.92 }),
    zinc: new THREE.MeshStandardMaterial({ map: canvasTexture(paintZinc()), vertexColors: true, roughness: 0.55, metalness: 0.4 }),
    thatch: new THREE.MeshStandardMaterial({ map: canvasTexture(paintThatch()), vertexColors: true, roughness: 1 }),
  };
  return cache;
}

const roads = new Map<RoadSurface, THREE.MeshStandardMaterial>();
/** Story-road strip material per surface; the polygon offset keeps it above the terrain it lies on. */
export function roadMaterial(s: RoadSurface) {
  let m = roads.get(s);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: canvasTexture(paintRoad(s)), roughness: s === 'asphalt' ? 0.85 : 0.97,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    roads.set(s, m);
  }
  return m;
}
```

- [ ] **Step 7: Run tests, commit**

Run: `npx vitest run src/infrastructure` → PASS; `npx tsc -p tsconfig.json --noEmit` → no errors.

```bash
git add src/infrastructure
git commit -m "feat(infrastructure): story-road strips, painted textures, materials

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Landings

**Files:**
- Create: `src/infrastructure/landing.ts`, `src/infrastructure/landing.test.ts`

**Interfaces:**
- Consumes: `LandingPad`, `PAD`, `padHeight`, `padPoint`, `padYaw` (Task 3); `Builders`, `finish`, `makeBuilders` (Task 6); `DirtPatch` (Task 5); `WOOD`, `woodTone` from `src/ancon/vessels/common.ts`; `cellRng`.
- Produces:

```ts
export const RAMP: { halfWidth: 4.5; lift: 0.06; thick: 0.5; step: 1 };
export function buildLanding(b: Builders, pad: LandingPad, look: LandingLook, seed: number): void;
export function landingDirt(pad: LandingPad, look: LandingLook): DirtPatch[];
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'vitest';
import type { LandingPad } from '../terrain/landingPads';
import { PAD, padHeight } from '../terrain/landingPads';
import { buildLanding, landingDirt, RAMP } from './landing';
import { finish, makeBuilders } from './parts';

const pad: LandingPad = { side: 'east', shore: [0, 0], inland: [1, 0], lateral: [0, 1], hInland: 1.2 };
const built = (look: 'bank' | 'timber' | 'concrete') => { const b = makeBuilders(); buildLanding(b, pad, look, 1); return finish(b); };

describe('landings', () => {
  test('bare bank: no geometry, trodden dirt over the pad', () => {
    expect(Object.keys(built('bank'))).toEqual([]);
    const [d] = landingDirt(pad, 'bank');
    expect(d.hu).toBeGreaterThanOrEqual(PAD.length / 2); expect(d.hv).toBeGreaterThanOrEqual(PAD.halfWidth);
  });
  test('timber: edge logs along both sides and mooring stakes in the water', () => {
    const g = built('timber').wood!, p = g.attributes.position;
    let zMin = Infinity, zMax = -Infinity, xMin = Infinity;
    for (let i = 0; i < p.count; i++) { zMin = Math.min(zMin, p.getZ(i)); zMax = Math.max(zMax, p.getZ(i)); xMin = Math.min(xMin, p.getX(i)); }
    expect(zMax).toBeGreaterThan(PAD.halfWidth); expect(zMin).toBeLessThan(-PAD.halfWidth);
    expect(xMin).toBeLessThan(-2);   // stakes stand out in the river
  });
  test('concrete ramp: its top follows the pad, a little above it', () => {
    const g = built('concrete').concrete!, p = g.attributes.position;
    let top = 0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      if (Math.abs(p.getZ(i)) < RAMP.halfWidth - 0.1 && x > 0.5 && x < PAD.length - 0.5 && y > padHeight(pad, x)) {
        expect(y - padHeight(pad, x)).toBeLessThan(RAMP.lift + 0.12);   // slab top over a tilted 1 m segment
        top++;
      }
    }
    expect(top).toBeGreaterThan(10);
    expect(landingDirt(pad, 'concrete')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/infrastructure/landing.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import { WOOD, woodTone } from '../ancon/vessels/common';
import type { LandingLook } from '../data/eras';
import { PAD, padHeight, padPoint, padYaw, type LandingPad } from '../terrain/landingPads';
import { cellRng } from '../vegetation/rng';
import type { DirtPatch } from './groundMask';
import type { Builders } from './parts';

/** Concrete ramp (1975–86): 9 m wide, 6 cm above the pad, a 0.5 m slab (its sides hide the terrain), 1 m segments. Inferred. */
export const RAMP = { halfWidth: 4.5, lift: 0.06, thick: 0.5, step: 1 } as const;
const CONCRETE = 0xb9b4a8, CONCRETE_WET = 0x6f6a5f;

/** A 1 m-long box lying on the pad from a0 to a1, across [−hw, hw], its top `lift` above the pad. */
function onPad(b: Builders['wood'], p: LandingPad, a0: number, a1: number, v: number, hw: number, lift: number, thick: number, color: number) {
  const am = (a0 + a1) / 2, [x, z] = padPoint(p, am, v), y0 = padHeight(p, a0), y1 = padHeight(p, a1);
  const y = (y0 + y1) / 2 + lift - thick / 2, tilt = Math.atan2(y1 - y0, a1 - a0);
  b.box([a1 - a0 + 0.02, thick, 2 * hw], [x, y, z], color, tilt, padYaw(p));
}

export function buildLanding(b: Builders, p: LandingPad, look: LandingLook, seed: number) {
  const r = cellRng(seed, 7, 4401);
  if (look === 'timber') {
    // 1935–59: squared timber edging along both sides of the trodden slope, in two tilted lengths each, and
    // four mooring stakes out in the water.
    for (const side of [-1, 1]) for (const [a0, a1] of [[-1, 7.5], [7.5, PAD.length]] as const)
      onPad(b.wood, p, a0, a1, side * (PAD.halfWidth + 0.15), 0.15, 0.2, 0.3, woodTone(r).getHex());
    for (const side of [-1, 1]) for (const a of [-2.5, -5.5]) {
      const [x, z] = padPoint(p, a, side * (PAD.halfWidth + 1.5)), h = 2.8;
      b.wood.cylinder(0.09, 0.11, h, [x, -0.3, z], WOOD.dark.getHex(), 'y', 7);
    }
  } else if (look === 'concrete') {
    // 1975–86: a poured ramp from under the water to the top of the pad; darker where the river rises.
    for (let a = -PAD.wet; a < PAD.length; a += RAMP.step)
      onPad(b.concrete, p, a, Math.min(PAD.length, a + RAMP.step), 0, RAMP.halfWidth, RAMP.lift, RAMP.thick, a < 1.5 ? CONCRETE_WET : CONCRETE);
  }
}

/** Trodden dirt painted into the ground mask: the whole pad for the bare bank, the slope between the logs for timber. */
export function landingDirt(p: LandingPad, look: LandingLook): DirtPatch[] {
  if (look === 'concrete') return [];
  const [x, z] = padPoint(p, PAD.length / 2, 0), extra = look === 'bank' ? 3 : 0;
  return [{ c: [x, z], axis: p.inland, hu: PAD.length / 2 + extra, hv: PAD.halfWidth + extra }];
}
```

(`PartBuilder.box` colours accept a number; `woodTone(r).getHex()` keeps the vessel's weathered tones.)

- [ ] **Step 4: Run tests, commit**

Run: `npx vitest run src/infrastructure/landing.test.ts` → PASS.

```bash
git add src/infrastructure/landing.ts src/infrastructure/landing.test.ts
git commit -m "feat(infrastructure): landing looks — bare bank, timber, concrete ramp

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The station

**Files:**
- Create: `src/infrastructure/station.ts`, `src/infrastructure/station.test.ts`

**Interfaces:**
- Consumes: pad helpers (Task 3); `Builders`, `Footprint`, `toWorld`, `corners`, `GroundAt`, `makeBuilders`, `finish` (Task 6); `DirtPatch` (Task 5); `WOOD` from vessels/common; `CLEAR_INLAND` from `src/ancon/geometry.ts`; `LANDING_CLEARING` from `src/vegetation/masks.ts`.
- Produces:

```ts
export interface StationLayout {
  house: Footprint | null;      // the Cortijo house (wood or concrete)
  terrace: Footprint | null;    // the bar terrace (concrete look only)
  shelter: Footprint | null;    // 1840–1900
  neighbour: Footprint;         // always computed; drawn only when present
  dirt: DirtPatch[];
}
export function stationLayout(pad: LandingPad, look: StationLook, neighbourGone: boolean, upstream: 1 | -1, dryAt: (x: number, z: number) => boolean): StationLayout;
export function buildStation(b: Builders, lay: StationLayout, look: StationLook, neighbour: boolean, groundAt: GroundAt, seed: number): void;
export function upstreamSign(pad: LandingPad, bridge: readonly XZ[]): 1 | -1;
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'vitest';
import { CLEAR_INLAND } from '../ancon/geometry';
import type { StationLook } from '../data/eras';
import { PAD, padFrame, padPoint, type LandingPad } from '../terrain/landingPads';
import { LANDING_CLEARING } from '../vegetation/masks';
import { corners, finish, makeBuilders, type Footprint } from './parts';
import { buildStation, stationLayout, upstreamSign } from './station';

const pad: LandingPad = { side: 'east', shore: [0, 0], inland: [1, 0], lateral: [0, 1], hInland: 1.2 };
const LOOKS: StationLook[] = ['shelter', 'woodThatch', 'woodZinc', 'concrete'];
const dry = () => true, flat = () => 1;
const all = (l: ReturnType<typeof stationLayout>) => [l.house, l.terrace, l.shelter, l.neighbour].filter(Boolean) as Footprint[];

describe('station layout', () => {
  test('each look has the right buildings', () => {
    const l = (look: StationLook) => stationLayout(pad, look, false, 1, dry);
    expect(l('shelter').shelter).not.toBeNull(); expect(l('shelter').house).toBeNull();
    expect(l('woodZinc').house).not.toBeNull(); expect(l('woodZinc').terrace).toBeNull();
    expect(l('concrete').terrace).not.toBeNull();
  });
  test('everything stands inside the plant-free landing clearing, off the pad', () => {
    const [cx, cz] = padPoint(pad, CLEAR_INLAND, 0);
    for (const look of LOOKS) for (const fp of all(stationLayout(pad, look, false, 1, dry))) for (const [x, z] of corners(fp)) {
      expect(Math.hypot(x - cx, z - cz)).toBeLessThanOrEqual(LANDING_CLEARING[0]);
      const [a, v] = padFrame(pad, x, z);
      expect(Math.abs(v) > PAD.halfWidth + 1 || a > PAD.length + 1).toBe(true);
    }
  });
  test('the neighbour stands upstream, the Cortijo house downstream', () => {
    for (const s of [1, -1] as const) {
      const l = stationLayout(pad, 'woodZinc', false, s, dry);
      expect(Math.sign(padFrame(pad, ...l.neighbour.c)[1])).toBe(s);
      expect(Math.sign(padFrame(pad, ...l.house!.c)[1])).toBe(-s);
    }
  });
  test('buildings slide inland off wet ground', () => {
    const l = stationLayout(pad, 'concrete', false, 1, (x) => x > 12);
    for (const fp of all(l)) for (const [x] of corners(fp)) expect(x).toBeGreaterThan(12);
  });
  test('a demolished neighbour leaves bare dirt', () => {
    const n = (gone: boolean) => stationLayout(pad, 'concrete', gone, 1, dry).dirt.length;
    expect(n(true)).toBe(n(false) + 1);
  });
  test('upstream side is the bridge side', () => {
    expect(upstreamSign(pad, [[-100, 50], [-50, 300]])).toBe(1);
    expect(upstreamSign(pad, [[-100, -50], [-50, -300]])).toBe(-1);
  });
});

describe('station geometry', () => {
  const build = (look: StationLook, neighbour: boolean) => {
    const b = makeBuilders(), l = stationLayout(pad, look, false, 1, dry);
    buildStation(b, l, look, neighbour, flat, 1);
    return finish(b);
  };
  test('materials per look', () => {
    expect(Object.keys(build('shelter', false)).sort()).toEqual(['thatch', 'wood']);
    expect(build('woodThatch', false).thatch).toBeDefined();
    expect(build('woodZinc', true).zinc).toBeDefined();
    expect(build('concrete', false).concrete).toBeDefined();
  });
  test('wooden houses stand on posts that reach into the ground', () => {
    const g = build('woodZinc', false).wood!, p = g.attributes.position;
    let yMin = Infinity; for (let i = 0; i < p.count; i++) yMin = Math.min(yMin, p.getY(i));
    expect(yMin).toBeLessThan(flat() - 0.1);
  });
  test('the neighbour adds geometry only when present', () => {
    const n = (on: boolean) => build('woodZinc', on).wood!.attributes.position.count;
    expect(n(true)).toBeGreaterThan(n(false));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/infrastructure/station.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import * as THREE from 'three';
import { WOOD } from '../ancon/vessels/common';
import type { StationLook } from '../data/eras';
import type { XZ } from '../data/geo/types';
import { padFrame, padPoint, padYaw, type LandingPad } from '../terrain/landingPads';
import { cellRng } from '../vegetation/rng';
import type { DirtPatch } from './groundMask';
import { corners, toWorld, type Builders, type Footprint, type GroundAt } from './parts';

/**
 * The station on the Loíza bank (spec 4a §2): a thatched shelter (1840–1900), the Cortijo house —
 * wood on zocos (1925–59; thatch, then zinc) and concrete with the bar terrace (1975–86) — and, upstream,
 * the neighbour's wooden house that the bridge removed (1935–75; bare dirt after). Positions and sizes
 * are inferred; everything sits inside the landing clearing (≤ 22 m from its centre), clear of the pad.
 * Footprint local +X points inland (yaw = padYaw), local +Z = the pad's lateral axis.
 */
export interface StationLayout {
  house: Footprint | null; terrace: Footprint | null; shelter: Footprint | null; neighbour: Footprint; dirt: DirtPatch[];
}

/** Paint (sRGB, inferred: bright Loíza vernacular, research §7; concrete house in "its 1980s colours" [S6]). */
const PAINT = { teal: 0x6f9f98, trim: 0xe6e0d2, pink: 0xd6a49a, cream: 0xe4d6b4, band: 0x3f7f7a, post: 0x5f5549, dark: 0x1d1b19 };
const WALL_H = 2.6, ZOCO = 0.6, ROOF_TILT = 0.38;

const fp = (p: LandingPad, a: number, v: number, hx: number, hz: number): Footprint => ({ c: padPoint(p, a, v), yaw: padYaw(p), hx, hz });
/** Slide a group of footprints inland (1 m steps, ≤ 10 m) until every corner is on dry ground. */
function fitInland(p: LandingPad, group: Footprint[], dryAt: (x: number, z: number) => boolean): Footprint[] {
  for (let s = 0; s <= 10; s++) {
    const moved = group.map((f) => ({ ...f, c: [f.c[0] + p.inland[0] * s, f.c[1] + p.inland[1] * s] as XZ }));
    if (moved.every((f) => corners(f).every(([x, z]) => dryAt(x, z)))) return moved;
  }
  return group;
}
const dirtOf = (f: Footprint, pad: number): DirtPatch => ({ c: f.c, axis: [Math.cos(f.yaw), -Math.sin(f.yaw)], hu: f.hx + pad, hv: f.hz + pad });

export function upstreamSign(pad: LandingPad, bridge: readonly XZ[]): 1 | -1 {
  const a = bridge[0], b = bridge[bridge.length - 1];
  return padFrame(pad, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)[1] >= 0 ? 1 : -1;
}

export function stationLayout(p: LandingPad, look: StationLook, neighbourGone: boolean, up: 1 | -1, dryAt: (x: number, z: number) => boolean): StationLayout {
  const down = -up as 1 | -1;
  let house: Footprint | null = null, terrace: Footprint | null = null, shelter: Footprint | null = null;
  if (look === 'shelter') [shelter] = fitInland(p, [fp(p, 9, down * 8, 2, 1.5)], dryAt);
  else if (look === 'concrete') [house, terrace] = fitInland(p, [fp(p, 14, down * 12, 5, 4), fp(p, 6.75, down * 12, 2.25, 4)], dryAt);
  else [house] = fitInland(p, [fp(p, 13, down * 11, 4, 3)], dryAt);
  const [neighbour] = fitInland(p, [fp(p, 12, up * 12.5, 3.5, 2.5)], dryAt);
  const dirt: DirtPatch[] = [];
  if (house) dirt.push(dirtOf(house, 2));
  if (shelter) dirt.push(dirtOf(shelter, 1.5));
  if (neighbourGone) dirt.push(dirtOf(neighbour, 1));
  return { house, terrace, shelter, neighbour, dirt };
}

// ---- pieces (footprint-local x, y, z → world) ----
type B = Builders;
const box = (b: B['wood'], f: Footprint, size: [number, number, number], lx: number, y: number, lz: number, color: number, rotZ = 0) => {
  const [x, z] = toWorld(f, lx, lz);
  b.box(size, [x, y, z], color, rotZ, f.yaw);
};
const groundRange = (f: Footprint, g: GroundAt) => {
  const hs = corners(f).map(([x, z]) => g(x, z)).concat(g(f.c[0], f.c[1]));
  return [Math.min(...hs), Math.max(...hs)];
};

/** Posts from 0.3 m inside the ground up to `top`, on a 3 × 2 grid. */
function posts(b: B['wood'], f: Footprint, g: GroundAt, top: number, color: number, s = 0.22) {
  for (const lx of [-f.hx + 0.3, 0, f.hx - 0.3]) for (const lz of [-f.hz + 0.3, f.hz - 0.3]) {
    const [x, z] = toWorld(f, lx, lz), gy = g(x, z) - 0.3;
    b.box([s, top - gy, s], [x, (top + gy) / 2, z], color, 0, f.yaw);
  }
}
/** Gable roof, ridge along local Z, slabs in `mat`; gable ends as a triangular prism in wood. */
function gable(b: B, f: Footprint, top: number, mat: 'zinc' | 'wood', wall: number) {
  const o = 0.5, run = f.hx + o, rise = Math.tan(ROOF_TILT) * run, len = run / Math.cos(ROOF_TILT);
  for (const s of [-1, 1]) box(b[mat], f, [len, 0.04, 2 * f.hz + 2 * o], (s * run) / 2, top + rise / 2, 0, 0xffffff, -s * ROOF_TILT);
  const tri = new THREE.CylinderGeometry(1, 1, 2 * f.hz, 3, 1);
  tri.rotateX(-Math.PI / 2);
  const riseIn = Math.tan(ROOF_TILT) * f.hx;
  tri.scale(f.hx / 0.866, riseIn / 1.5, 1);
  tri.translate(0, top + 0.5 * (riseIn / 1.5), 0);
  tri.rotateY(f.yaw); tri.translate(f.c[0], 0, f.c[1]);
  b.wood.add(tri, wall);
}
/** Hip roof of thatch: a square pyramid stretched over the footprint with an overhang. */
function hip(b: B, f: Footprint, top: number, rise = 2.2, o = 0.7) {
  const g = new THREE.ConeGeometry(1, rise, 4, 1);
  g.rotateY(Math.PI / 4);
  g.scale((f.hx + o) / 0.7071, 1, (f.hz + o) / 0.7071);
  g.translate(0, top + rise / 2 - 0.15, 0);
  g.rotateY(f.yaw); g.translate(f.c[0], 0, f.c[1]);
  b.thatch.add(g, 0xffffff);
}

function woodHouse(b: B, f: Footprint, g: GroundAt, wall: number, roof: 'thatch' | 'zinc', r: () => number) {
  const [, gmax] = groundRange(f, g), floor = gmax + ZOCO, top = floor + WALL_H;
  posts(b.wood, f, g, floor, PAINT.post);
  box(b.wood, f, [2 * f.hx, 0.15, 2 * f.hz], 0, floor - 0.075, 0, WOOD.base.getHex());
  for (const s of [-1, 1]) {
    box(b.wood, f, [2 * f.hx, WALL_H, 0.1], 0, floor + WALL_H / 2, s * f.hz, wall);
    box(b.wood, f, [0.1, WALL_H, 2 * f.hz], s * f.hx, floor + WALL_H / 2, 0, wall);
    for (const t of [-1, 1]) box(b.wood, f, [0.12, WALL_H, 0.12], s * f.hx, floor + WALL_H / 2, t * f.hz, PAINT.trim);
    for (const lx of [-f.hx / 2, f.hx / 2]) box(b.wood, f, [0.9, 1.0, 0.05], lx, floor + 1.5, s * (f.hz + 0.06), r() > 0.5 ? PAINT.band : PAINT.trim);   // shutters (tormenteras)
  }
  box(b.wood, f, [0.05, 2.0, 0.9], -f.hx - 0.06, floor + 1.0, 0, PAINT.dark);   // door, facing the river
  for (let k = 0; k < 2; k++) box(b.wood, f, [0.35, 0.18, 1.1], -f.hx - 0.25 - 0.35 * k, floor - 0.2 - 0.3 * k, 0, WOOD.dark.getHex());   // steps
  if (roof === 'thatch') hip(b, f, top); else gable(b, f, top, 'zinc', wall);
}

function concreteHouse(b: B, f: Footprint, t: Footprint, g: GroundAt) {
  const [gmin, gmax] = groundRange(f, g), floor = gmax + 0.25, H = 2.9, top = floor + H;
  box(b.concrete, f, [2 * f.hx + 0.4, floor - gmin + 0.3, 2 * f.hz + 0.4], 0, (floor + gmin - 0.3) / 2, 0, 0xb9b4a8);   // plinth
  for (const s of [-1, 1]) {
    box(b.concrete, f, [2 * f.hx, H, 0.2], 0, floor + H / 2, s * f.hz, PAINT.cream);
    box(b.concrete, f, [0.2, H, 2 * f.hz], s * f.hx, floor + H / 2, 0, PAINT.cream);
    box(b.concrete, f, [2 * f.hx + 0.04, 0.35, 0.22], 0, floor + 0.18, s * f.hz, PAINT.band);   // painted base band
    for (const lx of [-f.hx / 2, f.hx / 2]) {
      box(b.iron, f, [1.3, 1.1, 0.05], lx, floor + 1.6, s * (f.hz + 0.11), PAINT.dark);        // window
      for (let k = -1; k <= 1; k++) box(b.iron, f, [0.03, 1.1, 0.04], lx + k * 0.4, floor + 1.6, s * (f.hz + 0.15), 0x2b2826);   // grille
    }
  }
  box(b.concrete, f, [2 * f.hx + 0.6, 0.25, 2 * f.hz + 0.6], 0, top + 0.12, 0, 0xd8d2c4);   // flat roof
  for (const s of [-1, 1]) {
    box(b.concrete, f, [2 * f.hx + 0.6, 0.5, 0.15], 0, top + 0.5, s * (f.hz + 0.22), PAINT.cream);
    box(b.concrete, f, [0.15, 0.5, 2 * f.hz + 0.6], s * (f.hx + 0.22), top + 0.5, 0, PAINT.cream);
  }
  // The bar terrace over the river side: slab, columns, a zinc roof sloping to the river, an iron rail.
  box(b.concrete, t, [2 * t.hx, 0.2, 2 * t.hz], 0, floor - 0.1, 0, 0xc9c2b2);
  for (const lx of [-t.hx + 0.2, t.hx - 0.2]) for (const lz of [-t.hz + 0.2, 0, t.hz - 0.2]) {
    const [x, z] = toWorld(t, lx, lz), gy = g(x, z) - 0.3;
    b.concrete.box([0.25, floor + 2.7 - gy, 0.25], [x, (floor + 2.7 + gy) / 2, z], PAINT.trim, 0, t.yaw);
  }
  box(b.zinc, t, [2 * t.hx + 0.6, 0.04, 2 * t.hz + 0.4], 0, floor + 2.75, 0, 0xffffff, 0.12);
  for (const s of [-1, 1]) box(b.iron, t, [2 * t.hx, 0.05, 0.05], 0, floor + 0.95, s * t.hz, 0x2b2826);
  box(b.iron, t, [0.05, 0.05, 2 * t.hz], -t.hx, floor + 0.95, 0, 0x2b2826);
  for (let k = 0; k <= 8; k++) box(b.iron, t, [0.04, 0.95, 0.04], -t.hx, floor + 0.47, -t.hz + (k * 2 * t.hz) / 8, 0x2b2826);
}

function shelter(b: B, f: Footprint, g: GroundAt) {
  const [, gmax] = groundRange(f, g), top = gmax + 2.2;
  for (const lx of [-f.hx + 0.2, f.hx - 0.2]) for (const lz of [-f.hz + 0.2, f.hz - 0.2]) {
    const [x, z] = toWorld(f, lx, lz), gy = g(x, z) - 0.3;
    b.wood.cylinder(0.07, 0.09, top - gy, [x, (top + gy) / 2, z], WOOD.dark.getHex(), 'y', 6);
  }
  box(b.wood, f, [0.4, 0.08, 2 * f.hz - 0.6], -f.hx + 0.6, gmax + 0.45, 0, WOOD.base.getHex());   // bench
  hip(b, f, top, 1.6, 0.5);
}

export function buildStation(b: B, lay: StationLayout, look: StationLook, neighbour: boolean, g: GroundAt, seed: number) {
  const r = cellRng(seed, 3, 5501);
  if (lay.shelter) shelter(b, lay.shelter, g);
  if (lay.house && look === 'concrete') concreteHouse(b, lay.house, lay.terrace!, g);
  else if (lay.house) woodHouse(b, lay.house, g, look === 'woodThatch' ? WOOD.base.getHex() : PAINT.teal, look === 'woodThatch' ? 'thatch' : 'zinc', r);
  if (neighbour) woodHouse(b, lay.neighbour, g, PAINT.pink, 'zinc', r);
}
```

Notes for the implementer:
- `box(... rotZ)` tilts a slab in its local X–Y plane before the yaw, so gable slabs (long side along local X, across the ridge) get the pitch; check the roof in Step 5 and flip the sign of `-s * ROOF_TILT` if the slabs form a "V" instead of a "Λ".
- The shutter colour line uses a random pick per house; keep it deterministic (it reads `r`).

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/infrastructure/station.test.ts` → PASS.

- [ ] **Step 5: Quick look (temporary harness)**

Nothing mounts the station yet. Check the shapes once in the dev server with a throw-away component (do not commit it): in `World.tsx`, temporarily render the result of `stationLayout`/`buildStation` for `landingPadsFor(0)[0]` with `infraMaterials()`, open `?era=1975&cam=station&t=12&freeze=1&q=medium`, and check: roofs are "Λ", walls closed, posts reach the ground, terrace faces the river. Remove the harness.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/station.ts src/infrastructure/station.test.ts
git commit -m "feat(infrastructure): station — shelter, Cortijo house, bar terrace, neighbour's house

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The bridge

**Files:**
- Create: `src/infrastructure/bridge.ts`, `src/infrastructure/bridge.test.ts`

**Interfaces:**
- Consumes: `Builders`, `GroundAt`, `makeBuilders`, `finish` (Task 6); `BridgeState` (Task 2); `WATER` from `src/terrain/fields.ts`.
- Produces:

```ts
export const BRIDGE: { span: 30; width: 11; thick: 1.2; midY: 7.5; endLift: 0.3; parapet: 0.8; colSpread: 3; colR: 0.6; lampH: 8 };
export interface BridgeSpan { t0: number; t1: number; built: boolean }
export interface BridgePlan { a: XZ; b: XZ; len: number; dir: XZ; yaw: number; ends: [number, number]; spans: BridgeSpan[] }
export function bridgePlan(way: readonly XZ[], state: BridgeState, waterAt: (x: number, z: number) => number, groundAt: GroundAt): BridgePlan | null;
export function deckTop(plan: BridgePlan, t: number): number;
export function buildBridge(b: Builders, plan: BridgePlan, state: BridgeState, groundAt: GroundAt): void;
export function bridgeCorridor(way: readonly XZ[], half: number): (x: number, z: number) => boolean;
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'vitest';
import { WATER } from '../terrain/fields';
import { BRIDGE, bridgeCorridor, bridgePlan, buildBridge, deckTop } from './bridge';
import { finish, makeBuilders, triangleCount } from './parts';

const way: [number, number][] = [[0, 0], [300, 0]];
const water = (x: number) => (x > 90 && x < 210 ? WATER.RIVER : WATER.LAND);   // river over the middle 120 m
const ground = (x: number) => (x > 90 && x < 210 ? -2.5 : 1);

describe('bridge', () => {
  test('no bridge before 1984', () => {
    expect(bridgePlan(way, 'none', water, ground)).toBeNull();
  });
  test('spans of ~30 m follow the OSM line; the deck is highest mid-river and meets the ground at the ends', () => {
    const p = bridgePlan(way, 'open', water, ground)!;
    expect(p.spans.length).toBe(10);
    expect(p.spans.every((s) => s.built)).toBe(true);
    expect(deckTop(p, 0.5)).toBeCloseTo(BRIDGE.midY, 5);
    expect(deckTop(p, 0)).toBeCloseTo(1 + BRIDGE.endLift, 5);
    expect(deckTop(p, 1)).toBeCloseTo(1 + BRIDGE.endLift, 5);
  });
  test('1984: a gap over the middle of the river, both ends built', () => {
    const p = bridgePlan(way, 'building', water, ground)!, gap = p.spans.filter((s) => !s.built);
    expect(gap.length).toBeGreaterThanOrEqual(1);
    for (const s of gap) expect(water(((s.t0 + s.t1) / 2) * 300)).toBe(WATER.RIVER);
    expect(p.spans[0].built).toBe(true); expect(p.spans[p.spans.length - 1].built).toBe(true);
  });
  test('geometry per state: rails and lamps when open; forms and a crane when building', () => {
    const build = (state: 'building' | 'open') => { const b = makeBuilders(); buildBridge(b, bridgePlan(way, state, water, ground)!, state, ground); return finish(b); };
    const open = build('open'), building = build('building');
    expect(open.wood).toBeUndefined();                 // no formwork on the finished bridge
    expect(building.wood).toBeDefined();
    expect(open.concrete).toBeDefined(); expect(building.iron).toBeDefined();
    const tris = (o: ReturnType<typeof build>) => Object.values(o).reduce((n, g) => n + triangleCount(g!), 0);
    expect(tris(open)).toBeLessThan(20000); expect(tris(building)).toBeLessThan(20000);
  });
  test('piers reach down into the riverbed', () => {
    const b = makeBuilders(); buildBridge(b, bridgePlan(way, 'open', water, ground)!, 'open', ground);
    const p = finish(b).concrete!.attributes.position;
    let yMin = Infinity; for (let i = 0; i < p.count; i++) yMin = Math.min(yMin, p.getY(i));
    expect(yMin).toBeLessThan(-2.5);
  });
  test('the corridor covers the deck and a margin, nothing past the ends', () => {
    const inside = bridgeCorridor(way, BRIDGE.width / 2 + 3);
    expect(inside(150, 8)).toBe(true); expect(inside(150, 9)).toBe(false); expect(inside(-20, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/infrastructure/bridge.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import type { BridgeState } from '../data/eras';
import type { XZ } from '../data/geo/types';
import { WATER } from '../terrain/fields';
import type { Builders, GroundAt } from './parts';

/**
 * The PR-187 bridge, "Puente de la Restauración" (spec 4a §2): on the OSM line (way 204521442, S26),
 * concrete, built early–mid 1980s next to the station (S4), opened 1985 (S1, S3). Span length, width,
 * height and pier layout are inferred (L). 1984: every pier stands, the deck covers both ends and a
 * gap stays open over the middle of the river, with timber forms, flags and one crane. 1986: whole,
 * with parapets and street lamps. Medium detail: always ≥ ~150 m from the ferry.
 */
export const BRIDGE = { span: 30, width: 11, thick: 1.2, midY: 7.5, endLift: 0.3, parapet: 0.8, colSpread: 3, colR: 0.6, lampH: 8 } as const;
export interface BridgeSpan { t0: number; t1: number; built: boolean }
export interface BridgePlan { a: XZ; b: XZ; len: number; dir: XZ; yaw: number; ends: [number, number]; spans: BridgeSpan[] }

const GREY = 0xb3aea4, ASPHALT = 0x3a3a3a, FORM = 0x8a6f4c, CRANE = 0xc9a227, RED = 0xb3261e, LAMP = 0x5a5d60;

export function bridgePlan(way: readonly XZ[], state: BridgeState, waterAt: (x: number, z: number) => number, groundAt: GroundAt): BridgePlan | null {
  if (state === 'none') return null;
  const a = way[0], b = way[way.length - 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dir: XZ = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const n = Math.max(1, Math.round(len / BRIDGE.span));
  const spans: BridgeSpan[] = Array.from({ length: n }, (_, i) => ({ t0: i / n, t1: (i + 1) / n, built: true }));
  if (state === 'building') {
    let rs = -1, re = -1;
    for (let d = 0; d <= len; d += 1) if (waterAt(a[0] + dir[0] * d, a[1] + dir[1] * d) === WATER.RIVER) { if (rs < 0) rs = d; re = d; }
    if (rs >= 0) {
      const mid = (rs + re) / 2 / len, half = Math.max((0.2 * (re - rs)) / len, 0.5 / n);
      for (const s of spans) if (Math.abs((s.t0 + s.t1) / 2 - mid) < half) s.built = false;
      spans[0].built = true; spans[n - 1].built = true;
    }
  }
  return { a, b, len, dir, yaw: Math.atan2(-dir[1], dir[0]), ends: [groundAt(a[0], a[1]), groundAt(b[0], b[1])], spans };
}

export function deckTop(p: BridgePlan, t: number) {
  const end = p.ends[0] + (p.ends[1] - p.ends[0]) * t + BRIDGE.endLift;
  return end + (BRIDGE.midY - end) * Math.sin(Math.PI * t);
}

/** World point at bridge parameter t and lateral offset v (local +Z). */
const at = (p: BridgePlan, t: number, v: number): [number, number] =>
  [p.a[0] + p.dir[0] * p.len * t - p.dir[1] * v, p.a[1] + p.dir[1] * p.len * t + p.dir[0] * v];

export function buildBridge(b: Builders, p: BridgePlan, state: BridgeState, groundAt: GroundAt) {
  const W = BRIDGE.width, n = p.spans.length;
  // Deck spans (straight, tilted segments of the arched profile) with an asphalt top.
  for (const s of p.spans) {
    if (!s.built) continue;
    const tm = (s.t0 + s.t1) / 2, l = (s.t1 - s.t0) * p.len, y0 = deckTop(p, s.t0), y1 = deckTop(p, s.t1), tilt = Math.atan2(y1 - y0, l);
    const [x, z] = at(p, tm, 0), y = (y0 + y1) / 2;
    b.concrete.box([l + 0.05, BRIDGE.thick, W], [x, y - BRIDGE.thick / 2, z], GREY, tilt, p.yaw);
    b.concrete.box([l + 0.05, 0.06, W - 1.4], [x, y + 0.03, z], ASPHALT, tilt, p.yaw);
    if (state === 'open') for (const side of [-1, 1]) {
      const [px, pz] = at(p, tm, side * (W / 2 - 0.15));
      b.concrete.box([l + 0.05, BRIDGE.parapet, 0.3], [px, y + BRIDGE.parapet / 2, pz], GREY, tilt, p.yaw);
    }
  }
  // Piers at every inner span joint: two round columns and a cap beam, from 0.5 m under the ground or riverbed.
  for (let k = 1; k < n; k++) {
    const t = k / n, top = deckTop(p, t) - BRIDGE.thick;
    for (const side of [-1, 1]) {
      const [x, z] = at(p, t, side * BRIDGE.colSpread), gy = groundAt(x, z) - 0.5;
      b.concrete.cylinder(BRIDGE.colR, BRIDGE.colR, top - gy, [x, (top + gy) / 2, z], GREY, 'y', 12);
    }
    const [x, z] = at(p, t, 0);
    b.concrete.box([1.4, 1.0, W - 1], [x, top - 0.5, z], GREY, 0, p.yaw);
    if (state === 'open' && k % 2 === 0) {   // street lamps every other joint, alternating sides
      const side = (k / 2) % 2 ? 1 : -1, [lx, lz] = at(p, t, side * (W / 2 - 0.4)), y = deckTop(p, t);
      b.iron.cylinder(0.08, 0.1, BRIDGE.lampH, [lx, y + BRIDGE.lampH / 2, lz], LAMP, 'y', 6);
      const [hx, hz] = at(p, t, side * (W / 2 - 1.6));
      b.iron.box([0.35, 0.18, 2.4], [hx, y + BRIDGE.lampH, hz], LAMP, 0, p.yaw);
    }
  }
  // Abutments.
  for (const t of [0, 1]) {
    const [x, z] = at(p, t, 0), y = deckTop(p, t);
    b.concrete.box([3, 2.2, W], [x, y - 1.1, z], GREY, 0, p.yaw);
  }
  if (state === 'building') buildWorks(b, p, groundAt);
}

/** 1984: timber forms and falsework at the gap's piers, flags at the deck ends, one crawler crane. */
function buildWorks(b: Builders, p: BridgePlan, groundAt: GroundAt) {
  const n = p.spans.length, gap = p.spans.map((s, i) => (s.built ? -1 : i)).filter((i) => i >= 0);
  if (!gap.length) return;
  const edges = [gap[0], gap[gap.length - 1] + 1];   // joints at the two sides of the gap
  for (const k of edges) {
    const t = k / n, top = deckTop(p, t) - BRIDGE.thick, [x, z] = at(p, t, 0);
    b.wood.box([2.2, 1.6, BRIDGE.width], [x, top + 0.3, z], FORM, 0, p.yaw);
    for (const dv of [-4.5, -1.5, 1.5, 4.5]) for (const dt of [-1, 1]) {
      const [fx, fz] = at(p, t + (dt * 1.2) / p.len, dv), gy = groundAt(fx, fz) - 0.3;
      b.wood.box([0.18, top - gy, 0.18], [fx, (top + gy) / 2, fz], FORM, 0, p.yaw);
    }
    for (const side of [-1, 1]) {   // flags on the built deck end
      const tt = t + ((k === edges[0] ? -1 : 1) * 2) / p.len, [fx, fz] = at(p, tt, side * (BRIDGE.width / 2 - 0.5)), y = deckTop(p, tt);
      b.iron.cylinder(0.03, 0.03, 2.2, [fx, y + 1.1, fz], LAMP, 'y', 5);
      const [gx, gz] = at(p, tt + 0.45 / p.len, side * (BRIDGE.width / 2 - 0.5));
      b.iron.box([0.9, 0.55, 0.02], [gx, y + 1.9, gz], RED, 0, p.yaw);
    }
  }
  // Crawler crane on the deck before the gap, boom leaning out over it.
  const tc = (edges[0] - 0.35) / n, [cx, cz] = at(p, tc, 0), y = deckTop(p, tc);
  b.iron.box([4.5, 2.2, 3.2], [cx, y + 1.5, cz], CRANE, 0, p.yaw);
  for (const side of [-1, 1]) { const [tx, tz] = at(p, tc, side * 1.4); b.iron.box([5, 0.8, 0.7], [tx, y + 0.4, tz], 0x2b2826, 0, p.yaw); }
  const boom = 24, ang = 0.95, bx = Math.cos(ang) * boom, by = Math.sin(ang) * boom;
  for (const dv of [-0.45, 0.45]) for (const dy of [0, 0.7]) {
    const [x, z] = at(p, tc + bx / 2 / p.len, dv);
    b.iron.box([boom, 0.12, 0.12], [x, y + 2.6 + dy + by / 2, z], CRANE, ang, p.yaw);
  }
  for (let k = 1; k < 12; k++) {   // lacing
    const u = (k / 12) * boom, [x, z] = at(p, tc + (Math.cos(ang) * u) / p.len, 0);
    b.iron.box([0.08, 0.8, 0.95], [x, y + 2.95 + Math.sin(ang) * u, z], CRANE, ang, p.yaw);
  }
  const [hx, hz] = at(p, tc + bx / p.len, 0);
  b.iron.box([0.04, 10, 0.04], [hx, y + 2.6 + by - 5, hz], 0x2b2826, 0, p.yaw);   // hook line
}

/** Points within `half` m of the bridge line, between its ends (woody plants are kept out, Task 10). */
export function bridgeCorridor(way: readonly XZ[], half: number) {
  const a = way[0], b = way[way.length - 1], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  return (x: number, z: number) => {
    const px = x - a[0], pz = z - a[1], t = px * ux + pz * uz;
    return t >= 0 && t <= len && Math.abs(-px * uz + pz * ux) <= half;
  };
}
```

- [ ] **Step 4: Run tests, commit**

Run: `npx vitest run src/infrastructure/bridge.test.ts` → PASS.

```bash
git add src/infrastructure/bridge.ts src/infrastructure/bridge.test.ts
git commit -m "feat(infrastructure): PR-187 bridge — building in 1984, open in 1986

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: On screen — assemble, budget, ground paint, bridge corridor

**Files:**
- Create: `src/infrastructure/build.ts`, `src/infrastructure/build.test.ts`, `src/infrastructure/Infrastructure.tsx`
- Modify: `src/scene/World.tsx`, `src/vegetation/Vegetation.tsx:98-120`

**Interfaces:**
- Consumes: everything from Tasks 3–9.
- Produces:

```ts
// src/infrastructure/build.ts
export interface InfraInput {
  infra: Infrastructure; pads: readonly [LandingPad, LandingPad]; roads: EraRoads; bridgeWay: readonly XZ[];
  groundAt: GroundAt;
  landAt: (x: number, z: number) => boolean;   // not water (roads end at the river)
  dryAt: (x: number, z: number) => boolean;    // ≥ 2 m from water (buildings)
  waterAt: (x: number, z: number) => number;
}
export interface InfraOutput { parts: Partial<Record<InfraMaterialId, THREE.BufferGeometry>>; road: THREE.BufferGeometry | null; dirt: DirtPatch[]; station: StationLayout }
export function buildInfrastructure(i: InfraInput): InfraOutput;
export const drawCalls: (o: InfraOutput) => number;
export const triangles: (o: InfraOutput) => number;
export const LIMITS: { drawCalls: 12; triangles: 40000 };
```

- [ ] **Step 1: Write the failing test**

`src/infrastructure/build.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { crossingGeometry, landingClearings, waterAt } from '../ancon/geometry';
import { ERAS } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { sampleField, WATER } from '../terrain/fields';
import { landingPadsFor, placementFields } from '../terrain/placementFields';
import { LANDING_CLEARING } from '../vegetation/masks';
import { buildInfrastructure, drawCalls, LIMITS, triangles } from './build';
import { corners } from './parts';
import { bridgeWay, eraRoads } from './roads';

const G = geo as unknown as GeoBundle;
const input = (e: (typeof ERAS)[number]) => {
  const bank = e.river.bankOffset.value, f = placementFields(bank);
  return {
    infra: e.infrastructure, pads: landingPadsFor(bank), roads: eraRoads(G, e), bridgeWay: bridgeWay(G),
    groundAt: (x: number, z: number) => sampleField(f, f.height, x, z),
    landAt: (x: number, z: number) => waterAt(f, x, z) === WATER.LAND,
    dryAt: (x: number, z: number) => waterAt(f, x, z) === WATER.LAND && sampleField(f, f.shore, x, z) >= 2,
    waterAt: (x: number, z: number) => waterAt(f, x, z),
  };
};

describe('one era of infrastructure', () => {
  for (const e of ERAS) test(`${e.id}: within budget; buildings inside the plant-free clearing`, () => {
    const i = input(e), o = buildInfrastructure(i);
    expect(drawCalls(o)).toBeLessThanOrEqual(LIMITS.drawCalls);
    expect(triangles(o)).toBeLessThanOrEqual(LIMITS.triangles);
    expect(o.road).not.toBeNull();
    const f = placementFields(e.river.bankOffset.value), [clear] = landingClearings(crossingGeometry(f));
    const s = o.station, fps = [s.house, s.terrace, s.shelter, e.infrastructure.neighbourHouse.value ? s.neighbour : null];
    for (const fp of fps) if (fp) for (const [x, z] of corners(fp)) {
      expect(Math.hypot(x - clear[0], z - clear[1]), `${e.id}`).toBeLessThanOrEqual(LANDING_CLEARING[0]);
      expect(i.dryAt(x, z), `${e.id} corner on dry ground`).toBe(true);
    }
  });
  test('deterministic', () => {
    const a = buildInfrastructure(input(ERAS[5])), b = buildInfrastructure(input(ERAS[5]));
    expect(triangles(a)).toBe(triangles(b));
    expect(Array.from(a.parts.concrete!.attributes.position.array)).toEqual(Array.from(b.parts.concrete!.attributes.position.array));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/infrastructure/build.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `build.ts`**

```ts
import type * as THREE from 'three';
import type { Infrastructure } from '../data/eras';
import type { XZ } from '../data/geo/types';
import type { LandingPad } from '../terrain/landingPads';
import { bridgePlan, buildBridge } from './bridge';
import type { DirtPatch } from './groundMask';
import { buildLanding, landingDirt } from './landing';
import { finish, makeBuilders, triangleCount, type GroundAt, type InfraMaterialId } from './parts';
import { buildRoadStrip } from './roadStrip';
import type { EraRoads } from './roads';
import { buildStation, stationLayout, upstreamSign, type StationLayout } from './station';

export interface InfraInput {
  infra: Infrastructure; pads: readonly [LandingPad, LandingPad]; roads: EraRoads; bridgeWay: readonly XZ[];
  groundAt: GroundAt; landAt: (x: number, z: number) => boolean; dryAt: (x: number, z: number) => boolean;
  waterAt: (x: number, z: number) => number;
}
export interface InfraOutput {
  parts: Partial<Record<InfraMaterialId, THREE.BufferGeometry>>; road: THREE.BufferGeometry | null; dirt: DirtPatch[]; station: StationLayout;
}
/** Spec 4a §5. */
export const LIMITS = { drawCalls: 12, triangles: 40000 } as const;

/** All of one era's infrastructure: ≤ 5 merged meshes (one per material) plus the story-road strip. Pure. */
export function buildInfrastructure(i: InfraInput): InfraOutput {
  const b = makeBuilders(), v = i.infra, [east, west] = i.pads;
  buildLanding(b, east, v.landing.value, 1);
  buildLanding(b, west, v.landing.value, 2);
  const gone = v.bridge.value !== 'none' && !v.neighbourHouse.value;
  const station = stationLayout(east, v.station.value, gone, upstreamSign(east, i.bridgeWay), i.dryAt);
  buildStation(b, station, v.station.value, v.neighbourHouse.value, i.groundAt, 3);
  const plan = bridgePlan(i.bridgeWay, v.bridge.value, i.waterAt, i.groundAt);
  if (plan) buildBridge(b, plan, v.bridge.value, i.groundAt);
  return {
    parts: finish(b),
    road: buildRoadStrip(i.roads.story, i.groundAt, i.landAt),
    dirt: [...landingDirt(east, v.landing.value), ...landingDirt(west, v.landing.value), ...station.dirt],
    station,
  };
}
export const drawCalls = (o: InfraOutput) => Object.keys(o.parts).length + (o.road ? 1 : 0);
export const triangles = (o: InfraOutput) =>
  Object.values(o.parts).reduce((n, g) => n + triangleCount(g!), 0) + (o.road ? triangleCount(o.road) : 0);
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/infrastructure/build.test.ts`. Expected: PASS. If a station corner lands outside the clearing for some era (the real bank curves), shift that building's `a`/`v` in `stationLayout` toward the pad by 1 m steps until every era passes; write the final numbers in the rulings note. Do not widen `LANDING_CLEARING`.

- [ ] **Step 5: Implement `Infrastructure.tsx`**

```tsx
import { useEffect, useMemo } from 'react';
import { waterAt } from '../ancon/geometry';
import type { Era } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { groundUniforms, NO_GROUND } from '../scene/groundUniforms';
import { makeInfoTexture } from '../scene/useWorldFields';
import { sampleField, WATER, type WorldFields } from '../terrain/fields';
import { landingPadsFor, placementFields } from '../terrain/placementFields';
import { buildInfrastructure } from './build';
import { groundMask, SURFACE_INDEX } from './groundMask';
import { infraMaterials, roadMaterial } from './materials';
import type { InfraMaterialId } from './parts';
import { bridgeWay, eraRoads } from './roads';

const G = geo as unknown as GeoBundle;
const BRIDGE_WAY_POINTS = bridgeWay(G);

/**
 * Phase 4a: roads, landings, station and bridge for the current era. Geometry is built once per era and
 * tier (≤ 5 merged meshes + the road strip); minor roads and trodden dirt go to the terrain as the
 * uGround mask. Heights read the tier's rendered terrain (`near`); water tests read the fixed 512
 * placement fields, like the ferry, so nothing moves between tiers.
 */
export function Infrastructure({ near, era, castShadow }: { near: WorldFields; era: Era; castShadow: boolean }) {
  const bank = era.river.bankOffset.value;
  const place = useMemo(() => placementFields(bank, near), [bank, near]);
  const roads = useMemo(() => eraRoads(G, era), [era]);
  const out = useMemo(() => buildInfrastructure({
    infra: era.infrastructure, pads: landingPadsFor(bank), roads, bridgeWay: BRIDGE_WAY_POINTS,
    groundAt: (x, z) => sampleField(near, near.height, x, z),
    landAt: (x, z) => waterAt(place, x, z) === WATER.LAND,
    dryAt: (x, z) => waterAt(place, x, z) === WATER.LAND && sampleField(place, place.shore, x, z) >= 2,
    waterAt: (x, z) => waterAt(place, x, z),
  }), [era, bank, roads, near, place]);
  useEffect(() => () => { for (const g of Object.values(out.parts)) g?.dispose(); out.road?.dispose(); }, [out]);

  const mask = useMemo(() => {
    const m = groundMask(roads, out.dirt);
    return { tex: makeInfoTexture(m.data, m.size), rect: m.rect };
  }, [roads, out]);
  useEffect(() => {
    groundUniforms.uGround.value = mask.tex;
    groundUniforms.uGroundRect.value.set(mask.rect[0], mask.rect[1], mask.rect[2], 0);
    groundUniforms.uRoadSurface.value = SURFACE_INDEX[era.infrastructure.roadSurface.value];
    return () => { groundUniforms.uGround.value = NO_GROUND; mask.tex.dispose(); };
  }, [mask, era]);

  const mats = infraMaterials();
  return (
    <group>
      {(Object.keys(out.parts) as InfraMaterialId[]).map((id) => (
        <mesh key={id} geometry={out.parts[id]} material={mats[id]} castShadow={castShadow} receiveShadow />
      ))}
      {out.road && <mesh geometry={out.road} material={roadMaterial(era.infrastructure.roadSurface.value)} receiveShadow />}
    </group>
  );
}
```

- [ ] **Step 6: Mount it**

`src/scene/World.tsx`: import `{ Infrastructure } from '../infrastructure/Infrastructure'` and add after `<Vegetation ... />`:

```tsx
      <Infrastructure near={near} era={era} castShadow={q.shadowMap > 0} />
```

- [ ] **Step 7: Keep trees out of the bridge**

`src/vegetation/Vegetation.tsx`: import `bridgeCorridor, BRIDGE` from `'../infrastructure/bridge'` and `bridgeWay` from `'../infrastructure/roads'`; add at module level:

```ts
/** Eras with a bridge keep woody plants off its line (deck half-width + 3 m), so no crown pierces the deck (4a). */
const inBridge = bridgeCorridor(bridgeWay(G), BRIDGE.width / 2 + 3);
```

In `Vegetation`, after `caneSkip`:

```ts
  const bridge = era.infrastructure.bridge.value !== 'none';
  const skip = useMemo(() => (bridge ? (x: number, z: number) => inBridge(x, z) || !!caneSkip?.(x, z) : caneSkip), [bridge, caneSkip]);
```

Change the placement key to `placementKey(dens, bankOffset, tier, \`p${survival}|c${caneShare}|b${bridge ? 1 : 0}\`)`, pass `skip` instead of `caneSkip` to the near `placeAll` (`{ skip, planted }`), use `!!skip?.(x, z)` instead of `!!caneSkip?.(x, z)` in the far run, and replace `caneSkip` with `skip` in that `useMemo`'s dependency list. Ground cover is unchanged.

- [ ] **Step 8: Run all tests and the type check**

Run: `npm test` and `npx tsc -p tsconfig.json --noEmit` → all pass, no errors.

- [ ] **Step 9: Look at it**

`npm run dev`, open each (q=medium, freeze=1) and check:
- `?era=1900&cam=station&t=12` — thatched shelter, bare trodden bank, sand road with ruts, no houses.
- `?era=1959&cam=station&t=12&c=5` — timber-edged landing, stakes, teal wooden house on posts with zinc roof, pink neighbour upstream, asphalt road; the docked ferry's end on the landing.
- `?era=1975&cam=station&t=17` — concrete ramp, concrete house, terrace with zinc roof facing the river.
- `?era=1984&cam=station&t=12` — neighbour's house gone, bare dirt lot.
- `?era=1984&cam=bridge&t=12` and `?era=1986&cam=bridge&t=17` — the gap, forms, flags and crane; then the whole bridge with parapets and lamps; no tree through the deck; the bridge shows in the water reflection.
- `?era=1975&cam=ride&t=17` — the default visitor view: the landing and house read from the deck; no z-fighting on the road strip.

Fix anything broken (floating, sunk, inside-out, flicker). Browser console: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/infrastructure src/scene/World.tsx src/vegetation/Vegetation.tsx
git commit -m "feat(infrastructure): roads, landings, station and bridge on screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: After shots, frame rate, art gate

**Files:**
- Create: `tests/snapshots/phase4a/*.png`
- Modify: `docs/superpowers/notes/phase-4a-rulings.md`

- [ ] **Step 1: After shots**

```bash
npx playwright test tests/e2e/world.spec.ts
```

Expected: all pass, no console errors; PNGs in `tests/snapshots/phase4a/`. Also run `npx playwright test tests/e2e/leak.spec.ts` → pass (era switches stay leak-free).

- [ ] **Step 2: Frame rate**

`npm run build && npm run preview`; rerun every Task 1 Step 6 query. Add an "After" table to the rulings note. Check the Global Constraints limit (mean frame time within 5 % of baseline on every tier). If it fails, stop and report the numbers to the controller.

- [ ] **Step 3: Art gate**

Compare each `phase4a/` shot with its `phase4a-before/` twin, with the quality-bar image and with the research photos (V1, Archivo Negro). One line per shot in the rulings note: what changed, what still looks wrong. Fix Important problems before the review (for example: buildings floating or sunk, roofs inside-out, road strip flicker, the bridge missing from the reflection, a tree through the deck, a landing that reads as a flat grey slab). List Minor ones under Deferred.

- [ ] **Step 4: Commit**

```bash
git add tests/snapshots/phase4a docs/superpowers/notes/phase-4a-rulings.md
git commit -m "test(4a): after shots, frame rate, art gate notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Fact check and final review (controller)

- [ ] **Step 1: Fact check.** Dispatch a review agent to check spec 4a §2 claims and the `eras.ts` infrastructure comments against [S1], [S3], [S4], [S6], [S9], [S26], [S27], [S30] (URLs in `docs/research/ancon-research.md` and `src/data/sources.ts`). Show the user only flagged items; fix wording or confidence as ruled.
- [ ] **Step 2: Final code review** of the branch diff (as in earlier phases). Fix Important items; add Minor ones to the rulings note §Deferred.
- [ ] **Step 3: Hand over.** Tell the user the branch is ready, with the art-gate shots, and ask for merge approval. Do not merge or push to `main` without it.
