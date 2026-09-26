# Phase 2a — Vegetation core + three key species Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Phase-1 carry-over items, build a deterministic, era-aware vegetation system (placement → instanced LOD0 meshes + baked impostor cards → wind), and ship three code-generated species — red mangrove, coconut palm, Casuarina — so the river banks and coast read as the real Loíza landscape.

**Architecture:** Pure, unit-tested TypeScript decides *where* plants go (masks from world fields + OSM roads, habitat rules, jittered-grid scatter with an occupancy grid). Pure generators build each species' geometry (`PlantPart[]` with an `aFlex` attribute). Browser-only modules paint leaf textures on canvas and bake impostors. One R3F component per species renders LOD0 instanced parts near the camera and cross-card impostors elsewhere; the water's reflection pass swaps to cards only.

**Tech Stack:** three 0.186, R3F 9, drei 10, three-custom-shader-material 6 (supports `csm_FragNormal`), zustand, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-26-ancon-loiza-design.md` (§12 Phase 2) · Carry-over: `docs/superpowers/notes/phase-1-carryover.md` · Research: `docs/research/ancon-research.md` (§5 Flora)

## Global Constraints

- World frame: origin lat 18.43485, lon -65.8823; 1 unit = 1 m; +X east, +Y up, +Z south.
- Trade wind blows from the ENE toward the WSW: wind direction vector (XZ) = normalize(-1, 0.35). River flows SW→NE: normalize(1, -1).
- Every era fact carries `sources` + `confidence`; inferred values set `inferred: true`.
- All plant art generated in code — no downloaded models or textures.
- Placement is deterministic (same fields + seed ⇒ same instances).
- Quality tiers `high | medium | low` control vegetation density and LOD distance.
- Performance budget: ≥ 60 fps on the dev Mac (Apple M4 Pro) at q=high with the `ride` camera; report fps for high and low.
- Commit message bodies end, after a blank line, with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File map

```
src/geo/constants.ts                 RIVER_DIR, WIND_DIR (shared)
src/scene/sunUniforms.ts             shared sun uniforms (moved from terrainMaterial.ts)
src/scene/shadowFocus.ts             pure: camera-following, texel-snapped shadow placement
src/scene/SkyAndLight.tsx            uses shadowFocus each frame
src/scene/terrainMaterial.ts         grass glow → shadowed normal tilt
src/scene/water/Water.tsx            RIVER_DIR import; reflection hooks
src/scene/water/reflectionHooks.ts   before/after callbacks around the reflection render
src/ui/DebugPanel.tsx / App.tsx      debug UI lazy-loaded
src/quality.ts                       + veg settings
src/data/eras.ts                     + vegetation densities per era
src/vegetation/types.ts              SpeciesId, PlantInstance, Site, PlantPart
src/vegetation/rng.ts                cellRng (hash-seeded mulberry32)
src/vegetation/masks.ts              roadDist, riverDist, town
src/vegetation/rules.ts              per-species habitat density + spacing + radius
src/vegetation/placement.ts          jittered scatter + occupancy → PlantInstance[]
src/vegetation/lod.ts                pure LOD partition
src/vegetation/windMaterial.ts       CSM plant material + matching depth material
src/vegetation/impostor.ts           bake cross-card impostor (browser)
src/vegetation/textures.ts           canvas leaf textures (browser)
src/vegetation/species/palm.ts       coconut palm generator
src/vegetation/species/mangrove.ts   red mangrove generator
src/vegetation/species/casuarina.ts  Casuarina generator
src/vegetation/species/index.ts      registry: SpeciesId → { build(seed), texture }
src/vegetation/InstancedSpecies.tsx  LOD0 + cards + reflection swap
src/vegetation/Vegetation.tsx        builds masks/placements per era/quality, renders species
```

---

### Task 1: Shared constants, shared sun uniforms, lazy debug UI

**Files:**
- Create: `src/geo/constants.ts`, `src/scene/sunUniforms.ts`, `src/geo/constants.test.ts`
- Modify: `src/scene/water/Water.tsx` (import directions), `src/scene/terrainMaterial.ts` + `src/scene/Terrain.tsx` (import `sunUniforms` instead of `terrainSun`), `src/App.tsx` (lazy DebugPanel + StatsGl only when debug)

**Interfaces:**
- Produces: `RIVER_DIR: readonly [number, number]`, `WIND_DIR: readonly [number, number]` (unit XZ vectors); `sunUniforms = { uSunDir, uSunColor, uSunI }` (same objects Terrain already updates).

- [ ] **Step 1: Failing test**

```ts
// src/geo/constants.test.ts
import { expect, test } from 'vitest';
import { RIVER_DIR, WIND_DIR } from './constants';

test('river flows SW→NE and wind blows toward the WSW, both unit length', () => {
  expect(Math.hypot(...RIVER_DIR)).toBeCloseTo(1, 9);
  expect(Math.hypot(...WIND_DIR)).toBeCloseTo(1, 9);
  expect(RIVER_DIR[0]).toBeGreaterThan(0); expect(RIVER_DIR[1]).toBeLessThan(0);   // east, north
  expect(WIND_DIR[0]).toBeLessThan(0); expect(WIND_DIR[1]).toBeGreaterThan(0);     // west, south
});
```

- [ ] **Step 2: Implement**

```ts
// src/geo/constants.ts
const unit = (x: number, z: number) => { const l = Math.hypot(x, z); return [x / l, z / l] as const; };
/** Lower Río Grande de Loíza flows SW→NE (research §1.1). XZ, +X east, +Z south. */
export const RIVER_DIR = unit(1, -1);
/** ENE trade wind blows toward the WSW (research §1.3). XZ. */
export const WIND_DIR = unit(-1, 0.35);
```

```ts
// src/scene/sunUniforms.ts
import * as THREE from 'three';
/** Sun uniforms shared by terrain and vegetation materials (updated in place by <Terrain>). */
export const sunUniforms = {
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(1, 1, 1) },
  uSunI: { value: 0 },
};
```

Replace `terrainSun` (declared in `terrainMaterial.ts`) with `sunUniforms` everywhere; delete the old export. In `Water.tsx`, replace the local `RIVER_DIR`/`WIND_DIR` with `new THREE.Vector2(...RIVER_DIR)` / `new THREE.Vector2(...WIND_DIR)` from constants.

In `App.tsx`: `const DebugPanel = lazy(() => import('./ui/DebugPanel').then((m) => ({ default: m.DebugPanel })))`; render `{debug && <Suspense fallback={null}><DebugPanel /></Suspense>}`. `DebugPanel` keeps its store-sync logic; `<Leva hidden>` can become `<Leva />` since it only mounts in debug. Keep `StatsGl` under `debug`.

- [ ] **Step 3: Verify.** `npm test`, `npm run build`. Check the build output: the main chunk no longer contains leva (`grep -l "leva" dist/assets/*.js` shows only a separate chunk). Commit (`refactor: shared direction constants and sun uniforms; lazy debug UI`).

---

### Task 2: Camera-following, texel-snapped shadows

**Files:**
- Create: `src/scene/shadowFocus.ts`, `src/scene/shadowFocus.test.ts`
- Modify: `src/scene/SkyAndLight.tsx`, `src/quality.ts`

**Interfaces:**
- Produces: `shadowFocus(camPos: [n,n,n], camDir: [n,n,n], sunDir: [n,n,n], half: number, mapSize: number): { target: [n,n,n]; position: [n,n,n] }`; `QualitySettings.shadowHalf: number` (m) — high 140, medium 110, low 0.

- [ ] **Step 1: Failing tests**

```ts
// src/scene/shadowFocus.test.ts
import { expect, test } from 'vitest';
import { shadowFocus } from './shadowFocus';

const SUN: [number, number, number] = [-0.6, 0.35, 0.72];
const n = (v: number[]) => { const l = Math.hypot(...v); return v.map((x) => x / l) as [number, number, number]; };

test('focus sits on the ground ahead of a downward-looking camera', () => {
  const { target } = shadowFocus([0, 50, 100], n([0, -1, -1]), n(SUN), 140, 4096);
  expect(target[1]).toBeCloseTo(0, 0);
  expect(target[2]).toBeGreaterThan(40); expect(target[2]).toBeLessThan(60); // hits y=0 at z≈50
});
test('horizontal camera focuses a clamped distance ahead', () => {
  const { target } = shadowFocus([0, 4, 0], [0, 0, -1], n(SUN), 140, 4096);
  expect(-target[2]).toBeGreaterThan(60); expect(-target[2]).toBeLessThanOrEqual(141);
});
test('light position is 1500 m toward the sun from the target', () => {
  const s = n(SUN);
  const { target, position } = shadowFocus([0, 4, 0], [0, 0, -1], s, 140, 4096);
  for (let i = 0; i < 3; i++) expect(position[i] - target[i]).toBeCloseTo(s[i] * 1500, 3);
});
test('small camera moves do not move the shadow grid off texel multiples (no shimmer)', () => {
  const s = n(SUN), texel = (2 * 140) / 4096;
  const a = shadowFocus([0, 4, 0], [0, 0, -1], s, 140, 4096).target;
  const b = shadowFocus([0.013, 4, 0.021], [0, 0, -1], s, 140, 4096).target;
  // Project the difference onto the light's right/up axes: must be a whole number of texels.
  const up = [0, 1, 0];
  const right = n([up[1] * s[2] - up[2] * s[1], up[2] * s[0] - up[0] * s[2], up[0] * s[1] - up[1] * s[0]]);
  const d = a.map((v, i) => v - b[i]);
  const k = (d[0] * right[0] + d[1] * right[1] + d[2] * right[2]) / texel;
  expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
});
```

- [ ] **Step 2: Implement**

```ts
// src/scene/shadowFocus.ts
type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

/**
 * Where to aim a single directional shadow map so it covers what the camera looks at.
 * Focus = where the view ray meets y=0, clamped to [20, 0.9·half] m ahead (horizontal views
 * use the clamp). The focus is snapped to whole shadow texels in light space so the map
 * does not shimmer as the camera moves.
 */
export function shadowFocus(camPos: V3, camDir: V3, sunDir: V3, half: number, mapSize: number) {
  const maxAhead = 0.9 * half;
  let t = camDir[1] < -1e-3 ? -camPos[1] / camDir[1] : maxAhead;
  t = Math.min(maxAhead, Math.max(20, t));
  const f: V3 = [camPos[0] + camDir[0] * t, 0, camPos[2] + camDir[2] * t];
  const s = norm(sunDir);
  const right = norm(cross([0, 1, 0], s));
  const up = cross(s, right);
  const texel = (2 * half) / mapSize;
  const snap = (v: number) => Math.round(v / texel) * texel;
  const r = snap(dot(f, right)), u = snap(dot(f, up)), w = dot(f, s);
  const target: V3 = [0, 1, 2].map((i) => right[i] * r + up[i] * u + s[i] * w) as V3;
  const position: V3 = [0, 1, 2].map((i) => target[i] + s[i] * 1500) as V3;
  return { target, position };
}
```

- [ ] **Step 3: Wire.** In `quality.ts` add `shadowHalf` (high 140, medium 110, low 0). In `SkyAndLight.tsx`: accept `shadowHalf`; set the shadow camera bounds to ±`shadowHalf`; replace the fixed-focus effect with a `useFrame` that calls `shadowFocus(camera.position, camera.getWorldDirection(tmp), sun.dir, shadowHalf, shadowMap)` and copies `position`/`target` into the light (reuse module-level temporaries — no per-frame allocation). Pass `q.shadowHalf` from `World.tsx`.
- [ ] **Step 4: Verify** `npm test`, `npm run build`; screenshot `?cam=ride&t=<golden>` and `?cam=bank` with the Phase-1 helper — no shadow acne, no shimmer when orbiting (check in the browser pane). Commit (`feat(shadows): camera-following texel-snapped shadow map`).

---

### Task 3: Shadowed grass sheen (replace the unshadowed emissive glow)

**Files:**
- Modify: `src/scene/terrainMaterial.ts`

**Interfaces:**
- Consumes: `sunUniforms` (Task 1).

The Phase-1 terrain adds `csm_Emissive = c * sun * 0.12 * …` on grassy ground to mimic vertical blades catching a low sun. Emissive ignores shadows, so once trees cast shadows the grass would glow inside them.

- [ ] **Step 1:** Remove the `csm_Emissive` line. Instead tilt the shading normal of grassy ground toward the horizontal sun direction so lighting goes through the normal (shadowed) light loop:

```glsl
// replaces the emissive stand-in
float grassy = (1.0 - m.r) * (1.0 - m.g) * (1.0 - m.b) * (1.0 - wet);
vec3 sunH = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + vec3(1e-4));
float lowSun = 1.0 - smoothstep(0.15, 0.6, uSunDir.y);          // only near golden hour
vec3 bladeN = normalize(mix(vNw, normalize(vNw * 0.55 + sunH * 0.45), grassy * lowSun));
csm_FragNormal = normalize((viewMatrix * vec4(bladeN, 0.0)).xyz);
```

(`csm_FragNormal` is in view space for MeshStandardMaterial — confirm in `node_modules/three-custom-shader-material/README.md`; if it expects another space, adapt and note it.)

- [ ] **Step 2: Verify** golden-hour `aerial` and `bank` shots look at least as warm on pasture as before (compare with `tests/snapshots/phase1/*.png`), and a shadowed area (after Task 10 there are trees; for now check the terrain self-shadow side of a dune) does not glow. `npm test`, `npm run build`. Commit (`fix(terrain): grass sheen via shadowed normal tilt instead of emissive`).

---

### Task 4: Investigate the brown mid-river patch (aerial view)

**Files:**
- Modify: `src/scene/water/waterShader.ts`, `src/scene/water/Water.tsx`, `src/state/url.ts` (+ test) — only as the root cause requires.

Use superpowers:systematic-debugging. The Phase-1 aerial snapshot (`tests/snapshots/phase1/1984-aerial.png`) shows a brown patch in mid-river that the fields do not explain.

- [ ] **Step 1:** Add a debug view: `?view=water` (parsed in `url.ts` as `debugView: 'water' | undefined`, with a url test) makes the water shader output `waterInfo` channels as colours (R depth, G river flag, B shore distance) instead of shading.
- [ ] **Step 2:** Screenshot the aerial camera with and without the debug view. Decide the cause from evidence (candidates: body colour vs depth curve, reflection of the terrain/fog, near/far texture seam, sampling of the Reflector texture). Write the evidence in the report.
- [ ] **Step 3:** Fix the root cause with the smallest change; keep the debug view (it is useful for Phase 3). Re-shoot. `npm test`, `npm run build`. Commit (`fix(water): <root cause>` + `feat(debug): ?view=water`).

---

### Task 5: Vegetation data — era densities, quality settings, masks, rules, placement

**Files:**
- Create: `src/vegetation/types.ts`, `src/vegetation/rng.ts`, `src/vegetation/masks.ts`, `src/vegetation/rules.ts`, `src/vegetation/placement.ts`
- Modify: `src/data/eras.ts` (+ `eras.test.ts`), `src/quality.ts`
- Test: `src/vegetation/rng.test.ts`, `src/vegetation/placement.test.ts`

**Interfaces:**
- Consumes: `WorldFields`, `WATER`, `LANDCLS`, `sampleField` (fields.ts); `distanceTransform`; `drawPolyline`; `GeoBundle`; `landmarkXZ`.
- Produces:
  - `type SpeciesId = 'redMangrove' | 'coconut' | 'casuarina'`
  - `interface PlantInstance { x: number; y: number; z: number; rot: number; scale: number; variant: number }`
  - `interface Site { water: number; depth: number; shore: number; seaDist: number; riverDist: number; roadDist: number; height: number; landCls: number; town: number }`
  - `cellRng(i: number, j: number, seed: number): () => number`
  - `interface VegMasks { roadDist: Float32Array; riverDist: Float32Array; town: Float32Array }`; `buildVegMasks(geo, f): VegMasks`; `TOWN_RADIUS = 230`
  - `interface SpeciesRule { spacing: number; radius: number; scale: [number, number]; variants: number; density(s: Site): number }`; `RULES: Record<SpeciesId, SpeciesRule>`; `PLACEMENT_ORDER: SpeciesId[]` (largest first)
  - `class Occupancy { constructor(grid: Grid, cell?: number); free(x, z, r): boolean; mark(x, z, r): void }`
  - `placeSpecies(f, masks, species, opts: { density: number; seed: number; occupancy?: Occupancy }): PlantInstance[]`
  - `placeAll(f, masks, densities: Record<SpeciesId, number>, seed): Record<SpeciesId, PlantInstance[]>`
  - `Era.vegetation: Record<SpeciesId, Sourced<number>>`
  - `QualitySettings.veg: { density: number; lod0: number; farCards: boolean }` — high {1, 220, true}, medium {0.7, 150, true}, low {0.4, 90, false}

- [ ] **Step 1: Era data (tests first).** Add to `eras.test.ts`: every era has `vegetation.redMangrove|coconut|casuarina` as Sourced numbers in [0, 1.5], included in the "every fact is sourced or inferred" check. Then add to `eras.ts`:

```ts
// in Era interface
vegetation: Record<'redMangrove' | 'coconut' | 'casuarina', Sourced<number>>;

// helpers
const MANGROVE = s(1, ['S22', 'S34'], 'H');                 // mangrove fringe is ancient; DRNA Piñones forest
const veg = (coconut: Sourced<number>, casuarina: Sourced<number>) => ({ redMangrove: MANGROVE, coconut, casuarina });
// coconut: coast shifted from sugar to coconut collection (S23); groves mature through the 20th c. (inferred timing)
// casuarina: gives Piñones its name; forest proclaimed 1918 (S22, S28); planting timeline not sourced (inferred)
```

Per era (`coconut`, `casuarina`): 1840 (0.35 L inferred, 0.15 L inferred), 1900 (0.6 M inferred [S23], 0.3 L inferred [S28]), 1925 (0.9, 0.55), 1935 (1.0, 0.8), 1959 (1.0, 1.0), 1975 (1.0, 1.0), 1984 (0.95, 1.0), 1986 (0.95, 1.0). Sources for coconut ['S23'], casuarina ['S22','S28']; mark all as `inferred: true` with 'L' except 1959+ casuarina ('M', not inferred — present on the coast in modern photos [S19b] → add 'S19' to SOURCES if missing: `S19: Wikimedia Commons "2 Ancón de Loíza.jpg"`, url from the research doc).

- [ ] **Step 2: Quality.** Add `veg` to `QualitySettings` and all three tiers as listed above.

- [ ] **Step 3: Failing tests for rng + placement**

```ts
// src/vegetation/rng.test.ts
import { expect, test } from 'vitest';
import { cellRng } from './rng';

test('cellRng is deterministic per (i, j, seed) and in [0,1)', () => {
  const a = cellRng(3, 7, 42), b = cellRng(3, 7, 42), c = cellRng(4, 7, 42);
  const va = [a(), a(), a()], vb = [b(), b(), b()];
  expect(va).toEqual(vb);
  expect(c()).not.toBe(va[0]);
  for (const v of va) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
});
```

```ts
// src/vegetation/placement.test.ts
import { describe, expect, test } from 'vitest';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { buildFields, WATER } from '../terrain/fields';
import { buildVegMasks } from './masks';
import { placeAll, placeSpecies } from './placement';
import { RULES } from './rules';

const G = geo as unknown as GeoBundle;
const f = buildFields(G, { extent: 2560, size: 256, bankOffset: 0 });
const m = buildVegMasks(G, f);
const at = (arr: Float32Array | Uint8Array, x: number, z: number) => {
  const i = Math.floor((x - f.grid.minX) / f.grid.cell), j = Math.floor((z - f.grid.minZ) / f.grid.cell);
  return arr[j * f.grid.size + i];
};

describe('placement', () => {
  const all = placeAll(f, m, { redMangrove: 1, coconut: 1, casuarina: 1 }, 7);

  test('deterministic', () => {
    expect(placeAll(f, m, { redMangrove: 1, coconut: 1, casuarina: 1 }, 7)).toEqual(all);
  });
  test('plausible counts on the real map', () => {
    expect(all.redMangrove.length).toBeGreaterThan(400);
    expect(all.coconut.length).toBeGreaterThan(300);
    expect(all.casuarina.length).toBeGreaterThan(150);
  });
  test('mangroves hug the river, never the open coast', () => {
    for (const p of all.redMangrove) {
      expect(at(m.riverDist, p.x, p.z)).toBeLessThan(45);
      expect(at(f.seaDist, p.x, p.z)).toBeGreaterThanOrEqual(60);
    }
  });
  test('palms and pines stand on dry land, off roads', () => {
    for (const p of [...all.coconut, ...all.casuarina]) {
      expect(at(f.water, p.x, p.z)).toBe(WATER.LAND);
      expect(at(m.roadDist, p.x, p.z)).toBeGreaterThanOrEqual(5);
    }
  });
  test('occupancy keeps different species apart', () => {
    const big = [...all.casuarina, ...all.coconut];
    const r = Math.min(RULES.casuarina.radius, RULES.coconut.radius);
    // sample check: first 300 against all (quadratic but small)
    for (const a of big.slice(0, 300)) for (const b of big) {
      if (a === b) continue;
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(r - 1e-6);
    }
  });
  test('density scales counts roughly linearly', () => {
    const full = placeSpecies(f, m, 'coconut', { density: 1, seed: 3 }).length;
    const half = placeSpecies(f, m, 'coconut', { density: 0.5, seed: 3 }).length;
    expect(half / full).toBeGreaterThan(0.35);
    expect(half / full).toBeLessThan(0.65);
  });
  test('instances sit on the terrain height', () => {
    for (const p of all.coconut.slice(0, 50)) expect(p.y).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Implement**

```ts
// src/vegetation/types.ts
import type * as THREE from 'three';
export type SpeciesId = 'redMangrove' | 'coconut' | 'casuarina';
export interface PlantInstance { x: number; y: number; z: number; rot: number; scale: number; variant: number }
export interface Site {
  water: number; depth: number; shore: number; seaDist: number; riverDist: number;
  roadDist: number; height: number; landCls: number; town: number;
}
/** One drawable part of a plant (e.g. bark, foliage). Geometry carries an `aFlex` (0 base … 1 tip) attribute. */
export interface PlantPart { name: 'bark' | 'foliage'; geometry: THREE.BufferGeometry }
```

```ts
// src/vegetation/rng.ts
function hash3(i: number, j: number, seed: number) {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
/** Deterministic mulberry32 stream for one grid cell. */
export function cellRng(i: number, j: number, seed: number) {
  let a = hash3(i, j, seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

```ts
// src/vegetation/masks.ts
import type { GeoBundle } from '../data/geo/types';
import { landmarkXZ } from '../data/landmarks';
import { distanceTransform } from '../terrain/edt';
import { WATER, type WorldFields } from '../terrain/fields';
import { drawPolyline } from '../terrain/raster';

export const TOWN_RADIUS = 230;
export interface VegMasks { roadDist: Float32Array; riverDist: Float32Array; town: Float32Array }

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Distances (m) to road centrelines and to river/pond water, plus a 0..1 Loíza town-core weight. */
export function buildVegMasks(geo: GeoBundle, f: WorldFields): VegMasks {
  const g = f.grid, N = g.size * g.size;
  const road = new Uint8Array(N);
  for (const r of geo.roads) if (!r.bridge) drawPolyline(g, road, r.points, 1);
  const river = new Uint8Array(N);
  for (let i = 0; i < N; i++) river[i] = f.water[i] === WATER.RIVER || f.water[i] === WATER.POND ? 1 : 0;
  const dRoad = distanceTransform(road, g.size, g.size), dRiver = distanceTransform(river, g.size, g.size);
  const [px, pz] = landmarkXZ('plaza');
  const roadDist = new Float32Array(N), riverDist = new Float32Array(N), town = new Float32Array(N);
  for (let j = 0; j < g.size; j++) for (let i = 0; i < g.size; i++) {
    const k = j * g.size + i, x = g.minX + (i + 0.5) * g.cell, z = g.minZ + (j + 0.5) * g.cell;
    roadDist[k] = dRoad[k] * g.cell;
    riverDist[k] = dRiver[k] * g.cell;
    town[k] = f.water[k] ? 0 : 1 - smooth(TOWN_RADIUS * 0.6, TOWN_RADIUS, Math.hypot(x - px, z - pz));
  }
  return { roadDist, riverDist, town };
}
```

```ts
// src/vegetation/rules.ts
import { LANDCLS, WATER } from '../terrain/fields';
import type { Site, SpeciesId } from './types';

export interface SpeciesRule {
  /** Jittered-grid spacing, m. */ spacing: number;
  /** Occupancy radius, m. */ radius: number;
  scale: [number, number]; variants: number;
  /** Habitat suitability 0..1 at a site. */ density(s: Site): number;
}
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const RULES: Record<SpeciesId, SpeciesRule> = {
  // Rhizophora mangle: river/lagoon fringe and shallows, never the surf coast (research §5).
  redMangrove: {
    spacing: 3.2, radius: 1.2, scale: [0.7, 1.25], variants: 3,
    density: (s) => {
      if (s.seaDist < 60) return 0;
      if (s.water === WATER.RIVER || s.water === WATER.POND) return s.depth < 0.9 && s.shore > -6 ? 0.85 : 0;
      if (s.water !== WATER.LAND || s.roadDist < 6) return 0;
      const band = 1 - smooth(4, 9, s.riverDist);
      const wet = s.landCls === LANDCLS.WETLAND ? 0.5 * (1 - smooth(0, 40, s.riverDist)) : 0;
      return Math.max(band, wet) * (1 - s.town);
    },
  },
  // Cocos nucifera: coastal sand strip, some on river banks, sparse in town yards.
  coconut: {
    spacing: 8, radius: 2.5, scale: [0.8, 1.2], variants: 3,
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 5 || s.height < 0.3 || s.landCls === LANDCLS.WETLAND) return 0;
      const coast = s.seaDist > 12 ? 1 - smooth(180, 320, s.seaDist) : 0;
      const bank = 0.25 * (1 - smooth(10, 40, s.riverDist)) * smooth(4, 8, s.riverDist);
      return Math.min(1, 0.55 * coast + bank + 0.18 * s.town);
    },
  },
  // Casuarina equisetifolia ("piñones"): dunes and sand behind the beach.
  casuarina: {
    spacing: 7, radius: 3, scale: [0.75, 1.3], variants: 3,
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 5 || s.height < 0.3) return 0;
      const dune = s.seaDist > 20 ? 1 - smooth(90, 220, s.seaDist) : 0;
      const sand = s.landCls === LANDCLS.SAND ? 0.6 : 0;
      return Math.max(0.6 * dune, sand) * (1 - s.town);
    },
  },
};
/** Larger plants claim space first. */
export const PLACEMENT_ORDER: SpeciesId[] = ['casuarina', 'coconut', 'redMangrove'];
```

```ts
// src/vegetation/placement.ts
import { sampleField, type WorldFields } from '../terrain/fields';
import type { Grid } from '../terrain/raster';
import type { VegMasks } from './masks';
import { cellRng } from './rng';
import { PLACEMENT_ORDER, RULES } from './rules';
import type { PlantInstance, Site, SpeciesId } from './types';

export class Occupancy {
  private cells: Uint8Array; private n: number;
  constructor(private grid: Grid, private cell = 1) {
    this.n = Math.ceil((grid.cell * grid.size) / cell);
    this.cells = new Uint8Array(this.n * this.n);
  }
  private each(x: number, z: number, r: number, fn: (k: number) => boolean | void) {
    const c = this.cell, i0 = Math.floor((x - r - this.grid.minX) / c), i1 = Math.floor((x + r - this.grid.minX) / c);
    const j0 = Math.floor((z - r - this.grid.minZ) / c), j1 = Math.floor((z + r - this.grid.minZ) / c);
    for (let j = Math.max(0, j0); j <= Math.min(this.n - 1, j1); j++)
      for (let i = Math.max(0, i0); i <= Math.min(this.n - 1, i1); i++) {
        const cx = this.grid.minX + (i + 0.5) * c, cz = this.grid.minZ + (j + 0.5) * c;
        if (Math.hypot(cx - x, cz - z) <= r && fn(j * this.n + i) === false) return false;
      }
    return true;
  }
  free(x: number, z: number, r: number) { return this.each(x, z, r, (k) => this.cells[k] === 0) !== false; }
  mark(x: number, z: number, r: number) { this.each(x, z, r, (k) => { this.cells[k] = 1; }); }
}

function siteAt(f: WorldFields, m: VegMasks, x: number, z: number): Site | null {
  const g = f.grid, i = Math.floor((x - g.minX) / g.cell), j = Math.floor((z - g.minZ) / g.cell);
  if (i < 0 || j < 0 || i >= g.size || j >= g.size) return null;
  const k = j * g.size + i;
  const h = sampleField(f, f.height, x, z);
  return { water: f.water[k], depth: Math.max(0, -h), shore: f.shore[k], seaDist: f.seaDist[k], riverDist: m.riverDist[k],
    roadDist: m.roadDist[k], height: h, landCls: f.landCls[k], town: m.town[k] };
}

export function placeSpecies(f: WorldFields, m: VegMasks, species: SpeciesId,
  opts: { density: number; seed: number; occupancy?: Occupancy }): PlantInstance[] {
  const rule = RULES[species], g = f.grid, sp = rule.spacing, extent = g.cell * g.size;
  const n = Math.floor(extent / sp), out: PlantInstance[] = [];
  const salt = species.length * 7919 + species.charCodeAt(0);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = cellRng(i, j, opts.seed * 131 + salt);
    const x = g.minX + (i + 0.1 + 0.8 * r()) * sp, z = g.minZ + (j + 0.1 + 0.8 * r()) * sp;
    const accept = r(), rot = r() * Math.PI * 2, sc = r(), variant = Math.floor(r() * rule.variants);
    const s = siteAt(f, m, x, z);
    if (!s || accept >= rule.density(s) * opts.density) continue;
    if (opts.occupancy && !opts.occupancy.free(x, z, rule.radius)) continue;
    opts.occupancy?.mark(x, z, rule.radius);
    out.push({ x, y: Math.max(s.height, -0.3), z, rot, scale: rule.scale[0] + (rule.scale[1] - rule.scale[0]) * sc, variant });
  }
  return out;
}

export function placeAll(f: WorldFields, m: VegMasks, densities: Record<SpeciesId, number>, seed: number) {
  const occ = new Occupancy(f.grid, 1);
  const out = {} as Record<SpeciesId, PlantInstance[]>;
  for (const id of PLACEMENT_ORDER) out[id] = placeSpecies(f, m, id, { density: densities[id], seed, occupancy: occ });
  return out;
}
```

Note: `Occupancy.free` for a radius-r test checks that no marked cell lies within r of the candidate; two plants placed with radius r are therefore ≥ r apart (the test asserts that). Mangroves (smallest) are placed last and may crowd each other only via their own occupancy marks.

- [ ] **Step 5:** `npm test` (RED first, then GREEN), `npx tsc -p tsconfig.json --noEmit`. Report counts per species and the placement time for size 512 near fields (must be < 300 ms in Node). Commit (`feat(vegetation): era densities, masks, habitat rules, deterministic placement`).

---

### Task 6: Rendering core — wind material, LOD, impostors, reflection swap, InstancedSpecies

**Files:**
- Create: `src/vegetation/lod.ts` (+ `lod.test.ts`), `src/vegetation/windMaterial.ts`, `src/vegetation/impostor.ts`, `src/vegetation/InstancedSpecies.tsx`, `src/scene/water/reflectionHooks.ts`, `src/vegetation/species/testTree.ts` (temporary pipeline check, deleted in Task 10)
- Modify: `src/scene/water/Water.tsx`

**Interfaces:**
- Consumes: `PlantInstance`, `PlantPart`, `WIND_DIR`, `sunUniforms`.
- Produces:
  - `partitionLod(xs: Float32Array, zs: Float32Array, cx: number, cz: number, d0: number, near: Uint32Array, far: Uint32Array): [nNear: number, nFar: number]`
  - `windUniforms = { uTime, uWind: Vector2, uWindStrength: number }`
  - `makePlantMaterials(opts: { part: 'bark' | 'foliage'; map?: THREE.Texture; color: THREE.ColorRepresentation; roughness: number; alphaTest?: number; translucency?: number; vertexColors?: boolean }): { material: THREE.Material; depth: THREE.Material }`
  - `bakeImpostor(renderer: THREE.WebGLRenderer, parts: { geometry; material }[], size?: number): { texture: THREE.Texture; card: THREE.BufferGeometry }` (card = two crossed quads fitted to the plant's bounds, with `aFlex = uv.y`, normals bent outward)
  - `reflectionHooks = { before: Set<() => void>, after: Set<() => void> }` — Water calls every `before` hook right before the Reflector's render and every `after` hook right after.
  - `<InstancedSpecies variants={PlantPart[][]} materials={Record<'bark'|'foliage', {material, depth}>} instances={PlantInstance[]} lod0={number} castShadow={boolean} farCards={boolean} />`

- [ ] **Step 1: LOD partition (TDD)**

```ts
// src/vegetation/lod.test.ts
import { expect, test } from 'vitest';
import { partitionLod } from './lod';

test('splits by horizontal distance to the camera', () => {
  const xs = new Float32Array([0, 10, 100, 300]), zs = new Float32Array([0, 0, 0, 0]);
  const near = new Uint32Array(4), far = new Uint32Array(4);
  const [a, b] = partitionLod(xs, zs, 0, 0, 120, near, far);
  expect([a, b]).toEqual([3, 1]);
  expect(Array.from(near.slice(0, a))).toEqual([0, 1, 2]);
  expect(Array.from(far.slice(0, b))).toEqual([3]);
});
```

```ts
// src/vegetation/lod.ts
/** Indices within d0 (horizontal) of the camera go to `near`, the rest to `far`. No allocation. */
export function partitionLod(xs: Float32Array, zs: Float32Array, cx: number, cz: number, d0: number, near: Uint32Array, far: Uint32Array): [number, number] {
  let a = 0, b = 0; const d2 = d0 * d0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - cx, dz = zs[i] - cz;
    if (dx * dx + dz * dz <= d2) near[a++] = i; else far[b++] = i;
  }
  return [a, b];
}
```

- [ ] **Step 2: Wind material.** CSM over `MeshStandardMaterial` (+ a CSM over `MeshDepthMaterial` with `depthPacking: THREE.RGBADepthPacking`, same vertex code, same `map`/`alphaTest`, for `customDepthMaterial`). Vertex shader (shared string):

```glsl
uniform float uTime; uniform vec2 uWind; uniform float uWindStrength;
attribute float aFlex;
varying float vFlex;
void main() {
  vec3 ip = vec3(0.0); float s = 1.0; mat3 R = mat3(1.0);
  #ifdef USE_INSTANCING
    ip = instanceMatrix[3].xyz;
    s = length(instanceMatrix[0].xyz);
    R = mat3(instanceMatrix) / s;
  #endif
  float ph = dot(ip.xz, vec2(0.071, 0.053));
  float gust = 0.65 + 0.35 * sin(uTime * 0.31 + ph * 0.2);
  float sway = (sin(uTime * 1.1 + ph) * 0.7 + sin(uTime * 2.3 + ph * 1.7) * 0.3) * gust;
  float k = aFlex * aFlex;
  vec3 worldPush = vec3(uWind.x, 0.0, uWind.y) * uWindStrength * k * (0.6 + 0.4 * sway);
  worldPush.y = -0.15 * k * uWindStrength * abs(sway);                       // tips dip slightly
  float flutter = sin(uTime * 7.0 + ph * 5.0 + position.x * 3.1 + position.z * 2.7) * 0.03 * aFlex;
  vec3 local = transpose(R) * worldPush / s;                                   // world metres → local
  csm_Position = position + local + normal * flutter;
  vFlex = aFlex;
}
```

Foliage fragment: optional translucency — `csm_Emissive = diffuse * uSunColor * uSunI * uTrans * pow(max(dot(normalize(cameraPosition - vWorld), -uSunDir), 0.0), 3.0) * shadow-free…` is NOT allowed (emissive ignores shadows). Instead add a view-dependent back-light term only through `csm_DiffuseColor` brightening scaled by `uTrans * 0.25` — keep it subtle; lighting stays shadowed. Bark: `vertexColors` optional for coconut clusters.

- [ ] **Step 3: Impostor baker (browser).** Render the plant's parts (with plain `MeshBasicMaterial` clones sharing `map`, `alphaTest`, `color`, `vertexColors`, `side: DoubleSide`) into a `WebGLRenderTarget(size, size·aspect)` from the side with an orthographic camera fitted to the geometry bounds; `texture.colorSpace = SRGBColorSpace`, mipmaps on, transparent clear. Build the card geometry: two quads crossed at 90° through the trunk axis, sized to the bounds, UVs 0..1, `aFlex = uv.y`, normals = normalize(vertex − (0, 0.6·height, 0)) blended 50% with +Y. Restore renderer state (render target, clear colour/alpha) after baking. Dispose the temporary materials.

- [ ] **Step 4: Reflection hooks.** `reflectionHooks.ts` exports the two Sets. In `Water.tsx`, after creating the Reflector, wrap it:

```ts
const inner = r.onBeforeRender;
r.onBeforeRender = function (...args) {
  reflectionHooks.before.forEach((f) => f());
  inner.apply(this, args);
  reflectionHooks.after.forEach((f) => f());
};
```

- [ ] **Step 5: InstancedSpecies.** For each variant v: one `InstancedMesh` per part (LOD0) and one card `InstancedMesh` (LOD1, far only), plus one "all cards" `InstancedMesh` holding every instance of v (visible only during the reflection render). Precompute a `Float32Array` of 16-float matrices per instance (translation (x,y,z), rotation `rot` about Y, uniform `scale`). Every 250 ms, or when the camera moved > 8 m horizontally, run `partitionLod` per variant and copy the matching matrices into each mesh's `instanceMatrix.array`, set `.count`, flag `needsUpdate`. `frustumCulled = false` on all instanced meshes. Register a `before` hook: hide LOD0 + far cards, show all-cards; `after`: restore. `castShadow` on LOD0 parts and far cards; `receiveShadow` on all. Set `customDepthMaterial` from the depth materials. Dispose geometries/materials/textures created here on unmount. `farCards=false` (low tier) hides the far card mesh but keeps the reflection all-cards mesh.
- [ ] **Step 6: Pipeline check with a temporary test tree** (`species/testTree.ts`: a cone of foliage on a cylinder trunk with `aFlex`), rendered through `Vegetation`-less direct wiring in `World.tsx` at a few hand-placed instances near the east landing. Verify in screenshots: wind sway visible between two frames, shadows cast (and sway in the shadow), LOD swap distance works (debug: `?debug=1` shows counts in the leva panel — add a read-only "veg near/far" monitor), reflection shows cards. `npm test`, `npm run build`. Commit (`feat(vegetation): wind material, LOD, impostors, reflection swap, instanced renderer`).

---

### Task 7: Coconut palm (*Cocos nucifera*)

**Files:**
- Create: `src/vegetation/species/palm.ts` (+ `palm.test.ts`), `src/vegetation/textures.ts` (frond painter; later tasks add painters)

**Interfaces:**
- Produces: `buildPalm(seed: number): PlantPart[]` (bark with vertex colours incl. coconut cluster; foliage fronds); `paintFrond(): HTMLCanvasElement` (browser).

Reference morphology (general botany, mark as inferred in comments): 12–20 m tall; slender grey trunk 25–35 cm, swollen base, ring scars; often curved/leaning (toward the light / sea); crown of ~25–30 pinnate fronds 4–6 m long, the lowest drooping below horizontal, the newest near vertical; nut clusters under the crown.

- [ ] **Step 1: Tests (node)**

```ts
// src/vegetation/species/palm.test.ts
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { buildPalm } from './palm';

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

test('palm has bark + foliage with aFlex in [0,1] and plausible size', () => {
  const parts = buildPalm(1);
  expect(parts.map((p) => p.name).sort()).toEqual(['bark', 'foliage']);
  for (const p of parts) {
    const f = p.geometry.getAttribute('aFlex').array as Float32Array;
    expect(Math.min(...f)).toBeGreaterThanOrEqual(0); expect(Math.max(...f)).toBeLessThanOrEqual(1);
    expect(p.geometry.getAttribute('normal')).toBeDefined(); expect(p.geometry.getAttribute('uv')).toBeDefined();
  }
  const box = new THREE.Box3();
  for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox!); }
  expect(box.max.y).toBeGreaterThan(11); expect(box.max.y).toBeLessThan(23);
  expect(parts.reduce((n, p) => n + tris(p.geometry), 0)).toBeLessThan(4000);
});
test('deterministic by seed, different across seeds', () => {
  const a = buildPalm(5)[0].geometry.getAttribute('position').array;
  expect(buildPalm(5)[0].geometry.getAttribute('position').array).toEqual(a);
  expect(buildPalm(6)[0].geometry.getAttribute('position').array).not.toEqual(a);
});
```

- [ ] **Step 2: Generator.** Use `cellRng(seed, 0, 911)` for all randomness. Trunk: `CatmullRomCurve3` through 5 points rising to height H∈[12,19] with a lean of 0–12° toward a random azimuth biased to −Z (north, the sea) and a gentle S-curve; `TubeGeometry(curve, 18, r, 7)` with radius tapering 0.30→0.16 (rebuild radii per ring) and a 0.45 m base flare over the lowest 0.6 m; vertex colour grey-brown with ring-scar banding (darker every ~0.12 m along v). `aFlex = 0.35 · t²` along the trunk. Nut cluster: 6–10 small icosahedra (r 0.13) under the crown, green-brown vertex colour, `aFlex` = trunk top value. Fronds (26, spiral phyllotaxis 137.5°): each rachis a quadratic curve from the crown top, initial elevation from +70° (young) down to −35° (old), length 4–5.8 m, drooping under its own weight (sag ∝ t²). Ribbon of 12 segments; leaflet span width w(t)=1.5·sin(πt)^0.6; V-fold: left and right halves tilted down 25°. UV u across (0 left tip … 1 right tip), v along the rachis. `aFlex = 0.45 + 0.55·t`. Normals: blend of the ribbon normal and outward-from-crown. Merge into one foliage geometry (index + attributes) with `mergeGeometries`.
- [ ] **Step 3: Frond texture (browser).** 512×1024 canvas, transparent; along the v axis draw the rachis (thin, yellow-green) and ~80 leaflets per side as thin tapered strokes angled 30–40° forward, lengths following w(t), with slight colour variation (olive to deep green), subtle yellowing at tips, one or two torn gaps. `CanvasTexture`, `colorSpace = SRGB`, anisotropy 8, mipmaps.
- [ ] **Step 4: Visual check.** Temporarily render 5 palms (replace the test tree) near the east landing; screenshots from `bank` and a close orbit. Tune until the silhouette reads unmistakably as a coconut palm at golden hour (thin trunk, drooping feathery crown, backlit glow on fronds through translucency brightening). `npm test`, `npm run build`. Commit (`feat(vegetation): coconut palm`).

---

### Task 8: Red mangrove (*Rhizophora mangle*)

**Files:**
- Create: `src/vegetation/species/mangrove.ts` (+ `mangrove.test.ts`); add `paintMangroveLeaves()` to `textures.ts`

**Interfaces:**
- Produces: `buildMangrove(seed: number): PlantPart[]`, `paintMangroveLeaves(): HTMLCanvasElement`.

Reference morphology (research §5 + general botany): 4–8 m shrubby tree at the water's edge; arching stilt/prop roots springing from the trunk and lower branches 0.5–2.5 m up, reaching the mud 1.5–3.5 m out; a few aerial drop roots from branches; dense rounded canopy of thick glossy dark-green elliptic leaves (8–13 cm) with paler undersides.

- [ ] **Step 1: Tests** — same shape as the palm test: parts `bark` + `foliage`, `aFlex` in [0,1], height 3.5–9 m, lowest bark vertex ≤ −0.2 (roots reach into mud/water), triangle count < 3500, deterministic.
- [ ] **Step 2: Generator.** 1–3 short trunks (tubes, r 0.08–0.14) from y≈1.2 to canopy base ~2.5 m; 10–16 prop roots: each a cubic curve from a point on a trunk (y 0.6–2.3) arching outward and down to y −0.3 at radius 1.5–3.5 m, tube radius 0.035–0.06, 6 radial × 10 segments; 3–6 thin vertical drop roots from canopy branches to the ground. Bark vertex colour red-brown/grey with lighter lenticels noise. `aFlex`: roots 0, trunks 0.1·t, branches 0.25. Canopy: 70–90 leaf cards (1.0–1.6 m quads, random orientation facing mostly outward/up) distributed in an ellipsoid (rx 2.6–3.4, ry 1.6–2.2, centre y 4.2–5.2), denser at the shell; `aFlex` 0.35–0.7 by height in the crown; normals from the ellipsoid centre.
- [ ] **Step 3: Leaf texture.** 512×512 canvas: clusters of 20–30 opposite elliptic leaves on short twigs, glossy dark green (#1f3a14-ish) with a lighter midrib and a specular-looking highlight stripe, some paler undersides visible; transparent background.
- [ ] **Step 4: Visual check** along the river from `ride` and `bank`: the fringe must read as a dark, dense mangrove wall with visible prop-root arches at the waterline and their reflections. Commit (`feat(vegetation): red mangrove`).

---

### Task 9: Casuarina (*Casuarina equisetifolia*, "pino australiano")

**Files:**
- Create: `src/vegetation/species/casuarina.ts` (+ test); add `paintCasuarinaWisps()` to `textures.ts`; `src/vegetation/species/index.ts` (registry)

**Interfaces:**
- Produces: `buildCasuarina(seed): PlantPart[]`, `paintCasuarinaWisps(): HTMLCanvasElement`, `SPECIES: Record<SpeciesId, { build(seed: number): PlantPart[]; paint(): HTMLCanvasElement; bark: { color: THREE.ColorRepresentation; roughness: number }; foliage: { roughness: number; translucency: number } }>`.

Reference morphology: 15–25 m, straight or slightly leaning trunk with rough dark bark; open, irregular conical-to-columnar crown; wispy grey-green drooping "needles" (branchlets) in soft tufts; windswept on the coast.

- [ ] **Step 1: Tests** — parts, `aFlex`, height 13–26 m, triangle count < 4000, deterministic.
- [ ] **Step 2: Generator.** Trunk tube, r 0.28→0.08, slight lean downwind (toward `WIND_DIR`, 0–6°). 16–22 branches between 30% and 95% of height, upward 25–60°, length shrinking with height (conical), each a thin tube; on each branch 5–9 foliage cards (1.4×2.4 m) hanging and drooping from points along the branch, oriented around the branch axis, `aFlex` 0.4–0.9; normals outward from the crown axis.
- [ ] **Step 3: Wisp texture.** 512×1024 canvas: many hair-thin drooping strands in soft tufts (grey-green #4d5b3b to #6b7a54), feathered alpha, sparser at edges.
- [ ] **Step 4: Registry** `species/index.ts` mapping the three species to generator, painter and material settings (palm bark `vertexColors`; mangrove foliage low roughness 0.45 glossy; casuarina foliage roughness 0.85, translucency high).
- [ ] **Step 5: Visual check** on the dunes behind the beach (`mouth` camera): soft, feathery grey-green silhouettes clearly different from palms. Commit (`feat(vegetation): casuarina + species registry`).

---

### Task 10: Integration, performance, phase gate

**Files:**
- Create: `src/vegetation/Vegetation.tsx`
- Modify: `src/scene/World.tsx`, `tests/e2e/phase1.spec.ts` → rename to `tests/e2e/world.spec.ts` (keep the 4 shots, add a `2a` set), `README.md`, delete `src/vegetation/species/testTree.ts`
- Snapshots: `tests/snapshots/phase2a/*.png`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Vegetation component.** `useMemo` on (near fields, era id, quality): `buildVegMasks(geo, near)`, `placeAll(near, masks, densities, 1840)` where densities = `era.vegetation[id].value * q.veg.density`. Far ring: `placeAll(far, farMasks, densities·0.5, 1841)` filtered to instances outside the near extent − 40 m, rendered as cards only. Per species: build 3 variants (`SPECIES[id].build(seed)` for seeds 1..3) once (module-level cache), paint the texture once, create materials once; render `<InstancedSpecies lod0={q.veg.lod0} farCards={q.veg.farCards} castShadow={q.shadowMap > 0} …/>`. Mount in `World.tsx` after `<Terrain/>`.
- [ ] **Step 2: Performance.** Measure fps (vsync off, as in Phase 1) for q=high and q=low with `ride`, `bank`, `aerial`. Target ≥ 60 fps high at DPR 2 on the dev Mac; if under, lower `veg.lod0`/density for high or cap DPR at 1.75 and report. Record placement + bake time at startup (< 1.5 s on high).
- [ ] **Step 3: E2E.** Rename the spec to `world.spec.ts`; keep the four Phase-1 shots (now with vegetation) writing to `tests/snapshots/phase2a/`, plus `1840-bank` and `1975-ride`. All pass with no console errors.
- [ ] **Step 4: Art gate.** Compare the golden-hour `ride` shot with the quality-bar reference (mood: layered silhouettes of vegetation against haze, warm light, reflections of the tree line in calm water). Tune colours, densities, LOD distances, wind strength. Close: the river banks read as a real mangrove-lined tropical river mouth with palms and Casuarinas on the coast.
- [ ] **Step 5: Ship.** README roadmap: mark Phase 2 as "2a done". Commit (`feat(vegetation): integrate species per era; phase 2a gate`), push the branch (never main).

---

## Self-review

- Carry-over items: shadows (T2), grass glow (T3), brown patch (T4), reflection cost (T6 swap), shared RIVER_DIR (T1), leva lazy-load (T1), vegetation masked by water class (T5 rules use `f.water`). Deferred to 2b/6: era time relative to sunset and field caching (Phase 6), inner rings (2b, if vegetation masks need clearings).
- Spec §12 coverage for 2a: code-generated art ✔, placement from fields + exclusions ✔, era densities ✔, LOD0 + cards ✔, reflection cards ✔, wind + depth material ✔, camera-following shadows ✔. 2b: remaining species, cane, polish.
- Names checked: `sunUniforms`, `RIVER_DIR`/`WIND_DIR`, `shadowFocus`, `buildVegMasks`, `placeAll`/`placeSpecies`, `RULES`, `partitionLod`, `makePlantMaterials`, `bakeImpostor`, `reflectionHooks`, `SPECIES`, `PlantPart`, `PlantInstance` are used consistently.
