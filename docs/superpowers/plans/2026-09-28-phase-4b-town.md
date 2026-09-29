# Phase 4b — The town Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per era, show the houses of Loíza Aldea on the east bank (real OSM outlines within 350 m of the east landing, styled and counted by era), the San Patricio church in full, the plaza as open ground with trees, and the town streets next to the shown houses as ground paint.

**Architecture:** The bake adds building and park outlines to `loiza.json`. A new `src/town/` folder holds pure units: `layout.ts` turns outlines into ranked lots (fixed across eras), `town.ts` picks one era's houses, looks, streets, dirt and plaza trees, and `houseMesh.ts` / `church.ts` add pieces to the 4a `PartBuilder`s (one merged mesh per material). `Town.tsx` mounts the meshes; `Infrastructure.tsx` adds the town streets and dirt to the 4a ground mask; `Vegetation.tsx` keeps plants out of houses, church and plaza and adds the plaza trees.

**Tech Stack:** three 0.186, R3F 9, zustand, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-28-phase-4b-town-design.md` · Previous: `docs/superpowers/specs/2026-09-28-phase-4a-ferry-place-design.md` · Research: `docs/research/ancon-research.md` §1, §7, §9

## Global Constraints

- World frame: 1 unit = 1 m; +X east, +Y up, +Z south. `WATER_Y = 0`.
- Frame rule (user ruling 2026-09-28): build only what the `ride` camera shows. Outlines only within **350 m** of the east landing; no west-bank houses; plaza = open ground + trees only (no benches, lamps, kiosk). No content "for completeness".
- The station, landings, bridge and cane fields do not change. Plants change only in two ways: none inside a shown house, the church or the plaza; 6–10 plaza trees (almendro, coconut).
- Every era value is `Sourced` (`sources` + `confidence`); guesses set `inferred: true`. Source IDs must exist in `src/data/sources.ts`.
- All geometry and textures are made in code. No downloaded files. The bake uses the cached `scripts/.cache/osm.xml`.
- Budget, any era: at most **8 draw calls** from 4b (plus shadow twins) and **40 000 triangles**. Town streets add **0** triangles.
- Frame rate on every tier stays within **5 %** of the Task 1 baseline mean frame time.
- Builders are deterministic (same inputs ⇒ same geometry). A house shown in one era is shown in every later era; a house's look only moves hut → wood → concrete.
- Branch `phase-4b-town` (already created; the spec is committed on it). Never push to `main`. Merge only after the user approves.
- Commit message bodies end, after a blank line, with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File map

```
docs/superpowers/notes/phase-4b-rulings.md        baseline numbers, rulings, deferred items (new)
tests/snapshots/phase4b-before/, phase4b/         baseline and after screenshots (new)
tests/e2e/world.spec.ts                           default SNAP_DIR phase4b, 4b shots
src/state/url.ts, src/scene/Cameras.tsx           `town` dev camera preset
scripts/osm-parse.ts (+ test), scripts/bake-osm.ts  building + park outlines in the town circle
src/data/geo/types.ts, README.md, loiza.json (+ test)  bundle gains `buildings`, `parks`
src/data/eras.ts (+ eras.test.ts)                 `town` shares per era
src/town/constants.ts                             town circle (new)
src/town/layout.ts (+ test)                       rectangles, lots, church plan, plaza (new)
src/town/town.ts (+ test)                         one era's town (new)
src/infrastructure/roads.ts (+ test)              PR-951 gate spares town streets
src/town/houseMesh.ts (+ test)                    house geometry (new)
src/town/church.ts (+ test)                       church geometry (new)
src/town/build.ts (+ test)                        one era's meshes + budget (new)
src/town/Town.tsx                                 meshes (new)
src/scene/World.tsx                               mounts <Town>
src/infrastructure/Infrastructure.tsx             town streets + dirt in the ground mask
src/vegetation/Vegetation.tsx                     town skip + plaza trees
```

---

### Task 1: Dev camera, shot list, baseline

**Files:**
- Modify: `src/state/url.ts:5-6`, `src/scene/Cameras.tsx` (after the `bridge` pose, line 28), `tests/e2e/world.spec.ts`
- Create: `docs/superpowers/notes/phase-4b-rulings.md`, `tests/snapshots/phase4b-before/*.png`

**Interfaces:**
- Produces: camera preset `'town'` (URL `?cam=town`); `world.spec.ts` default folder `phase4b`.

- [ ] **Step 1: Check the branch**

```bash
git branch --show-current
```

Expected: `phase-4b-town`.

- [ ] **Step 2: Add the `town` preset**

`src/state/url.ts`:

```ts
export type CameraPreset = 'ride' | 'bank' | 'aerial' | 'mouth' | 'fields' | 'farm' | 'station' | 'bridge' | 'town';
export const CAMERA_PRESETS: CameraPreset[] = ['ride', 'bank', 'aerial', 'mouth', 'fields', 'farm', 'station', 'bridge', 'town'];
```

`src/scene/Cameras.tsx`, in `CAMERA_POSES` after `bridge`:

```ts
  // Dev view (phase 4b): low over the river, looking past the station at the town and church (≈ 285, 171).
  town: { pos: [ex * 0.3, 5, ez * 0.3], target: [285, 6, 171] },
```

- [ ] **Step 3: Check the view**

Run `npm run dev` and open `http://localhost:5173/ancon-de-loiza/?era=1975&cam=town&t=12&freeze=1&q=medium` in the Browser pane. Expected: the east bank behind the station fills the frame (where the town will stand). If not, change `pos`/`target` until it does and write the final numbers in the rulings note.

- [ ] **Step 4: Snapshot folder and 4b shots**

In `tests/e2e/world.spec.ts` change the default folder:

```ts
/** Output folder under tests/snapshots (SNAP_DIR=phase4b-before for the baseline run). */
const DIR = `tests/snapshots/${process.env.SNAP_DIR ?? 'phase4b'}`;
```

Append to `SHOTS`:

```ts
  // Phase 4b: the town from the river.
  { era: '1840', cam: 'town', t: 12, c: 95, name: '1840-town-noon' },          // thatched huts round the church
  { era: '1925', cam: 'town', t: 12, c: 95, name: '1925-town-noon' },          // wood on zocos, thatch and zinc
  { era: '1959', cam: 'town', t: golden('1959'), c: 95, name: '1959-town' },   // zinc roofs, first concrete
  { era: '1986', cam: 'town', t: 12, c: 95, name: '1986-town-noon' },          // mostly concrete
```

- [ ] **Step 5: Baseline screenshots**

```bash
SNAP_DIR=phase4b-before npx playwright test tests/e2e/world.spec.ts
```

Expected: all pass; PNGs in `tests/snapshots/phase4b-before/`.

- [ ] **Step 6: Baseline frame rate**

```bash
npm run build && npm run preview
```

In a second shell, run each query with `node scripts/dev/perf.mjs "<query>" 10 2` (for `q=low` use dpr `1`) and record the JSON lines:

- `?era=1975&cam=ride&t=17&c=95&freeze=1&q=high`
- `?era=1984&cam=ride&t=17&c=95&freeze=1&q=high`
- `?era=1975&cam=bank&t=12&c=5&freeze=1&q=high`
- the same three with `q=medium`, and with `q=low`

- [ ] **Step 7: Rulings note**

Create `docs/superpowers/notes/phase-4b-rulings.md`:

```markdown
# Phase 4b rulings and notes

Spec: `docs/superpowers/specs/2026-09-28-phase-4b-town-design.md`. Plan: `docs/superpowers/plans/2026-09-28-phase-4b-town.md`.

## Baseline (Task 1)

`town` camera: pos […], target […].

| query | tier | fps | mean ms | p95 ms |
|---|---|---|---|---|

## Rulings

- Houses keep off every road in the town circle (story roads, main roads and town streets), not only the story roads the spec names: a house on painted street reads as a bug.
- Overlaps between lots are tested with the concrete (largest) size in every era, so a house never disappears when it turns concrete.

## Deferred
```

Fill the table with the Step 6 numbers.

- [ ] **Step 8: Unit tests, commit**

```bash
npm test
git add src/state/url.ts src/scene/Cameras.tsx tests/e2e/world.spec.ts tests/snapshots/phase4b-before docs/superpowers/notes/phase-4b-rulings.md
git commit -m "chore(4b): town dev camera, 4b shot list, baseline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Building and park outlines in the geo bundle

**Files:**
- Modify: `scripts/osm-parse.ts`, `scripts/osm-parse.test.ts`, `scripts/bake-osm.ts`, `src/data/geo/types.ts`, `src/data/geo/README.md`, `src/data/geo/loiza.test.ts`, `src/data/geo/loiza.json` (regenerated)

**Interfaces:**
- Produces: `GeoBundle.buildings: Outline[]`, `GeoBundle.parks: Outline[]`, with `interface Outline { id: string; kind: string; name?: string; ring: XZ[] }` (ring without the closing node). `parseOsm(xml, keepRoadsWithin, town?: { c: XZ; r: number })`.

- [ ] **Step 1: Failing parser test**

Append to `scripts/osm-parse.test.ts` (add `import { project } from '../src/geo/project';` at the top):

```ts
const TOWN_XML = `<?xml version="1.0"?><osm>
<node id="1" lat="18.4340" lon="-65.8820"/><node id="2" lat="18.4340" lon="-65.8819"/>
<node id="3" lat="18.4341" lon="-65.8819"/><node id="4" lat="18.4341" lon="-65.8820"/>
<node id="5" lat="18.4000" lon="-65.8000"/><node id="6" lat="18.4000" lon="-65.7999"/><node id="7" lat="18.4001" lon="-65.7999"/>
<way id="40"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/><tag k="building" v="church"/></way>
<way id="41"><nd ref="5"/><nd ref="6"/><nd ref="7"/><nd ref="5"/><tag k="building" v="yes"/></way>
<way id="42"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="leisure" v="park"/><tag k="name" v="Plaza"/></way>
<way id="43"><nd ref="1"/><nd ref="2"/><tag k="building" v="yes"/></way>
</osm>`;

test('keeps closed building and park outlines inside the town circle only', () => {
  const g = parseOsm(TOWN_XML, 2000, { c: project(18.434, -65.882), r: 350 });
  expect(g.buildings.map((b) => [b.id, b.kind])).toEqual([['40', 'church']]);   // 41 far away, 43 not closed
  expect(g.buildings[0].ring).toHaveLength(4);
  expect(g.parks).toMatchObject([{ id: '42', kind: 'park', name: 'Plaza' }]);
  expect(parseOsm(TOWN_XML, 2000).buildings).toEqual([]);   // no circle, no outlines
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run scripts/osm-parse.test.ts`
Expected: FAIL (`buildings` is undefined).

- [ ] **Step 3: Types**

`src/data/geo/types.ts`, add and extend:

```ts
/** A closed OSM outline (ring without the closing node): a building (`kind` = its building tag) or a park. */
export interface Outline { id: string; kind: string; name?: string; ring: XZ[] }
export interface GeoBundle {
  origin: { lat: number; lon: number };
  water: { kind: 'river' | 'pond'; ring: XZ[] }[];
  land: { kind: LandKind; ring: XZ[] }[];
  coastline: XZ[][];
  roads: Road[];
  /** Phase 4b: outlines whose centre lies within the town circle (bake-osm.ts). */
  buildings: Outline[];
  parks: Outline[];
}
```

- [ ] **Step 4: Parser**

`scripts/osm-parse.ts`: export the circle type, add the parameter, init the lists and keep the outlines. Change the signature and `out`:

```ts
export interface TownCircle { c: XZ; r: number }

export function parseOsm(xml: string, keepRoadsWithin: number, town?: TownCircle): GeoBundle {
```

```ts
  const out: GeoBundle = { origin: { ...ORIGIN }, water: [], land: [], coastline: [], roads: [], buildings: [], parks: [] };
  const inTown = (ring: XZ[]) => {
    if (!town) return false;
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    return Math.hypot(cx - town.c[0], cz - town.c[1]) <= town.r;
  };
```

In the way loop, right after `wayRings.set(w.id, { ring, closed });`:

```ts
    if (closed && (t.building || t.leisure === 'park')) {
      if (inTown(ring)) (t.building ? out.buildings : out.parks).push({ id: w.id, kind: t.building ?? 'park', ...(t.name ? { name: t.name } : {}), ring });
      continue;
    }
```

- [ ] **Step 5: Run the parser tests**

Run: `npx vitest run scripts/osm-parse.test.ts`
Expected: PASS (all three tests).

- [ ] **Step 6: Bake with the circle**

`scripts/bake-osm.ts`: add `import { project } from '../src/geo/project.ts';` and replace the parse and log lines:

```ts
// Town circle (spec 4b §1.1): 350 m round the east landing (landmarks.ts `eastLanding`, 18.4342 N 65.8815 W).
const geo = parseOsm(await readFile(CACHE, 'utf8'), 1600, { c: project(18.4342, -65.8815), r: 350 });
await writeFile(OUT, JSON.stringify(geo));
console.log(`water ${geo.water.length} · land ${geo.land.length} · coast ${geo.coastline.length} · roads ${geo.roads.length} · buildings ${geo.buildings.length} · parks ${geo.parks.length}`);
```

Run: `npm run bake`
Expected: `roads 263`, `buildings` about 120–130, `parks` ≥ 2 (the plaza and Paseo Julia de Burgos). Then check nothing else moved:

```bash
git show HEAD:src/data/geo/loiza.json > /tmp/old.json && node -e 'const a=require("/tmp/old.json"),b=require("./src/data/geo/loiza.json");for(const k of ["origin","water","land","coastline","roads"])console.log(k,JSON.stringify(a[k])===JSON.stringify(b[k]))'
```

Expected: `true` for all five.

- [ ] **Step 7: Bundle test and README**

Append to `src/data/geo/loiza.test.ts`:

```ts
test('has the town outlines: the church, the plaza and ~120 buildings (spec 4b §1.1)', () => {
  expect(g.buildings.find((b) => b.id === '430399958')?.kind).toBe('church');
  expect(g.parks.find((p) => p.id === '429703572')?.name).toMatch(/Sanjurjo/);
  expect(g.buildings.length).toBeGreaterThan(100);
  expect(g.buildings.length).toBeLessThan(150);
});
```

In `src/data/geo/README.md` change the kept-data sentence to: "which keeps the river and pond polygons, coastline, land cover and roads, and the building and park outlines within 350 m of the east landing (Phase 4b), and projects them to local metres".

- [ ] **Step 8: Run tests and types, commit**

Run: `npx vitest run scripts src/data && npx tsc -p tsconfig.json --noEmit`
Expected: PASS; no type errors.

```bash
git add scripts/osm-parse.ts scripts/osm-parse.test.ts scripts/bake-osm.ts src/data/geo
git commit -m "feat(4b): building and park outlines in the geo bundle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Era town shares

**Files:**
- Modify: `src/data/eras.ts`, `src/data/eras.test.ts`

**Interfaces:**
- Produces: `export interface TownShares { houseShare: Sourced<number>; concreteShare: Sourced<number>; thatchShare: Sourced<number> }`; `Era.town: TownShares`.

- [ ] **Step 1: Failing test**

In `src/data/eras.test.ts`, add to the `sourcedFields` list: `...(Object.values(e.town) as Sourced<unknown>[]),`. Add inside `describe('eras')`:

```ts
  test('town shares per era follow spec 4b §2', () => {
    const col = (k: 'houseShare' | 'concreteShare' | 'thatchShare') => ERAS.map((e) => e.town[k].value);
    expect(col('houseShare')).toEqual([0.25, 0.35, 0.45, 0.55, 0.7, 1, 1, 1]);
    expect(col('concreteShare')).toEqual([0, 0, 0, 0, 0.1, 0.5, 0.65, 0.65]);
    expect(col('thatchShare')).toEqual([1, 0.8, 0.5, 0.15, 0.05, 0, 0, 0]);
    for (let k = 1; k < ERAS.length; k++) {   // the town only grows, and looks only move hut → wood → concrete
      expect(ERAS[k].town.houseShare.value).toBeGreaterThanOrEqual(ERAS[k - 1].town.houseShare.value);
      expect(ERAS[k].town.concreteShare.value).toBeGreaterThanOrEqual(ERAS[k - 1].town.concreteShare.value);
      expect(ERAS[k].town.thatchShare.value).toBeLessThanOrEqual(ERAS[k - 1].town.thatchShare.value);
    }
    for (const e of ERAS) for (const v of Object.values(e.town)) expect(v.inferred).toBe(true);
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/data/eras.test.ts`
Expected: FAIL (`e.town` is undefined).

- [ ] **Step 3: Data**

In `src/data/eras.ts`, after the `Infrastructure` interface:

```ts
/**
 * Phase 4b town (spec 4b §2). Shares of the OSM outlines near the landing; all inferred (L): the old town
 * grows out from the church (1692: 100 houses [S12]; 1899: 833 residents [S16]); wooden casas on zocos with
 * zinc roofs from the 1930s and concrete from the 1960s are general PR vernacular (research §7).
 */
export interface TownShares {
  /** Share (0..1) of the lots shown, nearest the church first. */
  houseShare: Sourced<number>;
  /** Share (0..1) of shown houses in concrete with a flat roof. */
  concreteShare: Sourced<number>;
  /** Share (0..1) of shown houses that are thatched huts; the rest are painted wood with zinc roofs. */
  thatchShare: Sourced<number>;
}
```

Add `town: TownShares;` to `interface Era` after `infrastructure: Infrastructure;`. After the `INFRA` table:

```ts
// Phase 4b (spec 4b §2): all shares inferred; see TownShares.
const town = (house: number, concrete: number, thatch: number): TownShares => ({
  houseShare: s(house, ['S12', 'S16'], 'L', true), concreteShare: s(concrete, [], 'L', true), thatchShare: s(thatch, [], 'L', true),
});
const TOWN = {
  '1840': town(0.25, 0, 1), '1900': town(0.35, 0, 0.8), '1925': town(0.45, 0, 0.5), '1935': town(0.55, 0, 0.15),
  '1959': town(0.7, 0.1, 0.05), '1975': town(1, 0.5, 0), '1984': town(1, 0.65, 0), '1986': town(1, 0.65, 0),
} satisfies Record<EraId, TownShares>;
```

In each `ERAS` entry add `town: TOWN['<id>'],` after `infrastructure: INFRA['<id>'],` (eight entries).

- [ ] **Step 4: Run tests and types**

Run: `npx vitest run src/data && npx tsc -p tsconfig.json --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/data/eras.ts src/data/eras.test.ts
git commit -m "feat(4b): town shares per era

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Lots — outlines to ranked rectangles

**Files:**
- Create: `src/town/constants.ts`, `src/town/layout.ts`, `src/town/layout.test.ts`

**Interfaces:**
- Consumes: `GeoBundle.buildings/parks` (Task 2); `Footprint`, `corners`, `toWorld` from `src/infrastructure/parts.ts`; `LANDING_CLEARING` from `src/vegetation/masks.ts`; `cellRng` from `src/vegetation/rng.ts`.
- Produces (`constants.ts`): `CIRCLE_R = 350`, `TOWN_CENTRE: XZ`, `inTownCircle(points: readonly XZ[]): boolean`.
- Produces (`layout.ts`): `CHURCH_WAY`, `PLAZA_WAY`, `LOT`, `interface Lot { id; rank; u; p; outline; wood; concrete }` (Footprints), `interface LotRules { centre: XZ; church: XZ; clear: XZ; roads: { points: readonly XZ[]; half: number }[]; corridor: (x: number, z: number) => boolean }`, `interface ChurchPlan { fp: Footprint; front: 1 | -1 }`, `toLocal(f, x, z): [number, number]`, `orientedBox(ring): Footprint`, `rectsOverlap(a, b, pad?): boolean`, `inRing(ring, x, z): boolean`, `distToLine(points, x, z): number`, `centroid(ring): XZ`, `plazaRing(geo): XZ[]`, `churchPlan(geo): ChurchPlan`, `churchReach(p): Footprint`, `townLots(geo, rules): Lot[]`.

- [ ] **Step 1: Constants**

Create `src/town/constants.ts`:

```ts
import type { XZ } from '../data/geo/types';
import { landmarkXZ } from '../data/landmarks';

/** Spec 4b §1.1: only outlines within CIRCLE_R metres of the east landing are used (the bake keeps only these). */
export const CIRCLE_R = 350;
export const TOWN_CENTRE: XZ = landmarkXZ('eastLanding');
/** Does a polyline touch the town circle? */
export const inTownCircle = (points: readonly XZ[]) =>
  points.some(([x, z]) => Math.hypot(x - TOWN_CENTRE[0], z - TOWN_CENTRE[1]) <= CIRCLE_R);
```

- [ ] **Step 2: Failing tests**

Create `src/town/layout.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import geo from '../data/geo/loiza.json';
import type { GeoBundle, Outline, XZ } from '../data/geo/types';
import { corners, toWorld, type Footprint } from '../infrastructure/parts';
import { CHURCH_WAY, churchPlan, inRing, LOT, orientedBox, PLAZA_WAY, rectsOverlap, toLocal, townLots, type LotRules } from './layout';

const G = geo as unknown as GeoBundle;
const rect = (id: string, cx: number, cz: number, hx: number, hz: number, yaw = 0, kind = 'yes'): Outline =>
  ({ id, kind, ring: corners({ c: [cx, cz], yaw, hx, hz }) as XZ[] });
const bundle = (buildings: Outline[]): GeoBundle => ({
  origin: G.origin, water: [], land: [], coastline: [], roads: [],
  buildings: [rect(CHURCH_WAY, 0, 0, 15, 6, 0, 'church'), ...buildings],
  parks: [{ id: PLAZA_WAY, kind: 'park', ring: corners({ c: [40, 0], yaw: 0, hx: 10, hz: 10 }) as XZ[] }],
});
const rules: LotRules = {
  centre: [0, 0], church: [0, 0], clear: [0, 120],
  roads: [{ points: [[-200, -60], [200, -60]], half: 3 }], corridor: (x) => x < -150,
};

describe('rectangles', () => {
  test('orientedBox recovers a turned rectangle, long side on local X', () => {
    const f = orientedBox(corners({ c: [5, -3], yaw: 0.6, hx: 2, hz: 4 }) as XZ[]);
    expect(f.hx).toBeCloseTo(4); expect(f.hz).toBeCloseTo(2);
    expect(f.c[0]).toBeCloseTo(5); expect(f.c[1]).toBeCloseTo(-3);
  });
  test('toLocal undoes toWorld', () => {
    const f: Footprint = { c: [3, 4], yaw: 1.1, hx: 2, hz: 1 }, [x, z] = toWorld(f, 1.5, -0.5), [lx, lz] = toLocal(f, x, z);
    expect(lx).toBeCloseTo(1.5); expect(lz).toBeCloseTo(-0.5);
  });
  test('rectsOverlap', () => {
    const a: Footprint = { c: [0, 0], yaw: 0, hx: 2, hz: 2 };
    expect(rectsOverlap(a, { c: [3.5, 0], yaw: 0, hx: 2, hz: 2 })).toBe(true);
    expect(rectsOverlap(a, { c: [5, 0], yaw: 0, hx: 2, hz: 2 })).toBe(false);
    expect(rectsOverlap(a, { c: [5, 0], yaw: 0, hx: 2, hz: 2 }, 0.6)).toBe(true);
    expect(rectsOverlap(a, { c: [4.6, 0], yaw: Math.PI / 4, hx: 2, hz: 2 })).toBe(true);   // corner reaches in
  });
  test('inRing', () => {
    const ring = corners({ c: [0, 0], yaw: 0, hx: 1, hz: 1 }) as XZ[];
    expect(inRing(ring, 0.5, 0.5)).toBe(true); expect(inRing(ring, 1.5, 0)).toBe(false);
  });
});

describe('lots (synthetic)', () => {
  test('drops outlines on the clearing, a road, the corridor, the plaza and the church', () => {
    const ids = townLots(bundle([
      rect('keep', 0, 60, 4, 3),
      rect('clear', 0, 110, 4, 3),      // inside the landing clearing
      rect('road', 0, -58, 4, 3),       // on the road
      rect('corridor', -170, 0, 4, 3),  // in the bridge corridor
      rect('plaza', 40, 0, 3, 3),       // in the plaza
      rect('church', 0, 9, 3, 2),       // against the church (tower side)
      rect('far', 400, 0, 4, 3),        // outside the circle
    ]), rules).map((l) => l.id);
    expect(ids).toEqual(['keep']);
  });
  test('ranked nearest the church first; of two overlapping lots the lower rank stays', () => {
    const lots = townLots(bundle([rect('b', 0, 100 - 30, 4, 3), rect('a', 0, 40, 4, 3), rect('a2', 5, 40, 4, 3)]), { ...rules, clear: [0, 400] });
    expect(lots[0].rank).toBeLessThan(lots[lots.length - 1].rank);
    expect(lots.map((l) => l.id).filter((id) => id === 'a' || id === 'a2')).toHaveLength(1);
  });
  test('sizes clamp to the spec 4b §2 ranges; wood fits inside concrete', () => {
    for (const l of townLots(bundle([rect('big', 0, 60, 20, 12), rect('small', 60, 60, 1, 1)]), rules)) {
      expect(l.wood.hx).toBeGreaterThanOrEqual(LOT.wood.hx[0]); expect(l.wood.hx).toBeLessThanOrEqual(LOT.wood.hx[1]);
      expect(l.wood.hz).toBeGreaterThanOrEqual(LOT.wood.hz[0]); expect(l.wood.hz).toBeLessThanOrEqual(LOT.wood.hz[1]);
      expect(l.concrete.hx).toBeGreaterThanOrEqual(LOT.concrete.hx[0]); expect(l.concrete.hx).toBeLessThanOrEqual(LOT.concrete.hx[1]);
      expect(l.concrete.hz).toBeLessThanOrEqual(LOT.concrete.hz[1]);
      expect(l.wood.hx).toBeLessThanOrEqual(l.concrete.hx); expect(l.wood.hz).toBeLessThanOrEqual(l.concrete.hz);
    }
  });
  test('deterministic', () => {
    const b = bundle([rect('1', 0, 60, 4, 3), rect('2', 30, 60, 4, 3)]);
    expect(townLots(b, rules)).toEqual(townLots(b, rules));
  });
});

describe('church plan', () => {
  test('the front is the end facing the plaza', () => {
    const p = churchPlan(bundle([]));
    expect(toLocal(p.fp, 40, 0)[0] * p.front).toBeGreaterThan(0);
  });
  test('real data: the church outline and the plaza are found', () => {
    const p = churchPlan(G);
    expect(p.fp.hx).toBeGreaterThan(8);
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/town/layout.test.ts`
Expected: FAIL (module `./layout` not found).

- [ ] **Step 4: Implement `layout.ts`**

Create `src/town/layout.ts`:

```ts
import type { GeoBundle, XZ } from '../data/geo/types';
import { corners, toWorld, type Footprint } from '../infrastructure/parts';
import { LANDING_CLEARING } from '../vegetation/masks';
import { cellRng } from '../vegetation/rng';
import { CIRCLE_R } from './constants';

/**
 * Phase 4b lots (spec 4b §2): every OSM outline in the town circle becomes an oriented rectangle, drops out
 * if it touches the landing clearing, a road, the bridge corridor, the plaza or the church, and gets a fixed
 * rank (distance to the church + jitter) and fixed random numbers. Lots never depend on the era, so a house
 * keeps its place, rank and look progression in every era.
 */
export const CHURCH_WAY = '430399958';   // building=church, Iglesia de San Patricio [S14][S26]
export const PLAZA_WAY = '429703572';    // leisure=park, Plaza Don Ricardo Sanjurjo [S26]
/** Half sizes (m) per look, rank jitter (m), gap between lots (m), church reach past its nave sides for the tower (m). Inferred (L). */
export const LOT = {
  wood: { hx: [2.5, 4.5], hz: [2, 3.5] }, concrete: { hx: [3, 7], hz: [2.5, 6] },
  jitter: 40, gap: 1, churchReach: 5,
} as const;

export interface Lot {
  id: string;
  /** Lower = shown earlier. */
  rank: number;
  /** Fixed 0..1: picks the look (spec 4b §2 "Which look"). */
  u: number;
  /** Fixed 0..1: picks the paint. */
  p: number;
  outline: Footprint; wood: Footprint; concrete: Footprint;
}
export interface LotRules {
  centre: XZ; church: XZ;
  /** Centre of the east landing's plant-free clearing (radius LANDING_CLEARING[0]); the 4a station stands inside it. */
  clear: XZ;
  roads: { points: readonly XZ[]; half: number }[];
  corridor: (x: number, z: number) => boolean;
}
export interface ChurchPlan { fp: Footprint; front: 1 | -1 }

/** World → footprint-local (x, z); inverse of parts.toWorld. */
export function toLocal(f: Footprint, x: number, z: number): [number, number] {
  const c = Math.cos(f.yaw), s = Math.sin(f.yaw), dx = x - f.c[0], dz = z - f.c[1];
  return [c * dx - s * dz, s * dx + c * dz];
}

/** Bounding rectangle aligned with the ring's longest edge; hx ≥ hz. */
export function orientedBox(ring: readonly XZ[]): Footprint {
  let best = 0, ux = 1, uz = 0;
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k], b = ring[(k + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    if (l > best) { best = l; ux = dx / l; uz = dz / l; }
  }
  const along = ring.map(([x, z]) => x * ux + z * uz), across = ring.map(([x, z]) => -x * uz + z * ux);
  const a0 = Math.min(...along), a1 = Math.max(...along), v0 = Math.min(...across), v1 = Math.max(...across);
  const ca = (a0 + a1) / 2, cv = (v0 + v1) / 2;
  let hx = (a1 - a0) / 2, hz = (v1 - v0) / 2, yaw = Math.atan2(-uz, ux);
  if (hz > hx) { [hx, hz] = [hz, hx]; yaw += Math.PI / 2; }
  return { c: [ca * ux - cv * uz, ca * uz + cv * ux], yaw, hx, hz };
}

/** Separating-axis test; both rectangles grown by `pad` on every side. */
export function rectsOverlap(a: Footprint, b: Footprint, pad = 0): boolean {
  const ca = corners(a, pad), cb = corners(b, pad);
  for (const f of [a, b]) for (const [ax, az] of [[Math.cos(f.yaw), -Math.sin(f.yaw)], [Math.sin(f.yaw), Math.cos(f.yaw)]]) {
    const pa = ca.map(([x, z]) => x * ax + z * az), pb = cb.map(([x, z]) => x * ax + z * az);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}

export function inRing(ring: readonly XZ[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function distToLine(pts: readonly XZ[], x: number, z: number): number {
  let d = Infinity;
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
    d = Math.min(d, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return d;
}

export const centroid = (ring: readonly XZ[]): XZ =>
  [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));
function fit(o: Footprint, r: { hx: readonly [number, number]; hz: readonly [number, number] }): Footprint {
  const hx = clamp(o.hx, r.hx);
  return { c: o.c, yaw: o.yaw, hx, hz: Math.min(hx, clamp(o.hz, r.hz)) };
}
/** Corners, edge midpoints and centre. */
const samples = (f: Footprint): [number, number][] =>
  [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [0, 0]].map(([sx, sz]) => toWorld(f, sx * f.hx, sz * f.hz));

function outline(geo: GeoBundle, list: 'buildings' | 'parks', id: string) {
  const o = geo[list].find((b) => b.id === id);
  if (!o) throw new Error(`OSM way ${id} missing from loiza.json ${list}`);
  return o;
}
export const plazaRing = (geo: GeoBundle) => outline(geo, 'parks', PLAZA_WAY).ring;
export function churchPlan(geo: GeoBundle): ChurchPlan {
  const fp = orientedBox(outline(geo, 'buildings', CHURCH_WAY).ring), [px, pz] = centroid(plazaRing(geo));
  return { fp, front: toLocal(fp, px, pz)[0] >= 0 ? 1 : -1 };
}
/** The church's whole reach: nave, front (+1 m) and the tower beside it (church.ts). */
export const churchReach = (p: ChurchPlan): Footprint => ({ ...p.fp, hx: p.fp.hx + 1, hz: p.fp.hz + LOT.churchReach });

export function townLots(geo: GeoBundle, r: LotRules): Lot[] {
  const church = churchReach(churchPlan(geo)), plaza = plazaRing(geo);
  const blocked = (f: Footprint) =>
    rectsOverlap(f, church, LOT.gap / 2) ||
    samples(f).some(([x, z]) =>
      Math.hypot(x - r.clear[0], z - r.clear[1]) <= LANDING_CLEARING[0] || r.corridor(x, z) || inRing(plaza, x, z) ||
      r.roads.some((rd) => distToLine(rd.points, x, z) <= rd.half));
  const cands: Lot[] = [];
  for (const b of geo.buildings) {
    if (b.id === CHURCH_WAY) continue;
    const o = orientedBox(b.ring);
    if (Math.hypot(o.c[0] - r.centre[0], o.c[1] - r.centre[1]) > CIRCLE_R) continue;
    const concrete = fit(o, LOT.concrete);
    if (blocked(concrete)) continue;
    const n = Number(b.id) || b.id.length, rng = cellRng(n % 65536, Math.floor(n / 65536), 4401);
    const rank = Math.hypot(o.c[0] - r.church[0], o.c[1] - r.church[1]) + LOT.jitter * rng();
    cands.push({ id: b.id, rank, u: rng(), p: rng(), outline: o, wood: fit(o, LOT.wood), concrete });
  }
  cands.sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1));
  // Overlaps use the concrete (largest) size, so a lot never disappears when its house turns concrete.
  const kept: Lot[] = [];
  for (const l of cands) if (!kept.some((k) => rectsOverlap(k.concrete, l.concrete, LOT.gap / 2))) kept.push(l);
  return kept;
}
```

Note: synthetic test ids (`'keep'`, `'a'`) are not numbers; `Number(b.id) || b.id.length` keeps them working.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/town/layout.test.ts`
Expected: PASS. If the `church` synthetic outline (`rect('church', 0, 9, 3, 2)`) is not dropped, check `churchReach` (the church is 15 × 6 half size at the origin; reach hz = 11).

- [ ] **Step 6: Commit**

```bash
git add src/town/constants.ts src/town/layout.ts src/town/layout.test.ts
git commit -m "feat(4b): town lots from OSM outlines

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: One era's town; the PR-951 fix

**Files:**
- Create: `src/town/town.ts`, `src/town/town.test.ts`
- Modify: `src/infrastructure/roads.ts:20-21, 50-52`, `src/infrastructure/roads.test.ts` (the `PR-951 and PR-188 appear from 1935` test)

**Interfaces:**
- Consumes: Task 4 (`layout.ts`, `constants.ts`); `Era`, `TownShares` (Task 3); `landingPadsFor` (`src/terrain/placementFields.ts`); `padPoint` (`src/terrain/landingPads.ts`); `CLEAR_INLAND` (`src/ancon/geometry.ts`); `STORY_WAYS`, `STORY_WIDTH`, `ROAD_WIDTH`, `bridgeWay`, `SimpleRoad`, `StoryId` (`src/infrastructure/roads.ts`); `BRIDGE`, `bridgeCorridor` (`src/infrastructure/bridge.ts`); `DirtPatch` (`src/infrastructure/groundMask.ts`).
- Produces: `type HouseLook = 'hut' | 'wood' | 'concrete'`; `interface House { id: string; look: HouseLook; fp: Footprint; paint: number }`; `interface PlazaTree { species: 'almendro' | 'coconut'; x: number; z: number; rot: number; scale: number; variant: number }`; `interface EraTown { houses: House[]; streets: SimpleRoad[]; dirt: DirtPatch[]; church: ChurchPlan; plaza: readonly XZ[]; plazaTrees: PlazaTree[] }`; `STREET`; `lookOf(u, shares): HouseLook`; `lotRules(bank, geo?)`; `lotsFor(bank)`; `eraTown(bank, era, geo?)`; `townBlocked(t): (x, z) => boolean`.

- [ ] **Step 1: Failing tests**

Create `src/town/town.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { ERAS, getEra } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { toWorld } from '../infrastructure/parts';
import { LANDING_CLEARING } from '../vegetation/masks';
import { distToLine, inRing, LOT, rectsOverlap } from './layout';
import { eraTown, lookOf, lotRules, lotsFor, STREET, townBlocked, type HouseLook } from './town';

const G = geo as unknown as GeoBundle;
const ORDER: Record<HouseLook, number> = { hut: 0, wood: 1, concrete: 2 };
const town = (e: (typeof ERAS)[number]) => eraTown(e.river.bankOffset.value, e);

describe('lots on the real map', () => {
  test('enough lots, none overlapping, none in the landing clearing', () => {
    for (const bank of new Set(ERAS.map((e) => e.river.bankOffset.value))) {
      const lots = lotsFor(bank), r = lotRules(bank);
      expect(lots.length).toBeGreaterThanOrEqual(40);
      for (let i = 0; i < lots.length; i++) {
        const c = lots[i].concrete.c;
        expect(Math.hypot(c[0] - r.clear[0], c[1] - r.clear[1])).toBeGreaterThan(LANDING_CLEARING[0]);
        for (let j = i + 1; j < lots.length; j++) expect(rectsOverlap(lots[i].concrete, lots[j].concrete)).toBe(false);
      }
    }
  });
});

describe('era town', () => {
  test('looks: concrete below concreteShare, huts above 1 − thatchShare', () => {
    const t = getEra('1959').town;
    expect(lookOf(0.05, t)).toBe('concrete'); expect(lookOf(0.5, t)).toBe('wood'); expect(lookOf(0.97, t)).toBe('hut');
    expect(lookOf(0, getEra('1840').town)).toBe('hut');
  });
  test('house count follows the share', () => {
    for (const e of ERAS) {
      const n = lotsFor(e.river.bankOffset.value).length;
      expect(town(e).houses).toHaveLength(Math.round(n * e.town.houseShare.value));
    }
  });
  test('a house shown once is shown later; its look never goes back', () => {
    for (let k = 1; k < ERAS.length; k++) {
      const before = new Map(town(ERAS[k - 1]).houses.map((h) => [h.id, h.look])), after = new Map(town(ERAS[k]).houses.map((h) => [h.id, h.look]));
      for (const [id, look] of before) {
        expect(after.has(id), `${ERAS[k].id} keeps ${id}`).toBe(true);
        expect(ORDER[after.get(id)!]).toBeGreaterThanOrEqual(ORDER[look]);
      }
    }
  });
  test('sizes per look; no two houses overlap', () => {
    for (const e of ERAS) {
      const hs = town(e).houses;
      for (const h of hs) {
        const r = h.look === 'concrete' ? LOT.concrete : LOT.wood;
        expect(h.fp.hx).toBeGreaterThanOrEqual(r.hx[0]); expect(h.fp.hx).toBeLessThanOrEqual(r.hx[1]);
        expect(h.fp.hz).toBeLessThanOrEqual(r.hz[1]);
      }
      for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) expect(rectsOverlap(hs[i].fp, hs[j].fp)).toBe(false);
    }
  });
  test('streets: town kinds in the circle, each within 15 m of a shown house; more streets later', () => {
    for (const e of ERAS) {
      const t = town(e);
      for (const s of t.streets) {
        const src = G.roads.find((r) => r.id === s.id)!;
        expect(Object.keys(STREET.kinds)).toContain(src.kind);
        expect(t.houses.some((h) => distToLine(s.points, h.fp.c[0], h.fp.c[1]) <= STREET.reach)).toBe(true);
      }
    }
    expect(town(getEra('1986')).streets.length).toBeGreaterThanOrEqual(town(getEra('1840')).streets.length);
    expect(town(getEra('1986')).streets.length).toBeGreaterThan(0);
  });
  test('plaza: 6–10 trees inside it; yards, church and plaza get dirt', () => {
    const t = town(getEra('1975'));
    expect(t.plazaTrees.length).toBeGreaterThanOrEqual(6); expect(t.plazaTrees.length).toBeLessThanOrEqual(10);
    for (const p of t.plazaTrees) expect(inRing(t.plaza, p.x, p.z)).toBe(true);
    expect(t.dirt).toHaveLength(t.houses.length + 2);
  });
  test('no plants inside a house, the church or the plaza', () => {
    const t = town(getEra('1986')), blocked = townBlocked(t);
    for (const h of t.houses) for (const [sx, sz] of [[0, 0], [0.9, 0.9], [-0.9, 0.9], [0.9, -0.9], [-0.9, -0.9]]) {
      expect(blocked(...toWorld(h.fp, sx * h.fp.hx, sz * h.fp.hz))).toBe(true);
    }
    expect(blocked(...t.church.fp.c)).toBe(true);
    for (const p of t.plazaTrees) expect(blocked(p.x, p.z)).toBe(true);   // other plants keep out; plaza trees are added after placement
    expect(blocked(-900, -900)).toBe(false);
  });
  test('deterministic and cached', () => {
    const e = getEra('1935');
    expect(eraTown(e.river.bankOffset.value, e)).toBe(eraTown(e.river.bankOffset.value, e));
  });
});
```

Also replace the `PR-951 and PR-188 appear from 1935` test in `src/infrastructure/roads.test.ts` (add `import { inTownCircle } from '../town/constants';`):

```ts
  test('PR-951 and PR-188 appear from 1935; town streets that carry PR-951 show in every era (4b)', () => {
    const ids = (id: '1840' | '1925' | '1935') => new Set(eraRoads(G, getEra(id)).simple.map((r) => r.id));
    for (const r of G.roads.filter((x) => x.ref === 'PR-951' || x.ref === 'PR-188')) {
      expect(ids('1935').has(r.id)).toBe(true);
      expect(ids('1925').has(r.id)).toBe(inTownCircle(r.points));
    }
    expect(ids('1840').has('22182173')).toBe(true);   // Calle Espíritu Santo, past the church
    expect(ids('1925').has('22179753')).toBe(false);  // PR-951 outside the town
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/town/town.test.ts src/infrastructure/roads.test.ts`
Expected: FAIL (module `./town` not found; `22182173` missing in 1840).

- [ ] **Step 3: The PR-951 fix**

`src/infrastructure/roads.ts`: add `import { inTownCircle } from '../town/constants';` and change the doc comment and filter:

```ts
/** Numbered roads shown only from 1935 (inferred, L); their old town streets (inside the town circle) show in every era (4b). */
const FROM_1935 = new Set(['PR-951', 'PR-188']);
```

```ts
    .filter((r) => Object.hasOwn(ROAD_WIDTH, r.kind) && !r.bridge && !skip.has(r.id) &&
      !(r.ref && FROM_1935.has(r.ref) && year < 1935 && !inTownCircle(r.points)))
```

Also update the file's top comment: "Residential and service streets are left out here; the town streets next to shown houses come from `src/town/town.ts` (4b)."

- [ ] **Step 4: Implement `town.ts`**

Create `src/town/town.ts`:

```ts
import { CLEAR_INLAND } from '../ancon/geometry';
import type { Era, TownShares } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle, XZ } from '../data/geo/types';
import { landmarkXZ } from '../data/landmarks';
import { BRIDGE, bridgeCorridor } from '../infrastructure/bridge';
import type { DirtPatch } from '../infrastructure/groundMask';
import type { Footprint } from '../infrastructure/parts';
import { bridgeWay, ROAD_WIDTH, STORY_WAYS, STORY_WIDTH, type SimpleRoad, type StoryId } from '../infrastructure/roads';
import { padPoint } from '../terrain/landingPads';
import { landingPadsFor } from '../terrain/placementFields';
import { cellRng } from '../vegetation/rng';
import { CIRCLE_R, inTownCircle, TOWN_CENTRE } from './constants';
import { churchPlan, churchReach, distToLine, inRing, orientedBox, plazaRing, toLocal, townLots, type ChurchPlan, type Lot, type LotRules } from './layout';

/**
 * One era's town (spec 4b §2): the first houseShare of the lots, each with a look from its fixed number u,
 * the town streets next to them, trodden dirt for yards, church and plaza, and the plaza trees. Pure; cached.
 */
const G = geo as unknown as GeoBundle;

export type HouseLook = 'hut' | 'wood' | 'concrete';
export interface House { id: string; look: HouseLook; fp: Footprint; paint: number }
export interface PlazaTree { species: 'almendro' | 'coconut'; x: number; z: number; rot: number; scale: number; variant: number }
export interface EraTown {
  houses: House[]; streets: SimpleRoad[]; dirt: DirtPatch[];
  church: ChurchPlan; plaza: readonly XZ[]; plazaTrees: PlazaTree[];
}

/** Town street kinds and widths (m, inferred); a street is painted when a shown house stands within `reach` m. */
export const STREET = { kinds: { residential: 5, service: 3.5, unclassified: 5, living_street: 4 } as Record<string, number>, reach: 15 } as const;
/** Paint (sRGB, inferred: bright Loíza vernacular, research §7). */
const WOOD_PAINT = [0x6f9f98, 0xd6a49a, 0xe4d6b4, 0x7fa06a, 0xc9b25c, 0x9fb8c8];
const CONCRETE_PAINT = [0xe4d6b4, 0xd9c2a8, 0xb8cfc4, 0xe8e2d4, 0xd6a49a];
const HUT_WALL = 0x8a7556;

export function lookOf(u: number, t: TownShares): HouseLook {
  if (u < t.concreteShare.value) return 'concrete';
  if (u >= 1 - t.thatchShare.value) return 'hut';
  return 'wood';
}

const widthOf = (id: string, kind: string) => {
  const story = (Object.keys(STORY_WAYS) as StoryId[]).find((k) => STORY_WAYS[k] === id);
  return story ? STORY_WIDTH[story] : ROAD_WIDTH[kind] ?? STREET.kinds[kind] ?? 4;
};
export function lotRules(bank: number, g: GeoBundle = G): LotRules {
  const [east] = landingPadsFor(bank);
  return {
    centre: TOWN_CENTRE, church: landmarkXZ('church'), clear: padPoint(east, CLEAR_INLAND, 0),
    roads: g.roads.filter((r) => !r.bridge && inTownCircle(r.points)).map((r) => ({ points: r.points, half: widthOf(r.id, r.kind) / 2 + 0.3 })),
    corridor: bridgeCorridor(bridgeWay(g), BRIDGE.width / 2 + 3),
  };
}
const lots = new Map<number, Lot[]>();
export function lotsFor(bank: number): Lot[] {
  let l = lots.get(bank);
  if (!l) { l = townLots(G, lotRules(bank)); lots.set(bank, l); }
  return l;
}

function house(l: Lot, look: HouseLook): House {
  const pick = (list: number[]) => list[Math.min(list.length - 1, Math.floor(l.p * list.length))];
  return { id: l.id, look, fp: look === 'concrete' ? l.concrete : l.wood,
    paint: look === 'hut' ? HUT_WALL : pick(look === 'wood' ? WOOD_PAINT : CONCRETE_PAINT) };
}
const dirtOf = (f: Footprint, pad: number): DirtPatch => ({ c: f.c, axis: [Math.cos(f.yaw), -Math.sin(f.yaw)], hu: f.hx + pad, hv: f.hz + pad });

function townStreets(g: GeoBundle, houses: House[]): SimpleRoad[] {
  return g.roads
    .filter((r) => Object.hasOwn(STREET.kinds, r.kind) && !r.bridge && inTownCircle(r.points) &&
      houses.some((h) => distToLine(r.points, h.fp.c[0], h.fp.c[1]) <= STREET.reach))
    .map((r) => ({ id: r.id, points: r.points, width: STREET.kinds[r.kind] }));
}

/** Almendros at the corners, palms at the edge middles, inset to 70–75 % of the plaza's half size (inferred, L). */
function plazaTrees(ring: readonly XZ[]): PlazaTree[] {
  const b = orientedBox(ring), out: PlazaTree[] = [];
  const spots: [number, number, PlazaTree['species']][] = [
    [-0.7, -0.7, 'almendro'], [0.7, -0.7, 'almendro'], [0.7, 0.7, 'almendro'], [-0.7, 0.7, 'almendro'],
    [0, -0.75, 'coconut'], [0, 0.75, 'coconut'], [-0.75, 0, 'coconut'], [0.75, 0, 'coconut'],
  ];
  spots.forEach(([sx, sz, species], k) => {
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw), lx = sx * b.hx, lz = sz * b.hz;
    const x = b.c[0] + c * lx + s * lz, z = b.c[1] - s * lx + c * lz;
    if (!inRing(ring, x, z)) return;
    const r = cellRng(k, 0, 4403);
    out.push({ species, x, z, rot: (2 * r() - 1) * (species === 'almendro' ? Math.PI : 0.3), scale: 0.9 + 0.2 * r(), variant: Math.floor(r() * 3) });
  });
  return out;
}

const cache = new Map<string, EraTown>();
export function eraTown(bank: number, era: Era, g: GeoBundle = G): EraTown {
  const key = `${bank}|${era.id}`, hit = g === G ? cache.get(key) : undefined;
  if (hit) return hit;
  const all = g === G ? lotsFor(bank) : townLots(g, lotRules(bank, g)), t = era.town;
  const houses = all.slice(0, Math.round(all.length * t.houseShare.value)).map((l) => house(l, lookOf(l.u, t)));
  const church = churchPlan(g), plaza = plazaRing(g);
  const out: EraTown = {
    houses, streets: townStreets(g, houses), church, plaza, plazaTrees: plazaTrees(plaza),
    dirt: [...houses.map((h) => dirtOf(h.fp, 1.5)), dirtOf(churchReach(church), 2), dirtOf(orientedBox(plaza), 0)],
  };
  if (g === G) cache.set(key, out);
  return out;
}

/** Plants keep out of every shown house (+1 m), the church with its tower (+2 m) and the plaza. */
export function townBlocked(t: EraTown): (x: number, z: number) => boolean {
  const reach = churchReach(t.church);
  const rects: Footprint[] = [...t.houses.map((h) => ({ ...h.fp, hx: h.fp.hx + 1, hz: h.fp.hz + 1 })), { ...reach, hx: reach.hx + 2, hz: reach.hz + 2 }];
  return (x, z) => {
    if (Math.hypot(x - TOWN_CENTRE[0], z - TOWN_CENTRE[1]) > CIRCLE_R + 30) return false;
    if (inRing(t.plaza, x, z)) return true;
    return rects.some((f) => { const [lx, lz] = toLocal(f, x, z); return Math.abs(lx) <= f.hx && Math.abs(lz) <= f.hz; });
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/town src/infrastructure/roads.test.ts`
Expected: PASS. If `lots.length ≥ 40` fails, print the count and the reasons (how many outlines each drop removes) into the rulings note and stop for a ruling — do not loosen the rules on your own.

- [ ] **Step 6: Commit**

```bash
git add src/town/town.ts src/town/town.test.ts src/infrastructure/roads.ts src/infrastructure/roads.test.ts
git commit -m "feat(4b): one era's town — houses, looks, streets, plaza; PR-951 spares town streets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: House geometry

**Files:**
- Create: `src/town/houseMesh.ts`, `src/town/houseMesh.test.ts`

**Interfaces:**
- Consumes: `Builders`, `makeBuilders`, `finish`, `triangleCount`, `corners`, `toWorld`, `Footprint`, `GroundAt` (`src/infrastructure/parts.ts`); `House` (Task 5, type only); `toLocal` (Task 4).
- Produces: `HOUSE` constants, `HOUSE_TRIANGLES = 160`, `buildHouse(b: Builders, h: House, g: GroundAt): void`.

- [ ] **Step 1: Failing tests**

Create `src/town/houseMesh.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { finish, makeBuilders, triangleCount, type Footprint } from '../infrastructure/parts';
import { buildHouse, HOUSE, HOUSE_TRIANGLES } from './houseMesh';
import { toLocal } from './layout';
import type { House, HouseLook } from './town';

const fp: Footprint = { c: [10, -4], yaw: 0.7, hx: 4, hz: 3 };
const slope = (x: number) => 1 + 0.05 * x;
const one = (look: HouseLook) => { const b = makeBuilders(); buildHouse(b, { id: 'x', look, fp, paint: 0x6f9f98 } as House, slope); return finish(b); };

describe('house', () => {
  test('materials per look', () => {
    expect(Object.keys(one('hut')).sort()).toEqual(['thatch', 'wood']);
    expect(Object.keys(one('wood')).sort()).toEqual(['wood', 'zinc']);
    expect(Object.keys(one('concrete')).sort()).toEqual(['concrete', 'iron']);
  });
  test(`at most ${HOUSE_TRIANGLES} triangles`, () => {
    for (const look of ['hut', 'wood', 'concrete'] as const) {
      const n = Object.values(one(look)).reduce((s, g) => s + triangleCount(g!), 0);
      expect(n, look).toBeLessThanOrEqual(HOUSE_TRIANGLES);
    }
  });
  test('stays inside its footprint plus the eaves; reaches into the ground; roof above the walls', () => {
    for (const look of ['hut', 'wood', 'concrete'] as const) {
      let yMin = Infinity, yMax = -Infinity;
      for (const g of Object.values(one(look))) {
        const p = g!.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const [lx, lz] = toLocal(fp, p.getX(i), p.getZ(i));
          expect(Math.abs(lx), look).toBeLessThanOrEqual(fp.hx + 1);
          expect(Math.abs(lz), look).toBeLessThanOrEqual(fp.hz + 1);
          yMin = Math.min(yMin, p.getY(i)); yMax = Math.max(yMax, p.getY(i));
        }
      }
      const low = Math.min(...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) =>
        slope(fp.c[0] + Math.cos(fp.yaw) * sx * fp.hx + Math.sin(fp.yaw) * sz * fp.hz)));   // ground at the lowest corner
      expect(yMin, look).toBeLessThan(low);
      expect(yMax - yMin, look).toBeGreaterThan(HOUSE.wall[look]);
    }
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/town/houseMesh.test.ts`
Expected: FAIL (module `./houseMesh` not found).

- [ ] **Step 3: Implement**

Create `src/town/houseMesh.ts`:

```ts
import * as THREE from 'three';
import type { PartBuilder } from '../ancon/vessels/common';
import { corners, toWorld, type Builders, type Footprint, type GroundAt } from '../infrastructure/parts';
import type { House } from './town';

/**
 * Town houses (spec 4b §3), seen from 150–350 m: one block for the walls, flat dark door and windows, painted
 * shutters. Huts: bare walls on low posts, thatched hip roof. Wood: painted walls on zocos, zinc gable roof
 * with the ridge along the long side. Concrete: plinth to the lowest corner, flat roof with parapet.
 * Heights inferred (L). Local +X is the long side (footprints from layout.orientedBox).
 */
export const HOUSE = { wall: { hut: 2.2, wood: 2.6, concrete: 2.9 }, zoco: { hut: 0.3, wood: 0.6 }, tilt: 0.38, eave: 0.5 } as const;
export const HOUSE_TRIANGLES = 160;
const C = { post: 0x5f5549, dark: 0x1d1b19, trim: 0xe6e0d2, band: 0x3f7f7a, plinth: 0xb9b4a8, roof: 0xd8d2c4 };

const box = (pb: PartBuilder, f: Footprint, size: [number, number, number], lx: number, y: number, lz: number, color: number, rotZ = 0) => {
  const [x, z] = toWorld(f, lx, lz);
  pb.box(size, [x, y, z], color, rotZ, f.yaw);
};
function groundRange(f: Footprint, g: GroundAt): [number, number] {
  const hs = corners(f).map(([x, z]) => g(x, z)).concat(g(f.c[0], f.c[1]));
  return [Math.min(...hs), Math.max(...hs)];
}
/** Four posts from 0.3 m inside the ground up to `top`. */
function posts(pb: PartBuilder, f: Footprint, g: GroundAt, top: number) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [x, z] = toWorld(f, sx * (f.hx - 0.3), sz * (f.hz - 0.3)), gy = g(x, z) - 0.3;
    pb.box([0.2, top - gy, 0.2], [x, (top + gy) / 2, z], C.post, 0, f.yaw);
  }
}
/** Zinc gable, ridge along local X: built on the footprint turned 90° so the slabs tilt about the ridge. Gable ends in wood. */
function gable(b: Builders, f: Footprint, top: number, wall: number) {
  const r: Footprint = { c: f.c, yaw: f.yaw + Math.PI / 2, hx: f.hz, hz: f.hx };
  const o = HOUSE.eave, run = r.hx + o, rise = Math.tan(HOUSE.tilt) * run, len = run / Math.cos(HOUSE.tilt);
  for (const s of [-1, 1]) box(b.zinc, r, [len, 0.04, 2 * r.hz + 2 * o], (s * run) / 2, top + rise / 2, 0, 0xffffff, -s * HOUSE.tilt);
  const tri = new THREE.CylinderGeometry(1, 1, 2 * r.hz, 3, 1);
  tri.rotateX(-Math.PI / 2);
  const riseIn = Math.tan(HOUSE.tilt) * r.hx;
  tri.scale(r.hx / 0.866, riseIn / 1.5, 1);
  tri.translate(0, top + 0.5 * (riseIn / 1.5), 0);
  tri.rotateY(r.yaw); tri.translate(r.c[0], 0, r.c[1]);
  b.wood.add(tri, wall);
}
/** Thatched hip roof: a square pyramid stretched over the footprint with an overhang. */
function hip(pb: PartBuilder, f: Footprint, top: number, rise = 1.8, o = 0.6) {
  const g = new THREE.ConeGeometry(1, rise, 4, 1);
  g.rotateY(Math.PI / 4);
  g.scale((f.hx + o) / 0.7071, 1, (f.hz + o) / 0.7071);
  g.translate(0, top + rise / 2 - 0.15, 0);
  g.rotateY(f.yaw); g.translate(f.c[0], 0, f.c[1]);
  pb.add(g, 0xffffff);
}

export function buildHouse(b: Builders, h: House, g: GroundAt) {
  const f = h.fp, [gmin, gmax] = groundRange(f, g);
  if (h.look === 'concrete') {
    const floor = gmax + 0.25, H = HOUSE.wall.concrete, top = floor + H;
    box(b.concrete, f, [2 * f.hx + 0.3, floor - gmin + 0.3, 2 * f.hz + 0.3], 0, (floor + gmin - 0.3) / 2, 0, C.plinth);
    box(b.concrete, f, [2 * f.hx, H, 2 * f.hz], 0, floor + H / 2, 0, h.paint);
    box(b.concrete, f, [2 * f.hx + 0.3, 0.6, 2 * f.hz + 0.3], 0, top + 0.3, 0, C.roof);   // flat roof and parapet
    box(b.iron, f, [0.05, 2.0, 0.9], -f.hx - 0.03, floor + 1.0, 0, C.dark);                 // door
    for (const s of [-1, 1]) box(b.iron, f, [1.3, 1.1, 0.05], 0, floor + 1.6, s * (f.hz + 0.03), C.dark);   // windows
    return;
  }
  const floor = gmax + HOUSE.zoco[h.look], H = HOUSE.wall[h.look], top = floor + H;
  posts(b.wood, f, g, floor);
  box(b.wood, f, [2 * f.hx, H, 2 * f.hz], 0, floor + H / 2, 0, h.paint);
  box(b.wood, f, [0.05, 2.0, 0.9], -f.hx - 0.03, floor + 1.0, 0, C.dark);
  if (h.look === 'hut') { hip(b.thatch, f, top); return; }
  for (const s of [-1, 1]) box(b.wood, f, [0.9, 1.0, 0.05], 0, floor + 1.5, s * (f.hz + 0.03), s > 0 ? C.band : C.trim);   // shutters (tormenteras)
  gable(b, f, top, h.paint);
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/town/houseMesh.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/town/houseMesh.ts src/town/houseMesh.test.ts
git commit -m "feat(4b): house geometry — huts, wood on zocos, concrete

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The church

**Files:**
- Create: `src/town/church.ts`, `src/town/church.test.ts`

**Interfaces:**
- Consumes: `Builders`, `toWorld`, `Footprint`, `GroundAt` (`parts.ts`); `ChurchPlan`, `churchReach`, `churchPlan`, `toLocal` (Task 4).
- Produces: `CHURCH` constants, `CHURCH_TRIANGLES = 2000`, `buildChurch(b: Builders, p: ChurchPlan, g: GroundAt): void`.

- [ ] **Step 1: Failing tests**

Create `src/town/church.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { finish, makeBuilders, triangleCount } from '../infrastructure/parts';
import { buildChurch, CHURCH, CHURCH_TRIANGLES } from './church';
import { churchPlan, churchReach, toLocal } from './layout';

const plan = churchPlan(geo as unknown as GeoBundle), ground = () => 3;
const parts = () => { const b = makeBuilders(); buildChurch(b, plan, ground); return finish(b); };

describe('church', () => {
  test('lime walls in concrete; door, windows, cross and two bells in iron', () => {
    expect(Object.keys(parts()).sort()).toEqual(['concrete', 'iron']);
  });
  test(`at most ${CHURCH_TRIANGLES} triangles`, () => {
    expect(Object.values(parts()).reduce((n, g) => n + triangleCount(g!), 0)).toBeLessThanOrEqual(CHURCH_TRIANGLES);
  });
  test('inside its reach; the bell tower stands ≥ 18 m above the ground; the front faces the plaza', () => {
    const reach = churchReach(plan);
    let top = -Infinity, frontMost = 0;
    for (const g of Object.values(parts())) {
      const p = g!.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const [lx, lz] = toLocal(reach, p.getX(i), p.getZ(i));
        expect(Math.abs(lx)).toBeLessThanOrEqual(reach.hx + 0.01);
        expect(Math.abs(lz)).toBeLessThanOrEqual(reach.hz + 0.01);
        top = Math.max(top, p.getY(i));
        if (p.getY(i) > 3 + CHURCH.wall + 2) frontMost += Math.sign(lx) * plan.front;   // tall parts lean to the front
      }
    }
    expect(top - 3).toBeGreaterThanOrEqual(18);
    expect(frontMost).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/town/church.test.ts`
Expected: FAIL (module `./church` not found).

- [ ] **Step 3: Implement**

Create `src/town/church.ts`:

```ts
import * as THREE from 'three';
import type { PartBuilder } from '../ancon/vessels/common';
import { toWorld, type Builders, type Footprint, type GroundAt } from '../infrastructure/parts';
import { LOT, type ChurchPlan } from './layout';

/**
 * Parroquia del Espíritu Santo y San Patricio (spec 4b §2): one nave with massive walls and buttresses, a
 * two-storey three-bay front, a belfry with two bells [S14] H, on its OSM outline [S26] H. The front is the
 * end facing the plaza; the tower stands beside the front on the nave's +Z side. Heights, the low barrel
 * roof, the tower side and the lime-white paint are inferred (L). Same in every era (1729 enlargement).
 */
export const CHURCH = { wall: 9, front: 13, towerBase: 13, belfry: 4, tower: 4, buttressEvery: 6 } as const;
export const CHURCH_TRIANGLES = 2000;
const LIME = 0xeeeae0, TRIM = 0xd9d2c3, DARK = 0x1d1b19, BRONZE = 0x5a4a32;

const box = (pb: PartBuilder, f: Footprint, size: [number, number, number], lx: number, y: number, lz: number, color: number) => {
  const [x, z] = toWorld(f, lx, lz);
  pb.box(size, [x, y, z], color, 0, f.yaw);
};

export function buildChurch(b: Builders, p: ChurchPlan, g: GroundAt) {
  const f = p.fp, e = p.front, { hx, hz } = f, c = b.concrete;
  const hs = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([sx, sz]) => g(...toWorld(f, sx * hx, sz * hz)));
  const base = Math.min(...hs) - 0.5, floor = Math.max(...hs) + 0.3, top = floor + CHURCH.wall;

  // Nave and its low barrel roof (half cylinder along local X).
  box(c, f, [2 * hx, top - base, 2 * hz], 0, (top + base) / 2, 0, LIME);
  const vault = new THREE.CylinderGeometry(hz, hz, 2 * hx, 12, 1, false, 0, Math.PI);
  vault.rotateZ(Math.PI / 2); vault.scale(1, 0.45, 1); vault.translate(0, top, 0);
  vault.rotateY(f.yaw); vault.translate(f.c[0], 0, f.c[1]);
  c.add(vault, TRIM);

  // Buttresses along both long walls.
  const n = Math.max(2, Math.floor((2 * hx) / CHURCH.buttressEvery));
  for (let k = 0; k < n; k++) for (const s of [-1, 1]) {
    box(c, f, [1.2, top - 1 - base, 1.6], -hx + ((k + 0.5) * 2 * hx) / n, (top - 1 + base) / 2, s * (hz + 0.8), LIME);
  }

  // Front: wall, cornice between the storeys, four pilasters (three bays), top, door, upper windows.
  const fx = e * (hx + 0.4), H = CHURCH.front;
  box(c, f, [0.8, floor + H - base, 2 * hz + 1], fx, (floor + H + base) / 2, 0, LIME);
  box(c, f, [1.0, 0.4, 2 * hz + 1.4], fx + e * 0.1, floor + 6.5, 0, TRIM);
  for (const lz of [-hz - 0.2, -hz / 3, hz / 3, hz + 0.2]) box(c, f, [1.0, H, 0.5], fx + e * 0.1, floor + H / 2, lz, TRIM);
  box(c, f, [0.8, 1.6, hz], fx, floor + H + 0.8, 0, LIME);
  box(b.iron, f, [0.1, 4, 2.2], fx + e * 0.45, floor + 2, 0, DARK);
  for (const lz of [(-2 * hz) / 3, 0, (2 * hz) / 3]) box(b.iron, f, [0.1, 1.8, 1.0], fx + e * 0.45, floor + 9, lz, DARK);

  // Bell tower beside the front, on the +Z side: base, four belfry piers, cap, dome, cross, two bells.
  const w = CHURCH.tower, tl = e * (hx - w / 2), tz = hz + w / 2, tb = floor + CHURCH.towerBase, bf = CHURCH.belfry;
  box(c, f, [w, tb - base, w], tl, (tb + base) / 2, tz, LIME);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(c, f, [0.8, bf, 0.8], tl + sx * (w / 2 - 0.4), tb + bf / 2, tz + sz * (w / 2 - 0.4), LIME);
  box(c, f, [w + 0.2, 0.4, w + 0.2], tl, tb + bf + 0.2, tz, TRIM);
  const [tx, tzw] = toWorld(f, tl, tz), domeY = tb + bf + 0.4;
  const dome = new THREE.ConeGeometry(w / 2, 2.2, 8, 1);
  dome.translate(tx, domeY + 1.1, tzw);
  c.add(dome, LIME);
  b.iron.box([0.12, 1.2, 0.12], [tx, domeY + 2.8, tzw], DARK, 0, f.yaw);
  b.iron.box([0.6, 0.12, 0.12], [tx, domeY + 2.95, tzw], DARK, 0, f.yaw);
  for (const s of [-1, 1]) {
    const [bx, bz] = toWorld(f, tl + s * 0.8, tz);
    b.iron.cylinder(0.3, 0.5, 0.8, [bx, tb + 1.6, bz], BRONZE, 'y', 8);
  }
}

// The tower (tz + w/2 = hz + w) must stay inside churchReach (hz + LOT.churchReach).
if (CHURCH.tower > LOT.churchReach) throw new Error('church tower wider than LOT.churchReach');
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/town/church.test.ts`
Expected: PASS. The cornice and pilasters reach `fx + e * 0.6` ≤ `hx + 1` (the reach): if the bounds test fails there, check the signs of `e`.

- [ ] **Step 5: Commit**

```bash
git add src/town/church.ts src/town/church.test.ts
git commit -m "feat(4b): the San Patricio church

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: On screen — town meshes, budget, ground paint

**Files:**
- Create: `src/town/build.ts`, `src/town/build.test.ts`, `src/town/Town.tsx`
- Modify: `src/scene/World.tsx:12, 27`, `src/infrastructure/Infrastructure.tsx` (the `mask` memo)

**Interfaces:**
- Consumes: Tasks 5–7; `infraMaterials` (`src/infrastructure/materials.ts`); `groundMask` (`src/infrastructure/groundMask.ts`).
- Produces: `TOWN_LIMITS = { drawCalls: 8, triangles: 40000 }`, `buildTown(t: EraTown, g: GroundAt): TownParts`, `townDrawCalls`, `townTriangles`; `<Town near era castShadow />`.

- [ ] **Step 1: Failing budget test**

Create `src/town/build.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { ERAS } from '../data/eras';
import { sampleField } from '../terrain/fields';
import { placementFields } from '../terrain/placementFields';
import { buildTown, TOWN_LIMITS, townDrawCalls, townTriangles } from './build';
import { eraTown } from './town';

describe('one era of town', () => {
  for (const e of ERAS) test(`${e.id}: within the spec 4b §4 budget`, () => {
    const bank = e.river.bankOffset.value, f = placementFields(bank);
    const parts = buildTown(eraTown(bank, e), (x, z) => sampleField(f, f.height, x, z));
    expect(townDrawCalls(parts)).toBeLessThanOrEqual(TOWN_LIMITS.drawCalls);
    expect(townTriangles(parts)).toBeLessThanOrEqual(TOWN_LIMITS.triangles);
    expect(townTriangles(parts)).toBeGreaterThan(0);
  });
  test('deterministic', () => {
    const e = ERAS[5], bank = e.river.bankOffset.value, f = placementFields(bank), g = (x: number, z: number) => sampleField(f, f.height, x, z);
    const a = buildTown(eraTown(bank, e), g), b = buildTown(eraTown(bank, e), g);
    expect(Array.from(a.concrete!.attributes.position.array)).toEqual(Array.from(b.concrete!.attributes.position.array));
  });
});
```

Run: `npx vitest run src/town/build.test.ts` → FAIL (module `./build` not found).

- [ ] **Step 2: Implement `build.ts`**

```ts
import type * as THREE from 'three';
import { finish, makeBuilders, triangleCount, type GroundAt, type InfraMaterialId } from '../infrastructure/parts';
import { buildChurch } from './church';
import { buildHouse } from './houseMesh';
import type { EraTown } from './town';

/** Spec 4b §4. */
export const TOWN_LIMITS = { drawCalls: 8, triangles: 40000 } as const;
export type TownParts = Partial<Record<InfraMaterialId, THREE.BufferGeometry>>;

/** One era's houses and the church: one merged mesh per material in use (≤ 5). Pure. */
export function buildTown(t: EraTown, g: GroundAt): TownParts {
  const b = makeBuilders();
  for (const h of t.houses) buildHouse(b, h, g);
  buildChurch(b, t.church, g);
  return finish(b);
}
export const townDrawCalls = (p: TownParts) => Object.keys(p).length;
export const townTriangles = (p: TownParts) => Object.values(p).reduce((n, g) => n + triangleCount(g!), 0);
```

Run: `npx vitest run src/town/build.test.ts` → PASS. Record the largest triangle count (1986) in the rulings note.

- [ ] **Step 3: `Town.tsx`**

```tsx
import { useEffect, useMemo } from 'react';
import type { Era } from '../data/eras';
import { infraMaterials } from '../infrastructure/materials';
import type { InfraMaterialId } from '../infrastructure/parts';
import { sampleField, type WorldFields } from '../terrain/fields';
import { buildTown } from './build';
import { eraTown } from './town';

/**
 * Phase 4b: the era's houses and the church, ≤ 5 merged meshes (the 4a infrastructure materials). Built once
 * per era and tier; heights read the tier's rendered terrain (`near`). Streets and yard dirt go to the 4a
 * ground mask (Infrastructure.tsx); plants keep out and the plaza trees are added in Vegetation.tsx.
 */
export function Town({ near, era, castShadow }: { near: WorldFields; era: Era; castShadow: boolean }) {
  const bank = era.river.bankOffset.value;
  const town = useMemo(() => eraTown(bank, era), [bank, era]);
  const parts = useMemo(() => buildTown(town, (x, z) => sampleField(near, near.height, x, z)), [town, near]);
  useEffect(() => () => { for (const g of Object.values(parts)) g?.dispose(); }, [parts]);
  const mats = infraMaterials();
  return (
    <group>
      {(Object.keys(parts) as InfraMaterialId[]).map((id) => (
        <mesh key={id} geometry={parts[id]} material={mats[id]} castShadow={castShadow} receiveShadow />
      ))}
    </group>
  );
}
```

- [ ] **Step 4: Mount it**

`src/scene/World.tsx`: add `import { Town } from '../town/Town';` after the `Infrastructure` import and, after the `<Infrastructure … />` line:

```tsx
      <Town near={near} era={era} castShadow={q.shadowMap > 0} />
```

- [ ] **Step 5: Streets and dirt in the ground mask**

`src/infrastructure/Infrastructure.tsx`: add `import { eraTown } from '../town/town';` and replace the `mask` memo:

```tsx
  // Phase 4b: the town streets next to shown houses and the yard/church/plaza dirt share the 4a mask.
  const town = useMemo(() => eraTown(bank, era), [bank, era]);
  const mask = useMemo(() => {
    const m = groundMask({ ...roads, simple: [...roads.simple, ...town.streets] }, [...out.dirt, ...town.dirt]);
    return { tex: makeInfoTexture(m.data, m.size), rect: m.rect };
  }, [roads, out, town]);
```

- [ ] **Step 6: Look at it**

Run `npm test` and `npx tsc -p tsconfig.json --noEmit` → PASS, no errors. Run `npm run dev` and open `?era=1840&cam=town&t=12&freeze=1&q=medium`, then `era=1959` and `era=1986`. Expected: huts round the church in 1840; zinc roofs and a few concrete houses in 1959; mostly concrete in 1986; the church with its tower in all three; sand/asphalt streets painted between the houses; no house floating, sunk, or sitting on a road. Check the browser console: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/town/build.ts src/town/build.test.ts src/town/Town.tsx src/scene/World.tsx src/infrastructure/Infrastructure.tsx
git commit -m "feat(4b): town on screen — houses, church, streets and yards in the ground mask

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Plants — keep out of the town, plaza trees

**Files:**
- Modify: `src/vegetation/Vegetation.tsx:32, 104-116`

**Interfaces:**
- Consumes: `eraTown`, `townBlocked` (Task 5); `sampleField` (`src/terrain/fields.ts`).

- [ ] **Step 1: Skip and key**

In `src/vegetation/Vegetation.tsx` add imports `import { sampleField } from '../terrain/fields';` (merge with the existing `WorldFields` type import) and `import { eraTown, townBlocked } from '../town/town';`. Replace the `skip` line and the `key` line:

```tsx
  // Phase 4b: no plants inside a shown house, the church or the plaza (the plaza trees are added below).
  const town = useMemo(() => eraTown(bankOffset, era), [bankOffset, era]);
  const inTown = useMemo(() => townBlocked(town), [town]);
  const skip = useMemo(() => (x: number, z: number) => inTown(x, z) || (bridge && inBridge(x, z)) || !!caneSkip?.(x, z), [bridge, caneSkip, inTown]);
```

```tsx
  const key = placementKey(dens, bankOffset, tier,
    `p${survival}|c${caneShare}|b${bridge ? 1 : 0}|t${era.town.houseShare.value}-${era.town.concreteShare.value}`);
```

(The concrete share is in the key because concrete houses are larger than wooden ones on the same lot.)

- [ ] **Step 2: Plaza trees**

Inside the placement memo, right after `const nearSet = placeAll(pf, masksFor(pf), dens, NEAR_SEED, { skip, planted });`:

```tsx
    for (const t of town.plazaTrees) {
      nearSet[t.species].push({ x: t.x, y: sampleField(pf, pf.height, t.x, t.z), z: t.z, rot: t.rot, scale: t.scale, variant: t.variant });
    }
```

Add `town` to that memo's dependency list: `[key, near, far, skip, town]`.

- [ ] **Step 3: Check**

Run `npm test` and `npx tsc -p tsconfig.json --noEmit` → PASS. In the Browser pane, `?era=1986&cam=town&t=12&freeze=1&q=high` and `?era=1840&cam=town&t=12&freeze=1&q=high`: no tree or palm through a roof, the church or the plaza; the plaza shows its trees. Also `?era=1975&cam=ride&t=17&c=95&freeze=1&q=high`: the ride view still loads with no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/vegetation/Vegetation.tsx
git commit -m "feat(4b): plants keep out of houses, church and plaza; plaza trees

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: After shots, frame rate, art gate

**Files:**
- Create: `tests/snapshots/phase4b/*.png`
- Modify: `docs/superpowers/notes/phase-4b-rulings.md`

- [ ] **Step 1: After shots**

```bash
npx playwright test tests/e2e/world.spec.ts
npx playwright test tests/e2e/leak.spec.ts
```

Expected: all pass, no console errors; PNGs in `tests/snapshots/phase4b/`; era switches stay leak-free.

- [ ] **Step 2: Frame rate**

`npm run build && npm run preview`; rerun every Task 1 Step 6 query. Add an "After" table to the rulings note (mean ms, baseline ms, change). Check the Global Constraints limit (mean frame time within 5 % of baseline on every tier). If it fails, stop and report the numbers to the controller.

- [ ] **Step 3: Art gate**

Compare each `phase4b/` shot with its `phase4b-before/` twin, with the quality-bar image and with the research photos (V1, Archivo Negro). One line per shot in the rulings note: what changed, what still looks wrong. Fix Important problems before the review (for example: houses floating or sunk, roofs inside-out, a house on a street or in the river, a tree through a roof, the church missing or tiny from `ride`, the town reading as a grid of identical boxes, harsh paint colours). List Minor ones under Deferred.

- [ ] **Step 4: Commit**

```bash
git add tests/snapshots/phase4b docs/superpowers/notes/phase-4b-rulings.md
git commit -m "test(4b): after shots, frame rate, art gate notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Fact check and final review (controller)

- [ ] **Step 1: Fact check.** Dispatch a review agent to check spec 4b §2 claims, the `eras.ts` town comment and the `church.ts` header against [S12], [S14], [S16], [S26] and research §7 (URLs in `docs/research/ancon-research.md` and `src/data/sources.ts`). Ask it to check the church shape against photos too: which side the tower stands on, the wall colour, the roof. Show the user only flagged items; fix wording, confidence or geometry as ruled.
- [ ] **Step 2: Final code review** of the branch diff (as in earlier phases). Fix Important items; add Minor ones to the rulings note §Deferred.
- [ ] **Step 3: Hand over.** Tell the user the branch is ready, with the art-gate shots, and ask for merge approval. Do not merge or push to `main` without it.
