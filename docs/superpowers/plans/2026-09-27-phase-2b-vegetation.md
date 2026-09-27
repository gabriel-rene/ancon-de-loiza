# Phase 2b — Remaining species, ground cover, polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the five remaining woody species (black and white mangrove, buttonwood, almendro, sea grape) and three ground covers (grass, reeds, beach morning glory), paint a matching ground-cover tint into the terrain, and fix four visual problems (flat mangrove wall, even palm skyline, teal noon, blocky reflection).

**Architecture:** Woody species reuse the 2a pipeline unchanged (habitat rule → `placeAll` with shared occupancy → `InstancedSpecies` LOD0 meshes + baked impostor cards). Ground cover is a new, separate path: tiles of 32 m are placed lazily around the camera with the same `placeSpecies` (restricted to a tile by a new `bounds` option), drawn as crossed alpha cards within a per-tier radius, dither-faded at the edge, no shadows, hidden in the reflection. A 256² cover map built from the ground-cover rules tints the terrain beyond that radius.

**Tech Stack:** three 0.186, R3F 9, three-custom-shader-material 6, zustand, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-phase-2b-vegetation-design.md` · Parent: `docs/superpowers/specs/2026-09-26-ancon-loiza-design.md` §12 · Research: `docs/research/ancon-research.md` §5 · Carry-over: `docs/superpowers/notes/phase-2a-rulings.md`

## Global Constraints

- World frame: 1 unit = 1 m; +X east, +Y up, +Z south. Trade wind toward WSW (`WIND_DIR`).
- Every era value is `Sourced` (`sources` + `confidence`); guesses set `inferred: true`.
- All plant art is generated in code — no downloaded models or textures.
- Placement is deterministic (same fields + seed ⇒ same instances) and always runs on the fixed 512 near grid (`placementFields`).
- The ferry-landing clearings (`LANDING_CLEARING`, via `Site.clear`) apply to every species, ground cover included.
- Ground cover radius per tier (`veg.groundRadius`): high 60 m, medium 45 m, low 25 m. Fade over the last 20 %.
- Ground cover casts no shadows and is not drawn in the water reflection.
- Frame rate must not drop below the 2a/phase-3 baseline recorded in Task 1, on any tier.
- Branch `phase-2b-vegetation`; never push to `main`. Merge only after the user approves.
- Commit message bodies end, after a blank line, with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File map

```
docs/superpowers/notes/phase-2b-rulings.md   baseline numbers, rulings, deferred items (new)
tests/snapshots/phase2b-before/              baseline screenshots (new, frozen)
tests/snapshots/phase2b/                     after screenshots (written by world.spec.ts)
src/data/eras.ts                             vegetation densities for every SpeciesId
src/quality.ts                               + veg.groundRadius
src/vegetation/types.ts                      SpeciesId = WoodyId | GroundId
src/vegetation/rules.ts                      rules for 8 new ids; PLACEMENT_ORDER (woody) + GROUND_ORDER
src/vegetation/placement.ts                  bounds option, trunk-blocking occupancy
src/vegetation/windMaterial.ts               per-instance tint jitter; ground fade option
src/vegetation/species/basinMangrove.ts      black + white mangrove (new)
src/vegetation/species/shrubs.ts             buttonwood + sea grape (new)
src/vegetation/species/almendro.ts           tropical almond (new)
src/vegetation/species/groundClumps.ts       grass / reed / vine clump cards (new)
src/vegetation/species/index.ts              registry: 8 woody species + tint
src/vegetation/textures.ts                   new leaf painters
src/vegetation/ground/tiles.ts               pure: tile keys, tiles in radius, tile placement cache (new)
src/vegetation/ground/GroundCover.tsx        instanced ground clumps around the camera (new)
src/vegetation/coverMap.ts                   pure: 256² cover weights for the terrain (new)
src/scene/groundUniforms.ts                  + uCover, uCoverRect
src/scene/terrainMaterial.ts                 cover tint
src/vegetation/Vegetation.tsx                mounts GroundCover, uploads cover map
src/geo/atmosphere.ts / src/scene/post/Post.tsx   noon colour
src/scene/water/Water.tsx (+ quality.ts)     reflection fix
tests/e2e/world.spec.ts                      writes phase2b/, adds noon shots
```

---

### Task 1: Baseline — screenshots and frame rate before any change

**Files:**
- Create: `docs/superpowers/notes/phase-2b-rulings.md`, `tests/snapshots/phase2b-before/*.png`
- Modify: `tests/snapshots/README.md`

- [ ] **Step 1: Build and serve the current branch (still identical to `main`).**

Run: `npm run build && npm run preview` (serves :4173, leave it running)

- [ ] **Step 2: Record frame rates.** In a second shell:

```bash
node scripts/dev/perf.mjs "?cam=ride&q=high" 10 1.75
node scripts/dev/perf.mjs "?cam=bank&q=high" 10 1.75
node scripts/dev/perf.mjs "?cam=ride&q=medium" 10 1.5
node scripts/dev/perf.mjs "?cam=ride&q=low" 10 1
node scripts/dev/perf.mjs "?cam=bank&q=low" 10 1
```
Expected: one JSON line each. Copy them verbatim into the rulings note under `## Baseline (before 2b)`.

- [ ] **Step 3: Baseline screenshots.** Stop the preview; run `npm run dev` (:5173). For each query below run `node scripts/dev/shot.mjs "<query>" tests/snapshots/phase2b-before/<name>.png`:

| name | query |
|---|---|
| `1935-ride-golden` | `?era=1935&cam=ride&c=95&freeze=1&q=medium` (golden = default time) |
| `1975-bank-noon` | `?era=1975&cam=bank&t=12&c=95&freeze=1&q=medium` |
| `1840-bank-noon` | `?era=1840&cam=bank&t=12&c=95&freeze=1&q=medium` |
| `1984-mouth-dawn` | `?era=1984&cam=mouth&t=6.4&c=0&freeze=1&q=medium` |
| `1975-aerial-noon` | `?era=1975&cam=aerial&t=12&c=95&freeze=1&q=medium` |
| `1975-bank-noon-high` | `?era=1975&cam=bank&t=12&c=95&freeze=1&q=high` |

Open each PNG and write one line per image in the note describing the four known problems where visible (flat dark mangrove band, evenly spaced palms, teal noon, blocky reflected fringe).

- [ ] **Step 4: README.** Add to `tests/snapshots/README.md`: ``- `phase2b-before/` — frozen baseline taken before Phase 2b (dev shot script, not a spec). Kept for before/after comparison.``

- [ ] **Step 5: Commit** (`chore(2b): baseline screenshots and frame rates`).

---

### Task 2: Data — species ids, era densities, tier radius, habitat rules, placement options

**Files:**
- Modify: `src/vegetation/types.ts`, `src/data/eras.ts`, `src/data/eras.test.ts`, `src/quality.ts`, `src/vegetation/rules.ts`, `src/vegetation/placement.ts`, `src/vegetation/placement.test.ts`
- Create: `src/vegetation/rules.test.ts`

**Interfaces:**
- Produces:
  - `type WoodyId = 'redMangrove' | 'coconut' | 'casuarina' | 'blackMangrove' | 'whiteMangrove' | 'buttonwood' | 'almendro' | 'seaGrape'`
  - `type GroundId = 'grass' | 'reeds' | 'morningGlory'`; `type SpeciesId = WoodyId | GroundId`
  - `Era.vegetation: Record<SpeciesId, Sourced<number>>`
  - `QualitySettings.veg.groundRadius: number`
  - `RULES: Record<SpeciesId, SpeciesRule>` (`SpeciesRule.trunk?: number` — trunk radius that blocks ground cover, default 0.5)
  - `PLACEMENT_ORDER: WoodyId[]` — **only species that already have a registry entry**; each species task appends its ids. `GROUND_ORDER: GroundId[] = ['reeds', 'morningGlory', 'grass']`.
  - `PlaceOpts.bounds?: [minX: number, minZ: number, maxX: number, maxZ: number]` and `PlaceOpts.blocked?: Occupancy`
  - `placeAll(..., opts: { ...; trunks?: Occupancy })` marks each woody instance's trunk radius into `trunks`.

- [ ] **Step 1: Types.** Replace `src/vegetation/types.ts` line 2:

```ts
export type WoodyId = 'redMangrove' | 'coconut' | 'casuarina' | 'blackMangrove' | 'whiteMangrove' | 'buttonwood' | 'almendro' | 'seaGrape';
export type GroundId = 'grass' | 'reeds' | 'morningGlory';
export type SpeciesId = WoodyId | GroundId;
```
Keep `PlantInstance`, `Site`, `PlantPart` as they are.

- [ ] **Step 2: Failing era test.** In `src/data/eras.test.ts`, replace the three vegetation lines in `sourcedFields` with `...(Object.values(e.vegetation) as Sourced<unknown>[]),`, change the density-range test to loop `Object.values(e.vegetation)`, and add:

```ts
  test('every species has an era density; almendro grows in from 1925 (research §5, S1)', () => {
    const ids = ['redMangrove', 'coconut', 'casuarina', 'blackMangrove', 'whiteMangrove', 'buttonwood', 'almendro', 'seaGrape', 'grass', 'reeds', 'morningGlory'];
    for (const e of ERAS) expect(Object.keys(e.vegetation).sort()).toEqual([...ids].sort());
    expect(getEra('1840').vegetation.almendro.value).toBeLessThan(getEra('1925').vegetation.almendro.value);
    expect(getEra('1925').vegetation.almendro.value).toBe(1);
    for (const e of ERAS) for (const id of ['grass', 'reeds'] as const) expect(e.vegetation[id].inferred).toBe(true);
  });
```
Run: `npx vitest run src/data/eras.test.ts` — Expected: FAIL (missing keys).

- [ ] **Step 3: Era data.** In `src/data/eras.ts`: change the field type to `vegetation: Record<SpeciesId, Sourced<number>>;` (import `SpeciesId` from `../vegetation/types`). Replace the `veg` helper and add the constants:

```ts
// Basin mangroves (black + white) make ~55 % of the Piñones forest; buttonwood on drier ground;
// sea grape and beach morning glory on the Piñones dunes (research §5).
const BASIN = s(1, ['S22', 'S34'], 'H');
const BUTTONWOOD = s(1, ['S22'], 'H');
const DUNE = s(1, ['S22'], 'H');
// No site source names the grasses or reeds; open pasture and wet-edge reeds are general
// coastal Puerto Rico (inferred, M).
const GRASS = s(1, [], 'M', true);
// Almendro: families picnicked "under some almond tree" on the bank (S1, 20th c.). It is an
// introduced tree; fewer before the 1920s (inferred timing, L).
const ALMOND_EARLY = (v: number) => s(v, ['S1'], 'L', true);
const ALMOND = s(1, ['S1'], 'M');
const veg = (coconut: Sourced<number>, casuarina: Sourced<number>, almendro: Sourced<number>) => ({
  redMangrove: MANGROVE, coconut, casuarina, almendro,
  blackMangrove: BASIN, whiteMangrove: BASIN, buttonwood: BUTTONWOOD, seaGrape: DUNE, morningGlory: DUNE,
  grass: GRASS, reeds: GRASS,
});
```
Add the third argument to each `VEG` row: `'1840'` → `ALMOND_EARLY(0.25)`, `'1900'` → `ALMOND_EARLY(0.4)`, every later era → `ALMOND`.

Run: `npx vitest run src/data` — Expected: PASS.

- [ ] **Step 4: Tier radius.** In `src/quality.ts` add to the `veg` interface doc: `groundRadius: ground-cover clump radius (m)` and the field `groundRadius: number`; values high `60`, medium `45`, low `25`.

- [ ] **Step 5: Failing rules test.** Create `src/vegetation/rules.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { LANDCLS, WATER } from '../terrain/fields';
import { GROUND_ORDER, RULES } from './rules';
import type { Site, SpeciesId } from './types';

const site = (o: Partial<Site>): Site => ({
  water: WATER.LAND, depth: 0, shore: 10, seaDist: 400, riverDist: 100, roadDist: 50,
  height: 1, landCls: LANDCLS.GRASS, town: 0, clear: 0, ...o,
});
const NEW: SpeciesId[] = ['blackMangrove', 'whiteMangrove', 'buttonwood', 'almendro', 'seaGrape', 'grass', 'reeds', 'morningGlory'];

describe('habitat rules', () => {
  test('nothing grows in the sea, the river channel or on a road', () => {
    for (const id of NEW) {
      expect(RULES[id].density(site({ water: WATER.SEA, depth: 3 })), id).toBe(0);
      expect(RULES[id].density(site({ water: WATER.RIVER, depth: 2.5 })), id).toBe(0);
      expect(RULES[id].density(site({ roadDist: 1 })), id).toBe(0);
    }
  });
  test('each species has its habitat', () => {
    expect(RULES.blackMangrove.density(site({ landCls: LANDCLS.WETLAND, riverDist: 25, height: 0.8 }))).toBeGreaterThan(0.5);
    expect(RULES.whiteMangrove.density(site({ riverDist: 10, height: 0.8 }))).toBeGreaterThan(0.3);
    expect(RULES.buttonwood.density(site({ riverDist: 70, height: 1.5, landCls: LANDCLS.SCRUB }))).toBeGreaterThan(0.2);
    expect(RULES.almendro.density(site({ riverDist: 12 }))).toBeGreaterThan(0.1);
    expect(RULES.seaGrape.density(site({ seaDist: 25, landCls: LANDCLS.SAND }))).toBeGreaterThan(0.4);
    expect(RULES.morningGlory.density(site({ seaDist: 15, landCls: LANDCLS.SAND }))).toBeGreaterThan(0.4);
    expect(RULES.grass.density(site({}))).toBeGreaterThan(0.6);
    expect(RULES.reeds.density(site({ riverDist: 3, height: 0.4 }))).toBeGreaterThan(0.4);
  });
  test('each species stays out of the wrong place', () => {
    expect(RULES.blackMangrove.density(site({ seaDist: 30 }))).toBe(0);               // not on the surf coast
    expect(RULES.blackMangrove.density(site({ riverDist: 200, height: 3 }))).toBe(0);  // not on high, dry land
    expect(RULES.buttonwood.density(site({ riverDist: 3 }))).toBe(0);                  // not in the mangrove fringe
    expect(RULES.seaGrape.density(site({ seaDist: 300 }))).toBe(0);                    // beach only
    expect(RULES.morningGlory.density(site({ seaDist: 300 }))).toBe(0);
    expect(RULES.grass.density(site({ seaDist: 20, landCls: LANDCLS.SAND }))).toBe(0); // no pasture on the beach
    expect(RULES.grass.density(site({ landCls: LANDCLS.WETLAND }))).toBe(0);
    expect(RULES.reeds.density(site({ riverDist: 60 }))).toBe(0);
  });
  test('ground cover is its own layer', () => {
    expect([...GROUND_ORDER].sort()).toEqual(['grass', 'morningGlory', 'reeds']);
  });
});
```
Run: `npx vitest run src/vegetation/rules.test.ts` — Expected: FAIL.

- [ ] **Step 6: Rules.** In `src/vegetation/rules.ts`: add `/** Trunk radius (m) that ground cover must not overlap; default 0.5. */ trunk?: number;` to `SpeciesRule`, import `GroundId, WoodyId`, and add these entries to `RULES` (starting values; later tasks may tune numbers on screen but must keep `rules.test.ts` green):

```ts
  // Avicennia germinans: basin mangrove behind the red fringe, low wet ground (research §5, S22/S34).
  blackMangrove: {
    spacing: 4, radius: 1.8, scale: [0.8, 1.2], variants: 3, rot: Math.PI, clump: { scale: 40, strength: 0.5, size: 0.2 }, trunk: 0.4,
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 5 || s.seaDist < 60) return 0;
      const low = 1 - smooth(1.4, 2.6, s.height);
      const behind = smooth(6, 12, s.riverDist) * (1 - smooth(45, 80, s.riverDist));
      const wet = s.landCls === LANDCLS.WETLAND ? 0.85 : 0;
      return Math.min(1, Math.max(0.7 * behind, wet) * low) * (1 - s.town);
    },
  },
  // Laguncularia racemosa: mixed with black mangrove, nearer the fringe.
  whiteMangrove: {
    spacing: 4, radius: 1.6, scale: [0.8, 1.2], variants: 3, rot: Math.PI, clump: { scale: 30, strength: 0.55, size: 0.2 }, trunk: 0.35,
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 5 || s.seaDist < 60) return 0;
      const low = 1 - smooth(1.4, 2.6, s.height);
      const near = smooth(4, 9, s.riverDist) * (1 - smooth(25, 50, s.riverDist));
      const wet = s.landCls === LANDCLS.WETLAND ? 0.5 : 0;
      return Math.min(1, Math.max(0.6 * near, wet) * low) * (1 - s.town);
    },
  },
  // Conocarpus erectus: drier ground behind the mangroves.
  buttonwood: {
    spacing: 5, radius: 1.5, scale: [0.75, 1.25], variants: 3, rot: Math.PI, clump: { scale: 35, strength: 0.6, size: 0.15 }, trunk: 0.3,
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 4 || s.seaDist < 40) return 0;
      const band = smooth(25, 45, s.riverDist) * (1 - smooth(120, 200, s.riverDist));
      const dry = smooth(0.6, 1.2, s.height) * (s.landCls === LANDCLS.WETLAND ? 0.3 : 1);
      return 0.5 * band * dry * (1 - s.town);
    },
  },
  // Terminalia catappa: river banks near the landings and town yards (S1).
  almendro: {
    spacing: 14, radius: 4, scale: [0.8, 1.2], variants: 3, rot: Math.PI, clump: { scale: 60, strength: 0.5, size: 0.1 }, trunk: 0.5,
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 4 || s.landCls === LANDCLS.WETLAND) return 0;
      const bank = (1 - smooth(15, 45, s.riverDist)) * smooth(4, 8, s.riverDist);
      return Math.min(1, 0.35 * bank + 0.25 * s.town);
    },
  },
  // Coccoloba uvifera: beach edge and dunes, seaward of the casuarinas (S22).
  seaGrape: {
    spacing: 3.5, radius: 1.4, scale: [0.7, 1.3], variants: 3, rot: Math.PI, clump: { scale: 25, strength: 0.6, size: 0.2 }, trunk: 0.3,
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 3) return 0;
      const beach = smooth(6, 12, s.seaDist) * (1 - smooth(45, 80, s.seaDist));
      return Math.min(1, beach * (s.landCls === LANDCLS.SAND ? 1 : 0.6)) * (1 - s.town);
    },
  },
  // Ipomoea pes-caprae: trailing vines on open sand (S22). Ground cover.
  morningGlory: {
    spacing: 1.8, radius: 0.7, scale: [0.7, 1.3], variants: 3, rot: Math.PI, clump: { scale: 12, strength: 0.7, size: 0.2 },
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 2) return 0;
      const sand = smooth(3, 6, s.seaDist) * (1 - smooth(30, 55, s.seaDist));
      return Math.max(sand, s.landCls === LANDCLS.SAND ? 0.5 : 0) * (1 - s.town);
    },
  },
  // Open-land grasses (inferred). Ground cover.
  grass: {
    spacing: 1.6, radius: 0.5, scale: [0.7, 1.3], variants: 3, rot: Math.PI, clump: { scale: 10, strength: 0.5, size: 0.3 },
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 2 || s.landCls === LANDCLS.WETLAND || s.height < 0.3) return 0;
      if (s.landCls === LANDCLS.SAND || s.seaDist < 40) return 0;
      const cls = s.landCls === LANDCLS.WOOD ? 0.3 : 1;
      return cls * smooth(5, 9, s.riverDist) * (1 - 0.7 * s.town);
    },
  },
  // Wet-edge reeds and sedges (inferred). Ground cover.
  reeds: {
    spacing: 1.4, radius: 0.5, scale: [0.7, 1.3], variants: 3, rot: Math.PI, clump: { scale: 14, strength: 0.6, size: 0.25 },
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 2 || s.seaDist < 60) return 0;
      const edge = 1 - smooth(4, 10, s.riverDist);
      const wet = s.landCls === LANDCLS.WETLAND ? 0.6 : 0;
      return Math.max(edge, wet) * (1 - s.town);
    },
  },
```
Then change the order exports:

```ts
/** Woody species with a registry entry, larger plants first (they claim space first). Species tasks append here. */
export const PLACEMENT_ORDER: WoodyId[] = ['casuarina', 'coconut', 'redMangrove'];
/** Ground cover, placed per tile around the camera (see ground/tiles.ts). */
export const GROUND_ORDER: GroundId[] = ['reeds', 'morningGlory', 'grass'];
```
Run: `npx vitest run src/vegetation/rules.test.ts` — Expected: PASS. If a habitat assertion fails, adjust the threshold in the rule, not the test.

- [ ] **Step 7: Failing placement tests.** Append to the `describe` in `src/vegetation/placement.test.ts` (add `Occupancy` to the import from `./placement`):

```ts
  test('bounds: tiles placed one by one equal the whole-map placement', () => {
    // spacingMul 4 keeps the whole-map run fast; the tiling logic is the same.
    const whole = placeSpecies(f, m, 'grass', { density: 1, seed: 5, spacingMul: 4 });
    const g = f.grid, T = 320, ext = g.cell * g.size, tiles = [];
    for (let z = g.minZ; z < g.minZ + ext; z += T) for (let x = g.minX; x < g.minX + ext; x += T)
      tiles.push(...placeSpecies(f, m, 'grass', { density: 1, seed: 5, spacingMul: 4, bounds: [x, z, x + T, z + T] }));
    const key = (p: { x: number; z: number }) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`;
    expect(tiles.map(key).sort()).toEqual(whole.map(key).sort());
  });
  test('blocked: ground cover keeps off woody trunks', () => {
    const trunks = new Occupancy(f.grid, 1);
    const woody = placeAll(f, m, { redMangrove: 1, coconut: 1, casuarina: 1 }, 7, { trunks });
    const grass = placeSpecies(f, m, 'grass', { density: 1, seed: 7, spacingMul: 2, blocked: trunks });
    const palms = woody.coconut;
    let min = Infinity;
    for (const p of palms.slice(0, 200)) for (const q of grass) min = Math.min(min, Math.hypot(p.x - q.x, p.z - q.z));
    // Marks and checks use ≥ 1 m discs on a 1 m grid, so the guaranteed gap is 1 − √½ ≈ 0.29 m.
    expect(min).toBeGreaterThan(0.25);
  });
```
Run: `npx vitest run src/vegetation/placement.test.ts` — Expected: FAIL (`bounds`/`trunks` unknown). Also change the three existing `placeAll(f, m, { redMangrove: 1, coconut: 1, casuarina: 1 }, 7)` calls: they stay valid because `densities` becomes `Partial<Record<SpeciesId, number>>` (see next step).

- [ ] **Step 8: Placement options.** In `src/vegetation/placement.ts`:

```ts
export interface PlaceOpts {
  density: number; seed: number; occupancy?: Occupancy;
  spacingMul?: number;
  skip?: (x: number, z: number) => boolean;
  /** Only candidates whose final position lies in [minX, maxX) × [minZ, maxZ). Same result as filtering a whole-map run. */
  bounds?: [number, number, number, number];
  /** Read-only occupancy: candidates whose `radius` disc touches a marked cell are rejected (ground cover vs trunks). */
  blocked?: Occupancy;
}
```
In `placeSpecies`, replace the double loop header with a candidate range limited by `bounds` (one candidate cell of margin because `JITTER` > 1), and filter the final position:

```ts
  const b = opts.bounds;
  const i0 = b ? Math.max(0, Math.floor((b[0] - g.minX) / sp) - 1) : 0, i1 = b ? Math.min(n - 1, Math.floor((b[2] - g.minX) / sp) + 1) : n - 1;
  const j0 = b ? Math.max(0, Math.floor((b[1] - g.minZ) / sp) - 1) : 0, j1 = b ? Math.min(n - 1, Math.floor((b[3] - g.minZ) / sp) + 1) : n - 1;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const r = _cand.reset(i, j, opts.seed * 131 + salt);
    const x = ..., z = ...;                       // unchanged
    const accept = ..., rot = ..., sc = ..., variant = ...; // unchanged: draw all randoms before any early exit
    if (b && (x < b[0] || x >= b[2] || z < b[1] || z >= b[3])) continue;
```
and after the occupancy check add `if (opts.blocked && !opts.blocked.free(x, z, Math.max(1, rule.radius))) continue;` (before `opts.occupancy?.mark`). The `Math.max(1, …)` matters: `Occupancy` only tests cell centres, so on a 1 m grid a disc under ~0.71 m can miss every centre.

Change `placeAll`:

```ts
export function placeAll(f: WorldFields, m: VegMasks, densities: Partial<Record<SpeciesId, number>>, seed: number,
  opts: { occCell?: number; spacingMul?: number; skip?: (x: number, z: number) => boolean; trunks?: Occupancy } = {}) {
  const occ = new Occupancy(f.grid, opts.occCell ?? 1);
  const out = {} as Record<WoodyId, PlantInstance[]>;
  for (const id of PLACEMENT_ORDER) {
    out[id] = placeSpecies(f, m, id, { density: densities[id] ?? 0, seed, occupancy: occ, spacingMul: opts.spacingMul, skip: opts.skip });
    if (opts.trunks) for (const p of out[id]) opts.trunks.mark(p.x, p.z, Math.max(1, (RULES[id].trunk ?? 0.5) * p.scale));
  }
  return out;
}
```
Update `Vegetation.tsx` types (`Record<SpeciesId, …>` → `Record<WoodyId, …>` for the woody sets and `dens`). Run: `npx vitest run src/vegetation && npm run build` — Expected: PASS, build clean.

- [ ] **Step 9: Commit** (`feat(vegetation): data, rules and placement options for 2b species`).

---

### Task 3: Per-instance tint jitter (first half of the mangrove-wall fix)

**Files:**
- Modify: `src/vegetation/windMaterial.ts`, `src/vegetation/species/index.ts`, `src/vegetation/species/index.test.ts`, `src/vegetation/InstancedSpecies.tsx`
- Create: `src/vegetation/windMaterial.test.ts`

**Interfaces:**
- Produces: `PlantMaterialOpts.tint?: { value: number; hue: number }` (value = ± brightness fraction, hue = ± yellow-green shift fraction); `FoliageMaterial.tint?: { value: number; hue: number }` in the registry; impostor card materials inherit the species' tint.

Why: every red mangrove crown has the same colour, so the fringe reads as one flat band. A hash of the instance position varies each plant's foliage a little. It costs no buffers (the position is already in `instanceMatrix`).

- [ ] **Step 1: Failing test.** `src/vegetation/windMaterial.test.ts`:

```ts
import { expect, test } from 'vitest';
import { makePlantMaterials } from './windMaterial';

type Csm = { uniforms: Record<string, { value: unknown }>; fragmentShader?: string };
test('foliage tint jitter becomes uniforms (default off)', () => {
  const on = makePlantMaterials({ part: 'foliage', color: 0xffffff, roughness: 0.8, alphaTest: 0.5, tint: { value: 0.18, hue: 0.12 } }).material as unknown as Csm;
  expect(on.uniforms.uTint.value).toEqual([0.18, 0.12]);
  const off = makePlantMaterials({ part: 'foliage', color: 0xffffff, roughness: 0.8, alphaTest: 0.5 }).material as unknown as Csm;
  expect(off.uniforms.uTint.value).toEqual([0, 0]);
});
```
Run: `npx vitest run src/vegetation/windMaterial.test.ts` — Expected: FAIL.

- [ ] **Step 2: Shader.** In `WIND_VERTEX` add `varying float vSeed;` and, after `ph` is computed, `vSeed = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);`. In `foliageFragment` declare `uniform vec2 uTint; varying float vSeed;` and after the `USE_COLOR` block:

```glsl
    float tv = (vSeed - 0.5) * 2.0;                                   // -1..1 per plant
    float th = (fract(vSeed * 7.13) - 0.5) * 2.0;
    c.rgb *= 1.0 + uTint.x * tv;
    c.rgb = mix(c.rgb, c.rgb * vec3(1.12, 1.06, 0.78), max(0.0, th) * uTint.y); // toward yellow-green
    c.rgb = mix(c.rgb, c.rgb * vec3(0.9, 0.98, 1.05), max(0.0, -th) * uTint.y); // toward blue-green
```
Add `uTint: { value: [opts.tint?.value ?? 0, opts.tint?.hue ?? 0] }` to the foliage uniforms (a plain array; CSM uploads `vec2` from a 2-array — if it does not, use `new THREE.Vector2` and change the test to read `.x/.y`).

- [ ] **Step 3: Registry + cards.** Add `tint?: { value: number; hue: number }` to `FoliageMaterial`; pass it through in `makeSpeciesMaterials`. Set `redMangrove.foliage.tint = { value: 0.18, hue: 0.12 }`, `coconut.foliage.tint = { value: 0.1, hue: 0.08 }`, `casuarina.foliage.tint = { value: 0.12, hue: 0.06 }`. In `InstancedSpecies.tsx`, read the species tint from the foliage material (`uniforms.uTint.value`, like `translucencyOf`) and pass it into the card `makePlantMaterials` call as `tint`. Add to `index.test.ts`: `expect(SPECIES.redMangrove.foliage.tint!.value).toBeGreaterThan(0.1);`.

- [ ] **Step 4: Check.** `npx vitest run src/vegetation && npm run build`. `npm run dev`; `node scripts/dev/shot.mjs "?era=1975&cam=bank&t=12&c=95&freeze=1&q=medium" /tmp/tint.png` and compare with `phase2b-before/1975-bank-noon.png`: neighbouring mangrove crowns now differ in shade; no crown is neon or grey. Tune the two numbers if needed.

- [ ] **Step 5: Commit** (`feat(vegetation): per-plant foliage tint jitter`).

---

### Task 4: Black and white mangrove (*Avicennia germinans*, *Laguncularia racemosa*)

**Files:**
- Create: `src/vegetation/species/basinMangrove.ts`, `src/vegetation/species/basinMangrove.test.ts`
- Modify: `src/vegetation/textures.ts` (`paintBlackMangroveLeaves`, `paintWhiteMangroveLeaves`), `src/vegetation/species/index.ts` (+ test key list), `src/vegetation/rules.ts` (`PLACEMENT_ORDER`)

**Interfaces:**
- Consumes: `tube`, `Curve` (`species/tube.ts`), `cellRng` (`../rng`), `PlantPart`.
- Produces: `buildBlackMangrove(seed: number): PlantPart[]`, `buildWhiteMangrove(seed: number): PlantPart[]`, `paintBlackMangroveLeaves(): HTMLCanvasElement`, `paintWhiteMangroveLeaves(): HTMLCanvasElement`. `PLACEMENT_ORDER` becomes `['casuarina', 'coconut', 'blackMangrove', 'whiteMangrove', 'redMangrove']`.

Reference morphology (general botany; mark as such in the file header like `mangrove.ts`):
- **Black mangrove:** 4–8 m (tests allow 3–10), single or forked grey-brown trunk with dark, fissured, scaly bark; **no prop roots**; many **pneumatophores** — pencil-like vertical roots 10–30 cm tall, 1–1.5 cm thick, in a 1.5–3 m disc around the trunk; open, irregular crown; narrow elliptic leaves, dark grey-green on top, **pale silvery-grey underneath** (salt-crusted), so the crown reads greyer than red mangrove.
- **White mangrove:** 4–7 m (tests allow 3–9), slim upright trunk(s), light grey-brown smooth bark; no prop roots (occasional short pegs — omit); rounded crown; oval, rounded-tip leaves, **light yellow-green**, the brightest of the three mangroves.

- [ ] **Step 1: Tests.** `basinMangrove.test.ts`, same shape as `mangrove.test.ts`: for `[buildBlackMangrove, buildWhiteMangrove]` × seeds 1–6: parts `bark` + `foliage`; `aFlex` in [0, 1]; `normal`, `uv`, `color` present; height in range above; triangle count < 3000; no NaNs; unit normals; deterministic by seed and different across seeds. Black only: at least 40 bark vertices with `0 < y < 0.35` and radius 1–3 m (the pneumatophores). Run — Expected: FAIL.
- [ ] **Step 2: Generator.** Shared helpers in the file: trunk with 1–3 forks (`tube`, bark colour per species via the `vertex` hook); crown of leaf cards in a flattened ellipsoid (reuse the card-orientation approach of `buildCanopy` in `mangrove.ts`, copied — not imported — with per-species parameters: card count 80–100, card size 0.8–1.3 m, crown centre 3.2–5.5 m). Black: pneumatophores as one merged set of 60–90 tiny 4-sided tubes (r 0.006–0.008 m in local units so the scaled tree lands at ~1.2 cm) — keep each at 4 radial × 1 segment to stay in budget; `aFlex` 0. `aFlex`: trunk `0.1·t`, branches 0.1–0.35, leaf cards 0.35–0.7 by height.
- [ ] **Step 3: Textures.** 512² canvases like `paintMangroveLeaves`: black — narrow elliptic leaves (5–10 cm), dark grey-green (~#3a4a33) with many pale grey-silver undersides (~#9aa393) showing; white — rounded oval leaves, light yellow-green (~#7f9a45) with a paler notch at the tip.
- [ ] **Step 4: Registry and order.** Add `blackMangrove` and `whiteMangrove` to `SPECIES` (bark `vertexColors: true`; foliage roughness black 0.7, white 0.55; translucency black 1.0, white 1.6; tint black `{ value: 0.14, hue: 0.06 }`, white `{ value: 0.14, hue: 0.1 }`). Update the key list in `index.test.ts`. Update `PLACEMENT_ORDER`.
- [ ] **Step 5: Visual check.** `npm run dev`; shots `?era=1975&cam=bank&t=12&c=95&freeze=1&q=medium` and `?era=1975&cam=ride&c=95&freeze=1&q=medium`. The bank behind the red fringe now shows two more greens (grey-green black, yellow-green white) and a broken, stepped canopy line, not one dark band. Tune rule numbers if a species is missing or smothers the others (keep `rules.test.ts` green). `npx vitest run && npm run build`.
- [ ] **Step 6: Commit** (`feat(vegetation): black and white mangrove`).

---

### Task 5: Buttonwood and sea grape (shrubs)

**Files:**
- Create: `src/vegetation/species/shrubs.ts`, `src/vegetation/species/shrubs.test.ts`
- Modify: `textures.ts` (`paintButtonwoodLeaves`, `paintSeaGrapeLeaves`), `species/index.ts` (+ test), `rules.ts` (`PLACEMENT_ORDER`)

**Interfaces:**
- Produces: `buildButtonwood(seed): PlantPart[]`, `buildSeaGrape(seed): PlantPart[]`, the two painters. `PLACEMENT_ORDER` becomes `['casuarina', 'coconut', 'blackMangrove', 'whiteMangrove', 'redMangrove', 'buttonwood', 'seaGrape']`.

Reference morphology (general botany):
- **Buttonwood:** multi-stemmed shrub or small tree 2–5 m (tests allow 1.5–6), often leaning or sprawling; dark, rough bark; dense crown of narrow pointed leaves; the coastal form is **silvery-green** (silver buttonwood), greyer and lighter than the mangroves.
- **Sea grape:** sprawling shrub 1–3 m (tests allow 0.8–4) on the beach, wider than tall (crown width ≥ 1.3 × height); stiff, crooked grey stems; very large **round leathery leaves** (15–25 cm) with red-pink veins, some leaves turning red; open crown with visible stems.

- [ ] **Step 1: Tests.** Same checks as Task 4 (parts, aFlex, attributes, NaN, unit normals, determinism) + height ranges above; triangle count < 2500 each; sea grape: horizontal bounding extent ≥ 1.3 × height.
- [ ] **Step 2: Generators.** Buttonwood: 2–4 stems from the base leaning out 10–35°, crown of 60–80 cards (0.6–1.0 m) in 1–3 overlapping ellipsoids. Sea grape: 3–6 crooked low stems spreading sideways, 50–70 cards (0.7–1.1 m) placed near the stem tips, facing mostly up and out; about 10 % of cards get a red vertex tint.
- [ ] **Step 3: Textures.** Buttonwood — narrow pointed leaves, silvery grey-green (~#8c9a7a) with a light sheen. Sea grape — few, large round leaves filling the card, olive-green (~#5d7a2e) with reddish veins, some fully red (~#8a3a28).
- [ ] **Step 4: Registry and order.** Buttonwood foliage roughness 0.75, translucency 1.0, tint `{ value: 0.12, hue: 0.05 }`; sea grape roughness 0.5 (glossy, leathery), translucency 1.4, tint `{ value: 0.14, hue: 0.1 }`. Update key list and `PLACEMENT_ORDER`.
- [ ] **Step 5: Visual check.** `?era=1986&cam=mouth&t=6.4&c=0&freeze=1&q=medium` (sea grape along the beach, below the casuarinas) and `?era=1975&cam=aerial&t=12&c=95&freeze=1&q=medium` (buttonwood band behind the mangroves). `npx vitest run && npm run build`.
- [ ] **Step 6: Commit** (`feat(vegetation): buttonwood and sea grape`).

---

### Task 6: Almendro (*Terminalia catappa*)

**Files:**
- Create: `src/vegetation/species/almendro.ts`, `src/vegetation/species/almendro.test.ts`
- Modify: `textures.ts` (`paintAlmondLeaves`), `species/index.ts` (+ test), `rules.ts` (`PLACEMENT_ORDER`)

**Interfaces:**
- Produces: `buildAlmendro(seed): PlantPart[]`, `paintAlmondLeaves()`. `PLACEMENT_ORDER` becomes `['casuarina', 'almendro', 'coconut', 'blackMangrove', 'whiteMangrove', 'redMangrove', 'buttonwood', 'seaGrape']` (the spec order).

Reference morphology (general botany): 8–15 m (tests allow 6–16); straight trunk; branches in **horizontal tiers** (whorls) from the trunk, giving a pagoda-like layered crown wider than tall at the top; large obovate leaves (15–25 cm) clustered at branch tips; glossy dark green, with **some leaves red/orange/yellow** before they fall.

- [ ] **Step 1: Tests.** Same checks as Task 4; height range above; triangle count < 3500; tiers: at least 3 distinct clusters of foliage-card heights (bin card centres by 0.5 m; ≥ 3 bins with ≥ 10 cards separated by an empty bin).
- [ ] **Step 2: Generator.** Trunk tube to 55–70 % of the height; 3–5 tiers, each 4–6 near-horizontal branches (upturned tips) spaced ~1.2–1.8 m apart vertically, shorter toward the top; leaf cards (0.9–1.4 m) in flat rosettes at the branch tips; 12–18 % of cards get a red-orange vertex tint.
- [ ] **Step 3: Texture.** Large obovate leaves in rosettes, glossy dark green (~#2f5a1e) with pale midribs; transparent background.
- [ ] **Step 4: Registry and order.** Foliage roughness 0.55, translucency 1.3, tint `{ value: 0.12, hue: 0.1 }`. Update key list and `PLACEMENT_ORDER`.
- [ ] **Step 5: Visual check.** `?era=1925&cam=bank&c=70&freeze=1&q=medium` — a few layered almond trees on the banks near the landings and town, none inside the clearings; `?era=1840&cam=bank&freeze=1&q=medium` shows fewer. `npx vitest run && npm run build`.
- [ ] **Step 6: Commit** (`feat(vegetation): almendro`).

---

### Task 7: Ground cover — clumps, tiles around the camera, fade

**Files:**
- Create: `src/vegetation/species/groundClumps.ts` (+ test), `src/vegetation/ground/tiles.ts` (+ test), `src/vegetation/ground/GroundCover.tsx`
- Modify: `textures.ts` (`paintGrassBlades`, `paintReedStems`, `paintVineLeaves`), `windMaterial.ts` (fade option), `Vegetation.tsx`

**Interfaces:**
- Consumes: `placeSpecies` with `bounds` + `blocked`; `GROUND_ORDER`; `Occupancy`; `QualitySettings.veg.groundRadius`; `reflectionHooks`; `makePlantMaterials`; `composeInstanceMatrices`.
- Produces:
  - `buildGrassClump(seed): THREE.BufferGeometry`, `buildReedClump(seed)`, `buildVineClump(seed)` — one geometry each (crossed cards, `aFlex`, `uv`, `normal`, `color`).
  - `GROUND_TILE = 32`; `tileKey(i: number, j: number): string`; `tilesInRadius(cx: number, cz: number, r: number, tile: number): [number, number][]` (tile indices whose square touches the disc, nearest first).
  - `TileCache` class: `constructor(place: (i: number, j: number) => Record<GroundId, PlantInstance[]>, max = 256)`; `get(i, j)`; `clear()`. LRU by insertion order.
  - `PlantMaterialOpts.fade?: { radius: THREE.IUniform<number> }`.
  - `<GroundCover fields masks densities trunks radius />`.

- [ ] **Step 1: Tile tests.** `src/vegetation/ground/tiles.test.ts`:

```ts
import { expect, test } from 'vitest';
import { TileCache, tileKey, tilesInRadius } from './tiles';

test('tilesInRadius covers the disc, nearest first, nothing far outside', () => {
  const t = tilesInRadius(10, 10, 60, 32);
  expect(t[0]).toEqual([0, 0]);
  for (const [i, j] of t) {
    const nx = Math.max(i * 32, Math.min(10, (i + 1) * 32)), nz = Math.max(j * 32, Math.min(10, (j + 1) * 32));
    expect(Math.hypot(nx - 10, nz - 10)).toBeLessThanOrEqual(60);
  }
  expect(t.length).toBeGreaterThan(12); expect(t.length).toBeLessThan(40);
});
test('TileCache places each tile once and evicts the oldest', () => {
  let calls = 0;
  const c = new TileCache(() => { calls++; return { grass: [], reeds: [], morningGlory: [] }; }, 2);
  c.get(0, 0); c.get(0, 0); c.get(1, 0); c.get(2, 0); c.get(0, 0);
  expect(calls).toBe(4);
  expect(tileKey(-1, 3)).toBe('-1,3');
});
```
Run — Expected: FAIL. Implement `tiles.ts` (pure, ~40 lines: loop over the tile index range covering the disc's bounding box, keep tiles whose nearest point is within `r`, sort by squared distance of tile centre; `TileCache` wraps a `Map` and deletes the first key when `size > max`). Run — Expected: PASS.

- [ ] **Step 2: Clump geometry tests.** `groundClumps.test.ts`: for each builder × seeds 1–4: has `position`, `normal`, `uv`, `color`, `aFlex` (0 at the base, ≤ 1); height: grass 0.3–0.9 m, reeds 0.9–2.2 m, vine 0.05–0.35 m; triangles ≤ 24; deterministic. Implement: grass — 3 crossed cards (0.6–0.9 m wide) around the centre, leaning out 5–15°; reeds — 3 taller, narrower cards; vine — 3–4 cards lying almost flat (tilted 10–20° up) radiating out 0.6–1.0 m. `aFlex = uv.y` (vine: `0.3·uv.y`). Normals: blend of card normal and +Y (60 % up) so clumps shade like the ground.
- [ ] **Step 3: Textures.** `paintGrassBlades` 256×256: 40–60 tapered blades from the bottom edge, olive to straw green (~#6b7a34…#a09a55), a few dry tips; `paintReedStems` 128×512: 12–20 thin stems with a few leaf blades and 2–3 seed heads, green-brown; `paintVineLeaves` 256×256: a trailing stem with 8–12 two-lobed leaves (~#3f6b2a) and 1–2 pink-purple flowers (~#c05a9a).
- [ ] **Step 4: Fade.** Add to `makePlantMaterials`: when `opts.fade` is set, add uniform `uFadeR` (the passed `IUniform`) and in the foliage fragment, before writing `csm_DiffuseColor`:

```glsl
    float fd = distance(vPlantW.xz, cameraPosition.xz);
    float fk = 1.0 - smoothstep(uFadeR * 0.8, uFadeR, fd);
    // 4×4 ordered dither: no sorting, no hard edge.
    vec2 q = mod(floor(gl_FragCoord.xy), 4.0);
    float bayer = (mod(q.x + 2.0 * q.y, 4.0) * 4.0 + mod(q.x * 3.0 + q.y, 4.0) + 0.5) / 16.0;
    if (fk < bayer) discard;
```
Add a case to `windMaterial.test.ts`: with `fade: { radius: { value: 45 } }` the material's `uniforms.uFadeR.value` is 45.

- [ ] **Step 5: `GroundCover.tsx`.** One component for all three ground ids:
  - Props: `fields: WorldFields` (the 512 placement fields), `masks: VegMasks`, `densities: Record<GroundId, number>`, `trunks: Occupancy`, `radius: number`.
  - Per id: one `THREE.InstancedMesh` of the clump geometry (3 variants → 3 meshes per id, variant from `PlantInstance.variant`), capacity `CAP = 6000` per mesh; material `makePlantMaterials({ part: 'foliage', map, color: 0xffffff, roughness: 0.9, alphaTest: 0.5, translucency: 1.5, vertexColors: true, fade: { radius: fadeR } })` with the painted texture through `foliageTexture`; `castShadow = false`, `receiveShadow = true`, `frustumCulled = false`.
  - A `TileCache` whose place function calls `placeSpecies(fields, masks, id, { density: densities[id], seed: 1840, blocked: trunks, bounds: [x0, z0, x0 + GROUND_TILE, z0 + GROUND_TILE] })` for each id, with `x0 = i * GROUND_TILE`. Recreate the cache when `fields`, `masks`, `densities` or `trunks` change.
  - `useFrame`: same refresh rule as `InstancedSpecies` (every 0.25 s while moving, at once after an 8 m move). On refresh: `tilesInRadius(cam.x, cam.z, radius, GROUND_TILE)`; place at most **6 uncached tiles per frame** (nearest first — the rest next frame) to avoid hitches; write matrices for instances within `radius` into the meshes (reuse one scratch `Float32Array`; clamp at `CAP`); `commit` the update range; set `count`.
  - Reflection: register `reflectionHooks.before` → all ground meshes `visible = false`; `after` → restore.
  - Dispose meshes, materials and textures on unmount.
  - Dev stats: add `ground` counts to `vegTiming.counts`.
- [ ] **Step 6: Mount.** In `Vegetation.tsx`: create `const trunks = new Occupancy(pf.grid, 1)` inside the placement memo, pass it to the near `placeAll(..., { trunks })`, and return it with the sets (cache it in the same `KeyedCache` entry). Compute `groundDens: Record<GroundId, number>` from `era.vegetation[id].value * density`. Render `<GroundCover fields={pf} masks={masksFor(pf)} densities={groundDens} trunks={trunks} radius={q.veg.groundRadius} />` (keep `pf` in the memo result so the same object is passed).
- [ ] **Step 7: Check.** `npx vitest run && npm run build`. `npm run dev`; shots at `?era=1975&cam=bank&t=12&c=95&freeze=1&q=high` and the `mouth` dawn shot: grass on open land near the camera, reeds at the wet river edges, vines on the beach sand, none in the landing clearings, soft fade at the radius (no ring), nothing in the reflection. Then `npm run build && npm run preview` and repeat the Task 1 perf commands; write the numbers in the rulings note. If any tier is below baseline: lower that tier's `groundRadius` or raise ground `spacing` and re-measure; record the change as a ruling.
- [ ] **Step 8: Commit** (`feat(vegetation): ground cover — grass, reeds, beach morning glory`).

---

### Task 8: Far ground tint (cover map)

**Files:**
- Create: `src/vegetation/coverMap.ts`, `src/vegetation/coverMap.test.ts`
- Modify: `src/scene/groundUniforms.ts`, `src/scene/terrainMaterial.ts`, `src/vegetation/Vegetation.tsx`

**Interfaces:**
- Consumes: `RULES`, `siteAt`-style sampling (export `siteAt` from `placement.ts`), `VegMasks`, `WorldFields`.
- Produces: `coverMap(f: WorldFields, m: VegMasks, dens: Record<GroundId, number>, size = 256): Uint8Array` — RGBA per texel: R = grass, G = reeds, B = morning glory weight (0–255, each `rule.density(site) · dens[id] · (1 − site.clear)`), A = 255. `groundUniforms.uCover` (texture) and `uCoverRect` (vec4: minX, minZ, extent, 0), `NO_COVER` (1×1 black).

- [ ] **Step 1: Failing test.** `coverMap.test.ts`: build fields (`extent 2560, size 256`) and masks as in `placement.test.ts`; `const c = coverMap(f, m, { grass: 1, reeds: 1, morningGlory: 1 })`; expect length `256·256·4`; at the texel under `SEA_SEED` (from `terrain/fields`) all three are 0; the grass channel has > 5 % non-zero texels; `coverMap(f, m, { grass: 0, reeds: 0, morningGlory: 0 })` is all zero in RGB. Run — Expected: FAIL.
- [ ] **Step 2: Implement** by sampling the site at each texel centre (export `siteAt` from `placement.ts`, unchanged). Run — Expected: PASS.
- [ ] **Step 3: Upload.** In `Vegetation.tsx`, in the same effect style as the litter texture: build the `DataTexture` (RGBA, linear filter, clamp), set `groundUniforms.uCover` / `uCoverRect`, restore `NO_COVER` on cleanup.
- [ ] **Step 4: Terrain shader.** In `terrainMaterial.ts` declare `uniform sampler2D uCover; uniform vec4 uCoverRect;`, sample it like the litter (with the in-rect mask), and after the litter mix:

```glsl
        vec4 cov = texture2D(uCover, cu) * inC;
        vec3 vine = mix(vec3(0.10,0.20,0.05), vec3(0.16,0.27,0.07), n3);
        float vineP = cov.b * smoothstep(0.45, 0.7, snoise(vW.xz * 0.35) * 0.5 + 0.5);   // patches on the sand
        c = mix(c, vine, 0.8 * vineP);
        vec3 reed = mix(vec3(0.12,0.17,0.05), vec3(0.20,0.22,0.09), n2);
        c = mix(c, reed, 0.6 * cov.g * (1.0 - m.r));
        c *= mix(1.0, mix(0.92, 1.06, n3), cov.r);                                        // grass: slight tuft mottling
```
- [ ] **Step 5: Check.** `aerial` noon and `mouth` dawn shots: green vine patches on the beach sand, darker reed band at wet edges, matching the near clumps' positions. `npx vitest run && npm run build`.
- [ ] **Step 6: Commit** (`feat(vegetation): ground-cover tint in the terrain`).

---

### Task 9: Palm skyline — uneven groups and gaps

**Files:**
- Modify: `src/vegetation/rules.ts` (coconut), `src/vegetation/placement.ts` (second noise octave, optional), `src/vegetation/placement.test.ts`

- [ ] **Step 1: Failing test.** Add a Clark–Evans clustering test (R = mean nearest-neighbour distance ÷ expected for a random pattern, 0.5/√density; R ≈ 1 random, < 1 clustered, > 1 even):

```ts
  test('palms stand in groups with gaps, not in even rows (Clark–Evans R < 0.8)', () => {
    const p = all.coconut;
    let sum = 0;
    for (const a of p) { let d = Infinity; for (const b of p) if (a !== b) d = Math.min(d, Math.hypot(a.x - b.x, a.z - b.z)); sum += d; }
    const xs = p.map((q) => q.x), zs = p.map((q) => q.z);
    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
    const R = (sum / p.length) / (0.5 / Math.sqrt(p.length / area));
    expect(R).toBeLessThan(0.8);
  });
```
Run and **write the current R into the rulings note** (baseline). Expected: FAIL (the jittered grid makes R near or above 1).
- [ ] **Step 2: Fix.** For coconut: clump `{ scale: 70, strength: 1, size: 0.08 }`, and add a `clump.octave?: number` rule field (a second value-noise lattice at `scale / 3`, multiplied in: `cn = cn * (0.6 + 0.8 * valueNoise(x, z, cs / 3, noiseSeed + 17))`, clamped to [0, 1]) set to `1` for coconut only. Keep total palm count within ±25 % of before (add an assertion comparing to `> 300` — the existing count test already bounds it).
- [ ] **Step 3: Check.** Test passes. Shot `?era=1986&cam=mouth&t=6.4&c=0&freeze=1&q=medium`: the palm line on the skyline breaks into groups with sky between them. `npx vitest run && npm run build`.
- [ ] **Step 4: Commit** (`fix(vegetation): palms in uneven groups`).

---

### Task 10: Noon colour — warm and natural, not teal

**Files:**
- Modify: `src/geo/atmosphere.ts`, `src/geo/atmosphere.test.ts`, `src/scene/post/Post.tsx`
- Create: `scripts/dev/hue.mjs` (dev helper)

- [ ] **Step 1: Measure.** Write `scripts/dev/hue.mjs` (same launch/goto/ready code as `shot.mjs`): take `page.screenshot()`, pass the PNG as base64 into `page.evaluate`, decode it there with `createImageBitmap` onto a canvas, `getImageData`, convert sRGB → linear, and print the mean linear R, G, B of the lower half (land + water) and the upper third (sky). Run for `?era=1975&cam=bank&t=12&c=95&freeze=1&q=medium` and for the golden-hour default. Write both into the rulings note. Teal = G and B both above R in the lower half.
- [ ] **Step 2: Failing test.** Add to `atmosphere.test.ts`:

```ts
test('noon haze is near-neutral, not teal', () => {
  const a = atmosphereFor(60);
  expect(a.fogColor[1] / a.fogColor[0]).toBeLessThan(1.1);
  expect(a.fogColor[2] / a.fogColor[0]).toBeLessThan(1.25);
});
```
Run — Expected: FAIL (`fogDay` high = `[0.62, 0.74, 0.88]`).
- [ ] **Step 3: Fix.** Change the high-sun end of `fogDay` to `[0.74, 0.78, 0.86]` and of `fogAway` to `[0.6, 0.66, 0.8]`. In `Post.tsx` make the grade balance follow the sun: `grade.set(sun.atm.exposure, sun.atm.balance, sun.atm.saturation)`; add `balance: RGB` and `saturation: number` to `Atmosphere` — golden `[1.06, 1.0, 0.9]`, high sun `[1.04, 1.0, 0.94]` (mix by `high`), saturation golden 1.15 → high 1.05. Test: `atmosphereFor(6).balance` equals the old constant (golden hour must not change).
- [ ] **Step 4: Check.** Re-run `hue.mjs` for noon and golden: noon lower-half R ≥ B and G/R ≤ 1.15; golden numbers within ±3 % of before. Compare noon shots with `phase2b-before/*noon*.png`: foliage greens, sand warm, water blue, no teal cast. `npx vitest run && npm run build`.
- [ ] **Step 5: Commit** (`fix(look): warm, neutral noon grade`).

---

### Task 11: Blocky reflection of the plant edge on medium

**Files:**
- Modify: `src/scene/water/Water.tsx` and/or `src/quality.ts`; rulings note

This task starts with an investigation (use superpowers:systematic-debugging). The fix must not lower the medium frame rate below baseline.

- [ ] **Step 1: Reproduce.** `?era=1975&cam=bank&t=12&c=95&freeze=1&q=medium` vs the same at `q=high`; zoom on the reflected fringe with the browser tool. Write down which it is: (a) low reflection resolution (`reflScale` 0.35 → texel stair-steps), (b) nearest/no-mip sampling of the reflection target, (c) card alpha-test aliasing in the reflection pass.
- [ ] **Step 2: Try in this order, measuring medium fps each time (`perf.mjs "?cam=ride&q=medium" 10 1.5`):**
  1. Linear filtering + a 4-tap blur (or a 2-tap box along the ripple normal) on the reflection sample in the water shader — cheap, hides stair-steps.
  2. If still blocky: `reflScale` medium 0.35 → 0.42.
  3. If card edges shimmer: `alphaToCoverage` is not available without MSAA — instead lower the card `alphaTest` in the reflection pass only (hook `before`/`after`) from 0.5 to 0.35.
- [ ] **Step 3: Check.** Before/after crops of the reflected fringe in the rulings note; medium fps ≥ baseline. `npx vitest run && npm run build`.
- [ ] **Step 4: Commit** (`fix(water): smooth reflected plant edge on medium`).

---

### Task 12: Integration, performance, fact check, phase gate

**Files:**
- Modify: `tests/e2e/world.spec.ts`, `tests/snapshots/README.md`, `README.md`, `docs/superpowers/notes/phase-2b-rulings.md`, `docs/superpowers/specs/2026-09-26-ancon-loiza-design.md` (§12 line only if something changed)

- [ ] **Step 1: E2E.** In `world.spec.ts` change the snapshot folder to `tests/snapshots/phase2b/` and add two noon shots: `{ era: '1975', cam: 'bank', t: 12, c: 95, name: '1975-bank-noon' }`, `{ era: '1840', cam: 'bank', t: 12, c: 95, name: '1840-bank-noon' }`. README (snapshots): `phase3/` becomes frozen; `phase2b/` is now written by the spec. Run `npm run e2e` — Expected: all pass, no console errors.
- [ ] **Step 2: Performance.** `npm run build && npm run preview`; the five Task 1 perf commands. Every tier ≥ baseline (−1 fps noise allowed). Record startup placement + bake (`window.__ANCON_VEG__` in `?debug=1`) — cold start < 2 s on high. If below, tune in this order: ground `spacing`, `groundRadius`, woody density per tier; record each change as a ruling.
- [ ] **Step 3: Before/after.** Take the six Task 1 shots again into `tests/snapshots/phase2b/after-*.png`; put a side-by-side list in the rulings note (one line each: what changed).
- [ ] **Step 4: Fact check.** Dispatch a review agent with: the new era values in `eras.ts` (species, density, sources, confidence, inferred) and the habitat comments in `rules.ts`; research §5 and `src/data/sources.ts`; instruction to open each cited source and flag any claim the source does not support. Only flagged items go to the user.
- [ ] **Step 5: Code review** of the whole branch (superpowers:requesting-code-review). Fix Important items; log minor ones in the rulings note under `## Deferred`.
- [ ] **Step 6: Ship.** README roadmap: Phase 2 "2a, 2b done; 2c next". `npx vitest run && npm run build && npm run e2e`. Commit (`feat(vegetation): phase 2b gate`), push the branch (never `main`). Ask the user to approve the merge.

---

## Self-review

- **Spec coverage:** §2 species table → Tasks 2 (data/rules), 4–6 (woody), 7 (ground). §2 placement order → Tasks 4–6 append; ground cover blocked by trunks → Task 2 `trunks`/`blocked`. Clearings → `Site.clear` in `placeSpecies` (unchanged, covered by the existing clearing test; ground tiles use the same path). §3.1 → Tasks 4–6 reuse `InstancedSpecies`. §3.2 → Task 7 (radius per tier, 20 % dither fade, no shadow, no reflection, wind via `makePlantMaterials`, 512 grid via `pf`, `veg.density`). §3.3 → Task 8. §4.1 → Tasks 3 + 4; §4.2 → Task 9; §4.3 → Task 10; §4.4 → Task 11. §5 → Tasks 1, 7, 12. §6 → unit tests per task, screenshots Tasks 1/12, fact check + review Task 12. §7 → Task 12 gate.
- **Spec note:** the spec's "latent items fixed on the way (impostor bake dispose order)" is already fixed on main (`InstancedSpecies` clears `bakes` before disposing). No task needed.
- **Names checked:** `WoodyId`/`GroundId`/`SpeciesId`, `PLACEMENT_ORDER` (woody) / `GROUND_ORDER`, `PlaceOpts.bounds`/`blocked`, `placeAll(..., { trunks })`, `SpeciesRule.trunk`, `veg.groundRadius`, `FoliageMaterial.tint`, `PlantMaterialOpts.tint`/`fade`, `GROUND_TILE`, `tilesInRadius`, `TileCache`, `coverMap`, `groundUniforms.uCover`/`uCoverRect`/`NO_COVER`, `Atmosphere.balance`/`saturation` are used the same way in every task.
