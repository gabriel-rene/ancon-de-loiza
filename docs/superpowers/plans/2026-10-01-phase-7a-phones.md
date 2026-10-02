# Phase 7a — Phones and speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto quality that tries a higher tier and steps down when slow, a quality button, a load card, a vendor chunk and a touch fix.

**Architecture:** A pure governor state machine (`src/state/qualityGovernor.ts`) is fed frame times by a small R3F component; on "down" it asks the existing era dip to swap the tier at the bottom of the fade. Tier precedence (URL > hand pick > auto) is a pure function used once at store init. The load card is plain HTML in `index.html`, driven by `body[data-load]` / `body[data-ready]` and removed by a tiny module.

**Tech Stack:** Vite 8 (rolldown), React 19, R3F 9, zustand 5, vitest 5 (jsdom for DOM tests), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-01-phase-7a-phones-design.md`

## Global Constraints

- Branch `phase-7a-phones`. Do not merge to `main`.
- Every visible string is bilingual (`Bilingual` from `src/i18n/text.ts`, strings in `src/i18n/strings.ts`). Spanish tier names: **Auto, Alta, Media, Baja**.
- The three tiers in `src/quality.ts` (`QUALITY`) do not change in this plan.
- Governor numbers (spec §2.3): settle 2 s, first check 4 s under **40 fps** → down; watch window 10 s under **30 fps** → down; never up; never below `low`; paused while the dip runs, the tab is hidden, or a frame `dt > 0.5 s`.
- Tier precedence (spec §2.2): `?q=` (mode `url`) > saved hand pick (mode `hand`) > Auto (mode `auto`, or `off` with `?freeze=1`, `?perf=1`, `?debug=1`).
- `localStorage` key `ancon.quality`, values `auto|high|medium|low`; any storage failure means `auto`.
- Follow the file style around you: dense one-line members, short JSDoc that cites the spec section (`spec 7a §2.3`).
- Commit messages: `feat(7a): …` / `test(7a): …` / `docs(7a): …`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `npm test` and `npm run build` must pass at the end of every task.

---

### Task 1: Start tier, tier precedence, quality prefs, store wiring

**Files:**
- Modify: `src/quality.ts` (`detectQuality`, add `QualityMode`, `QualityChoice`, `resolveQuality`, `stepDown`)
- Create: `src/state/qualityPrefs.ts`
- Modify: `src/state/store.ts` (export `DEFAULT_ERA`; add `qualityMode`, `setQualityMode`, `fps`)
- Modify: `src/state/url.ts` (parse `?fps=1` into `fps: boolean`; `toSearch` writes it)
- Test: `src/quality.test.ts` (create), `src/state/qualityPrefs.test.ts` (create), `src/state/url.test.ts` (add a case)

**Interfaces:**
- Produces:
  - `type QualityMode = 'auto' | 'hand' | 'url' | 'off'`, `type QualityChoice = 'auto' | Quality` (from `src/quality.ts`)
  - `detectQuality(): Quality`
  - `resolveQuality(o: { url?: Quality; saved: QualityChoice; dev: boolean; detected: Quality }): { quality: Quality; mode: QualityMode }`
  - `stepDown(q: Quality): Quality | null`
  - `QUALITY_KEY = 'ancon.quality'`, `loadQualityPref(): QualityChoice`, `saveQualityPref(c: QualityChoice): void`, `withoutQ(search: string): string` (from `src/state/qualityPrefs.ts`)
  - store: `qualityMode: QualityMode`, `setQualityMode(m: QualityMode): void`, `fps: boolean`; `export const DEFAULT_ERA`

- [ ] **Step 1: Write the failing tests**

`src/quality.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { detectQuality, resolveQuality, stepDown } from './quality';

function device(o: { coarse: boolean; cores?: number; mem?: number }) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('coarse') ? o.coarse : false }));
  Object.defineProperty(navigator, 'hardwareConcurrency', { value: o.cores ?? 8, configurable: true });
  if (o.mem === undefined) delete (navigator as { deviceMemory?: number }).deviceMemory;
  else Object.defineProperty(navigator, 'deviceMemory', { value: o.mem, configurable: true });
}
afterEach(() => { vi.unstubAllGlobals(); delete (navigator as { deviceMemory?: number }).deviceMemory; });

test('start tier table (spec 7a §2.1)', () => {
  device({ coarse: true, cores: 8, mem: 4 }); expect(detectQuality()).toBe('low');
  device({ coarse: true, cores: 8, mem: 2 }); expect(detectQuality()).toBe('low');
  device({ coarse: true, cores: 6, mem: 8 }); expect(detectQuality()).toBe('medium');
  device({ coarse: true, cores: 6 }); expect(detectQuality()).toBe('medium');          // iPhone: no deviceMemory
  device({ coarse: false, cores: 4 }); expect(detectQuality()).toBe('medium');
  device({ coarse: false, cores: 10 }); expect(detectQuality()).toBe('high');
});
test('precedence: URL beats a hand pick beats Auto; dev flags turn the governor off (spec 7a §2.2)', () => {
  expect(resolveQuality({ url: 'low', saved: 'high', dev: false, detected: 'medium' })).toEqual({ quality: 'low', mode: 'url' });
  expect(resolveQuality({ saved: 'high', dev: false, detected: 'medium' })).toEqual({ quality: 'high', mode: 'hand' });
  expect(resolveQuality({ saved: 'auto', dev: false, detected: 'medium' })).toEqual({ quality: 'medium', mode: 'auto' });
  expect(resolveQuality({ saved: 'auto', dev: true, detected: 'high' })).toEqual({ quality: 'high', mode: 'off' });
});
test('stepDown walks high → medium → low and stops', () => {
  expect(stepDown('high')).toBe('medium'); expect(stepDown('medium')).toBe('low'); expect(stepDown('low')).toBeNull();
});
```

`src/state/qualityPrefs.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { loadQualityPref, QUALITY_KEY, saveQualityPref, withoutQ } from './qualityPrefs';

afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

test('Auto when nothing or junk is stored; round-trips each choice', () => {
  expect(loadQualityPref()).toBe('auto');
  window.localStorage.setItem(QUALITY_KEY, 'ultra');
  expect(loadQualityPref()).toBe('auto');
  for (const c of ['high', 'medium', 'low', 'auto'] as const) { saveQualityPref(c); expect(loadQualityPref()).toBe(c); }
  expect(window.localStorage.getItem(QUALITY_KEY)).toBe('auto');
});
test('a throwing localStorage means Auto, and saving does not throw', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(loadQualityPref()).toBe('auto');
  expect(() => saveQualityPref('low')).not.toThrow();
});
test('withoutQ drops only q', () => {
  expect(withoutQ('?era=1935&q=low&lang=en')).toBe('?era=1935&lang=en');
  expect(withoutQ('?q=low')).toBe('');
});
```

Add to `src/state/url.test.ts` (match its existing style):

```ts
test('?fps=1 turns on the fps readout and round-trips', () => {
  expect(parseUrlState('?fps=1').fps).toBe(true);
  expect(parseUrlState('?fps=0').fps).toBeUndefined();
  expect(toSearch({ fps: true })).toContain('fps=1');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/quality.test.ts src/state/qualityPrefs.test.ts src/state/url.test.ts`
Expected: FAIL (`resolveQuality`/`stepDown` not exported, `qualityPrefs` missing, `fps` undefined).

- [ ] **Step 3: Implement**

`src/quality.ts` — replace `detectQuality` and add below `QUALITY`:

```ts
/** Spec 7a §2.2: who chose the tier. Only 'auto' runs the governor. */
export type QualityMode = 'auto' | 'hand' | 'url' | 'off';
/** The quality button's choices (spec 7a §3). */
export type QualityChoice = 'auto' | Quality;

/** Start tier (spec 7a §2.1). Safari reports no deviceMemory, so every iPhone starts on medium. */
export function detectQuality(): Quality {
  if (typeof window === 'undefined') return 'high';
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (coarse) return mem !== undefined && mem <= 4 ? 'low' : 'medium';
  return cores <= 4 ? 'medium' : 'high';
}

/** Spec 7a §2.2: ?q= beats a saved hand pick beats Auto; ?freeze/?perf/?debug keep Auto's start tier but switch the governor off. */
export function resolveQuality(o: { url?: Quality; saved: QualityChoice; dev: boolean; detected: Quality }): { quality: Quality; mode: QualityMode } {
  if (o.url) return { quality: o.url, mode: 'url' };
  if (o.saved !== 'auto') return { quality: o.saved, mode: 'hand' };
  return { quality: o.detected, mode: o.dev ? 'off' : 'auto' };
}

/** One tier lower, or null on low (spec 7a §2.3 floor). */
export const stepDown = (q: Quality): Quality | null => (q === 'high' ? 'medium' : q === 'medium' ? 'low' : null);
```

`src/state/qualityPrefs.ts` (same pattern as `src/sound/prefs.ts`):

```ts
import type { QualityChoice } from '../quality';

/** Spec 7a §3: the quality button's choice survives a reload. Any storage failure means Auto. */
export const QUALITY_KEY = 'ancon.quality';
const CHOICES: QualityChoice[] = ['auto', 'high', 'medium', 'low'];

export function loadQualityPref(): QualityChoice {
  try {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem(QUALITY_KEY) : null;
    return CHOICES.includes(v as QualityChoice) ? (v as QualityChoice) : 'auto';
  } catch { return 'auto'; }
}
export function saveQualityPref(c: QualityChoice) {
  try { if (typeof window !== 'undefined') window.localStorage.setItem(QUALITY_KEY, c); } catch { /* private mode: not remembered */ }
}
/** The search string without ?q (a hand pick replaces it, spec 7a §3); '' when nothing is left. */
export function withoutQ(search: string): string {
  const p = new URLSearchParams(search);
  p.delete('q');
  const s = p.toString();
  return s ? `?${s}` : '';
}
```

`src/state/url.ts`: add to `UrlState` `/** ?fps=1: small on-screen fps readout (spec 7a §5). */ fps: boolean;`, parse `if (p.get('fps') === '1') out.fps = true;`, write `if (s.fps) p.set('fps', '1');`.

`src/state/store.ts`:
- `export const DEFAULT_ERA: EraId = '1975';`
- Add to `AppState`: `/** Spec 7a §2.2. */ qualityMode: QualityMode; setQualityMode: (m: QualityMode) => void; fps: boolean;`
- Before `create`:

```ts
const startQuality = resolveQuality({
  url: fromUrl.quality, saved: loadQualityPref(), dev: !!(fromUrl.frozen || fromUrl.perf || fromUrl.debug), detected: detectQuality(),
});
```

- Initial state: `quality: startQuality.quality, qualityMode: startQuality.mode, fps: false,` (keep `...fromUrl` after; `fromUrl.quality` equals `startQuality.quality` when set).
- Action: `setQualityMode: (qualityMode) => set({ qualityMode }),`

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/quality.ts src/quality.test.ts src/state/qualityPrefs.ts src/state/qualityPrefs.test.ts src/state/url.ts src/state/url.test.ts src/state/store.ts
git commit -m "feat(7a): start tier table, tier precedence and saved quality choice"
```

---

### Task 2: The governor state machine

**Files:**
- Create: `src/state/qualityGovernor.ts`
- Test: `src/state/qualityGovernor.test.ts`

**Interfaces:**
- Consumes: `Quality` from `src/quality.ts`.
- Produces: `GOV = { settle: 2, first: 4, firstFps: 40, window: 10, watchFps: 30 }`; `class QualityGovernor { stage: 'settle'|'first'|'watch'|'pending'|'done'; constructor(tier: Quality); reset(tier: Quality): void; tick(dt: number, frames: number, paused: boolean): 'stay'|'down' }`.

- [ ] **Step 1: Write the failing tests**

```ts
import { expect, test } from 'vitest';
import { GOV, QualityGovernor } from './qualityGovernor';

/** Runs `seconds` at `fps` (one frame per tick); returns how many times it said 'down'. */
function run(g: QualityGovernor, seconds: number, fps: number, paused = false) {
  let downs = 0;
  for (let i = 0; i < Math.round(seconds * fps); i++) if (g.tick(1 / fps, 1, paused) === 'down') downs++;
  return downs;
}

test('first check: under 40 fps steps down once, after 2 s settle + 4 s measure', () => {
  const g = new QualityGovernor('medium');
  expect(run(g, GOV.settle + GOV.first - 0.2, 35)).toBe(0);
  expect(run(g, 0.4, 35)).toBe(1);
  expect(g.stage).toBe('pending');
  expect(run(g, 30, 10)).toBe(0);                 // waits for reset after a step
});
test('first check passes at 40 fps or more, then the watch needs 10 s under 30 fps', () => {
  const g = new QualityGovernor('high');
  expect(run(g, GOV.settle + GOV.first + 0.1, 45)).toBe(0);
  expect(g.stage).toBe('watch');
  expect(run(g, 9.5, 35)).toBe(0);                // 35 fps is fine while watching
  expect(run(g, GOV.window, 25)).toBe(1);
});
test('never steps up and stops on low', () => {
  const g = new QualityGovernor('low');
  expect(g.stage).toBe('done');
  expect(run(g, 60, 5)).toBe(0);
});
test('reset after a step: settle, then a fresh 40 fps first check on the new tier', () => {
  const g = new QualityGovernor('high');
  run(g, 7, 20);
  g.reset('medium');
  expect(g.stage).toBe('settle');
  expect(run(g, GOV.settle + GOV.first + 0.1, 38)).toBe(1);
  g.reset('low');
  expect(g.stage).toBe('done');
});
test('a pause throws the window away and settles 2 s before measuring again', () => {
  const g = new QualityGovernor('medium');
  run(g, GOV.settle + 3, 20);                     // 3 s into a slow first check
  run(g, 1, 60, true);                            // paused (dip, hidden tab)
  expect(g.stage).toBe('settle');
  expect(run(g, GOV.settle + GOV.first - 0.2, 20)).toBe(0);
  expect(run(g, 0.4, 20)).toBe(1);
});
test('after the first check passed, a pause returns to watching, not to a new first check', () => {
  const g = new QualityGovernor('medium');
  run(g, GOV.settle + GOV.first + 0.1, 50);
  run(g, 0.5, 60, true);
  run(g, GOV.settle + 0.1, 35);
  expect(g.stage).toBe('watch');
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/state/qualityGovernor.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
import type { Quality } from '../quality';

/** Governor timings and floors (spec 7a §2.3): seconds and frames per second. */
export const GOV = { settle: 2, first: 4, firstFps: 40, window: 10, watchFps: 30 };
type Stage = 'settle' | 'first' | 'watch' | 'pending' | 'done';

/**
 * Auto quality (spec 7a §2.3). Pure: the caller feeds tick(dt, frames, paused) every frame and calls reset(tier)
 * when a new tier is on screen or the era changed. 'down' is said once; then it waits in 'pending' for reset().
 * It never asks to go up; on low it is 'done'.
 */
export class QualityGovernor {
  stage: Stage = 'settle';
  private passedFirst = false;
  private t = 0;
  private frames = 0;

  constructor(tier: Quality) { this.reset(tier); }

  reset(tier: Quality) { this.passedFirst = false; this.enter(tier === 'low' ? 'done' : 'settle'); }

  private enter(s: Stage) { this.stage = s; this.t = 0; this.frames = 0; }

  tick(dt: number, frames: number, paused: boolean): 'stay' | 'down' {
    if (this.stage === 'done' || this.stage === 'pending') return 'stay';
    if (paused) { this.enter('settle'); return 'stay'; }
    this.t += dt; this.frames += frames;
    if (this.stage === 'settle') {
      if (this.t >= GOV.settle) this.enter(this.passedFirst ? 'watch' : 'first');
      return 'stay';
    }
    const first = this.stage === 'first';
    if (this.t < (first ? GOV.first : GOV.window)) return 'stay';
    if (this.frames / this.t < (first ? GOV.firstFps : GOV.watchFps)) { this.enter('pending'); return 'down'; }
    this.passedFirst = true; this.enter('watch');
    return 'stay';
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/state/qualityGovernor.test.ts` → PASS. Then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/state/qualityGovernor.ts src/state/qualityGovernor.test.ts
git commit -m "feat(7a): quality governor state machine"
```

---

### Task 3: Tier swaps go through the dip

**Files:**
- Modify: `src/ui/dipMachine.ts` (add `refresh`)
- Modify: `src/ui/dipController.ts` (add `requestQuality`, pending tier applied at the bottom, `__dipForTests.reset` clears it)
- Test: `src/ui/dipMachine.test.ts`, `src/ui/dipController.test.ts` (add cases)

**Interfaces:**
- Consumes: store `quality`, `setQuality`, `eraId`, `setEra`.
- Produces: `EraDip.refresh(current: EraId, reduced: boolean): void`; `requestQuality(q: Quality): boolean` exported from `src/ui/dipController.ts` (false when nothing to do).

- [ ] **Step 1: Write the failing tests**

Add to `src/ui/dipMachine.test.ts`:

```ts
test('refresh dips on the era already on screen and swaps once at the bottom', () => {
  const { dip, applied, run } = rig();
  dip.refresh('1975', false);
  expect(dip.phase).toBe('out'); expect(dip.target).toBe('1975');
  run(0.31);
  expect(applied).toEqual(['1975']);
  run(0.5);
  expect(dip.phase).toBe('idle');
});
test('refresh during a fade out rides along with the era change', () => {
  const { dip, applied, run } = rig();
  dip.choose('1984', '1975', false); run(0.1);
  dip.refresh('1975', false);
  expect(dip.target).toBe('1984');
  run(0.25);
  expect(applied).toEqual(['1984']);
});
test('refresh while fading in goes back to opaque and swaps again', () => {
  const { dip, applied, run } = rig();
  dip.choose('1984', '1975', false); run(0.35); run(0.05);
  expect(dip.phase).toBe('in');
  dip.refresh('1984', false);
  expect(dip.phase).toBe('out');
  run(0.3);
  expect(applied).toEqual(['1984', '1984']);
});
test('refresh with reduced motion swaps at once', () => {
  const { dip, applied } = rig();
  dip.refresh('1975', true);
  expect(applied).toEqual(['1975']); expect(dip.phase).toBe('idle');
});
```

Add to `src/ui/dipController.test.ts` (read the file first and follow its setup; it uses `__dipForTests.reset()` and fake rAF or direct ticks — reuse whatever it uses to advance the dip):

```ts
test('requestQuality swaps the tier at the bottom of a dip and keeps the era', () => {
  act(() => { useStore.getState().setEra('1975'); useStore.getState().setQuality('high'); });
  expect(requestQuality('medium')).toBe(true);
  expect(useStore.getState().quality).toBe('high');      // not yet: fading out
  advance(0.35);                                          // the file's own helper to run the dip
  expect(useStore.getState().quality).toBe('medium');
  expect(useStore.getState().eraId).toBe('1975');
  expect(requestQuality('medium')).toBe(false);           // nothing to do
});
test('an era change and a tier step asked together run in one dip', () => {
  act(() => { useStore.getState().setEra('1975'); useStore.getState().setQuality('high'); });
  requestEra('1984');
  requestQuality('low');
  advance(0.35);
  expect(useStore.getState().eraId).toBe('1984');
  expect(useStore.getState().quality).toBe('low');
});
```

If `dipController.test.ts` has no `advance` helper, add one in the test file that calls the rAF callbacks it already fakes; do not change the controller's loop for tests.

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/ui/dipMachine.test.ts src/ui/dipController.test.ts` → FAIL (`refresh` / `requestQuality` missing).

- [ ] **Step 3: Implement**

`src/ui/dipMachine.ts`, inside `EraDip` after `choose`:

```ts
  /** A dip that swaps something other than the era (spec 7a §2.4): `current` stays; the swap callback runs at the bottom. */
  refresh(current: EraId, reduced: boolean) {
    if (reduced) { this.phase = 'idle'; this.opacity = 0; this.target = null; this.apply(current); return; }
    if (this.phase === 'out') return;                       // a swap is coming anyway
    this.target ??= current;
    this.phase = 'out';                                     // idle, hold or in: (back) to opaque from here
  }
```

`src/ui/dipController.ts`:

```ts
import type { Quality } from '../quality';
// …
/** Tier waiting for the bottom of the dip (spec 7a §2.4). */
let pendingQuality: Quality | null = null;

/** At the bottom of every dip: the era (if it changed) and any waiting tier. */
function swap(id: EraId) {
  const st = useStore.getState();
  if (id !== st.eraId) st.setEra(id);
  if (pendingQuality) { st.setQuality(pendingQuality); pendingQuality = null; }
}
let machine = new EraDip(swap);
```

Replace both `new EraDip((id) => useStore.getState().setEra(id))` with `new EraDip(swap)`; in `__dipForTests.reset` also set `pendingQuality = null`.

Add:

```ts
/** Every tier change from the governor or the quality button goes through here (spec 7a §2.4). False if nothing to do. */
export function requestQuality(q: Quality): boolean {
  if (q === (pendingQuality ?? useStore.getState().quality)) return false;
  pendingQuality = q;
  machine.refresh(pendingEra(), prefersReducedMotion());
  useDip.setState({ target: machine.target });
  if (machine.phase !== 'idle' && !raf) raf = requestAnimationFrame(loop);
  return true;
}
```

Also export `busy: () => machine.phase !== 'idle'` on the `eraDip` object (the governor pauses on it).

- [ ] **Step 4: Run tests**

Run: `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/dipMachine.ts src/ui/dipMachine.test.ts src/ui/dipController.ts src/ui/dipController.test.ts
git commit -m "feat(7a): tier swaps ride the era dip"
```

---

### Task 4: Governor in the scene, test hooks, ?fps=1 readout

**Files:**
- Create: `src/scene/QualityGovernor.tsx` (R3F component, inside `<Canvas>`)
- Create: `src/ui/FpsReadout.tsx` (HTML, outside `<Canvas>`)
- Modify: `src/App.tsx` (mount both), `src/styles.css` (`.fps-readout`)
- Test: `src/ui/FpsReadout.test.tsx`

**Interfaces:**
- Consumes: `QualityGovernor`, `GOV` (Task 2); `stepDown` (Task 1); `requestQuality`, `eraDip.busy` (Task 3); store `quality`, `qualityMode`, `eraId`, `fps`.
- Produces:
  - `window.__ANCON_QUALITY__: { tier: Quality; mode: QualityMode; steps: number }` (updated whenever tier or mode changes, and `steps` on each step).
  - `window.__ANCON_FAKE_FPS__?: number` — test hook: when set, each frame counts as `1 / __ANCON_FAKE_FPS__` s.

- [ ] **Step 1: Write the failing test** (`src/ui/FpsReadout.test.tsx`, jsdom)

```tsx
// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useStore } from '../state/store';
import { FpsReadout } from './FpsReadout';

afterEach(cleanup);
test('shows the tier and mode; nothing when ?fps is off', () => {
  act(() => useStore.setState({ fps: false }));
  const { container } = render(<FpsReadout />);
  expect(container.textContent).toBe('');
  act(() => useStore.setState({ fps: true, quality: 'medium', qualityMode: 'auto', lang: 'en' }));
  expect(screen.getByTestId('fps-readout').textContent).toContain('Medium');
  expect(screen.getByTestId('fps-readout').textContent).toContain('auto');
});
```

- [ ] **Step 2: Run to see it fail** — `npx vitest run src/ui/FpsReadout.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`src/scene/QualityGovernor.tsx`:

```tsx
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { stepDown, type Quality, type QualityMode } from '../quality';
import { QualityGovernor as Governor } from '../state/qualityGovernor';
import { useStore } from '../state/store';
import { eraDip, requestQuality } from '../ui/dipController';

declare global {
  interface Window {
    /** Spec 7a §2.5: the live tier, who chose it, and how many auto steps ran. */
    __ANCON_QUALITY__?: { tier: Quality; mode: QualityMode; steps: number };
    /** Test hook: every frame counts as 1 / this many seconds. */
    __ANCON_FAKE_FPS__?: number;
  }
}

/** Mount inside <Canvas>: feeds the governor (spec 7a §2) and steps the tier down through the dip. */
export function QualityGovernor() {
  const quality = useStore((s) => s.quality);
  const mode = useStore((s) => s.qualityMode);
  const eraId = useStore((s) => s.eraId);
  const gov = useMemo(() => new Governor(quality), []);   // eslint-disable-line react-hooks/exhaustive-deps -- reset below
  const steps = useRef(0);
  useEffect(() => { gov.reset(quality); }, [gov, quality, eraId, mode]);
  useEffect(() => { window.__ANCON_QUALITY__ = { tier: quality, mode, steps: steps.current }; }, [quality, mode]);
  useFrame((_, dt) => {
    if (mode !== 'auto' || !window.__ANCON_READY__) return;
    const fake = window.__ANCON_FAKE_FPS__;
    const paused = document.hidden || eraDip.busy() || dt > 0.5;
    if (gov.tick(fake ? 1 / fake : dt, 1, paused) !== 'down') return;
    const next = stepDown(useStore.getState().quality);
    if (next && requestQuality(next)) { steps.current++; window.__ANCON_QUALITY__ = { tier: quality, mode, steps: steps.current }; }
  });
  return null;
}
```

`src/ui/FpsReadout.tsx` (own rAF loop; r3f renders once per rAF, so this matches the scene rate):

```tsx
import { useEffect, useRef } from 'react';
import { QUALITY_NAMES } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { useStore } from '../state/store';

/** ?fps=1 (spec 7a §5): a small fps number plus the tier, for checks on a phone. No Leva, no StatsGl. */
export function FpsReadout() {
  const on = useStore((s) => s.fps);
  const quality = useStore((s) => s.quality);
  const mode = useStore((s) => s.qualityMode);
  const t = useT();
  const num = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!on) return;
    let raf = 0, frames = 0, since = performance.now();
    const loop = (now: number) => {
      frames++;
      if (now - since >= 500) { if (num.current) num.current.textContent = String(Math.round((frames * 1000) / (now - since))); frames = 0; since = now; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  if (!on) return null;
  return <div className="fps-readout" data-testid="fps-readout"><span ref={num}>–</span> fps · {t(QUALITY_NAMES[quality])} ({mode})</div>;
}
```

`QUALITY_NAMES` is added to `src/i18n/strings.ts` in this task (Task 5 reuses it):

```ts
/** Quality tier names (spec 7a §3). */
export const QUALITY_NAMES: Record<'high' | 'medium' | 'low', Bilingual> = {
  high: { es: 'Alta', en: 'High' },
  medium: { es: 'Media', en: 'Medium' },
  low: { es: 'Baja', en: 'Low' },
};
```

`src/styles.css`:

```css
/* ?fps=1 (spec 7a §5): small, top right, under the safe area; never takes taps. */
.fps-readout { position: fixed; top: max(8px, env(safe-area-inset-top)); right: 8px; z-index: 30; padding: 3px 7px; border-radius: 6px;
  background: rgba(12, 15, 15, 0.7); color: #f4ecdf; font: 600 11px/1.2 ui-monospace, Menlo, monospace; pointer-events: none; }
```

`src/App.tsx`: inside `<Canvas>` add `<QualityGovernor />` after `<DipFrameSignal />`; after `<Toolbar />` add `<FpsReadout />`.

- [ ] **Step 4: Run tests and build** — `npm test && npm run build` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scene/QualityGovernor.tsx src/ui/FpsReadout.tsx src/ui/FpsReadout.test.tsx src/i18n/strings.ts src/App.tsx src/styles.css
git commit -m "feat(7a): governor runs in the scene; ?fps=1 readout"
```

---

### Task 5: Quality button

**Files:**
- Create: `src/ui/QualityMenu.tsx`, `src/ui/qualityPick.ts`
- Modify: `src/ui/Toolbar.tsx` (mount `<QualityMenu />` right after the Sound button), `src/i18n/strings.ts` (`quality`, `auto`), `src/styles.css` (menu)
- Test: `src/ui/QualityMenu.test.tsx`, `src/ui/qualityPick.test.ts`

**Interfaces:**
- Consumes: `QualityChoice`, `detectQuality` (Task 1), `saveQualityPref`, `withoutQ` (Task 1), `requestQuality` (Task 3), `QUALITY_NAMES` (Task 4), store `quality`, `qualityMode`, `setQualityMode`, `frozen`, `perf`, `debug`.
- Produces: `pickQuality(c: QualityChoice): void`.

- [ ] **Step 1: Write the failing tests**

`src/ui/qualityPick.test.ts`:

```ts
// @vitest-environment jsdom
import { act } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { useStore } from '../state/store';
import { QUALITY_KEY } from '../state/qualityPrefs';
import { __dipForTests } from './dipController';
import { pickQuality } from './qualityPick';

beforeEach(() => { __dipForTests.reset(); window.history.replaceState(null, '', '/?era=1935&q=low'); act(() => useStore.setState({ quality: 'low', qualityMode: 'url', frozen: false, perf: false, debug: false })); });
afterEach(() => window.localStorage.clear());

test('a hand pick saves, drops ?q, turns auto off and asks for the tier', () => {
  pickQuality('high');
  expect(window.localStorage.getItem(QUALITY_KEY)).toBe('high');
  expect(window.location.search).toBe('?era=1935');
  expect(useStore.getState().qualityMode).toBe('hand');
});
test('Auto saves auto and turns the governor back on (off under dev flags)', () => {
  pickQuality('auto');
  expect(window.localStorage.getItem(QUALITY_KEY)).toBe('auto');
  expect(useStore.getState().qualityMode).toBe('auto');
  act(() => useStore.setState({ frozen: true }));
  pickQuality('auto');
  expect(useStore.getState().qualityMode).toBe('off');
});
```

`src/ui/QualityMenu.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { useStore } from '../state/store';
import { __dipForTests } from './dipController';
import { QualityMenu } from './QualityMenu';

beforeEach(() => { __dipForTests.reset(); window.history.replaceState(null, '', '/?era=1935'); act(() => useStore.setState({ lang: 'en', quality: 'medium', qualityMode: 'auto' })); });
afterEach(() => { cleanup(); window.localStorage.clear(); });

test('label shows Auto and the tier; the name starts with Quality', () => {
  render(<QualityMenu />);
  const btn = screen.getByRole('button', { name: /^Quality/ });
  expect(btn.textContent).toBe('Auto · Medium');
  expect(btn.getAttribute('aria-haspopup')).toBe('menu');
  expect(btn.getAttribute('aria-expanded')).toBe('false');
});
test('opens a menu of four radio items with the current choice checked and focused', () => {
  render(<QualityMenu />);
  fireEvent.click(screen.getByRole('button', { name: /^Quality/ }));
  const items = screen.getAllByRole('menuitemradio');
  expect(items.map((i) => i.textContent)).toEqual(['Auto', 'High', 'Medium', 'Low']);
  expect(items[0].getAttribute('aria-checked')).toBe('true');
  expect(document.activeElement).toBe(items[0]);
});
test('arrow keys move, a pick closes the menu, Esc returns focus', () => {
  render(<QualityMenu />);
  const btn = screen.getByRole('button', { name: /^Quality/ });
  fireEvent.click(btn);
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
  expect(document.activeElement?.textContent).toBe('High');
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
  expect(document.activeElement?.textContent).toBe('Low');            // wraps
  fireEvent.click(document.activeElement!);
  expect(screen.queryByRole('menu')).toBeNull();
  expect(useStore.getState().qualityMode).toBe('hand');
  expect(btn.textContent).toBe('Medium');                             // still medium until the dip swaps
  fireEvent.click(btn);
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(document.activeElement).toBe(btn);
});
test('Spanish labels', () => {
  act(() => useStore.setState({ lang: 'es', qualityMode: 'hand', quality: 'low' }));
  render(<QualityMenu />);
  expect(screen.getByRole('button', { name: /^Calidad/ }).textContent).toBe('Baja');
});
```

- [ ] **Step 2: Run to see them fail** — `npx vitest run src/ui/QualityMenu.test.tsx src/ui/qualityPick.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/i18n/strings.ts` → add to `STRINGS`: `quality: { es: 'Calidad', en: 'Quality' },` and `auto: { es: 'Auto', en: 'Auto' },`.

`src/ui/qualityPick.ts`:

```ts
import { detectQuality, type QualityChoice } from '../quality';
import { saveQualityPref, withoutQ } from '../state/qualityPrefs';
import { useStore } from '../state/store';
import { requestQuality } from './dipController';

/** The quality button's pick (spec 7a §3): saved, replaces ?q, Auto restarts from the start tier. */
export function pickQuality(c: QualityChoice) {
  saveQualityPref(c);
  const { search, pathname, hash } = window.location;
  if (new URLSearchParams(search).has('q')) window.history.replaceState(null, '', pathname + withoutQ(search) + hash);
  const st = useStore.getState();
  st.setQualityMode(c !== 'auto' ? 'hand' : st.frozen || st.perf || st.debug ? 'off' : 'auto');
  requestQuality(c === 'auto' ? detectQuality() : c);
}
```

`src/ui/QualityMenu.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { QUALITY_NAMES, STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';
import type { QualityChoice } from '../quality';
import { useStore } from '../state/store';
import { pickQuality } from './qualityPick';

const CHOICES: QualityChoice[] = ['auto', 'high', 'medium', 'low'];

/** Toolbar quality button and menu (spec 7a §3): Auto, High, Medium, Low. */
export function QualityMenu() {
  const t = useT();
  const quality = useStore((s) => s.quality);
  const mode = useStore((s) => s.qualityMode);
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const current: QualityChoice = mode === 'auto' ? 'auto' : quality;
  const name = (c: QualityChoice) => (c === 'auto' ? t(STRINGS.auto) : t(QUALITY_NAMES[c]));
  const label = mode === 'auto' ? `${t(STRINGS.auto)} · ${t(QUALITY_NAMES[quality])}` : t(QUALITY_NAMES[quality]);
  const close = () => { setOpen(false); btn.current?.focus(); };
  useEffect(() => { if (open) items.current[CHOICES.indexOf(current)]?.focus(); }, [open]);   // eslint-disable-line react-hooks/exhaustive-deps -- focus once on open
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!(e.target as Element).closest('.quality')) setOpen(false); };
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, [open]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const move = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (move) { e.preventDefault(); items.current[(i + move + CHOICES.length) % CHOICES.length]?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  };
  return (
    <div className="quality">
      <button ref={btn} type="button" className="toolbar__btn" aria-haspopup="menu" aria-expanded={open}
        aria-label={`${t(STRINGS.quality)}: ${label}`} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div className="quality__menu" role="menu" aria-label={t(STRINGS.quality)}>
          {CHOICES.map((c, i) => (
            <button key={c} ref={(el) => { items.current[i] = el; }} type="button" role="menuitemradio" aria-checked={c === current}
              className="quality__item" onKeyDown={(e) => onKey(e, i)} onClick={() => { pickQuality(c); close(); }}>
              {name(c)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

`src/ui/Toolbar.tsx`: import `QualityMenu`, render `<QualityMenu />` right after the Sound button. The Facts-panel Esc listener sits on `window`; the menu's `stopPropagation` stops a menu Esc from also closing the panel.

`src/styles.css`, after the toolbar rules:

```css
/* Quality button and menu (spec 7a §3). */
.quality { position: relative; }
.quality__menu { position: absolute; top: calc(100% + 6px); left: 0; z-index: 25; display: flex; flex-direction: column; min-width: 140px; padding: 4px;
  border-radius: 10px; background: rgba(20, 19, 17, 0.94); border: 1px solid rgba(244, 236, 223, 0.14); }
.quality__item { min-height: 44px; padding: 0 12px; border: 0; border-radius: 7px; background: transparent; color: #f4ecdf; text-align: left;
  font: 600 14px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; touch-action: manipulation; }
.quality__item[aria-checked='true'] { background: #f4ecdf; color: #1b1a17; }
.quality__item:focus-visible { outline: 2px solid #f2c46d; outline-offset: 1px; }
@media (max-width: 639px) { .quality__menu { left: auto; right: 0; } }
```

- [ ] **Step 4: Run tests and build** — `npm test && npm run build` → PASS. Existing `Toolbar.test.tsx` must still pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/QualityMenu.tsx src/ui/QualityMenu.test.tsx src/ui/qualityPick.ts src/ui/qualityPick.test.ts src/ui/Toolbar.tsx src/i18n/strings.ts src/styles.css
git commit -m "feat(7a): quality button (Auto, High, Medium, Low)"
```

---

### Task 6: Load card

**Files:**
- Modify: `index.html` (card markup, inline CSS, boot script)
- Create: `src/ui/loadCard.ts`
- Modify: `src/main.tsx` (`setLoadStep('code')`), `src/scene/ReadySignal.tsx` (`'scene'` on mount, dismiss at ready), `src/ui/SceneBoundary.tsx` (dismiss on failure)
- Test: `src/ui/loadCard.test.ts`

**Interfaces:**
- Consumes: `ERA_IDS` (`src/data/eras.ts`), `DEFAULT_ERA` (Task 1), `detectLang` (`src/i18n/text.ts`), `prefersReducedMotion` (`src/ui/motion.ts`).
- Produces: `setLoadStep(s: 'code' | 'scene'): void`, `dismissLoadCard(reduced?: boolean): void`; global inline function `anconLoadCard(search: string, navLang: string | undefined): { year: string; lang: 'es' | 'en' }` inside `index.html` between `/* load-card:boot */` and `/* load-card:end */`.

- [ ] **Step 1: Write the failing test** (`src/ui/loadCard.test.ts`)

```ts
// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import { ERA_IDS } from '../data/eras';
import { detectLang } from '../i18n/text';
import { DEFAULT_ERA } from '../state/store';
import { dismissLoadCard, setLoadStep } from './loadCard';

const html = readFileSync('index.html', 'utf8');
const boot = html.slice(html.indexOf('/* load-card:boot */'), html.indexOf('/* load-card:end */'));
const anconLoadCard = new Function(`${boot}; return anconLoadCard;`)() as (s: string, n?: string) => { year: string; lang: string };

test('the inline boot script agrees with the app on era and language (spec 7a §4)', () => {
  for (const id of ERA_IDS) expect(anconLoadCard(`?era=${id}`, 'en-US').year).toBe(id);
  expect(anconLoadCard('?era=1999', 'en').year).toBe(DEFAULT_ERA);
  expect(anconLoadCard('', 'en').year).toBe(DEFAULT_ERA);
  for (const n of ['en-US', 'EN', 'es-PR', 'fr', undefined]) expect(anconLoadCard('', n).lang).toBe(detectLang(n));
  expect(anconLoadCard('?lang=en', 'es').lang).toBe('en');
  expect(anconLoadCard('?lang=xx', 'es').lang).toBe('es');
});
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; delete document.body.dataset.load; });
test('steps go on body[data-load]; dismiss fades then removes, or removes at once with reduced motion', () => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="load-card"></div>';
  setLoadStep('scene');
  expect(document.body.dataset.load).toBe('scene');
  dismissLoadCard(false);
  expect(document.getElementById('load-card')?.classList.contains('load-card--out')).toBe(true);
  vi.advanceTimersByTime(700);
  expect(document.getElementById('load-card')).toBeNull();
  document.body.innerHTML = '<div id="load-card"></div>';
  dismissLoadCard(true);
  expect(document.getElementById('load-card')).toBeNull();
  expect(() => dismissLoadCard(true)).not.toThrow();
});
```

- [ ] **Step 2: Run to see it fail** — `npx vitest run src/ui/loadCard.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`index.html` — in `<head>` add a `<style>` block; in `<body>` before `#root` add the card and boot script. Keep the era list in the script in the same order as `ERA_IDS` (read `src/data/eras.ts`) and the default as `DEFAULT_ERA` (`'1975'`); the test enforces both.

```html
    <style>
      /* Load card (spec 7a §4): shown before the bundle runs; same tone as the era dip (.era-dip in src/styles.css). */
      #load-card { position: fixed; inset: 0; z-index: 40; display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: radial-gradient(ellipse at 50% 45%, #8a7556 0%, #5e4d38 60%, #3f3426 100%); color: #f4ecdf; transition: opacity 0.6s ease; }
      #load-card.load-card--out { opacity: 0; pointer-events: none; }
      .load-card__kicker { font: 500 13px/1.4 ui-serif, Georgia, serif; text-transform: uppercase; letter-spacing: 0.24em; opacity: 0.85; }
      .load-card__year { font: 500 clamp(64px, 14vw, 160px)/1 ui-serif, Georgia, serif; letter-spacing: 0.04em; margin-top: 8px; }
      .load-card__bar { width: min(220px, 50vw); height: 2px; margin-top: 22px; background: rgba(244, 236, 223, 0.25); border-radius: 1px; overflow: hidden; }
      .load-card__fill { width: 0; height: 100%; background: #f4ecdf; transition: width 0.4s ease; }
      body[data-load='code'] .load-card__fill { width: 33%; }
      body[data-load='scene'] .load-card__fill { width: 67%; }
      body[data-ready] .load-card__fill { width: 100%; }
      @media (prefers-reduced-motion: reduce) { #load-card, .load-card__fill { transition: none; } }
    </style>
```

```html
    <div id="load-card" role="status">
      <div class="load-card__kicker">El Ancón de Loíza</div>
      <div class="load-card__year" id="load-card-year">1975</div>
      <div class="load-card__bar" aria-hidden="true"><div class="load-card__fill"></div></div>
      <span class="sr-only" id="load-card-text">Cargando</span>
    </div>
    <script>
      /* load-card:boot */
      // Must match ERA_IDS and DEFAULT_ERA in src/data/eras.ts / src/state/store.ts and detectLang in src/i18n/text.ts (src/ui/loadCard.test.ts).
      function anconLoadCard(search, navLang) {
        var eras = [/* ERA_IDS, in order, as strings */];
        var p = new URLSearchParams(search), era = p.get('era'), lang = p.get('lang');
        if (lang !== 'es' && lang !== 'en') lang = (navLang || '').toLowerCase().indexOf('en') === 0 ? 'en' : 'es';
        return { year: eras.indexOf(era) >= 0 ? era : '1975', lang: lang };
      }
      /* load-card:end */
      (function () {
        var r = anconLoadCard(location.search, navigator.language);
        document.getElementById('load-card-year').textContent = r.year;
        document.getElementById('load-card-text').textContent = r.lang === 'en' ? 'Loading' : 'Cargando';
        document.documentElement.lang = r.lang;
      })();
    </script>
```

Replace the `eras` placeholder comment with the literal list from `ERA_IDS` (e.g. `['1840', '1900', …]`). `.sr-only` is defined in `src/styles.css`, which loads with the bundle; until then the span is unstyled but empty-looking text inside the card is acceptable only if hidden — so also add `.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }` to the inline `<style>`.

`src/ui/loadCard.ts`:

```ts
import { prefersReducedMotion } from './motion';

/** Load card progress (spec 7a §4): real steps only. 'ready' is body[data-ready], set by ReadySignal. */
export function setLoadStep(s: 'code' | 'scene') { document.body.dataset.load = s; }

/** Fades the card out (0.6 s) and removes it; at once with reduced motion. Safe to call twice. */
export function dismissLoadCard(reduced = prefersReducedMotion()) {
  const el = document.getElementById('load-card');
  if (!el) return;
  if (reduced) { el.remove(); return; }
  el.classList.add('load-card--out');
  window.setTimeout(() => el.remove(), 700);
}
```

`src/main.tsx`: `import { setLoadStep } from './ui/loadCard';` and call `setLoadStep('code');` before `createRoot(...)`.

`src/scene/ReadySignal.tsx`: add `useEffect(() => setLoadStep('scene'), []);` and at frame 30 call `dismissLoadCard();` after setting `data-ready`.

`src/ui/SceneBoundary.tsx`: in `componentDidCatch` call `dismissLoadCard(true);` after the warning.

- [ ] **Step 4: Run tests and build** — `npm test && npm run build` → PASS. Run `npm run dev` is not needed; e2e in Task 7 covers the browser.

- [ ] **Step 5: Commit**

```bash
git add index.html src/ui/loadCard.ts src/ui/loadCard.test.ts src/main.tsx src/scene/ReadySignal.tsx src/ui/SceneBoundary.tsx
git commit -m "feat(7a): load card with real progress steps"
```

---

### Task 7: Vendor chunk, touch, and end-to-end tests

**Files:**
- Modify: `vite.config.ts` (vendor chunk), `src/styles.css` (`canvas { touch-action: none; }`)
- Create: `tests/e2e/quality.spec.ts`

**Interfaces:**
- Consumes: `window.__ANCON_QUALITY__`, `window.__ANCON_FAKE_FPS__` (Task 4), `#load-card` (Task 6), quality button (Task 5).

- [ ] **Step 1: Vendor chunk and touch**

`vite.config.ts`, add a `build` key:

```ts
  // Spec 7a §5: the 3D libraries change less often than the app, so repeat visits keep this chunk cached.
  build: { rolldownOptions: { output: { codeSplitting: { groups: [
    { name: 'vendor-3d', test: /node_modules[\\/](three|@react-three|postprocessing|n8ao|three-custom-shader-material|camera-controls)[\\/]/ },
  ] } } } },
```

`src/styles.css` line 2: `canvas { display: block; touch-action: none; }` with a comment `/* Spec 7a §5: a drag on the scene looks around; it never scrolls or zooms the page. */`.

Run: `npm run build`. Expected: a `vendor-3d-*.js` chunk and a smaller `index-*.js`; `DebugPanel-*.js` (Leva) still its own chunk. If the build fails because `codeSplitting` is not accepted, read `node_modules/rolldown/dist/shared/define-config-*.d.mts` (`codeSplitting?: boolean | CodeSplittingOptions`) and fix the shape; do not fall back to `manualChunks`.

- [ ] **Step 2: Write the e2e spec** (`tests/e2e/quality.spec.ts`)

```ts
import { expect, test } from '@playwright/test';

const ready = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });

test('the load card shows the era year, then is gone after ready', async ({ page }) => {
  await page.goto('?era=1935&freeze=1&q=low&lang=en');
  const card = page.locator('#load-card');
  await expect(card).toContainText('1935');
  await ready(page);
  await expect(card).toHaveCount(0, { timeout: 5_000 });
});

test('the quality button changes the tier and the choice survives a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('?era=1975&freeze=1&q=low&lang=en');
  await ready(page);
  await page.getByRole('button', { name: /^Quality/ }).click();
  await page.getByRole('menuitemradio', { name: 'Medium' }).click();
  await page.waitForFunction(() => window.__ANCON_QUALITY__?.tier === 'medium', null, { timeout: 30_000 });
  await expect(page).not.toHaveURL(/[?&]q=/);
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => window.__ANCON_QUALITY__)).toMatchObject({ tier: 'medium', mode: 'hand' });
  expect(errors).toEqual([]);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Auto starts a phone on medium and a slow frame rate steps it down to low through the dip', async ({ page }) => {
    await page.addInitScript(() => { window.__ANCON_FAKE_FPS__ = 20; });
    await page.goto('?era=1975&lang=en');
    await ready(page);
    expect(await page.evaluate(() => window.__ANCON_QUALITY__)).toMatchObject({ tier: 'medium', mode: 'auto' });
    await page.waitForFunction(() => window.__ANCON_QUALITY__?.tier === 'low', null, { timeout: 60_000 });
    expect(await page.evaluate(() => window.__ANCON_QUALITY__?.steps)).toBe(1);
  });

  test('the canvas takes the drag (touch-action none)', async ({ page }) => {
    await page.goto('?era=1975&freeze=1&q=low');
    await ready(page);
    expect(await page.locator('canvas').evaluate((c) => getComputedStyle(c).touchAction)).toBe('none');
  });
});
```

- [ ] **Step 3: Run the e2e suite**

Run: `npm run e2e:fast`
Expected: all pass, including the existing specs (they all pass `?q=`, so their governor is off). If the phone step-down test is slow under SwiftShader, raise only that test's timeout (`test.setTimeout(180_000)`); do not lower the governor timings.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts src/styles.css tests/e2e/quality.spec.ts
git commit -m "feat(7a): vendor chunk, canvas touch-action, quality e2e"
```

---

### Task 8 (controller): desktop check, notes, PR

Done by the controller, not a subagent.

- [ ] `npm test`, `npm run build`, `npm run e2e` (full, includes `@slow`).
- [ ] Desktop perf (spec §6 last row): `npm run preview` then `node scripts/dev/perf.mjs "?era=1975&q=high&cam=ride" 10 1.75`; compare with the 6b number in `docs/superpowers/notes/phase-6b-rulings.md`; must stay ≥ 60 fps and within 5 %.
- [ ] Check the build output: `vendor-3d` chunk size and `index` chunk size, before/after.
- [ ] Write `docs/superpowers/notes/phase-7a-rulings.md`: controller rulings, the numbers above, and the **iPhone checklist** for the user (spec §5–§6): how to serve on the local network (`npm run build && npx vite preview --host --port 4173`), the URL to open (`http://<mac-ip>:4173/ancon-de-loiza/?fps=1`), and what to record (time to card, time to ready, fps per tier in Ride, tier after 5 minutes, portrait and landscape layout).
- [ ] Push the branch and open a PR (do not merge). The iPhone measurement and the "fix the biggest one or two costs" step (spec §5) follow after the user's phone numbers.
