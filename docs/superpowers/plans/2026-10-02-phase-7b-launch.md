# Phase 7b — Accessibility gaps and launch: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining accessibility gaps (keyboard look, structure, contrast, no-WebGL) and ship the launch pieces (favicon, share card, 404 page, README).

**Architecture:** A new focusable `SceneFrame` wraps the R3F `<Canvas>`; its key handler turns arrow keys into a `LookStep` that goes through the zustand store (same pattern as `recenterSeq`) to `Cameras.tsx`, which applies it with camera-controls. The era keys get a pure guard in `picker.ts`. Contrast is pinned by a unit test that parses `src/styles.css` and `index.html`. Launch files live in a new `public/` folder (Vite copies it into `dist/` under the `/ancon-de-loiza/` base); the PNG icons and the share card are made by Playwright scripts run by hand, and their output is committed.

**Tech Stack:** Vite 8, React 19, TypeScript, React Three Fiber 9, drei `CameraControls` (camera-controls), zustand, Vitest + Testing Library (jsdom), Playwright.

**Spec:** [`docs/superpowers/specs/2026-10-02-phase-7b-launch-design.md`](../specs/2026-10-02-phase-7b-launch-design.md)

## Global Constraints

- Branch `phase-7b-launch` (from `main`). Merge to `main` only after the user approves.
- Every UI string is bilingual (`{ es, en }` in `src/i18n/strings.ts`); Spanish is the default language.
- Text colour `#f4ecdf`; focus ring `2px solid #f2c46d`; backing token `--glass: rgba(12, 15, 15, 0.65)`.
- WCAG AA: 4.5:1 for text, 3:1 for non-text UI, measured worst case over pure white.
- Reduced motion stops eases and glides only; the ferry, water, birds, people and cars keep moving.
- The El Ancón sign stays out of the 3D scene. Only `docs/assets/el-ancon-de-loiza-sign.svg` is copied from branch `origin/sign-svg`; PR #10 is not touched.
- No new npm dependencies.
- Live URL: `https://gabriel-rene.github.io/ancon-de-loiza/`. Vite `base` is `/ancon-de-loiza/`.
- Commit messages: `feat(7b): …` / `fix(7b): …` / `docs(7b): …`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not commit the `tests/snapshots/phase5/*.png` changes until Task 11.
- Commands: `npm test` (Vitest), `npm run build`, `npm run e2e:fast` (Playwright on the production build, port 4173). The dev server for this repo runs on port 5180.

## File map

| File | What it does |
|---|---|
| `src/ui/contrast.ts` (new) | WCAG colour helpers: parse, blend, luminance, ratio |
| `src/ui/contrast.test.ts` (new) | Reads `src/styles.css` + `index.html`, checks every §3.1 pair |
| `src/ui/SceneFrame.tsx` (new) | Focusable labelled wrapper round the canvas; look keys |
| `src/ui/SkipLink.tsx` (new) | "Skip to timeline" link |
| `src/scene/lookKeys.ts` (new) | `lookKey()` → `LookStep` |
| `src/head.test.ts` (new) | Checks `index.html` head, `public/` files, `404.html` |
| `scripts/make-icons.ts` (new) | Renders the PNG icons from `public/favicon.svg` |
| `scripts/make-share-card.ts` (new) | Renders `public/share-card.jpg` from the preview build |
| `public/favicon.svg`, `public/favicon-32.png`, `public/apple-touch-icon.png`, `public/share-card.jpg`, `public/404.html` (new) | Launch files |
| `tests/e2e/a11y.spec.ts` (new) | Tab order, skip link, scene keys, head files, no-WebGL |
| `src/App.tsx`, `src/state/store.ts`, `src/scene/Cameras.tsx`, `src/scene/views.ts`, `src/ui/picker.ts`, `src/ui/Timeline.tsx`, `src/ui/QualityMenu.tsx`, `src/ui/Toolbar.tsx`, `src/ui/ViewSwitch.tsx`, `src/ui/SceneBoundary.tsx`, `src/ui/TitleCard.tsx`, `src/i18n/strings.ts`, `src/styles.css`, `index.html`, `README.md` | Modified |

---

### Task 1: Contrast

**Files:**
- Create: `src/ui/contrast.ts`, `src/ui/contrast.test.ts`
- Modify: `src/styles.css`, `index.html`

**Interfaces:**
- Produces: `type RGB = readonly [number, number, number]`; `parseColor(css: string): { rgb: RGB; a: number }`; `blend(fg: RGB, a: number, bg: RGB): RGB`; `luminance(c: RGB): number`; `contrastRatio(a: RGB, b: RGB): number`. CSS token `--glass` on `:root`.

- [ ] **Step 1: Write the helpers' test and the CSS test**

`src/ui/contrast.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { blend, contrastRatio, parseColor, type RGB } from './contrast';

const css = readFileSync('src/styles.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const WHITE: RGB = [255, 255, 255];
const CREAM: RGB = [0xf4, 0xec, 0xdf];

/** The value of `prop` in the first rule whose selector list is exactly `sel` (rules may be indented). */
function decl(sel: string, prop: string, src = css): string | undefined {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`).exec(src);
  if (!rule) throw new Error(`no rule ${sel}`);
  return new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+)`).exec(rule[1])?.[1].trim();
}
const opacity = (sel: string, src = css) => Number(decl(sel, 'opacity', src) ?? 1);

test('helpers: black on white is 21:1, a colour on itself is 1:1, blend mixes', () => {
  expect(contrastRatio([0, 0, 0], WHITE)).toBeCloseTo(21, 5);
  expect(contrastRatio(CREAM, CREAM)).toBeCloseTo(1, 5);
  expect(parseColor('#f4ecdf')).toEqual({ rgb: CREAM, a: 1 });
  expect(parseColor('rgba(12, 15, 15, 0.65)')).toEqual({ rgb: [12, 15, 15], a: 0.65 });
  expect(blend([0, 0, 0], 0.5, WHITE)).toEqual([127.5, 127.5, 127.5]);
});

// Worst case (spec 7b §3.1): the glass backing alone over a pure white sky.
const glass = parseColor(decl(':root', '--glass')!);
const worst = blend(glass.rgb, glass.a, WHITE);

test('every text-over-scene surface uses the --glass backing', () => {
  for (const sel of ['.title-card', '.osm-credit', '.timeline', '.toolbar__btn', '.toolbar__lang, .toolbar__group']) {
    expect(decl(sel, 'background'), sel).toBe('var(--glass)');
  }
});
test('text on glass reaches 4.5:1 over white', () => {
  expect(contrastRatio(CREAM, worst)).toBeGreaterThanOrEqual(4.5);
  expect(opacity('.title-card__kicker')).toBe(1);
  const label = blend(CREAM, opacity('.timeline__label'), worst);
  expect(contrastRatio(label, worst)).toBeGreaterThanOrEqual(4.5);
  const credit = parseColor(decl('.osm-credit', 'color')!);
  expect(contrastRatio(blend(credit.rgb, credit.a, worst), worst)).toBeGreaterThanOrEqual(4.5);
});
test('the rail line and leaders reach 3:1 on glass over white', () => {
  for (const [sel, prop] of [['.timeline__line', 'background'], ['.timeline__leaders line', 'stroke']] as const) {
    const c = parseColor(decl(sel, prop)!);
    expect(contrastRatio(blend(c.rgb, c.a, worst), worst), sel).toBeGreaterThanOrEqual(3);
  }
});
test('load card and era dip: one gradient, small text at 4.5:1 on its centre stop', () => {
  const dip = decl(':root', '--era-dip')!;
  expect(decl('#load-card', 'background', html)).toBe(dip);
  const centre = parseColor(/#[0-9a-f]{6}(?= 0%)/i.exec(dip)![0]).rgb;
  expect(contrastRatio(CREAM, centre)).toBeGreaterThanOrEqual(4.5);
  expect(opacity('.load-card__kicker', html)).toBe(1);
  expect(opacity('.era-dip__label')).toBe(1);
});
```

- [ ] **Step 2: Run it — it fails**

Run: `npx vitest run src/ui/contrast.test.ts`
Expected: FAIL — `Cannot find module './contrast'`.

- [ ] **Step 3: Write `src/ui/contrast.ts`**

```ts
/** WCAG 2 contrast helpers (spec 7b §3.1). Colours are sRGB [r, g, b], 0–255. */
export type RGB = readonly [number, number, number];

/** `#rrggbb`, `rgb(r, g, b)` or `rgba(r, g, b, a)`. */
export function parseColor(css: string): { rgb: RGB; a: number } {
  const s = css.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(s);
  if (hex) { const n = parseInt(hex[1], 16); return { rgb: [n >> 16, (n >> 8) & 255, n & 255], a: 1 }; }
  const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s);
  if (!m) throw new Error(`unparsed colour: ${css}`);
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] === undefined ? 1 : Number(m[4]) };
}

/** `fg` at alpha `a` over an opaque `bg`. */
export const blend = (fg: RGB, a: number, bg: RGB): RGB =>
  [a * fg[0] + (1 - a) * bg[0], a * fg[1] + (1 - a) * bg[1], a * fg[2] + (1 - a) * bg[2]];

const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export const luminance = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

export function contrastRatio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
```

- [ ] **Step 4: Run it — the helper test passes, the CSS tests fail**

Run: `npx vitest run src/ui/contrast.test.ts`
Expected: FAIL — the file stops at load with `Cannot read properties of undefined (reading 'trim')`, because `--glass` is not in `src/styles.css` yet. (The helpers compile; the CSS is what is missing.)

- [ ] **Step 5: Change `src/styles.css`**

Line 5 `.title-card` — replace the whole rule:

```css
.title-card { position: fixed; z-index: 2; left: 16px; bottom: calc(max(12px, env(safe-area-inset-bottom)) + 115px); padding: 8px 12px; border-radius: 10px;
  background: var(--glass); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  color: #f4ecdf; font: 500 13px/1.4 ui-serif, Georgia, serif; letter-spacing: 0.04em; pointer-events: none; }
```

Line 6 `.title-card__kicker` — remove `opacity: 0.8;` (and add the h1 reset now, Task 2 makes it an `<h1>`):

```css
.title-card__kicker { margin: 0; font: inherit; font-size: 11px; text-transform: uppercase; letter-spacing: 0.24em; }
```

Lines 8–9 `.osm-credit` — replace both rules and add the focus ring (spec §4):

```css
.osm-credit { position: fixed; right: 10px; bottom: calc(max(12px, env(safe-area-inset-bottom)) + 94px); z-index: 10; padding: 3px 8px; border-radius: 6px;
  background: var(--glass); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  color: #f4ecdf; font: 400 11px/1.3 ui-sans-serif, system-ui, sans-serif; }
.osm-credit a { color: inherit; text-decoration: underline; text-decoration-color: rgba(244,236,223,0.6); }
.osm-credit a:focus-visible { outline: 2px solid #f2c46d; outline-offset: 2px; }
```

Line 17 (inside `.timeline`): `background: rgba(12, 15, 15, 0.42);` → `background: var(--glass);`
Line 22 `.timeline__line`: `rgba(244, 236, 223, 0.35)` → `rgba(244, 236, 223, 0.65)`
Line 24 `.timeline__leaders line`: `stroke: rgba(244, 236, 223, 0.35)` → `stroke: rgba(244, 236, 223, 0.65)`
Line 32 `.timeline__label`: `opacity: 0.75` → `opacity: 0.92`
Line 44 (`.toolbar__lang, .toolbar__group`): `background: rgba(12, 15, 15, 0.55);` → `background: var(--glass);`
Line 47 (inside `.toolbar__btn`): `background: rgba(12, 15, 15, 0.55);` → `background: var(--glass);`
Line 92 `:root` — replace:

```css
:root { --era-dip: radial-gradient(ellipse at 50% 45%, #75624a 0%, #5e4d38 60%, #3f3426 100%); --glass: rgba(12, 15, 15, 0.65); }
```

Line 96 `.era-dip__label`: remove `opacity: 0.85;`.

- [ ] **Step 6: Change `index.html`**

In the `#load-card` rule: `#8a7556 0%` → `#75624a 0%` (the rest of the gradient stays).
In `.load-card__kicker`: remove `opacity: 0.85;`.

- [ ] **Step 7: Run the tests — all pass**

Run: `npx vitest run src/ui/contrast.test.ts && npm test`
Expected: PASS (all files).

- [ ] **Step 8: Look at it**

Start the dev server (`preview_start` with name `ancon-dev`, port 5180; `.claude/launch.json` is untracked). Screenshot the default view and `?era=1840`. Check: title card and credit sit on a dark pill, the timeline is darker, nothing overlaps. If the title-card pill now overlaps the timeline on a phone width (375 px), raise its `bottom` offset by the overlap.

- [ ] **Step 9: Commit**

```bash
git add src/ui/contrast.ts src/ui/contrast.test.ts src/styles.css index.html
git commit -m "feat(7b): glass backing and AA contrast for text over the scene"
```

---

### Task 2: Page structure — h1, landmarks, skip link, scene frame

**Files:**
- Create: `src/ui/SceneFrame.tsx`, `src/ui/SceneFrame.test.tsx`, `src/ui/SkipLink.tsx`, `src/ui/SkipLink.test.tsx`
- Modify: `src/i18n/strings.ts`, `src/ui/TitleCard.tsx`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `STRINGS`, `useT`, `useEra`, `useStore`.
- Produces: `SceneFrame({ children })` renders `<div className="scene" data-scene="" role="group" tabIndex={0} aria-label=…>`; Task 3 adds its key handler, Task 4 uses `[data-scene]`. `focusSelectedEra(): void` in `SkipLink.tsx`. New strings `skipToTimeline`, `sceneLabel`, `sceneKeys`, `recenterAvailable`.

- [ ] **Step 1: Add the strings**

In `src/i18n/strings.ts`, inside `STRINGS` after `osmContributors`:

```ts
  skipToTimeline: { es: 'Saltar a la línea del tiempo', en: 'Skip to timeline' },
  sceneLabel: { es: 'Vista 3D del ancón', en: '3D view of the ferry' },
  sceneKeys: { es: 'Flechas para mirar alrededor.', en: 'Arrow keys look around.' },
  recenterAvailable: { es: 'Centrar disponible', en: 'Recenter available' },
```

- [ ] **Step 2: Write the failing tests**

`src/ui/SceneFrame.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { useStore } from '../state/store';
import { SceneFrame } from './SceneFrame';

beforeEach(() => act(() => { useStore.getState().setLang('en'); useStore.getState().setEra('1975'); }));
afterEach(cleanup);

test('a focusable group named for the scene, the era and the keys; follows era and language', () => {
  render(<SceneFrame><canvas /></SceneFrame>);
  const g = screen.getByRole('group');
  expect(g.getAttribute('aria-label')).toBe('3D view of the ferry, 1975. Arrow keys look around.');
  expect(g.tabIndex).toBe(0);
  expect(g.hasAttribute('data-scene')).toBe(true);
  act(() => { useStore.getState().setEra('1840'); useStore.getState().setLang('es'); });
  expect(g.getAttribute('aria-label')).toBe('Vista 3D del ancón, 1840. Flechas para mirar alrededor.');
});
```

`src/ui/SkipLink.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useStore } from '../state/store';
import { __dipForTests } from './dipController';
import { SkipLink } from './SkipLink';
import { Timeline } from './Timeline';

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  window.history.replaceState(null, '', '/?era=1925');
  act(() => { useStore.getState().setLang('en'); useStore.getState().setEra('1925'); });
  __dipForTests.reset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('the skip link moves focus to the selected era button', () => {
  render(<><SkipLink /><Timeline /></>);
  const link = screen.getByRole('link', { name: 'Skip to timeline' });
  fireEvent.click(link);
  expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^1925 ·/);
});
```

Also add to `src/ui/Timeline.test.tsx` nothing yet. Add a TitleCard check to `src/ui/SceneFrame.test.tsx`:

```tsx
import { TitleCard } from './TitleCard';
test('the title card is the page h1', () => {
  render(<TitleCard />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('El Ancón de Loíza');
});
```

- [ ] **Step 3: Run — they fail**

Run: `npx vitest run src/ui/SceneFrame.test.tsx src/ui/SkipLink.test.tsx`
Expected: FAIL — modules `./SceneFrame`, `./SkipLink` not found.

- [ ] **Step 4: Write `src/ui/SceneFrame.tsx`**

```tsx
import type { ReactNode } from 'react';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { useEra } from '../state/store';

/**
 * Focusable frame round the 3D scene (spec 7b §2.1, §2.3): screen readers hear the scene, the era and the keys.
 * A plain group, not role="application", so screen-reader keys keep working.
 */
export function SceneFrame({ children }: { children: ReactNode }) {
  const t = useT();
  const era = useEra();
  return (
    <div className="scene" data-scene="" role="group" tabIndex={0}
      aria-label={`${t(STRINGS.sceneLabel)}, ${era.id}. ${t(STRINGS.sceneKeys)}`}>
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Write `src/ui/SkipLink.tsx`**

```tsx
import type { MouseEvent } from 'react';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';

/** Focuses the timeline button of the chosen era. */
export function focusSelectedEra() {
  document.querySelector<HTMLButtonElement>('.timeline__btn[aria-current="true"]')?.focus();
}

/** First stop in the tab order (spec 7b §2.3); visible only while focused. */
export function SkipLink() {
  const t = useT();
  const onClick = (e: MouseEvent) => { e.preventDefault(); focusSelectedEra(); };
  return <a className="skip-link" href="#timeline" onClick={onClick}>{t(STRINGS.skipToTimeline)}</a>;
}
```

- [ ] **Step 6: Make the title an `<h1>`**

In `src/ui/TitleCard.tsx` line 11: `<div className="title-card__kicker">El Ancón de Loíza</div>` → `<h1 className="title-card__kicker">El Ancón de Loíza</h1>`.

- [ ] **Step 7: Restructure `src/App.tsx`**

Add imports `import { SceneFrame } from './ui/SceneFrame';` and `import { SkipLink } from './ui/SkipLink';`. Replace the returned JSX with:

```tsx
    <>
      <SkipLink />
      <header><Toolbar /></header>
      <main>
        <TitleCard />
        <SceneBoundary>
          <SceneFrame>
            <Canvas
              dpr={q.dpr}
              shadows={q.shadowMap > 0 ? 'percentage' : false}
              camera={{ fov: 42, near: 1.5, far: 40000, position: [600, 450, 700] }}
              gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
            >
              <World />
              <Cameras />
              <ReadySignal />
              <DipFrameSignal />
              <QualityGovernor />
              <SoundGate />
              {debug && <StatsGl className="stats-gl" />}
              {perf && <FrameSampler />}
              {(debug || perf) && <RendererInfo />}
            </Canvas>
          </SceneFrame>
          <EraDipOverlay />
          <EraAnnouncer />
        </SceneBoundary>
      </main>
      <Timeline />
      {debug && <Suspense fallback={null}><DebugPanel /></Suspense>}
      <FpsReadout />
    </>
```

Tab order is now: skip link → toolbar (and the Facts panel) → map credit link → scene → era buttons.

- [ ] **Step 8: Add the CSS**

Append to `src/styles.css` after the `canvas` rule (line 3):

```css
/* Spec 7b §2.1: the scene frame fills the window; Tab reaches it and the ring sits inside its edge. */
.scene { position: fixed; inset: 0; }
.scene:focus { outline: none; }
.scene:focus-visible { outline: 2px solid #f2c46d; outline-offset: -4px; }
.skip-link { position: fixed; z-index: 50; left: 12px; top: max(12px, env(safe-area-inset-top)); padding: 12px 14px; border-radius: 10px;
  background: #f4ecdf; color: #1b1a17; font: 600 14px/1 ui-sans-serif, system-ui, sans-serif; transform: translateY(-200%); }
.skip-link:focus { transform: none; outline: 2px solid #f2c46d; outline-offset: 2px; }
```

- [ ] **Step 9: Run all tests**

Run: `npm test`
Expected: PASS. If `SceneBoundary.test.tsx` or `Toolbar.test.tsx` break, the cause is the new structure — fix the code, not the old assertions, unless an assertion named the old DOM order.

- [ ] **Step 10: Look at it**

Reload the dev preview. Check: the scene still fills the window; drag still looks around; the title card is above the scene (z-index 2); pressing Tab once shows the skip link at the top left; Tab to the scene shows a gold ring inside the window edge. Run `read_console_messages` — no errors.

- [ ] **Step 11: Commit**

```bash
git add src/ui/SceneFrame.tsx src/ui/SceneFrame.test.tsx src/ui/SkipLink.tsx src/ui/SkipLink.test.tsx src/ui/TitleCard.tsx src/App.tsx src/i18n/strings.ts src/styles.css
git commit -m "feat(7b): h1, landmarks, skip link and a labelled focusable scene"
```

---

### Task 3: Keyboard look and reduced-motion drag

**Files:**
- Create: `src/scene/lookKeys.ts`, `src/scene/lookKeys.test.ts`
- Modify: `src/state/store.ts`, `src/scene/views.ts`, `src/scene/Cameras.tsx`, `src/ui/SceneFrame.tsx`, `src/ui/SceneFrame.test.tsx`

**Interfaces:**
- Consumes: `SceneFrame` (Task 2), `prefersReducedMotion()` from `src/ui/motion.ts`, `controlLimits()` result `lim.lookInPlace`.
- Produces: `interface LookStep { dAz: number; dPol: number; dZoom: number }`; `LOOK_STEP = { az, pol, zoom }`; `lookKey(e: { key: string; altKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }): LookStep | null`. Store: `lookStep: LookStep | null; lookSeq: number; look(s: LookStep): void`. `views.ts`: `DRAG_SMOOTH_TIME = 0.125`.

- [ ] **Step 1: Write the failing test**

`src/scene/lookKeys.test.ts`:

```ts
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { LOOK_STEP, lookKey } from './lookKeys';

/** View direction of a camera-controls camera at spherical (theta, phi) about its target. */
const dir = (theta: number, phi: number) => new THREE.Vector3().setFromSphericalCoords(10, phi, theta).negate().normalize();

test('→ turns the picture right and ← left, from any heading (spec 7b §2.1)', () => {
  // Shore orbits a target 1 m ahead (LOOK_IN_PLACE) and Ride orbits its pivot: the same geometry, so one sign for all views.
  for (const theta of [0, 1, 2.5, -2]) {
    const right = lookKey({ key: 'ArrowRight' })!, left = lookKey({ key: 'ArrowLeft' })!;
    const d0 = dir(theta, 1.2);
    expect(new THREE.Vector3().crossVectors(d0, dir(theta + right.dAz, 1.2)).y).toBeLessThan(0);
    expect(new THREE.Vector3().crossVectors(d0, dir(theta + left.dAz, 1.2)).y).toBeGreaterThan(0);
  }
});
test('↑ tilts the view up and ↓ down', () => {
  const d0 = dir(0.5, 1.2);
  expect(dir(0.5, 1.2 + lookKey({ key: 'ArrowUp' })!.dPol).y).toBeGreaterThan(d0.y);
  expect(dir(0.5, 1.2 + lookKey({ key: 'ArrowDown' })!.dPol).y).toBeLessThan(d0.y);
});
test('steps: 10° turn, 6° tilt; + and = zoom in, - and _ zoom out', () => {
  expect(LOOK_STEP.az).toBeCloseTo((10 * Math.PI) / 180);
  expect(LOOK_STEP.pol).toBeCloseTo((6 * Math.PI) / 180);
  expect(lookKey({ key: '+' })).toEqual({ dAz: 0, dPol: 0, dZoom: 1 });
  expect(lookKey({ key: '=' })).toEqual({ dAz: 0, dPol: 0, dZoom: 1 });
  expect(lookKey({ key: '-' })).toEqual({ dAz: 0, dPol: 0, dZoom: -1 });
  expect(lookKey({ key: '_' })).toEqual({ dAz: 0, dPol: 0, dZoom: -1 });
});
test('other keys and modified keys are not look keys', () => {
  for (const key of ['a', 'r', '1', 'Enter', ' ', 'Tab', 'toString']) expect(lookKey({ key })).toBeNull();
  expect(lookKey({ key: 'ArrowLeft', metaKey: true })).toBeNull();
  expect(lookKey({ key: 'ArrowLeft', ctrlKey: true })).toBeNull();
  expect(lookKey({ key: 'ArrowLeft', altKey: true })).toBeNull();
});
```

- [ ] **Step 2: Run — it fails**

Run: `npx vitest run src/scene/lookKeys.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/scene/lookKeys.ts`**

```ts
/** One keyboard look step (spec 7b §2.1), camera-controls terms: azimuth and polar in radians; dZoom +1 in, −1 out. */
export interface LookStep { dAz: number; dPol: number; dZoom: number }

/** Per key press: 10° turn, 6° tilt, 10 % zoom or dolly. Holding a key repeats through the browser's key repeat. */
export const LOOK_STEP = { az: (10 * Math.PI) / 180, pol: (6 * Math.PI) / 180, zoom: 0.1 };

const step = (dAz: number, dPol: number, dZoom: number): LookStep => ({ dAz, dPol, dZoom });
// A lower azimuth turns the picture right; a higher polar angle (camera lower) tilts it up.
const KEYS: Readonly<Record<string, LookStep>> = {
  ArrowLeft: step(LOOK_STEP.az, 0, 0), ArrowRight: step(-LOOK_STEP.az, 0, 0),
  ArrowUp: step(0, LOOK_STEP.pol, 0), ArrowDown: step(0, -LOOK_STEP.pol, 0),
  '+': step(0, 0, 1), '=': step(0, 0, 1), '-': step(0, 0, -1), _: step(0, 0, -1),
};

/** The look step for a key press on the focused scene, or null. */
export function lookKey(e: { key: string; altKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }): LookStep | null {
  if (e.altKey || e.metaKey || e.ctrlKey) return null;
  return Object.hasOwn(KEYS, e.key) ? KEYS[e.key] : null;
}
```

- [ ] **Step 4: Run — it passes**

Run: `npx vitest run src/scene/lookKeys.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Store channel**

In `src/state/store.ts`:
- add `import type { LookStep } from '../scene/lookKeys';`
- in `AppState`, after the `recenterSeq` line:

```ts
  /** Spec 7b §2.1: bumped by look(); Cameras applies `lookStep` on each bump. */
  lookStep: LookStep | null; lookSeq: number; look: (s: LookStep) => void;
```

- in the initial state line with `offFront: false, recenterSeq: 0,` add `lookStep: null, lookSeq: 0,`
- after `recenter: …`:

```ts
  look: (lookStep) => set((s) => ({ lookStep, lookSeq: s.lookSeq + 1 })),
```

- [ ] **Step 6: Key handler on the scene frame — failing test first**

Append to `src/ui/SceneFrame.test.tsx` (add `fireEvent` to the Testing Library import):

```tsx
test('arrow keys on the scene send one look step each and are consumed', () => {
  render(<SceneFrame><canvas /></SceneFrame>);
  const g = screen.getByRole('group');
  const seq = useStore.getState().lookSeq;
  const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
  act(() => { g.dispatchEvent(ev); });
  expect(useStore.getState().lookSeq).toBe(seq + 1);
  expect(useStore.getState().lookStep!.dAz).toBeLessThan(0);
  expect(ev.defaultPrevented).toBe(true);
  fireEvent.keyDown(g, { key: 'a' });
  expect(useStore.getState().lookSeq).toBe(seq + 1);
});
```

Run: `npx vitest run src/ui/SceneFrame.test.tsx` — Expected: FAIL (`lookSeq` unchanged).

- [ ] **Step 7: Wire the handler**

In `src/ui/SceneFrame.tsx`: add imports `import type { KeyboardEvent } from 'react';` (merge with the `ReactNode` type import), `import { lookKey } from '../scene/lookKeys';`, and `useStore` next to `useEra`. Add inside the component:

```tsx
  const onKeyDown = (e: KeyboardEvent) => {
    const s = lookKey(e);
    if (!s) return;
    e.preventDefault();   // the era keys skip handled presses (Timeline checks defaultPrevented)
    useStore.getState().look(s);
  };
```

and `onKeyDown={onKeyDown}` on the div.

Run: `npx vitest run src/ui/SceneFrame.test.tsx` — Expected: PASS.

- [ ] **Step 8: Apply the step in `Cameras.tsx`**

In `src/scene/views.ts`, after `VIEW_SMOOTH_TIME`:

```ts
/** camera-controls' own draggingSmoothTime default; 0 under reduced motion (spec 7b §3.2). */
export const DRAG_SMOOTH_TIME = 0.125;
```

In `src/scene/Cameras.tsx`:
- import `DRAG_SMOOTH_TIME` from `./views` and `LOOK_STEP` from `./lookKeys`;
- after `const recenterSeq = …` add `const lookSeq = useStore((s) => s.lookSeq);`
- after the Ride recenter effect add:

```tsx
  // Keyboard look (spec 7b §2.1): one step on the controls, inside the same limits as a drag. In Ride the rig
  // reads it as input (its per-frame check), like a drag; the fixed views report off-front on 'sleep'.
  useEffect(() => {
    const c = ref.current, s = useStore.getState().lookStep;
    if (!c || !s || lookSeq === 0) return;
    const smooth = !riding && !prefersReducedMotion();
    if (s.dAz || s.dPol) void c.rotate(s.dAz, s.dPol, smooth);
    if (s.dZoom) {
      if (lim.lookInPlace) void c.zoomTo((c.camera as THREE.PerspectiveCamera).zoom * (1 + LOOK_STEP.zoom * s.dZoom), smooth);
      else void c.dollyTo(c.distance * (1 - LOOK_STEP.zoom * s.dZoom), smooth);
    }
  }, [lookSeq]);   // eslint-disable-line react-hooks/exhaustive-deps -- one step per bump
```

- replace the returned `<CameraControls … smoothTime={VIEW_SMOOTH_TIME} />` props with:

```tsx
  const reduced = prefersReducedMotion();
  return (
    <CameraControls ref={ref} makeDefault minDistance={lim.minDistance} maxDistance={lim.maxDistance}
      minPolarAngle={lim.minPolar} maxPolarAngle={lim.maxPolar} minZoom={lim.minZoom} maxZoom={lim.maxZoom}
      smoothTime={reduced ? 0 : VIEW_SMOOTH_TIME} draggingSmoothTime={reduced ? 0 : DRAG_SMOOTH_TIME} />
  );
```

(camera-controls clamps a smooth time of 0 to 0.0001 inside `smoothDamp`, so 0 is safe.)

- [ ] **Step 9: Run all tests and the build**

Run: `npm test && npm run build`
Expected: PASS; build has no TypeScript errors.

- [ ] **Step 10: Try it in the browser**

Dev preview, `?cam=sky&lang=en`. Click the scene (or Tab to it), press → five times: the view turns right and Recenter shows; ↑/↓ tilt within limits; +/− zoom within limits; R recenters. Repeat with `?cam=shore` (→ still turns the picture right; + zooms the lens) and the default Ride view (the angle stays where left after the keys). Check the timeline era did not change. `read_console_messages` — no errors.

- [ ] **Step 11: Commit**

```bash
git add src/scene/lookKeys.ts src/scene/lookKeys.test.ts src/state/store.ts src/scene/views.ts src/scene/Cameras.tsx src/ui/SceneFrame.tsx src/ui/SceneFrame.test.tsx
git commit -m "feat(7b): look around with the keyboard; no drag glide under reduced motion"
```

---

### Task 4: Who owns the arrow keys

**Files:**
- Modify: `src/ui/picker.ts`, `src/ui/Timeline.tsx`, `src/ui/Timeline.test.tsx`

**Interfaces:**
- Consumes: `[data-scene]` (Task 2), `.info-panel`, `.quality__menu`.
- Produces: `eraKeysAllowed(t: EventTarget | null): boolean`.

- [ ] **Step 1: Write the failing test**

Append to `src/ui/Timeline.test.tsx`:

```tsx
test('← → do not change the era from the scene, the Facts panel or the Quality menu (spec 7b §2.2)', () => {
  render(<>
    <Timeline />
    <div data-scene="" tabIndex={0} data-testid="scene" />
    <section className="info-panel"><button type="button" data-testid="panel-btn">x</button></section>
    <div className="quality__menu"><button type="button" data-testid="menu-item">y</button></div>
  </>);
  for (const id of ['scene', 'panel-btn', 'menu-item']) {
    fireEvent.keyDown(screen.getByTestId(id), { key: 'ArrowRight' });
    expect(useStore.getState().eraId, id).toBe('1975');
  }
  fireEvent.keyDown(document.body, { key: 'ArrowRight' });
  expect(useStore.getState().eraId).toBe('1984');
});
```

- [ ] **Step 2: Run — it fails**

Run: `npx vitest run src/ui/Timeline.test.tsx`
Expected: FAIL — `scene: expected '1984' to be '1975'` (the scene stub has no handler, so the global keys fire).

- [ ] **Step 3: Add the guard**

In `src/ui/picker.ts`, after `isTypingTarget`:

```ts
/** Spec 7b §2.2: ← → step the era only from the page — not from the scene (look keys), the Facts panel or the Quality menu. */
export function eraKeysAllowed(t: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(t instanceof Element)) return true;
  return t.closest('[data-scene], .info-panel, .quality__menu') === null;
}
```

In `src/ui/Timeline.tsx`: import `eraKeysAllowed` with `isTypingTarget`, and change line 50 to:

```ts
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || isTypingTarget(e.target) || !eraKeysAllowed(e.target)) return;
```

- [ ] **Step 4: Run — it passes**

Run: `npx vitest run src/ui/Timeline.test.tsx src/ui/picker.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/picker.ts src/ui/Timeline.tsx src/ui/Timeline.test.tsx
git commit -m "fix(7b): era arrow keys stay out of the scene, Facts and the Quality menu"
```

---

### Task 5: Quality menu — close on Tab out, Home / End

**Files:**
- Modify: `src/ui/QualityMenu.tsx`, `src/ui/QualityMenu.test.tsx`

**Interfaces:** none new.

- [ ] **Step 1: Write the failing tests**

Append to `src/ui/QualityMenu.test.tsx`:

```tsx
test('focus moving out of the menu closes it; focus moving inside or to nowhere does not', () => {
  render(<><QualityMenu /><button type="button">After</button></>);
  fireEvent.click(screen.getByRole('button', { name: /^Quality/ }));
  const items = screen.getAllByRole('menuitemradio');
  fireEvent.blur(items[0], { relatedTarget: items[1] });
  expect(screen.queryByRole('menu')).not.toBeNull();
  fireEvent.blur(items[1], { relatedTarget: null });   // a tap on iOS Safari does not focus the next button
  expect(screen.queryByRole('menu')).not.toBeNull();
  fireEvent.blur(items[1], { relatedTarget: screen.getByRole('button', { name: 'After' }) });
  expect(screen.queryByRole('menu')).toBeNull();
});
test('Home and End jump to the first and last item', () => {
  render(<QualityMenu />);
  fireEvent.click(screen.getByRole('button', { name: /^Quality/ }));
  const items = screen.getAllByRole('menuitemradio');
  fireEvent.keyDown(items[0], { key: 'End' });
  expect(document.activeElement).toBe(items[3]);
  fireEvent.keyDown(items[3], { key: 'Home' });
  expect(document.activeElement).toBe(items[0]);
});
```

- [ ] **Step 2: Run — they fail**

Run: `npx vitest run src/ui/QualityMenu.test.tsx`
Expected: the two new tests FAIL.

- [ ] **Step 3: Implement**

In `src/ui/QualityMenu.tsx`, replace `onKey` (lines 35–39) with:

```tsx
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = CHOICES.length;
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1
      : e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowUp' ? (i - 1 + n) % n : -1;
    if (to >= 0) { e.preventDefault(); items.current[to]?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  };
  // Spec 7b §2.4: Tab out closes the menu. A null relatedTarget (a tap that focuses nothing) is left to the pointerdown check.
  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const to = e.relatedTarget;
    if (open && to instanceof Node && !e.currentTarget.contains(to)) setOpen(false);
  };
```

and change `<div className="quality">` to `<div className="quality" onBlur={onBlur}>`.

- [ ] **Step 4: Run — all pass**

Run: `npx vitest run src/ui/QualityMenu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/QualityMenu.tsx src/ui/QualityMenu.test.tsx
git commit -m "fix(7b): quality menu closes on Tab out; Home and End"
```

---

### Task 6: Without WebGL or JavaScript; Recenter announced

**Files:**
- Modify: `src/state/store.ts`, `src/ui/SceneBoundary.tsx`, `src/ui/SceneBoundary.test.tsx`, `src/ui/Toolbar.tsx`, `src/ui/ViewSwitch.tsx`, `src/ui/ViewSwitch.test.tsx`, `src/App.tsx`, `src/styles.css`, `index.html`

**Interfaces:**
- Consumes: `STRINGS.recenterAvailable` (Task 2).
- Produces: store `sceneFailed: boolean; setSceneFailed(): void`.

- [ ] **Step 1: Write the failing tests**

In `src/ui/SceneBoundary.test.tsx`, add `import { Toolbar } from './Toolbar';` and:

```tsx
test('without WebGL the Facts panel opens by itself, once (spec 7b §2.5)', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  act(() => useStore.setState({ lang: 'en', sceneFailed: false }));
  render(<><SceneBoundary><Boom /></SceneBoundary><Toolbar /></>);
  expect(useStore.getState().sceneFailed).toBe(true);
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
```

(add `fireEvent` to the Testing Library import.)

Append to `src/ui/ViewSwitch.test.tsx` (it already renders `<ViewSwitch />` with the store in `en`; reuse its imports, add `act` if missing):

```tsx
test('Recenter appearing is announced once; going away says nothing (spec 7b §2.3)', () => {
  render(<ViewSwitch />);
  const live = () => document.querySelector('[aria-live="polite"]')!.textContent;
  expect(live()).toBe('');
  act(() => useStore.getState().setOffFront(true));
  expect(live()).toBe('Recenter available');
  act(() => useStore.getState().setOffFront(false));
  expect(live()).toBe('');
});
```

- [ ] **Step 2: Run — they fail**

Run: `npx vitest run src/ui/SceneBoundary.test.tsx src/ui/ViewSwitch.test.tsx`
Expected: FAIL (no `sceneFailed`, no live region).

- [ ] **Step 3: Store flag**

In `src/state/store.ts` `AppState` add:

```ts
  /** Spec 7b §2.5: the 3D scene failed (no WebGL); Facts opens by itself. */
  sceneFailed: boolean; setSceneFailed: () => void;
```

initial `sceneFailed: false,` and action `setSceneFailed: () => set({ sceneFailed: true }),`.

- [ ] **Step 4: Boundary, Toolbar, ViewSwitch, App**

`src/ui/SceneBoundary.tsx` — import `useStore` from `'../state/store'`; `componentDidCatch`:

```tsx
  componentDidCatch(error: unknown) { console.warn('3D scene failed:', error); dismissLoadCard(true); useStore.getState().setSceneFailed(); }
```

`src/ui/Toolbar.tsx` — after the Escape effect:

```tsx
  // Spec 7b §2.5: without the scene, the facts are the page; open them once.
  const sceneFailed = useStore((s) => s.sceneFailed);
  useEffect(() => { if (sceneFailed) setOpen(true); }, [sceneFailed]);
```

`src/ui/ViewSwitch.tsx` — inside the returned fragment, after the Recenter button block:

```tsx
      <div className="sr-only" aria-live="polite">{offFront ? t(STRINGS.recenterAvailable) : ''}</div>
```

`src/App.tsx` — move `<EraAnnouncer />` out of `<SceneBoundary>` to just after `</main>` (era changes are announced without WebGL too).

- [ ] **Step 5: Fallback layer and `<noscript>`**

`src/styles.css` `.scene-fallback` rule: add `z-index: 1;` (the title card is `z-index: 2`, the overlays higher).

`index.html` — in the `<style>` block add:

```css
      .noscript { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
        padding: 24px; text-align: center; background: radial-gradient(ellipse at 50% 45%, #75624a 0%, #5e4d38 60%, #3f3426 100%);
        color: #f4ecdf; font: 400 16px/1.5 ui-sans-serif, system-ui, sans-serif; }
      .noscript__title { font: 500 28px/1.2 ui-serif, Georgia, serif; letter-spacing: 0.04em; margin: 0 0 8px; }
      .noscript a { color: #f2c46d; }
```

and right after `<body>`:

```html
    <noscript>
      <div class="noscript">
        <p class="noscript__title">El Ancón de Loíza</p>
        <p>Este sitio necesita JavaScript y WebGL para mostrar la escena 3D.</p>
        <p lang="en">This site needs JavaScript and WebGL to show the 3D scene.</p>
        <p><a href="https://github.com/gabriel-rene/ancon-de-loiza/blob/main/docs/research/ancon-research.md">Investigación y fuentes · Research and sources</a></p>
      </div>
    </noscript>
```

- [ ] **Step 6: Run all tests and the build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/state/store.ts src/ui/SceneBoundary.tsx src/ui/SceneBoundary.test.tsx src/ui/Toolbar.tsx src/ui/ViewSwitch.tsx src/ui/ViewSwitch.test.tsx src/App.tsx src/styles.css index.html
git commit -m "feat(7b): no-WebGL opens Facts and keeps era news; noscript; Recenter announced"
```

---

### Task 7: Favicon and icons

**Files:**
- Create: `docs/assets/el-ancon-de-loiza-sign.svg` (copied), `public/favicon.svg`, `scripts/make-icons.ts`, `public/favicon-32.png`, `public/apple-touch-icon.png`, `src/head.test.ts`
- Modify: `index.html`

**Interfaces:**
- Produces: `src/head.test.ts` with helpers `html` (index.html text) and `has(re: RegExp)`; Tasks 8 and 9 append tests to it.

- [ ] **Step 1: Copy the sign file**

```bash
mkdir -p docs/assets public
git show origin/sign-svg:docs/assets/el-ancon-de-loiza-sign.svg > docs/assets/el-ancon-de-loiza-sign.svg
```

- [ ] **Step 2: Write the failing test**

`src/head.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const has = (re: RegExp) => expect(html).toMatch(re);

test('favicon set and theme colour (spec 7b §5.1)', () => {
  has(/<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml" \/>/);
  has(/<link rel="icon" href="\/favicon-32\.png" type="image\/png" sizes="32x32" \/>/);
  has(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" \/>/);
  has(/<meta name="theme-color" content="#3f3426" \/>/);
  for (const f of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']) expect(existsSync(`public/${f}`), f).toBe(true);
});
test('the favicon is the sign\'s A', () => {
  const sign = readFileSync('docs/assets/el-ancon-de-loiza-sign.svg', 'utf8');
  const a = /<path id="glyph-A" d="([^"]+)"/.exec(sign)![1];
  expect(readFileSync('public/favicon.svg', 'utf8')).toContain(`d="${a}"`);
});
test('the page language defaults to Spanish', () => has(/<html lang="es">/));
```

Run: `npx vitest run src/head.test.ts` — Expected: FAIL.

- [ ] **Step 3: Write `public/favicon.svg`**

The A glyph is 80 × 111 units; scaled 0.82 and centred in a 128 square:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <title>El Ancón de Loíza</title>
  <rect width="128" height="128" rx="24" fill="#5e4d38"/>
  <path transform="translate(31.2 18.5) scale(0.82)" fill="#f4ecdf" fill-rule="evenodd" d="M20 0 L60 0 L80 111 L54 111 L52 90 L28 90 L26 111 L0 111 ZM40 35 L47.5 63 L32.5 63 Z"/>
</svg>
```

(If the copied sign's `glyph-A` `d` differs from this string, use the sign's string — the test compares them.)

- [ ] **Step 4: Write `scripts/make-icons.ts`**

```ts
// Renders the PNG icons from public/favicon.svg (spec 7b §5.1). Run by hand: `node scripts/make-icons.ts`; commit the output.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
// The Apple icon must be opaque: iOS rounds the corners itself, so the brown fills the whole square.
for (const [file, size, opaque] of [['favicon-32.png', 32, false], ['apple-touch-icon.png', 180, true]] as const) {
  await page.setViewportSize({ width: size, height: size });
  const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" style="display:block" `);
  await page.setContent(`<html><body style="margin:0;background:${opaque ? '#5e4d38' : 'transparent'}">${sized}</body></html>`);
  await page.screenshot({ path: fileURLToPath(new URL(`../public/${file}`, import.meta.url)), omitBackground: !opaque });
}
await browser.close();
console.log('icons written to public/');
```

Run: `node scripts/make-icons.ts`
Expected: prints `icons written to public/`; `public/favicon-32.png` (32×32) and `public/apple-touch-icon.png` (180×180) exist. Open both with the Read tool and check the A is centred and cream on brown.

- [ ] **Step 5: Head links**

In `index.html`: line 2 `<html lang="en">` → `<html lang="es">`. After the `<title>` line add:

```html
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta name="theme-color" content="#3f3426" />
```

(Vite prefixes these `public/` paths with the `/ancon-de-loiza/` base in the build.)

- [ ] **Step 6: Run tests and build; check the base prefix**

Run: `npx vitest run src/head.test.ts && npm test && npm run build && grep -o 'href="[^"]*favicon[^"]*"' dist/index.html && ls dist/favicon.svg dist/favicon-32.png dist/apple-touch-icon.png`
Expected: PASS; grep shows `href="/ancon-de-loiza/favicon.svg"` and `href="/ancon-de-loiza/favicon-32.png"`; the three files are in `dist/`. If the hrefs are not prefixed, change them in `index.html` to `%BASE_URL%favicon.svg` etc. (Vite replaces `%BASE_URL%`) and update the test regexes to match.

- [ ] **Step 7: Commit**

```bash
git add docs/assets/el-ancon-de-loiza-sign.svg public/favicon.svg public/favicon-32.png public/apple-touch-icon.png scripts/make-icons.ts src/head.test.ts index.html
git commit -m "feat(7b): favicon from the sign's A; theme colour; Spanish page language"
```

---

### Task 8: Share card and Open Graph tags

**Files:**
- Create: `scripts/make-share-card.ts`, `public/share-card.jpg`
- Modify: `index.html`, `src/head.test.ts`

**Interfaces:**
- Consumes: `html`, `has` in `src/head.test.ts` (Task 7); `.title-card`, `.osm-credit`, `.skip-link`, `header`, `nav.timeline` (Task 2).

- [ ] **Step 1: Write the failing test**

Append to `src/head.test.ts`:

```ts
const SITE = 'https://gabriel-rene.github.io/ancon-de-loiza/';
/** Width and height from a baseline/progressive JPEG's SOF marker. */
function jpegSize(b: Buffer) {
  let i = 2;
  while (i < b.length) {
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc2) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error('no SOF marker');
}
test('share card meta (spec 7b §5.2)', () => {
  has(new RegExp(`<link rel="canonical" href="${SITE}" />`));
  has(new RegExp(`<meta property="og:url" content="${SITE}" />`));
  has(/<meta property="og:type" content="website" \/>/);
  has(/<meta property="og:site_name" content="El Ancón de Loíza" \/>/);
  has(/<meta property="og:title" content="El Ancón de Loíza" \/>/);
  has(new RegExp(`<meta property="og:image" content="${SITE}share-card\\.jpg" />`));
  has(/<meta property="og:image:width" content="1200" \/>/);
  has(/<meta property="og:image:height" content="630" \/>/);
  has(/<meta property="og:image:alt" content="[^"]+" \/>/);
  has(/<meta property="og:locale" content="es_PR" \/>/);
  has(/<meta property="og:locale:alternate" content="en_US" \/>/);
  has(/<meta name="twitter:card" content="summary_large_image" \/>/);
  const desc = /<meta name="description" content="([^"]+)" \/>/.exec(html)![1];
  expect(/<meta property="og:description" content="([^"]+)" \/>/.exec(html)![1]).toBe(desc);
  expect(desc.indexOf('ancón')).toBeLessThan(desc.indexOf('ferry'));   // Spanish first
});
test('the share card is a 1200×630 JPEG under 300 KB', () => {
  const b = readFileSync('public/share-card.jpg');
  expect(jpegSize(b)).toEqual({ w: 1200, h: 630 });
  expect(b.length).toBeLessThan(300_000);
});
```

Run: `npx vitest run src/head.test.ts` — Expected: FAIL.

- [ ] **Step 2: Meta tags**

In `index.html`, replace the `<meta name="description" …>` line with:

```html
    <meta name="description" content="El ancón del Río Grande de Loíza, Puerto Rico, en 3D, de 1840 a 1986. · The Loíza river ferry, Puerto Rico, in 3D, 1840–1986." />
    <link rel="canonical" href="https://gabriel-rene.github.io/ancon-de-loiza/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="El Ancón de Loíza" />
    <meta property="og:title" content="El Ancón de Loíza" />
    <meta property="og:description" content="El ancón del Río Grande de Loíza, Puerto Rico, en 3D, de 1840 a 1986. · The Loíza river ferry, Puerto Rico, in 3D, 1840–1986." />
    <meta property="og:url" content="https://gabriel-rene.github.io/ancon-de-loiza/" />
    <meta property="og:image" content="https://gabriel-rene.github.io/ancon-de-loiza/share-card.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="El ancón cruzando el río al atardecer, 1975 · The ferry crossing the river at golden hour, 1975" />
    <meta property="og:locale" content="es_PR" />
    <meta property="og:locale:alternate" content="en_US" />
    <meta name="twitter:card" content="summary_large_image" />
```

- [ ] **Step 3: Write `scripts/make-share-card.ts`**

```ts
// Renders public/share-card.jpg (spec 7b §5.2) from the production build. Run by hand, with `npm run preview` running:
//   node scripts/make-share-card.ts        (ANCON_URL overrides the page; SWIFTSHADER=1 forces software WebGL)
// Commit the output. The user approves the image before merge.
import { chromium } from '@playwright/test';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const url = process.env.ANCON_URL ?? 'http://localhost:4173/ancon-de-loiza/?freeze=1&q=high&lang=es';
const out = fileURLToPath(new URL('../public/share-card.jpg', import.meta.url));
const args = process.env.SWIFTSHADER ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(url);
await page.waitForFunction(() => (window as unknown as { __ANCON_READY__?: boolean }).__ANCON_READY__ === true, null, { timeout: 180_000 });
await page.addStyleTag({ content: 'header, nav, .timeline, .title-card, .osm-credit, .skip-link, .fps-readout { display: none !important; }' });
await page.waitForTimeout(1500);
const scene = (await page.screenshot({ type: 'png' })).toString('base64');

// The title over the frame: load-card serif, cream, bottom left, on a soft dark gradient.
await page.setContent(`<!doctype html><html><body style="margin:0">
  <div style="position:relative;width:1200px;height:630px;background:url(data:image/png;base64,${scene}) center/cover">
    <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(12,15,15,0.72) 0%, rgba(12,15,15,0) 48%)"></div>
    <div style="position:absolute;left:56px;bottom:48px;color:#f4ecdf;font-family:ui-serif, Georgia, serif">
      <div style="font-size:76px;line-height:1;font-weight:500;letter-spacing:0.02em">El Ancón de Loíza</div>
      <div style="margin-top:14px;font-size:26px;letter-spacing:0.24em">1840–1986</div>
    </div>
  </div></body></html>`);
await page.screenshot({ path: out, type: 'jpeg', quality: 85 });
await browser.close();
console.log(`share card written: ${out} (${Math.round(statSync(out).size / 1024)} KB)`);
```

- [ ] **Step 4: Make the image**

```bash
npm run build   # then start `npm run preview` in the background (or preview_start name `ancon-preview`), then:
node scripts/make-share-card.ts
```

Expected: `share card written: …/public/share-card.jpg (NNN KB)` with NNN < 300. If WebGL fails headless on this Mac, re-run with `SWIFTSHADER=1`. If over 300 KB, change `quality: 85` to `78`.

Open `public/share-card.jpg` with the Read tool. Check: the ferry is visible and not under the title; golden light; no UI. If the title covers the ferry, move the text block to `right:56px` and `text-align:right` and re-run. Send the image to the user with `SendUserFile` (status `proactive`) — the user approves it before merge (spec §5.2).

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/head.test.ts && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/make-share-card.ts public/share-card.jpg index.html src/head.test.ts
git commit -m "feat(7b): share card and Open Graph tags"
```

---

### Task 9: 404 page

**Files:**
- Create: `public/404.html`
- Modify: `src/head.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/head.test.ts`:

```ts
test('404 page: both languages, a link home, the favicon, no index, no script (spec 7b §5.3)', () => {
  const p = readFileSync('public/404.html', 'utf8');
  expect(p).toMatch(/^<!doctype html>/i);
  expect(p).toContain('<html lang="es">');
  expect(p).toContain('<meta name="robots" content="noindex" />');
  expect(p).toContain('href="/ancon-de-loiza/favicon.svg"');
  expect(p).toContain('href="/ancon-de-loiza/"');
  expect(p).toContain('Esta página no existe.');
  expect(p).toContain('This page does not exist.');
  expect(p).not.toMatch(/<script/i);
});
```

Run: `npx vitest run src/head.test.ts` — Expected: FAIL (file missing).

- [ ] **Step 2: Write `public/404.html`**

GitHub Pages serves it for any missing path under the site, at any depth, so every URL in it is absolute.

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>No existe · Not found — El Ancón de Loíza</title>
    <link rel="icon" href="/ancon-de-loiza/favicon.svg" type="image/svg+xml" />
    <meta name="theme-color" content="#3f3426" />
    <style>
      html, body { margin: 0; height: 100%; }
      body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 24px; box-sizing: border-box;
        background: radial-gradient(ellipse at 50% 45%, #75624a 0%, #5e4d38 60%, #3f3426 100%); color: #f4ecdf; text-align: center;
        font: 400 17px/1.5 ui-sans-serif, system-ui, sans-serif; }
      .kicker { margin: 0; font: 500 13px/1.4 ui-serif, Georgia, serif; text-transform: uppercase; letter-spacing: 0.24em; }
      h1 { margin: 6px 0 14px; font: 500 clamp(56px, 12vw, 120px)/1 ui-serif, Georgia, serif; letter-spacing: 0.04em; }
      p { margin: 0; }
      a { display: inline-block; margin-top: 20px; padding: 12px 18px; border-radius: 10px; background: #f4ecdf; color: #1b1a17;
        font-weight: 600; text-decoration: none; }
      a:focus-visible { outline: 2px solid #f2c46d; outline-offset: 3px; }
    </style>
  </head>
  <body>
    <main>
      <p class="kicker">El Ancón de Loíza</p>
      <h1>404</h1>
      <p>Esta página no existe.</p>
      <p lang="en">This page does not exist.</p>
      <a href="/ancon-de-loiza/">Volver al ancón · <span lang="en">Back to the ferry</span></a>
    </main>
  </body>
</html>
```

- [ ] **Step 3: Run tests; check the build copies it**

Run: `npx vitest run src/head.test.ts && npm run build && ls dist/404.html`
Expected: PASS; `dist/404.html` exists. Open `http://localhost:4173/ancon-de-loiza/404.html` in the preview (after `npm run preview`) and take a screenshot.

- [ ] **Step 4: Commit**

```bash
git add public/404.html src/head.test.ts
git commit -m "feat(7b): bilingual 404 page in the load-card look"
```

---

### Task 10: README for launch

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace everything from the top down to (not including) `## Acknowledgements` with:**

```markdown
# El Ancón de Loíza

![El Ancón de Loíza at golden hour, 1975](public/share-card.jpg)

A cinematic, historically accurate 3D reconstruction of the **Ancón de Loíza** — the hand-powered river ferry that crossed the Río Grande de Loíza, Puerto Rico, from the 1820s until the PR-187 bridge ("Puente de la Restauración") replaced it in 1985–86. In Spanish and English.

**Live:** https://gabriel-rene.github.io/ancon-de-loiza/

## What you can do

- **Pick an era** on the timeline, 1840 to 1986: the ferry, the crew, the landings, the town, the plants, the animals and the traffic change with it.
- **Three views:** Ride (on the deck), Shore (standing on the Loíza landing) and Sky. Drag to look around; the view stays where you leave it; Recenter brings it back.
- **Facts:** 3–5 sourced facts per era, each with its source links. Inferred items are labelled.
- **Sound** (off by default) and **Quality** (Auto, High, Medium, Low).

### Keyboard

| Key | Does |
|---|---|
| Tab | Moves through the controls; the first stop skips to the timeline |
| ← → | Previous / next era (when the scene does not have focus) |
| ← → ↑ ↓ on the scene | Look around |
| + − on the scene | Zoom |
| 1 · 2 · 3 | Ride · Shore · Sky |
| R | Recenter |
| Esc | Closes Facts or the Quality menu |

### Accessibility

Every control works by keyboard and has a spoken name; era changes are announced. With *reduce motion* set in the system, era changes and camera moves are instant (the ferry and the river keep moving: they are the subject). Text over the scene meets WCAG AA contrast. Without WebGL the page still shows the facts for every era.

## Research

All scene details come from a sourced dossier: [`docs/research/ancon-research.md`](docs/research/ancon-research.md). Every claim has a citation and a confidence level. Inferred details are labelled as such, in the docs and in the app.

## Design

[`docs/superpowers/specs/2026-09-26-ancon-loiza-design.md`](docs/superpowers/specs/2026-09-26-ancon-loiza-design.md), with one spec per phase in [`docs/superpowers/specs/`](docs/superpowers/specs/) and the rulings for each phase in [`docs/superpowers/notes/`](docs/superpowers/notes/).

## Roadmap

- [x] Phase 0 — Repo, research, design, plan
- [x] Phase 1 — Terrain, river, sky, light, water
- [x] Phase 2 — Vegetation: mangroves, palms, casuarinas, buttonwood, sea grape, almendros, ground cover, cane and era landscapes
- [x] Phase 3 — The ancón per era: crossing loop, crew, era picker; 3b: sourced facts panel
- [x] Phase 4 — The landings, the town, the ferry's load and the 1986 bridge traffic
- [x] Phase 5 — Birds and water life
- [x] Phase 6 — True-scale timeline, era fade, three views (6a); sound (6b)
- [x] Phase 7 — Phones and speed (7a); accessibility and launch (7b)

Open items (fact checks, art notes) are listed in the rulings notes of each phase.

## Development

`npm run dev` · `npm test` · `npm run build` · `npm run e2e` (Playwright on the production build; the GPU leak probe is tagged `@slow`, and `npm run e2e:fast` skips it with `--grep-invert @slow`).

Launch images are made by hand and committed: `node scripts/make-icons.ts` (favicon PNGs from `public/favicon.svg`) and `node scripts/make-share-card.ts` (with `npm run preview` running).

## Stack

Vite · React · TypeScript · React Three Fiber · drei · postprocessing · zustand. All 3D models and sound are made in code. Deployed to GitHub Pages.

```

- [ ] **Step 2: Check every link in it resolves**

Run: `for p in public/share-card.jpg docs/research/ancon-research.md docs/superpowers/specs/2026-09-26-ancon-loiza-design.md docs/superpowers/specs docs/superpowers/notes src/data/geo/README.md LICENSE; do test -e "$p" && echo "ok $p" || echo "MISSING $p"; done`
Expected: every line `ok`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(7b): README for launch"
```

---

### Task 11: End-to-end checks, snapshots, rulings

**Files:**
- Create: `tests/e2e/a11y.spec.ts`, `docs/superpowers/notes/phase-7b-rulings.md`
- Modify: `tests/snapshots/phase5/*.png` (regenerated)

- [ ] **Step 1: Write `tests/e2e/a11y.spec.ts`**

```ts
import { expect, test, type Page } from '@playwright/test';

const ready = (page: Page) => page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
/** Accessible-ish name of the focused element. */
const focused = (page: Page) => page.evaluate(() => {
  const a = document.activeElement as HTMLElement | null;
  return a ? (a.getAttribute('aria-label') ?? a.textContent ?? '').trim() : '';
});

test('tab order: skip link, toolbar, scene, timeline; the skip link lands on the chosen era', async ({ page }) => {
  await page.goto('?era=1925&freeze=1&q=low&lang=en');
  await ready(page);
  const seen: string[] = [];
  for (let i = 0; i < 24; i++) { await page.keyboard.press('Tab'); seen.push(await focused(page)); }
  expect(seen[0]).toBe('Skip to timeline');
  const at = (re: RegExp) => seen.findIndex((s) => re.test(s));
  expect(at(/^Facts$/)).toBeGreaterThan(0);
  expect(at(/^Sky$/)).toBeGreaterThan(at(/^Facts$/));
  expect(at(/^3D view of the ferry, 1925/)).toBeGreaterThan(at(/^Sky$/));
  expect(at(/^1840 ·/)).toBeGreaterThan(at(/^3D view/));
  await page.locator('body').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  expect(await focused(page)).toMatch(/^1925 ·/);
});

test('arrows on the scene look around and leave the era; arrows elsewhere change it', async ({ page }) => {
  await page.goto('?cam=sky&era=1975&freeze=1&q=low&lang=en');
  await ready(page);
  const recenter = page.getByRole('button', { name: 'Recenter' });
  await expect(recenter).toBeHidden();
  await page.getByRole('group', { name: /^3D view of the ferry/ }).focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(recenter).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/era=1975/);
  await page.keyboard.press('r');
  await expect(recenter).toBeHidden({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Facts' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/era=1984/);
});

test('head: icons, share card and the 404 page are served', async ({ page, request }) => {
  await page.goto('?freeze=1&q=low');
  for (const f of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'share-card.jpg', '404.html']) {
    expect((await request.get(f)).status(), f).toBe(200);
  }
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', '/ancon-de-loiza/favicon.svg');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://gabriel-rene.github.io/ancon-de-loiza/share-card.jpg');
});

test.describe('without WebGL', () => {
  test.use({ launchOptions: { args: ['--disable-webgl', '--disable-3d-apis'] } });
  test('the fallback shows, Facts opens by itself, and era changes are still announced', async ({ page }) => {
    await page.goto('?era=1975&lang=en');
    await expect(page.locator('.scene-fallback')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('navigation', { name: 'Choose an era' }).getByRole('button', { name: /^1984/ }).click();
    await expect(page.locator('[aria-live="polite"]', { hasText: 'Now showing: 1984' })).toHaveCount(1, { timeout: 10_000 });
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/a11y.spec.ts`
Expected: 4 PASS. If "without WebGL" fails because R3F does not throw into `SceneBoundary` with WebGL disabled, that is a real bug in the fallback: use superpowers:systematic-debugging, fix it in `SceneBoundary`/`App.tsx`, and add a unit test for the cause. Do not weaken the test.

- [ ] **Step 3: Run the full suites**

Run: `npm test && npm run build && npm run e2e:fast`
Expected: all PASS. Existing e2e tests that named old DOM details (for example the canvas as the first element) are updated only if the old detail is no longer true by design (§2.3).

- [ ] **Step 4: Snapshots**

`npm run e2e:fast` rewrites `tests/snapshots/phase5/*.png` (world.spec). Open three of them with the Read tool (`default.png`, `1840-bank.png`, `1986-bridge.png`) and check the new title pill and darker timeline look right and nothing else changed. Then:

```bash
git add tests/snapshots/phase5 tests/e2e/a11y.spec.ts
git commit -m "test(7b): a11y e2e; refresh snapshots for the glass backing"
```

- [ ] **Step 5: Write `docs/superpowers/notes/phase-7b-rulings.md`**

Record, one bullet each, with the date 2026-10-02: the user rulings from spec §1; the controller rulings (ambient motion keeps moving; sign file copied, PR #10 untouched; `--glass` alpha 0.65 is the lowest that passes over white, so the toolbar moved from 0.55 to 0.65 too; dip/load-card centre stop `#8a7556` → `#75624a`; Quality menu ignores a focusout with no `relatedTarget` because iOS Safari taps do not focus buttons; one look-key sign for all views, Shore's inverted drag is pointer-only); anything found while building; and the user's iPhone checklist from spec §7:

```markdown
## iPhone checklist (user)
- [ ] Paste https://gabriel-rene.github.io/ancon-de-loiza/ in Messages: the share card shows.
- [ ] Safari tab shows the A favicon; Add to Home Screen shows the brown A icon.
- [ ] https://gabriel-rene.github.io/ancon-de-loiza/nope shows the 404 page; its button goes home.
- [ ] VoiceOver reads the title (heading level 1), the timeline, and the scene label.
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/notes/phase-7b-rulings.md
git commit -m "docs(7b): rulings and the iPhone checklist"
```
