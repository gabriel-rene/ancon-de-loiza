# Phase 6b Sound Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add code-made 3D sound (river, wind, birds, pole/rope work, hull knock, cars) behind one toolbar button, off by default.

**Architecture:** Pure TypeScript clip makers render short sounds into `Float32Array`s; pure `mix.ts` and `events.ts` decide levels and one-shots; a lazy-loaded chunk (`engine.ts`, `rig.ts`, `Sound.tsx`) turns them into three.js `Audio` / `PositionalAudio` voices. The scene writes the few positions sound needs (waders, ferry cars, bridge cars) into a tiny shared `taps.ts` in the main chunk.

**Tech Stack:** TypeScript, React 19, @react-three/fiber 9, three 0.186 (`AudioListener`, `Audio`, `PositionalAudio`, `AudioContext`), zustand, vitest (node + jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-01-phase-6b-sound-design.md`

## Global Constraints

- All sound is made in code. No audio files, no new npm dependencies.
- No plena or music; no ox, horse, bicycle, crew or rider sounds.
- Sound is **off at the start**; one toolbar button; choice stored in `localStorage` key `ancon.sound` (`'1'` on, `'0'` off); every `localStorage` call in try/catch, failure = off.
- At most **12 voices** at once (water 1 + wind 1 + traffic 2 + engines 3 + one-shots 5).
- All clips built in **< 500 ms** on the low tier (measured on the dev Mac).
- **fps within 5 %** of `main` on all quality tiers with sound on (`scripts/dev/perf.mjs`).
- Main chunk grows by **< 2 kB gzipped**; `engine.ts`, `clips.ts`, `dsp.ts`, `mix.ts`, `events.ts`, `voices.ts`, `rig.ts`, `Sound.tsx` are only reachable through `import()`.
- No per-frame allocation in `useFrame` / `update` paths (project rule since Phase 2).
- Labels bilingual via `STRINGS` (`es` / `en`).
- Branch `phase-6b-sound`; merge only after the user listens and approves.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File map

| File | Chunk | Job |
|---|---|---|
| `src/sound/prefs.ts` | main | read/write `ancon.sound` |
| `src/sound/unlock.ts` | main | resume the shared `AudioContext` inside a user gesture |
| `src/sound/taps.ts` | main | shared positions written by the scene |
| `src/sound/SoundGate.tsx` | main | inside `<Canvas>`: lazy-loads `Sound.tsx` when on and unlocked |
| `src/sound/dsp.ts` | lazy | noise, filters, envelopes, loop crossfade |
| `src/sound/clips.ts` | lazy | one maker per clip, `CLIPS` registry |
| `src/sound/mix.ts` | lazy | levels per view / sun / dip / bridge |
| `src/sound/events.ts` | lazy | one-shots per frame (knock, creak, pole, calls, flaps) |
| `src/sound/voices.ts` | lazy | one-shot voice pool |
| `src/sound/engine.ts` | lazy | listener, context, buffers, visibility |
| `src/sound/rig.ts` | lazy | all `Audio` objects; per-frame update |
| `src/sound/Sound.tsx` | lazy | R3F glue (default export) |
| `src/sound/debugPlay.ts` | lazy | play one clip from the debug panel |

---

### Task 1: Sound preference, store field, toolbar button

**Files:**
- Create: `src/sound/prefs.ts`, `src/sound/unlock.ts`, `src/sound/prefs.test.ts`
- Modify: `src/state/store.ts`, `src/i18n/strings.ts`, `src/ui/Toolbar.tsx`
- Test: `src/ui/Toolbar.test.tsx` (add tests)

**Interfaces:**
- Produces: `SOUND_KEY`, `loadSoundPref(): boolean`, `saveSoundPref(on: boolean): void`; `unlockAudio(): void`, `audioUnlocked(): boolean`; store `soundOn: boolean`, `setSound(on: boolean): void`; `STRINGS.sound`.

- [ ] **Step 1: Write the failing tests**

`src/sound/prefs.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { loadSoundPref, saveSoundPref, SOUND_KEY } from './prefs';

afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

test('off when nothing is stored; round-trips on and off', () => {
  expect(loadSoundPref()).toBe(false);
  saveSoundPref(true);
  expect(window.localStorage.getItem(SOUND_KEY)).toBe('1');
  expect(loadSoundPref()).toBe(true);
  saveSoundPref(false);
  expect(loadSoundPref()).toBe(false);
});
test('a throwing localStorage means off, and saving does not throw', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(loadSoundPref()).toBe(false);
  expect(() => saveSoundPref(true)).not.toThrow();
});
```

Add to `src/ui/Toolbar.test.tsx` (inside the existing file, after the current tests):
```tsx
test('the Sound button starts off, toggles aria-pressed and stores the choice', () => {
  act(() => useStore.getState().setSound(false));
  render(<Toolbar />);
  const btn = screen.getByRole('button', { name: 'Sound' });
  expect(btn.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(btn);
  expect(btn.getAttribute('aria-pressed')).toBe('true');
  expect(useStore.getState().soundOn).toBe(true);
  expect(window.localStorage.getItem('ancon.sound')).toBe('1');
  fireEvent.click(btn);
  expect(useStore.getState().soundOn).toBe(false);
  expect(window.localStorage.getItem('ancon.sound')).toBe('0');
});
test('the Sound button is labelled in Spanish', () => {
  act(() => useStore.getState().setLang('es'));
  render(<Toolbar />);
  expect(screen.getByRole('button', { name: 'Sonido' })).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/sound/prefs.test.ts src/ui/Toolbar.test.tsx`
Expected: FAIL (`./prefs` not found; no button named "Sound").

- [ ] **Step 3: Implement**

`src/sound/prefs.ts`:
```ts
/** Spec 6b §3: the visitor's sound choice survives a reload. Any storage failure means "off". */
export const SOUND_KEY = 'ancon.sound';

export function loadSoundPref(): boolean {
  try { return typeof window !== 'undefined' && window.localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; }
}
export function saveSoundPref(on: boolean) {
  try { if (typeof window !== 'undefined') window.localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* private mode: not remembered */ }
}
```

`src/sound/unlock.ts`:
```ts
import { AudioContext as SharedContext } from 'three';

let unlocked = false;
/**
 * Browsers start audio only inside a user gesture. Call this synchronously from a click or key handler:
 * it creates three's shared AudioContext (the one AudioListener will use) and resumes it. No-op without Web Audio.
 */
export function unlockAudio() {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return;
  const ctx = SharedContext.getContext();
  if (ctx.state !== 'running') void ctx.resume();
  unlocked = true;
}
/** True once a gesture has unlocked audio in this page load. */
export const audioUnlocked = () => unlocked;
```

`src/i18n/strings.ts` — add after `recenter`:
```ts
  sound: { es: 'Sonido', en: 'Sound' },
```

`src/state/store.ts`:
- import: `import { loadSoundPref, saveSoundPref } from '../sound/prefs';`
- in `AppState` add:
```ts
  /** Spec 6b §3: off by default, remembered in localStorage. */
  soundOn: boolean; setSound: (on: boolean) => void;
```
- in the initial object add `soundOn: loadSoundPref(),` before `...fromUrl`, and with the setters:
```ts
  setSound: (soundOn) => { saveSoundPref(soundOn); set({ soundOn }); },
```

`src/ui/Toolbar.tsx`:
- import `unlockAudio` from `'../sound/unlock'`.
- in the component: `const soundOn = useStore((s) => s.soundOn);`
- between the `toolbar__lang` group and `<ViewSwitch />`:
```tsx
        <button type="button" className="toolbar__btn" aria-pressed={soundOn}
          onClick={() => { if (!soundOn) unlockAudio(); useStore.getState().setSound(!soundOn); }}>
          {t(STRINGS.sound)}
        </button>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/sound/prefs.test.ts src/ui/Toolbar.test.tsx src/state`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sound/prefs.ts src/sound/prefs.test.ts src/sound/unlock.ts src/state/store.ts src/i18n/strings.ts src/ui/Toolbar.tsx src/ui/Toolbar.test.tsx
git commit -m "feat(6b): sound button, remembered choice, audio unlock"
```

---

### Task 2: DSP kit

**Files:**
- Create: `src/sound/dsp.ts`, `src/sound/dsp.test.ts`

**Interfaces:**
- Produces (all pure, no Web Audio): `type Buf = Float32Array<ArrayBuffer>`; `rng(seed): () => number`; `samples(sec, sr): number`; `white(n, r): Buf`; `brown(n, r): Buf`; `tone(n, sr, f0, f1, shape: 'sine' | 'saw'): Buf`; `lowpass(x, hz, sr): Buf`; `highpass(x, hz, sr): Buf`; `bandpass(x, hz, q, sr): Buf` (all in place, return `x`); `envAD(n, sr, start, attack, decay): Buf`; `mulInto(x, e): Buf`; `addInto(dst, src, at, gain?): Buf`; `normalize(x, peak): Buf`; `fadeEdges(x, sr, sec?): Buf`; `loopify(x, fade): Buf`; `maxStep(x): number`.

- [ ] **Step 1: Write the failing tests**

`src/sound/dsp.test.ts`:
```ts
import { expect, test } from 'vitest';
import { bandpass, brown, envAD, fadeEdges, highpass, loopify, lowpass, maxStep, normalize, rng, samples, tone, white } from './dsp';

const SR = 22050;
const rms = (x: Float32Array) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
const peak = (x: Float32Array) => x.reduce((a, v) => Math.max(a, Math.abs(v)), 0);

test('rng is deterministic per seed and in [0, 1)', () => {
  const a = rng(7), b = rng(7), c = rng(8);
  const xs = Array.from({ length: 1000 }, a);
  expect(xs).toEqual(Array.from({ length: 1000 }, b));
  expect(xs.every((v) => v >= 0 && v < 1)).toBe(true);
  expect(c()).not.toBe(rng(7)());
});
test('white noise is in [-1, 1]; brown noise is darker than white', () => {
  const w = white(SR, rng(1)), b = brown(SR, rng(1));
  expect(peak(w)).toBeLessThanOrEqual(1);
  expect(maxStep(normalize(b, 1))).toBeLessThan(maxStep(normalize(w, 1)) / 4);
});
test('lowpass removes a high tone; highpass removes a low tone; bandpass keeps its centre', () => {
  const hi = () => tone(SR, SR, 5000, 5000, 'sine'), lo = () => tone(SR, SR, 60, 60, 'sine');
  expect(rms(lowpass(hi(), 200, SR))).toBeLessThan(0.05);
  expect(rms(highpass(lo(), 2000, SR))).toBeLessThan(0.05);
  expect(rms(bandpass(tone(SR, SR, 800, 800, 'sine'), 800, 2, SR))).toBeGreaterThan(0.5);
  expect(rms(bandpass(tone(SR, SR, 8000, 8000, 'sine'), 800, 2, SR))).toBeLessThan(0.1);
});
test('envAD is 0 before start, peaks at start + attack, then decays', () => {
  const e = envAD(SR, SR, 0.1, 0.05, 0.1);
  expect(e[samples(0.09, SR)]).toBe(0);
  expect(e[samples(0.15, SR)]).toBeCloseTo(1, 2);
  expect(e[samples(0.45, SR)]).toBeLessThan(0.1);
});
test('normalize sets the peak; fadeEdges zeroes both ends', () => {
  const x = normalize(white(1000, rng(3)), 0.5);
  expect(peak(x)).toBeCloseTo(0.5, 6);
  fadeEdges(x, SR);
  expect(x[0]).toBe(0); expect(x[x.length - 1]).toBe(0);
});
test('loopify shortens by the fade and joins end to start without a jump', () => {
  const n = samples(1, SR), f = samples(0.1, SR), y = loopify(lowpass(white(n + f, rng(5)), 500, SR), f);
  expect(y.length).toBe(n);
  expect(Math.abs(y[n - 1] - y[0])).toBeLessThanOrEqual(maxStep(y) + 1e-6);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/sound/dsp.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/sound/dsp.ts`**

```ts
/** Tiny offline DSP for spec 6b §4.1: plain arrays, no Web Audio, so every clip runs in unit tests. */
export type Buf = Float32Array<ArrayBuffer>;

/** mulberry32: deterministic values in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const samples = (sec: number, sr: number) => Math.round(sec * sr);

export function white(n: number, r: () => number): Buf {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = r() * 2 - 1;
  return x;
}
/** Leaky-integrated white noise: a deep rumble. Not normalized. */
export function brown(n: number, r: () => number): Buf {
  const x = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < n; i++) { y = y * 0.995 + (r() * 2 - 1) * 0.1; x[i] = y; }
  return x;
}
/** A tone whose frequency moves linearly from f0 to f1 Hz over n samples. */
export function tone(n: number, sr: number, f0: number, f1: number, shape: 'sine' | 'saw'): Buf {
  const x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const f = f0 + ((f1 - f0) * i) / Math.max(1, n - 1);
    ph += f / sr; ph -= Math.floor(ph);
    x[i] = shape === 'sine' ? Math.sin(2 * Math.PI * ph) : 2 * ph - 1;
  }
  return x;
}
/** One-pole low-pass, in place. */
export function lowpass(x: Buf, hz: number, sr: number): Buf {
  const a = 1 - Math.exp((-2 * Math.PI * hz) / sr);
  let y = 0;
  for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); x[i] = y; }
  return x;
}
/** One-pole high-pass (input minus its low-pass), in place. */
export function highpass(x: Buf, hz: number, sr: number): Buf {
  const a = 1 - Math.exp((-2 * Math.PI * hz) / sr);
  let lp = 0;
  for (let i = 0; i < x.length; i++) { lp += a * (x[i] - lp); x[i] -= lp; }
  return x;
}
/** RBJ band-pass (0 dB peak gain), in place. */
export function bandpass(x: Buf, hz: number, q: number, sr: number): Buf {
  const w = (2 * Math.PI * hz) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
  const b0 = al / a0, b2 = -al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i], y = b0 * xi + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}
/** Envelope: 0 until `start` s, linear rise over `attack` s to 1, then exponential decay with time constant `decay` s. */
export function envAD(n: number, sr: number, start: number, attack: number, decay: number): Buf {
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr - start;
    e[i] = t < 0 ? 0 : t < attack ? t / attack : Math.exp(-(t - attack) / decay);
  }
  return e;
}
export function mulInto(x: Buf, e: Float32Array): Buf {
  for (let i = 0; i < x.length; i++) x[i] *= e[i];
  return x;
}
/** dst[at + i] += src[i] · gain, clipped to dst's length. */
export function addInto(dst: Buf, src: Float32Array, at: number, gain = 1): Buf {
  for (let i = 0; i < src.length && at + i < dst.length; i++) if (at + i >= 0) dst[at + i] += src[i] * gain;
  return dst;
}
export function normalize(x: Buf, peak: number): Buf {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m;
  return x;
}
/** Short linear fade at both ends of a one-shot (no click at start or stop). */
export function fadeEdges(x: Buf, sr: number, sec = 0.005): Buf {
  const f = Math.min(Math.floor(x.length / 2), samples(sec, sr));
  for (let i = 0; i < f; i++) { const g = i / f; x[i] *= g; x[x.length - 1 - i] *= g; }
  return x;
}
/**
 * Seamless loop from x (length n + fade): the last `fade` samples are cross-faded (equal power) into the first.
 * Output length n; its sample after the last is x[n], so the join is an original neighbour step of x.
 */
export function loopify(x: Buf, fade: number): Buf {
  const n = x.length - fade, y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (i >= fade) { y[i] = x[i]; continue; }
    const t = i / fade;
    y[i] = x[i] * Math.sqrt(t) + x[n + i] * Math.sqrt(1 - t);
  }
  return y;
}
/** Largest |x[i+1] − x[i]|. */
export function maxStep(x: Float32Array): number {
  let m = 0;
  for (let i = 1; i < x.length; i++) m = Math.max(m, Math.abs(x[i] - x[i - 1]));
  return m;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/sound/dsp.test.ts` — Expected: PASS. If the bandpass 8 kHz bound fails at 22.05 kHz, check the filter math against the RBJ cookbook before loosening any bound.

- [ ] **Step 5: Commit**

```bash
git add src/sound/dsp.ts src/sound/dsp.test.ts
git commit -m "feat(6b): offline DSP kit for code-made clips"
```

---

### Task 3: Clips

**Files:**
- Create: `src/sound/clips.ts`, `src/sound/clips.test.ts`

**Interfaces:**
- Consumes: everything from `dsp.ts` (Task 2).
- Produces: `type ClipId = 'water' | 'wind' | 'croak' | 'peep' | 'flap' | 'pole' | 'creak' | 'knock' | 'engine' | 'traffic'`; `interface ClipDef { loop: boolean; seconds: number; build: (seed: number, sr: number) => Buf }`; `CLIPS: Record<ClipId, ClipDef>`; `CLIP_IDS: readonly ClipId[]`; `CLIP_SEED: Record<ClipId, number>`.

- [ ] **Step 1: Write the failing tests**

`src/sound/clips.test.ts`:
```ts
import { expect, test } from 'vitest';
import { CLIP_IDS, CLIP_SEED, CLIPS } from './clips';
import { maxStep, samples } from './dsp';

const SR = 22050;

test.each(CLIP_IDS)('%s: set length, finite, peak in (0.05, 1]', (id) => {
  const c = CLIPS[id], x = c.build(CLIP_SEED[id], SR);
  expect(x.length).toBe(samples(c.seconds, SR));
  let p = 0;
  for (const v of x) { expect(Number.isFinite(v)).toBe(true); p = Math.max(p, Math.abs(v)); }
  expect(p).toBeGreaterThan(0.05);
  expect(p).toBeLessThanOrEqual(1);
});
test.each(CLIP_IDS)('%s: same seed gives the same samples; another seed differs', (id) => {
  const a = CLIPS[id].build(3, SR), b = CLIPS[id].build(3, SR), c = CLIPS[id].build(4, SR);
  expect(a).toEqual(b);
  expect(a).not.toEqual(c);
});
test.each(CLIP_IDS.filter((id) => CLIPS[id].loop))('%s loops without a jump', (id) => {
  const x = CLIPS[id].build(CLIP_SEED[id], SR);
  expect(Math.abs(x[x.length - 1] - x[0])).toBeLessThanOrEqual(maxStep(x) + 1e-6);
});
test.each(CLIP_IDS.filter((id) => !CLIPS[id].loop))('%s starts and ends silent', (id) => {
  const x = CLIPS[id].build(CLIP_SEED[id], SR);
  expect(x[0]).toBe(0); expect(x[x.length - 1]).toBe(0);
});
test('loops are the four beds; one-shots are short', () => {
  expect(CLIP_IDS.filter((id) => CLIPS[id].loop).sort()).toEqual(['engine', 'traffic', 'water', 'wind']);
  for (const id of CLIP_IDS) if (!CLIPS[id].loop) expect(CLIPS[id].seconds, id).toBeLessThanOrEqual(1.5);
});
test('all clips build fast at 48 kHz (spec 6b §5: < 500 ms on the dev Mac; CI runs ~4× slower)', () => {
  const t0 = performance.now();
  for (const id of CLIP_IDS) CLIPS[id].build(CLIP_SEED[id], 48000);
  expect(performance.now() - t0).toBeLessThan(2000);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/sound/clips.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/sound/clips.ts`**

```ts
import {
  addInto, bandpass, brown, envAD, fadeEdges, highpass, loopify, lowpass, mulInto, normalize, rng, samples, tone, white, type Buf,
} from './dsp';

/** Spec 6b §2: every sound in the scene, made in code. Loops are seamless; one-shots fade in and out. */
export type ClipId = 'water' | 'wind' | 'croak' | 'peep' | 'flap' | 'pole' | 'creak' | 'knock' | 'engine' | 'traffic';
export interface ClipDef { loop: boolean; seconds: number; build: (seed: number, sr: number) => Buf }

/** A loop of `sec` s: render sec + fade, then cross-fade the tail into the head. */
const asLoop = (sec: number, fade: number, sr: number, render: (n: number) => Buf) => {
  const n = samples(sec, sr), f = samples(fade, sr);
  return loopify(render(n + f), f);
};

/** River lapping: a low rumble bed plus short band-passed laps every 0.25–0.75 s. */
function water(seed: number, sr: number): Buf {
  const r = rng(seed);
  return normalize(asLoop(4, 0.25, sr, (n) => {
    const bed = normalize(lowpass(lowpass(brown(n, r), 700, sr), 700, sr), 0.5);
    for (let t = 0.1; t < n / sr - 0.4; t += 0.25 + 0.5 * r()) {
      const len = samples(0.35, sr), lap = bandpass(white(len, r), 350 + 400 * r(), 1.2, sr);
      mulInto(lap, envAD(len, sr, 0, 0.03, 0.08));
      addInto(bed, normalize(lap, 0.25 + 0.2 * r()), samples(t, sr));
    }
    return bed;
  }), 0.7);
}
/** Soft wind with slow gusts, and a little leaf hiss on the gusts. */
function wind(seed: number, sr: number): Buf {
  const r = rng(seed), ph = r() * 6;
  return normalize(asLoop(6, 0.5, sr, (n) => {
    const x = lowpass(bandpass(white(n, r), 450, 0.6, sr), 1200, sr), leaves = highpass(white(n, r), 3000, sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr, g = 0.6 + 0.25 * Math.sin((2 * Math.PI * t) / 3 + ph) + 0.15 * Math.sin((2 * Math.PI * t) / 1.7 + 1);
      x[i] = x[i] * g + leaves[i] * 0.08 * Math.max(0, g - 0.5);
    }
    return x;
  }), 0.5);
}
/** Heron / egret: a rough, low two-part croak. */
function croak(seed: number, sr: number): Buf {
  const r = rng(seed), n = samples(0.6, sr), f0 = 140 + 40 * r();
  const x = tone(n, sr, f0, f0 * 0.72, 'saw'), rasp = white(n, r);
  for (let i = 0; i < n; i++) x[i] *= 0.7 + 0.3 * rasp[i];
  bandpass(x, 900, 0.8, sr);
  const e = envAD(n, sr, 0, 0.01, 0.12), e2 = envAD(n, sr, 0.22 + 0.06 * r(), 0.01, 0.15);
  for (let i = 0; i < n; i++) e[i] += e2[i];
  return fadeEdges(normalize(mulInto(x, e), 0.8), sr);
}
/** Small shore bird: three quick rising peeps. */
function peep(seed: number, sr: number): Buf {
  const r = rng(seed), n = samples(0.35, sr), x = new Float32Array(n), f = 2600 + 500 * r();
  for (const at of [0, 0.11, 0.22]) {
    const len = samples(0.06, sr), c = tone(len, sr, f, f * 1.22, 'sine');
    addInto(x, mulInto(c, envAD(len, sr, 0, 0.005, 0.02)), samples(at + 0.01 * r(), sr));
  }
  return fadeEdges(normalize(x, 0.6), sr);
}
/** Take-off: five wing beats, fading. */
function flap(seed: number, sr: number): Buf {
  const r = rng(seed), n = samples(0.8, sr), x = new Float32Array(n);
  for (let k = 0; k < 5; k++) {
    const len = samples(0.12, sr), b = bandpass(white(len, r), 500 + 150 * r(), 0.9, sr);
    addInto(x, mulInto(b, envAD(len, sr, 0, 0.01, 0.04)), samples(0.02 + k * 0.13, sr), 1 - 0.15 * k);
  }
  return fadeEdges(normalize(x, 0.7), sr);
}
/** Push pole: a wooden thunk on the bed, then a small splash. */
function pole(seed: number, sr: number): Buf {
  const r = rng(seed), n = samples(1.2, sr);
  const x = mulInto(tone(n, sr, 95, 70, 'sine'), envAD(n, sr, 0, 0.003, 0.08));
  addInto(x, mulInto(lowpass(white(n, r), 2000, sr), envAD(n, sr, 0, 0.001, 0.01)), 0, 0.5);
  const splash = mulInto(lowpass(highpass(white(n, r), 1200, sr), 6000, sr), envAD(n, sr, 0.06 + 0.03 * r(), 0.04, 0.25));
  addInto(x, splash, 0, 0.6);
  return fadeEdges(normalize(x, 0.8), sr);
}
/** Rope through the guide: stick-slip pulses (45–75 Hz) through two wooden resonances. */
function creak(seed: number, sr: number): Buf {
  const r = rng(seed), n = samples(0.9, sr), d = n / sr, x = new Float32Array(n);
  for (let t = 0; t < d; ) {
    x[Math.min(n - 1, samples(t, sr))] += 1;
    t += 1 / (50 + 20 * Math.sin((Math.PI * t) / d) + 6 * (r() - 0.5));
  }
  const hi = bandpass(x.slice(), 1400, 6, sr);
  bandpass(x, 600 + 100 * r(), 5, sr);
  addInto(x, hi, 0, 0.5);
  for (let i = 0; i < n; i++) x[i] *= Math.pow(Math.sin((Math.PI * i) / n), 0.7);
  return fadeEdges(normalize(x, 0.7), sr);
}
/** Hull meets landing: a low double knock. */
function knock(seed: number, sr: number): Buf {
  const r = rng(seed), n = samples(0.5, sr), f = 66 + 12 * r();
  const x = mulInto(tone(n, sr, f, f * 0.85, 'sine'), envAD(n, sr, 0, 0.002, 0.12));
  addInto(x, mulInto(tone(n, sr, 2 * f, 2 * f, 'sine'), envAD(n, sr, 0, 0.002, 0.06)), 0, 0.5);
  addInto(x, mulInto(lowpass(white(n, r), 1500, sr), envAD(n, sr, 0, 0.001, 0.015)), 0, 0.6);
  return fadeEdges(normalize(x, 0.9), sr);
}
/** Idling engine far off: 28 Hz harmonics (56 whole cycles per 2 s loop), low-passed, with a slow wobble. */
function engine(seed: number, sr: number): Buf {
  const r = rng(seed), f = 28;
  return normalize(asLoop(2, 0.1, sr, (n) => {
    const wob = normalize(lowpass(lowpass(white(n, r), 8, sr), 8, sr), 1), x = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let s = 0;
      for (let h = 1; h <= 6; h++) s += Math.sin(2 * Math.PI * h * f * t) / h;
      x[i] = s * (1 + 0.3 * wob[i]);
    }
    lowpass(x, 500, sr);
    return addInto(x, normalize(lowpass(brown(n, r), 120, sr), 0.3), 0);
  }), 0.6);
}
/** Bridge traffic far off: low tyre rumble with a little hiss, swelling slowly. */
function traffic(seed: number, sr: number): Buf {
  const r = rng(seed);
  return normalize(asLoop(4, 0.4, sr, (n) => {
    const x = normalize(lowpass(lowpass(brown(n, r), 220, sr), 220, sr), 0.6), hiss = highpass(white(n, r), 1500, sr);
    for (let i = 0; i < n; i++) x[i] = (x[i] + hiss[i] * 0.05) * (0.8 + 0.2 * Math.sin((2 * Math.PI * i) / n));
    return x;
  }), 0.5);
}

export const CLIPS: Record<ClipId, ClipDef> = {
  water: { loop: true, seconds: 4, build: water },
  wind: { loop: true, seconds: 6, build: wind },
  croak: { loop: false, seconds: 0.6, build: croak },
  peep: { loop: false, seconds: 0.35, build: peep },
  flap: { loop: false, seconds: 0.8, build: flap },
  pole: { loop: false, seconds: 1.2, build: pole },
  creak: { loop: false, seconds: 0.9, build: creak },
  knock: { loop: false, seconds: 0.5, build: knock },
  engine: { loop: true, seconds: 2, build: engine },
  traffic: { loop: true, seconds: 4, build: traffic },
};
export const CLIP_IDS = Object.keys(CLIPS) as ClipId[];
/** The seed each clip is built with in the app (fixed, so the sound is the same on every visit). */
export const CLIP_SEED = Object.fromEntries(CLIP_IDS.map((id, i) => [id, 101 + i])) as Record<ClipId, number>;
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/sound/clips.test.ts` — Expected: PASS. If a loop seam test fails, the cause is a `render` that does not return exactly `n` samples (check `asLoop` input length), not the bound.

- [ ] **Step 5: Commit**

```bash
git add src/sound/clips.ts src/sound/clips.test.ts
git commit -m "feat(6b): ten code-made clips (beds and one-shots)"
```

---

### Task 4: Mixer rules

**Files:**
- Create: `src/sound/mix.ts`, `src/sound/mix.test.ts`

**Interfaces:**
- Produces: `interface MixInput { view: CameraPreset; sunElevation: number; dip: number; bridgeOpen: boolean }`; `interface Levels { master: number; water: number; wind: number; birdRate: number; traffic: number }`; `createLevels(): Levels`; `mixLevels(i: MixInput, out: Levels): Levels`; `GAIN` (per one-shot and loop peak gain).

- [ ] **Step 1: Write the failing tests**

`src/sound/mix.test.ts`:
```ts
import { expect, test } from 'vitest';
import { createLevels, GAIN, mixLevels, type MixInput } from './mix';

const base: MixInput = { view: 'ride', sunElevation: 10, dip: 0, bridgeOpen: false };
const mix = (p: Partial<MixInput>) => mixLevels({ ...base, ...p }, createLevels());

test('water is loudest on the ferry and quietest from the sky; wind the other way', () => {
  const ride = mix({ view: 'ride' }), shore = mix({ view: 'shore' }), sky = mix({ view: 'sky' });
  expect(ride.water).toBeGreaterThan(shore.water); expect(shore.water).toBeGreaterThan(sky.water);
  expect(sky.wind).toBeGreaterThan(ride.wind);
});
test('dev views mix like Shore', () => {
  expect(mix({ view: 'bridge' })).toEqual(mix({ view: 'shore' }));
});
test('master follows the era dip: 1 − opacity, clamped', () => {
  expect(mix({ dip: 0 }).master).toBe(1);
  expect(mix({ dip: 0.25 }).master).toBeCloseTo(0.75);
  expect(mix({ dip: 1 }).master).toBe(0);
  expect(mix({ dip: 1.2 }).master).toBe(0);
});
test('bird calls drop to 0.2× at night (sun 6° below the horizon), full by sunrise', () => {
  expect(mix({ sunElevation: 5 }).birdRate).toBe(1);
  expect(mix({ sunElevation: 0 }).birdRate).toBe(1);
  expect(mix({ sunElevation: -3 }).birdRate).toBeCloseTo(0.6);
  expect(mix({ sunElevation: -20 }).birdRate).toBeCloseTo(0.2);
});
test('traffic hum only while the bridge is open (1986)', () => {
  expect(mix({ bridgeOpen: false }).traffic).toBe(0);
  expect(mix({ bridgeOpen: true }).traffic).toBe(GAIN.traffic);
});
test('writes into and returns `out`', () => {
  const out = createLevels();
  expect(mixLevels(base, out)).toBe(out);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/sound/mix.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `src/sound/mix.ts`**

```ts
import type { CameraPreset, PublicView } from '../state/url';
import { isPublicView } from '../state/url';

/** Peak gain per sound (spec 6b §2: cars stay quiet and far-sounding). */
export const GAIN = { call: 0.35, flap: 0.5, pole: 0.6, creak: 0.5, knock: 0.8, engine: 0.3, traffic: 0.25 } as const;
const WATER: Record<PublicView, number> = { ride: 0.7, shore: 0.45, sky: 0.15 };
const WIND: Record<PublicView, number> = { ride: 0.12, shore: 0.15, sky: 0.25 };

export interface MixInput { view: CameraPreset; sunElevation: number; dip: number; bridgeOpen: boolean }
export interface Levels { master: number; water: number; wind: number; birdRate: number; traffic: number }
export const createLevels = (): Levels => ({ master: 0, water: 0, wind: 0, birdRate: 0, traffic: 0 });

/** Spec 6b §2–3. Pure; writes into and returns `out`. */
export function mixLevels(i: MixInput, out: Levels): Levels {
  const v: PublicView = isPublicView(i.view) ? i.view : 'shore';
  out.master = Math.min(1, Math.max(0, 1 - i.dip));
  out.water = WATER[v];
  out.wind = WIND[v];
  out.birdRate = i.sunElevation >= 0 ? 1 : i.sunElevation <= -6 ? 0.2 : 1 + (0.8 * i.sunElevation) / 6;
  out.traffic = i.bridgeOpen ? GAIN.traffic : 0;
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/sound/mix.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sound/mix.ts src/sound/mix.test.ts
git commit -m "feat(6b): mixer levels per view, sun, dip and bridge"
```

---

### Task 5: One-shot events and the voice pool

**Files:**
- Create: `src/sound/events.ts`, `src/sound/events.test.ts`, `src/sound/voices.ts`, `src/sound/voices.test.ts`

**Interfaces:**
- Consumes: `ClipId` (Task 3); `GAIN` (Task 4); `HAUL_HZ`, `STROKE_S` from `src/ancon/crew.ts`; `CrossingPhase` from `src/ancon/crossing.ts`; `Propulsion` from `src/data/eras.ts`; `eventTime`, `u01` from `src/fauna/clock.ts`.
- Produces: `interface SoundEvent { clip: ClipId; source: 'ferry' | 'wader'; index: number; gain: number; rate: number }`; `interface FerryFrame { clock: number; phase: CrossingPhase; tLeg: number; effort: number }`; `interface FerrySpec { propulsion: Propulsion; crew: number; moored: boolean; load: number }`; `MAX_STEP = 0.5`; `WORK_EFFORT = 0.15`; `CALL = { period: 4, jitter: 1.5, seed: 4242 }`; `ferryEvents(prev, cur, spec, out)`; `birdCalls(prevT, curT, n, rate, out)`; `flushEdges(prev: Uint8Array, cur: Uint8Array, n, out)` — all return `out`. `VOICES = { beds: 2, traffic: 2, engines: 3, shots: 5 }` (sums to 12); `class VoicePool { constructor(size); acquire(now, dur): number; active(now): number }`.

- [ ] **Step 1: Write the failing tests**

`src/sound/events.test.ts`:
```ts
import { expect, test } from 'vitest';
import { createCrossingState, crossingState, CROSSING_TIMINGS } from '../ancon/crossing';
import { HAUL_HZ, STROKE_S } from '../ancon/crew';
import { birdCalls, ferryEvents, flushEdges, type FerryFrame, type FerrySpec, type SoundEvent } from './events';

const T = CROSSING_TIMINGS, DT = 1 / 60;
const frame = (clock: number): FerryFrame => {
  const s = crossingState(clock, createCrossingState(), T);
  return { clock, phase: s.phase, tLeg: s.tLeg, effort: s.effort };
};
/** Runs the ferry for `secs` from clock 0 at 60 fps; returns every event. */
function run(spec: FerrySpec, secs: number) {
  const out: SoundEvent[] = [];
  let prev = frame(0);
  for (let c = DT; c < secs; c += DT) { const cur = frame(c); ferryEvents(prev, cur, spec, out); prev = cur; }
  return out;
}
const ropes: FerrySpec = { propulsion: 'ropes', crew: 2, moored: false, load: T.load };
const poles: FerrySpec = { propulsion: 'poles', crew: 2, moored: false, load: T.load };
const leg = T.load + T.castOff + T.cross + T.dock + T.unload;

test('one knock per leg, at the start of docking', () => {
  const ev = run(ropes, 2 * leg).filter((e) => e.clip === 'knock');
  expect(ev).toHaveLength(2);
});
test('ropes creak about once per haul while hauling, never at rest; no poles', () => {
  const ev = run(ropes, leg);
  const creaks = ev.filter((e) => e.clip === 'creak').length;
  const work = T.castOff + T.cross;   // effort ≥ 0.15 roughly here
  expect(creaks).toBeGreaterThan(work * HAUL_HZ * 0.8);
  expect(creaks).toBeLessThan((work + T.dock) * HAUL_HZ * 1.05);
  expect(ev.some((e) => e.clip === 'pole')).toBe(false);
});
test('poles: one stroke per poler per STROKE_S while working; no creak', () => {
  const ev = run(poles, leg);
  const strokes = ev.filter((e) => e.clip === 'pole');
  expect(strokes.length).toBeGreaterThan(((T.castOff + T.cross) / STROKE_S) * 2 * 0.8);
  expect(new Set(strokes.map((e) => e.index))).toEqual(new Set([0, 1]));
  expect(ev.some((e) => e.clip === 'creak')).toBe(false);
});
test('moored (1986): nothing at all', () => {
  expect(run({ ...ropes, moored: true }, 2 * leg)).toEqual([]);
});
test('a jump back or a big step (seek, era reset) fires nothing', () => {
  const out: SoundEvent[] = [];
  ferryEvents(frame(T.load + T.castOff + T.cross - 0.01 + 5), frame(T.load + T.castOff + T.cross + 0.01), ropes, out);
  ferryEvents(frame(T.load + T.castOff + T.cross - 2), frame(T.load + T.castOff + T.cross + 0.01), ropes, out);
  expect(out).toEqual([]);
});
test('bird calls: about one per period, deterministic, valid wader indices, thinned by rate', () => {
  const calls = (rate: number) => { const out: SoundEvent[] = []; for (let t = DT; t < 400; t += DT) birdCalls(t - DT, t, 6, rate, out); return out; };
  const a = calls(1), b = calls(1);
  expect(a).toEqual(b);
  expect(a.length).toBeGreaterThan(80); expect(a.length).toBeLessThan(120);
  expect(a.every((e) => e.index >= 0 && e.index < 6 && (e.clip === 'croak' || e.clip === 'peep'))).toBe(true);
  expect(calls(0.2).length).toBeLessThan(a.length * 0.35);
});
test('bird calls: none with no waders or after a jump', () => {
  expect(birdCalls(0, 400, 0, 1, [])).toEqual([]);
  expect(birdCalls(10, 11, 6, 1, [])).toEqual([]);
});
test('flaps fire on a wader going from standing to flying, once', () => {
  const prev = new Uint8Array([0, 1, 0, 0]), cur = new Uint8Array([1, 1, 0, 1]);
  const out = flushEdges(prev, cur, 4, []);
  expect(out.map((e) => [e.clip, e.index])).toEqual([['flap', 0], ['flap', 3]]);
});
```

`src/sound/voices.test.ts`:
```ts
import { expect, test } from 'vitest';
import { VoicePool, VOICES } from './voices';

test('the voice budget is 12 (spec 6b §5)', () => {
  expect(VOICES.beds + VOICES.traffic + VOICES.engines + VOICES.shots).toBe(12);
});
test('never more voices than the pool; when full, the one ending soonest is reused', () => {
  const p = new VoicePool(3);
  expect([p.acquire(0, 1), p.acquire(0, 2), p.acquire(0, 3)]).toEqual([0, 1, 2]);
  expect(p.active(0.5)).toBe(3);
  expect(p.acquire(0.5, 1)).toBe(0);
  expect(p.active(0.5)).toBe(3);
  expect(p.active(2.5)).toBe(1);
  expect(p.acquire(2.5, 1)).toBe(0);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/sound/events.test.ts src/sound/voices.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**

`src/sound/voices.ts`:
```ts
/** Spec 6b §5: at most 12 voices. Beds = water + wind; traffic = one per bridge lane; engines = nearest ferry cars. */
export const VOICES = { beds: 2, traffic: 2, engines: 3, shots: 5 } as const;

/** Fixed slots for one-shots. A free slot is one whose sound has ended; when none is free, the one ending soonest is reused. */
export class VoicePool {
  private readonly ends: Float64Array;
  constructor(readonly size: number) { this.ends = new Float64Array(size).fill(-Infinity); }
  acquire(now: number, dur: number): number {
    let best = 0;
    for (let i = 0; i < this.size; i++) {
      if (this.ends[i] <= now) { best = i; break; }
      if (this.ends[i] < this.ends[best]) best = i;
    }
    this.ends[best] = now + dur;
    return best;
  }
  active(now: number): number {
    let n = 0;
    for (let i = 0; i < this.size; i++) if (this.ends[i] > now) n++;
    return n;
  }
}
```

`src/sound/events.ts`:
```ts
import type { CrossingPhase } from '../ancon/crossing';
import { HAUL_HZ, STROKE_S } from '../ancon/crew';
import type { Propulsion } from '../data/eras';
import { eventTime, u01 } from '../fauna/clock';
import type { ClipId } from './clips';
import { GAIN } from './mix';

export interface SoundEvent { clip: ClipId; source: 'ferry' | 'wader'; index: number; gain: number; rate: number }
export interface FerryFrame { clock: number; phase: CrossingPhase; tLeg: number; effort: number }
export interface FerrySpec { propulsion: Propulsion; crew: number; moored: boolean; load: number }

/** A step longer than this (s), or backwards, is a seek or an era reset: fire nothing. */
export const MAX_STEP = 0.5;
/** Crew effort at which haulers take the rope and polers work (crew.ts: hands on the rope at w ≥ 0.5 = effort ≥ 0.15). */
export const WORK_EFFORT = 0.15;
export const CALL = { period: 4, jitter: 1.5, seed: 4242 } as const;

const jumped = (a: number, b: number) => !(b > a) || b - a > MAX_STEP;
/** Playback rate 0.92–1.08 so repeats do not sound the same (spec 6b §1). */
const vary = (k: number, salt: number) => 1 + (u01(k, salt, 911) - 0.5) * 0.16;

/** Spec 6b §2: hull knock at docking; rope creak per haul (1935–1984); pole stroke per poler (1840–1925). */
export function ferryEvents(prev: FerryFrame, cur: FerryFrame, s: FerrySpec, out: SoundEvent[]): SoundEvent[] {
  if (s.moored || jumped(prev.clock, cur.clock)) return out;
  if (prev.phase !== 'dock' && cur.phase === 'dock') out.push({ clip: 'knock', source: 'ferry', index: 0, gain: GAIN.knock, rate: vary(Math.floor(cur.clock), 1) });
  if (cur.effort < WORK_EFFORT) return out;
  if (s.propulsion === 'ropes') {
    // Hauler 0 starts a pull when its phase (crew.ts hauler: clock · HAUL_HZ) passes a whole number.
    const a = Math.floor(prev.clock * HAUL_HZ), b = Math.floor(cur.clock * HAUL_HZ);
    if (b > a) out.push({ clip: 'creak', source: 'ferry', index: 0, gain: GAIN.creak, rate: vary(b, 2) });
  } else if (s.propulsion === 'poles') {
    // Poler i plants the pole when strokeAt(t, i) = fract(t / STROKE_S + i / 2) wraps (crew.ts), t = s since cast-off.
    const t0 = prev.tLeg - s.load, t1 = cur.tLeg - s.load;
    if (t1 > t0 && t1 >= 0) for (let i = 0; i < s.crew; i++) {
      const a = Math.floor(t0 / STROKE_S + i * 0.5), b = Math.floor(t1 / STROKE_S + i * 0.5);
      if (b > a) out.push({ clip: 'pole', source: 'ferry', index: i, gain: GAIN.pole, rate: vary(b * 8 + i, 3) });
    }
  }
  return out;
}

/** Spec 6b §2: a call every CALL.period s (± jitter) from a seeded wader; each kept with probability `rate`. */
export function birdCalls(prevT: number, curT: number, n: number, rate: number, out: SoundEvent[]): SoundEvent[] {
  if (n === 0 || jumped(prevT, curT)) return out;
  const { period: P, jitter: J, seed } = CALL;
  for (let k = Math.floor((prevT - J) / P); k <= Math.floor((curT + J) / P); k++) {
    const t = eventTime(k, P, J, seed);
    if (t <= prevT || t > curT || u01(k, 3, seed) >= rate) continue;
    out.push({ clip: u01(k, 2, seed) < 0.5 ? 'croak' : 'peep', source: 'wader', index: Math.floor(u01(k, 1, seed) * n), gain: GAIN.call, rate: vary(k, 4) });
  }
  return out;
}

/** Spec 6b §2: wing flaps when a wader takes off (standing → flying). */
export function flushEdges(prev: Uint8Array, cur: Uint8Array, n: number, out: SoundEvent[]): SoundEvent[] {
  for (let i = 0; i < n; i++) if (!prev[i] && cur[i]) out.push({ clip: 'flap', source: 'wader', index: i, gain: GAIN.flap, rate: vary(i, 5) });
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/sound/events.test.ts src/sound/voices.test.ts` — Expected: PASS. If the creak count bounds fail, print `ev.map(e => e.clip)` with frame clocks and compare against `crossingState(...).effort` before changing a bound.

- [ ] **Step 5: Commit**

```bash
git add src/sound/events.ts src/sound/events.test.ts src/sound/voices.ts src/sound/voices.test.ts
git commit -m "feat(6b): one-shot event rules and a 5-slot voice pool"
```

---

### Task 6: Scene taps (where waders and cars are)

**Files:**
- Create: `src/sound/taps.ts`
- Modify: `src/fauna/FaunaSet.ts` (`update`), `src/traffic/TrafficSet.ts` (`update`, `dispose`), `src/traffic/BridgeTrafficMesh.tsx` (`useFrame`, cleanup)
- Test: `src/fauna/FaunaSet.test.ts`, `src/traffic/TrafficSet.test.ts` (add one test each)

**Interfaces:**
- Produces: `soundTaps = { waders: { n, pos: Float32Array(32·3), flying: Uint8Array(32) }, cars: { n, pos: Float32Array(16·3), speed: Float32Array(16) }, bridge: { n, pos: Float32Array(32·3), lane: Uint8Array(32) } }`; caps `WADER_CAP = 32`, `CAR_CAP = 16`, `BRIDGE_CAP = 32`; `CAR_MOVING = 0.3` (m/s).

- [ ] **Step 1: Write the failing tests**

Add to `src/fauna/FaunaSet.test.ts`:
```ts
import { soundTaps } from '../sound/taps';

test('sound taps (spec 6b §4): every wader position, and which ones fly', () => {
  const set = new FaunaSet(worldFor('1975'), QUALITY.high.fauna, false), w = soundTaps.waders;
  let flew = false;
  for (let c = 0; c < 400; c += 0.5) {
    set.update(c);
    expect(w.n).toBe(QUALITY.high.fauna.wadersPerLanding * 2);
    for (let i = 0; i < w.n; i++) expect(Number.isFinite(w.pos[i * 3]) && Number.isFinite(w.pos[i * 3 + 2])).toBe(true);
    if (w.flying.subarray(0, w.n).some((f) => f === 1)) flew = true;
  }
  expect(flew).toBe(true);
  set.dispose();
});
```

Add to `src/traffic/TrafficSet.test.ts` (it already imports `envFor`, `poseFor(env, clock)`, `LegCache`, `legDuration`, `CrewSet` and mocks the materials):
```ts
import { CAR_MOVING, soundTaps } from '../sound/taps';

test('sound taps (spec 6b §4): moving ferry cars only, never more than the cap', () => {
  const crew = { setExtra() {}, hideExtra() {} } as unknown as CrewSet;
  const env = envFor('1984'), set = new TrafficSet(env, new LegCache(env), crew, false), c = soundTaps.cars;
  let seen = 0;
  for (let t = 0; t < 2 * legDuration(env.spec.timings); t += 0.5) {
    set.update(poseFor(env, t));
    expect(c.n).toBeLessThanOrEqual(16);
    for (let i = 0; i < c.n; i++) expect(c.speed[i]).toBeGreaterThan(CAR_MOVING);
    seen = Math.max(seen, c.n);
  }
  expect(seen).toBeGreaterThan(0);
  set.dispose();
  expect(c.n).toBe(0);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/fauna/FaunaSet.test.ts src/traffic/TrafficSet.test.ts` — Expected: FAIL (`../sound/taps` not found).

- [ ] **Step 3: Implement**

`src/sound/taps.ts`:
```ts
/**
 * Spec 6b §4: the few scene positions sound needs, written in place each frame by the scene (main chunk, a few
 * stores per frame) and read by the lazy sound chunk. Counts reset when the writer goes away.
 */
export const WADER_CAP = 32, CAR_CAP = 16, BRIDGE_CAP = 32;
/** A ferry car slower than this (m/s) is parked: no engine hum. */
export const CAR_MOVING = 0.3;
export const soundTaps = {
  waders: { n: 0, pos: new Float32Array(WADER_CAP * 3), flying: new Uint8Array(WADER_CAP) },
  cars: { n: 0, pos: new Float32Array(CAR_CAP * 3), speed: new Float32Array(CAR_CAP) },
  bridge: { n: 0, pos: new Float32Array(BRIDGE_CAP * 3), lane: new Uint8Array(BRIDGE_CAP) },
};
```

`src/fauna/FaunaSet.ts` — import `{ soundTaps, WADER_CAP } from '../sound/taps'`; replace the wader line in `update`:
```ts
    n = 0;
    const tw = soundTaps.waders;
    for (let i = 0; i < this.waders.length; i++) {
      wader(clock, this.waders[i], w, o); n = this.put('wader', n);
      if (i < WADER_CAP) { tw.pos[i * 3] = o.x; tw.pos[i * 3 + 1] = o.y; tw.pos[i * 3 + 2] = o.z; tw.flying[i] = o.legs === 1 ? 1 : 0; }
    }
    tw.n = Math.min(WADER_CAP, this.waders.length);
    this.done('wader', n);
```
and at the start of `dispose()`: `soundTaps.waders.n = 0;`

`src/traffic/TrafficSet.ts` — import `{ CAR_CAP, CAR_MOVING, soundTaps } from '../sound/taps'`; in `update`, after resetting `used`: `const tc = soundTaps.cars; tc.n = 0;`; inside the `if (isCar(m.kind)) {` branch, first line:
```ts
          if (fr.speed > CAR_MOVING && tc.n < CAR_CAP) {
            const k = tc.n++; tc.pos[k * 3] = fr.front.x; tc.pos[k * 3 + 1] = fr.front.y; tc.pos[k * 3 + 2] = fr.front.z; tc.speed[k] = fr.speed;
          }
```
and in `dispose()`: `soundTaps.cars.n = 0;`

`src/traffic/BridgeTrafficMesh.tsx` — import `{ BRIDGE_CAP, soundTaps } from '../sound/taps'`; in `useFrame` before the car loop `const tb = soundTaps.bridge; let bn = 0;`; after `bodyMatrix(...)`:
```ts
      if (bn < BRIDGE_CAP) { tb.pos[bn * 3] = _f.x; tb.pos[bn * 3 + 1] = _f.y; tb.pos[bn * 3 + 2] = _f.z; tb.lane[bn] = car.lane; bn++; }
```
after the loop `tb.n = bn;`; in the `useEffect` cleanup add `soundTaps.bridge.n = 0;`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/fauna src/traffic` — Expected: PASS (all old tests too).

- [ ] **Step 5: Commit**

```bash
git add src/sound/taps.ts src/fauna/FaunaSet.ts src/fauna/FaunaSet.test.ts src/traffic/TrafficSet.ts src/traffic/TrafficSet.test.ts src/traffic/BridgeTrafficMesh.tsx
git commit -m "feat(6b): scene taps for wader and car positions"
```

---

### Task 7: Engine, rig, Sound component, gate

**Files:**
- Create: `src/sound/engine.ts`, `src/sound/rig.ts`, `src/sound/Sound.tsx`, `src/sound/SoundGate.tsx`, `src/sound/SoundGate.test.tsx`
- Modify: `src/ui/dipController.ts` (add `eraDip.opacity`), `src/App.tsx` (mount `<SoundGate />` in `<Canvas>`)

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: `getEngine(): Engine` with `Engine = { listener: THREE.AudioListener; ctx: AudioContext; buffers: Record<ClipId, AudioBuffer>; buildMs: number }`; `setSoundActive(on: boolean)`; `class SoundRig { group; stats: SoundStats; start(); stop(); ferry(pose, ctx); update(dt, mix: MixInput, cam: THREE.Vector3) }`; `SoundStats = { state: AudioContextState; voices: number; buildMs: number; shots: number }`; `window.__ANCON_SOUND__?: SoundStats`; `eraDip.opacity(): number`.

- [ ] **Step 1: Write the failing gate test**

`src/sound/SoundGate.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useStore } from '../state/store';
import { SoundGate } from './SoundGate';

const audio = vi.hoisted(() => ({ open: false, unlocks: 0 }));
vi.mock('./unlock', () => ({ unlockAudio: () => { audio.unlocks++; }, audioUnlocked: () => audio.open }));
vi.mock('./Sound', () => ({ default: () => <div data-testid="sound" /> }));
afterEach(() => { cleanup(); audio.open = false; audio.unlocks = 0; });

test('off: renders nothing', () => {
  act(() => useStore.getState().setSound(false));
  expect(render(<SoundGate />).container.innerHTML).toBe('');
});
test('remembered on: waits for the first click or key, then mounts the sound', async () => {
  act(() => useStore.getState().setSound(true));
  const r = render(<SoundGate />);
  expect(r.queryByTestId('sound')).toBeNull();
  audio.open = true;
  await act(async () => { window.dispatchEvent(new Event('pointerdown')); });
  expect(await r.findByTestId('sound')).toBeTruthy();
  expect(audio.unlocks).toBe(1);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/sound/SoundGate.test.tsx` — Expected: FAIL (`./SoundGate` not found).

- [ ] **Step 3: Implement**

`src/ui/dipController.ts` — add to the `eraDip` object:
```ts
  /** Current dip opacity 0..1 (sound follows it, spec 6b §3). */
  opacity: () => machine.opacity,
```

`src/sound/SoundGate.tsx`:
```tsx
import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { audioUnlocked, unlockAudio } from './unlock';

/** The sound chunk (spec 6b §4): downloaded only the first time sound is on and a gesture has unlocked audio. */
const Sound = lazy(() => import('./Sound'));

/** Mounted inside <Canvas>. Remembered "on" waits for the first click or key anywhere (browser unlock rule). */
export function SoundGate() {
  const on = useStore((s) => s.soundOn);
  const [, bump] = useState(0);
  useEffect(() => {
    if (!on || audioUnlocked()) return;
    const go = () => { unlockAudio(); bump((n) => n + 1); };
    window.addEventListener('pointerdown', go);
    window.addEventListener('keydown', go);
    return () => { window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go); };
  }, [on]);
  if (!on || !audioUnlocked()) return null;
  return <Suspense fallback={null}><Sound /></Suspense>;
}
```

`src/sound/engine.ts`:
```ts
import * as THREE from 'three';
import { CLIP_IDS, CLIP_SEED, CLIPS, type ClipId } from './clips';

export interface Engine { listener: THREE.AudioListener; ctx: AudioContext; buffers: Record<ClipId, AudioBuffer>; buildMs: number }
let engine: Engine | null = null, active = false;

/** One listener and one set of buffers per page; clips are built the first time sound turns on (spec 6b §4.4). */
export function getEngine(): Engine {
  if (engine) return engine;
  const listener = new THREE.AudioListener(), ctx = listener.context, t0 = performance.now();
  const buffers = {} as Record<ClipId, AudioBuffer>;
  for (const id of CLIP_IDS) {
    const data = CLIPS[id].build(CLIP_SEED[id], ctx.sampleRate), b = ctx.createBuffer(1, data.length, ctx.sampleRate);
    b.copyToChannel(data, 0);
    buffers[id] = b;
  }
  engine = { listener, ctx, buffers, buildMs: performance.now() - t0 };
  document.addEventListener('visibilitychange', applyState);
  return engine;
}
function applyState() {
  if (!engine) return;
  if (active && !document.hidden) void engine.ctx.resume(); else void engine.ctx.suspend();
}
/** Sound on screen (Sound mounted) or not; a hidden tab always suspends (spec 6b §3). */
export function setSoundActive(on: boolean) { active = on; applyState(); }
```

`src/sound/rig.ts`:
```ts
import * as THREE from 'three';
import type { PoseContext, VesselPose } from '../ancon/pose';
import type { ClipId } from './clips';
import type { Engine } from './engine';
import { birdCalls, ferryEvents, flushEdges, type FerryFrame, type FerrySpec, type SoundEvent } from './events';
import { createLevels, GAIN, mixLevels, type MixInput } from './mix';
import { soundTaps, WADER_CAP } from './taps';
import { VoicePool, VOICES } from './voices';

export interface SoundStats { state: AudioContextState; voices: number; buildMs: number; shots: number }
/** Test hook (spec 6b §6), like window.__ANCON_READY__ in src/scene/ReadySignal.tsx. */
declare global { interface Window { __ANCON_SOUND__?: SoundStats } }
/** Distance (m) at which each source plays at full gain; inverse roll-off beyond (spec 6b §1: 3D sound). */
const REF = { ferry: 8, wader: 6, car: 6, bridge: 30 } as const;

const _v = new THREE.Vector3();
const frameOf = (): FerryFrame => ({ clock: 0, phase: 'load', tLeg: 0, effort: 0 });

/** Every Audio object of the scene, created once; update() is allocation-free. */
export class SoundRig {
  readonly group = new THREE.Group();
  readonly stats: SoundStats;
  private readonly water: THREE.Audio; private readonly wind: THREE.Audio;
  private readonly traffic: THREE.PositionalAudio[]; private readonly engines: THREE.PositionalAudio[];
  private readonly shots: THREE.PositionalAudio[];
  private readonly pool = new VoicePool(VOICES.shots);
  private readonly levels = createLevels();
  private readonly events: SoundEvent[] = [];
  private readonly prevFlying = new Uint8Array(WADER_CAP);
  private readonly ferryPos = new THREE.Vector3();
  private prev = frameOf(); private cur = frameOf(); private fresh = false; private havePrev = false;
  private spec: FerrySpec | null = null;
  private birdT = 0;
  private readonly nearest = new Int32Array(VOICES.engines);

  constructor(private readonly eng: Engine) {
    const L = eng.listener;
    const loop = <A extends THREE.Audio<AudioNode>>(a: A, id: ClipId): A => { a.setBuffer(eng.buffers[id]); a.setLoop(true); a.setVolume(0); return a; };
    const placed = (ref: number) => {
      const a = new THREE.PositionalAudio(L);
      a.setRefDistance(ref); a.setRolloffFactor(1); a.setDistanceModel('inverse'); a.setMaxDistance(20000);
      this.group.add(a);
      return a;
    };
    this.water = loop(new THREE.Audio(L), 'water');
    this.wind = loop(new THREE.Audio(L), 'wind');
    this.traffic = Array.from({ length: VOICES.traffic }, () => loop(placed(REF.bridge), 'traffic'));
    this.engines = Array.from({ length: VOICES.engines }, () => loop(placed(REF.car), 'engine'));
    this.shots = Array.from({ length: VOICES.shots }, () => placed(REF.ferry));
    this.stats = { state: eng.ctx.state, voices: 0, buildMs: eng.buildMs, shots: 0 };
  }

  start() { for (const a of [this.water, this.wind, ...this.traffic, ...this.engines]) a.play(); }
  stop() {
    for (const a of [this.water, this.wind, ...this.traffic, ...this.engines, ...this.shots]) { if (a.isPlaying) a.stop(); a.disconnect(); }
  }

  /** Called from onVesselPose (right after <Ancon> moves the ferry). Copies; never keeps the shared pose. */
  ferry(pose: VesselPose, ctx: PoseContext) {
    const s = pose.state, c = this.cur;
    c.clock = pose.clock; c.phase = s.phase; c.tLeg = s.tLeg; c.effort = s.effort;
    this.ferryPos.copy(pose.position);
    const sp = ctx.spec;
    if (!this.spec || this.spec.propulsion !== sp.propulsion || this.spec.crew !== sp.crew || this.spec.load !== sp.timings.load || this.spec.moored !== sp.moored)
      this.spec = { propulsion: sp.propulsion, crew: sp.crew, moored: sp.moored, load: sp.timings.load };
    this.fresh = true;
  }

  update(dt: number, mix: MixInput, cam: THREE.Vector3) {
    const L = this.levels, now = this.eng.ctx.currentTime;
    mixLevels(mix, L);
    this.eng.listener.setMasterVolume(L.master);
    this.water.setVolume(L.water); this.wind.setVolume(L.wind);

    const ev = this.events; ev.length = 0;
    if (this.fresh && this.spec) {
      if (this.havePrev) ferryEvents(this.prev, this.cur, this.spec, ev);
      const p = this.prev; this.prev = this.cur; this.cur = p; this.havePrev = true; this.fresh = false;
    }
    const w = soundTaps.waders;
    this.birdT += Math.min(dt, 0.1);
    birdCalls(this.birdT - Math.min(dt, 0.1), this.birdT, w.n, L.birdRate, ev);
    flushEdges(this.prevFlying, w.flying, w.n, ev);
    this.prevFlying.set(w.flying);
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.source === 'wader') {
        if (e.clip !== 'flap' && w.flying[e.index]) continue;   // no calls in flight
        _v.set(w.pos[e.index * 3], w.pos[e.index * 3 + 1] + 0.6, w.pos[e.index * 3 + 2]);
      } else _v.copy(this.ferryPos);
      this.play(e, _v, now);
    }

    this.placeEngines(cam);
    this.placeTraffic(cam, L.traffic);
    let voices = (L.water > 0 ? 1 : 0) + (L.wind > 0 ? 1 : 0) + this.pool.active(now);
    for (const a of this.engines) if (a.getVolume() > 0) voices++;
    for (const a of this.traffic) if (a.getVolume() > 0) voices++;
    this.stats.voices = voices; this.stats.state = this.eng.ctx.state;
  }

  private play(e: SoundEvent, at: THREE.Vector3, now: number) {
    const buf = this.eng.buffers[e.clip], i = this.pool.acquire(now, buf.duration / e.rate), a = this.shots[i];
    if (a.isPlaying) a.stop();
    a.setRefDistance(e.source === 'wader' ? REF.wader : REF.ferry);
    a.setBuffer(buf); a.setPlaybackRate(e.rate); a.setVolume(e.gain);
    a.position.copy(at);
    a.play();
    this.stats.shots++;
  }

  /** The VOICES.engines moving ferry cars nearest the camera hum; the rest are silent. */
  private placeEngines(cam: THREE.Vector3) {
    const c = soundTaps.cars, near = this.nearest;
    near.fill(-1);
    for (let k = 0; k < c.n; k++) {
      const d = cam.distanceToSquared(_v.set(c.pos[k * 3], c.pos[k * 3 + 1], c.pos[k * 3 + 2]));
      for (let j = 0; j < near.length; j++) {
        const o = near[j];
        if (o < 0 || d < cam.distanceToSquared(_v.set(c.pos[o * 3], c.pos[o * 3 + 1], c.pos[o * 3 + 2]))) {
          for (let m = near.length - 1; m > j; m--) near[m] = near[m - 1];
          near[j] = k; break;
        }
      }
    }
    for (let j = 0; j < this.engines.length; j++) {
      const a = this.engines[j], k = near[j];
      if (k < 0) { a.setVolume(0); continue; }
      const sp = Math.min(1, c.speed[k] / 3);
      a.position.set(c.pos[k * 3], c.pos[k * 3 + 1] + 0.5, c.pos[k * 3 + 2]);
      a.setVolume(GAIN.engine * sp); a.setPlaybackRate(0.85 + 0.15 * sp);
    }
  }

  /** One hum per bridge lane, at that lane's car nearest the camera. */
  private placeTraffic(cam: THREE.Vector3, level: number) {
    const b = soundTaps.bridge;
    for (let lane = 0; lane < this.traffic.length; lane++) {
      let best = -1, bd = Infinity;
      for (let k = 0; k < b.n; k++) {
        if (b.lane[k] !== lane) continue;
        const d = cam.distanceToSquared(_v.set(b.pos[k * 3], b.pos[k * 3 + 1], b.pos[k * 3 + 2]));
        if (d < bd) { bd = d; best = k; }
      }
      const a = this.traffic[lane];
      if (best < 0 || level === 0) { a.setVolume(0); continue; }
      a.position.set(b.pos[best * 3], b.pos[best * 3 + 1] + 0.5, b.pos[best * 3 + 2]);
      a.setVolume(level);
    }
  }
}
```

`src/sound/Sound.tsx`:
```tsx
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { onVesselPose } from '../ancon/vesselPose';
import { useSun } from '../scene/useSun';
import { useEra, useStore } from '../state/store';
import { eraDip } from '../ui/dipController';
import { getEngine, setSoundActive } from './engine';
import type { MixInput } from './mix';
import { SoundRig } from './rig';

/** Spec 6b §4.5: listener on the camera, every voice placed in the scene, levels and one-shots each frame. */
export default function Sound() {
  const camera = useThree((s) => s.camera);
  const eng = useMemo(getEngine, []);
  const rig = useMemo(() => new SoundRig(eng), [eng]);
  const era = useEra(), sun = useSun(), view = useStore((s) => s.camera);
  const mix = useRef<MixInput>({ view, sunElevation: sun.elevation, dip: 0, bridgeOpen: false });
  mix.current.view = view; mix.current.sunElevation = sun.elevation; mix.current.bridgeOpen = era.infrastructure.bridge.value === 'open';
  useEffect(() => {
    camera.add(eng.listener);
    setSoundActive(true); rig.start();
    window.__ANCON_SOUND__ = rig.stats;
    return () => { rig.stop(); camera.remove(eng.listener); setSoundActive(false); delete window.__ANCON_SOUND__; };
  }, [camera, eng, rig]);
  useEffect(() => onVesselPose((pose, ctx) => rig.ferry(pose, ctx)), [rig]);
  useFrame((_, dt) => {
    mix.current.dip = eraDip.opacity();
    rig.update(dt, mix.current, camera.position);
  });
  return <primitive object={rig.group} />;
}
```

`src/App.tsx` — import `{ SoundGate } from './sound/SoundGate'` and add `<SoundGate />` inside `<Canvas>` after `<DipFrameSignal />`.

- [ ] **Step 4: Run tests, type check and build**

Run: `npx vitest run src/sound` — Expected: PASS.
Run: `npm run build` — Expected: no type errors; the build output lists a separate `Sound-*.js` chunk. If `copyToChannel` rejects `Float32Array<ArrayBufferLike>`, the fix is the `Buf` return type in `dsp.ts`/`clips.ts`, not a cast at the call.

- [ ] **Step 5: Listen once in the dev server**

Start the dev server with `preview_start` (`.claude/launch.json`, port 5180), open `?era=1935`, click **Sound**. In the browser console check `window.__ANCON_SOUND__` shows `state: 'running'`, `voices ≤ 12`, `buildMs < 500`, and `shots` rising during the crossing. Switch to 1840 and 1986 and check `shots` still rises in 1840 (poles) and only bird events fire in 1986. Fix any console error before committing.

- [ ] **Step 6: Commit**

```bash
git add src/sound/engine.ts src/sound/rig.ts src/sound/Sound.tsx src/sound/SoundGate.tsx src/sound/SoundGate.test.tsx src/ui/dipController.ts src/App.tsx
git add -u
git commit -m "feat(6b): lazy sound chunk: listener, 3D voices, ferry/bird/car sounds"
```

---

### Task 8: Debug panel clip list

**Files:**
- Create: `src/sound/debugPlay.ts`
- Modify: `src/ui/DebugPanel.tsx`

**Interfaces:**
- Consumes: `getEngine`, `CLIP_IDS`, `unlockAudio`.
- Produces: `playClip(id: ClipId): void`.

- [ ] **Step 1: Implement**

`src/sound/debugPlay.ts`:
```ts
import { CLIP_IDS, type ClipId } from './clips';
import { getEngine } from './engine';

export { CLIP_IDS };
/** ?debug: play one clip alone, flat (not placed), at full volume, for the by-ear check (spec 6b §6). */
export function playClip(id: ClipId) {
  const { ctx, buffers } = getEngine();
  void ctx.resume();
  const src = ctx.createBufferSource();
  src.buffer = buffers[id];
  src.connect(ctx.destination);
  src.start();
}
```

`src/ui/DebugPanel.tsx` — import `button` from `leva` and `unlockAudio` from `'../sound/unlock'`; add after the existing `useControls(...)` call:
```tsx
  // Spec 6b §4: one play button per clip (loops play one pass). The chunk loads on the first press.
  useControls('sound', Object.fromEntries(
    ['water', 'wind', 'croak', 'peep', 'flap', 'pole', 'creak', 'knock', 'engine', 'traffic'].map((id) => [id, button(() => {
      unlockAudio();
      void import('../sound/debugPlay').then((m) => m.playClip(id as Parameters<typeof m.playClip>[0]));
    })]),
  ), { collapsed: true });
```
(The id list is literal so the debug panel does not pull `clips.ts` into its own chunk.)

- [ ] **Step 2: Check it by hand**

With the dev server, open `?debug=1`, open the **sound** folder, press each button; each plays once with no console error.

- [ ] **Step 3: Run the unit tests and build**

Run: `npm test && npm run build` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/sound/debugPlay.ts src/ui/DebugPanel.tsx
git commit -m "feat(6b): debug panel plays each clip alone"
```

---

### Task 9: E2E, size and fps checks, listening hand-off

**Files:**
- Create: `tests/e2e/sound.spec.ts`
- Modify: `scripts/dev/perf.mjs` (add `SOUND=1`)
- Create: `docs/superpowers/notes/phase-6b-rulings.md`

- [ ] **Step 1: Write the E2E test**

`tests/e2e/sound.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

const ready = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });

test('sound: off at start, no sound chunk; the button turns it on and the choice survives a reload', async ({ page }) => {
  const chunks: string[] = [];
  page.on('request', (r) => { if (/\/Sound-[^/]*\.js$/.test(r.url())) chunks.push(r.url()); });
  await page.goto('?era=1935&q=low');
  await ready(page);
  const btn = page.getByRole('button', { name: 'Sound' });
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(1_000);
  expect(chunks).toEqual([]);

  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await page.waitForFunction(() => window.__ANCON_SOUND__?.state === 'running', null, { timeout: 15_000 });
  expect(chunks.length).toBe(1);
  const s = await page.evaluate(() => window.__ANCON_SOUND__!);
  expect(s.voices).toBeLessThanOrEqual(12);

  await page.reload();
  await ready(page);
  await expect(page.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.click(700, 450);   // the first gesture unlocks audio
  await page.waitForFunction(() => window.__ANCON_SOUND__?.state === 'running', null, { timeout: 15_000 });

  await page.getByRole('button', { name: 'Sound' }).click();
  await expect(page.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'false');
  await page.waitForFunction(() => window.__ANCON_SOUND__ === undefined);
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/sound.spec.ts` — Expected: PASS. If headless Chromium never reaches `running`, add `'--autoplay-policy=no-user-gesture-required'` to `launchOptions.args` in `playwright.config.ts` and say so in the rulings note (the gesture path is still covered by the click).

- [ ] **Step 3: Run the whole suite**

Run: `npm test && npm run e2e:fast` — Expected: PASS.

- [ ] **Step 4: Size check**

Run `npm run build` on `main` (`git stash` not needed: `git worktree add ../ancon-main main && cd ../ancon-main && npm ci && npm run build`) and on this branch; compare the gzip size Vite prints for the main `index-*.js`. Expected: growth < 2 kB gzipped. Remove the worktree afterwards (`git worktree remove ../ancon-main`).

- [ ] **Step 5: fps check with sound on**

In `scripts/dev/perf.mjs`, after `const page = ...`:
```js
if (process.env.SOUND === '1') await page.addInitScript(() => { try { localStorage.setItem('ancon.sound', '1'); } catch {} });
```
and after the `__ANCON_READY__` wait:
```js
if (process.env.SOUND === '1') { await page.mouse.click(720, 450); await page.waitForFunction(() => window.__ANCON_SOUND__?.state === 'running', null, { timeout: 15000 }); }
```
Then for each tier `q=high`, `q=medium`, `q=low` on `?era=1984&cam=ride` and `?era=1986&cam=shore`: run `node scripts/dev/perf.mjs "<query>"` on the `main` build and `SOUND=1 node scripts/dev/perf.mjs "<query>"` on this branch's build. Expected: every fps within 5 %. If not, first check that no `THREE.Vector3` or array is created per frame in `rig.ts`.

- [ ] **Step 6: Write the rulings note**

`docs/superpowers/notes/phase-6b-rulings.md`: the fps table (main vs sound on, per tier and query), the main-chunk gzip growth, `buildMs` seen on the Mac, any controller rulings made while building, and a **Listening checklist** for the user:
1. Open `?debug=1`, open **sound**, press each of the 10 clips; note any that sound wrong.
2. Turn on **Sound**; in 1935 Ride, listen through one crossing (creak, knock, birds, water).
3. 1840 Shore: pole strokes. 1984 Ride: cars driving on. 1986 Sky and Shore: bridge hum, no ferry sounds.
4. Change era once: sound fades out and back in.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/sound.spec.ts scripts/dev/perf.mjs docs/superpowers/notes/phase-6b-rulings.md
git commit -m "test(6b): e2e for the sound button; fps and size checks; listening checklist"
```

Then stop and hand the listening checklist to the user. Fix rejected clips (Task 3 makers only) before merging.
