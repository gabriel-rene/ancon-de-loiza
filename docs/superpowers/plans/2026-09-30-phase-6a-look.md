# Phase 6a — Look (timeline, era dip, camera modes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 8-button decade rail with a true-scale timeline, fade between eras (dip and swap), and give visitors three camera views (Ride / Shore / Sky) with a 360° look that stays where they leave it.

**Architecture:** All new logic lives in small pure modules with unit tests (`timelineLayout.ts`, `eraDip.ts`, `views.ts`, the `RideRig` changes); React components only wire them to the DOM, the store and camera-controls. The dip overlay and timeline are HTML over the canvas (no new draw calls). Era changes go through one controller (`dipController.ts`) so every input (tap, drag, arrow keys) shares the same fade.

**Tech Stack:** React 19, @react-three/fiber 9, drei `CameraControls` (camera-controls), three 0.186, zustand 5, vitest (+ jsdom for components), Playwright.

**Spec:** [`docs/superpowers/specs/2026-09-30-phase-6a-design.md`](../specs/2026-09-30-phase-6a-design.md) — read it first; it holds the user rulings, including three amendments made while planning (§2.1 label spread, §4.1 dev flag, §4.3 Shore turns in place).

## Global Constraints

- Branch `phase-6a-look`. Merge to `main` only after the user approves.
- No new draw calls in the 3D scene; no new downloaded files; no new npm dependencies.
- Frame rate on every tier within **5 %** of the Phase 5 numbers, in each of the 3 views.
- Every UI string is bilingual (`{ es, en }`), shown through `useT()`.
- `prefers-reduced-motion: reduce` → no dip overlay, camera jumps instead of gliding, smooth scroll becomes instant.
- Touch targets ≥ 44 px tall. Focus rings stay visible (`outline: 2px solid #f2c46d`).
- Keyboard handlers ignore events with `defaultPrevented`, `altKey`, `metaKey`, `ctrlKey`, or a typing target (`isTypingTarget` in `src/ui/picker.ts`).
- Commit messages: `feat(6a): …`, `test(6a): …`, `docs(6a): …`; end each with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run `npm test` (vitest) after each task; it must stay green. Run `npx tsc -p tsconfig.json --noEmit` before each commit.

## File map

| File | Status | Job |
|---|---|---|
| `src/state/url.ts` | modify | view names, aliases, dev-flag gate, `canonicalSearch` |
| `src/state/store.ts` | modify | `offFront`, `recenterSeq`, `recenter()` |
| `src/main.tsx` | modify | rewrite the URL to canonical view names at boot |
| `src/ui/motion.ts` | create | `prefersReducedMotion()` |
| `src/scene/views.ts` | create | view poses, per-view control limits, front/off-front math, glide curve, view keys |
| `src/ancon/rideCamera.ts` | modify | remove ease-back; add `recenter()` and `offFront` to `RideRig`; export `wrapPi` |
| `src/scene/Cameras.tsx` | modify | per-view input mapping, glide into Ride, keep the ride angle across eras, recenter, off-front reporting |
| `src/ui/ViewSwitch.tsx` | create | Ride/Shore/Sky buttons, Recenter button, keys 1/2/3/R |
| `src/ui/Toolbar.tsx` | modify | render `<ViewSwitch />` |
| `src/i18n/strings.ts` | modify | view names, recenter, era-change announcement |
| `src/ui/picker.ts` | modify | `withCam` |
| `src/ui/eraDip.ts` | create | pure dip state machine |
| `src/ui/dipController.ts` | create | the one dip instance, rAF loop, `requestEra`, `pendingEra`, `useDip` |
| `src/ui/EraDip.tsx` | create | overlay, frame signal (inside Canvas), screen-reader announcer |
| `src/ui/timelineLayout.ts` | create | year → x, label spread, nearest mark |
| `src/ui/Timeline.tsx` | create | the timeline (replaces `DecadePicker.tsx`) |
| `src/ui/DecadePicker.tsx` | delete | replaced |
| `src/App.tsx` | modify | mount Timeline, overlay, announcer, frame signal |
| `src/styles.css` | modify | timeline, overlay, view switch, sr-only; remove `.decade-rail*` |
| `scripts/dev/leak.mjs` | modify | `.decade-rail__btn` → `.timeline__btn` |
| `tests/e2e/picker.spec.ts` | modify | dip, phone strip, reduced motion |
| `tests/e2e/views.spec.ts` | create | view switch, keys, alias, recenter, dev gate |
| `docs/superpowers/notes/phase-6a-rulings.md` | create | frame-rate numbers, art-check notes |

---

### Task 1: View names, URL aliases and the dev-flag gate

**Files:**
- Modify: `src/state/url.ts`
- Modify: `src/state/store.ts`
- Modify: `src/main.tsx`
- Test: `src/state/url.test.ts`, `src/state/store.test.ts`

**Interfaces:**
- Produces: `type PublicView = 'ride' | 'shore' | 'sky'`; `type DevView`; `type CameraPreset = PublicView | DevView`; `PUBLIC_VIEWS: PublicView[]`; `DEV_VIEWS: DevView[]`; `CAMERA_PRESETS` (public then dev); `VIEW_ALIASES`; `isPublicView(c): c is PublicView`; `canonicalSearch(search: string): string | null`.
- Produces on the store: `offFront: boolean`, `setOffFront(v: boolean)`, `recenterSeq: number`, `recenter()`. `setCamera` also clears `offFront`.

- [ ] **Step 1: Write the failing tests** — append to `src/state/url.test.ts` and change the existing round-trip test's `camera: 'bank'` to `camera: 'shore'`:

```ts
import { canonicalSearch, parseUrlState, toSearch } from './url';

test('old view names load as the new ones', () => {
  expect(parseUrlState('?cam=bank')).toEqual({ camera: 'shore' });
  expect(parseUrlState('?cam=aerial')).toEqual({ camera: 'sky' });
  expect(parseUrlState('?cam=shore')).toEqual({ camera: 'shore' });
  expect(parseUrlState('?cam=sky')).toEqual({ camera: 'sky' });
  expect(parseUrlState('?cam=toString')).toEqual({});
});
test('dev views need ?debug=1 or ?freeze=1', () => {
  expect(parseUrlState('?cam=fields')).toEqual({});
  expect(parseUrlState('?cam=fields&debug=1')).toEqual({ camera: 'fields', debug: true });
  expect(parseUrlState('?cam=town&freeze=1')).toEqual({ camera: 'town', frozen: true });
});
test('canonicalSearch rewrites aliases, drops gated views, leaves good URLs alone', () => {
  expect(canonicalSearch('?era=1975&cam=bank&q=low')).toBe('?era=1975&cam=shore&q=low');
  expect(canonicalSearch('?cam=farm&era=1900')).toBe('?era=1900');
  expect(canonicalSearch('?cam=sky')).toBeNull();
  expect(canonicalSearch('?era=1840')).toBeNull();
  expect(canonicalSearch('?cam=farm&debug=1')).toBeNull();
});
```

Append to `src/state/store.test.ts`:

```ts
test('recenter bumps a counter; off-front is set only on change and cleared by a view change', () => {
  const st = useStore.getState(), seq = st.recenterSeq;
  st.recenter();
  expect(useStore.getState().recenterSeq).toBe(seq + 1);
  st.setOffFront(true);
  const snap = useStore.getState();
  snap.setOffFront(true);
  expect(useStore.getState()).toBe(snap);          // no new state object when nothing changes
  st.setCamera('sky');
  expect(useStore.getState().offFront).toBe(false);
  st.setCamera('ride');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/state`
Expected: FAIL (`canonicalSearch` not exported; `recenter` not a function; `cam=bank` parses as `bank`).

- [ ] **Step 3: Implement** — in `src/state/url.ts` replace the two `CameraPreset` lines with:

```ts
export type PublicView = 'ride' | 'shore' | 'sky';
export type DevView = 'mouth' | 'fields' | 'farm' | 'station' | 'bridge' | 'town';
export type CameraPreset = PublicView | DevView;
/** The three views a visitor can pick (spec 6a §4.1). */
export const PUBLIC_VIEWS: PublicView[] = ['ride', 'shore', 'sky'];
/** Dev views: only with ?debug=1 or ?freeze=1 (spec 6a §4.1). */
export const DEV_VIEWS: DevView[] = ['mouth', 'fields', 'farm', 'station', 'bridge', 'town'];
export const CAMERA_PRESETS: CameraPreset[] = [...PUBLIC_VIEWS, ...DEV_VIEWS];
/** Phase 6a renamed two views; old links still load. */
export const VIEW_ALIASES: Readonly<Record<string, PublicView>> = { bank: 'shore', aerial: 'sky' };
export const isPublicView = (c: CameraPreset): c is PublicView => (PUBLIC_VIEWS as string[]).includes(c);
```

In `parseUrlState`, replace the two `cam` lines with:

```ts
  const cam = p.get('cam');
  const named = cam !== null && Object.hasOwn(VIEW_ALIASES, cam) ? VIEW_ALIASES[cam] : cam;
  const devOk = p.get('debug') === '1' || p.get('freeze') === '1';
  if (named && (PUBLIC_VIEWS as string[]).includes(named)) out.camera = named as CameraPreset;
  else if (named && devOk && (DEV_VIEWS as string[]).includes(named)) out.camera = named as CameraPreset;
```

Add after `toSearch`:

```ts
/** `search` with `cam` rewritten to what parseUrlState loads (alias → new name; a rejected view dropped); null when nothing changes. */
export function canonicalSearch(search: string): string | null {
  const p = new URLSearchParams(search), cam = p.get('cam');
  if (cam === null) return null;
  const loaded = parseUrlState(search).camera;
  if (loaded === cam) return null;
  if (loaded) p.set('cam', loaded); else p.delete('cam');
  return `?${p.toString()}`;
}
```

In `src/state/store.ts` add to `AppState`:

```ts
  /** The visitor has turned or zoomed away from the view's front framing (shows Recenter). */
  offFront: boolean; setOffFront: (v: boolean) => void;
  /** Bumped by recenter(); Cameras glides back to the front framing on each bump. */
  recenterSeq: number; recenter: () => void;
```

and to the initial state / actions (`offFront: false, recenterSeq: 0,` next to `lang`), replacing `setCamera`:

```ts
  setCamera: (camera) => set({ camera, offFront: false }),
  setOffFront: (offFront) => set((s) => (s.offFront === offFront ? s : { offFront })),
  recenter: () => set((s) => ({ recenterSeq: s.recenterSeq + 1 })),
```

In `src/main.tsx`, before `createRoot`:

```ts
import { canonicalSearch } from './state/url';

// Old view names (?cam=bank|aerial) and gated dev views: show the URL the app actually loaded (spec 6a §4.1).
const fixed = canonicalSearch(window.location.search);
if (fixed !== null) window.history.replaceState(null, '', fixed + window.location.hash);
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/state && npx tsc -p tsconfig.json --noEmit`
Expected: PASS. `tsc` will report `Cameras.tsx` (`bank`/`aerial` keys) — fix that in Task 2; if you commit now, temporarily rename the two keys in `CAMERA_POSES` to `shore` and `sky`.

- [ ] **Step 5: Commit**

```bash
git add src/state src/main.tsx src/scene/Cameras.tsx
git commit -m "feat(6a): Ride/Shore/Sky view names, old-name aliases, dev views behind a dev flag"
```

---

### Task 2: View poses and camera math (`views.ts`, `motion.ts`)

**Files:**
- Create: `src/scene/views.ts`, `src/ui/motion.ts`
- Modify: `src/ancon/rideCamera.ts` (export `wrapPi`; add `frontEps` to `RIDE_ORBIT`)
- Modify: `src/scene/Cameras.tsx` (import `VIEW_POSES` instead of its own `CAMERA_POSES`)
- Test: `src/scene/views.test.ts`

**Interfaces:**
- Consumes: `CameraPreset`, `PublicView` (Task 1); `RIDE_ORBIT` from `src/ancon/rideCamera.ts`; `smooth`, `clamp01` from `src/ancon/ease.ts`.
- Produces:
  - `interface ViewPose { pos: [number, number, number]; target: [number, number, number] }`
  - `VIEW_POSES: Record<CameraPreset, ViewPose>`
  - `LOOK_IN_PLACE = 1` (m, Shore's target distance)
  - `interface ControlLimits { minPolar; maxPolar; minDistance; maxDistance; minZoom; maxZoom; rotateSpeed: number; lookInPlace: boolean; pan: boolean }`
  - `controlLimits(view: CameraPreset, riding: boolean): ControlLimits`
  - `interface Front { az: number; pol: number; dist: number }`; `frontOf(p: ViewPose): Front`
  - `isOffFront(f: Front, az: number, pol: number, dist: number, zoom: number): boolean`
  - `VIEW_GLIDE_S = 1.5`; `glideK(seconds: number): number` (0→1, smoothstep)
  - `VIEW_KEYS: Readonly<Record<string, PublicView>>` (`'1'|'2'|'3'`)
  - `prefersReducedMotion(): boolean` (in `src/ui/motion.ts`)
  - `wrapPi(a: number): number` exported from `rideCamera.ts`; `RIDE_ORBIT.frontEps = 0.02`

- [ ] **Step 1: Write the failing test** `src/scene/views.test.ts`:

```ts
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { RIDE_ORBIT } from '../ancon/rideCamera';
import { PUBLIC_VIEWS } from '../state/url';
import { controlLimits, frontOf, glideK, isOffFront, LOOK_IN_PLACE, VIEW_GLIDE_S, VIEW_KEYS, VIEW_POSES } from './views';

const dist = (p: { pos: number[]; target: number[] }) => Math.hypot(p.pos[0] - p.target[0], p.pos[1] - p.target[1], p.pos[2] - p.target[2]);

test('Shore turns in place: its target is LOOK_IN_PLACE ahead of the eye, inside its zoom and polar limits', () => {
  const p = VIEW_POSES.shore, L = controlLimits('shore', true), f = frontOf(p);
  expect(dist(p)).toBeCloseTo(LOOK_IN_PLACE, 9);
  expect([L.minDistance, L.maxDistance]).toEqual([LOOK_IN_PLACE, LOOK_IN_PLACE]);
  expect([L.minZoom, L.maxZoom]).toEqual([1, 1.3]);
  expect(L.lookInPlace).toBe(true);
  expect(f.pol).toBeGreaterThan(L.minPolar); expect(f.pol).toBeLessThan(L.maxPolar);
});
test('Sky orbits its target with ±30 % zoom; its front is inside its polar limits', () => {
  const L = controlLimits('sky', true), f = frontOf(VIEW_POSES.sky), d = dist(VIEW_POSES.sky);
  expect(L.minDistance).toBeCloseTo(0.7 * d, 6); expect(L.maxDistance).toBeCloseTo(1.3 * d, 6);
  expect(f.pol).toBeGreaterThan(L.minPolar); expect(f.pol).toBeLessThan(L.maxPolar);
});
test('public views never pan; dev views and ride without the ferry keep the free controls', () => {
  for (const v of PUBLIC_VIEWS) expect(controlLimits(v, true).pan, v).toBe(false);
  expect(controlLimits('fields', true).pan).toBe(true);
  expect(controlLimits('ride', false).pan).toBe(true);
  expect(controlLimits('ride', true).minPolar).toBeCloseTo(RIDE_ORBIT.minPolar - 0.02, 9);
});
test('off-front: any turn, tilt, zoom or lens zoom past the threshold; a full turn is not off-front', () => {
  const f = frontOf(VIEW_POSES.sky);
  expect(isOffFront(f, f.az, f.pol, f.dist, 1)).toBe(false);
  expect(isOffFront(f, f.az + 2 * Math.PI, f.pol, f.dist, 1)).toBe(false);
  expect(isOffFront(f, f.az + 0.1, f.pol, f.dist, 1)).toBe(true);
  expect(isOffFront(f, f.az, f.pol - 0.1, f.dist, 1)).toBe(true);
  expect(isOffFront(f, f.az, f.pol, f.dist * 1.1, 1)).toBe(true);
  expect(isOffFront(f, f.az, f.pol, f.dist, 1.1)).toBe(true);
});
test('frontOf matches camera-controls angles (three.Spherical, Y up)', () => {
  const p = VIEW_POSES.sky, s = new THREE.Spherical().setFromVector3(new THREE.Vector3(p.pos[0] - p.target[0], p.pos[1] - p.target[1], p.pos[2] - p.target[2]));
  expect(frontOf(p)).toEqual({ az: s.theta, pol: s.phi, dist: s.radius });
});
test('glide eases from 0 to 1 over VIEW_GLIDE_S', () => {
  expect(glideK(0)).toBe(0); expect(glideK(VIEW_GLIDE_S)).toBe(1); expect(glideK(99)).toBe(1);
  expect(glideK(VIEW_GLIDE_S / 2)).toBeCloseTo(0.5, 9);
});
test('keys 1, 2, 3 pick Ride, Shore, Sky', () => {
  expect(VIEW_KEYS).toEqual({ '1': 'ride', '2': 'shore', '3': 'sky' });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/scene/views.test.ts`
Expected: FAIL (module `./views` not found).

- [ ] **Step 3: Implement**

In `src/ancon/rideCamera.ts`: change `const wrapPi = …` to `export const wrapPi = …`, and add `frontEps: 0.02,` to `RIDE_ORBIT` with the comment `/** Offset (rad, or log-scale) past which the view counts as turned away from the front (shows Recenter). */`.

Create `src/ui/motion.ts`:

```ts
/** True when the visitor asked the system for less motion (no dip, no glides, instant scroll). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

Create `src/scene/views.ts` (the dev poses are copied unchanged from `CAMERA_POSES` in `Cameras.tsx`; Shore is the old `bank` eye turned into a look-in-place pose; Sky is the old `aerial`):

```ts
import * as THREE from 'three';
import { RIDE_ORBIT, wrapPi } from '../ancon/rideCamera';
import { clamp01, smooth } from '../ancon/ease';
import { landmarkXZ } from '../data/landmarks';
import type { CameraPreset, PublicView } from '../state/url';

export interface ViewPose { pos: [number, number, number]; target: [number, number, number] }

const [ex, ez] = landmarkXZ('eastLanding');
const [wx, wz] = landmarkXZ('westLanding');
const [mx, mz] = landmarkXZ('mouth');

/** Shore's target distance (m): orbiting a target this close turns the view in place (spec 6a §4.3). */
export const LOOK_IN_PLACE = 1;

/** A pose at `pos` looking toward `toward`, with the target LOOK_IN_PLACE ahead of the eye. */
function inPlace(pos: [number, number, number], toward: [number, number, number]): ViewPose {
  const d = new THREE.Vector3(toward[0] - pos[0], toward[1] - pos[1], toward[2] - pos[2]).setLength(LOOK_IN_PLACE);
  return { pos, target: [pos[0] + d.x, pos[1] + d.y, pos[2] + d.z] };
}

export const VIEW_POSES: Record<CameraPreset, ViewPose> = {
  // Fallback for `ride` when the ferry is hidden (?ancon=0): behind and above mid-river, looking at the far landing.
  ride: { pos: [ex * 0.35, 4.2, ez * 0.35], target: [wx, 1.5, wz] },
  // Standing at the Loíza landing, eye height, looking across at the far landing (was `bank`).
  shore: inPlace([ex + 10, 3.6, ez + 8], [wx - 40, 2.5, wz - 30]),
  // High above the river, looking at the crossing (was `aerial`).
  sky: { pos: [520, 380, 640], target: [0, 0, 0] },
  mouth: { pos: [mx - 180, 22, mz + 260], target: [mx, 0, mz] },
  // Dev view (phase 2c): over the west bank, looking south-west across the grassland (cane land).
  fields: { pos: [-500, 170, 250], target: [-1800, 0, 1500] },
  // Dev preset: 150 m out, 60 m up, looking at the farm block centred at (160, -400).
  farm: { pos: [265, 60, -295], target: [160, 0, -400] },
  // Dev view (phase 4a): from the river, looking at the Loíza landing, the station and its road.
  station: { pos: [ex * 0.3, 6, ez * 0.3], target: [ex + 12, 2, ez + 10] },
  // Dev view (phase 4a): from the Loíza bank, looking upstream at the PR-187 bridge line.
  bridge: { pos: [60, 30, 230], target: [-164, 4, 120] },
  // Dev view (phase 4b): low over the river, looking past the station at the town and church (≈ 285, 171).
  town: { pos: [ex * 0.3, 5, ez * 0.3], target: [285, 6, 171] },
};

export interface ControlLimits {
  minPolar: number; maxPolar: number; minDistance: number; maxDistance: number; minZoom: number; maxZoom: number;
  /** camera-controls azimuth/polar rotate speed; negative for Shore so a drag "grabs the world". */
  rotateSpeed: number;
  /** Shore: wheel and pinch zoom the lens instead of dollying. */
  lookInPlace: boolean;
  /** Truck/pan allowed (dev views only). */
  pan: boolean;
}

/** Sky's zoom range: ± this share of its start distance; Shore's lens zoom goes to 1 + this. */
export const VIEW_ZOOM = 0.3;
const distOf = (p: ViewPose) => Math.hypot(p.pos[0] - p.target[0], p.pos[1] - p.target[1], p.pos[2] - p.target[2]);

/** Input limits per view (spec 6a §4.3). `riding`: Ride with the ferry shown (else Ride uses its fixed fallback pose). */
export function controlLimits(view: CameraPreset, riding: boolean): ControlLimits {
  const base = { minZoom: 1, maxZoom: 1, rotateSpeed: 1, lookInPlace: false, pan: false };
  if (view === 'ride' && riding) {
    // A little outside the rig's own limits, so the controls never re-clamp what the rig sets.
    return { ...base, minPolar: RIDE_ORBIT.minPolar - 0.02, maxPolar: RIDE_ORBIT.maxPolar + 0.02, minDistance: 1, maxDistance: 6000 };
  }
  if (view === 'shore') {
    return { ...base, minPolar: 0.4 * Math.PI, maxPolar: 0.56 * Math.PI, minDistance: LOOK_IN_PLACE, maxDistance: LOOK_IN_PLACE,
      maxZoom: 1 + VIEW_ZOOM, rotateSpeed: -0.3, lookInPlace: true };
  }
  if (view === 'sky') {
    const r = distOf(VIEW_POSES.sky);
    return { ...base, minPolar: 0.25 * Math.PI, maxPolar: 0.42 * Math.PI, minDistance: r * (1 - VIEW_ZOOM), maxDistance: r * (1 + VIEW_ZOOM) };
  }
  // Dev views and Ride without the ferry (?ancon=0): the free controls of earlier phases.
  return { ...base, minPolar: 0, maxPolar: Math.PI * 0.495, minDistance: 1, maxDistance: 6000, pan: true };
}

export interface Front { az: number; pol: number; dist: number }
/** The front framing of a pose in camera-controls terms (three.Spherical of pos − target, Y up). */
export function frontOf(p: ViewPose): Front {
  const s = new THREE.Spherical().setFromVector3(new THREE.Vector3(p.pos[0] - p.target[0], p.pos[1] - p.target[1], p.pos[2] - p.target[2]));
  return { az: s.theta, pol: s.phi, dist: s.radius };
}

/** True when the camera has turned, tilted or zoomed away from `f` (spec 6a §4.2: shows Recenter). */
export function isOffFront(f: Front, az: number, pol: number, dist: number, zoom: number): boolean {
  const e = RIDE_ORBIT.frontEps;
  return Math.abs(wrapPi(az - f.az)) > e || Math.abs(pol - f.pol) > e || Math.abs(Math.log(dist / f.dist)) > e || Math.abs(zoom - 1) > e;
}

/** Seconds a view change glides for (spec 6a §4.2). */
export const VIEW_GLIDE_S = 1.5;
/** Glide progress 0 → 1 at `seconds` into a view change. */
export const glideK = (seconds: number) => smooth(clamp01(seconds / VIEW_GLIDE_S));

/** Keys 1, 2, 3 (spec 6a §4.2). */
export const VIEW_KEYS: Readonly<Record<string, PublicView>> = { '1': 'ride', '2': 'shore', '3': 'sky' };
```

In `src/scene/Cameras.tsx`: delete `CAMERA_POSES` and the three `landmarkXZ` lines; import `{ VIEW_POSES } from './views'`; replace `CAMERA_POSES[preset]` with `VIEW_POSES[preset]`. (Task 4 rewrites the rest of this file.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/scene/views.test.ts && npm test && npx tsc -p tsconfig.json --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scene/views.ts src/scene/views.test.ts src/ui/motion.ts src/ancon/rideCamera.ts src/scene/Cameras.tsx
git commit -m "feat(6a): view poses and per-view control limits; Shore turns in place"
```

---

### Task 3: Ride angle stays where left; recenter

**Files:**
- Modify: `src/ancon/rideCamera.ts`
- Test: `src/ancon/rideCamera.test.ts`

**Interfaces:**
- Consumes: `wrapPi`, `RIDE_ORBIT.frontEps` (Task 2).
- Produces: `RideRig.recenter(instant: boolean): void`; `get RideRig.offFront: boolean`; `RIDE_ORBIT.recenterTau = 0.25`. `RideRig.frame(pose, ctx, userEye, userTarget, dragging, dt)` keeps its signature; `idle`, `returnDelay`, `returnRamp`, `returnTau` are removed.

- [ ] **Step 1: Write the failing tests** — in `src/ancon/rideCamera.test.ts`, replace the test `'a drag orbits within the polar limits, holds ~1 s after release, then eases back smoothly'` with:

```ts
/** Drags the rig by (dTheta, dPhi) per frame for `n` frames from `clock`; returns the new clock. */
function drag(rig: RideRig, clock: number, n: number, dTheta: number, dPhi: number, dt = 1 / 60) {
  const user = new THREE.Vector3(), v = new THREE.Vector3(), sph = new THREE.Spherical();
  for (let i = 0; i < n; i++) {
    clock += dt;
    sph.setFromVector3(v.subVectors(rig.eye, rig.pivot)); sph.theta += dTheta; sph.phi += dPhi;
    user.setFromSpherical(sph).add(rig.pivot);
    rig.frame(poseAt2(clock), ctx, user, rig.pivot, true, dt);
    sph.setFromVector3(v.subVectors(rig.eye, rig.pivot));
    expect(sph.phi).toBeLessThanOrEqual(RIDE_ORBIT.maxPolar + 1e-9);
    expect(rig.eye.y).toBeGreaterThanOrEqual(WATER_Y + RIDE_ORBIT.waterClear - 1e-9);
  }
  return clock;
}

test('a drag orbits within the polar limits and the angle stays where it was left (spec 6a §4.2)', () => {
  const rig = new RideRig(), dt = 1 / 60;
  let clock = 60;
  rig.frame(poseAt2(clock), ctx, null, null, false, dt);
  expect(rig.offFront).toBe(false);
  clock = drag(rig, clock, 30, 0.04, 0.05);
  expect(rig.orbit.az).toBeCloseTo(1.2, 6);
  expect(rig.offFront).toBe(true);
  for (let i = 0; i < 10 / dt; i++) { clock += dt; rig.frame(poseAt2(clock), ctx, rig.eye, rig.pivot, false, dt); }
  expect(rig.orbit.az).toBeCloseTo(1.2, 6);   // 10 s idle: no ease-back
  expect(rig.offFront).toBe(true);
});

test('recenter glides the offset back to the front without a jump; instant recenter snaps', () => {
  const rig = new RideRig(), dt = 1 / 60, prev = new THREE.Vector3();
  let clock = 60;
  rig.frame(poseAt2(clock), ctx, null, null, false, dt);
  clock = drag(rig, clock, 30, 0.04, 0.05);
  rig.recenter(false);
  let maxStep = 0;
  for (let i = 0; i < 3 / dt; i++) {
    clock += dt; prev.copy(rig.eye);
    rig.frame(poseAt2(clock), ctx, rig.eye, rig.pivot, false, dt);
    maxStep = Math.max(maxStep, rig.eye.distanceTo(prev));
  }
  expect(Math.abs(rig.orbit.az) + Math.abs(rig.orbit.pol) + Math.abs(rig.orbit.logScale)).toBe(0);
  expect(rig.offFront).toBe(false);
  expect(maxStep).toBeLessThan(1.5);   // a quick glide (τ 0.25 s round an ~18 m orbit), not a one-frame snap
  clock = drag(rig, clock, 30, 0.04, 0);
  rig.recenter(true);
  rig.frame(poseAt2(clock + dt), ctx, rig.eye, rig.pivot, false, dt);
  expect(Math.abs(rig.orbit.az)).toBe(0);
});

test('new input cancels a recenter in progress', () => {
  const rig = new RideRig(), dt = 1 / 60;
  let clock = 60;
  rig.frame(poseAt2(clock), ctx, null, null, false, dt);
  clock = drag(rig, clock, 30, 0.04, 0);
  rig.recenter(false);
  clock += dt; rig.frame(poseAt2(clock), ctx, rig.eye, rig.pivot, false, dt);
  clock = drag(rig, clock, 10, 0.04, 0);
  const az = rig.orbit.az;
  for (let i = 0; i < 120; i++) { clock += dt; rig.frame(poseAt2(clock), ctx, rig.eye, rig.pivot, false, dt); }
  expect(rig.orbit.az).toBeCloseTo(az, 9);
});

test('a spin of several turns recenters the short way', () => {
  const rig = new RideRig(), dt = 1 / 60;
  let clock = 60;
  rig.frame(poseAt2(clock), ctx, null, null, false, dt);
  clock = drag(rig, clock, 160, 0.1, 0);            // 16 rad ≈ 2.5 turns
  rig.recenter(false);
  let worst = 0;
  for (let i = 0; i < 3 / dt; i++) { clock += dt; rig.frame(poseAt2(clock), ctx, rig.eye, rig.pivot, false, dt); worst = Math.max(worst, Math.abs(rig.orbit.az)); }
  expect(worst).toBeLessThanOrEqual(Math.PI + 1e-9);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/ancon/rideCamera.test.ts`
Expected: FAIL (`offFront` undefined; az decays; `recenter` not a function).

- [ ] **Step 3: Implement** in `src/ancon/rideCamera.ts`:

Replace the doc line `About 1 s after the last input the orbit eases back to the canonical framing.` with `The offset stays where the visitor leaves it; recenter() glides it back (spec 6a §4.2).`

In `RIDE_ORBIT` replace the `returnDelay…` line and its comment with:

```ts
  /** Recenter glide time constant (s). */
  recenterTau: 0.25,
```

In `RideRig`: delete `idle` and its comment; add

```ts
  private returning = false;

  /** Glide the user's offset back to the front framing; `instant` (reduced motion) snaps. New input cancels it. */
  recenter(instant: boolean) {
    if (instant) { this.orbit.az = 0; this.orbit.pol = 0; this.orbit.logScale = 0; this.returning = false; }
    else this.returning = true;
  }

  /** True when the offset is past RIDE_ORBIT.frontEps (shows Recenter). */
  get offFront() {
    const o = this.orbit, e = RIDE_ORBIT.frontEps;
    return Math.abs(wrapPi(o.az)) > e || Math.abs(o.pol) > e || Math.abs(o.logScale) > e;
  }
```

Replace the input/idle/return block at the top of `frame` (from `if (this.has && userEye …` through the closing `}` of `if (this.idle > R.returnDelay)`) with:

```ts
    let input = dragging;
    if (this.has && userEye && userTarget) {
      this.sph.setFromVector3(this.v.subVectors(userEye, userTarget));
      const dAz = wrapPi(this.sph.theta - this.last.theta), dPol = this.sph.phi - this.last.phi;
      const dS = Math.log(Math.max(this.sph.radius, 1e-6) / Math.max(this.last.radius, 1e-6));
      if (Math.abs(dAz) + Math.abs(dPol) + Math.abs(dS) > 1e-7) { o.az += dAz; o.pol += dPol; o.logScale += dS; input = true; }
    }
    if (input) this.returning = false;
    if (this.returning) {
      const k = Math.exp(-dt / R.recenterTau);
      o.az = wrapPi(o.az) * k; o.pol *= k; o.logScale *= k;
      if (Math.abs(o.az) + Math.abs(o.pol) + Math.abs(o.logScale) < 1e-4) { o.az = 0; o.pol = 0; o.logScale = 0; this.returning = false; }
    }
```

Remove the now-unused `clamp01`/`sm` imports only if nothing else in the file uses them (`rideYaw` uses `sm`; `ridePivot` uses `clamp01` — keep both).

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ancon && npx tsc -p tsconfig.json --noEmit`
Expected: PASS. (`Cameras.tsx` no longer reads `idle`; if `tsc` flags it, Task 4 replaces that code — change it now to not reference `idle`.)

- [ ] **Step 5: Commit**

```bash
git add src/ancon/rideCamera.ts src/ancon/rideCamera.test.ts
git commit -m "feat(6a): ride angle stays where the visitor leaves it; recenter glide"
```

---

### Task 4: Cameras — per-view input, glides, recenter, off-front

**Files:**
- Modify: `src/scene/Cameras.tsx` (full rewrite below)

**Interfaces:**
- Consumes: `VIEW_POSES`, `controlLimits`, `frontOf`, `isOffFront`, `glideK` (Task 2); `RideRig.recenter`, `RideRig.offFront` (Task 3); store `recenterSeq`, `setOffFront` (Task 1); `prefersReducedMotion` (Task 2).
- Produces: behaviour only (no new exports besides `Cameras`).

This component drives camera-controls inside the R3F canvas; it has no unit test of its own (its math is tested in Tasks 2–3). It is verified by the e2e test in Task 10 and by hand here.

- [ ] **Step 1: Replace `src/scene/Cameras.tsx`** with:

```tsx
import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RideRig } from '../ancon/rideCamera';
import { onVesselPose } from '../ancon/vesselPose';
import { useStore } from '../state/store';
import { prefersReducedMotion } from '../ui/motion';
import { controlLimits, frontOf, glideK, isOffFront, VIEW_POSES } from './views';

export function Cameras() {
  const ref = useRef<CameraControls>(null);
  const preset = useStore((s) => s.camera);
  const eraId = useStore((s) => s.eraId);
  const riding = useStore((s) => s.camera === 'ride' && s.showAncon);
  const recenterSeq = useStore((s) => s.recenterSeq);
  const first = useRef(true);
  /** The ride camera's state; kept across era changes (the angle survives the dip), dropped when leaving Ride. */
  const rig = useRef<RideRig | null>(null);
  const lim = controlLimits(preset, riding);

  // Input mapping (spec 6a §4.3): public views turn and zoom only; Shore zooms the lens and "grabs the world".
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const { ACTION } = CameraControlsImpl, mb = c.mouseButtons, t = c.touches;
    const saved = { middle: mb.middle, right: mb.right, wheel: mb.wheel, two: t.two, three: t.three, az: c.azimuthRotateSpeed, pol: c.polarRotateSpeed };
    if (!lim.pan) {
      const zoom = lim.lookInPlace;
      mb.right = ACTION.NONE; t.three = ACTION.NONE;
      mb.middle = zoom ? ACTION.ZOOM : ACTION.DOLLY; mb.wheel = zoom ? ACTION.ZOOM : ACTION.DOLLY;
      t.two = zoom ? ACTION.TOUCH_ZOOM : ACTION.TOUCH_DOLLY;
    }
    c.azimuthRotateSpeed = lim.rotateSpeed; c.polarRotateSpeed = lim.rotateSpeed;
    return () => {
      mb.middle = saved.middle; mb.right = saved.right; mb.wheel = saved.wheel; t.two = saved.two; t.three = saved.three;
      c.azimuthRotateSpeed = saved.az; c.polarRotateSpeed = saved.pol;
    };
  }, [lim.pan, lim.lookInPlace, lim.rotateSpeed]);

  // Fixed views (and Ride when the ferry is hidden with ?ancon=0): glide to the pose; Recenter re-runs this.
  useEffect(() => {
    const c = ref.current;
    if (riding || !c) return;
    const p = VIEW_POSES[preset], smooth = !first.current && !prefersReducedMotion();
    void c.setLookAt(...p.pos, ...p.target, smooth);
    void c.zoomTo(1, smooth);
    first.current = false;
    useStore.getState().setOffFront(false);
  }, [preset, riding, recenterSeq]);

  // Fixed views: report whether the visitor has turned away from the front (shows Recenter).
  useEffect(() => {
    const c = ref.current;
    if (riding || !c) return;
    const f = frontOf(VIEW_POSES[preset]);
    const check = () => useStore.getState().setOffFront(
      isOffFront(f, c.azimuthAngle, c.polarAngle, c.distance, (c.camera as THREE.PerspectiveCamera).zoom));
    c.addEventListener('sleep', check); c.addEventListener('controlend', check);
    return () => { c.removeEventListener('sleep', check); c.removeEventListener('controlend', check); };
  }, [preset, riding]);

  // Leaving Ride drops the rig: coming back starts at the front framing.
  useEffect(() => { if (!riding) rig.current = null; }, [riding]);

  // Ride: the vessel carries the camera; runs right after <Ancon> updates the pose each frame, so the camera
  // never lags the hull. Entering Ride from another view glides in over VIEW_GLIDE_S; an era change does not move it.
  useEffect(() => {
    const c = ref.current;
    if (!riding || !c) return;
    const entering = rig.current === null;
    if (entering) rig.current = new RideRig();
    const r = rig.current!;
    const eye = new THREE.Vector3(), tgt = new THREE.Vector3();
    const fromEye = c.getPosition(new THREE.Vector3()), fromTgt = c.getTarget(new THREE.Vector3());
    const t0 = performance.now();
    // While gliding the rig gets no input (the blended camera is not a user orbit); the first settled frame neither.
    let settled = !(entering && !first.current && !prefersReducedMotion());
    let dragging = false, last = -1, off = r.offFront;
    useStore.getState().setOffFront(off);
    const start = () => { dragging = true; }, end = () => { dragging = false; };
    c.addEventListener('controlstart', start); c.addEventListener('controlend', end);
    const offPose = onVesselPose((pose, ctx) => {
      const now = performance.now(), dt = last < 0 ? 0 : Math.min((now - last) / 1000, 0.1);
      last = now;
      const k = settled ? 1 : glideK((now - t0) / 1000);
      r.frame(pose, ctx, settled ? c.getPosition(eye, true) : null, settled ? c.getTarget(tgt, true) : null, dragging, dt);
      eye.lerpVectors(fromEye, r.eye, k); tgt.lerpVectors(fromTgt, r.pivot, k);
      if (settled) { eye.copy(r.eye); tgt.copy(r.pivot); }
      void c.setLookAt(eye.x, eye.y, eye.z, tgt.x, tgt.y, tgt.z, false);
      c.update(0);
      if (k >= 1) settled = true;
      first.current = false;
      if (r.offFront !== off) { off = r.offFront; useStore.getState().setOffFront(off); }
    });
    return () => { offPose(); c.removeEventListener('controlstart', start); c.removeEventListener('controlend', end); };
  }, [riding, eraId]);

  // Ride recenter (the fixed views recenter through the pose effect above).
  useEffect(() => {
    if (recenterSeq > 0 && riding) rig.current?.recenter(prefersReducedMotion());
  }, [recenterSeq, riding]);

  return (
    <CameraControls ref={ref} makeDefault minDistance={lim.minDistance} maxDistance={lim.maxDistance}
      minPolarAngle={lim.minPolar} maxPolarAngle={lim.maxPolar} minZoom={lim.minZoom} maxZoom={lim.maxZoom} />
  );
}
```

Note on the last two effects: `[recenterSeq, riding]` also fires when `riding` changes with an old `recenterSeq`; that is harmless (`rig.current` is a fresh rig, offset already 0).

- [ ] **Step 2: Type-check and run all unit tests**

Run: `npx tsc -p tsconfig.json --noEmit && npm test`
Expected: PASS.

- [ ] **Step 3: Check by hand**

Run `npm run dev`, open each URL with the built-in browser, and check:
- `http://localhost:5173/ancon-de-loiza/?cam=ride` — drag 180°: the view stays there after release (wait 5 s). Right-drag does nothing.
- In the DevTools console: `(await import('/src/state/store.ts')).useStore.getState().recenter()` — the view glides back in well under a second.
- `?cam=shore` — drag: the view turns in place (the eye does not move off the bank); wheel zooms the lens up to 1.3× only.
- `?cam=sky` — drag 360°: it orbits the crossing; wheel zoom stops at ±30 %; it cannot go below about 45° from straight down nor flat to the horizon.
- `?cam=fields&debug=1` — right-drag pans (dev view keeps free controls).
- Switch Ride → Sky → Ride with `useStore.getState().setCamera(...)`: both changes glide; the Ride entry has no jump at the end.

- [ ] **Step 4: Commit**

```bash
git add src/scene/Cameras.tsx
git commit -m "feat(6a): per-view camera input, glide into Ride, recenter, off-front reporting"
```

---

### Task 5: View switch, Recenter button and keys

**Files:**
- Create: `src/ui/ViewSwitch.tsx`
- Modify: `src/ui/Toolbar.tsx`, `src/ui/picker.ts`, `src/i18n/strings.ts`, `src/styles.css`
- Test: `src/ui/ViewSwitch.test.tsx`, `src/ui/picker.test.ts`

**Interfaces:**
- Consumes: `PUBLIC_VIEWS`, `PublicView` (Task 1); `VIEW_KEYS` (Task 2); store `camera`, `setCamera`, `offFront`, `recenter` (Task 1); `isTypingTarget` (`src/ui/picker.ts`).
- Produces: `ViewSwitch` component; `chooseView(v: PublicView): void`; `withCam(search: string, cam: string): string`; strings `STRINGS.view`, `STRINGS.recenter`, `VIEW_NAMES: Record<PublicView, Bilingual>`.

- [ ] **Step 1: Write the failing tests**

Append to `src/ui/picker.test.ts`:

```ts
import { withCam } from './picker';
test('withCam sets cam and keeps other params', () => {
  expect(withCam('?era=1984&cam=ride&q=low', 'sky')).toBe('?era=1984&cam=sky&q=low');
  expect(withCam('', 'shore')).toBe('?cam=shore');
});
```

Create `src/ui/ViewSwitch.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { useStore } from '../state/store';
import { ViewSwitch } from './ViewSwitch';

beforeEach(() => {
  window.history.replaceState(null, '', '/?era=1935&cam=ride');
  act(() => { useStore.getState().setLang('en'); useStore.getState().setCamera('ride'); useStore.getState().setOffFront(false); });
});
afterEach(cleanup);

test('three buttons, the current view pressed; a click switches view and URL', () => {
  render(<ViewSwitch />);
  const g = screen.getByRole('group', { name: 'View' });
  expect(within(g).getAllByRole('button').map((b) => b.textContent)).toEqual(['Ride', 'Shore', 'Sky']);
  expect(within(g).getByRole('button', { name: 'Ride' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(within(g).getByRole('button', { name: 'Sky' }));
  expect(useStore.getState().camera).toBe('sky');
  expect(window.location.search).toBe('?era=1935&cam=sky');
  expect(within(g).getByRole('button', { name: 'Sky' }).getAttribute('aria-pressed')).toBe('true');
});
test('keys 1/2/3 pick views; ignored while typing or with a modifier', () => {
  render(<ViewSwitch />);
  fireEvent.keyDown(window, { key: '2' });
  expect(useStore.getState().camera).toBe('shore');
  fireEvent.keyDown(window, { key: '3', ctrlKey: true });
  expect(useStore.getState().camera).toBe('shore');
  const input = document.createElement('input'); document.body.appendChild(input);
  fireEvent.keyDown(input, { key: '3' });
  expect(useStore.getState().camera).toBe('shore');
  input.remove();
  fireEvent.keyDown(window, { key: '1' });
  expect(useStore.getState().camera).toBe('ride');
});
test('Recenter shows only when off-front; the button and R both recenter', () => {
  render(<ViewSwitch />);
  expect(screen.queryByRole('button', { name: 'Recenter' })).toBeNull();
  act(() => useStore.getState().setOffFront(true));
  const seq = useStore.getState().recenterSeq;
  fireEvent.click(screen.getByRole('button', { name: 'Recenter' }));
  expect(useStore.getState().recenterSeq).toBe(seq + 1);
  fireEvent.keyDown(window, { key: 'r' });
  expect(useStore.getState().recenterSeq).toBe(seq + 2);
});
test('Spanish labels', () => {
  act(() => useStore.getState().setLang('es'));
  render(<ViewSwitch />);
  const g = screen.getByRole('group', { name: 'Vista' });
  expect(within(g).getAllByRole('button').map((b) => b.textContent)).toEqual(['Paseo', 'Orilla', 'Cielo']);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/ui/ViewSwitch.test.tsx src/ui/picker.test.ts`
Expected: FAIL (module not found; `withCam` not exported).

- [ ] **Step 3: Implement**

`src/ui/picker.ts` — add:

```ts
/** New search string with `cam` set; other params survive. */
export function withCam(search: string, cam: string): string {
  const p = new URLSearchParams(search);
  p.set('cam', cam);
  return `?${p.toString()}`;
}
```

`src/i18n/strings.ts` — add to `STRINGS`:

```ts
  view: { es: 'Vista', en: 'View' },
  recenter: { es: 'Centrar', en: 'Recenter' },
  nowShowing: { es: 'Ahora:', en: 'Now showing:' },
```

and after `STRINGS`:

```ts
/** Camera view names (spec 6a §4.2). */
export const VIEW_NAMES: Record<'ride' | 'shore' | 'sky', Bilingual> = {
  ride: { es: 'Paseo', en: 'Ride' },
  shore: { es: 'Orilla', en: 'Shore' },
  sky: { es: 'Cielo', en: 'Sky' },
};
```

Create `src/ui/ViewSwitch.tsx`:

```tsx
import { useEffect } from 'react';
import { STRINGS, VIEW_NAMES } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { VIEW_KEYS } from '../scene/views';
import { useStore } from '../state/store';
import { PUBLIC_VIEWS, type PublicView } from '../state/url';
import { isTypingTarget, withCam } from './picker';

/** Switches to `v` and keeps ?cam in the URL in sync (spec 6a §4.2). */
export function chooseView(v: PublicView) {
  const st = useStore.getState();
  if (st.camera === v) return;
  st.setCamera(v);
  window.history.replaceState(null, '', withCam(window.location.search, v));
}

/** Ride / Shore / Sky buttons, keys 1/2/3, and Recenter (button while off-front, key R). */
export function ViewSwitch() {
  const t = useT();
  const camera = useStore((s) => s.camera);
  const offFront = useStore((s) => s.offFront);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || isTypingTarget(e.target)) return;
      const v = Object.hasOwn(VIEW_KEYS, e.key) ? VIEW_KEYS[e.key] : undefined;
      if (v) { chooseView(v); e.preventDefault(); }
      else if (e.key === 'r' || e.key === 'R') { useStore.getState().recenter(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <div className="toolbar__group" role="group" aria-label={t(STRINGS.view)}>
        {PUBLIC_VIEWS.map((v, i) => (
          <button key={v} type="button" className="toolbar__btn toolbar__btn--seg" aria-pressed={camera === v}
            aria-keyshortcuts={String(i + 1)} onClick={() => chooseView(v)}>
            {t(VIEW_NAMES[v])}
          </button>
        ))}
      </div>
      {offFront && (
        <button type="button" className="toolbar__btn" aria-keyshortcuts="R" onClick={() => useStore.getState().recenter()}>
          {t(STRINGS.recenter)}
        </button>
      )}
    </>
  );
}
```

`src/ui/Toolbar.tsx` — import `ViewSwitch` and render `<ViewSwitch />` right after the `toolbar__lang` div, inside `.toolbar`.

`src/styles.css` — change the selector `.toolbar__lang {` to `.toolbar__lang, .toolbar__group {` and `.toolbar__btn--lang {` to `.toolbar__btn--lang, .toolbar__btn--seg {`; add after the toolbar rules:

```css
@media (max-width: 639px) { .toolbar { right: 12px; flex-wrap: wrap; } .toolbar__btn--seg { padding: 0 8px; } }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ui && npx tsc -p tsconfig.json --noEmit`
Expected: PASS (the existing `Toolbar.test.tsx` too).

- [ ] **Step 5: Commit**

```bash
git add src/ui/ViewSwitch.tsx src/ui/ViewSwitch.test.tsx src/ui/Toolbar.tsx src/ui/picker.ts src/ui/picker.test.ts src/i18n/strings.ts src/styles.css
git commit -m "feat(6a): Ride/Shore/Sky switch, keys 1/2/3, Recenter button and R"
```

---

### Task 6: The dip state machine (`eraDip.ts`)

**Files:**
- Create: `src/ui/eraDip.ts`
- Test: `src/ui/eraDip.test.ts`

**Interfaces:**
- Consumes: `EraId` (`src/data/eras.ts`).
- Produces: `DIP = { out: 0.3, in: 0.3, holdCap: 1, frames: 2 }`; `type DipPhase = 'idle' | 'out' | 'hold' | 'in'`; `class EraDip { phase; opacity; target: EraId | null; constructor(apply: (id: EraId) => void); choose(id, current, reduced): void; tick(dt): void; frameRendered(): void }`.

- [ ] **Step 1: Write the failing test** `src/ui/eraDip.test.ts`:

```ts
import { expect, test } from 'vitest';
import type { EraId } from '../data/eras';
import { DIP, EraDip } from './eraDip';

function rig() {
  const applied: EraId[] = [];
  const dip = new EraDip((id) => applied.push(id));
  /** Runs `seconds` of 60 fps ticks, rendering a frame after each tick. */
  const run = (seconds: number, frames = true) => { for (let i = 0; i < Math.round(seconds * 60); i++) { dip.tick(1 / 60); if (frames) dip.frameRendered(); } };
  return { dip, applied, run };
}

test('full dip: fade out 0.3 s, swap once at full opacity, wait for frames, fade in 0.3 s', () => {
  const { dip, applied, run } = rig();
  dip.choose('1984', '1975', false);
  expect(dip.phase).toBe('out'); expect(dip.target).toBe('1984');
  run(0.15);
  expect(dip.opacity).toBeCloseTo(0.5, 1); expect(applied).toEqual([]);
  run(0.16);
  expect(applied).toEqual(['1984']); expect(dip.opacity).toBe(1);
  run(0.1);
  expect(dip.phase).toBe('in');
  run(0.4);
  expect(dip.phase).toBe('idle'); expect(dip.opacity).toBe(0); expect(dip.target).toBeNull();
  expect(applied).toEqual(['1984']);
});
test('choosing the current era while idle does nothing', () => {
  const { dip } = rig();
  dip.choose('1975', '1975', false);
  expect(dip.phase).toBe('idle');
});
test('a second choice during fade out changes the target, not the timing', () => {
  const { dip, applied, run } = rig();
  dip.choose('1984', '1975', false); run(0.1);
  dip.choose('1840', '1975', false);
  expect(dip.phase).toBe('out');
  run(0.25);
  expect(applied).toEqual(['1840']);
});
test('a second choice while fading in goes back to opaque from where it is, then swaps', () => {
  const { dip, applied, run } = rig();
  dip.choose('1984', '1975', false); run(0.35); run(0.05);   // swapped, fading in
  expect(dip.phase).toBe('in');
  const o = dip.opacity;
  dip.choose('1900', '1984', false);
  expect(dip.phase).toBe('out'); expect(dip.opacity).toBe(o);
  run(0.3);
  expect(applied).toEqual(['1984', '1900']);
});
test('a choice of the era already on screen during hold or fade in is ignored', () => {
  const { dip, applied, run } = rig();
  dip.choose('1984', '1975', false); run(0.31, false);
  expect(dip.phase).toBe('hold');
  dip.choose('1984', '1984', false);
  expect(dip.phase).toBe('hold');
  expect(applied).toEqual(['1984']);
});
test('hold waits for rendered frames, capped at 1 s', () => {
  const { dip, run } = rig();
  dip.choose('1984', '1975', false); run(0.31, false);
  expect(dip.phase).toBe('hold');
  run(DIP.holdCap - 0.05, false);
  expect(dip.phase).toBe('hold');
  run(0.1, false);
  expect(dip.phase).toBe('in');
});
test('frames rendered before the swap do not count', () => {
  const { dip, run } = rig();
  dip.choose('1984', '1975', false);
  for (let i = 0; i < 10; i++) dip.frameRendered();
  run(0.31, false);
  expect(dip.phase).toBe('hold');
  dip.frameRendered(); dip.tick(1 / 60);
  expect(dip.phase).toBe('hold');
  dip.frameRendered(); dip.tick(1 / 60);
  expect(dip.phase).toBe('in');
});
test('reduced motion: instant swap, no overlay', () => {
  const { dip, applied } = rig();
  dip.choose('1984', '1975', true);
  expect(applied).toEqual(['1984']); expect(dip.phase).toBe('idle'); expect(dip.opacity).toBe(0);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/ui/eraDip.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/ui/eraDip.ts`:

```ts
import type { EraId } from '../data/eras';

/** Dip timings (spec 6a §3.1): fade out and in (s), longest wait for the new era's frames (s), frames to wait for. */
export const DIP = { out: 0.3, in: 0.3, holdCap: 1, frames: 2 };
export type DipPhase = 'idle' | 'out' | 'hold' | 'in';

/**
 * Dip-and-swap between eras (spec 6a §3): fade an overlay out, swap the era at full opacity, wait until the
 * new era has rendered DIP.frames frames (at most DIP.holdCap s), fade back in. Pure: the caller drives
 * tick(dt) and frameRendered(), and paints `opacity`.
 */
export class EraDip {
  phase: DipPhase = 'idle';
  opacity = 0;
  /** The era being faded to (shown on the overlay); null when idle. */
  target: EraId | null = null;
  private held = 0;
  private frames = 0;

  constructor(private readonly apply: (id: EraId) => void) {}

  /** A choice of `id` while `current` is the era on screen; `reduced`: swap at once, no overlay. */
  choose(id: EraId, current: EraId, reduced: boolean) {
    if (reduced) {
      this.phase = 'idle'; this.opacity = 0; this.target = null;
      if (id !== current) this.apply(id);
      return;
    }
    if (this.phase === 'idle') {
      if (id === current) return;
      this.target = id; this.phase = 'out';
      return;
    }
    if ((this.phase === 'hold' || this.phase === 'in') && id === current) return;   // already on screen
    this.target = id;
    if (this.phase === 'hold' || this.phase === 'in') this.phase = 'out';           // back to opaque from here
  }

  tick(dt: number) {
    if (this.phase === 'out') {
      this.opacity = Math.min(1, this.opacity + dt / DIP.out);
      if (this.opacity >= 1) { this.apply(this.target!); this.phase = 'hold'; this.held = 0; this.frames = 0; }
    } else if (this.phase === 'hold') {
      this.held += dt;
      if (this.frames >= DIP.frames || this.held >= DIP.holdCap) this.phase = 'in';
    } else if (this.phase === 'in') {
      this.opacity = Math.max(0, this.opacity - dt / DIP.in);
      if (this.opacity <= 0) { this.phase = 'idle'; this.target = null; }
    }
  }

  /** The 3D scene rendered a frame (counts only while holding after a swap). */
  frameRendered() { if (this.phase === 'hold') this.frames++; }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ui/eraDip.test.ts`
Expected: PASS. (If the 60-tick float sums land a tick off in `run(0.15)`/`run(0.16)`, the asserts are `toBeCloseTo(…, 1)` and a 0.01 s margin; do not loosen them further — fix the arithmetic.)

- [ ] **Step 5: Commit**

```bash
git add src/ui/eraDip.ts src/ui/eraDip.test.ts
git commit -m "feat(6a): dip-and-swap state machine"
```

---

### Task 7: Dip controller, overlay, frame signal, announcer

**Files:**
- Create: `src/ui/dipController.ts`, `src/ui/EraDip.tsx`
- Modify: `src/App.tsx`, `src/styles.css`
- Test: `src/ui/dipController.test.ts`

**Interfaces:**
- Consumes: `EraDip`, `DIP` (Task 6); `prefersReducedMotion` (Task 2); `withEra` (`src/ui/picker.ts`); `shiftTime`, `useStore` (`src/state/store.ts`); `STRINGS.nowShowing` (Task 5).
- Produces: `useDip` (zustand: `{ target: EraId | null }`); `requestEra(id: EraId): boolean` (false when `id` is already the pending era); `pendingEra(): EraId`; components `EraDipOverlay`, `EraAnnouncer`, `DipFrameSignal` (the last one must be mounted inside `<Canvas>`).

- [ ] **Step 1: Write the failing test** `src/ui/dipController.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useStore } from '../state/store';
import { pendingEra, requestEra, useDip, __dipForTests } from './dipController';

let now = 0;
const frames: FrameRequestCallback[] = [];
beforeEach(() => {
  now = 0; frames.length = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  window.history.replaceState(null, '', '/?era=1975&cam=ride');
  useStore.getState().setEra('1975');
  __dipForTests.reset();
});
afterEach(() => vi.unstubAllGlobals());
/** Runs queued animation frames for `seconds` at 60 fps, with the 3D scene rendering each frame. */
const step = (seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const cb = frames.shift(); if (!cb) return;
    now += 1000 / 60; cb(now); __dipForTests.frameRendered();
  }
};

test('requestEra updates the URL at once and the era after the fade out', () => {
  expect(requestEra('1984')).toBe(true);
  expect(window.location.search).toContain('era=1984');
  expect(useStore.getState().eraId).toBe('1975');
  expect(useDip.getState().target).toBe('1984');
  expect(pendingEra()).toBe('1984');
  step(0.4);
  expect(useStore.getState().eraId).toBe('1984');
  step(0.5);
  expect(useDip.getState().target).toBeNull();
  expect(frames).toHaveLength(0);                 // the loop stops when idle
});
test('requesting the pending era again is a no-op', () => {
  requestEra('1984');
  expect(requestEra('1984')).toBe(false);
});
test('reduced motion swaps at once', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  requestEra('1840');
  expect(useStore.getState().eraId).toBe('1840');
  expect(frames).toHaveLength(0);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/ui/dipController.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/ui/dipController.ts`:

```ts
import { create } from 'zustand';
import type { EraId } from '../data/eras';
import { shiftTime, useStore } from '../state/store';
import { EraDip } from './eraDip';
import { prefersReducedMotion } from './motion';
import { withEra } from './picker';

/** The era the dip is heading to, for the timeline's highlight and the overlay text. */
export const useDip = create<{ target: EraId | null }>(() => ({ target: null }));

let machine = new EraDip((id) => useStore.getState().setEra(id));
let paint: ((opacity: number) => void) | null = null;
let raf = 0, last = 0;

function loop(now: number) {
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
  last = now;
  machine.tick(dt);
  paint?.(machine.opacity);
  if (machine.phase === 'idle') { raf = 0; last = 0; useDip.setState({ target: null }); return; }
  raf = requestAnimationFrame(loop);
}

/** The era the visitor last chose (the one on screen when no dip is running). */
export const pendingEra = (): EraId => machine.target ?? useStore.getState().eraId;

/** Every era change goes through here (spec 6a §3): URL now, era at the bottom of the dip. False if nothing to do. */
export function requestEra(id: EraId): boolean {
  if (id === pendingEra()) return false;
  const st = useStore.getState();
  window.history.replaceState(null, '', withEra(window.location.search, id, shiftTime(st.timeOfDay, st.eraId, id)));
  machine.choose(id, st.eraId, prefersReducedMotion());
  useDip.setState({ target: machine.target });
  if (machine.phase !== 'idle' && !raf) raf = requestAnimationFrame(loop);
  return true;
}

export const eraDip = {
  /** The overlay registers its painter; returns the unregister function. */
  attach(p: (opacity: number) => void) { paint = p; p(machine.opacity); return () => { if (paint === p) paint = null; }; },
  frameRendered: () => machine.frameRendered(),
};

/** Test hooks (vitest only). */
export const __dipForTests = {
  reset() { machine = new EraDip((id) => useStore.getState().setEra(id)); raf = 0; last = 0; useDip.setState({ target: null }); },
  frameRendered: () => machine.frameRendered(),
};
```

Create `src/ui/EraDip.tsx`:

```tsx
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { getEra } from '../data/eras';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { useStore } from '../state/store';
import { eraDip, useDip } from './dipController';

/** Full-screen sepia haze with the big year (spec 6a §3.1). HTML over the canvas: no draw calls. */
export function EraDipOverlay() {
  const el = useRef<HTMLDivElement>(null);
  const t = useT();
  const target = useDip((s) => s.target);
  useEffect(() => eraDip.attach((o) => {
    const d = el.current;
    if (!d) return;
    d.style.opacity = String(o);
    d.style.visibility = o > 0 ? 'visible' : 'hidden';
  }), []);
  const era = target ? getEra(target) : null;
  return (
    <div ref={el} className="era-dip" aria-hidden="true" style={{ opacity: 0, visibility: 'hidden' }}>
      {era && (<><div className="era-dip__year">{era.id}</div><div className="era-dip__label">{t(era.label)}</div></>)}
    </div>
  );
}

/** Mount inside <Canvas>: tells the dip each time the scene renders a frame. */
export function DipFrameSignal() {
  useFrame(() => eraDip.frameRendered());
  return null;
}

/** Screen readers hear the new era once, after the swap (spec 6a §3.2). */
export function EraAnnouncer() {
  const t = useT();
  const eraId = useStore((s) => s.eraId);
  const [text, setText] = useState('');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const e = getEra(eraId);
    setText(`${t(STRINGS.nowShowing)} ${e.id} · ${t(e.label)}`);
  }, [eraId]);   // eslint-disable-line react-hooks/exhaustive-deps -- language changes must not re-announce
  return <div className="sr-only" aria-live="polite">{text}</div>;
}
```

`src/App.tsx` — import `{ DipFrameSignal, EraAnnouncer, EraDipOverlay } from './ui/EraDip'`; add `<DipFrameSignal />` inside `<Canvas>` after `<ReadySignal />`; add `<EraDipOverlay />` and `<EraAnnouncer />` right after `</SceneBoundary>`.

`src/styles.css` — add:

```css
/* Era dip (spec 6a §3): a soft sepia haze with the big year, under the timeline and toolbar so they stay usable. */
:root { --era-dip: radial-gradient(ellipse at 50% 45%, #8a7556 0%, #5e4d38 60%, #3f3426 100%); }
.era-dip { position: fixed; inset: 0; z-index: 12; pointer-events: none; background: var(--era-dip);
  display: flex; flex-direction: column; align-items: center; justify-content: center; color: #f4ecdf; }
.era-dip__year { font: 500 clamp(64px, 14vw, 160px)/1 ui-serif, Georgia, serif; letter-spacing: 0.04em; }
.era-dip__label { margin-top: 10px; font: 500 clamp(16px, 2.4vw, 24px)/1.2 ui-serif, Georgia, serif; letter-spacing: 0.08em; opacity: 0.85; }
@media (prefers-reduced-motion: reduce) { .era-dip { display: none; } }
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ui && npx tsc -p tsconfig.json --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/dipController.ts src/ui/dipController.test.ts src/ui/EraDip.tsx src/App.tsx src/styles.css
git commit -m "feat(6a): era dip overlay, frame signal and screen-reader announcement"
```

---

### Task 8: Timeline layout math (`timelineLayout.ts`)

**Files:**
- Create: `src/ui/timelineLayout.ts`
- Test: `src/ui/timelineLayout.test.ts`

**Interfaces:**
- Produces: `TIMELINE = { from: 1820, to: 1986, pad: 0.04, gap: 6 }`; `yearFrac(year: number): number`; `interface LabelSlot { left: number; row: 0 | 1 }`; `layoutLabels(xs: number[], ws: number[], width: number, gap?: number): LabelSlot[]`; `nearestIndex(x: number, xs: number[]): number`.

- [ ] **Step 1: Write the failing test** `src/ui/timelineLayout.test.ts`:

```ts
import { expect, test } from 'vitest';
import { ERA_IDS } from '../data/eras';
import { layoutLabels, nearestIndex, TIMELINE, yearFrac } from './timelineLayout';

test('year → fraction is linear between the padded ends', () => {
  expect(yearFrac(TIMELINE.from)).toBeCloseTo(TIMELINE.pad, 12);
  expect(yearFrac(TIMELINE.to)).toBeCloseTo(1 - TIMELINE.pad, 12);
  const a = yearFrac(1840), b = yearFrac(1900), c = yearFrac(1960);
  expect(b - a).toBeCloseTo(c - b, 12);
});
test('the eras are in order and 1840→1900 is much longer than 1984→1986', () => {
  const f = ERA_IDS.map((id) => yearFrac(Number(id)));
  for (let i = 1; i < f.length; i++) expect(f[i]).toBeGreaterThan(f[i - 1]);
  expect((f[1] - f[0]) / (f[7] - f[6])).toBeCloseTo(30, 6);
});

const W = 880, xs = ERA_IDS.map((id) => yearFrac(Number(id)) * W);
const noOverlap = (slots: { left: number; row: number }[], ws: number[], gap: number) => {
  for (const row of [0, 1]) {
    const r = slots.map((s, i) => ({ ...s, w: ws[i] })).filter((s) => s.row === row).sort((a, b) => a.left - b.left);
    for (let i = 1; i < r.length; i++) expect(r[i].left).toBeGreaterThanOrEqual(r[i - 1].left + r[i - 1].w + gap - 1e-9);
    for (const s of r) { expect(s.left).toBeGreaterThanOrEqual(-1e-9); expect(s.left + s.w).toBeLessThanOrEqual(W + 1e-9); }
  }
};

test('narrow labels fit one row, in order, without overlap, each as near its mark as the others allow', () => {
  const ws = xs.map(() => 56), slots = layoutLabels(xs, ws, W);
  expect(slots.every((s) => s.row === 0)).toBe(true);
  noOverlap(slots, ws, TIMELINE.gap);
  for (let i = 1; i < slots.length; i++) expect(slots[i].left).toBeGreaterThan(slots[i - 1].left);
  expect(slots[1].left + 28).toBeCloseTo(xs[1], 6);   // 1900 has room: centred on its mark
});
test('wide labels that do not fit one row go in two rows (even / odd), still without overlap', () => {
  const ws = xs.map(() => 140), slots = layoutLabels(xs, ws, W);
  expect(slots.map((s) => s.row)).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
  noOverlap(slots, ws, TIMELINE.gap);
});
test('zero widths (not measured yet) centre every label on its mark', () => {
  const slots = layoutLabels(xs, xs.map(() => 0), W);
  slots.forEach((s, i) => expect(s.left).toBeCloseTo(xs[i], 9));
});
test('nearestIndex snaps to the closest mark', () => {
  expect(nearestIndex(-50, xs)).toBe(0);
  expect(nearestIndex(xs[3] + 1, xs)).toBe(3);
  expect(nearestIndex(W + 50, xs)).toBe(7);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/ui/timelineLayout.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/ui/timelineLayout.ts`:

```ts
/** Timeline span (years), padding at each end (share of the track) and the gap between labels (px). Spec 6a §2.1. */
export const TIMELINE = { from: 1820, to: 1986, pad: 0.04, gap: 6 };

/** Where a year sits on the track, 0–1: linear, so real gaps show. */
export const yearFrac = (year: number) =>
  TIMELINE.pad + (1 - 2 * TIMELINE.pad) * (year - TIMELINE.from) / (TIMELINE.to - TIMELINE.from);

export interface LabelSlot { left: number; row: 0 | 1 }

/** Left edges for one row of labels (in order): each as near centred on its mark as it can be, ≥ gap apart, inside [0, width]. */
function spreadRow(xs: number[], ws: number[], width: number, gap: number): number[] {
  const n = xs.length, left = xs.map((x, i) => x - ws[i] / 2);
  for (let i = 0; i < n; i++) left[i] = Math.max(left[i], i ? left[i - 1] + ws[i - 1] + gap : 0);
  for (let i = n - 1; i >= 0; i--) left[i] = Math.min(left[i], i < n - 1 ? left[i + 1] - gap - ws[i] : width - ws[i]);
  return left;
}

/**
 * Label slots for marks at `xs` (px) with label widths `ws` (px) on a track `width` px wide. One row when they
 * fit, else even labels in row 0 and odd ones in row 1. Zero widths (not measured yet) centre on the marks.
 */
export function layoutLabels(xs: number[], ws: number[], width: number, gap = TIMELINE.gap): LabelSlot[] {
  const all = xs.map((_, i) => i);
  const fits = (idx: number[]) => idx.reduce((s, i) => s + ws[i], 0) + gap * (idx.length - 1) <= width;
  const measured = ws.some((w) => w > 0);
  const rows = !measured || fits(all) ? [all] : [all.filter((i) => i % 2 === 0), all.filter((i) => i % 2 === 1)];
  const out: LabelSlot[] = new Array(xs.length);
  rows.forEach((idx, r) => {
    const left = measured ? spreadRow(idx.map((i) => xs[i]), idx.map((i) => ws[i]), width, gap) : idx.map((i) => xs[i]);
    idx.forEach((i, k) => { out[i] = { left: left[k], row: r as 0 | 1 }; });
  });
  return out;
}

/** Index of the mark nearest `x`. */
export function nearestIndex(x: number, xs: number[]): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
  return best;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ui/timelineLayout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/timelineLayout.ts src/ui/timelineLayout.test.ts
git commit -m "feat(6a): true-scale timeline layout and label spread"
```

---

### Task 9: Timeline component (replaces the decade rail)

**Files:**
- Create: `src/ui/Timeline.tsx`
- Delete: `src/ui/DecadePicker.tsx`
- Modify: `src/App.tsx`, `src/styles.css`, `scripts/dev/leak.mjs`
- Test: `src/ui/Timeline.test.tsx`

**Interfaces:**
- Consumes: `yearFrac`, `layoutLabels`, `nearestIndex` (Task 8); `requestEra`, `pendingEra`, `useDip` (Task 7); `stepEra`, `isTypingTarget` (`src/ui/picker.ts`); `prefersReducedMotion` (Task 2); `ERAS` (`src/data/eras.ts`).
- Produces: `Timeline` component. DOM contract kept from the rail: `<nav aria-label="Choose an era">` with 8 `<button>`s, names `"<id> · <years> · <label>"`, `aria-current="true"` on the chosen era. New classes: `.timeline`, `.timeline__scroll`, `.timeline__track`, `.timeline__line`, `.timeline__dot`, `.timeline__leaders`, `.timeline__btn`, `.timeline__btn--target`, `.timeline__knob`.

- [ ] **Step 1: Write the failing test** `src/ui/Timeline.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useStore } from '../state/store';
import { __dipForTests } from './dipController';
import { Timeline } from './Timeline';

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));   // reduced motion: swaps are instant, easy to assert
  window.history.replaceState(null, '', '/?era=1975');
  act(() => { useStore.getState().setLang('en'); useStore.getState().setEra('1975'); });
  __dipForTests.reset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('8 buttons in a nav, same names as before, the current era marked', () => {
  render(<Timeline />);
  const nav = screen.getByRole('navigation', { name: 'Choose an era' });
  const btns = within(nav).getAllByRole('button');
  expect(btns).toHaveLength(8);
  expect(btns[5].getAttribute('aria-label')).toBe('1975 · 1960s–1970s · Weekend outings');
  expect(btns[5].getAttribute('aria-current')).toBe('true');
});
test('a click picks the era and updates the URL', () => {
  render(<Timeline />);
  fireEvent.click(screen.getByRole('button', { name: /1980–1986/ }));
  expect(useStore.getState().eraId).toBe('1984');
  expect(window.location.search).toContain('era=1984');
});
test('← → step one era; at the ends the key is left to the page', () => {
  render(<Timeline />);
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(useStore.getState().eraId).toBe('1959');
  act(() => useStore.getState().setEra('1986')); __dipForTests.reset();
  const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
  window.dispatchEvent(ev);
  expect(ev.defaultPrevented).toBe(false);
});
test('the knob and dots are hidden from screen readers', () => {
  const { container } = render(<Timeline />);
  expect(container.querySelector('.timeline__knob')!.getAttribute('aria-hidden')).toBe('true');
  expect(container.querySelector('.timeline__leaders')!.getAttribute('aria-hidden')).toBe('true');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/ui/Timeline.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/ui/Timeline.tsx`:

```tsx
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ERAS } from '../data/eras';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { useStore } from '../state/store';
import { pendingEra, requestEra, useDip } from './dipController';
import { prefersReducedMotion } from './motion';
import { isTypingTarget, stepEra } from './picker';
import { layoutLabels, nearestIndex, yearFrac } from './timelineLayout';

const FRACS = ERAS.map((e) => yearFrac(Number(e.id)));
/** Label row height (px): row 1 sits this far below row 0. */
const ROW_H = 48;

/** True-scale timeline, 1820–1986 (spec 6a §2): dots at real years, spread labels, a draggable knob. */
export function Timeline() {
  const t = useT();
  const eraId = useStore((s) => s.eraId);
  const target = useDip((s) => s.target);
  const chosen = target ?? eraId;
  const scroll = useRef<HTMLDivElement>(null), track = useRef<HTMLDivElement>(null);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const [width, setWidth] = useState(0);
  const [widths, setWidths] = useState<number[]>(() => ERAS.map(() => 0));
  const [dragX, setDragX] = useState<number | null>(null);

  // Measure the track and the labels (re-measure on resize and language change).
  const lang = useStore((s) => s.lang);
  useLayoutEffect(() => {
    const measure = () => {
      setWidth(track.current?.clientWidth ?? 0);
      setWidths(btns.current.map((b) => b?.offsetWidth ?? 0));
    };
    measure();
    if (typeof ResizeObserver === 'undefined' || !track.current) return;
    const ro = new ResizeObserver(measure);
    ro.observe(track.current);
    return () => ro.disconnect();
  }, [lang]);

  const xs = FRACS.map((f) => f * width);
  const slots = layoutLabels(xs, widths, width);
  const twoRows = slots.some((s) => s.row === 1);
  const ci = ERAS.findIndex((e) => e.id === chosen);
  const dragIndex = dragX === null ? -1 : nearestIndex(dragX, xs);

  // Arrow keys step from the era last chosen (so two quick presses move two eras, even mid-dip).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || isTypingTarget(e.target)) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (requestEra(stepEra(pendingEra(), e.key === 'ArrowLeft' ? -1 : 1))) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Phones: keep the chosen mark centred in the scrolling strip.
  useEffect(() => {
    const s = scroll.current;
    if (!s || s.scrollWidth <= s.clientWidth || !width) return;
    s.scrollTo?.({ left: xs[ci] - s.clientWidth / 2, behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
  }, [ci, width]);   // eslint-disable-line react-hooks/exhaustive-deps -- xs follows width

  const xFrom = useCallback((clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.min(r.width, Math.max(0, clientX - r.left));
  }, []);
  const onKnobDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragX(xFrom(e.clientX));
  };
  const onKnobMove = (e: React.PointerEvent<HTMLDivElement>) => { if (dragX !== null) setDragX(xFrom(e.clientX)); };
  const onKnobUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragX === null) return;
    requestEra(ERAS[nearestIndex(xFrom(e.clientX), xs)].id);
    setDragX(null);
  };

  const knobX = dragX ?? xs[ci];
  return (
    <nav className={`timeline${twoRows ? ' timeline--two-rows' : ''}`} aria-label={t(STRINGS.chooseEra)}>
      <div ref={scroll} className="timeline__scroll">
        <div ref={track} className="timeline__track">
          <div className="timeline__line" />
          <svg className="timeline__leaders" aria-hidden="true" width={width} height={twoRows ? 2 * ROW_H : ROW_H}>
            {ERAS.map((e, i) => (
              <g key={e.id}>
                <circle className="timeline__dot" cx={xs[i]} cy={2} r={i === ci ? 4 : 3} />
                <line x1={xs[i]} y1={5} x2={slots[i].left + widths[i] / 2} y2={10 + slots[i].row * ROW_H} />
              </g>
            ))}
          </svg>
          {ERAS.map((e, i) => {
            const name = `${e.id} · ${t(e.years)} · ${t(e.label)}`;
            const measured = widths[i] > 0;
            return (
              <button key={e.id} ref={(b) => { btns.current[i] = b; }} type="button"
                className={`timeline__btn${i === dragIndex ? ' timeline__btn--target' : ''}`}
                style={{ left: measured ? slots[i].left : `${FRACS[i] * 100}%`, top: 10 + slots[i].row * ROW_H,
                  transform: measured ? undefined : 'translateX(-50%)' }}
                aria-current={e.id === chosen ? 'true' : undefined} aria-label={name} title={name}
                onClick={() => requestEra(e.id)}>
                <span className="timeline__year">{e.id}</span>
                <span className="timeline__label">{t(e.label)}</span>
              </button>
            );
          })}
          <div className="timeline__knob" aria-hidden="true" style={{ left: width ? knobX : `${FRACS[ci] * 100}%` }}
            onPointerDown={onKnobDown} onPointerMove={onKnobMove} onPointerUp={onKnobUp} onPointerCancel={() => setDragX(null)} />
        </div>
      </div>
    </nav>
  );
}
```

`src/App.tsx` — replace the `DecadePicker` import and element with `Timeline` (`import { Timeline } from './ui/Timeline';`, `<Timeline />`). Delete `src/ui/DecadePicker.tsx`.

`src/styles.css` — delete every `.decade-rail…` rule (including its two `@media` lines) and add:

```css
/* True-scale timeline (spec 6a §2): line with dots at real years, labels spread along it, a draggable knob. */
.timeline { position: fixed; left: 50%; transform: translateX(-50%); bottom: max(12px, env(safe-area-inset-bottom)); z-index: 15;
  width: min(880px, calc(100vw - 16px)); box-sizing: border-box; padding: 8px 6px 4px; border-radius: 12px;
  background: rgba(12, 15, 15, 0.42); border: 1px solid rgba(244, 236, 223, 0.14); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.timeline__scroll { overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.timeline__scroll::-webkit-scrollbar { display: none; }
.timeline__track { position: relative; width: 100%; height: 62px; }
.timeline--two-rows .timeline__track { height: 110px; }
.timeline__line { position: absolute; left: 0; right: 0; top: 1px; height: 2px; background: rgba(244, 236, 223, 0.35); border-radius: 1px; }
.timeline__leaders { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.timeline__leaders line { stroke: rgba(244, 236, 223, 0.35); stroke-width: 1; }
.timeline__dot { fill: #f4ecdf; }
.timeline__btn { position: absolute; min-height: 48px; padding: 4px 8px; border: 0; border-radius: 9px; background: transparent; color: #f4ecdf;
  font: 600 14px/1.1 ui-serif, Georgia, serif; letter-spacing: 0.02em; cursor: pointer; touch-action: manipulation; white-space: nowrap;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; transition: background-color 120ms ease; }
.timeline__btn:hover, .timeline__btn--target { background: rgba(244, 236, 223, 0.1); }
.timeline__btn[aria-current='true'] { background: #f4ecdf; color: #1b1a17; }
.timeline__btn:focus-visible { outline: 2px solid #f2c46d; outline-offset: 1px; }
.timeline__label { font: 500 10px/1.1 ui-sans-serif, system-ui, sans-serif; opacity: 0.75; }
.timeline__knob { position: absolute; top: -8px; width: 20px; height: 20px; margin-left: -10px; border-radius: 50%; background: #f2c46d;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.45); cursor: grab; touch-action: none; }
.timeline__knob:active { cursor: grabbing; }
@media (max-width: 720px) { .timeline__label { display: none; } }
@media (max-width: 639px) { .timeline__track { width: 220vw; } }
@media (prefers-reduced-motion: reduce) { .timeline__btn { transition: none; } }
```

Also move the title card up so it clears a two-row timeline: in `.title-card` change `bottom: 88px` to `bottom: 136px`; in `.osm-credit` change `+ 60px` to `+ 76px`.

`scripts/dev/leak.mjs` line 35 — replace `.decade-rail__btn` with `.timeline__btn`, and after the click add `await page.waitForTimeout(800);` so the dip finishes before the next click.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ui && npm test && npx tsc -p tsconfig.json --noEmit`
Expected: PASS.

- [ ] **Step 5: Check by hand** with `npm run dev`: desktop 1440 px and phone 375 px (built-in browser `resize_window` preset `mobile`):
- 1984 and 1986 labels do not overlap; leaders join each label to its dot.
- Dragging the knob highlights the nearest label; release picks it, with the dip.
- On the phone, the strip scrolls sideways and the chosen era ends centred; the page itself does not scroll sideways.

- [ ] **Step 6: Commit**

```bash
git add -A src/ui src/App.tsx src/styles.css scripts/dev/leak.mjs
git commit -m "feat(6a): true-scale timeline replaces the decade rail"
```

---

### Task 10: End-to-end tests

**Files:**
- Modify: `tests/e2e/picker.spec.ts`
- Create: `tests/e2e/views.spec.ts`

**Interfaces:**
- Consumes: the DOM contracts from Tasks 5, 7, 9 (`nav "Choose an era"`, `group "View"`, button `Recenter`, `.era-dip`).

- [ ] **Step 1: Update `tests/e2e/picker.spec.ts`**

In the first test, after `await rail.getByRole('button', { name: /1980–1986/ }).click();` add:

```ts
  // The dip: the overlay rises over the old era, then clears once 1984 is on screen.
  await expect.poll(() => page.locator('.era-dip').evaluate((e) => Number(getComputedStyle(e).opacity)), { timeout: 5_000 }).toBeGreaterThan(0.5);
  await expect(page.locator('.era-dip')).toBeHidden({ timeout: 10_000 });
```

Replace the second test (`'phone: the rail fits 375 px without horizontal scroll'`) with:

```ts
test('phone: the timeline strip scrolls inside itself and centres the chosen era', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('?freeze=1&q=low&era=1840');
  await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  const strip = page.locator('.timeline__scroll');
  expect(await strip.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
  for (const b of await page.getByRole('navigation', { name: 'Choose an era' }).getByRole('button').all()) {
    const r = (await b.boundingBox())!;
    expect(r.width).toBeGreaterThanOrEqual(40); expect(r.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: /^1986/ }).dispatchEvent('click');
  await expect(page).toHaveURL(/era=1986/);
  await expect.poll(async () => {
    const b = (await page.getByRole('button', { name: /^1986/ }).boundingBox())!;
    return Math.abs(b.x + b.width / 2 - 375 / 2);
  }, { timeout: 5_000 }).toBeLessThan(60);
});

test('reduced motion: no dip, the era swaps at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('?era=1975&freeze=1&q=low');
  await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
  await page.getByRole('button', { name: /1980–1986/ }).click();
  await expect(page.locator('.title-card__era')).toContainText('The steel barge', { timeout: 2_000 });
  await expect(page.locator('.era-dip')).toBeHidden();
});
```

- [ ] **Step 2: Create `tests/e2e/views.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

const ready = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });

test('views: an old ?cam=bank link opens Shore; buttons and keys switch Ride / Shore / Sky', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('?cam=bank&freeze=1&q=low');
  await ready(page);
  await expect(page).toHaveURL(/cam=shore/);
  const g = page.getByRole('group', { name: 'View' });
  await expect(g.getByRole('button', { name: 'Shore' })).toHaveAttribute('aria-pressed', 'true');
  await g.getByRole('button', { name: 'Sky' }).click();
  await expect(page).toHaveURL(/cam=sky/);
  await expect(g.getByRole('button', { name: 'Sky' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('1');
  await expect(page).toHaveURL(/cam=ride/);
  await expect(g.getByRole('button', { name: 'Ride' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('2');
  await expect(page).toHaveURL(/cam=shore/);
  expect(errors).toEqual([]);
});

test('a drag turns the view and it stays; Recenter (button or R) brings back the front', async ({ page }) => {
  await page.goto('?cam=sky&freeze=1&q=low');
  await ready(page);
  const recenter = page.getByRole('button', { name: 'Recenter' });
  await expect(recenter).toBeHidden();
  const c = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x + c.width / 2 + 300, c.y + c.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(recenter).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(3_000);
  await expect(recenter).toBeVisible();                 // no ease-back
  await page.keyboard.press('r');
  await expect(recenter).toBeHidden({ timeout: 10_000 });
});

test('dev views need a dev flag', async ({ page }) => {
  await page.goto('?cam=fields&q=low');
  await ready(page);
  await expect(page).not.toHaveURL(/cam=fields/);
  await expect(page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Ride' })).toHaveAttribute('aria-pressed', 'true');
});
```

- [ ] **Step 3: Run the e2e tests**

Run: `npx playwright test tests/e2e/picker.spec.ts tests/e2e/views.spec.ts`
Expected: PASS. Then run `npm run e2e:fast` to check nothing else broke (the `world.spec.ts` shots still use `cam=bank`/`aerial` and dev views with `freeze=1`; both must keep working).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e
git commit -m "test(6a): e2e for the dip, phone strip, reduced motion, views, recenter and dev gate"
```

---

### Task 11: Frame rate, screenshots and rulings notes

**Files:**
- Create: `docs/superpowers/notes/phase-6a-rulings.md`
- Create: `tests/snapshots/phase6a/*.png` (24 views + 2 mid-dip shots)

- [ ] **Step 1: Measure the frame rate** with the Phase 5 method (`docs/superpowers/notes/phase-5-rulings.md` §"Frame rate"): build `main` (`a855aea`) in a scratch worktree and serve it on `:4174`; build this branch and serve it on `:4173`:

```bash
git worktree add ../ancon-base a855aea && (cd ../ancon-base && npm ci && npm run build && npx vite preview --port 4174 --strictPort) &
npm run build && npm run preview &
```

For each tier (`q=high`, `q=medium` at `10 2`; `q=low` at `10 1`) and each query below, run 3 interleaved pairs (base, after, base, after, base, after), base with `BASE=http://localhost:4174/ancon-de-loiza/`:

```bash
node scripts/dev/perf.mjs "?era=1975&cam=ride&c=95&freeze=1&q=high" 10 2
node scripts/dev/perf.mjs "?era=1984&cam=ride&c=95&freeze=1&q=high" 10 2
node scripts/dev/perf.mjs "?era=1975&cam=shore&c=95&freeze=1&q=high" 10 2
node scripts/dev/perf.mjs "?era=1975&cam=sky&c=95&freeze=1&q=high" 10 2
```

(On `main`, use `cam=bank` for Shore and `cam=aerial` for Sky.) A tier passes if the after median is ≤ +5 % of the base median on every query. If one fails, stop and report it to the controller with the numbers — do not tune art to hide it.

Also record the longest frame during a dip on each tier: open `?era=1975&cam=ride&c=95&freeze=1&perf=1&q=<tier>` on `:4173`, clear `window.__ANCON_PERF__.frames`, press → once, wait 2 s, and read `Math.max(...window.__ANCON_PERF__.frames)`.

- [ ] **Step 2: Take the screenshots** with the real GPU (`scripts/dev/shot.mjs`, dev server on :5173), golden hour (no `t`), `c=95`, `freeze=1`, `q=high`:

```bash
mkdir -p tests/snapshots/phase6a
for era in 1840 1900 1925 1935 1959 1975 1984 1986; do for cam in ride shore sky; do
  node scripts/dev/shot.mjs "?era=$era&cam=$cam&c=95&freeze=1&q=high" tests/snapshots/phase6a/$era-$cam.png
done; done
```

For the two mid-dip shots, run this scratch script (not committed) from the repo root with the dev server up:

```js
// scratch: node dipshot.mjs
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const [w, h, name] of [[1440, 900, 'dip-desktop'], [375, 812, 'dip-phone']]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('http://localhost:5173/ancon-de-loiza/?era=1975&cam=ride&c=95&freeze=1&q=high');
  await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.era-dip')).opacity) > 0.95);
  await page.screenshot({ path: `tests/snapshots/phase6a/${name}.png` });
}
await browser.close();
```

Look at every shot. Check: the timeline does not cover the title card; Shore stands on the bank; Sky shows the crossing and no world edge; the 1984/1986 labels are apart. Turn each view 360° by hand in Shore and Sky for at least two eras (1840, 1986) and note any world edge or empty land you see — do not fix it; list it.

- [ ] **Step 3: Write `docs/superpowers/notes/phase-6a-rulings.md`** with: the spec amendments (the three marked in the spec), the frame-rate tables (base runs, after runs, medians, change, pass/fail per tier), the longest dip frame per tier, the shot list, and every world edge or art issue seen while turning the views (as open items for the user).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/notes/phase-6a-rulings.md tests/snapshots/phase6a
git commit -m "docs(6a): frame rate, screenshots and art-check notes"
```

---

## Self-review (done while writing)

- Spec coverage: §2 timeline → Tasks 8–9 (layout, input, phone, a11y); §3 dip → Tasks 6–7 (sequence, second choice, URL at choice time, reduced motion, HTML overlay, aria-live) and Task 9 (all inputs route through `requestEra`); §4.1 views/aliases/dev gate → Tasks 1–2; §4.2 switch, keys, glide, 360° stays, recenter, URL → Tasks 3–5; §4.3 limits → Tasks 2 and 4; §5 performance → Task 11; §6 tests → Tasks 1–10; §7 done-when → Task 11 plus user review.
- Names used across tasks: `requestEra`, `pendingEra`, `useDip`, `__dipForTests`, `VIEW_POSES`, `controlLimits`, `frontOf`, `isOffFront`, `glideK`, `VIEW_KEYS`, `recenterSeq`, `setOffFront`, `RideRig.recenter`, `RideRig.offFront`, `withCam`, `VIEW_NAMES` — each defined once, in the task named in its Interfaces block.
