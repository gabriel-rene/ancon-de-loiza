# Phase 2c — Cane fields, coconut farm blocks, palm age Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add era landscapes (plants only): sugar-cane fields on the OSM grassland in 1840/1900/1925, planted coconut farm blocks behind the beach from 1900, and a palm age per era (young 1900, half grown 1925, full from 1935).

**Architecture:** Cane is a new, separate path: a pure layout (`caneFields.ts`) cuts the grassland polygon into ranked fields on a 10 m cell grid; a pure geometry builder (`caneMesh.ts`) turns the shown cells into one top mesh and one side mesh; `CaneFields.tsx` draws them with the shared wind material. Farm blocks are a pure layout (`plantation.ts`) whose palms are prepended to the coconut set inside `placeAll`, so they use the existing coconut LOD, cards and shadows. Palm age is a new `age` input to `buildPalm`; `Vegetation.tsx` caches coconut geometry per age.

**Tech Stack:** three 0.186, R3F 9, three-custom-shader-material 6, zustand, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-28-phase-2c-landscapes-design.md` · Parent: `docs/superpowers/specs/2026-09-26-ancon-loiza-design.md` §12 · Previous: `docs/superpowers/specs/2026-09-27-phase-2b-vegetation-design.md` · Research: `docs/research/ancon-research.md` §2.4, §5

## Global Constraints

- World frame: 1 unit = 1 m; +X east, +Y up, +Z south. Trade wind toward WSW (`WIND_DIR`).
- Every era value is `Sourced` (`sources` + `confidence`); guesses set `inferred: true`. Source IDs must exist in `src/data/sources.ts`.
- All plant art is generated in code — no downloaded models or textures.
- Layouts are deterministic (same inputs ⇒ same output). Woody placement always runs on the fixed 512 near grid (`placementFields`). The cane layout depends only on `loiza.json` (never on the quality tier).
- The ferry-landing clearings (`Site.clear`), roads, the town core and water stay free of cane and farm blocks.
- Cane: 2 draw calls (top, sides) plus their shadow twins; ≤ 60 000 triangles for all fields together.
- Farm blocks: ≤ 1 500 palms total; drawn only through the existing coconut `InstancedSpecies`.
- Frame time on `high` may rise at most 0.5 ms vs the Task 1 baseline; no tier may drop below its baseline fps by more than that.
- Not in 2c: houses, roads, cart tracks, ground colour changes per era, close-up cane detail.
- Branch `phase-2c-landscapes`; never push to `main`. Merge only after the user approves.
- Commit message bodies end, after a blank line, with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File map

```
docs/superpowers/notes/phase-2c-rulings.md      baseline numbers, rulings, deferred items (new)
tests/snapshots/phase2c-before/                 baseline screenshots (new, frozen)
tests/snapshots/phase2c/                        after screenshots (written by world.spec.ts)
tests/e2e/world.spec.ts                         SNAP_DIR env, phase 2c shots
src/state/url.ts, src/scene/Cameras.tsx         `fields` camera preset (dev view of the cane land)
src/data/eras.ts (+ eras.test.ts)               `landscape: { cane, plantation, palmAge }`
src/vegetation/species/palm.ts (+ test)         buildPalm(seed, age = 1)
src/vegetation/landscape/caneFields.ts (+ test) pure cane layout (new)
src/vegetation/landscape/caneMesh.ts (+ test)   pure cane geometry (new)
src/vegetation/landscape/CaneFields.tsx         cane meshes + materials (new)
src/vegetation/landscape/plantation.ts (+ test) pure farm-block layout (new)
src/vegetation/textures.ts                      paintCaneSide, paintCaneTop
src/vegetation/placement.ts (+ test)            placeAll `planted` option
src/vegetation/placementCache.ts (+ test)       placementKey `extra`
src/vegetation/coverMap.ts (+ test)             optional `skip`
src/vegetation/ground/GroundCover.tsx           optional `skip`
src/vegetation/Vegetation.tsx                   palm age assets, plantation, cane, grass skip
```

---

### Task 1: Branch, dev camera, baseline

**Files:**
- Modify: `src/state/url.ts:5-6`, `src/scene/Cameras.tsx:14-20`, `tests/e2e/world.spec.ts`
- Create: `docs/superpowers/notes/phase-2c-rulings.md`, `tests/snapshots/phase2c-before/*.png`

**Interfaces:**
- Produces: camera preset `'fields'` (URL `?cam=fields`); `SNAP_DIR` env for `world.spec.ts` (default `phase2c`).

- [ ] **Step 1: Branch**

```bash
git checkout -b phase-2c-landscapes
```

- [ ] **Step 2: Add the `fields` camera preset**

The cane land (OSM grassland, x −3415…−579, z −223…3725) is outside every preset view. Add a dev preset that looks at it. It also shows up in the debug panel list (dev only).

`src/state/url.ts`:

```ts
export type CameraPreset = 'ride' | 'bank' | 'aerial' | 'mouth' | 'fields';
export const CAMERA_PRESETS: CameraPreset[] = ['ride', 'bank', 'aerial', 'mouth', 'fields'];
```

`src/scene/Cameras.tsx`, in `CAMERA_POSES` after `mouth`:

```ts
  // Dev view (phase 2c): over the west bank, looking south-west across the grassland (cane land).
  fields: { pos: [-500, 170, 250], target: [-1800, 0, 1500] },
```

- [ ] **Step 3: Check the view**

Run `npm run dev`, open `http://localhost:5173/ancon-de-loiza/?era=1975&cam=fields&t=12&freeze=1&q=medium` in the Browser pane. Expected: open, flat grassland fills the middle of the frame. If it does not, change `pos`/`target` until it does, and write the final numbers in the rulings note.

- [ ] **Step 4: Parametrise the snapshot folder and add the 2c shots**

In `tests/e2e/world.spec.ts`, add below the imports:

```ts
/** Output folder under tests/snapshots (SNAP_DIR=phase2c-before for the baseline run). */
const DIR = `tests/snapshots/${process.env.SNAP_DIR ?? 'phase2c'}`;
```

Replace both `tests/snapshots/phase2b/` paths with `${DIR}/` (template strings). Append to `SHOTS`:

```ts
  // Phase 2c: cane fields, farm blocks, palm age.
  { era: '1900', cam: 'fields', t: 12, c: 95, name: '1900-fields-noon' },
  { era: '1840', cam: 'fields', t: 12, c: 95, name: '1840-fields-noon' },
  { era: '1925', cam: 'fields', t: 12, c: 95, name: '1925-fields-noon' },
  { era: '1975', cam: 'fields', t: 12, c: 95, name: '1975-fields-noon' },
  { era: '1900', cam: 'aerial', t: 12, c: 95, name: '1900-aerial-noon' },
  { era: '1975', cam: 'aerial', t: 12, c: 95, name: '1975-aerial-noon' },
  { era: '1900', cam: 'ride', t: golden('1900'), c: 95 },
  { era: '1925', cam: 'bank', t: 12, c: 70, name: '1925-bank-noon' },
```

- [ ] **Step 5: Baseline screenshots**

```bash
SNAP_DIR=phase2c-before npx playwright test tests/e2e/world.spec.ts
```

Expected: all pass; PNGs in `tests/snapshots/phase2c-before/`.

- [ ] **Step 6: Baseline frame rate**

```bash
npm run build && npm run preview
```

In a second shell, for each query below, run `node scripts/dev/perf.mjs "<query>" 10 2` (high) and record the JSON line:

- `?era=1900&cam=ride&t=17.5&c=95&freeze=1&q=high`
- `?era=1900&cam=fields&t=12&freeze=1&q=high`
- `?era=1975&cam=aerial&t=12&freeze=1&q=high`
- the same three with `q=medium`, and with `q=low` and `dpr` 1

- [ ] **Step 7: Rulings note**

Create `docs/superpowers/notes/phase-2c-rulings.md`:

```markdown
# Phase 2c rulings and notes

Spec: `docs/superpowers/specs/2026-09-28-phase-2c-landscapes-design.md`. Plan: `docs/superpowers/plans/2026-09-28-phase-2c-landscapes.md`.

## Baseline (Task 1)

`fields` camera: pos […], target […].

| query | tier | fps | mean ms | p95 ms |
|---|---|---|---|---|
| (one row per perf run) | | | | |

## Rulings

## Deferred
```

Fill the table with the Step 6 numbers.

- [ ] **Step 8: Run unit tests, commit**

```bash
npm test
git add src/state/url.ts src/scene/Cameras.tsx tests/e2e/world.spec.ts tests/snapshots/phase2c-before docs/superpowers/notes/phase-2c-rulings.md
git commit -m "chore(2c): fields dev camera, 2c shot list, baseline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Era landscape data

**Files:**
- Modify: `src/data/eras.ts`, `src/data/eras.test.ts`

**Interfaces:**
- Produces: `interface Landscape { cane: Sourced<number>; plantation: Sourced<number>; palmAge: Sourced<number> }`, `Era.landscape: Landscape`.
  - `cane` ∈ [0, 1]: share of cane fields shown (by rank).
  - `plantation` ∈ [0, 1]: palm survival in farm blocks; 0 = no farm blocks.
  - `palmAge` ∈ {0, 0.5, 1}: 0 young, 1 full grown (wild and farm palms).

- [ ] **Step 1: Write the failing tests**

In `src/data/eras.test.ts`, add `...(Object.values(e.landscape) as Sourced<unknown>[]),` to `sourcedFields`, and add:

```ts
  test('landscape per era follows spec 2c §2', () => {
    const col = (k: 'cane' | 'plantation' | 'palmAge') => ERAS.map((e) => e.landscape[k].value);
    expect(col('cane')).toEqual([0.6, 1, 0.3, 0, 0, 0, 0, 0]);
    expect(col('plantation')).toEqual([0, 1, 1, 1, 1, 0.85, 0.85, 0.85]);
    expect(col('palmAge')).toEqual([1, 0, 0.5, 1, 1, 1, 1, 1]);
    for (const e of ERAS) for (const v of Object.values(e.landscape)) {
      expect(v.inferred).toBe(true);
      expect(v.value).toBeGreaterThanOrEqual(0); expect(v.value).toBeLessThanOrEqual(1);
    }
    expect(getEra('1900').landscape.cane.confidence).toBe('M');
    expect(getEra('1900').landscape.cane.sources).toContain('S1');
    expect(getEra('1900').landscape.plantation.sources).toContain('S23');
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/data/eras.test.ts`
Expected: FAIL (`landscape` undefined / type error).

- [ ] **Step 3: Implement**

In `src/data/eras.ts`, after `AnconEra`:

```ts
/** Era landscape (phase 2c, plants only). All values inferred; see spec 2c §2. */
export interface Landscape {
  /** Share (0..1) of the grassland cane fields shown, lowest rank first. */
  cane: Sourced<number>;
  /** Palm survival (0..1) in the coconut farm blocks; 0 = no farm blocks. */
  plantation: Sourced<number>;
  /** Palm age: 0 young (3–6 m), 0.5 half grown, 1 full grown. Wild and farm palms. */
  palmAge: Sourced<number>;
}
```

Add `landscape: Landscape;` to `Era` after `vegetation`. After the `VEG` table:

```ts
// Cane on the Iturregui estates, whose cane land reached Carolina; the ancón carried their cane
// workers, late 1800s – early 1900s (S1, research §2.4, §5). The coast then shifted from sugar to
// coconut (S23). Shares, block survival and palm ages are all inferred.
const cane = (v: number, c: Confidence = 'L') => s(v, v > 0 ? ['S1'] : ['S1', 'S23'], c, true);
const farm = (v: number) => s(v, ['S23'], 'L', true);
const age = (v: number) => s(v, ['S23'], 'L', true);
const LAND = {
  '1840': { cane: cane(0.6), plantation: farm(0), palmAge: age(1) },
  '1900': { cane: cane(1, 'M'), plantation: farm(1), palmAge: age(0) },
  '1925': { cane: cane(0.3), plantation: farm(1), palmAge: age(0.5) },
  '1935': { cane: cane(0), plantation: farm(1), palmAge: age(1) },
  '1959': { cane: cane(0), plantation: farm(1), palmAge: age(1) },
  '1975': { cane: cane(0), plantation: farm(0.85), palmAge: age(1) },
  '1984': { cane: cane(0), plantation: farm(0.85), palmAge: age(1) },
  '1986': { cane: cane(0), plantation: farm(0.85), palmAge: age(1) },
} satisfies Record<EraId, Landscape>;
```

Add `landscape: LAND['<id>'],` to each of the eight `ERAS` entries, after `vegetation`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/data/eras.test.ts && npx tsc -p tsconfig.json --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/data/eras.ts src/data/eras.test.ts
git commit -m "feat(eras): landscape values for cane, farm blocks, palm age

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Palm age

**Files:**
- Modify: `src/vegetation/species/palm.ts:199-237`, `src/vegetation/species/palm.test.ts`, `src/vegetation/Vegetation.tsx:28-38,145-150`

**Interfaces:**
- Consumes: `Era.landscape.palmAge` (Task 2).
- Produces: `buildPalm(seed: number, age = 1): PlantPart[]`. `age = 1` must give exactly today's geometry (same rng order).

- [ ] **Step 1: Write the failing tests**

Append to `src/vegetation/species/palm.test.ts`:

```ts
const top = (parts: ReturnType<typeof buildPalm>) => {
  const box = new THREE.Box3();
  for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox!); }
  return box.max.y;
};
test('age 1 is the default and unchanged', () => {
  for (const seed of [1, 2, 3]) {
    const a = buildPalm(seed), b = buildPalm(seed, 1);
    for (let i = 0; i < a.length; i++)
      expect(b[i].geometry.getAttribute('position').array).toEqual(a[i].geometry.getAttribute('position').array);
  }
});
test('young palms stay under 6 m; half-grown palms sit between young and full', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const y0 = top(buildPalm(seed, 0)), y5 = top(buildPalm(seed, 0.5)), y1 = top(buildPalm(seed, 1));
    expect(y0).toBeLessThan(6); expect(y0).toBeGreaterThan(2.5);
    expect(y5).toBeGreaterThan(y0); expect(y5).toBeLessThan(y1);
  }
});
test('young palms have no nuts and stay within the triangle budget', () => {
  for (const age of [0, 0.5]) {
    const parts = buildPalm(2, age);
    expect(parts.reduce((n, p) => n + tris(p.geometry), 0)).toBeLessThan(4000);
    for (const p of parts) for (const v of p.geometry.getAttribute('position').array as Float32Array) expect(Number.isFinite(v)).toBe(true);
  }
  const bark = (age: number) => tris(buildPalm(2, age)[0].geometry);
  expect(bark(0)).toBeLessThan(bark(1)); // nuts dropped
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/vegetation/species/palm.test.ts`
Expected: FAIL on the young-palm height test (age is ignored).

- [ ] **Step 3: Implement**

In `buildPalm`, keep every existing `rng()` call in the same order (so `age = 1` is unchanged); derive the young values from a second stream:

```ts
/**
 * Build one coconut palm (base at the origin, trunk along +Y). Deterministic in `seed`.
 * `age` (0 young … 1 full grown, phase 2c): a young palm has a short trunk (0.8–1.5 m), no nuts
 * and fronds at 75 % length rising from near the ground — not a scaled-down old palm.
 * Parts: `bark` (trunk + nuts, vertex colours) and `foliage` (merged fronds, mapped with
 * `paintFrond()`).
 */
export function buildPalm(seed: number, age = 1): PlantPart[] {
  const rng = cellRng(seed, 0, 911), young = cellRng(seed, 1, 911);
  const Hfull = 12 + 7 * rng();
  const H = age >= 1 ? Hfull : lerp(0.8 + 0.7 * young(), Hfull, age * age);
  const lean = 12 * DEG * rng() * Math.min(1, age * 1.5);
```

Replace the rest of the body's uses of the old `H` accordingly (the spine uses `H`). After `const nuts = buildNuts(rng, top);` keep the call (it advances `rng`) but drop them when young:

```ts
  const nuts = buildNuts(rng, top);
  const keptNuts = age >= 0.5 ? nuts : [];
  if (!keptNuts.length) nuts.forEach((g) => g.dispose());
```

Pass a frond length factor into `buildFrond`: add a last parameter `lenMul = 1` and multiply `L` by it (`const L = (4 + 1.8 * rng()) * lerp(0.5, 1, smooth(0, 0.25, age)) * lenMul;` — note: that `age` is the frond's age, not the palm's). Call it with `lerp(0.75, 1, age)`:

```ts
    fronds.push(buildFrond(rng, base, a, f / (FRONDS - 1), top, lerp(0.75, 1, age)));
```

(rename the loop's local `age` to `fa` to avoid shadowing the palm `age`.) Merge with `keptNuts` instead of `nuts`:

```ts
  const bark = mergeGeometries([trunk, ...keptNuts])!;
  const foliage = mergeGeometries(fronds)!;
  [trunk, ...keptNuts, ...fronds].forEach((g) => g.dispose());
```

If the young-height test still fails (fronds rise above 6 m), lower the young frond factor (0.75 → 0.7) and record it in the rulings note.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/vegetation/species/palm.test.ts`
Expected: PASS (all six tests).

- [ ] **Step 5: Cache coconut geometry per age in `Vegetation.tsx`**

Replace the assets cache:

```ts
interface SpeciesAssets { variants: PlantPart[][]; materials: PlantMaterials }
/** Painted foliage texture and materials per species: built once, kept for the app's life. */
const materials = new Map<WoodyId, PlantMaterials>();
/** Geometry (3 variants) per species and palm age (only coconut depends on age): built once. */
const geometry = new Map<string, PlantPart[][]>();
function speciesAssets(id: WoodyId, palmAge: number): SpeciesAssets {
  let m = materials.get(id);
  if (!m) { m = makeSpeciesMaterials(id).materials; materials.set(id, m); }
  const age = id === 'coconut' ? Math.round(palmAge * 2) / 2 : 1, key = `${id}|${age}`;
  let v = geometry.get(key);
  if (!v) {
    v = [1, 2, 3].map((s) => (id === 'coconut' ? buildPalm(s, age) : SPECIES[id].build(s)));
    geometry.set(key, v);
  }
  return { variants: v, materials: m };
}
```

Import `buildPalm` from `./species/palm`. In the render, call `speciesAssets(id, era.landscape.palmAge.value)`. Because `variants` is a new array for a new age, `InstancedSpecies` re-bakes the coconut impostors on its own (its bake effect depends on `variants`).

- [ ] **Step 6: Check on screen**

`npm run dev`, open `?era=1900&cam=bank&t=12&freeze=1&q=medium`, then `era=1925`, then `era=1935`. Expected: short palms with fronds near the ground in 1900, mid-height in 1925, tall in 1935; far cards match the near meshes in each era. No console errors.

- [ ] **Step 7: Full tests, type check, commit**

```bash
npm test && npx tsc -p tsconfig.json --noEmit
git add src/vegetation/species/palm.ts src/vegetation/species/palm.test.ts src/vegetation/Vegetation.tsx
git commit -m "feat(vegetation): palm age per era (young 1900, half 1925)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Cane field layout (pure)

**Files:**
- Create: `src/vegetation/landscape/caneFields.ts`, `src/vegetation/landscape/caneFields.test.ts`

**Interfaces:**
- Consumes: `GeoBundle` (`land` rings of kind `grassland`, `water` rings, `roads`), `fillPolygon`, `drawPolyline`, `Grid` (`src/terrain/raster.ts`), `hash3` (`src/vegetation/rng.ts`).
- Produces:

```ts
export const CANE_CELL = 10;
export interface CaneField { rank: number; height: number; cells: number }
export interface CaneLayout {
  grid: Grid;
  /** Per cell: index into `fields`, or −1 (not cane: outside the grassland, water, road, lane or a dropped scrap). */
  field: Int32Array;
  fields: CaneField[];
}
export function caneLayout(geo: GeoBundle): CaneLayout;
/** 1 where the cell belongs to a field with rank < share. */
export function shownMask(layout: CaneLayout, share: number): Uint8Array;
/** True when (x, z) lies in a shown cell. */
export function inCane(layout: CaneLayout, shown: Uint8Array): (x: number, z: number) => boolean;
```

- [ ] **Step 1: Write the failing tests**

`src/vegetation/landscape/caneFields.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import geo from '../../data/geo/loiza.json';
import type { GeoBundle, XZ } from '../../data/geo/types';
import { CANE_CELL, caneLayout, inCane, shownMask } from './caneFields';

const G = geo as unknown as GeoBundle;
const pip = (r: XZ[], x: number, z: number) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i], [xj, zj] = r[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};
const L = caneLayout(G);
const centre = (k: number) => {
  const g = L.grid, i = k % g.size, j = Math.floor(k / g.size);
  return [g.minX + (i + 0.5) * g.cell, g.minZ + (j + 0.5) * g.cell] as const;
};

describe('caneLayout', () => {
  test('uses 10 m cells and is deterministic', () => {
    expect(L.grid.cell).toBe(CANE_CELL);
    expect(caneLayout(G).field).toEqual(L.field);
  });
  test('field count is plausible for ~3.2 km² of grassland at ~220 m pitch', () => {
    expect(L.fields.length).toBeGreaterThanOrEqual(30);
    expect(L.fields.length).toBeLessThanOrEqual(120);
    for (const f of L.fields) {
      expect(f.cells).toBeGreaterThanOrEqual(20);
      expect(f.rank).toBeGreaterThanOrEqual(0); expect(f.rank).toBeLessThan(1);
      expect(f.height).toBeGreaterThanOrEqual(2.5); expect(f.height).toBeLessThanOrEqual(3.5);
    }
  });
  test('every cane cell is inside the grassland and outside water', () => {
    const grass = G.land.filter((l) => l.kind === 'grassland').map((l) => l.ring);
    for (let k = 0; k < L.field.length; k += 7) if (L.field[k] >= 0) {
      const [x, z] = centre(k);
      expect(grass.some((r) => pip(r, x, z)), `${x},${z}`).toBe(true);
      expect(G.water.some((w) => pip(w.ring, x, z)), `${x},${z}`).toBe(false);
    }
  });
  test('lanes: no two 4-neighbour cells belong to different fields', () => {
    const n = L.grid.size;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = L.field[j * n + i];
      if (a < 0) continue;
      if (i + 1 < n) { const b = L.field[j * n + i + 1]; if (b >= 0) expect(b).toBe(a); }
      if (j + 1 < n) { const b = L.field[(j + 1) * n + i]; if (b >= 0) expect(b).toBe(a); }
    }
  });
});

describe('shownMask / inCane', () => {
  const m0 = shownMask(L, 0), m3 = shownMask(L, 0.3), m6 = shownMask(L, 0.6), m1 = shownMask(L, 1);
  test('era shares nest: 0 ⊆ 0.3 ⊆ 0.6 ⊆ 1', () => {
    for (let k = 0; k < m1.length; k++) {
      expect(m0[k]).toBe(0);
      if (m3[k]) expect(m6[k]).toBe(1);
      if (m6[k]) expect(m1[k]).toBe(1);
      expect(m1[k]).toBe(L.field[k] >= 0 ? 1 : 0);
    }
  });
  test('share ≈ fraction of fields shown', () => {
    const f = L.fields.filter((x) => x.rank < 0.6).length / L.fields.length;
    expect(f).toBeGreaterThan(0.4); expect(f).toBeLessThan(0.8);
  });
  test('inCane matches the mask', () => {
    const hit = inCane(L, m1);
    let k = L.field.findIndex((v) => v >= 0);
    expect(hit(...centre(k))).toBe(true);
    k = L.field.findIndex((v) => v < 0);
    expect(hit(...centre(k))).toBe(false);
    expect(hit(1e6, 1e6)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/vegetation/landscape/caneFields.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/vegetation/landscape/caneFields.ts`:

```ts
import type { GeoBundle } from '../../data/geo/types';
import { drawPolyline, fillPolygon, type Grid } from '../../terrain/raster';
import { hash3 } from '../rng';

/*
 * Sugar-cane fields (phase 2c, spec §2–§3). The OSM grassland — open, inland, on the Torrecilla /
 * Carolina side, where the Iturregui cane land lay [S1] — is cut by a jittered grid of field
 * boundaries (~220 m pitch, ±50 m) into fields on a 10 m cell grid. Cells on a boundary line are
 * cart lanes. Water, roads (+1 cell) and scraps under 20 cells are dropped. Each field has a fixed
 * random rank; an era shows the fields whose rank < its cane share, so the era sets nest and no
 * field moves between eras. Depends only on the geo bundle, never on the quality tier.
 */

export const CANE_CELL = 10;
const PITCH = 220, JITTER = 50, MIN_CELLS = 20, SEED = 1900;
const u01 = (i: number, j: number, s: number) => hash3(i, j, s) / 4294967296;

export interface CaneField { rank: number; height: number; cells: number }
export interface CaneLayout { grid: Grid; field: Int32Array; fields: CaneField[] }

export function caneLayout(geo: GeoBundle): CaneLayout {
  const rings = geo.land.filter((l) => l.kind === 'grassland').map((l) => l.ring);
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const r of rings) for (const [x, z] of r) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  const size = Math.ceil((Math.max(x1 - x0, z1 - z0) + 40) / CANE_CELL);
  const grid: Grid = { size, cell: CANE_CELL, minX: x0 - 20, minZ: z0 - 20 };
  const N = size * size;

  const ok = new Uint8Array(N);
  for (const r of rings) fillPolygon(grid, ok, r, 1);
  for (const w of geo.water) fillPolygon(grid, ok, w.ring, 0);
  const road = new Uint8Array(N);
  for (const r of geo.roads) if (!r.bridge) drawPolyline(grid, road, r.points, 1);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    if (!road[j * size + i]) continue;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = i + di, b = j + dj;
      if (a >= 0 && b >= 0 && a < size && b < size) ok[b * size + a] = 0;
    }
  }

  // Jittered boundary lines, shared by neighbouring fields so fields tile.
  const ext = size * CANE_CELL, K = Math.ceil(ext / PITCH) + 1;
  const lines = (axis: number, min: number) => Array.from({ length: K + 1 }, (_, k) => min + k * PITCH + (2 * u01(k, axis, SEED) - 1) * JITTER);
  const xs = lines(0, grid.minX), zs = lines(1, grid.minZ);
  const band = (ls: number[], v: number) => { let k = 0; while (k + 1 < ls.length && ls[k + 1] <= v) k++; return k; };
  const onLine = (ls: number[], v: number, k: number) => Math.abs(v - ls[k]) < CANE_CELL / 2 || (k + 1 < ls.length && Math.abs(ls[k + 1] - v) < CANE_CELL / 2);

  const field = new Int32Array(N).fill(-1);
  const index = new Map<number, number>(), fields: CaneField[] = [];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const k = j * size + i;
    if (!ok[k]) continue;
    const x = grid.minX + (i + 0.5) * CANE_CELL, z = grid.minZ + (j + 0.5) * CANE_CELL;
    const c = band(xs, x), r = band(zs, z);
    if (onLine(xs, x, c) || onLine(zs, z, r)) continue;
    const key = c * 4096 + r;
    let f = index.get(key);
    if (f === undefined) {
      f = fields.length; index.set(key, f);
      fields.push({ rank: u01(c, r, SEED + 1), height: 2.5 + u01(c, r, SEED + 2), cells: 0 });
    }
    field[k] = f; fields[f].cells++;
  }

  // Drop scraps and re-index the survivors.
  const remap = fields.map(() => -1), kept: CaneField[] = [];
  fields.forEach((f, i) => { if (f.cells >= MIN_CELLS) { remap[i] = kept.length; kept.push(f); } });
  for (let k = 0; k < N; k++) if (field[k] >= 0) field[k] = remap[field[k]];
  return { grid, field, fields: kept };
}

export function shownMask(layout: CaneLayout, share: number): Uint8Array {
  const out = new Uint8Array(layout.field.length);
  for (let k = 0; k < out.length; k++) {
    const f = layout.field[k];
    if (f >= 0 && layout.fields[f].rank < share) out[k] = 1;
  }
  return out;
}

export function inCane(layout: CaneLayout, shown: Uint8Array) {
  const { size, cell, minX, minZ } = layout.grid;
  return (x: number, z: number) => {
    const i = Math.floor((x - minX) / cell), j = Math.floor((z - minZ) / cell);
    return i >= 0 && j >= 0 && i < size && j < size && shown[j * size + i] === 1;
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/vegetation/landscape/caneFields.test.ts`
Expected: PASS. If the field count falls outside 30–120, report the number to the controller before changing `PITCH` (it is a spec value).

- [ ] **Step 5: Commit**

```bash
git add src/vegetation/landscape/caneFields.ts src/vegetation/landscape/caneFields.test.ts
git commit -m "feat(landscape): cane field layout on the grassland

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Cane geometry (pure)

**Files:**
- Create: `src/vegetation/landscape/caneMesh.ts`, `src/vegetation/landscape/caneMesh.test.ts`
- Modify: `docs/superpowers/specs/2026-09-28-phase-2c-landscapes-design.md` §4 (draw calls)

**Interfaces:**
- Consumes: `CaneLayout`, `shownMask`, `caneLayout` (Task 4).
- Produces:

```ts
/** Leaf tips on the side texture reach this far (m) above the flat top. */
export const CANE_FRINGE = 0.6;
/** Side walls start this far (m) below the ground (hides seams on slopes). */
export const CANE_SINK = 0.3;
/** Texture tile sizes (m): top repeats every CANE_TOP_TILE; side is CANE_SIDE_TILE wide. */
export const CANE_TOP_TILE = 4, CANE_SIDE_TILE = 2.5;
export function buildCaneGeometry(layout: CaneLayout, shown: Uint8Array, heightAt: (x: number, z: number) => number):
  { top: THREE.BufferGeometry; sides: THREE.BufferGeometry };
```

Both geometries carry `position`, `normal`, `uv`, `aFlex` (top 0.35 everywhere; sides 0 at the bottom, 0.5 at the top) and an index.

- [ ] **Step 1: Write the failing tests**

`src/vegetation/landscape/caneMesh.test.ts`:

```ts
import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import geo from '../../data/geo/loiza.json';
import type { GeoBundle } from '../../data/geo/types';
import { caneLayout, shownMask, type CaneLayout } from './caneFields';
import { buildCaneGeometry, CANE_FRINGE, CANE_SINK } from './caneMesh';

const tris = (g: THREE.BufferGeometry) => g.index!.count / 3;
/** 4×4 cells of 10 m at the origin; one 2×2 field in the middle (cells (1,1)–(2,2)). */
function tiny(): CaneLayout {
  const field = new Int32Array(16).fill(-1);
  for (const [i, j] of [[1, 1], [2, 1], [1, 2], [2, 2]]) field[j * 4 + i] = 0;
  return { grid: { size: 4, cell: 10, minX: 0, minZ: 0 }, field, fields: [{ rank: 0.1, height: 3, cells: 4 }] };
}

describe('buildCaneGeometry', () => {
  const L = tiny(), ground = (x: number) => 0.01 * x;
  const { top, sides } = buildCaneGeometry(L, shownMask(L, 1), ground);
  test('top: one merged quad per row run; y = ground + field height', () => {
    expect(tris(top)).toBe(4);
    const p = top.getAttribute('position');
    for (let i = 0; i < p.count; i++) expect(p.getY(i)).toBeCloseTo(ground(p.getX(i)) + 3, 5);
  });
  test('sides: one quad per straight boundary run, from below ground to above the top', () => {
    expect(tris(sides)).toBe(8);
    const p = sides.getAttribute('position');
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < p.count; i++) { lo = Math.min(lo, p.getY(i) - ground(p.getX(i))); hi = Math.max(hi, p.getY(i) - ground(p.getX(i))); }
    expect(lo).toBeCloseTo(-CANE_SINK, 5); expect(hi).toBeCloseTo(3 + CANE_FRINGE, 5);
  });
  test('side normals point out of the field', () => {
    const p = sides.getAttribute('position'), n = sides.getAttribute('normal');
    for (let i = 0; i < p.count; i++) expect((p.getX(i) - 20) * n.getX(i) + (p.getZ(i) - 20) * n.getZ(i)).toBeGreaterThan(0);
  });
  test('aFlex: top 0.35, sides 0 → 0.5', () => {
    expect([...(top.getAttribute('aFlex').array as Float32Array)].every((v) => v === 0.35)).toBe(true);
    const f = sides.getAttribute('aFlex').array as Float32Array;
    expect(Math.min(...f)).toBe(0); expect(Math.max(...f)).toBe(0.5);
  });
  test('nothing shown ⇒ empty geometry', () => {
    const e = buildCaneGeometry(L, shownMask(L, 0), ground);
    expect(tris(e.top)).toBe(0); expect(tris(e.sides)).toBe(0);
  });
  test('real layout, all fields shown: within the 60 000-triangle budget', () => {
    const R = caneLayout(geo as unknown as GeoBundle);
    const g = buildCaneGeometry(R, shownMask(R, 1), () => 1);
    expect(tris(g.top) + tris(g.sides)).toBeLessThanOrEqual(60_000);
    expect(tris(g.top)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/vegetation/landscape/caneMesh.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/vegetation/landscape/caneMesh.ts`:

```ts
import * as THREE from 'three';
import type { CaneLayout } from './caneFields';

export const CANE_FRINGE = 0.6;
export const CANE_SINK = 0.3;
export const CANE_TOP_TILE = 4, CANE_SIDE_TILE = 2.5;

/**
 * Cane blocks for the shown cells of `layout` (spec 2c §3). Top: per grid row, each run of
 * consecutive cells of one field becomes one quad at ground + field height (the four corners
 * follow `heightAt`). Sides: each straight run of boundary edges (a shown cell next to a cell that
 * is not the same shown field) becomes one wall from CANE_SINK below the ground to CANE_FRINGE
 * above the top, facing out; the side texture's alpha-cut leaf tips make that top edge ragged.
 */
export function buildCaneGeometry(layout: CaneLayout, shown: Uint8Array, heightAt: (x: number, z: number) => number) {
  const { size: n, cell: c, minX, minZ } = layout.grid;
  const id = (i: number, j: number) => (i < 0 || j < 0 || i >= n || j >= n || !shown[j * n + i] ? -1 : layout.field[j * n + i]);
  const hOf = (f: number) => layout.fields[f].height;

  const tp: number[] = [], tn: number[] = [], tu: number[] = [], tf: number[] = [], ti: number[] = [];
  for (let j = 0; j < n; j++) {
    let i = 0;
    while (i < n) {
      const f = id(i, j);
      if (f < 0) { i++; continue; }
      let e = i + 1;
      while (e < n && id(e, j) === f) e++;
      const xa = minX + i * c, xb = minX + e * c, za = minZ + j * c, zb = za + c, h = hOf(f), b = tp.length / 3;
      for (const [x, z] of [[xa, za], [xb, za], [xa, zb], [xb, zb]]) {
        tp.push(x, heightAt(x, z) + h, z); tn.push(0, 1, 0); tu.push(x / CANE_TOP_TILE, z / CANE_TOP_TILE); tf.push(0.35);
      }
      ti.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      i = e;
    }
  }

  const sp: number[] = [], sn: number[] = [], su: number[] = [], sf: number[] = [], si: number[] = [];
  /** One wall from (xa, za) to (xb, zb) with outward normal (nx, nz), for field height h. */
  const wall = (xa: number, za: number, xb: number, zb: number, nx: number, nz: number, h: number) => {
    const len = Math.hypot(xb - xa, zb - za), b = sp.length / 3;
    for (const [x, z, u] of [[xa, za, 0], [xb, zb, len / CANE_SIDE_TILE]] as const) {
      const g = heightAt(x, z);
      sp.push(x, g - CANE_SINK, z, x, g + h + CANE_FRINGE, z);
      sn.push(nx, 0, nz, nx, 0, nz); su.push(u, 0, u, 1); sf.push(0, 0.5);
    }
    // Wind so that the front face (normal side) is counter-clockwise.
    if (nx * (zb - za) - nz * (xb - xa) > 0) si.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    else si.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  };
  // Edges along x (north/south faces), merged per row.
  for (const [dj, nz] of [[-1, -1], [1, 1]] as const) for (let j = 0; j < n; j++) {
    const z = minZ + (dj < 0 ? j : j + 1) * c;
    let i = 0;
    while (i < n) {
      const f = id(i, j);
      if (f < 0 || id(i, j + dj) === f) { i++; continue; }
      let e = i + 1;
      while (e < n && id(e, j) === f && id(e, j + dj) !== f) e++;
      wall(minX + i * c, z, minX + e * c, z, 0, nz, hOf(f));
      i = e;
    }
  }
  // Edges along z (west/east faces), merged per column.
  for (const [di, nx] of [[-1, -1], [1, 1]] as const) for (let i = 0; i < n; i++) {
    const x = minX + (di < 0 ? i : i + 1) * c;
    let j = 0;
    while (j < n) {
      const f = id(i, j);
      if (f < 0 || id(i + di, j) === f) { j++; continue; }
      let e = j + 1;
      while (e < n && id(i, e) === f && id(i + di, e) !== f) e++;
      wall(x, minZ + j * c, x, minZ + e * c, nx, 0, hOf(f));
      j = e;
    }
  }

  const make = (p: number[], nn: number[], u: number[], f: number[], idx: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    g.setAttribute('aFlex', new THREE.Float32BufferAttribute(f, 1));
    g.setIndex(idx);
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  };
  return { top: make(tp, tn, tu, tf, ti), sides: make(sp, sn, su, sf, si) };
}
```

The quad winding `b, b+2, b+1` faces +Y for corners ordered (xa,za),(xb,za),(xa,zb),(xb,zb) with +Z south; if the top-face test in Task 6's visual check shows it back-facing, it does not matter (foliage material is double-sided), but keep normals +Y.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/vegetation/landscape/caneMesh.test.ts`
Expected: PASS. Record the real-layout triangle count in the rulings note.

- [ ] **Step 5: Spec fix — draw calls**

Top and sides need different tiling textures, so cane is 2 draw calls. In the spec §4 replace "Cane: 1 draw call plus its shadow; ≤ 60 000 triangles for all fields." with "Cane: 2 draw calls (top, sides) plus their shadows; ≤ 60 000 triangles for all fields."

- [ ] **Step 6: Commit**

```bash
git add src/vegetation/landscape/caneMesh.ts src/vegetation/landscape/caneMesh.test.ts docs/superpowers/specs/2026-09-28-phase-2c-landscapes-design.md
git commit -m "feat(landscape): cane block geometry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Cane on screen — textures, component, grass kept off

**Files:**
- Create: `src/vegetation/landscape/CaneFields.tsx`
- Modify: `src/vegetation/textures.ts` (append painters), `src/vegetation/coverMap.ts`, `src/vegetation/coverMap.test.ts`, `src/vegetation/ground/GroundCover.tsx:46-73`, `src/vegetation/Vegetation.tsx`

**Interfaces:**
- Consumes: `caneLayout`, `shownMask`, `inCane` (Task 4); `buildCaneGeometry`, `CANE_TOP_TILE`, `CANE_SIDE_TILE`, `CANE_FRINGE` (Task 5); `Era.landscape.cane` (Task 2); `makePlantMaterials`, `foliageTexture`.
- Produces:
  - `paintCaneSide(): HTMLCanvasElement` (256 × 512; bottom = stalk base, top 0.6/(h+0.9) of the height = alpha-cut leaf tips), `paintCaneTop(): HTMLCanvasElement` (256 × 256, opaque).
  - `<CaneFields layout shown near far castShadow />`.
  - `coverMap(f, m, dens, size = 256, skip?: (x: number, z: number) => boolean)`.
  - `GroundCover` prop `skip?: (x: number, z: number) => boolean`.

- [ ] **Step 1: Failing test for the cover-map skip**

Append to `src/vegetation/coverMap.test.ts` (reuse the file's existing fields/masks setup; if it builds them under other names, use those):

```ts
test('skip zeroes the cover weights where it returns true', () => {
  const dens = { grass: 1, reeds: 1, morningGlory: 1 };
  const a = coverMap(f, m, dens, 64), b = coverMap(f, m, dens, 64, () => true);
  expect(a.some((v, i) => i % 4 !== 3 && v > 0)).toBe(true);
  expect(b.every((v, i) => (i % 4 === 3 ? v === 255 : v === 0))).toBe(true);
});
```

Run: `npx vitest run src/vegetation/coverMap.test.ts` — Expected: FAIL (the fifth argument is ignored).

- [ ] **Step 2: Implement the skip in `coverMap` and `GroundCover`**

`coverMap.ts`: add the parameter and doc line, and skip after `out[k + 3] = 255;`:

```ts
 * `skip(x, z)` true (e.g. under cane): no cover there.
 */
export function coverMap(f: WorldFields, m: VegMasks, dens: Record<GroundId, number>, size = 256,
  skip?: (x: number, z: number) => boolean): Uint8Array {
```

```ts
    out[k + 3] = 255;
    if (!s || skip?.(x, z)) continue;
```

Run the test again — Expected: PASS.

`GroundCover.tsx`: add `skip?: (x: number, z: number) => boolean` to the props (destructure it), pass `skip` in the `placeSpecies` options object, and add `skip` to the tile-cache `useMemo` dependency list.

- [ ] **Step 3: Cane painters**

Append to `src/vegetation/textures.ts` (follow the style of `paintReedStems`; all numbers are art values, tune on screen):

```ts
/**
 * Cane field side (phase 2c): 256 × 512, u across 2.5 m, v up the wall. Dense vertical stalks
 * (green-yellow, darker nodes every ~0.25 of the height) under a mass of long arching leaf blades;
 * the top ~15 % is transparent between blade tips so the wall's upper edge reads ragged.
 */
export function paintCaneSide(): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512;
  const g = cv.getContext('2d')!, rng = cellRng(7, 3, 1900);
  // Deep shade inside the stand.
  const bg = g.createLinearGradient(0, 512, 0, 70);
  bg.addColorStop(0, '#2b3317'); bg.addColorStop(1, '#4d6a23');
  g.fillStyle = bg; g.fillRect(0, 70, 256, 442);
  // Stalks.
  for (let k = 0; k < 70; k++) {
    const x = rng() * 256, w = 2 + rng() * 2.5;
    g.fillStyle = `hsl(${62 + rng() * 18}, ${35 + rng() * 20}%, ${28 + rng() * 14}%)`;
    g.fillRect(x, 120 + rng() * 60, w, 400);
    g.fillStyle = 'rgba(40,30,15,0.5)';
    for (let y = 160 + rng() * 40; y < 512; y += 100 + rng() * 40) g.fillRect(x - 0.5, y, w + 1, 3);
  }
  // Leaf blades: long, arching, pale undersides catching light; tips reach into the top band.
  for (let k = 0; k < 260; k++) {
    const x = rng() * 256, y = 20 + rng() * 300, len = 60 + rng() * 120, dir = rng() < 0.5 ? -1 : 1;
    g.strokeStyle = `hsl(${78 + rng() * 22}, ${40 + rng() * 25}%, ${30 + rng() * 25}%)`;
    g.lineWidth = 2 + rng() * 3;
    g.beginPath(); g.moveTo(x, y + len * 0.6);
    g.quadraticCurveTo(x + dir * len * 0.3, y - len * 0.2, x + dir * len * 0.6, y + len * 0.1 * rng());
    g.stroke();
  }
  return cv;
}

/** Cane field top (phase 2c): 256 × 256, opaque, tiles every 4 m. Criss-cross leaf blades seen from above. */
export function paintCaneTop(): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const g = cv.getContext('2d')!, rng = cellRng(7, 4, 1900);
  g.fillStyle = '#3f5a1d'; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 420; k++) {
    const x = rng() * 256, y = rng() * 256, a = rng() * Math.PI * 2, len = 30 + rng() * 60;
    g.strokeStyle = `hsl(${76 + rng() * 24}, ${38 + rng() * 25}%, ${26 + rng() * 28}%)`;
    g.lineWidth = 1.5 + rng() * 2.5;
    // Draw each blade at its tile-wrapped copies so the texture tiles seamlessly.
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
      g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); g.stroke();
    }
  }
  return cv;
}
```

If `cellRng` is not yet imported in `textures.ts`, import it from `./rng`.

- [ ] **Step 4: `CaneFields.tsx`**

```tsx
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { sampleField, type WorldFields } from '../../terrain/fields';
import { foliageTexture, paintCaneSide, paintCaneTop } from '../textures';
import { makePlantMaterials } from '../windMaterial';
import type { CaneLayout } from './caneFields';
import { buildCaneGeometry } from './caneMesh';

type Mats = { top: { material: THREE.Material; depth: THREE.Material }; sides: { material: THREE.Material; depth: THREE.Material } };
let mats: Mats | null = null;
/** Painted textures and wind materials: built once, kept for the app's life (like the species materials). */
function caneMaterials(): Mats {
  if (mats) return mats;
  const top = foliageTexture(paintCaneTop(), 0.5, 'caneTop'), side = foliageTexture(paintCaneSide(), 0.5, 'caneSide');
  top.wrapS = top.wrapT = THREE.RepeatWrapping;
  side.wrapS = THREE.RepeatWrapping; side.wrapT = THREE.ClampToEdgeWrapping;
  mats = {
    top: makePlantMaterials({ part: 'foliage', map: top, color: 0xffffff, roughness: 0.85, translucency: 1.2, alphaTest: 0.5, tint: { value: 0.08, hue: 0.08 } }),
    sides: makePlantMaterials({ part: 'foliage', map: side, color: 0xffffff, roughness: 0.85, translucency: 1.2, alphaTest: 0.5 }),
  };
  return mats;
}

/**
 * Sugar-cane fields (phase 2c): the shown cells of `layout` as two meshes (top, sides) standing on
 * the rendered terrain (`near` inside its extent, `far` beyond). Swayed by the shared wind.
 */
export function CaneFields({ layout, shown, near, far, castShadow }: {
  layout: CaneLayout; shown: Uint8Array; near: WorldFields; far: WorldFields; castShadow: boolean;
}) {
  const geo = useMemo(() => {
    const g = near.grid, x1 = g.minX + g.cell * g.size, z1 = g.minZ + g.cell * g.size;
    const heightAt = (x: number, z: number) =>
      x > g.minX && x < x1 && z > g.minZ && z < z1 ? sampleField(near, near.height, x, z) : sampleField(far, far.height, x, z);
    return buildCaneGeometry(layout, shown, heightAt);
  }, [layout, shown, near, far]);
  useEffect(() => () => { geo.top.dispose(); geo.sides.dispose(); }, [geo]);
  const m = caneMaterials();
  if (!geo.top.index!.count) return null;
  return <>
    <mesh name="cane-top" geometry={geo.top} material={m.top.material} customDepthMaterial={m.top.depth} castShadow={castShadow} receiveShadow />
    <mesh name="cane-sides" geometry={geo.sides} material={m.sides.material} customDepthMaterial={m.sides.depth} castShadow={castShadow} receiveShadow />
  </>;
}
```

- [ ] **Step 5: Mount it in `Vegetation.tsx` and keep grass off**

Add imports:

```ts
import { caneLayout, inCane, shownMask, type CaneLayout } from './landscape/caneFields';
import { CaneFields } from './landscape/CaneFields';
```

Module level, below `masksFor`:

```ts
/** The cane layout depends only on the geo bundle: built once, on first use. */
let cane: CaneLayout | null = null;
const caneFor = () => (cane ??= caneLayout(G));
```

In the component, after `groundDens`:

```ts
  const caneShare = era.landscape.cane.value;
  const caneShown = useMemo(() => (caneShare > 0 ? shownMask(caneFor(), caneShare) : null), [caneShare]);
  const caneSkip = useMemo(() => (caneShown ? inCane(caneFor(), caneShown) : undefined), [caneShown]);
```

Pass `caneSkip` as the fifth argument of `coverMap(...)` and add it to that effect's dependency list. Pass `skip={caneSkip}` to `<GroundCover>`. Before `<GroundCover>` in the returned fragment:

```tsx
    {caneShown && <CaneFields layout={caneFor()} shown={caneShown} near={near} far={far} castShadow={q.shadowMap > 0} />}
```

- [ ] **Step 6: Check on screen**

`npm run dev`, open `?era=1900&cam=fields&t=12&freeze=1&q=medium`. Expected: tall green cane blocks filling the grassland, cart lanes between fields, ragged leaf tips on the wall tops, sway when unfrozen; `era=1840` fewer fields, `era=1925` fewer still, `era=1935` none (grass). No gaps under walls on slopes, no z-fighting on top, no console errors. Tune the painters' colours toward the quality-bar image; record changes in the rulings note. Check `q=low` too (no shadows).

- [ ] **Step 7: Full tests, type check, commit**

```bash
npm test && npx tsc -p tsconfig.json --noEmit
git add src/vegetation/textures.ts src/vegetation/landscape/CaneFields.tsx src/vegetation/coverMap.ts src/vegetation/coverMap.test.ts src/vegetation/ground/GroundCover.tsx src/vegetation/Vegetation.tsx
git commit -m "feat(landscape): cane fields on screen; no grass under cane

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Farm block layout (pure)

**Files:**
- Create: `src/vegetation/landscape/plantation.ts`, `src/vegetation/landscape/plantation.test.ts`

**Interfaces:**
- Consumes: `WorldFields`, `sampleField`, `WATER`, `LANDCLS` (`src/terrain/fields.ts`); `VegMasks`, `buildVegMasks` (`src/vegetation/masks.ts`); `siteAt` (`src/vegetation/placement.ts`); `hash3` (`src/vegetation/rng.ts`); `PlantInstance`, `Site`.
- Produces:

```ts
export const ROW = 8;
/** A farm block: centre, unit axis along the coast (ux, uz), half sizes along (halfL) and across (halfW) it. */
export interface Block { cx: number; cz: number; ux: number; uz: number; halfL: number; halfW: number }
export function blockSiteOk(s: Site | null): boolean;
export function findBlocks(f: WorldFields, m: VegMasks): Block[];
export function plantBlocks(f: WorldFields, blocks: Block[], survival: number): PlantInstance[];
export function insideBlocks(blocks: Block[]): (x: number, z: number) => boolean;
```

- [ ] **Step 1: Write the failing tests**

`src/vegetation/landscape/plantation.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import geo from '../../data/geo/loiza.json';
import type { GeoBundle } from '../../data/geo/types';
import { placementFields } from '../../terrain/placementFields';
import { buildVegMasks } from '../masks';
import { siteAt } from '../placement';
import { blockSiteOk, findBlocks, insideBlocks, plantBlocks, ROW } from './plantation';

const f = placementFields(0), m = buildVegMasks(geo as unknown as GeoBundle, f);
const blocks = findBlocks(f, m);

describe('findBlocks', () => {
  test('3–6 blocks of 120 × 80 m, deterministic', () => {
    expect(blocks.length).toBeGreaterThanOrEqual(3); expect(blocks.length).toBeLessThanOrEqual(6);
    for (const b of blocks) { expect(b.halfL).toBe(60); expect(b.halfW).toBe(40); expect(Math.hypot(b.ux, b.uz)).toBeCloseTo(1, 6); }
    expect(findBlocks(f, m)).toEqual(blocks);
  });
  test('every sample in a block passes the site rule (spec 2c §2)', () => {
    for (const b of blocks) for (let a = -b.halfL; a <= b.halfL; a += 20) for (let c = -b.halfW; c <= b.halfW; c += 20) {
      const x = b.cx + a * b.ux - c * b.uz, z = b.cz + a * b.uz + c * b.ux;
      expect(blockSiteOk(siteAt(f, m, x, z)), `${x},${z}`).toBe(true);
    }
  });
  test('blocks are ≥ 200 m apart', () => {
    for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++)
      expect(Math.hypot(blocks[i].cx - blocks[j].cx, blocks[i].cz - blocks[j].cz)).toBeGreaterThanOrEqual(200);
  });
});

describe('plantBlocks', () => {
  const all = plantBlocks(f, blocks, 1);
  test('full survival: 15 × 10 palms per block, 8 m rows, ≤ 1500 total', () => {
    expect(all.length).toBe(blocks.length * 150);
    expect(all.length).toBeLessThanOrEqual(1500);
    const b = blocks[0], p = all.slice(0, 150);
    const along = p.map((q) => (q.x - b.cx) * b.ux + (q.z - b.cz) * b.uz).sort((a, c) => a - c);
    expect(along[149] - along[0]).toBeGreaterThan(14 * ROW - 1.2);
    expect(along[149] - along[0]).toBeLessThan(14 * ROW + 1.2);
  });
  test('survival removes about the right share, deterministically', () => {
    const s = plantBlocks(f, blocks, 0.85);
    expect(s.length / all.length).toBeGreaterThan(0.78); expect(s.length / all.length).toBeLessThan(0.92);
    expect(plantBlocks(f, blocks, 0.85)).toEqual(s);
    expect(plantBlocks(f, blocks, 0)).toEqual([]);
  });
  test('palms stand on the ground, inside their blocks', () => {
    const inside = insideBlocks(blocks);
    for (const p of all) { expect(inside(p.x, p.z)).toBe(true); expect(Number.isFinite(p.y)).toBe(true); }
    expect(inside(1e5, 1e5)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/vegetation/landscape/plantation.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/vegetation/landscape/plantation.ts`:

```ts
import { LANDCLS, sampleField, WATER, type WorldFields } from '../../terrain/fields';
import type { VegMasks } from '../masks';
import { siteAt } from '../placement';
import { hash3 } from '../rng';
import type { PlantInstance, Site } from '../types';

/*
 * Coconut farm blocks (phase 2c, spec §2): planted groves on the flat sand behind the beach, the
 * coast's shift from sugar to coconut [S23]. 3–6 rectangles of 120 × 80 m, long side along the
 * coast, palms in straight rows 8 m apart. All numbers inferred.
 */

export const ROW = 8;
const HALF_L = 60, HALF_W = 40, LATTICE = 40, MIN_GAP = 200, MAX_BLOCKS = 6, SAMPLE = 20, SEED = 1901;
const u01 = (i: number, j: number, s: number) => hash3(i, j, s) / 4294967296;

export interface Block { cx: number; cz: number; ux: number; uz: number; halfL: number; halfW: number }

/** Spec 2c §2: dry, low land 60–400 m from the sea, ≥ 40 m from the river, clear of roads, town and landings. */
export function blockSiteOk(s: Site | null): boolean {
  return !!s && s.water === WATER.LAND && s.seaDist >= 60 && s.seaDist <= 400 && s.height < 3
    && s.landCls !== LANDCLS.WETLAND && s.riverDist >= 40 && s.roadDist >= 10 && s.town < 0.05 && s.clear === 0;
}

const at = (b: Block, a: number, c: number): [number, number] => [b.cx + a * b.ux - c * b.uz, b.cz + a * b.uz + c * b.ux];

export function findBlocks(f: WorldFields, m: VegMasks): Block[] {
  const g = f.grid, ext = g.cell * g.size, n = Math.floor(ext / LATTICE);
  const cands: { b: Block; r: number }[] = [];
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
    const cx = g.minX + i * LATTICE, cz = g.minZ + j * LATTICE;
    if (!blockSiteOk(siteAt(f, m, cx, cz))) continue;
    // Across-coast axis = seaDist gradient (points inland); the long side runs along the coast.
    const gx = sampleField(f, f.seaDist, cx + 20, cz) - sampleField(f, f.seaDist, cx - 20, cz);
    const gz = sampleField(f, f.seaDist, cx, cz + 20) - sampleField(f, f.seaDist, cx, cz - 20);
    const gl = Math.hypot(gx, gz);
    if (gl < 1e-3) continue;
    const b: Block = { cx, cz, ux: -gz / gl, uz: gx / gl, halfL: HALF_L, halfW: HALF_W };
    let ok = true;
    for (let a = -HALF_L; a <= HALF_L && ok; a += SAMPLE) for (let c = -HALF_W; c <= HALF_W; c += SAMPLE)
      if (!blockSiteOk(siteAt(f, m, ...at(b, a, c)))) { ok = false; break; }
    if (ok) cands.push({ b, r: u01(i, j, SEED) });
  }
  cands.sort((p, q) => p.r - q.r);
  const out: Block[] = [];
  for (const { b } of cands) {
    if (out.length >= MAX_BLOCKS) break;
    if (out.every((o) => Math.hypot(o.cx - b.cx, o.cz - b.cz) >= MIN_GAP)) out.push(b);
  }
  return out;
}

export function plantBlocks(f: WorldFields, blocks: Block[], survival: number): PlantInstance[] {
  const out: PlantInstance[] = [];
  if (survival <= 0) return out;
  const na = Math.round((2 * HALF_L - 8) / ROW) + 1, nc = Math.round((2 * HALF_W - 8) / ROW) + 1; // 15 × 10
  blocks.forEach((b, bi) => {
    for (let ia = 0; ia < na; ia++) for (let ic = 0; ic < nc; ic++) {
      const h = (s: number) => u01(bi * 64 + ia, ic, SEED + s);
      if (h(1) >= survival) continue;
      const a = -HALF_L + 4 + ia * ROW + (h(2) - 0.5) * 0.8, c = -HALF_W + 4 + ic * ROW + (h(3) - 0.5) * 0.8;
      const [x, z] = at(b, a, c);
      out.push({ x, y: sampleField(f, f.height, x, z), z, rot: (2 * h(4) - 1) * 0.3, scale: 0.9 + 0.2 * h(5), variant: Math.floor(h(6) * 3) });
    }
  });
  return out;
}

export function insideBlocks(blocks: Block[]) {
  return (x: number, z: number) => blocks.some((b) => {
    const dx = x - b.cx, dz = z - b.cz;
    return Math.abs(dx * b.ux + dz * b.uz) <= b.halfL && Math.abs(-dx * b.uz + dz * b.ux) <= b.halfW;
  });
}
```

Check the frame: with `at(b, a, c) = centre + a·u + c·(−uz, ux)`, `insideBlocks` projects on `u` and on `(−uz, ux)`, which matches.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/vegetation/landscape/plantation.test.ts`
Expected: PASS. A probe before planning found 45 axis-aligned 120 × 80 m candidates in five coastal clusters; if the rotated search finds fewer than 3 blocks, report the count to the controller (do not relax the §2 rule on your own).

- [ ] **Step 5: Commit**

```bash
git add src/vegetation/landscape/plantation.ts src/vegetation/landscape/plantation.test.ts
git commit -m "feat(landscape): coconut farm block layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Farm blocks in the placement

**Files:**
- Modify: `src/vegetation/placement.ts:155-165`, `src/vegetation/placement.test.ts`, `src/vegetation/placementCache.ts:20-21`, `src/vegetation/placementCache.test.ts`, `src/vegetation/Vegetation.tsx`

**Interfaces:**
- Consumes: `findBlocks`, `plantBlocks`, `insideBlocks` (Task 7); `Era.landscape.plantation` (Task 2).
- Produces:
  - `placeAll(f, m, densities, seed, opts & { planted?: { coconut: PlantInstance[]; inside: (x: number, z: number) => boolean } })`: planted palms are marked in the occupancy first and come first in `out.coconut`; no woody species is placed where `inside` is true.
  - `placementKey(dens, bankOffset, tier, extra = '')`.

- [ ] **Step 1: Write the failing tests**

Append to `src/vegetation/placement.test.ts` (reuse the file's fields/masks setup names):

```ts
test('placeAll: planted palms come first; no woody plant grows inside the blocks', () => {
  const planted = [{ x: 10, y: 0, z: 10, rot: 0, scale: 1, variant: 0 }];
  const inside = (x: number, z: number) => Math.abs(x) < 300 && Math.abs(z) < 300;
  const d = { redMangrove: 1, coconut: 1, casuarina: 1, blackMangrove: 1, whiteMangrove: 1, buttonwood: 1, almendro: 1, seaGrape: 1 };
  const out = placeAll(f, m, d, 7, { planted: { coconut: planted, inside } });
  expect(out.coconut[0]).toBe(planted[0]);
  for (const list of Object.values(out)) for (const p of list) if (p !== planted[0]) expect(inside(p.x, p.z)).toBe(false);
});
```

Append to `src/vegetation/placementCache.test.ts`:

```ts
test('placementKey: extra separates otherwise equal keys', () => {
  expect(placementKey(d('1975'), 0, 'high', 'p0.85')).not.toBe(placementKey(d('1975'), 0, 'high', 'p1'));
  expect(placementKey(d('1975'), 0, 'high')).toBe(placementKey(d('1975'), 0, 'high', ''));
});
```

Run: `npx vitest run src/vegetation/placement.test.ts src/vegetation/placementCache.test.ts`
Expected: FAIL (option and parameter ignored).

- [ ] **Step 2: Implement `planted` in `placeAll`**

```ts
/**
 * Place every species in PLACEMENT_ORDER (larger plants first) with one shared occupancy grid,
 * so species never overlap. `occCell` is the occupancy resolution in metres. `planted` (phase 2c
 * farm blocks): those palms are marked first and lead `out.coconut`; no woody species is placed
 * where `inside` is true (the blocks' floor stays open, grass only).
 */
export function placeAll(f: WorldFields, m: VegMasks, densities: Partial<Record<SpeciesId, number>>, seed: number,
  opts: { occCell?: number; spacingMul?: number; skip?: (x: number, z: number) => boolean; trunks?: Occupancy;
    planted?: { coconut: PlantInstance[]; inside: (x: number, z: number) => boolean } } = {}) {
  const occ = new Occupancy(f.grid, opts.occCell ?? 1);
  const p = opts.planted;
  if (p) for (const q of p.coconut) occ.mark(q.x, q.z, RULES.coconut.radius);
  const skip = p ? (x: number, z: number) => p.inside(x, z) || !!opts.skip?.(x, z) : opts.skip;
  const out = {} as Record<WoodyId, PlantInstance[]>;
  for (const id of PLACEMENT_ORDER) {
    const list = placeSpecies(f, m, id, { density: densities[id] ?? 0, seed, occupancy: occ, spacingMul: opts.spacingMul, skip });
    out[id] = p && id === 'coconut' ? p.coconut.concat(list) : list;
    if (opts.trunks) markTrunks(opts.trunks, id, out[id]);
  }
  return out;
}
```

- [ ] **Step 3: Implement `extra` in `placementKey`**

```ts
/** Placement results depend only on (densities, bank offset, tier, farm blocks) — spec §13, 2c. */
export const placementKey = (dens: Record<WoodyId, number>, bankOffset: number, tier: string, extra = '') =>
  `${tier}|${bankOffset}|${PLACEMENT_ORDER.map((id) => dens[id].toFixed(4)).join(',')}${extra ? `|${extra}` : ''}`;
```

Run the two test files again — Expected: PASS.

- [ ] **Step 4: Wire into `Vegetation.tsx`**

Imports:

```ts
import { findBlocks, insideBlocks, plantBlocks } from './landscape/plantation';
```

Replace the key line and the near placement call:

```ts
  const survival = era.landscape.plantation.value;
  const key = placementKey(dens, bankOffset, tier, `p${survival}`);
```

```ts
    const pf = placementFields(bankOffset, near);
    const blocks = survival > 0 ? findBlocks(pf, masksFor(pf)) : [];
    const planted = blocks.length ? { coconut: plantBlocks(pf, blocks, survival), inside: insideBlocks(blocks) } : undefined;
    const nearSet = placeAll(pf, masksFor(pf), dens, NEAR_SEED, { planted });
```

Add `survival` to the `useMemo` dependency list of the placements memo (`[key, near, far]` already changes with `key`; keep it as is — `key` carries `survival`). The planted palms are part of `nearSet.coconut`, so `reseat`, the far-ring concat, `nearCount`, trunk discs and the stats all include them with no other change.

- [ ] **Step 5: Check on screen**

`npm run dev`, open `?era=1900&cam=aerial&t=12&freeze=1&q=medium`, then `1925`, `1935`, `1975`, and `1840`. Expected: 3–6 rectangular palm groves in straight rows behind the beach from 1900 on (young in 1900, half grown in 1925, tall after), none in 1840, a few gaps in 1975; wild clumps unchanged outside them; no plants other than grass inside the blocks. Rows must not show in the wild clumps. If no block is in any preset view, look with the orbit camera and add an aerial-style shot position to the rulings note.

- [ ] **Step 6: Full tests, type check, commit**

```bash
npm test && npx tsc -p tsconfig.json --noEmit
git add src/vegetation/placement.ts src/vegetation/placement.test.ts src/vegetation/placementCache.ts src/vegetation/placementCache.test.ts src/vegetation/Vegetation.tsx
git commit -m "feat(vegetation): coconut farm blocks from 1900

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: After shots, frame rate, art gate

**Files:**
- Create: `tests/snapshots/phase2c/*.png`
- Modify: `docs/superpowers/notes/phase-2c-rulings.md`

- [ ] **Step 1: After shots**

```bash
npx playwright test tests/e2e/world.spec.ts
```

Expected: all pass, no console errors; PNGs in `tests/snapshots/phase2c/`.

- [ ] **Step 2: Frame rate**

`npm run build && npm run preview`; rerun every Task 1 Step 6 query. Add an "After" table to the rulings note. Check the Global Constraints limits (≤ +0.5 ms mean on `high`; no tier below its baseline by more than that). If a limit fails, stop and report the numbers to the controller.

- [ ] **Step 3: Art gate**

Compare each `phase2c/` shot with its `phase2c-before/` twin and with the quality-bar image. Write one line per shot in the rulings note (what changed, what still looks wrong). Fix Important problems (for example: cane walls floating or sunk, visible seams, flat unlit cane, farm rows looking like the old "orchard" wild palms, young palms reading as scaled-down trees) before the review; list Minor ones under Deferred.

- [ ] **Step 4: Commit**

```bash
git add tests/snapshots/phase2c docs/superpowers/notes/phase-2c-rulings.md
git commit -m "test(2c): after shots, frame rate, art gate notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Fact check and final review (controller)

- [ ] **Step 1: Fact check.** Dispatch a review agent to check spec 2c §2 claims and the `eras.ts` landscape comments against [S1] and [S23] (URLs in `docs/research/ancon-research.md`). Show the user only flagged items; fix wording or confidence as ruled.
- [ ] **Step 2: Final code review** of the branch diff (as in earlier phases). Fix Important items; add Minor ones to the rulings note §Deferred.
- [ ] **Step 3: Hand over.** Tell the user the branch is ready, with the art-gate shots, and ask for merge approval. Do not merge or push to `main` without it.
