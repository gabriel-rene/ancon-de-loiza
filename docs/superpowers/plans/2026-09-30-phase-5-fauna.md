# Phase 5 — Fauna Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every era shows brown pelicans (a flock and two fishers), frigatebirds, egrets and herons at the landings (they fly up when the ferry docks), jumping mullet, a surfacing manatee and water rings — plus three sourced animal facts in the info panel.

**Architecture:** A new `src/fauna/` folder. Pure units first: `clock.ts` (seeded event times, last dock start), `site.ts` (where animals may be: crossing line, bank lines, fisher circles, manatee zone), then one pure pose function per animal (`flyers.ts`, `waders.ts`, `waterLife.ts`, `rings.ts`), each `(clock, …, world, out) → FaunaPose`. `geometry.ts` builds the shapes in code; `material.ts` flaps, folds and trails in the vertex shader (CustomShaderMaterial, with a depth twin for shadows). `FaunaSet.ts` owns one InstancedMesh per shape and writes matrices + 3 numbers per animal per frame; `Fauna.tsx` mounts it in `World.tsx` and feeds it the crossing clock (`sharedVesselPose.clock`).

**Tech Stack:** three 0.186, R3F 9, three-custom-shader-material 6, zustand, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-30-phase-5-fauna-design.md` · Previous: `docs/superpowers/specs/2026-09-29-phase-4c-traffic-design.md` · Research: `docs/research/ancon-research.md` §6

## Global Constraints

- World frame: 1 unit = 1 m; +X east, +Y up, +Z south. `WATER_Y = 0`. three.js rotY: local +X → (cos, 0, −sin), local +Z → (sin, 0, cos).
- Model frame of every animal: **+X forward, +Y up, +Z to the right**. Euler order `'YZX'` with `(roll, yaw, pitch)`, as the vessel. `yaw = atan2(-hz, hx)` for an XZ heading (hx, hz).
- Frame rule (user ruling 2026-09-28): build only what the `ride` camera shows. Every animal stays within **300 m of the crossing line** (segment shoreEast–shoreWest).
- Same animals in every era. Counts per tier (spec §2): pelican flock 4/4/2, fishers 2/2/1, frigatebirds 3/3/2, waders per landing 5/5/3 (high/medium/low). Mullet and manatee on every tier.
- Everything is a pure function of the crossing clock and fixed seeds (same clock ⇒ same picture). No `Math.random`. No per-frame allocation in `FaunaSet.update` or the pose functions.
- All geometry is made in code. No downloaded files.
- Budget (spec §5): at most **8 draw calls** (plus shadow and reflection passes) and **30 000 triangles** on high. Only bank birds (waders) cast shadows.
- The water shader does not change. Rings are their own instanced mesh and are hidden in the reflection pass.
- Frame rate on every tier stays within **5 %** of the Task 1 baseline mean frame time.
- Facts: 3–6 per era; every source key exists in `src/data/sources.ts`.
- Branch `phase-5-fauna` (already created; the spec is committed on it). Never push to `main`. Merge only after the user approves.
- Commit message bodies end, after a blank line, with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File map

```
src/fauna/clock.ts          u01, eventTime, lastDockStart (new)
src/fauna/pose.ts           FaunaPose, createFaunaPose, yawOf, smooth, bankFor (new)
src/fauna/site.ts           FaunaSite, FaunaWorld, faunaSite, bankAt, distToCrossing (new)
src/fauna/flyers.ts         pelicanFlock, pelicanFisher, fisherPlan, fisherEvents, frigate (new)
src/fauna/waders.ts         waderSpecs, wader, WADER_LOOK (new)
src/fauna/waterLife.ts      mullet, mulletJump, manatee, manateeTime (new)
src/fauna/rings.ts          ringsAt, RING_POOL (new)
src/fauna/geometry.ts       buildFaunaShape, FAUNA_TRIS, WING_K, HIP (new)
src/fauna/material.ts       faunaMaterials, ringMaterial, animateVertex (new)
src/fauna/FaunaSet.ts       FaunaSet (new)
src/fauna/Fauna.tsx         React mount (new)
src/fauna/testing.ts        worldFor(id) test fixture (new)
src/fauna/*.test.ts         unit tests (new)
src/quality.ts              + fauna counts per tier
src/scene/World.tsx         + <Fauna>
src/data/facts.ts           + 3 facts
src/data/facts.test.ts      cap 5 → 6
src/data/sources.ts         + S18
tests/e2e/world.spec.ts     DIR phase5, + fauna shots
docs/superpowers/notes/phase-5-rulings.md   baseline, art gate, fps, fact check, review (new)
```

---

### Task 1: Baseline shots and frame rate

**Files:**
- Modify: `tests/e2e/world.spec.ts:8` (default `DIR`)
- Create: `docs/superpowers/notes/phase-5-rulings.md`

**Interfaces:**
- Produces: `tests/snapshots/phase5-before/*.png`; the baseline fps table in the rulings note.

- [ ] **Step 1: Check the branch**

Run: `git -C /Users/gabrielrodriguez/dev/ancon branch --show-current`
Expected: `phase-5-fauna`

- [ ] **Step 2: Point the shot spec at phase5**

In `tests/e2e/world.spec.ts`, replace:

```ts
/** Output folder under tests/snapshots (SNAP_DIR=phase4c-before for the baseline run). */
const DIR = `tests/snapshots/${process.env.SNAP_DIR ?? 'phase4c'}`;
```

with:

```ts
/** Output folder under tests/snapshots (SNAP_DIR=phase5-before for the baseline run). */
const DIR = `tests/snapshots/${process.env.SNAP_DIR ?? 'phase5'}`;
```

- [ ] **Step 3: Baseline shots**

Run: `SNAP_DIR=phase5-before npx playwright test tests/e2e/world.spec.ts --grep-invert @slow`
Expected: all listed tests pass (station and town shots skip); PNGs in `tests/snapshots/phase5-before/`.

- [ ] **Step 4: Baseline frame rate**

Run `npm run build && npm run preview` in the background (serves :4173). Then run each query (the 4c set; dpr 2 for high and medium, dpr 1 for low):

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

Note the commit hash (`git rev-parse --short HEAD`): Task 11 measures back to back against it.

- [ ] **Step 5: Write the rulings note skeleton**

Create `docs/superpowers/notes/phase-5-rulings.md`:

```markdown
# Phase 5 — rulings, frame rate, fact check, deferred

Spec: `docs/superpowers/specs/2026-09-30-phase-5-fauna-design.md`. Plan: `docs/superpowers/plans/2026-09-30-phase-5-fauna.md`.

## Frame rate — baseline (Task 1, commit <hash>)

All numbers from `node scripts/dev/perf.mjs "<query>" 10 2` (`10 1` for low), against `npm run build && npm run preview`.

| query | tier | fps | mean ms | p95 ms |
|---|---|---|---|---|
| 1975 ride c=95 | high | … | … | … |
(one row per Step 4 query)

## Plan deviations

## Art gate

## Frame rate — after

## Fact check

## Review

## Deferred
```

Fill the table with the Step 4 JSON numbers and `<hash>` with the Step 4 hash.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/world.spec.ts docs/superpowers/notes/phase-5-rulings.md tests/snapshots/phase5-before
git commit -m "chore(5): baseline shots and frame rate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Animal facts and source S18

**Files:**
- Modify: `src/data/sources.ts` (add `S18` after `S17`)
- Modify: `src/data/facts.ts` (arrays `'1900'`, `'1984'`, `'1986'`)
- Test: `src/data/facts.test.ts`

**Interfaces:**
- Produces: `SOURCES.S18`; 1900 has 5 facts, 1984 and 1986 have 6.

- [ ] **Step 1: Change the test cap and add a fact-presence test**

In `src/data/facts.test.ts`, change the test named `'every era has 3–5 facts'` to:

```ts
test('every era has 3–6 facts', () => {
  for (const id of ERA_IDS) {
    expect(FACTS[id].length, id).toBeGreaterThanOrEqual(3);
    expect(FACTS[id].length, id).toBeLessThanOrEqual(6);
  }
});
```

(Keep the file's existing imports; if the old body used other names, keep them and change only `5` → `6` and the title.)

Append:

```ts
test('phase 5 animal facts (spec 5 §6)', () => {
  const has = (id: EraId, word: string, src: string) =>
    FACTS[id].some((f) => f.text.en.includes(word) && f.sources.includes(src));
  expect(has('1900', 'brown pelican', 'S22')).toBe(true);
  expect(has('1984', 'shark', 'S4')).toBe(true);
  expect(has('1984', 'cocolía', 'S4')).toBe(true);
  expect(has('1986', 'manatees', 'S17')).toBe(true);
  expect(has('1986', 'manatees', 'S18')).toBe(true);
});
```

Add `import type { EraId } from './eras';` if not already imported.

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/data/facts.test.ts`
Expected: FAIL — `phase 5 animal facts` (no such facts; `S18` unknown).

- [ ] **Step 3: Add the source**

In `src/data/sources.ts`, after the `S17` line, add:

```ts
  S18: { title: 'El Nuevo Día — "Atrapados entre el río y el mar" (manatees, 2026)', url: 'https://www.elnuevodia.com/ciencia-ambiente/flora-fauna/notas/atrapados-entre-el-rio-y-el-mar-asi-intentan-salvar-a-dos-manaties-en-loiza/' },
```

- [ ] **Step 4: Add the facts**

In `src/data/facts.ts`, append to the end of the `'1900'` array (after the 1918 Piñones fact):

```ts
    { text: { es: 'Según el DRNA, en Piñones hay unas 96 especies de aves, entre ellas el pelícano pardo, en peligro de extinción. El islote Carmelita, en la laguna de Piñones, podría ser la colonia de garzas más importante de Puerto Rico.',
              en: 'According to DRNA, Piñones has about 96 bird species, among them the endangered brown pelican. Carmelita islet, in the Piñones lagoon, may be the most important heron colony in Puerto Rico.' },
      sources: ['S22'] },
```

Append to the end of the `'1984'` array:

```ts
    { text: { es: 'El río también daba pesca: una foto de los años 80 muestra a pescadores limpiando un tiburón en El Ancón, y Tony Croatto fue filmado con una nasa de cocolías (jaibas azules) en el río.',
              en: 'The river also gave fish and crabs: a 1980s photo shows fishermen cleaning a shark at El Ancón, and Tony Croatto was filmed with a cocolía (blue crab) trap in the river.' },
      sources: ['S4'] },
```

Append to the end of the `'1986'` array:

```ts
    { text: { es: 'En 1995 y en junio de 2026 hubo manatíes atrapados detrás de la boca del río, cerrada por la arena. En 2026 el DRNA abrió un canal para liberarlos.',
              en: 'In 1995 and in June 2026, manatees were trapped behind the river mouth after sand closed it. In 2026 DRNA cut a channel to free them.' },
      sources: ['S17', 'S18'] },
```

- [ ] **Step 5: Run the data tests**

Run: `npx vitest run src/data`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/sources.ts src/data/facts.ts src/data/facts.test.ts
git commit -m "feat(5): three animal facts (1900 birds, 1984 shark and cocolía, 1986 manatees); cap 6

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Clock helpers and the fauna pose

**Files:**
- Create: `src/fauna/clock.ts`, `src/fauna/pose.ts`
- Test: `src/fauna/clock.test.ts`

**Interfaces:**
- Consumes: `hash3` (`src/vegetation/rng.ts`), `legDuration`, `crossingState`, `createCrossingState`, `type CrossingTimings` (`src/ancon/crossing.ts`).
- Produces:
  - `u01(i: number, j: number, seed: number): number` in [0, 1).
  - `eventTime(k: number, period: number, jitter: number, seed: number): number` — gaps between k and k+1 lie in [period − 2·jitter, period + 2·jitter].
  - `lastDockStart(clock: number, T: CrossingTimings, landing: 0 | 1, moored: boolean): number` — landing 0 = east, 1 = west; `-Infinity` when moored.
  - `interface FaunaPose { x; y; z; yaw; pitch; roll; scale; flap; fold; legs: number; on: boolean }`, `createFaunaPose()`, `yawOf(hx, hz)`, `smooth(t)`, `bankFor(yawRate, speed, max?)`.

- [ ] **Step 1: Write the failing test**

Create `src/fauna/clock.test.ts`:

```ts
import { expect, test } from 'vitest';
import { createCrossingState, crossingState, CROSSING_TIMINGS, legDuration } from '../ancon/crossing';
import { eventTime, lastDockStart, u01 } from './clock';

const T = CROSSING_TIMINGS, L = legDuration(T);

test('u01 is deterministic and in [0, 1)', () => {
  for (let k = -50; k < 50; k++) {
    const a = u01(k, 3, 7);
    expect(a).toBe(u01(k, 3, 7));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  }
});

test('eventTime gaps stay in [period − 2·jitter, period + 2·jitter]', () => {
  for (let k = -20; k < 400; k++) {
    const g = eventTime(k + 1, 4.5, 0.75, 83) - eventTime(k, 4.5, 0.75, 83);
    expect(g).toBeGreaterThanOrEqual(3 - 1e-9);
    expect(g).toBeLessThanOrEqual(6 + 1e-9);
  }
});

test('lastDockStart matches the crossing state machine at both landings', () => {
  const st = createCrossingState();
  for (let clock = -300; clock < 6 * L; clock += 0.5) {
    for (const landing of [0, 1] as const) {
      const d = lastDockStart(clock, T, landing, false);
      expect(d).toBeLessThanOrEqual(clock);
      expect(clock - d).toBeLessThan(2 * L);
      crossingState(d + 0.01, st, T);
      expect(st.phase).toBe('dock');
      // leg 0 travels east → west and docks at the west landing (1).
      expect(st.leg === 0 ? 1 : 0).toBe(landing);
    }
  }
});

test('lastDockStart is -Infinity when moored', () => {
  expect(lastDockStart(100, T, 0, true)).toBe(-Infinity);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/fauna/clock.test.ts`
Expected: FAIL — module `./clock` not found.

- [ ] **Step 3: Write `clock.ts` and `pose.ts`**

Create `src/fauna/clock.ts`:

```ts
import { legDuration, type CrossingTimings } from '../ancon/crossing';
import { hash3 } from '../vegetation/rng';

/** Deterministic value in [0, 1) for (i, j, seed). */
export const u01 = (i: number, j: number, seed: number) => hash3(i, j, seed) / 4294967296;

/** Time of event k in a jittered series. Gaps between neighbours lie in [period − 2·jitter, period + 2·jitter]. */
export const eventTime = (k: number, period: number, jitter: number, seed: number) =>
  k * period + (u01(k, 0, seed) - 0.5) * 2 * jitter;

/**
 * Clock time at which the most recent `dock` phase at `landing` (0 east, 1 west) started, at or before `clock`.
 * Leg n starts at n·L; its dock starts at n·L + load + castOff + cross. Even legs (leg 0, east → west) dock west,
 * odd legs dock east. −Infinity when the ferry is moored (1986).
 */
export function lastDockStart(clock: number, T: CrossingTimings, landing: 0 | 1, moored: boolean): number {
  if (moored) return -Infinity;
  const L = legDuration(T), off = T.load + T.castOff + T.cross;
  let n = Math.floor((clock - off) / L);
  const parity = ((n % 2) + 2) % 2, want = landing === 1 ? 0 : 1;
  if (parity !== want) n -= 1;
  return n * L + off;
}
```

Create `src/fauna/pose.ts`:

```ts
/** One animal's pose this frame (world space). `flap` wing angle (rad, up +), `fold` 0 open … 1 folded, `legs` 0 down … 1 trailing. */
export interface FaunaPose {
  x: number; y: number; z: number;
  yaw: number; pitch: number; roll: number; scale: number;
  flap: number; fold: number; legs: number;
  on: boolean;
}
export const createFaunaPose = (): FaunaPose =>
  ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, scale: 1, flap: 0, fold: 0, legs: 0, on: false });

/** three.js rotY that turns model +X onto the XZ heading (hx, hz). */
export const yawOf = (hx: number, hz: number) => Math.atan2(-hz, hx);

export const smooth = (t: number) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };

/** Bank angle for a coordinated turn. A right turn (yaw decreasing) lowers the right (+Z) wing: +roll. */
export const bankFor = (yawRate: number, speed: number, max = 0.6) =>
  Math.max(-max, Math.min(max, Math.atan((-yawRate * speed) / 9.81)));
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/fauna/clock.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/fauna/clock.ts src/fauna/pose.ts src/fauna/clock.test.ts
git commit -m "feat(5): fauna clock helpers (seeded events, last dock start) and pose type

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The fauna site (where animals may be)

**Files:**
- Create: `src/fauna/site.ts`, `src/fauna/testing.ts`
- Test: `src/fauna/site.test.ts`

**Interfaces:**
- Consumes: `crossingGeometry`, `waterAt`, `type CrossingGeometry`, `type XZ` (`src/ancon/geometry.ts`); `WATER`, `sampleField`, `type WorldFields` (`src/terrain/fields.ts`); `landmarkXZ` (`src/data/landmarks.ts`); `u01` (Task 3); `fields512` (`src/ancon/testing.ts`); `vesselSpec`; `eraTimings` (`src/traffic/schedule.ts`); `getEra`.
- Produces:
  - `FRAME_RADIUS = 300`, `BANK_HALF = 100`, `BANK_STEP = 2`.
  - `interface BankLine { side: 0 | 1; inland: XZ; pts: Float32Array }` — xyz per sample k at along-bank offset `u = -BANK_HALF + k·BANK_STEP`; NaN where no waterline.
  - `interface FaunaSite { fields; geom; mid: XZ; lateral: XZ; mouthSide: 1 | -1; banks: [BankLine, BankLine]; fishers: { c: XZ; r: number }[]; manatee: { c: XZ; a: number; b: number }; groundAt(x, z): number }`.
  - `interface FaunaWorld { site: FaunaSite; T: CrossingTimings; moored: boolean }`.
  - `faunaSite(f: WorldFields, groundAt: (x: number, z: number) => number): FaunaSite` — `f` must be the 512 placement fields.
  - `bankAt(b: BankLine, u: number, out: number[]): boolean` — writes [x, y, z]; linear between valid samples.
  - `bankValid(b: BankLine, u: number): boolean`.
  - `distToCrossing(site, x, z): number`.
  - Test fixture `worldFor(id: EraId): FaunaWorld`.

- [ ] **Step 1: Write the fixture and the failing test**

Create `src/fauna/testing.ts`:

```ts
// Shared test fixtures for src/fauna (imported by *.test.ts only).
import { fields512 } from '../ancon/testing';
import { vesselSpec } from '../ancon/spec';
import { getEra, type EraId } from '../data/eras';
import { sampleField } from '../terrain/fields';
import { eraTimings } from '../traffic/schedule';
import { faunaSite, type FaunaWorld } from './site';

/** An era's fauna world on the 512 placement fields, with its own dock timings. */
export function worldFor(id: EraId): FaunaWorld {
  const e = getEra(id), f = fields512(e.river.bankOffset.value);
  const spec = vesselSpec(e, eraTimings(e));
  return { site: faunaSite(f, (x, z) => sampleField(f, f.height, x, z)), T: spec.timings, moored: spec.moored };
}
```

Create `src/fauna/site.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { waterAt } from '../ancon/geometry';
import { WATER } from '../terrain/fields';
import { BANK_HALF, BANK_STEP, bankAt, distToCrossing, FRAME_RADIUS } from './site';
import { worldFor } from './testing';

// Pre-dam (bank offset 8) and post-dam (0) rivers.
for (const id of ['1840', '1975'] as const) describe(`site ${id}`, () => {
  const { site } = worldFor(id);
  const f = site.fields;

  test('bank samples sit on land, with river just toward the water', () => {
    let valid = 0;
    for (const b of site.banks) {
      for (let k = 0; k * 3 < b.pts.length; k++) {
        const x = b.pts[k * 3], y = b.pts[k * 3 + 1], z = b.pts[k * 3 + 2];
        if (Number.isNaN(x)) continue;
        valid++;
        expect(waterAt(f, x, z)).toBe(WATER.LAND);
        expect(waterAt(f, x - b.inland[0], z - b.inland[1])).toBe(WATER.RIVER);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1.5);
      }
    }
    expect(valid).toBeGreaterThan((2 * (2 * BANK_HALF / BANK_STEP + 1)) * 0.4);
  });

  test('bankAt interpolates between valid samples', () => {
    const b = site.banks[0], out = [0, 0, 0];
    for (let u = -40; u <= 40; u += 0.7) if (bankAt(b, u, out)) expect(Number.isFinite(out[0] + out[1] + out[2])).toBe(true);
  });

  test('fisher circles lie over the river and inside the frame', () => {
    expect(site.fishers.length).toBe(2);
    for (const { c, r } of site.fishers) {
      for (let a = 0; a < 32; a++) {
        const x = c[0] + r * Math.cos(a * Math.PI / 16), z = c[1] + r * Math.sin(a * Math.PI / 16);
        expect(waterAt(f, x, z)).toBe(WATER.RIVER);
        expect(distToCrossing(site, x, z)).toBeLessThan(FRAME_RADIUS);
      }
    }
  });

  test('manatee zone: river, 40–100 m from the crossing line, on the mouth side', () => {
    const { c, a, b } = site.manatee, g = site.geom;
    for (let k = 0; k < 24; k++) {
      const th = k * Math.PI / 12, al = a * Math.cos(th), la = b * Math.sin(th);
      const x = c[0] + g.dir[0] * al + site.lateral[0] * la, z = c[1] + g.dir[1] * al + site.lateral[1] * la;
      expect(waterAt(f, x, z)).toBe(WATER.RIVER);
      const off = (x - g.shoreEast[0]) * site.lateral[0] + (z - g.shoreEast[1]) * site.lateral[1];
      expect(Math.sign(off)).toBe(site.mouthSide);
      expect(Math.abs(off)).toBeGreaterThanOrEqual(40);
      expect(Math.abs(off)).toBeLessThanOrEqual(100);
    }
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/fauna/site.test.ts`
Expected: FAIL — module `./site` not found.

- [ ] **Step 3: Write `site.ts`**

Create `src/fauna/site.ts`:

```ts
import type { CrossingTimings } from '../ancon/crossing';
import { crossingGeometry, waterAt, type CrossingGeometry, type XZ } from '../ancon/geometry';
import { landmarkXZ } from '../data/landmarks';
import { WATER, type WorldFields } from '../terrain/fields';
import { u01 } from './clock';

/** Spec 5 §1.1: every animal stays within this distance (m) of the crossing line. */
export const FRAME_RADIUS = 300;
/** Bank lines run ±BANK_HALF m along each bank from the landing, one sample per BANK_STEP m. */
export const BANK_HALF = 100, BANK_STEP = 2;
const BANK_N = Math.round((2 * BANK_HALF) / BANK_STEP) + 1;

export interface BankLine {
  /** 0 east (Loíza), 1 west. */
  side: 0 | 1;
  /** Unit XZ direction from the water onto this bank. */
  inland: XZ;
  /** x, y, z per sample k (u = −BANK_HALF + k·BANK_STEP): the waterline, 0.5 m onto land. NaN: no waterline found. */
  pts: Float32Array;
}
export interface FaunaSite {
  /** The 512 placement fields. */
  fields: WorldFields;
  geom: CrossingGeometry;
  /** Midpoint of the crossing line. */
  mid: XZ;
  /** Unit XZ across the crossing line (world direction of vessel-local +Z); also "along the banks". */
  lateral: XZ;
  /** +1 if the river mouth lies on the +lateral side of the crossing line. */
  mouthSide: 1 | -1;
  banks: [BankLine, BankLine];
  /** Pelican fishers' circles (centre, radius), all over the river. */
  fishers: { c: XZ; r: number }[];
  /** Manatee zone: centre, half-extent along the crossing (a) and across it (b). */
  manatee: { c: XZ; a: number; b: number };
  groundAt(x: number, z: number): number;
}
export interface FaunaWorld { site: FaunaSite; T: CrossingTimings; moored: boolean }

function buildBank(f: WorldFields, g: CrossingGeometry, lat: XZ, side: 0 | 1, groundAt: (x: number, z: number) => number): BankLine {
  const shore = side === 0 ? g.shoreEast : g.shoreWest, sg = side === 0 ? -1 : 1;
  const inland: XZ = [g.dir[0] * sg, g.dir[1] * sg];
  const pts = new Float32Array(BANK_N * 3).fill(NaN);
  for (let k = 0; k < BANK_N; k++) {
    const u = -BANK_HALF + k * BANK_STEP, bx = shore[0] + lat[0] * u, bz = shore[1] + lat[1] * u;
    let prev = waterAt(f, bx - inland[0] * 40, bz - inland[1] * 40);
    for (let t = -39.5; t <= 40; t += 0.5) {
      const x = bx + inland[0] * t, z = bz + inland[1] * t, c = waterAt(f, x, z);
      if (c === WATER.LAND && prev === WATER.RIVER) {
        const px = x + inland[0] * 0.5, pz = z + inland[1] * 0.5, y = Math.max(0, groundAt(px, pz));
        if (y <= 1.5 && waterAt(f, px, pz) === WATER.LAND) { pts[k * 3] = px; pts[k * 3 + 1] = y; pts[k * 3 + 2] = pz; }
        break;
      }
      prev = c;
    }
  }
  return { side, inland, pts };
}

const riverAll = (f: WorldFields, pts: number[]) => { for (let i = 0; i < pts.length; i += 2) if (waterAt(f, pts[i], pts[i + 1]) !== WATER.RIVER) return false; return true; };

function findFisher(f: WorldFields, g: CrossingGeometry, lat: XZ, mid: XZ, i: number, sideSign: number): { c: XZ; r: number } {
  for (let j = 0; j < 128; j++) {
    const along = (u01(i, j * 3, 61) - 0.5) * 0.6 * g.span, off = sideSign * (60 + 100 * u01(i, j * 3 + 1, 61));
    const r = (22 + 8 * u01(i, j * 3 + 2, 61)) * (1 - j / 192);
    const cx = mid[0] + g.dir[0] * along + lat[0] * off, cz = mid[1] + g.dir[1] * along + lat[1] * off;
    const ring: number[] = [cx, cz];
    for (let a = 0; a < 32; a++) ring.push(cx + r * Math.cos((a * Math.PI) / 16), cz + r * Math.sin((a * Math.PI) / 16));
    if (riverAll(f, ring)) return { c: [cx, cz], r };
  }
  throw new Error(`fauna: no river circle for pelican fisher ${i}`);
}

function findManatee(f: WorldFields, g: CrossingGeometry, lat: XZ, mid: XZ, mouthSide: number): { c: XZ; a: number; b: number } {
  const c: XZ = [mid[0] + lat[0] * 70 * mouthSide, mid[1] + lat[1] * 70 * mouthSide];
  let a = 40, b = 25;
  for (let tries = 0; tries < 10; tries++, a *= 0.8) {
    const pts: number[] = [c[0], c[1]];
    for (let k = 0; k < 24; k++) {
      const th = (k * Math.PI) / 12, al = a * Math.cos(th), la = b * Math.sin(th);
      pts.push(c[0] + g.dir[0] * al + lat[0] * la, c[1] + g.dir[1] * al + lat[1] * la);
    }
    if (riverAll(f, pts)) return { c, a, b };
  }
  throw new Error('fauna: no river zone for the manatee');
}

/** Where animals may be, from the fixed 512 placement fields (never the tier's grid). */
export function faunaSite(f: WorldFields, groundAt: (x: number, z: number) => number): FaunaSite {
  const g = crossingGeometry(f);
  const lat: XZ = [-g.dir[1], g.dir[0]];
  const mid: XZ = [(g.shoreEast[0] + g.shoreWest[0]) / 2, (g.shoreEast[1] + g.shoreWest[1]) / 2];
  const [mx, mz] = landmarkXZ('mouth');
  const mouthSide: 1 | -1 = (mx - mid[0]) * lat[0] + (mz - mid[1]) * lat[1] >= 0 ? 1 : -1;
  return {
    fields: f, geom: g, mid, lateral: lat, mouthSide,
    banks: [buildBank(f, g, lat, 0, groundAt), buildBank(f, g, lat, 1, groundAt)],
    fishers: [findFisher(f, g, lat, mid, 0, mouthSide), findFisher(f, g, lat, mid, 1, -mouthSide)],
    manatee: findManatee(f, g, lat, mid, mouthSide),
    groundAt,
  };
}

const sampleOk = (b: BankLine, k: number) => k >= 0 && k < BANK_N && !Number.isNaN(b.pts[k * 3]);
export const bankValid = (b: BankLine, u: number) => sampleOk(b, Math.round((u + BANK_HALF) / BANK_STEP));

/** Waterline point at along-bank offset u: linear between the two neighbouring samples, else the nearer valid one. */
export function bankAt(b: BankLine, u: number, out: number[]): boolean {
  const s = (u + BANK_HALF) / BANK_STEP, k0 = Math.floor(s), t = s - k0, ok0 = sampleOk(b, k0), ok1 = sampleOk(b, k0 + 1);
  if (ok0 && ok1) {
    for (let c = 0; c < 3; c++) out[c] = b.pts[k0 * 3 + c] + (b.pts[(k0 + 1) * 3 + c] - b.pts[k0 * 3 + c]) * t;
    return true;
  }
  const k = ok0 ? k0 : ok1 ? k0 + 1 : -1;
  if (k < 0) return false;
  for (let c = 0; c < 3; c++) out[c] = b.pts[k * 3 + c];
  return true;
}

/** XZ distance from (x, z) to the crossing line segment shoreEast–shoreWest. */
export function distToCrossing(site: FaunaSite, x: number, z: number): number {
  const g = site.geom, ax = g.shoreEast[0], az = g.shoreEast[1];
  const t = Math.max(0, Math.min(g.span, (x - ax) * g.dir[0] + (z - az) * g.dir[1]));
  return Math.hypot(x - (ax + g.dir[0] * t), z - (az + g.dir[1] * t));
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/fauna/site.test.ts`
Expected: PASS. If `findFisher` or `findManatee` throws, the river there is narrower than assumed: print the river width across `site.lateral` at 60–160 m (walk `waterAt` along `geom.dir` from the candidate centre) and shrink the ranges (fisher offset 60–160 → 50–130, radius 22–30 → 15–22; manatee `b` 25 → 18). Record the change under "Plan deviations" in the rulings note.

- [ ] **Step 5: Commit**

```bash
git add src/fauna/site.ts src/fauna/testing.ts src/fauna/site.test.ts
git commit -m "feat(5): fauna site — bank lines, fisher circles, manatee zone

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Birds in flight (pelicans and frigatebirds)

**Files:**
- Create: `src/fauna/flyers.ts`
- Test: `src/fauna/flyers.test.ts`

**Interfaces:**
- Consumes: `u01` (Task 3); `FaunaPose`, `yawOf`, `smooth`, `bankFor` (Task 3); `FaunaWorld`, `distToCrossing`, `FRAME_RADIUS` (Task 4); `waterAt`, `WATER`.
- Produces:
  - `FLOCK`, `FISHER`, `FRIGATE` constants.
  - `flapGlide(t, beatHz, beats, glide, amp): number`.
  - `pelicanFlock(clock: number, i: number, w: FaunaWorld, out: FaunaPose): FaunaPose`.
  - `interface FisherPlan { cycle; offset; sit; circle; dist: number }`; `fisherPlan(i: number): FisherPlan` (memoised).
  - `fisherEvents(i: number, after: number, out?): { impact: number; takeoff: number }` — the first dive impact at or after `after`, and its take-off (writes into `out`).
  - `pelicanFisher(clock: number, i: number, w: FaunaWorld, out: FaunaPose): FaunaPose`.
  - `frigate(clock: number, i: number, w: FaunaWorld, out: FaunaPose): FaunaPose`.

- [ ] **Step 1: Write the failing test**

Create `src/fauna/flyers.test.ts`:

```ts
import { expect, test } from 'vitest';
import { waterAt } from '../ancon/geometry';
import { WATER } from '../terrain/fields';
import { FISHER, fisherEvents, fisherPlan, frigate, pelicanFisher, pelicanFlock } from './flyers';
import { createFaunaPose } from './pose';
import { distToCrossing, FRAME_RADIUS } from './site';
import { worldFor } from './testing';

const w = worldFor('1975'), p = createFaunaPose(), q = createFaunaPose();
const clear = (x: number, z: number) => Math.max(0, w.site.groundAt(x, z));

test('same clock, same pose', () => {
  for (const c of [0, 17.3, 400.9]) {
    expect(pelicanFlock(c, 2, w, p)).toEqual(pelicanFlock(c, 2, w, q));
    expect(pelicanFisher(c, 1, w, p)).toEqual(pelicanFisher(c, 1, w, q));
    expect(frigate(c, 0, w, p)).toEqual(frigate(c, 0, w, q));
  }
});

test('flock: 3–8 m up, ≥ 2 m clear, inside the frame', () => {
  for (let c = 0; c < 600; c += 0.37) for (let i = 0; i < 4; i++) {
    pelicanFlock(c, i, w, p);
    expect(p.y).toBeGreaterThanOrEqual(3 - 1e-6);
    expect(p.y).toBeLessThanOrEqual(8 + 1e-6);
    expect(p.y - clear(p.x, p.z)).toBeGreaterThanOrEqual(2);
    expect(distToCrossing(w.site, p.x, p.z)).toBeLessThan(FRAME_RADIUS);
  }
});

test('frigatebirds: 60–120 m up, inside the frame', () => {
  for (let c = 0; c < 900; c += 0.9) for (let i = 0; i < 3; i++) {
    frigate(c, i, w, p);
    expect(p.y).toBeGreaterThanOrEqual(60);
    expect(p.y).toBeLessThanOrEqual(120);
    expect(distToCrossing(w.site, p.x, p.z)).toBeLessThan(FRAME_RADIUS);
    expect(p.flap).toBe(0);
  }
});

test('fisher: circles at 11 m, dives to the water at the impact time, sits, takes off', () => {
  for (let i = 0; i < 2; i++) {
    const { impact, takeoff } = fisherEvents(i, 200);
    expect(impact).toBeGreaterThanOrEqual(200);
    expect(takeoff - impact).toBeCloseTo(fisherPlan(i).sit, 6);
    pelicanFisher(impact - FISHER.dive - 0.5, i, w, p);
    expect(p.y).toBeCloseTo(FISHER.h, 6);
    pelicanFisher(impact + 0.5, i, w, p);
    expect(p.y).toBeLessThan(0.05);
    expect(p.fold).toBe(1);
    expect(waterAt(w.site.fields, p.x, p.z)).toBe(WATER.RIVER);
    pelicanFisher(takeoff + FISHER.run + FISHER.climb + 0.5, i, w, p);
    expect(p.y).toBeCloseTo(FISHER.h, 6);
  }
});

test('fisher positions are continuous (no jumps > 2.5 m per 0.1 s; the dive drops fastest)', () => {
  for (let i = 0; i < 2; i++) {
    pelicanFisher(0, i, w, q);
    for (let c = 0.1; c < 300; c += 0.1) {
      pelicanFisher(c, i, w, p);
      expect(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)).toBeLessThan(2.5);
      Object.assign(q, p);
    }
  }
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/fauna/flyers.test.ts`
Expected: FAIL — module `./flyers` not found.

- [ ] **Step 3: Write `flyers.ts`**

Create `src/fauna/flyers.ts`:

```ts
import { u01 } from './clock';
import { bankFor, smooth, yawOf, type FaunaPose } from './pose';
import type { FaunaWorld } from './site';

const TAU = 2 * Math.PI;

/** Flap `beats` strokes at `beatHz`, then glide `glide` s with the wings level; repeats. Continuous. */
export function flapGlide(t: number, beatHz: number, beats: number, glide: number, amp: number) {
  const fl = beats / beatHz, c = fl + glide, tt = ((t % c) + c) % c;
  return tt < fl ? amp * Math.sin(TAU * beatHz * tt) : 0;
}

const set = (o: FaunaPose, x: number, y: number, z: number, yaw: number, pitch: number, roll: number, flap: number, fold: number, legs: number, scale = 1) => {
  o.x = x; o.y = y; o.z = z; o.yaw = yaw; o.pitch = pitch; o.roll = roll; o.flap = flap; o.fold = fold; o.legs = legs; o.scale = scale; o.on = true;
  return o;
};

/**
 * Pelican flock (spec 5 §3.1): an echelon along the river (across the crossing line), 3–8 m up. Each loop of
 * `period` s the leader flies from −half to +half across the view, then the next loop comes back the other way.
 * The ends lie ~280 m out to the side, outside the ride view.
 */
export const FLOCK = { period: 70, speed: 8, half: 280, gapBack: 5, gapSide: 2.5, beatHz: 1.25, beats: 3, glide: 2.2, amp: 0.55 };
export function pelicanFlock(clock: number, i: number, w: FaunaWorld, out: FaunaPose): FaunaPose {
  const s0 = w.site, k = Math.floor(clock / FLOCK.period), t = clock - k * FLOCK.period, sgn = (k & 1) === 0 ? 1 : -1;
  const along = (u01(k, 1, 71) - 0.5) * 80 + i * FLOCK.gapSide;
  const s = sgn * (-FLOCK.half + FLOCK.speed * t - i * FLOCK.gapBack);
  const x = s0.mid[0] + s0.geom.dir[0] * along + s0.lateral[0] * s, z = s0.mid[1] + s0.geom.dir[1] * along + s0.lateral[1] * s;
  const y = 3.6 + 3.8 * u01(k, 2, 71) + 0.6 * Math.sin(0.4 * t + i);
  return set(out, x, y, z, yawOf(s0.lateral[0] * sgn, s0.lateral[1] * sgn), 0, 0,
    flapGlide(t - i * 0.25, FLOCK.beatHz, FLOCK.beats, FLOCK.glide, FLOCK.amp), 0, 0);
}

/**
 * Pelican fisher (spec 5 §3.1): circles its river circle at `h`, dives (wings folded, steep), sits on the water,
 * runs and takes off, climbs back. Horizontal motion always follows the circle; only the speed changes, so the
 * path is continuous across cycles. One cycle is 25–40 s; the two fishers are out of phase.
 */
export const FISHER = { h: 11, v: 8, dive: 1.2, run: 2.5, climb: 6 };
export interface FisherPlan { cycle: number; offset: number; sit: number; circle: number; dist: number }
const PLANS: FisherPlan[] = [];
/** Fisher i's fixed timings (memoised: called every frame). */
export function fisherPlan(i: number): FisherPlan {
  const hit = PLANS[i];
  if (hit) return hit;
  const cycle = 25 + 15 * u01(i, 3, 73), sit = 4 + 4 * u01(i, 5, 73);
  const circle = cycle - (FISHER.dive + sit + FISHER.run + FISHER.climb);
  const v = FISHER.v, dist = v * circle + 0.6 * v * FISHER.dive + (v * FISHER.run) / 2 + v * FISHER.climb;
  return (PLANS[i] = { cycle, offset: cycle * (u01(i, 4, 73) + 0.5 * i), sit, circle, dist });
}
/** The first dive impact at or after `after`, and its take-off. Pass `out` in per-frame code. */
export function fisherEvents(i: number, after: number, out = { impact: 0, takeoff: 0 }): { impact: number; takeoff: number } {
  const p = fisherPlan(i), k = Math.ceil((after + p.offset - p.circle - FISHER.dive) / p.cycle);
  out.impact = k * p.cycle - p.offset + p.circle + FISHER.dive;
  out.takeoff = out.impact + p.sit;
  return out;
}
export function pelicanFisher(clock: number, i: number, w: FaunaWorld, out: FaunaPose): FaunaPose {
  const p = fisherPlan(i), F = FISHER, v = F.v, { c, r } = w.site.fishers[i];
  const tc = clock + p.offset, k = Math.floor(tc / p.cycle), tau = tc - k * p.cycle;
  const t1 = p.circle, t2 = t1 + F.dive, t3 = t2 + p.sit, t4 = t3 + F.run;
  const dDive = v * t1 + 0.6 * v * F.dive;
  let d: number, y: number, pitch = 0, flap = 0, fold = 0, speed = v;
  if (tau < t1) { d = v * tau; y = F.h; flap = flapGlide(tau, 1.2, 3, 3, 0.5); }
  else if (tau < t2) { const u = (tau - t1) / F.dive; d = v * t1 + 0.6 * v * (tau - t1); y = F.h * (1 - u * u); pitch = -1.1 * Math.min(1, u * 3); fold = 1; speed = 0.6 * v; }
  else if (tau < t3) { d = dDive; y = 0.03 * Math.sin(2 * (tau - t2)); pitch = 0.1; fold = 1; speed = 0; }
  else if (tau < t4) { const s = tau - t3, u = s / F.run; d = dDive + (v * s * s) / (2 * F.run); y = 1.5 * u * u; pitch = 0.15; flap = 0.7 * Math.sin(TAU * 2.2 * s); speed = v * u; }
  else { const s = tau - t4, u = smooth(s / F.climb); d = dDive + (v * F.run) / 2 + v * s; y = 1.5 + (F.h - 1.5) * u; pitch = 0.12 * (1 - u); flap = 0.6 * Math.sin(TAU * 1.6 * s); }
  const th = (k * p.dist + d) / r, hx = -Math.sin(th), hz = Math.cos(th);
  // Anticlockwise in XZ is a right turn (yaw decreasing): yaw rate −speed/r.
  const roll = y > 1 ? bankFor(-speed / r, speed) : 0;
  return set(out, c[0] + r * Math.cos(th), y, c[1] + r * Math.sin(th), yawOf(hx, hz), pitch, roll, flap, fold, 0);
}

/**
 * Frigatebird (spec 5 §3.1): a slow figure-eight 60–120 m up over the crossing, wings held out (no flapping),
 * banking in the turns. Figure-eight a·sin t, b·sin 2t, rotated per bird.
 */
export const FRIGATE = { w: 0.065, A: 80, B: 45 };
export function frigate(clock: number, i: number, w: FaunaWorld, out: FaunaPose): FaunaPose {
  const s = w.site, ph = TAU * u01(i, 1, 79), rot = Math.PI * u01(i, 2, 79);
  const al = (u01(i, 3, 79) - 0.5) * 80, la = (u01(i, 4, 79) - 0.5) * 120;
  const cx = s.mid[0] + s.geom.dir[0] * al + s.lateral[0] * la, cz = s.mid[1] + s.geom.dir[1] * al + s.lateral[1] * la;
  const t = FRIGATE.w * clock + ph, cr = Math.cos(rot), sr = Math.sin(rot);
  const a = FRIGATE.A * Math.sin(t), b = FRIGATE.B * Math.sin(2 * t);
  const da = FRIGATE.A * Math.cos(t), db = 2 * FRIGATE.B * Math.cos(2 * t);
  const dda = -FRIGATE.A * Math.sin(t), ddb = -4 * FRIGATE.B * Math.sin(2 * t);
  const hx = da * cr - db * sr, hz = da * sr + db * cr, hx2 = dda * cr - ddb * sr, hz2 = dda * sr + ddb * cr;
  const h2 = hx * hx + hz * hz || 1, yawRate = (FRIGATE.w * (hz * hx2 - hx * hz2)) / h2, speed = FRIGATE.w * Math.sqrt(h2);
  const y = 70 + 40 * u01(i, 5, 79) + 10 * Math.sin(0.03 * clock + ph);
  return set(out, cx + a * cr - b * sr, y, cz + a * sr + b * cr, yawOf(hx, hz), 0, bankFor(yawRate, speed, 0.45), 0, 0, 0);
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/fauna/flyers.test.ts`
Expected: PASS. If the flock's "≥ 2 m clear" fails over a high bank, raise the base height 3.6 → 4.0 and lower the spread 3.8 → 3.4 (keeps 3–8 m); record under "Plan deviations".

- [ ] **Step 5: Commit**

```bash
git add src/fauna/flyers.ts src/fauna/flyers.test.ts
git commit -m "feat(5): pelican flock, pelican fishers and frigatebirds (pure paths)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Egrets and herons (waders) and the docking reaction

**Files:**
- Create: `src/fauna/waders.ts`
- Test: `src/fauna/waders.test.ts`

**Interfaces:**
- Consumes: `u01`, `lastDockStart` (Task 3); `FaunaPose`, `yawOf`, `smooth` (Task 3); `FaunaWorld`, `bankAt`, `bankValid`, `BANK_STEP` (Task 4); `legDuration`.
- Produces:
  - `WADE` constants; `type WaderKind = 'great' | 'snowy' | 'blue' | 'tri'`; `WADER_LOOK: Record<WaderKind, { scale: number; color: number }>`.
  - `interface WaderSpec { landing: 0 | 1; kind: WaderKind; u: number; flee: number; flush: boolean; rank: number; seed: number }`.
  - `waderSpecs(site: FaunaSite, perLanding: number): WaderSpec[]` — landing 0 first; the last bird of each landing has `flush: false`.
  - `wader(clock: number, s: WaderSpec, w: FaunaWorld, out: FaunaPose): FaunaPose`.
  - `waderHome(s: WaderSpec, w: FaunaWorld, out: number[]): void`.

- [ ] **Step 1: Write the failing test**

Create `src/fauna/waders.test.ts`:

```ts
import { expect, test } from 'vitest';
import { legDuration } from '../ancon/crossing';
import { lastDockStart } from './clock';
import { createFaunaPose } from './pose';
import { bankValid } from './site';
import { worldFor } from './testing';
import { wader, waderHome, waderSpecs, WADE } from './waders';

const w = worldFor('1975'), p = createFaunaPose(), home = [0, 0, 0];
const specs = waderSpecs(w.site, 5);
const L = legDuration(w.T);

test('5 per landing on high, 3 on low; kinds 6 white / 4 dark on high', () => {
  expect(specs.length).toBe(10);
  expect(waderSpecs(w.site, 3).length).toBe(6);
  const white = specs.filter((s) => s.kind === 'great' || s.kind === 'snowy').length;
  expect(white).toBe(6);
  expect(specs.filter((s) => s.flush).length).toBe(8);
});

test('homes and flight targets lie on valid bank samples, at the spec distances', () => {
  for (const s of specs) {
    const b = w.site.banks[s.landing];
    expect(bankValid(b, s.u)).toBe(true);
    expect(bankValid(b, s.u + s.flee)).toBe(true);
    const [lo, hi] = s.flush ? WADE.homeU : WADE.extraU;
    expect(Math.abs(s.u)).toBeGreaterThanOrEqual(lo);
    expect(Math.abs(s.u)).toBeLessThanOrEqual(hi);
    if (s.flush) {
      expect(Math.abs(s.flee)).toBeGreaterThanOrEqual(30);
      expect(Math.abs(s.flee)).toBeLessThanOrEqual(60);
    }
  }
});

test('landing birds take off within 1.5 s of dock start at their landing', () => {
  for (const landing of [0, 1] as const) {
    const d = lastDockStart(3 * L, w.T, landing, false);
    for (const s of specs.filter((x) => x.landing === landing)) {
      waderHome(s, w, home);
      wader(d - 0.1, s, w, p);
      expect(p.legs).toBe(0);
      expect(Math.abs(p.y - home[1])).toBeLessThan(0.3);
      wader(d + 1.6, s, w, p);
      if (s.flush) { expect(p.legs).toBe(1); expect(p.y).toBeGreaterThan(home[1] + 0.1); }
      else expect(p.legs).toBe(0);
    }
  }
});

test('they land 30–60 m away and are home again before the next dock there', () => {
  const d = lastDockStart(3 * L, w.T, 1, false);
  for (const s of specs.filter((x) => x.flush && x.landing === 1)) {
    waderHome(s, w, home);
    const landed = d + s.rank * WADE.stagger + Math.abs(s.flee) / WADE.flyV + 0.01;
    wader(landed, s, w, p);
    const away = Math.hypot(p.x - home[0], p.z - home[2]);
    expect(away).toBeGreaterThanOrEqual(28);
    expect(away).toBeLessThanOrEqual(62);
    wader(d + 2 * L - 0.1, s, w, p);
    expect(Math.hypot(p.x - home[0], p.z - home[2])).toBeLessThanOrEqual(WADE.step + 0.3);
  }
});

test('1986 (moored): never fly', () => {
  const m = worldFor('1986'), ms = waderSpecs(m.site, 5);
  for (let c = 0; c < 1200; c += 0.5) for (const s of ms) {
    wader(c, s, m, p);
    expect(p.legs).toBe(0);
    expect(p.fold).toBe(1);
  }
});

test('same clock, same pose', () => {
  const a = createFaunaPose();
  for (const s of specs) expect(wader(123.4, s, w, p)).toEqual(wader(123.4, s, w, a));
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/fauna/waders.test.ts`
Expected: FAIL — module `./waders` not found.

- [ ] **Step 3: Write `waders.ts`**

Create `src/fauna/waders.ts`:

```ts
import { legDuration } from '../ancon/crossing';
import { lastDockStart, u01 } from './clock';
import { smooth, yawOf, type FaunaPose } from './pose';
import { BANK_STEP, bankAt, bankValid, type BankLine, type FaunaSite, type FaunaWorld } from './site';

/**
 * Egrets and herons at the two landings (spec 5 §2, §3.1, §3.3). u is the along-bank offset from the landing (m).
 * Flushers stand 12–40 m from the pad and fly `flee` m along the bank when the ferry docks there; the last bird
 * per landing stands 42–55 m out and stays. Idle: stand, walk `step` m, stop, peck — a 20 s cycle.
 */
export const WADE = {
  homeU: [12, 40] as [number, number], extraU: [42, 55] as [number, number], flee: [30, 60] as [number, number],
  flyV: 6, flyH: 3.5, stagger: 0.45, cycle: 20, step: 1.5, flapHz: 2.4,
};
export type WaderKind = 'great' | 'snowy' | 'blue' | 'tri';
/** Scale on the great-egret model and an instance tint (white birds keep the vertex colours). Inferred (L). */
export const WADER_LOOK: Record<WaderKind, { scale: number; color: number }> = {
  great: { scale: 1, color: 0xffffff }, snowy: { scale: 0.62, color: 0xffffff },
  blue: { scale: 0.62, color: 0x4c5d80 }, tri: { scale: 0.68, color: 0x5d6782 },
};
const KINDS: WaderKind[][] = [['great', 'blue', 'snowy', 'great', 'tri'], ['snowy', 'great', 'tri', 'blue', 'great']];

export interface WaderSpec { landing: 0 | 1; kind: WaderKind; u: number; flee: number; flush: boolean; rank: number; seed: number }

/** The valid bank sample nearest `u0` with |u| in [lo, hi] on side `side`. */
function validU(b: BankLine, u0: number, side: number, lo: number, hi: number): number {
  for (let d = 0; d <= hi - lo; d += BANK_STEP) for (const u of [u0 + d, u0 - d]) {
    if (Math.abs(u) >= lo && Math.abs(u) <= hi && Math.sign(u) === side && bankValid(b, u)) return u;
  }
  throw new Error(`fauna: no bank spot for a wader near u=${u0.toFixed(1)}`);
}

export function waderSpecs(site: FaunaSite, perLanding: number): WaderSpec[] {
  const out: WaderSpec[] = [];
  for (const landing of [0, 1] as const) for (let j = 0; j < perLanding; j++) {
    const b = site.banks[landing], seed = 101 + landing * 10 + j, side = j % 2 === 0 ? 1 : -1, flush = j < perLanding - 1;
    const [lo, hi] = flush ? WADE.homeU : WADE.extraU;
    const snap = (v: number) => Math.round(v / BANK_STEP) * BANK_STEP;
    const u = validU(b, snap(side * (lo + (hi - lo) * u01(j, landing, seed))), side, lo, hi);
    let flee = side * snap(WADE.flee[0] + (WADE.flee[1] - WADE.flee[0]) * u01(j, landing + 2, seed));
    while (Math.abs(flee) > WADE.flee[0] && !bankValid(b, u + flee)) flee -= side * BANK_STEP;
    if (!bankValid(b, u + flee)) throw new Error(`fauna: no landing spot for wader ${landing}/${j}`);
    out.push({ landing, kind: KINDS[landing][j], u, flee, flush, rank: j, seed });
  }
  return out;
}

const P = [0, 0, 0];
const peck = (tau: number, t0: number) => (tau >= t0 && tau < t0 + 0.35 ? Math.sin((Math.PI * (tau - t0)) / 0.35) : 0);
export function waderHome(s: WaderSpec, w: FaunaWorld, out: number[]) { bankAt(w.site.banks[s.landing], s.u, out); }

export function wader(clock: number, s: WaderSpec, w: FaunaWorld, out: FaunaPose): FaunaPose {
  const b = w.site.banks[s.landing], lat = w.site.lateral, look = WADER_LOOK[s.kind];
  const fly = Math.abs(s.flee) / WADE.flyV;
  let u = s.u, flying = false, p = 0, tf = Infinity, walking = false, idleW = 1;
  if (s.flush && !w.moored) {
    const L = legDuration(w.T), walk = 2 * L - 10 - 40;
    tf = clock - (lastDockStart(clock, w.T, s.landing, false) + s.rank * WADE.stagger);
    if (tf < 0) tf += 2 * L;
    if (tf < fly) { flying = true; p = tf / fly; u = s.u + s.flee * smooth(p); }
    else if (tf < fly + walk) { walking = true; u = s.u + s.flee * (1 - (tf - fly) / walk); idleW = 0; }
    else idleW = smooth((tf - fly - walk) / 5);
  }
  // Idle: in cycle c walk 0 → step (c even) or back (c odd) during τ 8–12 s; pecks at τ 13 and 16 s.
  const ph = s.seed * 3.7, c = Math.floor((clock + ph) / WADE.cycle), tau = clock + ph - c * WADE.cycle, odd = (c & 1) === 1;
  const sm = smooth((tau - 8) / 4), off = WADE.step * (odd ? 1 - sm : sm);
  if (!flying) u += idleW * off;
  bankAt(b, u, P);
  const wx = -b.inland[0], wz = -b.inland[1];
  if (flying) {
    const sg = Math.sign(s.flee);
    out.x = P[0]; out.z = P[2]; out.y = P[1] + WADE.flyH * Math.sin(Math.PI * p);
    out.yaw = yawOf(lat[0] * sg, lat[1] * sg); out.pitch = 0.1; out.roll = 0;
    out.flap = 0.6 * Math.sin(2 * Math.PI * WADE.flapHz * tf); out.fold = 0; out.legs = 1;
  } else {
    let hx: number, hz: number;
    if (walking) { const sg = -Math.sign(s.flee); hx = lat[0] * sg; hz = lat[1] * sg; }
    else {
      const sPrev = odd ? 1 : -1, sCur = odd ? -1 : 1, a = 0.9 * (sPrev + (sCur - sPrev) * smooth(tau / 1.5));
      hx = wx * Math.cos(a) + lat[0] * Math.sin(a); hz = wz * Math.cos(a) + lat[1] * Math.sin(a);
    }
    out.x = P[0]; out.y = P[1]; out.z = P[2];
    out.yaw = yawOf(hx, hz); out.pitch = -0.6 * (peck(tau, 13) + peck(tau, 16)); out.roll = 0;
    out.flap = 0; out.fold = 1; out.legs = 0;
  }
  out.scale = look.scale; out.on = true;
  return out;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/fauna/waders.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/fauna/waders.ts src/fauna/waders.test.ts
git commit -m "feat(5): egrets and herons at the landings; they fly up when the ferry docks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Water life (mullet, manatee) and water rings

**Files:**
- Create: `src/fauna/waterLife.ts`, `src/fauna/rings.ts`
- Test: `src/fauna/waterLife.test.ts`

**Interfaces:**
- Consumes: `eventTime`, `u01` (Task 3); `FaunaPose`, `yawOf`, `smooth` (Task 3); `FaunaWorld`, `distToCrossing` (Task 4); `pelicanFisher`, `fisherEvents`, `fisherPlan` (Task 5); `crossingState`, `createCrossingState`, `mooredState`; `waterAt`, `WATER`.
- Produces:
  - `MULLET`, `MANATEE` constants; `interface Jump { x; z; hx; hz; h; t0: number }`.
  - `mulletJump(k: number, w: FaunaWorld, out: Jump): boolean`, `mullet(clock, w, out: FaunaPose): FaunaPose`.
  - `manateeTime(k: number): number`, `manateeSpot(k, w, out: number[]): void`, `manatee(clock, w, out: FaunaPose): FaunaPose`.
  - `RING_POOL = 12`; `ringsAt(clock: number, w: FaunaWorld, fishers: number, out: Float32Array): number` — writes `[x, z, age01, radius]` per live ring (up to `RING_POOL`), returns how many are alive (may exceed the pool; the caller draws `min(n, RING_POOL)`).

- [ ] **Step 1: Write the failing test**

Create `src/fauna/waterLife.test.ts`:

```ts
import { expect, test } from 'vitest';
import { waterAt } from '../ancon/geometry';
import { createCrossingState, crossingState } from '../ancon/crossing';
import { WATER } from '../terrain/fields';
import { fisherEvents } from './flyers';
import { createFaunaPose } from './pose';
import { RING_POOL, ringsAt } from './rings';
import { distToCrossing, FRAME_RADIUS } from './site';
import { worldFor } from './testing';
import { manatee, manateeSpot, manateeTime, MANATEE, MULLET, mullet, mulletJump, type Jump } from './waterLife';

const w = worldFor('1975'), g = w.site.geom, p = createFaunaPose();
const lateralOff = (x: number, z: number) => (x - g.shoreEast[0]) * w.site.lateral[0] + (z - g.shoreEast[1]) * w.site.lateral[1];

test('mullet: jumps 3–6 s apart, in the river, off the crossing line, within 120 m of the ferry', () => {
  const j: Jump = { x: 0, z: 0, hx: 0, hz: 0, h: 0, t0: 0 }, st = createCrossingState();
  let found = 0;
  for (let k = 0; k < 300; k++) {
    if (!mulletJump(k, w, j)) continue;
    found++;
    expect(waterAt(w.site.fields, j.x, j.z)).toBe(WATER.RIVER);
    expect(Math.abs(lateralOff(j.x, j.z))).toBeGreaterThanOrEqual(MULLET.clear);
    crossingState(j.t0, st, w.T);
    const fx = g.shoreEast[0] + g.dir[0] * g.span * st.s, fz = g.shoreEast[1] + g.dir[1] * g.span * st.s;
    expect(Math.hypot(j.x - fx, j.z - fz)).toBeLessThanOrEqual(120 + 1e-6);
    expect(j.h).toBeGreaterThanOrEqual(0.3);
    expect(j.h).toBeLessThanOrEqual(0.6);
  }
  expect(found).toBeGreaterThan(270);
});

test('mullet is visible only during a jump, and rises above the water mid-jump', () => {
  const j: Jump = { x: 0, z: 0, hx: 0, hz: 0, h: 0, t0: 0 };
  let k = 10; while (!mulletJump(k, w, j)) k++;
  expect(mullet(j.t0 + MULLET.dur / 2, w, p).on).toBe(true);
  expect(p.y).toBeGreaterThan(0.1);
  expect(mullet(j.t0 - 0.5, w, p).on).toBe(false);
});

test('manatee: surfaces 60–90 s apart, moves 5–15 m between surfacings, inside its zone', () => {
  const a = [0, 0, 0], b = [0, 0, 0];
  for (let k = 0; k < 100; k++) {
    const gap = manateeTime(k + 1) - manateeTime(k);
    expect(gap).toBeGreaterThanOrEqual(60 - 1e-9);
    expect(gap).toBeLessThanOrEqual(90 + 1e-9);
    manateeSpot(k, w, a); manateeSpot(k + 1, w, b);
    const d = Math.hypot(a[0] - b[0], a[2] - b[2]);
    expect(d).toBeGreaterThanOrEqual(5);
    expect(d).toBeLessThanOrEqual(15);
    const off = Math.abs(lateralOff(a[0], a[2]));
    expect(off).toBeGreaterThanOrEqual(40);
    expect(off).toBeLessThanOrEqual(100);
  }
  const t0 = manateeTime(5);
  expect(manatee(t0 + MANATEE.dur * 0.5, w, p).on).toBe(true);
  expect(p.y + 0.47).toBeGreaterThan(0.05);     // the back breaks the water (body half-height 0.47)
  expect(manatee(t0 - 1, w, p).on).toBe(false);
});

test('rings: every event starts one, the pool never overflows, all inside the frame', () => {
  const buf = new Float32Array(RING_POOL * 4);
  let worst = 0;
  for (let c = 0; c < 2400; c += 0.25) {
    const n = ringsAt(c, w, 2, buf);
    worst = Math.max(worst, n);
    for (let r = 0; r < Math.min(n, RING_POOL); r++) {
      expect(buf[r * 4 + 2]).toBeGreaterThanOrEqual(0);
      expect(buf[r * 4 + 2]).toBeLessThan(1);
      expect(distToCrossing(w.site, buf[r * 4], buf[r * 4 + 1])).toBeLessThan(FRAME_RADIUS);
    }
  }
  expect(worst).toBeLessThanOrEqual(RING_POOL);
  const { impact } = fisherEvents(0, 500);
  expect(ringsAt(impact + 0.1, w, 2, buf)).toBeGreaterThanOrEqual(1);
  expect(ringsAt(manateeTime(9) + 0.1 * MANATEE.dur, w, 2, buf)).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/fauna/waterLife.test.ts`
Expected: FAIL — modules `./waterLife`, `./rings` not found.

- [ ] **Step 3: Write `waterLife.ts`**

Create `src/fauna/waterLife.ts`:

```ts
import { createCrossingState, crossingState, mooredState } from '../ancon/crossing';
import { waterAt } from '../ancon/geometry';
import { WATER } from '../terrain/fields';
import { eventTime, u01 } from './clock';
import { smooth, yawOf, type FaunaPose } from './pose';
import type { FaunaWorld } from './site';

const TAU = 2 * Math.PI;
const _st = createCrossingState();

/** Mullet (spec 5 §3.2): one jump every 3–6 s, within 120 m of the ferry, never within `clear` m of the crossing line. */
export const MULLET = { period: 4.5, jitter: 0.75, dur: 0.45, len: 0.8, rMin: 20, rMax: 120, clear: 12 };
export interface Jump { x: number; z: number; hx: number; hz: number; h: number; t0: number }

/** Jump k: false when no candidate spot passes (then there is no jump k). */
export function mulletJump(k: number, w: FaunaWorld, out: Jump): boolean {
  const g = w.site.geom, lat = w.site.lateral;
  const t0 = eventTime(k, MULLET.period, MULLET.jitter, 83);
  const s = w.moored ? mooredState(_st).s : crossingState(t0, _st, w.T).s;
  const px = g.shoreEast[0] + g.dir[0] * g.span * s, pz = g.shoreEast[1] + g.dir[1] * g.span * s;
  for (let j = 0; j < 8; j++) {
    const a = TAU * u01(k, 10 + j, 83), r = MULLET.rMin + (MULLET.rMax - MULLET.rMin) * u01(k, 20 + j, 83);
    const x = px + r * Math.cos(a), z = pz + r * Math.sin(a);
    if (waterAt(w.site.fields, x, z) !== WATER.RIVER) continue;
    if (Math.abs((x - g.shoreEast[0]) * lat[0] + (z - g.shoreEast[1]) * lat[1]) < MULLET.clear) continue;
    const b = TAU * u01(k, 30 + j, 83);
    out.x = x; out.z = z; out.hx = Math.cos(b); out.hz = Math.sin(b); out.h = 0.3 + 0.3 * u01(k, 40 + j, 83); out.t0 = t0;
    return true;
  }
  return false;
}

const _j: Jump = { x: 0, z: 0, hx: 0, hz: 0, h: 0, t0: 0 };
export function mullet(clock: number, w: FaunaWorld, out: FaunaPose): FaunaPose {
  const k0 = Math.floor((clock + MULLET.jitter) / MULLET.period);
  for (let k = k0; k >= k0 - 1; k--) {
    if (!mulletJump(k, w, _j)) continue;
    const p = (clock - _j.t0) / MULLET.dur;
    if (p < 0 || p >= 1) continue;
    out.x = _j.x + _j.hx * (p - 0.5) * MULLET.len; out.z = _j.z + _j.hz * (p - 0.5) * MULLET.len;
    out.y = 4 * _j.h * p * (1 - p) - 0.12;
    out.yaw = yawOf(_j.hx, _j.hz); out.pitch = Math.atan2(4 * _j.h * (1 - 2 * p), MULLET.len); out.roll = 0;
    out.scale = 1; out.flap = 0; out.fold = 0; out.legs = 0; out.on = true;
    return out;
  }
  out.on = false;
  return out;
}

/**
 * Manatee (spec 5 §3.2): surfaces every 60–90 s at spots on an ellipse in its zone, `step` rad apart (5–15 m).
 * Snout up (first quarter), then the back rolls over and it goes down, moving `fwd` m.
 */
export const MANATEE = { period: 75, jitter: 7.5, dur: 4.2, step: 0.3, fwd: 1.5 };
export const manateeTime = (k: number) => eventTime(k, MANATEE.period, MANATEE.jitter, 89);
export function manateeSpot(k: number, w: FaunaWorld, out: number[]) {
  const { c, a, b } = w.site.manatee, d = w.site.geom.dir, l = w.site.lateral, ph = k * MANATEE.step;
  const al = a * Math.cos(ph), la = b * Math.sin(ph);
  out[0] = c[0] + d[0] * al + l[0] * la; out[1] = 0; out[2] = c[1] + d[1] * al + l[1] * la;
}
const _a = [0, 0, 0], _b = [0, 0, 0];
export function manatee(clock: number, w: FaunaWorld, out: FaunaPose): FaunaPose {
  const k0 = Math.floor((clock + MANATEE.jitter) / MANATEE.period);
  for (let k = k0; k >= k0 - 1; k--) {
    const p = (clock - manateeTime(k)) / MANATEE.dur;
    if (p < 0 || p >= 1) continue;
    manateeSpot(k, w, _a); manateeSpot(k + 1, w, _b);
    const dx = _b[0] - _a[0], dz = _b[2] - _a[2], l = Math.hypot(dx, dz) || 1, hx = dx / l, hz = dz / l;
    let y: number, pitch: number;
    if (p < 0.25) { const q = smooth(p / 0.25); y = -1.2 + 0.7 * q; pitch = 0.45 * q; }
    else { const q = (p - 0.25) / 0.75; pitch = 0.45 - 0.95 * q; y = -0.5 + 0.25 * Math.sin(Math.PI * Math.min(1, q * 1.6)) - 0.8 * q * q; }
    const f = MANATEE.fwd * smooth(p);
    out.x = _a[0] + hx * f; out.z = _a[2] + hz * f; out.y = y;
    out.yaw = yawOf(hx, hz); out.pitch = pitch; out.roll = 0; out.scale = 1; out.flap = 0; out.fold = 0; out.legs = 0; out.on = true;
    return out;
  }
  out.on = false;
  return out;
}
```

- [ ] **Step 4: Write `rings.ts`**

Create `src/fauna/rings.ts`:

```ts
import { fisherEvents, fisherPlan, pelicanFisher } from './flyers';
import { createFaunaPose } from './pose';
import type { FaunaWorld } from './site';
import { manateeSpot, manateeTime, MANATEE, MULLET, mulletJump, type Jump } from './waterLife';

/** Spec 5 §4.4: a fixed pool of rings. Worst case alive at once is ≤ 8 (see test). */
export const RING_POOL = 12;
/** [radius (m), life (s)] per ring source. */
const R = { jumpIn: [0.8, 1.5], jumpOut: [1.4, 2.0], surfA: [1.5, 2.5], surfB: [2.8, 3.0], dive: [2.5, 2.5], takeoff: [1.8, 2.0] } as const;

let n = 0;
function push(out: Float32Array, clock: number, x: number, z: number, t0: number, r: readonly [number, number]) {
  const age = clock - t0;
  if (age < 0 || age >= r[1]) return;
  if (n < RING_POOL) { out[n * 4] = x; out[n * 4 + 1] = z; out[n * 4 + 2] = age / r[1]; out[n * 4 + 3] = r[0]; }
  n++;
}

const _j: Jump = { x: 0, z: 0, hx: 0, hz: 0, h: 0, t0: 0 }, _s = [0, 0, 0], _p = createFaunaPose(), _ev = { impact: 0, takeoff: 0 };

/** Rings alive at `clock`: [x, z, age01, radius] per ring into `out`. Returns how many are alive. Allocation-free. */
export function ringsAt(clock: number, w: FaunaWorld, fishers: number, out: Float32Array): number {
  n = 0;
  // Mullet: a ring where it leaves the water and one where it falls back.
  const kHi = Math.floor((clock + MULLET.jitter) / MULLET.period), kLo = Math.floor((clock - MULLET.dur - 2 - MULLET.jitter) / MULLET.period);
  for (let k = kLo; k <= kHi; k++) {
    if (!mulletJump(k, w, _j)) continue;
    const h = MULLET.len / 2;
    push(out, clock, _j.x - _j.hx * h, _j.z - _j.hz * h, _j.t0, R.jumpIn);
    push(out, clock, _j.x + _j.hx * h, _j.z + _j.hz * h, _j.t0 + MULLET.dur, R.jumpOut);
  }
  // Manatee: the snout, then the back.
  const mHi = Math.floor((clock + MANATEE.jitter) / MANATEE.period);
  for (let k = mHi - 1; k <= mHi; k++) {
    manateeSpot(k, w, _s);
    const t0 = manateeTime(k);
    push(out, clock, _s[0], _s[2], t0 + 0.08 * MANATEE.dur, R.surfA);
    push(out, clock, _s[0], _s[2], t0 + 0.55 * MANATEE.dur, R.surfB);
  }
  // Pelican fishers: dive impact and take-off (this cycle and the one before).
  for (let i = 0; i < fishers; i++) {
    const cyc = fisherPlan(i).cycle;
    fisherEvents(i, clock - 12, _ev);
    let impact = _ev.impact, takeoff = _ev.takeoff;
    for (let c = 0; c < 2; c++, impact += cyc, takeoff += cyc) {
      pelicanFisher(impact, i, w, _p); push(out, clock, _p.x, _p.z, impact, R.dive);
      pelicanFisher(takeoff, i, w, _p); push(out, clock, _p.x, _p.z, takeoff, R.takeoff);
    }
  }
  return n;
}
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/fauna/waterLife.test.ts`
Expected: PASS. If `ringsAt` ever exceeds `RING_POOL`, raise `RING_POOL` to the reported worst case + 2 and record it under "Plan deviations".

- [ ] **Step 6: Commit**

```bash
git add src/fauna/waterLife.ts src/fauna/rings.ts src/fauna/waterLife.test.ts
git commit -m "feat(5): jumping mullet, surfacing manatee and water rings (pure schedules)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Shapes, built in code

**Files:**
- Create: `src/fauna/geometry.ts`
- Test: `src/fauna/geometry.test.ts`

**Interfaces:**
- Consumes: `colored` (`src/traffic/carKit.ts`), `segmentMatrix`, `type V3` (`src/people/rig.ts`), `mergeGeometries`.
- Produces:
  - `type Shape = 'pelican' | 'frigate' | 'wader' | 'mullet' | 'manatee' | 'ring'`.
  - `buildFaunaShape(s: Shape): THREE.BufferGeometry` — non-indexed, attributes `position`, `normal`, `color`, `aPart` (vec2: x = wing side −1/0/+1, y = leg weight 0/1); `ring` has `position`, `normal`, `uv` only.
  - `FAUNA_TRIS: Record<Shape, number>` (caps).
  - `WING_K: Record<Shape, { root: number; hinge: number; back: number }>` and `HIP: Record<Shape, [number, number]>`.

- [ ] **Step 1: Write the failing test**

Create `src/fauna/geometry.test.ts`:

```ts
import { expect, test } from 'vitest';
import { tris } from '../ancon/testing';
import { buildFaunaShape, FAUNA_TRIS, WING_K, type Shape } from './geometry';

const SHAPES: Shape[] = ['pelican', 'frigate', 'wader', 'mullet', 'manatee', 'ring'];

test('each shape stays under its triangle cap', () => {
  for (const s of SHAPES) { const g = buildFaunaShape(s); expect(tris(g), s).toBeLessThanOrEqual(FAUNA_TRIS[s]); g.dispose(); }
});

test('birds: wing vertices sit outside the wing root, on both sides; wader legs are tagged', () => {
  for (const s of ['pelican', 'frigate', 'wader'] as const) {
    const g = buildFaunaShape(s), pos = g.attributes.position, part = g.attributes.aPart;
    let left = 0, right = 0, legs = 0;
    for (let k = 0; k < pos.count; k++) {
      const wSide = part.getX(k);
      if (wSide !== 0) { expect(Math.abs(pos.getZ(k)), s).toBeGreaterThanOrEqual(WING_K[s].root - 1e-6); expect(Math.sign(pos.getZ(k))).toBe(wSide); }
      if (wSide > 0) right++; if (wSide < 0) left++;
      if (part.getY(k) > 0) legs++;
    }
    expect(left, s).toBeGreaterThan(0);
    expect(right, s).toBe(left);
    if (s === 'wader') expect(legs).toBeGreaterThan(0);
    g.dispose();
  }
});

test('sizes: pelican span ≈ 2.1 m, frigate ≈ 2.2 m, great egret ≈ 1 m tall, manatee 3–3.8 m long', () => {
  const box = (s: Shape) => { const g = buildFaunaShape(s); g.computeBoundingBox(); const b = g.boundingBox!; g.dispose(); return b; };
  expect(box('pelican').max.z * 2).toBeCloseTo(2.1, 1);
  expect(box('frigate').max.z * 2).toBeCloseTo(2.2, 1);
  expect(box('wader').max.y).toBeGreaterThan(0.95);
  expect(box('wader').max.y).toBeLessThan(1.1);
  expect(box('wader').min.y).toBeCloseTo(0, 2);
  const m = box('manatee');
  expect(m.max.x - m.min.x).toBeGreaterThan(3);
  expect(m.max.x - m.min.x).toBeLessThan(3.8);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/fauna/geometry.test.ts`
Expected: FAIL — module `./geometry` not found.

- [ ] **Step 3: Write `geometry.ts`**

Create `src/fauna/geometry.ts`:

```ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { segmentMatrix, type V3 } from '../people/rig';
import { colored } from '../traffic/carKit';

export type Shape = 'pelican' | 'frigate' | 'wader' | 'mullet' | 'manatee' | 'ring';
export const FAUNA_TRIS: Record<Shape, number> = { pelican: 700, frigate: 500, wader: 700, mullet: 150, manatee: 900, ring: 2 };
/** Wing hinge per shape: root |z| (m), hinge y, how far a folded wing tip moves back per metre of span. */
export const WING_K: Record<Shape, { root: number; hinge: number; back: number }> = {
  pelican: { root: 0.15, hinge: 0.05, back: 0.4 }, frigate: { root: 0.12, hinge: 0.02, back: 0.5 },
  wader: { root: 0.08, hinge: 0.64, back: 0.45 },
  mullet: { root: 1, hinge: 0, back: 0 }, manatee: { root: 1, hinge: 0, back: 0 }, ring: { root: 1, hinge: 0, back: 0 },
};
/** Leg pivot (x, y) — only the wader has legs. */
export const HIP: Record<Shape, [number, number]> = { pelican: [0, 0], frigate: [0, 0], wader: [-0.02, 0.5], mullet: [0, 0], manatee: [0, 0], ring: [0, 0] };

/** Colour a piece and tag it: `wing` −1/0/+1 (side), `leg` 0/1. */
function tag(g: THREE.BufferGeometry, hex: number, wing = 0, leg = 0) {
  const n = colored(g, hex), a = new Float32Array(n.attributes.position.count * 2);
  for (let i = 0; i < a.length; i += 2) { a[i] = wing; a[i + 1] = leg; }
  n.setAttribute('aPart', new THREE.BufferAttribute(a, 2));
  return n;
}
const ell = (rx: number, ry: number, rz: number, x: number, y: number, z: number, seg = 8) =>
  new THREE.SphereGeometry(1, seg, Math.max(4, seg - 3)).scale(rx, ry, rz).translate(x, y, z);
/** A tapered rod from a to b (radius r0 at a, r1 at b): unit-height cylinder (y 0 → −1) placed by segmentMatrix. */
const rod = (a: V3, b: V3, r0: number, r1: number, seg = 6) =>
  new THREE.CylinderGeometry(r0, r1, 1, seg, 1, false).translate(0, -0.5, 0).applyMatrix4(segmentMatrix(a, b, 1, 1, new THREE.Matrix4()));
const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
/** One wing: |z| root → tip, chord cRoot → cTip (x), tip swept back by `sweep`, 3 cm thick, at height y, centred on x. */
function wing(root: number, tip: number, cRoot: number, cTip: number, sweep: number, y: number, x: number, side: 1 | -1, hex: number) {
  const g = new THREE.BoxGeometry(1, 1, 1, 1, 1, 4).translate(0, 0, 0.5);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < p.count; k++) {
    const t = p.getZ(k), c = cRoot + (cTip - cRoot) * t;
    p.setXYZ(k, x + p.getX(k) * c - sweep * t, y + p.getY(k) * 0.03, side * (root + (tip - root) * t));
  }
  g.computeVertexNormals();
  return tag(g, hex, side);
}
const merge = (list: THREE.BufferGeometry[]) => { const m = mergeGeometries(list, false)!; list.forEach((g) => g.dispose()); return m; };

// Colours (linear hex, inferred L): brown pelican greys, frigate black, egret white, mullet silver, manatee grey-brown.
const PEL_BODY = 0x8a8074, PEL_HEAD = 0xe8dcb0, PEL_WING = 0x4a443c, PEL_BILL = 0x8c7a5a, PEL_POUCH = 0x6d6250;
const FRI = 0x1c1c20, FRI_BILL = 0x8a8f96, EGRET = 0xf2f2ee, BILL_Y = 0xd8b030, LEG = 0x1a1a1a, MULLET_C = 0xc8ccd0, MANATEE_C = 0x5a524a;

export function buildFaunaShape(s: Shape): THREE.BufferGeometry {
  switch (s) {
    case 'pelican': {
      const K = WING_K.pelican;
      return merge([
        tag(ell(0.55, 0.2, 0.22, 0, 0, 0, 10), PEL_BODY),
        tag(rod([0.45, 0.08, 0], [0.62, 0.2, 0], 0.08, 0.07), PEL_BODY),
        tag(ell(0.12, 0.09, 0.08, 0.68, 0.22, 0), PEL_HEAD),
        tag(rod([0.75, 0.2, 0], [1.1, 0.12, 0], 0.035, 0.015), PEL_BILL),
        tag(ell(0.16, 0.04, 0.035, 0.9, 0.13, 0), PEL_POUCH),
        tag(box(0.2, 0.03, 0.18, -0.6, 0.02, 0), PEL_WING),
        wing(K.root, 1.05, 0.42, 0.22, 0.12, K.hinge, 0.05, 1, PEL_WING),
        wing(K.root, 1.05, 0.42, 0.22, 0.12, K.hinge, 0.05, -1, PEL_WING),
      ]);
    }
    case 'frigate': {
      const K = WING_K.frigate, inner = (side: 1 | -1) => wing(K.root, 0.55, 0.3, 0.28, -0.05, K.hinge, 0, side, FRI);
      // Outer wing: from the wrist (0.55) to the tip (1.1), swept back hard — the frigatebird's bent wing.
      const outer = (side: 1 | -1) => wing(0.55, 1.1, 0.28, 0.1, 0.3, K.hinge, -0.02, side, FRI);
      return merge([
        tag(ell(0.45, 0.12, 0.12, 0, 0, 0, 8), FRI),
        tag(ell(0.08, 0.07, 0.07, 0.45, 0.04, 0), FRI),
        tag(rod([0.52, 0.04, 0], [0.7, 0.0, 0], 0.02, 0.01), FRI_BILL),
        tag(rod([-0.4, 0, 0.03], [-0.95, 0, 0.18], 0.025, 0.005, 4), FRI),
        tag(rod([-0.4, 0, -0.03], [-0.95, 0, -0.18], 0.025, 0.005, 4), FRI),
        inner(1), inner(-1), outer(1), outer(-1),
      ]);
    }
    case 'wader': {
      const K = WING_K.wader, [hx, hy] = HIP.wader;
      return merge([
        tag(rod([hx, hy, 0.05], [0, 0, 0.06], 0.012, 0.01, 5), LEG, 0, 1),
        tag(rod([hx, hy, -0.05], [0, 0, -0.06], 0.012, 0.01, 5), LEG, 0, 1),
        tag(ell(0.2, 0.11, 0.1, 0, 0.6, 0, 10), EGRET),
        tag(rod([0.15, 0.65, 0], [0.2, 0.8, 0], 0.03, 0.025), EGRET),
        tag(rod([0.2, 0.8, 0], [0.14, 0.92, 0], 0.025, 0.022), EGRET),
        tag(rod([0.14, 0.92, 0], [0.2, 1.0, 0], 0.022, 0.02), EGRET),
        tag(ell(0.05, 0.04, 0.035, 0.22, 1.0, 0), EGRET),
        tag(rod([0.26, 1.0, 0], [0.4, 0.98, 0], 0.012, 0.004, 5), BILL_Y),
        tag(box(0.12, 0.02, 0.08, -0.22, 0.6, 0), EGRET),
        wing(K.root, 0.72, 0.26, 0.14, 0.1, K.hinge, 0, 1, EGRET),
        wing(K.root, 0.72, 0.26, 0.14, 0.1, K.hinge, 0, -1, EGRET),
      ]);
    }
    case 'mullet':
      return merge([
        tag(ell(0.16, 0.035, 0.03, 0, 0, 0, 8), MULLET_C),
        tag(box(0.06, 0.07, 0.005, -0.18, 0, 0), MULLET_C),
      ]);
    case 'manatee':
      return merge([
        tag(new THREE.CapsuleGeometry(0.55, 1.9, 4, 12).rotateZ(Math.PI / 2).scale(1, 0.85, 1), MANATEE_C),
        tag(ell(0.3, 0.05, 0.4, -1.55, 0, 0), MANATEE_C),
        tag(ell(0.25, 0.22, 0.25, 1.45, -0.05, 0), MANATEE_C),
      ]);
    case 'ring':
      return new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2).toNonIndexed();
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/fauna/geometry.test.ts`
Expected: PASS. If a shape is over its cap, lower that piece's `seg` (ellipsoids 10 → 8, rods 6 → 5); do not raise the cap.

- [ ] **Step 5: Commit**

```bash
git add src/fauna/geometry.ts src/fauna/geometry.test.ts
git commit -m "feat(5): pelican, frigatebird, egret, mullet, manatee and ring shapes in code

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Wing, leg and ring materials

**Files:**
- Create: `src/fauna/material.ts`
- Test: `src/fauna/material.test.ts`

**Interfaces:**
- Consumes: `WING_K`, `HIP`, `type Shape` (Task 8); `CustomShaderMaterial` (`three-custom-shader-material/vanilla`).
- Produces:
  - `animateVertex(p: [number, number, number], part: [number, number], anim: [number, number, number], K: { root; hinge; back }, hip: [number, number]): [number, number, number]` — the TS twin of the GLSL (tests only check this; the GLSL must do the same math).
  - `faunaMaterials(s: Shape): { material: THREE.Material; depth: THREE.Material }` — per-instance attribute `aAnim` (vec3: flap, fold, legs).
  - `ringMaterial(): THREE.Material` — per-instance attribute `aRing` (float: age01).

- [ ] **Step 1: Write the failing test**

Create `src/fauna/material.test.ts`:

```ts
import { expect, test } from 'vitest';
import { HIP, WING_K } from './geometry';
import { animateVertex, faunaMaterials, ringMaterial } from './material';

const K = WING_K.wader, hip = HIP.wader;
const tip: [number, number, number] = [0, K.hinge, K.root + 0.64];

test('flap raises the wing tip; the body does not move', () => {
  const up = animateVertex(tip, [1, 0], [0.5, 0, 0], K, hip);
  expect(up[1]).toBeGreaterThan(K.hinge + 0.2);
  const body = animateVertex([0.1, 0.6, 0.05], [0, 0], [0.5, 1, 1], K, hip);
  expect(body).toEqual([0.1, 0.6, 0.05]);
});

test('fold pulls the tip in to the body side and back, and cancels the flap', () => {
  const f = animateVertex(tip, [1, 0], [0.5, 1, 0], K, hip);
  expect(f[2]).toBeLessThanOrEqual(K.root + 0.08 * 0.64 + 1e-6);
  expect(f[0]).toBeLessThan(-0.2);
  expect(f[1]).toBeCloseTo(K.hinge, 6);
});

test('left wing mirrors the right', () => {
  const r = animateVertex(tip, [1, 0], [0.4, 0.3, 0], K, hip), l = animateVertex([tip[0], tip[1], -tip[2]], [-1, 0], [0.4, 0.3, 0], K, hip);
  expect(l[0]).toBeCloseTo(r[0], 6); expect(l[1]).toBeCloseTo(r[1], 6); expect(l[2]).toBeCloseTo(-r[2], 6);
});

test('legs trail back in flight', () => {
  const foot = animateVertex([0, 0, 0.06], [0, 1], [0, 0, 1], K, hip);
  expect(foot[0]).toBeLessThan(-0.3);
  expect(foot[1]).toBeGreaterThan(0.1);
});

test('materials build', () => {
  const m = faunaMaterials('pelican'); expect(m.material).toBeTruthy(); expect(m.depth).toBeTruthy();
  m.material.dispose(); m.depth.dispose();
  const r = ringMaterial(); expect(r.transparent).toBe(true); expect(r.depthWrite).toBe(false); r.dispose();
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/fauna/material.test.ts`
Expected: FAIL — module `./material` not found.

- [ ] **Step 3: Write `material.ts`**

Create `src/fauna/material.ts`:

```ts
import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { HIP, WING_K, type Shape } from './geometry';

type K = { root: number; hinge: number; back: number };

/**
 * Wing flap/fold and leg trail, per vertex (spec 5 §4.2). part = (wing side −1/0/+1, leg 0/1);
 * anim = (flap angle rad, fold 0..1, legs 0..1). The GLSL below does the same math; keep them in step.
 */
export function animateVertex(p: [number, number, number], part: [number, number], anim: [number, number, number], k: K, hip: [number, number]): [number, number, number] {
  let [x, y, z] = p;
  if (part[0] !== 0) {
    const side = Math.sign(part[0]), d0 = Math.max(Math.abs(z) - k.root, 0), f = anim[1], a = anim[0] * (1 - f);
    const dz = d0 * (1 + (0.08 - 1) * f);
    x -= f * d0 * k.back;
    y = y + dz * Math.sin(a);
    z = side * (k.root + dz * Math.cos(a));
  }
  if (part[1] > 0) {
    const b = -1.3 * anim[2], qx = x - hip[0], qy = y - hip[1];
    x = hip[0] + qx * Math.cos(b) - qy * Math.sin(b);
    y = hip[1] + qx * Math.sin(b) + qy * Math.cos(b);
  }
  return [x, y, z];
}

const VERTEX = /* glsl */ `
uniform vec3 uWingK;   // root |z|, hinge y (unused: offsets are relative), fold-back per metre of span
uniform vec2 uHip;
attribute vec2 aPart;
attribute vec3 aAnim;  // per instance: flap angle, fold, legs
void main() {
  vec3 p = position;
  if (aPart.x != 0.0) {
    float side = sign(aPart.x);
    float d0 = max(abs(p.z) - uWingK.x, 0.0);
    float f = aAnim.y;
    float a = aAnim.x * (1.0 - f);
    float dz = d0 * mix(1.0, 0.08, f);
    p.x -= f * d0 * uWingK.z;
    p.y += dz * sin(a);
    p.z = side * (uWingK.x + dz * cos(a));
  }
  if (aPart.y > 0.0) {
    float b = -1.3 * aAnim.z;
    vec2 q = p.xy - uHip;
    p.xy = uHip + vec2(q.x * cos(b) - q.y * sin(b), q.x * sin(b) + q.y * cos(b));
  }
  csm_Position = p;
}`;

/** Lit, vertex-coloured bird/fish/manatee material plus its depth twin (so shadows fold and flap too). */
export function faunaMaterials(s: Shape): { material: THREE.Material; depth: THREE.Material } {
  const k = WING_K[s], uniforms = { uWingK: { value: new THREE.Vector3(k.root, k.hinge, k.back) }, uHip: { value: new THREE.Vector2(...HIP[s]) } };
  const material = new CustomShaderMaterial({
    baseMaterial: THREE.MeshStandardMaterial, vertexShader: VERTEX, uniforms,
    vertexColors: true, roughness: s === 'mullet' ? 0.35 : 0.85, metalness: 0, side: THREE.DoubleSide,
  });
  const depth = new CustomShaderMaterial({
    baseMaterial: THREE.MeshDepthMaterial, vertexShader: VERTEX, uniforms, depthPacking: THREE.RGBADepthPacking,
  });
  return { material, depth };
}

/** Water ring: a flat quad; an annulus grows from 15 % to the full radius and fades over its life (per-instance aRing = age01). */
export function ringMaterial(): THREE.Material {
  return new CustomShaderMaterial({
    baseMaterial: THREE.MeshBasicMaterial,
    vertexShader: /* glsl */ `
      attribute float aRing;
      varying vec2 vRingUv; varying float vAge;
      void main() { vRingUv = uv; vAge = aRing; }`,
    fragmentShader: /* glsl */ `
      varying vec2 vRingUv; varying float vAge;
      void main() {
        float r = length(vRingUv * 2.0 - 1.0);
        float R = mix(0.15, 1.0, sqrt(vAge));
        float w = 0.06 + 0.05 * vAge;
        float ring = 1.0 - smoothstep(0.0, w, abs(r - R));
        float a = ring * (1.0 - vAge) * 0.55;
        if (a < 0.003) discard;
        csm_DiffuseColor = vec4(0.92, 0.95, 0.97, a);
      }`,
    transparent: true, depthWrite: false,
  });
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/fauna/material.test.ts`
Expected: PASS. If constructing `CustomShaderMaterial` fails in node, check how `src/vegetation/*.test.ts` builds plant materials and follow the same pattern (or `vi.mock` it as `src/traffic/TrafficSet.test.ts` mocks `./materials`); keep the `animateVertex` tests unmocked.

- [ ] **Step 5: Commit**

```bash
git add src/fauna/material.ts src/fauna/material.test.ts
git commit -m "feat(5): wing flap/fold and leg trail in the vertex shader; water ring material

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: FaunaSet, the React mount and the budget

**Files:**
- Create: `src/fauna/FaunaSet.ts`, `src/fauna/Fauna.tsx`
- Modify: `src/quality.ts` (add `fauna` to `QualitySettings` and each tier)
- Modify: `src/scene/World.tsx` (mount `<Fauna>`)
- Test: `src/fauna/FaunaSet.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 3–9; `reflectionHooks` (`src/scene/water/reflectionHooks.ts`); `sharedVesselPose` (`src/ancon/vesselPose.ts`); `advanceClock`, `defaultCrossingStart`; `useStore`; `placementFields`; `vesselSpec`; `eraTimings`; `sampleField`.
- Produces:
  - `QualitySettings.fauna: { flock: number; fishers: number; frigates: number; wadersPerLanding: number }`.
  - `class FaunaSet { readonly group: THREE.Group; readonly rings: THREE.InstancedMesh; constructor(w: FaunaWorld, counts: QualitySettings['fauna'], castShadow: boolean); update(clock: number): void; dispose(): void }`.
  - `Fauna({ near, era, q, castShadow })` React component.

- [ ] **Step 1: Add the tier counts**

In `src/quality.ts`, in `interface QualitySettings`, after the `traffic` line add:

```ts
  /** Phase 5: animals per tier (spec 5 §2). Mullet and manatee are on every tier. */
  fauna: { flock: number; fishers: number; frigates: number; wadersPerLanding: number };
```

and add to each tier object, after `traffic: { … }`:

- high: `fauna: { flock: 4, fishers: 2, frigates: 3, wadersPerLanding: 5 }`
- medium: `fauna: { flock: 4, fishers: 2, frigates: 3, wadersPerLanding: 5 }`
- low: `fauna: { flock: 2, fishers: 1, frigates: 2, wadersPerLanding: 3 }`

- [ ] **Step 2: Write the failing test**

Create `src/fauna/FaunaSet.test.ts`:

```ts
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { tris } from '../ancon/testing';
import { ERA_IDS } from '../data/eras';
import { QUALITY } from '../quality';
import { FaunaSet } from './FaunaSet';
import { worldFor } from './testing';

const meshesOf = (s: FaunaSet) => s.group.children.filter((o): o is THREE.InstancedMesh => (o as THREE.InstancedMesh).isInstancedMesh);

test('budget (spec 5 §5): at most 8 meshes and 30 000 triangles on high, in every era', () => {
  for (const id of ERA_IDS) {
    const set = new FaunaSet(worldFor(id), QUALITY.high.fauna, true), ms = meshesOf(set);
    expect(ms.length, id).toBeLessThanOrEqual(8);
    let worst = 0;
    for (let c = 0; c < 400; c += 0.5) {
      set.update(c);
      worst = Math.max(worst, ms.reduce((n, m) => n + (m.visible ? m.count * tris(m.geometry) : 0), 0));
    }
    expect(worst, id).toBeLessThanOrEqual(30_000);
    set.dispose();
  }
});

test('counts per tier match spec 5 §2 (birds always on)', () => {
  for (const tier of ['high', 'medium', 'low'] as const) {
    const f = QUALITY[tier].fauna, set = new FaunaSet(worldFor('1975'), f, false);
    set.update(100);
    const [pel, fri, wad] = meshesOf(set);
    expect(pel.count).toBe(f.flock + f.fishers);
    expect(fri.count).toBe(f.frigates);
    expect(wad.count).toBe(2 * f.wadersPerLanding);
    set.dispose();
  }
});

test('only waders cast shadows; rings are hidden in the reflection pass', () => {
  const set = new FaunaSet(worldFor('1975'), QUALITY.high.fauna, true), ms = meshesOf(set);
  expect(ms.filter((m) => m.castShadow).map((m) => m.name)).toEqual(['wader']);
  set.update(100);
  set.beforeReflection(); expect(set.rings.visible).toBe(false);
  set.afterReflection(); expect(set.rings.visible).toBe(set.rings.count > 0);
  set.dispose();
});

test('same clock, same matrices', () => {
  const a = new FaunaSet(worldFor('1959'), QUALITY.high.fauna, false), b = new FaunaSet(worldFor('1959'), QUALITY.high.fauna, false);
  a.update(321.5); b.update(321.5);
  const ma = meshesOf(a), mb = meshesOf(b);
  for (let i = 0; i < ma.length; i++) expect(Array.from(ma[i].instanceMatrix.array)).toEqual(Array.from(mb[i].instanceMatrix.array));
  a.dispose(); b.dispose();
});
```

- [ ] **Step 3: Run to see it fail**

Run: `npx vitest run src/fauna/FaunaSet.test.ts`
Expected: FAIL — module `./FaunaSet` not found.

- [ ] **Step 4: Write `FaunaSet.ts`**

Create `src/fauna/FaunaSet.ts`:

```ts
import * as THREE from 'three';
import type { QualitySettings } from '../quality';
import { frigate, pelicanFisher, pelicanFlock } from './flyers';
import { buildFaunaShape, type Shape } from './geometry';
import { faunaMaterials, ringMaterial } from './material';
import { createFaunaPose, type FaunaPose } from './pose';
import { RING_POOL, ringsAt } from './rings';
import type { FaunaWorld } from './site';
import { WADER_LOOK, wader, waderSpecs, type WaderSpec } from './waders';
import { manatee, mullet } from './waterLife';

type Counts = QualitySettings['fauna'];

/** One InstancedMesh per shape (spec 5 §4.2): pelican, frigate, wader, mullet, manatee, ring. Allocation-free update. */
export class FaunaSet {
  readonly group = new THREE.Group();
  readonly rings: THREE.InstancedMesh;
  private readonly meshes: Record<Exclude<Shape, 'ring'>, THREE.InstancedMesh>;
  private readonly anim: Record<Exclude<Shape, 'ring'>, THREE.InstancedBufferAttribute>;
  private readonly ringAge: THREE.InstancedBufferAttribute;
  private readonly waders: WaderSpec[];
  private readonly mats: THREE.Material[] = [];
  private readonly pose: FaunaPose = createFaunaPose();
  private readonly ringBuf = new Float32Array(RING_POOL * 4);
  private readonly m = new THREE.Matrix4(); private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YZX'); private readonly p = new THREE.Vector3(); private readonly s = new THREE.Vector3();

  constructor(private readonly w: FaunaWorld, private readonly counts: Counts, castShadow: boolean) {
    this.waders = waderSpecs(w.site, counts.wadersPerLanding);
    const cap = { pelican: counts.flock + counts.fishers, frigate: counts.frigates, wader: this.waders.length, mullet: 1, manatee: 1 };
    const make = (shape: Exclude<Shape, 'ring'>) => {
      const g = buildFaunaShape(shape), n = Math.max(1, cap[shape]);
      const a = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aAnim', a);
      const { material, depth } = faunaMaterials(shape);
      this.mats.push(material, depth);
      const mesh = new THREE.InstancedMesh(g, material, n);
      mesh.name = shape; mesh.customDepthMaterial = depth;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = castShadow && shape === 'wader'; mesh.receiveShadow = false;
      mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false;
      this.group.add(mesh);
      return [mesh, a] as const;
    };
    const [pel, aPel] = make('pelican'), [fri, aFri] = make('frigate'), [wad, aWad] = make('wader'), [mul, aMul] = make('mullet'), [man, aMan] = make('manatee');
    this.meshes = { pelican: pel, frigate: fri, wader: wad, mullet: mul, manatee: man };
    this.anim = { pelican: aPel, frigate: aFri, wader: aWad, mullet: aMul, manatee: aMan };
    const c = new THREE.Color();
    this.waders.forEach((ws, i) => wad.setColorAt(i, c.setHex(WADER_LOOK[ws.kind].color)));
    if (wad.instanceColor) wad.instanceColor.needsUpdate = true;

    const rg = buildFaunaShape('ring');
    this.ringAge = new THREE.InstancedBufferAttribute(new Float32Array(RING_POOL), 1).setUsage(THREE.DynamicDrawUsage);
    rg.setAttribute('aRing', this.ringAge);
    const rm = ringMaterial(); this.mats.push(rm);
    this.rings = new THREE.InstancedMesh(rg, rm, RING_POOL);
    this.rings.name = 'ring'; this.rings.renderOrder = 1; this.rings.frustumCulled = false; this.rings.count = 0; this.rings.visible = false;
    this.rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.rings);
  }

  private put(shape: Exclude<Shape, 'ring'>, i: number) {
    const o = this.pose, mesh = this.meshes[shape], a = this.anim[shape];
    this.e.set(o.roll, o.yaw, o.pitch); this.q.setFromEuler(this.e);
    this.m.compose(this.p.set(o.x, o.y, o.z), this.q, this.s.setScalar(o.scale));
    mesh.setMatrixAt(i, this.m);
    a.setXYZ(i, o.flap, o.fold, o.legs);
    return i + 1;
  }
  private done(shape: Exclude<Shape, 'ring'>, used: number) {
    const mesh = this.meshes[shape];
    mesh.count = used; mesh.visible = used > 0;
    mesh.instanceMatrix.needsUpdate = true; this.anim[shape].needsUpdate = true;
  }

  update(clock: number) {
    const w = this.w, o = this.pose, c = this.counts;
    let n = 0;
    for (let i = 0; i < c.flock; i++) { pelicanFlock(clock, i, w, o); n = this.put('pelican', n); }
    for (let i = 0; i < Math.min(c.fishers, w.site.fishers.length); i++) { pelicanFisher(clock, i, w, o); n = this.put('pelican', n); }
    this.done('pelican', n);
    n = 0; for (let i = 0; i < c.frigates; i++) { frigate(clock, i, w, o); n = this.put('frigate', n); }
    this.done('frigate', n);
    n = 0; for (const ws of this.waders) { wader(clock, ws, w, o); n = this.put('wader', n); }
    this.done('wader', n);
    n = 0; if (mullet(clock, w, o).on) n = this.put('mullet', n);
    this.done('mullet', n);
    n = 0; if (manatee(clock, w, o).on) n = this.put('manatee', n);
    this.done('manatee', n);

    const live = Math.min(RING_POOL, ringsAt(clock, w, Math.min(c.fishers, w.site.fishers.length), this.ringBuf)), b = this.ringBuf;
    for (let r = 0; r < live; r++) {
      this.m.makeScale(b[r * 4 + 3], 1, b[r * 4 + 3]).setPosition(b[r * 4], 0.02, b[r * 4 + 1]);
      this.rings.setMatrixAt(r, this.m);
      this.ringAge.setX(r, b[r * 4 + 2]);
    }
    this.rings.count = live; this.rings.visible = live > 0;
    this.rings.instanceMatrix.needsUpdate = true; this.ringAge.needsUpdate = true;
  }

  /** Reflection pass: rings lie on the mirror plane — hide them there. */
  beforeReflection = () => { this.rings.visible = false; };
  afterReflection = () => { this.rings.visible = this.rings.count > 0; };

  dispose() {
    for (const o of [...this.group.children]) {
      const mesh = o as THREE.InstancedMesh;
      mesh.geometry.dispose(); mesh.dispose(); this.group.remove(mesh);
    }
    this.mats.forEach((m) => m.dispose());
  }
}
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/fauna/FaunaSet.test.ts`
Expected: PASS.

- [ ] **Step 6: Write `Fauna.tsx`**

Create `src/fauna/Fauna.tsx`:

```tsx
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { advanceClock, defaultCrossingStart } from '../ancon/crossing';
import { vesselSpec } from '../ancon/spec';
import { sharedVesselPose } from '../ancon/vesselPose';
import type { Era } from '../data/eras';
import type { QualitySettings } from '../quality';
import { reflectionHooks } from '../scene/water/reflectionHooks';
import { useStore } from '../state/store';
import { sampleField, type WorldFields } from '../terrain/fields';
import { placementFields } from '../terrain/placementFields';
import { eraTimings } from '../traffic/schedule';
import { FaunaSet } from './FaunaSet';
import { faunaSite } from './site';

/**
 * Phase 5 animals. Driven by the crossing clock: <Ancon> (useFrame priority −1) updates sharedVesselPose.clock
 * before this priority-0 callback runs. With the ferry hidden (?ancon=0) it keeps its own copy of that clock.
 */
export function Fauna({ near, era, q, castShadow }: { near: WorldFields; era: Era; q: QualitySettings; castShadow: boolean }) {
  const bank = era.river.bankOffset.value;
  const place = useMemo(() => placementFields(bank, near), [bank, near]);
  const spec = useMemo(() => vesselSpec(era, eraTimings(era, place)), [era, place]);
  const site = useMemo(() => faunaSite(place, (x, z) => sampleField(near, near.height, x, z)), [place, near]);
  const set = useMemo(() => new FaunaSet({ site, T: spec.timings, moored: spec.moored }, q.fauna, castShadow), [site, spec, q.fauna, castShadow]);
  useEffect(() => {
    reflectionHooks.before.add(set.beforeReflection); reflectionHooks.after.add(set.afterReflection);
    return () => { reflectionHooks.before.delete(set.beforeReflection); reflectionHooks.after.delete(set.afterReflection); set.dispose(); };
  }, [set]);
  const start = useStore((s) => s.crossingStart), speed = useStore((s) => s.crossingSpeed);
  const frozen = useStore((s) => s.frozen), showAncon = useStore((s) => s.showAncon);
  const own = useRef(start ?? defaultCrossingStart(spec.timings));
  useEffect(() => { own.current = start ?? defaultCrossingStart(spec.timings); }, [start]);
  useFrame((_, dt) => {
    own.current = advanceClock(own.current, Math.min(dt, 0.1), frozen, speed);
    set.update(showAncon ? sharedVesselPose.clock : own.current);
  });
  return <primitive object={set.group} />;
}
```

- [ ] **Step 7: Mount it**

In `src/scene/World.tsx`, add `import { Fauna } from '../fauna/Fauna';` with the other imports, and after the `<Town … />` line add:

```tsx
      <Fauna near={near} era={era} q={q} castShadow={q.shadowMap > 0} />
```

- [ ] **Step 8: Typecheck, all tests, and a look**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass.

Run `npm run dev`, open `http://localhost:5173/ancon-de-loiza/?era=1975&cam=ride` and watch one full crossing: no console errors; pelicans cross the view; frigatebirds high up; egrets at both landings fly up when the ferry docks; rings on the water. Take one screenshot with `node scripts/dev/shot.mjs "?era=1975&cam=ride&c=181&freeze=1&q=high" /tmp/fauna-check.png` and look at it.

- [ ] **Step 9: Commit**

```bash
git add src/quality.ts src/scene/World.tsx src/fauna/FaunaSet.ts src/fauna/Fauna.tsx src/fauna/FaunaSet.test.ts
git commit -m "feat(5): FaunaSet and <Fauna> — animals in the scene on the crossing clock

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Shots, art gate, frame rate, fact check, review

**Files:**
- Modify: `tests/e2e/world.spec.ts` (fauna shots)
- Modify: `docs/superpowers/notes/phase-5-rulings.md`

**Interfaces:**
- Consumes: `fisherEvents` (`src/fauna/flyers.ts`), `manateeTime`, `MANATEE` (`src/fauna/waterLife.ts`), `DOCK_STOPS`, `CROSSING_TIMINGS`.

- [ ] **Step 1: Add the fauna shots**

In `tests/e2e/world.spec.ts`, add imports:

```ts
import { fisherEvents } from '../../src/fauna/flyers';
import { MANATEE, manateeTime } from '../../src/fauna/waterLife';
```

After the `at` helper, add:

```ts
/** Phase 5: 2 s after the ferry starts docking at the west landing on leg 0 (the ride view faces it). */
const flushAt = (era: EraId) => DOCK_STOPS[era].load + T.castOff + T.cross + 2;
/** First manatee surfacing (mid-roll) and pelican-fisher dive (0.3 s after impact) after clock 300. */
const manateeAt = () => { let k = Math.ceil(300 / MANATEE.period); return Math.round((manateeTime(k) + 0.5 * MANATEE.dur) * 10) / 10; };
const diveAt = () => Math.round((fisherEvents(0, 300).impact + 0.3) * 10) / 10;
```

Append to `SHOTS`:

```ts
  { era: '1975', cam: 'ride', t: golden('1975'), c: flushAt('1975'), name: '1975-ride-flush' },
  { era: '1840', cam: 'ride', t: golden('1840'), c: flushAt('1840'), name: '1840-ride-flush' },
  { era: '1975', cam: 'ride', t: golden('1975'), c: manateeAt(), name: '1975-ride-manatee' },
  { era: '1975', cam: 'ride', t: golden('1975'), c: diveAt(), name: '1975-ride-dive' },
```

Run: `npx playwright test tests/e2e/world.spec.ts --list`
Expected: the previous count + 4.

- [ ] **Step 2: Take the shots**

Run: `npx playwright test tests/e2e/world.spec.ts --grep-invert @slow`
Expected: all pass (no console errors); PNGs in `tests/snapshots/phase5/`.

If the manatee or the dive is outside the ride frame, try later events (`manateeTime(k + 1)`, `fisherEvents(0, 400)`, …) until one is in frame, or switch that shot's `cam` to `mouth`; write which one and why under "Art gate".

- [ ] **Step 3: Art gate**

Compare `tests/snapshots/phase5/` with `tests/snapshots/phase5-before/` and read every new shot against the quality-bar image (see memory `quality-bar`) and research §6. Checklist:

- white egrets read against the bank; dark herons are visible but not black holes
- flushed birds fly low along the bank, legs trailing, wings open
- pelicans look like pelicans at 50–150 m (heavy body, long bill); frigatebirds are thin black crosses high up
- no bird inside a tree, the ferry, a car or a person; no bird under the ground
- rings are faint, not bright white discs; none in the water reflection
- the manatee's back and the mullet are small and subtle
- colours hold at golden hour and at noon

Fix what fails (geometry colours, ring alpha, heights) and re-shoot. Record fixes under "Art gate" in the rulings note.

- [ ] **Step 4: Frame rate after**

With `npm run build && npm run preview` running, rerun the Task 1 queries. Add a table under "Frame rate — after": query, tier, baseline mean ms, after mean ms, change %. If any tier is more than 5 % slower, build the Task 1 commit in a scratch worktree, serve it on :4174, and measure back to back (interleaved base, after, base, after; `BASE=http://localhost:4174/ancon-de-loiza/ node scripts/dev/perf.mjs …`). If it still fails, stop and report with the numbers.

- [ ] **Step 5: Fact check**

Dispatch a general-purpose review agent with: spec §6, the three new facts (text from `src/data/facts.ts`), research §6 and §1.2, and `src/data/sources.ts`. Ask it to open S4, S17, S18 and S22 and return only facts that are unconfirmed or wrong, with the source text it found (or "blocked" if the source does not open). Add a "Fact check" section to the rulings note in the 4c format: one summary line (N confirmed, N unconfirmed, N wrong, N blocked), then "Flagged for the user" items. Fix wording the agent shows to be wrong.

- [ ] **Step 6: Code review**

Use superpowers:requesting-code-review over `git diff main...HEAD`. Fix Critical and Important items. Minor items go under "Deferred".

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/world.spec.ts tests/snapshots/phase5 docs/superpowers/notes/phase-5-rulings.md
git commit -m "docs(5): shots, art gate, frame rate, fact check and review

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Hand back to the user**

Report: what each era shows, the frame-rate table, flagged facts, deferred items. Do not merge; the user approves first.
