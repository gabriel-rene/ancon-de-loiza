# Phase 1 — The World (terrain, river, sea, sky, light, water) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed web page that renders the real geography of the Río Grande de Loíza crossing (from OpenStreetMap) with cinematic sky, sun, height fog, reflective flowing water and post-processing, switchable by era and time of day.

**Architecture:** Vite + React + React Three Fiber. Pure TypeScript modules (projection, sun, atmosphere, eras, terrain fields) are unit-tested with vitest and feed thin R3F components. Geography is baked once from the OSM API into `src/data/geo/loiza.json`; terrain height/water classes are computed at runtime from it (so eras can widen the river). Fog is a depth-based post effect so it applies uniformly to every material.

**Tech Stack:** three 0.186, @react-three/fiber 9, @react-three/drei 10, @react-three/postprocessing 3 / postprocessing 6, three-custom-shader-material 6, zustand 5, leva (debug only), fast-xml-parser 5, vitest, Playwright, GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-26-ancon-loiza-design.md` · Research: `docs/research/ancon-research.md`

## Global Constraints

- World frame: local tangent plane at origin **lat 18.43485, lon -65.8823**; 1 unit = 1 m; +X east, +Y up, +Z south.
- Every era fact carries `sources: string[]` (IDs like `S1` from the research doc) and `confidence: 'H'|'M'|'L'`; inferred values set `inferred: true`.
- Era ids, in order: `1840, 1900, 1925, 1935, 1959, 1975, 1984, 1986`.
- Time of day is local AST (UTC-4, no DST).
- Vite `base` is `/ancon-de-loiza/`.
- Never put personal data in network requests. OSM requests use UA `ancon-de-loiza/0.1 (+https://github.com/gabriel-rene/ancon-de-loiza)`.
- No downloaded meshes or textures in Phase 1 (procedural only).
- Quality tiers `high | medium | low` from day one.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File map

```
package.json, vite.config.ts, tsconfig.json, index.html, playwright.config.ts
.github/workflows/deploy.yml
scripts/bake-osm.ts            fetch + parse OSM → src/data/geo/loiza.json
scripts/osm-parse.ts           pure parser (tested)
src/main.tsx, src/App.tsx, src/styles.css
src/geo/project.ts             lat/lon ↔ local metres
src/geo/sun.ts                 NOAA sun position, sunAt()
src/geo/atmosphere.ts          sun elevation → light/fog/sky parameters
src/data/landmarks.ts          sourced landmark coordinates
src/data/sources.ts            research source list
src/data/eras.ts               era configs
src/data/geo/types.ts          GeoBundle types
src/data/geo/loiza.json        baked OSM geometry
src/state/store.ts             zustand store
src/state/url.ts               URL ⇄ state
src/quality.ts                 tier detection + settings
src/terrain/noise.ts           value noise / fbm (TS)
src/terrain/raster.ts          polygon fill, polyline walls, flood fill
src/terrain/edt.ts             Euclidean distance transform
src/terrain/fields.ts          buildFields(): water classes, shore distance, height, info
src/scene/glsl/noise.ts        simplex noise GLSL string
src/scene/World.tsx            composition
src/scene/useWorldFields.ts    memoised near/far fields
src/scene/Terrain.tsx          near + far terrain meshes
src/scene/terrainMaterial.ts   CSM terrain shader
src/scene/SkyAndLight.tsx      sky, environment, sun light, shadows
src/scene/Backdrop.tsx         Sierra de Luquillo + foothill silhouettes
src/scene/water/Water.tsx      Reflector-based water
src/scene/water/waterShader.ts water GLSL
src/scene/post/HeightFogEffect.ts
src/scene/post/Post.tsx
src/scene/Cameras.tsx
src/scene/ReadySignal.tsx
src/ui/DebugPanel.tsx
src/ui/TitleCard.tsx
tests/e2e/phase1.spec.ts
```

---

### Task 1: Scaffold the app and the deploy pipeline

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `.github/workflows/deploy.yml`, `src/smoke.test.ts`
- Modify: `.gitignore` (add `scripts/.cache/`)

**Interfaces:**
- Produces: `npm run dev|build|test|bake|e2e`; `<App/>` renders a full-screen `<Canvas>`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "ancon-de-loiza",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "preview": "vite preview --port 4173 --strictPort",
    "test": "vitest run",
    "bake": "node scripts/bake-osm.ts",
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm i three @react-three/fiber @react-three/drei @react-three/postprocessing postprocessing three-custom-shader-material zustand leva react react-dom
npm i -D vite @vitejs/plugin-react typescript @types/three @types/react @types/react-dom @types/node vitest @playwright/test fast-xml-parser
```

If `tsc` from TypeScript 7 fails on the config, pin `typescript@^5.9` and continue.

- [ ] **Step 3: Write `vite.config.ts`, `tsconfig.json`, `index.html`**

```ts
// vite.config.ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/ancon-de-loiza/',
  plugins: [react()],
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'], environment: 'node' },
});
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "scripts", "vite.config.ts", "playwright.config.ts", "tests"]
}
```

```html
<!-- index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>El Ancón de Loíza</title>
    <meta name="description" content="A historically accurate 3D reconstruction of the Ancón de Loíza river ferry, Puerto Rico, 1820s–1986." />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Write the minimal app**

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
```

```tsx
// src/App.tsx
import { Canvas } from '@react-three/fiber';

export function App() {
  return (
    <Canvas camera={{ fov: 42, near: 0.5, far: 40000, position: [0, 50, 200] }}>
      <color attach="background" args={['#9fb3c2']} />
    </Canvas>
  );
}
```

```css
/* src/styles.css */
html, body, #root { margin: 0; height: 100%; background: #0c0f0f; overflow: hidden; }
canvas { display: block; }
```

- [ ] **Step 5: Smoke test**

```ts
// src/smoke.test.ts
import { expect, test } from 'vitest';
test('vitest runs', () => expect(1 + 1).toBe(2));
```

Run: `npm test` → PASS. Run: `npm run build` → `dist/` created.

- [ ] **Step 6: Deploy workflow**

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push: { branches: [main] }
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: '${{ steps.d.outputs.page_url }}' }
    steps:
      - id: d
        uses: actions/deploy-pages@v4
```

Enable Pages for Actions: `gh api -X POST repos/gabriel-rene/ancon-de-loiza/pages -f build_type=workflow`

- [ ] **Step 7: Commit and push** (`feat: scaffold vite + r3f app and pages deploy`). Confirm the Actions run is green and `https://gabriel-rene.github.io/ancon-de-loiza/` shows the blue-grey canvas.

---

### Task 2: Geo core — projection, landmarks, sun, atmosphere

**Files:**
- Create: `src/geo/project.ts`, `src/geo/sun.ts`, `src/geo/atmosphere.ts`, `src/data/landmarks.ts`
- Test: `src/geo/project.test.ts`, `src/geo/sun.test.ts`, `src/geo/atmosphere.test.ts`

**Interfaces:**
- Produces:
  - `ORIGIN: {lat:number; lon:number}`; `project(lat, lon): [x, z]`; `unproject(x, z): [lat, lon]`
  - `sunPosition(date: Date, lat: number, lon: number): { azimuth: number; elevation: number }` (degrees; azimuth from north, clockwise)
  - `sunAt(dateISO: string, hoursAST: number): { azimuth; elevation }`
  - `sunDirection(azimuth, elevation): [x, y, z]` (unit, world frame)
  - `atmosphereFor(elevation: number): Atmosphere` where `Atmosphere = { sunColor: [r,g,b]; sunIntensity: number; fogColor: [r,g,b]; fogDensity: number; envIntensity: number; turbidity: number; rayleigh: number }`
  - `LANDMARKS: Record<LandmarkId, { lat; lon; label; sources: string[]; confidence }>` and `landmarkXZ(id): [x, z]`

- [ ] **Step 1: Failing tests**

```ts
// src/geo/project.test.ts
import { describe, expect, test } from 'vitest';
import { project, unproject } from './project';
import { landmarkXZ } from '../data/landmarks';

describe('project', () => {
  test('origin maps to 0,0', () => {
    const [x, z] = project(18.43485, -65.8823);
    expect(Math.abs(x)).toBeLessThan(1e-6);
    expect(Math.abs(z)).toBeLessThan(1e-6);
  });
  test('east landing is east and south of origin', () => {
    const [x, z] = landmarkXZ('eastLanding');
    expect(x).toBeCloseTo(84.5, 0);
    expect(z).toBeCloseTo(72.4, 0);
  });
  test('crossing length matches research (200–230 m)', () => {
    const [ax, az] = landmarkXZ('eastLanding');
    const [bx, bz] = landmarkXZ('westLanding');
    const d = Math.hypot(ax - bx, az - bz);
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(230);
  });
  test('unproject inverts project', () => {
    const [lat, lon] = unproject(...project(18.44, -65.87));
    expect(lat).toBeCloseTo(18.44, 7);
    expect(lon).toBeCloseTo(-65.87, 7);
  });
});
```

```ts
// src/geo/sun.test.ts
import { expect, test } from 'vitest';
import { sunAt, sunDirection } from './sun';

test('Dec 21 solar noon elevation ≈ 48° (research §1.3)', () => {
  expect(sunAt('2025-12-21', 12 + 21 / 60).elevation).toBeCloseTo(48, 0);
});
test('Jun 21 solar noon sun is ~85° high and to the north', () => {
  const s = sunAt('2026-06-21', 12 + 24 / 60);
  expect(s.elevation).toBeGreaterThan(84);
  expect(sunDirection(s.azimuth, s.elevation)[2]).toBeLessThan(0); // -Z is north
});
test('Jun 21 sunrise azimuth ≈ 65°', () => {
  const s = sunAt('2026-06-21', 5 + 47 / 60);
  expect(Math.abs(s.elevation)).toBeLessThan(1.5);
  expect(s.azimuth).toBeGreaterThan(63);
  expect(s.azimuth).toBeLessThan(67);
});
test('sunDirection is unit length', () => {
  const [x, y, z] = sunDirection(200, 20);
  expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
});
```

```ts
// src/geo/atmosphere.test.ts
import { expect, test } from 'vitest';
import { atmosphereFor } from './atmosphere';

test('low sun is warmer than high sun', () => {
  const low = atmosphereFor(4), high = atmosphereFor(60);
  expect(low.sunColor[0] / low.sunColor[2]).toBeGreaterThan(high.sunColor[0] / high.sunColor[2]);
});
test('sun below horizon gives no direct light', () => {
  expect(atmosphereFor(-6).sunIntensity).toBe(0);
});
test('haze is thicker near the horizon', () => {
  expect(atmosphereFor(3).fogDensity).toBeGreaterThan(atmosphereFor(60).fogDensity);
});
```

- [ ] **Step 2: Run** `npm test` → FAIL (modules missing).

- [ ] **Step 3: Implement**

```ts
// src/geo/project.ts
export const ORIGIN = { lat: 18.43485, lon: -65.8823 } as const;
const R = 6378137;
const D = Math.PI / 180;
const COS0 = Math.cos(ORIGIN.lat * D);

/** WGS84 lat/lon → local metres. +X east, +Z south. */
export function project(lat: number, lon: number): [number, number] {
  return [(lon - ORIGIN.lon) * D * R * COS0, -(lat - ORIGIN.lat) * D * R];
}

export function unproject(x: number, z: number): [number, number] {
  return [ORIGIN.lat - z / (D * R), ORIGIN.lon + x / (D * R * COS0)];
}
```

```ts
// src/geo/sun.ts
import { ORIGIN } from './project';

const RAD = Math.PI / 180;

/** NOAA solar position. Azimuth from north clockwise, elevation above horizon (no refraction). */
export function sunPosition(date: Date, lat: number, lon: number) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.tan((eps * RAD) / 2) ** 2;
  const eqTime =
    (4 / RAD) *
    (y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD));
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const tst = (((minutes + eqTime + 4 * lon) % 1440) + 1440) % 1440;
  const ha = (tst / 4 - 180) * RAD;
  const phi = lat * RAD;
  const cosZ = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(Math.min(1, Math.max(-1, cosZ)));
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi));
  return { azimuth: (az / RAD + 180 + 360) % 360, elevation: 90 - zen / RAD };
}

/** Sun for a calendar date at local Atlantic Standard Time (UTC-4). */
export function sunAt(dateISO: string, hoursAST: number) {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setTime(d.getTime() + (hoursAST + 4) * 3600_000);
  return sunPosition(d, ORIGIN.lat, ORIGIN.lon);
}

/** Unit vector toward the sun in world frame (+X east, +Y up, +Z south). */
export function sunDirection(azimuth: number, elevation: number): [number, number, number] {
  const a = azimuth * RAD, el = elevation * RAD;
  return [Math.sin(a) * Math.cos(el), Math.sin(el), -Math.cos(a) * Math.cos(el)];
}
```

```ts
// src/geo/atmosphere.ts
export type RGB = [number, number, number];
export interface Atmosphere {
  sunColor: RGB; sunIntensity: number; fogColor: RGB; fogDensity: number;
  envIntensity: number; turbidity: number; rayleigh: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Tropical coastal atmosphere as a function of sun elevation (degrees). Linear-space colours. */
export function atmosphereFor(elevation: number): Atmosphere {
  const day = smooth(-4, 2, elevation);          // 0 night → 1 day
  const high = smooth(4, 35, elevation);         // 0 golden → 1 high sun
  const sunColor = mix([1.0, 0.42, 0.16], [1.0, 0.93, 0.84], high);
  const fogDay = mix([0.95, 0.66, 0.42], [0.62, 0.72, 0.82], high);
  const fogColor = mix([0.05, 0.06, 0.09], fogDay, day);
  return {
    sunColor,
    sunIntensity: elevation <= -2 ? 0 : lerp(0.0, 1.0, day) * lerp(2.2, 3.4, high),
    fogColor,
    fogDensity: lerp(0.0011, 0.00045, high),
    envIntensity: lerp(0.08, lerp(0.55, 0.8, high), day),
    turbidity: lerp(9, 5, high),
    rayleigh: lerp(2.6, 1.4, high),
  };
}
```

```ts
// src/data/landmarks.ts
import { project } from '../geo/project';
import type { Confidence } from './eras';

export type LandmarkId =
  | 'eastLanding' | 'westLanding' | 'church' | 'plaza' | 'paseoJulia'
  | 'bridgeSouth' | 'bridgeNorth' | 'mouth' | 'elYunque';

export const LANDMARKS: Record<LandmarkId, { lat: number; lon: number; label: string; sources: string[]; confidence: Confidence }> = {
  eastLanding: { lat: 18.4342, lon: -65.8815, label: 'Estación de El Ancón (Loíza)', sources: ['S9', 'S26'], confidence: 'M' },
  westLanding: { lat: 18.4355, lon: -65.8831, label: 'Torrecilla Baja landing', sources: ['S26'], confidence: 'M' },
  church: { lat: 18.4333, lon: -65.8796, label: 'Parroquia Espíritu Santo y San Patricio', sources: ['S14', 'S26'], confidence: 'H' },
  plaza: { lat: 18.4328, lon: -65.8799, label: 'Plaza de Loíza', sources: ['S26'], confidence: 'H' },
  paseoJulia: { lat: 18.4334, lon: -65.8818, label: 'Paseo Julia de Burgos', sources: ['S26'], confidence: 'H' },
  bridgeSouth: { lat: 18.432, lon: -65.8831, label: 'PR-187 bridge, south end', sources: ['S26'], confidence: 'H' },
  bridgeNorth: { lat: 18.4355, lon: -65.8846, label: 'PR-187 bridge, north end', sources: ['S26'], confidence: 'H' },
  mouth: { lat: 18.4383, lon: -65.8783, label: 'Río Grande de Loíza mouth', sources: ['S13'], confidence: 'H' },
  elYunque: { lat: 18.3103, lon: -65.7911, label: 'El Yunque peak (Sierra de Luquillo)', sources: ['S1'], confidence: 'M' },
};

export const landmarkXZ = (id: LandmarkId) => project(LANDMARKS[id].lat, LANDMARKS[id].lon);
```

Note: `landmarks.ts` imports the `Confidence` type from `eras.ts` (Task 3). In this task, temporarily declare `export type Confidence = 'H' | 'M' | 'L';` at the top of a new `src/data/eras.ts`; Task 3 replaces the file and keeps that export.

- [ ] **Step 4: Run** `npm test` → PASS. If a sun test is off by >1°, check the UTC conversion (AST = UTC-4) before touching the formula.

- [ ] **Step 5: Commit** (`feat(geo): projection, sun position, atmosphere, landmarks`).

---

### Task 3: Sources, eras, store, URL state, quality tiers

**Files:**
- Create: `src/data/sources.ts`, `src/data/eras.ts`, `src/state/store.ts`, `src/state/url.ts`, `src/quality.ts`
- Test: `src/data/eras.test.ts`, `src/state/url.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Confidence = 'H'|'M'|'L'`; `interface Sourced<T> { value: T; sources: string[]; confidence: Confidence; inferred?: boolean }`
  - `type EraId = '1840'|'1900'|'1925'|'1935'|'1959'|'1975'|'1984'|'1986'`
  - `interface Era { id: EraId; label: string; years: string; date: string; summary: Sourced<string>; river: { bankOffset: Sourced<number>; flow: Sourced<number> } }`
  - `ERAS: Era[]`, `ERA_IDS: EraId[]`, `getEra(id): Era`
  - `SOURCES: Record<string, { title: string; url: string }>`
  - `type CameraPreset = 'ride'|'bank'|'aerial'|'mouth'`; `type Quality = 'high'|'medium'|'low'`
  - `useStore` with `{ eraId, timeOfDay, camera, quality, debug, frozen, setEra, setTime, setCamera, setQuality }`
  - `parseUrlState(search: string): Partial<UrlState>`; `toSearch(state: UrlState): string`
  - `QUALITY: Record<Quality, QualitySettings>`; `detectQuality(): Quality`; `QualitySettings = { dpr: [number, number]; nearSize: number; farSize: number; reflScale: number; shadowMap: number; ao: boolean }`

- [ ] **Step 1: Failing tests**

```ts
// src/data/eras.test.ts
import { describe, expect, test } from 'vitest';
import { ERAS, ERA_IDS, getEra, type Sourced } from './eras';
import { SOURCES } from './sources';

const sourcedFields = (e: (typeof ERAS)[number]): Sourced<unknown>[] => [e.summary, e.river.bankOffset, e.river.flow];

describe('eras', () => {
  test('ids are unique and chronological', () => {
    expect(ERA_IDS).toEqual(['1840', '1900', '1925', '1935', '1959', '1975', '1984', '1986']);
    expect(new Set(ERAS.map((e) => e.id)).size).toBe(ERAS.length);
  });
  test('every fact is sourced or explicitly inferred', () => {
    for (const e of ERAS) for (const f of sourcedFields(e)) {
      expect(f.sources.length > 0 || f.inferred === true, `${e.id}`).toBe(true);
      for (const s of f.sources) expect(SOURCES[s], `${e.id} → ${s}`).toBeDefined();
    }
  });
  test('dates parse', () => {
    for (const e of ERAS) expect(Number.isNaN(Date.parse(e.date))).toBe(false);
  });
  test('river is wider and faster before Carraízo dam (1953–54)', () => {
    expect(getEra('1935').river.bankOffset.value).toBeGreaterThan(getEra('1975').river.bankOffset.value);
    expect(getEra('1935').river.flow.value).toBeGreaterThan(getEra('1975').river.flow.value);
  });
});
```

```ts
// src/state/url.test.ts
import { expect, test } from 'vitest';
import { parseUrlState, toSearch } from './url';

test('parses known params and ignores junk', () => {
  expect(parseUrlState('?era=1935&t=17.5&cam=ride&q=low&debug=1&freeze=1&x=9')).toEqual({
    eraId: '1935', timeOfDay: 17.5, camera: 'ride', quality: 'low', debug: true, frozen: true,
  });
});
test('rejects invalid values', () => {
  expect(parseUrlState('?era=1999&t=99&cam=moon&q=ultra')).toEqual({});
});
test('round-trips', () => {
  const s = { eraId: '1984', timeOfDay: 7.25, camera: 'bank' } as const;
  expect(parseUrlState(toSearch(s))).toEqual(s);
});
```

- [ ] **Step 2: Run** `npm test` → FAIL.

- [ ] **Step 3: Implement**

```ts
// src/data/sources.ts — mirrors docs/research/ancon-research.md § Sources
export const SOURCES: Record<string, { title: string; url: string }> = {
  S1: { title: 'El Nuevo Día — "Sabías que… la barcaza El Ancón" (2025)', url: 'https://www.elnuevodia.com/noticias/locales/notas/sabias-que-la-barcaza-el-ancon-fue-por-un-siglo-la-unica-forma-de-cruzar-el-rio-grande-de-loiza/' },
  S2: { title: 'Flickr, Julie Alicea — "El Ancon De Loiza – 1982"', url: 'https://www.flickr.com/photos/juliealicea/4857838050' },
  S3: { title: 'Torrech San Inocencio — "El muy antiguo Ancón de Loíza", El Adoquín (2025)', url: 'https://eladoquintimes.com/2025/07/31/el-muy-antiguo-ancon-de-loiza/' },
  S4: { title: 'Archivo Negro — collection "El Ancón de Loíza"', url: 'https://www.archivonegro.org/coleccion/el-ancon-en-loiza' },
  S5: { title: 'Mellon Foundation — "The Famed El Ancón Barge is Being Reimagined"', url: 'https://www.mellon.org/grant-story/famed-el-ancon-barge-reimagined-puerto-rico' },
  S6: { title: 'Archivo Negro — "Inauguración de la Casa Museo Cortijo"', url: 'https://www.archivonegro.org/post/inauguracion-de-la-casa-museo-cortijo-legado-historico-y-cultural-en-loiza-puerto-rico' },
  S7: { title: 'Miyamoto Relief — "Rebuilding El Ancón de Loíza"', url: 'https://www.miyamotorelief.org/causes/rebuilding-el-ancon-de-loiza-preserving-our-heritage/' },
  S8: { title: 'Revista Étnica — "Conversando sobre El Ancón de Loíza"', url: 'https://www.revistaetnica.com/blogs/news/conversando-sobre-el-ancon-de-loiza-y-su-impacto-historico-cultural-y-ambiental' },
  S9: { title: 'El Ancón de Loíza (Colectivo) — website', url: 'https://www.elancondeloiza.com/' },
  S11: { title: 'Revista Étnica — "El Ancón, su magia y honrar a las Anconeras"', url: 'https://www.revistaetnica.com/blogs/news/el-ancon-su-magia-y-honrar-a-las-anconeras' },
  S12: { title: 'Wikipedia — Loíza, Puerto Rico', url: 'https://en.wikipedia.org/wiki/Lo%C3%ADza,_Puerto_Rico' },
  S13: { title: 'Wikipedia — Río Grande de Loíza', url: 'https://en.wikipedia.org/wiki/R%C3%ADo_Grande_de_Lo%C3%ADza' },
  S14: { title: 'Wikipedia — Parroquia del Espíritu Santo y San Patricio', url: 'https://en.wikipedia.org/wiki/Parroquia_del_Esp%C3%ADritu_Santo_y_San_Patricio' },
  S15: { title: 'Wikipedia — Carraízo Dam', url: 'https://en.wikipedia.org/wiki/Carra%C3%ADzo_Dam' },
  S16: { title: 'Wikipedia — Loíza barrio-pueblo', url: 'https://en.wikipedia.org/wiki/Lo%C3%ADza_barrio-pueblo' },
  S17: { title: 'Primera Hora — DRNA manatee rescue (2026)', url: 'https://www.primerahora.com/noticias/gobierno-politica/notas/drna-encamina-rescate-de-dos-manaties-bebes-en-loiza/' },
  S21: { title: 'NOAA CO-OPS — San Juan 9755371 tidal datums', url: 'https://tidesandcurrents.noaa.gov/datums.html?id=9755371' },
  S22: { title: 'DRNA — Bosque Estatal de Piñones (2008)', url: 'https://www.drna.pr.gov/wp-content/uploads/2015/04/El-Bosque-Estatal-de-Pi%C3%B1ones.pdf' },
  S23: { title: 'Enciclopedia de Puerto Rico — Municipio de Loíza', url: 'https://enciclopediapr.org/content/municipio-de-loiza/' },
  S24: { title: 'Wikipedia — Climate of Puerto Rico', url: 'https://en.wikipedia.org/wiki/Climate_of_Puerto_Rico' },
  S26: { title: 'OpenStreetMap contributors (ODbL)', url: 'https://www.openstreetmap.org/way/204521442' },
  S27: { title: 'Primera Hora — "Loíza engalana el puente sobre su Río Grande"', url: 'https://www.primerahora.com/noticias/puerto-rico/notas/loiza-engalana-el-puente-sobre-su-rio-grande/' },
  S28: { title: 'Wikipedia — Piñones State Forest', url: 'https://en.wikipedia.org/wiki/Pi%C3%B1ones_State_Forest' },
  S30: { title: 'Wikipedia — Puerto Rico Highway 187', url: 'https://en.wikipedia.org/wiki/Puerto_Rico_Highway_187' },
};
```

```ts
// src/data/eras.ts
export type Confidence = 'H' | 'M' | 'L';
export interface Sourced<T> { value: T; sources: string[]; confidence: Confidence; inferred?: boolean }
export type EraId = '1840' | '1900' | '1925' | '1935' | '1959' | '1975' | '1984' | '1986';

export interface Era {
  id: EraId;
  label: string;
  years: string;
  /** Representative calendar date (for sun position). */
  date: string;
  summary: Sourced<string>;
  river: {
    /** Metres added to every river bank (pre-dam river was fuller). */
    bankOffset: Sourced<number>;
    /** Surface flow speed, m/s. */
    flow: Sourced<number>;
  };
}

const s = <T,>(value: T, sources: string[], confidence: Confidence, inferred = false): Sourced<T> =>
  inferred ? { value, sources, confidence, inferred } : { value, sources, confidence };

const PRE_DAM = { bankOffset: s(8, ['S3', 'S15'], 'L', true), flow: s(0.6, ['S3', 'S15'], 'L', true) };
const POST_DAM = { bankOffset: s(0, ['S26'], 'M'), flow: s(0.35, ['S15'], 'L', true) };

export const ERAS: Era[] = [
  { id: '1840', label: 'Colonial crossing', years: '1820s–1890s', date: '1840-03-15',
    summary: s('An official ancón de pasaje, ordered in 1824, carries walkers, carts and animals across a fuller river on the camino real.', ['S3'], 'H'),
    river: PRE_DAM },
  { id: '1900', label: 'Sugar era', years: '1900s–1910s', date: '1905-04-09',
    summary: s('The Iturregui sugar family runs the crossing for cane workers. A wooden barge is poled across.', ['S1', 'S3'], 'M'),
    river: PRE_DAM },
  { id: '1925', label: 'The Cortijo ancón', years: '1920s', date: '1925-07-26',
    summary: s('Pedro Cortijo buys the ancón in 1920. A plank platform, two mangrove poles, 10 cents a crossing.', ['S1', 'S4'], 'H'),
    river: PRE_DAM },
  { id: '1935', label: 'The ropes', years: '1930s–1940s', date: '1935-02-17',
    summary: s('Cars arrive. Two taut marine ropes span the river and two or three men haul the platform by hand.', ['S1', 'S4'], 'H'),
    river: PRE_DAM },
  { id: '1959', label: 'Públicos', years: '1950s', date: '1959-08-02',
    summary: s('The platform grows. Shared taxis (públicos) cross. Upstream, the Carraízo dam tames the river.', ['S1', 'S4', 'S15'], 'M'),
    river: POST_DAM },
  { id: '1975', label: 'Weekend outings', years: '1960s–1970s', date: '1975-07-27',
    summary: s('Families cross for the day. The Cortijo bar has a terrace over the river. About six cars per trip.', ['S1', 'S4'], 'H'),
    river: POST_DAM },
  { id: '1984', label: 'The steel barge', years: '1980–1986', date: '1984-02-17',
    summary: s('A steel-plate barge carries six to eight cars. Next door, the PR-187 bridge rises.', ['S1', 'S4'], 'H'),
    river: POST_DAM },
  { id: '1986', label: 'The bridge', years: '1986', date: '1986-02-17',
    summary: s('The Puente de la Restauración opened in 1985. Regular ancón service ends in 1986.', ['S1', 'S4', 'S27'], 'H'),
    river: POST_DAM },
];

export const ERA_IDS = ERAS.map((e) => e.id);
export const getEra = (id: EraId) => ERAS.find((e) => e.id === id)!;
```

```ts
// src/quality.ts
export type Quality = 'high' | 'medium' | 'low';
export interface QualitySettings {
  dpr: [number, number]; nearSize: number; farSize: number; reflScale: number; shadowMap: number; ao: boolean;
}
export const QUALITY: Record<Quality, QualitySettings> = {
  high: { dpr: [1, 2], nearSize: 512, farSize: 512, reflScale: 0.5, shadowMap: 4096, ao: true },
  medium: { dpr: [1, 1.5], nearSize: 384, farSize: 256, reflScale: 0.35, shadowMap: 2048, ao: true },
  low: { dpr: [1, 1], nearSize: 256, farSize: 192, reflScale: 0.25, shadowMap: 0, ao: false },
};

export function detectQuality(): Quality {
  if (typeof window === 'undefined') return 'high';
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (coarse && (cores <= 6 || mem <= 4)) return 'low';
  if (coarse || cores <= 4) return 'medium';
  return 'high';
}
```

```ts
// src/state/url.ts
import { ERA_IDS, type EraId } from '../data/eras';
import type { Quality } from '../quality';

export type CameraPreset = 'ride' | 'bank' | 'aerial' | 'mouth';
export const CAMERA_PRESETS: CameraPreset[] = ['ride', 'bank', 'aerial', 'mouth'];
export interface UrlState { eraId: EraId; timeOfDay: number; camera: CameraPreset; quality: Quality; debug: boolean; frozen: boolean }

export function parseUrlState(search: string): Partial<UrlState> {
  const p = new URLSearchParams(search);
  const out: Partial<UrlState> = {};
  const era = p.get('era');
  if (era && (ERA_IDS as string[]).includes(era)) out.eraId = era as EraId;
  const t = Number(p.get('t'));
  if (p.has('t') && Number.isFinite(t) && t >= 0 && t <= 24) out.timeOfDay = t;
  const cam = p.get('cam');
  if (cam && (CAMERA_PRESETS as string[]).includes(cam)) out.camera = cam as CameraPreset;
  const q = p.get('q');
  if (q === 'high' || q === 'medium' || q === 'low') out.quality = q;
  if (p.get('debug') === '1') out.debug = true;
  if (p.get('freeze') === '1') out.frozen = true;
  return out;
}

export function toSearch(s: Partial<UrlState>): string {
  const p = new URLSearchParams();
  if (s.eraId) p.set('era', s.eraId);
  if (s.timeOfDay !== undefined) p.set('t', String(s.timeOfDay));
  if (s.camera) p.set('cam', s.camera);
  if (s.quality) p.set('q', s.quality);
  if (s.debug) p.set('debug', '1');
  if (s.frozen) p.set('freeze', '1');
  return `?${p.toString()}`;
}
```

```ts
// src/state/store.ts
import { create } from 'zustand';
import { getEra, type EraId } from '../data/eras';
import { detectQuality, type Quality } from '../quality';
import { parseUrlState, type CameraPreset } from './url';

interface AppState {
  eraId: EraId; timeOfDay: number; camera: CameraPreset; quality: Quality; debug: boolean; frozen: boolean;
  setEra: (id: EraId) => void; setTime: (t: number) => void; setCamera: (c: CameraPreset) => void; setQuality: (q: Quality) => void;
}

const fromUrl = typeof window !== 'undefined' ? parseUrlState(window.location.search) : {};

export const useStore = create<AppState>((set) => ({
  eraId: '1975', timeOfDay: 17.4, camera: 'ride', quality: detectQuality(), debug: false, frozen: false,
  ...fromUrl,
  setEra: (eraId) => set({ eraId }),
  setTime: (timeOfDay) => set({ timeOfDay }),
  setCamera: (camera) => set({ camera }),
  setQuality: (quality) => set({ quality }),
}));

export const useEra = () => getEra(useStore((s) => s.eraId));
```

- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** (`feat(data): sourced eras, store, url state, quality tiers`).

---

### Task 4: Bake OpenStreetMap geography

**Files:**
- Create: `src/data/geo/types.ts`, `scripts/osm-parse.ts`, `scripts/bake-osm.ts`, `src/data/geo/loiza.json` (generated)
- Test: `scripts/osm-parse.test.ts`, `src/data/geo/loiza.test.ts`

**Interfaces:**
- Consumes: `project()` from Task 2.
- Produces:
  - `type XZ = [number, number]`
  - `interface GeoBundle { origin: {lat:number; lon:number}; water: { kind: 'river'|'pond'; ring: XZ[] }[]; land: { kind: LandKind; ring: XZ[] }[]; coastline: XZ[][]; roads: Road[] }`
  - `type LandKind = 'sand'|'wetland'|'wood'|'scrub'|'grassland'`
  - `interface Road { id: string; kind: string; name?: string; ref?: string; bridge: boolean; points: XZ[] }`
  - `parseOsm(xml: string, keepRoadsWithin: number): GeoBundle`

- [ ] **Step 1: Types**

```ts
// src/data/geo/types.ts
export type XZ = [number, number];
export type LandKind = 'sand' | 'wetland' | 'wood' | 'scrub' | 'grassland';
export interface Road { id: string; kind: string; name?: string; ref?: string; bridge: boolean; points: XZ[] }
export interface GeoBundle {
  origin: { lat: number; lon: number };
  water: { kind: 'river' | 'pond'; ring: XZ[] }[];
  land: { kind: LandKind; ring: XZ[] }[];
  coastline: XZ[][];
  roads: Road[];
}
```

- [ ] **Step 2: Failing parser test**

```ts
// scripts/osm-parse.test.ts
import { expect, test } from 'vitest';
import { parseOsm } from './osm-parse';

const XML = `<?xml version="1.0"?><osm>
<node id="1" lat="18.4340" lon="-65.8830"/><node id="2" lat="18.4340" lon="-65.8810"/>
<node id="3" lat="18.4360" lon="-65.8810"/><node id="4" lat="18.4360" lon="-65.8830"/>
<node id="5" lat="18.4400" lon="-65.8900"/><node id="6" lat="18.4400" lon="-65.8700"/>
<node id="7" lat="18.4000" lon="-65.8000"/><node id="8" lat="18.4001" lon="-65.8000"/>
<way id="10"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/><tag k="natural" v="water"/><tag k="water" v="river"/></way>
<way id="11"><nd ref="5"/><nd ref="6"/><tag k="natural" v="coastline"/></way>
<way id="12"><nd ref="1"/><nd ref="3"/><tag k="highway" v="primary"/><tag k="ref" v="PR-187"/><tag k="bridge" v="yes"/></way>
<way id="13"><nd ref="7"/><nd ref="8"/><tag k="highway" v="track"/></way>
<way id="14"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="natural" v="wetland"/></way>
<way id="15"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="natural" v="water"/><tag k="water" v="wastewater"/></way>
</osm>`;

test('parses water, coastline, land and nearby roads', () => {
  const g = parseOsm(XML, 2000);
  expect(g.water).toHaveLength(1);
  expect(g.water[0].kind).toBe('river');
  expect(g.water[0].ring.length).toBe(4); // closing node dropped
  expect(g.coastline).toHaveLength(1);
  expect(g.land.map((l) => l.kind)).toEqual(['wetland']);
  expect(g.roads).toHaveLength(1); // far track filtered out
  expect(g.roads[0]).toMatchObject({ ref: 'PR-187', bridge: true, kind: 'primary' });
});
```

- [ ] **Step 3: Run** `npm test` → FAIL.

- [ ] **Step 4: Implement parser and bake script**

```ts
// scripts/osm-parse.ts
import { XMLParser } from 'fast-xml-parser';
import { ORIGIN, project } from '../src/geo/project.ts';
import type { GeoBundle, LandKind, XZ } from '../src/data/geo/types.ts';

type Tagged = { tag?: { k: string; v: string }[] };
const LAND: Record<string, LandKind> = { sand: 'sand', wetland: 'wetland', wood: 'wood', scrub: 'scrub', grassland: 'grassland' };
const round = (p: XZ): XZ => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];

export function parseOsm(xml: string, keepRoadsWithin: number): GeoBundle {
  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: (n) => ['node', 'way', 'nd', 'tag', 'relation', 'member'].includes(n) }).parse(xml).osm;
  const nodes = new Map<string, XZ>();
  for (const n of doc.node ?? []) nodes.set(n.id, project(Number(n.lat), Number(n.lon)));
  const tags = (e: Tagged) => Object.fromEntries((e.tag ?? []).map((t) => [t.k, t.v]));
  const out: GeoBundle = { origin: { ...ORIGIN }, water: [], land: [], coastline: [], roads: [] };

  for (const w of doc.way ?? []) {
    const t = tags(w);
    const refs: string[] = (w.nd ?? []).map((n: { ref: string }) => n.ref);
    const pts = refs.map((r) => nodes.get(r)).filter((p): p is XZ => !!p).map(round);
    if (pts.length < 2) continue;
    const closed = refs.length > 3 && refs[0] === refs[refs.length - 1];
    const ring = closed ? pts.slice(0, -1) : pts;
    if (t.natural === 'coastline') out.coastline.push(pts);
    else if (t.natural === 'water' && closed && t.water !== 'wastewater') out.water.push({ kind: t.water === 'river' ? 'river' : 'pond', ring });
    else if (LAND[t.natural] && closed) out.land.push({ kind: LAND[t.natural], ring });
    else if (t.highway && pts.some(([x, z]) => Math.abs(x) < keepRoadsWithin && Math.abs(z) < keepRoadsWithin)) {
      out.roads.push({ id: w.id, kind: t.highway, ...(t.name ? { name: t.name } : {}), ...(t.ref ? { ref: t.ref } : {}), bridge: t.bridge === 'yes', points: pts });
    }
  }
  return out;
}
```

```ts
// scripts/bake-osm.ts — run with `npm run bake`
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseOsm } from './osm-parse.ts';

const BBOX = '-65.900,18.420,-65.865,18.450'; // minLon,minLat,maxLon,maxLat (OSM API limit: 0.25 deg², 50k nodes)
const CACHE = new URL('./.cache/osm.xml', import.meta.url);
const OUT = new URL('../src/data/geo/loiza.json', import.meta.url);

if (!existsSync(CACHE)) {
  await mkdir(new URL('./.cache/', import.meta.url), { recursive: true });
  const res = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${BBOX}`, {
    headers: { 'User-Agent': 'ancon-de-loiza/0.1 (+https://github.com/gabriel-rene/ancon-de-loiza)' },
  });
  if (!res.ok) throw new Error(`OSM API ${res.status}`);
  await writeFile(CACHE, await res.text());
}
const geo = parseOsm(await readFile(CACHE, 'utf8'), 1600);
await writeFile(OUT, JSON.stringify(geo));
console.log(`water ${geo.water.length} · land ${geo.land.length} · coast ${geo.coastline.length} · roads ${geo.roads.length}`);
```

Add `scripts/.cache/` to `.gitignore`. Run `npm run bake`.

- [ ] **Step 5: Test the real data**

```ts
// src/data/geo/loiza.test.ts
import { expect, test } from 'vitest';
import geo from './loiza.json';
import type { GeoBundle } from './types';

const g = geo as unknown as GeoBundle;

test('has the river polygon and coastline', () => {
  expect(g.water.some((w) => w.kind === 'river' && w.ring.length > 100)).toBe(true);
  expect(g.coastline.length).toBeGreaterThanOrEqual(3);
});
test('has the PR-187 bridge near the crossing', () => {
  const bridge = g.roads.find((r) => r.bridge && r.ref?.includes('187'));
  expect(bridge).toBeDefined();
  expect(Math.min(...bridge!.points.map(([x, z]) => Math.hypot(x, z)))).toBeLessThan(200);
});
test('bundle stays small', () => {
  expect(JSON.stringify(g).length).toBeLessThan(1_500_000);
});
```

Run `npm test` → PASS. If the size test fails, lower `keepRoadsWithin` to 1300.

- [ ] **Step 6: Commit** (`feat(geo): bake OSM geography for the crossing`). Include `loiza.json`. Add "Map data © OpenStreetMap contributors (ODbL)" to README Acknowledgements.

---

### Task 5: Terrain fields (water classes, shore distance, heights)

**Files:**
- Create: `src/terrain/noise.ts`, `src/terrain/raster.ts`, `src/terrain/edt.ts`, `src/terrain/fields.ts`
- Test: `src/terrain/raster.test.ts`, `src/terrain/edt.test.ts`, `src/terrain/fields.test.ts`

**Interfaces:**
- Consumes: `GeoBundle` (Task 4), `project` (Task 2).
- Produces:
  - `fbm(x, z, octaves?): number` in [0,1]
  - `interface Grid { size: number; cell: number; minX: number; minZ: number }`; `makeGrid(extent, size): Grid`
  - `fillPolygon(g, out: Uint8Array, ring: XZ[], value: number)`; `drawPolyline(g, out, pts: XZ[], value)`; `floodFill(g, out: Uint8Array, blocked: (idx:number)=>boolean, seedIdx: number, value: number)`
  - `distanceTransform(mask: Uint8Array, w: number, h: number): Float32Array` (cells; 0 where mask=1)
  - `WATER = { LAND: 0, RIVER: 1, SEA: 2, POND: 3 }`; `LANDCLS = { NONE: 0, SAND: 1, WETLAND: 2, WOOD: 3, SCRUB: 4, GRASS: 5 }`
  - `interface WorldFields { grid: Grid; water: Uint8Array; landCls: Uint8Array; shore: Float32Array; seaDist: Float32Array; height: Float32Array; info: Uint8Array /* RGBA terrain weights */; waterInfo: Uint8Array /* RGBA water params */ }`
  - `buildFields(geo, { extent, size, bankOffset }): WorldFields`; `sampleField(f: WorldFields, arr: Float32Array, x, z): number` (bilinear)
  - `SEA_SEED: XZ = project(18.444, -65.874)`

- [ ] **Step 1: Failing tests**

```ts
// src/terrain/raster.test.ts
import { expect, test } from 'vitest';
import { drawPolyline, fillPolygon, floodFill, makeGrid } from './raster';

test('fills a square polygon', () => {
  const g = makeGrid(10, 10); // 1 m cells, -5..5
  const out = new Uint8Array(100);
  fillPolygon(g, out, [[-2, -2], [2, -2], [2, 2], [-2, 2]], 1);
  expect(out.reduce((a, b) => a + b, 0)).toBe(16);
});
test('flood fill stops at a wall', () => {
  const g = makeGrid(10, 10);
  const wall = new Uint8Array(100);
  drawPolyline(g, wall, [[-6, 0.2], [6, 0.2]], 1);
  const out = new Uint8Array(100);
  floodFill(g, out, (i) => wall[i] === 1, 0, 2); // seed top-left (north)
  expect(out[0]).toBe(2);
  expect(out[99]).toBe(0); // south of the wall untouched
});
```

```ts
// src/terrain/edt.test.ts
import { expect, test } from 'vitest';
import { distanceTransform } from './edt';

test('distance to a single seed', () => {
  const w = 7, h = 5, m = new Uint8Array(w * h);
  m[2 * w + 3] = 1;
  const d = distanceTransform(m, w, h);
  expect(d[2 * w + 3]).toBe(0);
  expect(d[2 * w + 6]).toBeCloseTo(3, 5);
  expect(d[0]).toBeCloseTo(Math.hypot(3, 2), 5);
});
```

```ts
// src/terrain/fields.test.ts
import { describe, expect, test } from 'vitest';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { landmarkXZ } from '../data/landmarks';
import { buildFields, sampleField, WATER, SEA_SEED } from './fields';

const f = buildFields(geo as unknown as GeoBundle, { extent: 2560, size: 256, bankOffset: 0 });
const at = (arr: Float32Array | Uint8Array, [x, z]: [number, number]) => {
  const i = Math.floor((x - f.grid.minX) / f.grid.cell), j = Math.floor((z - f.grid.minZ) / f.grid.cell);
  return arr[j * f.grid.size + i];
};

describe('real fields', () => {
  test('crossing midpoint is river, ≥1 m deep', () => {
    expect(at(f.water, [0, 0])).toBe(WATER.RIVER);
    expect(sampleField(f, f.height, 0, 0)).toBeLessThan(-1);
  });
  test('open sea off the mouth', () => expect(at(f.water, SEA_SEED)).toBe(WATER.SEA));
  test('town plaza is dry land above 0.5 m', () => {
    const p = landmarkXZ('plaza');
    expect(at(f.water, p)).toBe(WATER.LAND);
    expect(sampleField(f, f.height, ...p)).toBeGreaterThan(0.5);
  });
  test('shore distance is negative in water, positive on land', () => {
    expect(at(f.shore, [0, 0])).toBeLessThan(0);
    expect(at(f.shore, landmarkXZ('church'))).toBeGreaterThan(0);
  });
  test('bankOffset widens the river', () => {
    const wide = buildFields(geo as unknown as GeoBundle, { extent: 2560, size: 256, bankOffset: 10 });
    const count = (w: Uint8Array) => w.reduce((n, v) => n + (v === WATER.RIVER ? 1 : 0), 0);
    expect(count(wide.water)).toBeGreaterThan(count(f.water));
  });
});
```

- [ ] **Step 2: Run** `npm test` → FAIL.

- [ ] **Step 3: Implement**

```ts
// src/terrain/noise.ts
function hash(ix: number, iz: number) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
export function valueNoise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  const top = a + (b - a) * u, bot = c + (d - c) * u;
  return top + (bot - top) * v;
}
/** Fractal value noise in [0,1]. */
export function fbm(x: number, z: number, octaves = 4) {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < octaves; i++) { s += amp * valueNoise(x * f, z * f); n += amp; amp *= 0.5; f *= 2.03; }
  return s / n;
}
```

```ts
// src/terrain/raster.ts
import type { XZ } from '../data/geo/types';

export interface Grid { size: number; cell: number; minX: number; minZ: number }
export const makeGrid = (extent: number, size: number): Grid => ({ size, cell: extent / size, minX: -extent / 2, minZ: -extent / 2 });

/** Even-odd scanline fill of a closed ring. */
export function fillPolygon(g: Grid, out: Uint8Array, ring: XZ[], value: number) {
  const n = ring.length;
  for (let j = 0; j < g.size; j++) {
    const zc = g.minZ + (j + 0.5) * g.cell;
    const xs: number[] = [];
    for (let k = 0; k < n; k++) {
      const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % n];
      if ((az <= zc && bz > zc) || (bz <= zc && az > zc)) xs.push(ax + ((zc - az) / (bz - az)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - g.minX) / g.cell - 0.5));
      const i1 = Math.min(g.size - 1, Math.floor((xs[k + 1] - g.minX) / g.cell - 0.5));
      for (let i = i0; i <= i1; i++) out[j * g.size + i] = value;
    }
  }
}

/** 8-connected polyline raster (blocks 4-connected flood fills). */
export function drawPolyline(g: Grid, out: Uint8Array, pts: XZ[], value: number) {
  const step = g.cell * 0.5;
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / step));
    for (let s = 0; s <= n; s++) {
      const x = ax + ((bx - ax) * s) / n, z = az + ((bz - az) * s) / n;
      const i = Math.floor((x - g.minX) / g.cell), j = Math.floor((z - g.minZ) / g.cell);
      if (i >= 0 && j >= 0 && i < g.size && j < g.size) out[j * g.size + i] = value;
    }
  }
}

/** 4-connected flood fill from seedIdx into cells where out==0 and !blocked. */
export function floodFill(g: Grid, out: Uint8Array, blocked: (idx: number) => boolean, seedIdx: number, value: number) {
  const stack = [seedIdx];
  while (stack.length) {
    const idx = stack.pop()!;
    if (out[idx] !== 0 || blocked(idx)) continue;
    out[idx] = value;
    const i = idx % g.size, j = (idx - i) / g.size;
    if (i > 0) stack.push(idx - 1);
    if (i < g.size - 1) stack.push(idx + 1);
    if (j > 0) stack.push(idx - g.size);
    if (j < g.size - 1) stack.push(idx + g.size);
  }
}
```

```ts
// src/terrain/edt.ts — Felzenszwalb & Huttenlocher exact Euclidean distance transform
const INF = 1e20;

function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dq = q - v[k];
    d[q] = dq * dq + f[v[k]];
  }
}

/** Distance (in cells) from every cell to the nearest cell with mask=1. */
export function distanceTransform(mask: Uint8Array, w: number, h: number): Float32Array {
  const n = Math.max(w, h);
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = mask[i] ? 0 : INF;
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = Math.sqrt(grid[i]);
  return out;
}
```

```ts
// src/terrain/fields.ts
import type { GeoBundle, LandKind, XZ } from '../data/geo/types';
import { project } from '../geo/project';
import { distanceTransform } from './edt';
import { fbm } from './noise';
import { drawPolyline, fillPolygon, floodFill, makeGrid, type Grid } from './raster';

export const WATER = { LAND: 0, RIVER: 1, SEA: 2, POND: 3 } as const;
export const LANDCLS = { NONE: 0, SAND: 1, WETLAND: 2, WOOD: 3, SCRUB: 4, GRASS: 5 } as const;
const LAND_VALUE: Record<LandKind, number> = { sand: 1, wetland: 2, wood: 3, scrub: 4, grassland: 5 };
export const SEA_SEED: XZ = project(18.444, -65.874);

export interface WorldFields {
  grid: Grid;
  water: Uint8Array; landCls: Uint8Array;
  /** Signed distance to shoreline, metres. Negative in water. */
  shore: Float32Array;
  /** Distance to open sea, metres (0 in the sea). */
  seaDist: Float32Array;
  height: Float32Array;
  /** RGBA8 per cell: R sand, G mud/wet, B forest, A 255. */
  info: Uint8Array;
  /** RGBA8 per cell: R depth/15m, G river(255)/pond(128)/sea(0), B shore distance/60m, A 255. */
  waterInfo: Uint8Array;
}

export function buildFields(geo: GeoBundle, opts: { extent: number; size: number; bankOffset: number }): WorldFields {
  const g = makeGrid(opts.extent, opts.size);
  const N = g.size * g.size;
  const water = new Uint8Array(N);
  for (const w of geo.water) fillPolygon(g, water, w.ring, w.kind === 'river' ? WATER.RIVER : WATER.POND);

  if (opts.bankOffset > 0) {
    const riverMask = new Uint8Array(N);
    for (let i = 0; i < N; i++) riverMask[i] = water[i] === WATER.RIVER ? 1 : 0;
    const d = distanceTransform(riverMask, g.size, g.size);
    for (let i = 0; i < N; i++) if (water[i] === WATER.LAND && d[i] * g.cell <= opts.bankOffset) water[i] = WATER.RIVER;
  }

  const walls = new Uint8Array(N);
  for (const line of geo.coastline) drawPolyline(g, walls, line, 1);
  const si = Math.floor((SEA_SEED[0] - g.minX) / g.cell), sj = Math.floor((SEA_SEED[1] - g.minZ) / g.cell);
  const sea = new Uint8Array(N);
  floodFill(g, sea, (i) => walls[i] === 1 || water[i] !== WATER.LAND, sj * g.size + si, 1);
  for (let i = 0; i < N; i++) if (sea[i]) water[i] = WATER.SEA;

  const landCls = new Uint8Array(N);
  for (const l of geo.land) fillPolygon(g, landCls, l.ring, LAND_VALUE[l.kind]);

  const isWater = new Uint8Array(N), isLand = new Uint8Array(N), isSea = new Uint8Array(N);
  for (let i = 0; i < N; i++) { isWater[i] = water[i] ? 1 : 0; isLand[i] = water[i] ? 0 : 1; isSea[i] = water[i] === WATER.SEA ? 1 : 0; }
  const toWater = distanceTransform(isWater, g.size, g.size);
  const toLand = distanceTransform(isLand, g.size, g.size);
  const toSea = distanceTransform(isSea, g.size, g.size);

  const shore = new Float32Array(N), seaDist = new Float32Array(N), height = new Float32Array(N);
  const info = new Uint8Array(N * 4), waterInfo = new Uint8Array(N * 4);
  for (let j = 0; j < g.size; j++) for (let i = 0; i < g.size; i++) {
    const k = j * g.size + i;
    const x = g.minX + (i + 0.5) * g.cell, z = g.minZ + (j + 0.5) * g.cell;
    const s = water[k] ? -toLand[k] * g.cell : toWater[k] * g.cell;
    shore[k] = s;
    seaDist[k] = toSea[k] * g.cell;
    height[k] = water[k] ? -waterDepth(water[k], -s) : landHeight(s, seaDist[k], landCls[k], x, z);

    const sand = landCls[k] === LANDCLS.SAND || (seaDist[k] < 70 && height[k] < 2.5) ? 1 : 0;
    const mud = landCls[k] === LANDCLS.WETLAND ? 0.7 : water[k] === WATER.LAND && s < 6 && seaDist[k] > 40 ? 1 - s / 6 : 0;
    const forest = landCls[k] === LANDCLS.WOOD || landCls[k] === LANDCLS.SCRUB ? 0.85 : 0;
    info.set([sand * 255, mud * 255, forest * 255, 255], k * 4);
    const kind = water[k] === WATER.RIVER ? 255 : water[k] === WATER.POND ? 128 : 0;
    waterInfo.set([Math.min(255, (Math.max(0, -height[k]) / 15) * 255), kind, Math.min(255, (Math.abs(s) / 60) * 255), 255], k * 4);
  }
  return { grid: g, water, landCls, shore, seaDist, height, info, waterInfo };
}

function landHeight(s: number, seaDist: number, cls: number, x: number, z: number) {
  let h = 0.5 + 2.6 * (1 - Math.exp(-s / 70)) + (fbm(x * 0.01, z * 0.01) - 0.5) * 1.2 * Math.min(1, s / 25);
  if (seaDist < 90) {
    const t = 1 - seaDist / 90;
    const beach = 0.15 + seaDist * 0.03 + 1.6 * fbm(x * 0.03 + 7, z * 0.03) ** 2 * Math.min(1, seaDist / 15);
    h = h * (1 - t) + beach * t;
  }
  if (cls === LANDCLS.WETLAND) h = Math.min(h, 0.35 + 0.15 * fbm(x * 0.05, z * 0.05));
  return Math.max(h, 0.12);
}

function waterDepth(kind: number, d: number) {
  if (kind === WATER.RIVER) return 0.35 + 2.8 * (1 - Math.exp(-d / 22));
  if (kind === WATER.SEA) return 0.3 + 14 * (1 - Math.exp(-d / 300));
  return 0.8;
}

/** Bilinear sample of a per-cell array at world x,z. */
export function sampleField(f: WorldFields, arr: Float32Array, x: number, z: number) {
  const { size, cell, minX, minZ } = f.grid;
  const fx = Math.min(size - 1.001, Math.max(0, (x - minX) / cell - 0.5));
  const fz = Math.min(size - 1.001, Math.max(0, (z - minZ) / cell - 0.5));
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const a = arr[j * size + i], b = arr[j * size + i + 1], c = arr[(j + 1) * size + i], d = arr[(j + 1) * size + i + 1];
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
```

- [ ] **Step 4: Run** `npm test` → PASS. If "crossing midpoint is river" fails, print `at(f.water,[0,0])` and the nearest river cell; the research landing coordinates are (M) confidence — adjust `ORIGIN` to the true channel centre between the two landings and note the change in the research doc.
- [ ] **Step 5: Commit** (`feat(terrain): water classes, shore distance, height fields`).

---

### Task 6: Terrain rendering (near + far) with procedural material

**Files:**
- Create: `src/scene/glsl/noise.ts`, `src/scene/terrainMaterial.ts`, `src/scene/useWorldFields.ts`, `src/scene/Terrain.tsx`, `src/scene/World.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `buildFields`, `WorldFields`, `QUALITY`, `useStore`, `useEra`.
- Produces: `SNOISE_GLSL: string` (defines `float snoise(vec2)`); `useWorldFields(): { near: WorldFields; far: WorldFields }`; `makeInfoTexture(data: Uint8Array, size: number): THREE.DataTexture`; `<Terrain near far/>`; `<World/>`.

- [ ] **Step 1: GLSL noise**

```ts
// src/scene/glsl/noise.ts — Ashima Arts 2D simplex noise (MIT)
export const SNOISE_GLSL = /* glsl */ `
vec3 sn_mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 sn_mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 sn_permute(vec3 x){return sn_mod289(((x*34.0)+10.0)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1;
  i=sn_mod289(i);
  vec3 p=sn_permute(sn_permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m; m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0; vec3 h=abs(x)-0.5; vec3 ox=floor(x+0.5); vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}`;
```

- [ ] **Step 2: Fields hook + textures**

```ts
// src/scene/useWorldFields.ts
import { useMemo } from 'react';
import * as THREE from 'three';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { QUALITY } from '../quality';
import { useEra, useStore } from '../state/store';
import { buildFields } from '../terrain/fields';

export const NEAR_EXTENT = 2560;
export const FAR_EXTENT = 10240;

export function useWorldFields() {
  const era = useEra();
  const q = QUALITY[useStore((s) => s.quality)];
  const bank = era.river.bankOffset.value;
  return useMemo(() => ({
    near: buildFields(geo as unknown as GeoBundle, { extent: NEAR_EXTENT, size: q.nearSize, bankOffset: bank }),
    far: buildFields(geo as unknown as GeoBundle, { extent: FAR_EXTENT, size: q.farSize, bankOffset: bank }),
  }), [bank, q.nearSize, q.farSize]);
}

export function makeInfoTexture(data: Uint8Array, size: number) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}
```

- [ ] **Step 3: Terrain material**

```ts
// src/scene/terrainMaterial.ts
import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { SNOISE_GLSL } from './glsl/noise';

export function makeTerrainMaterial(info: THREE.Texture, rect: THREE.Vector4) {
  return new CustomShaderMaterial({
    baseMaterial: THREE.MeshStandardMaterial,
    uniforms: { uInfo: { value: info }, uRect: { value: rect } },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec3 vNw;
      void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; vNw = normalize(mat3(modelMatrix) * normal); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uInfo; uniform vec4 uRect;
      varying vec3 vW; varying vec3 vNw;
      ${SNOISE_GLSL}
      void main(){
        vec4 m = texture2D(uInfo, (vW.xz - uRect.xy) / uRect.z);
        float n = snoise(vW.xz * 0.06) * 0.5 + 0.5;
        float n2 = snoise(vW.xz * 0.7) * 0.5 + 0.5;
        float n3 = snoise(vW.xz * 3.1) * 0.5 + 0.5;
        vec3 grass = mix(vec3(0.16,0.21,0.07), vec3(0.29,0.31,0.11), n) * mix(0.85, 1.1, n3);
        vec3 forest = vec3(0.07,0.10,0.04) * mix(0.8, 1.2, n2);
        vec3 sand = mix(vec3(0.66,0.58,0.42), vec3(0.78,0.71,0.54), n2) * mix(0.92, 1.05, n3);
        vec3 mud = mix(vec3(0.16,0.13,0.09), vec3(0.26,0.21,0.14), n2);
        vec3 c = grass;
        c = mix(c, forest, m.b);
        c = mix(c, sand, m.r);
        c = mix(c, mud, m.g);
        float wet = 1.0 - smoothstep(0.05, 0.7, vW.y);
        c *= mix(1.0, 0.5, wet);
        float slope = 1.0 - clamp(vNw.y, 0.0, 1.0);
        c = mix(c, mud * 1.2, smoothstep(0.2, 0.55, slope) * (1.0 - m.r));
        csm_DiffuseColor = vec4(c, 1.0);
        csm_Roughness = mix(0.95, 0.3, wet);
      }`,
  });
}
```

- [ ] **Step 4: Terrain component**

```tsx
// src/scene/Terrain.tsx
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { WorldFields } from '../terrain/fields';
import { makeTerrainMaterial } from './terrainMaterial';
import { makeInfoTexture } from './useWorldFields';

function buildGeometry(f: WorldFields, holeHalf = 0) {
  const { size, cell, minX } = f.grid;
  const span = cell * (size - 1);
  const geom = new THREE.PlaneGeometry(span, span, size - 1, size - 1);
  geom.rotateX(-Math.PI / 2);
  geom.translate(minX + cell / 2 + span / 2, 0, minX + cell / 2 + span / 2);
  const pos = geom.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < pos.count; k++) {
    let y = f.height[k];
    const x = pos.getX(k), z = pos.getZ(k);
    if (holeHalf > 0 && Math.abs(x) < holeHalf && Math.abs(z) < holeHalf) y -= 40; // hidden under near terrain
    pos.setY(k, y);
  }
  geom.computeVertexNormals();
  return geom;
}

function TerrainMesh({ f, holeHalf = 0, shadows }: { f: WorldFields; holeHalf?: number; shadows: boolean }) {
  const { geom, mat } = useMemo(() => {
    const extent = f.grid.cell * f.grid.size;
    const tex = makeInfoTexture(f.info, f.grid.size);
    return { geom: buildGeometry(f, holeHalf), mat: makeTerrainMaterial(tex, new THREE.Vector4(f.grid.minX, f.grid.minZ, extent, 0)) };
  }, [f, holeHalf]);
  useEffect(() => () => { geom.dispose(); mat.dispose(); }, [geom, mat]);
  return <mesh geometry={geom} material={mat} receiveShadow={shadows} castShadow={false} />;
}

export function Terrain({ near, far, shadows }: { near: WorldFields; far: WorldFields; shadows: boolean }) {
  const holeHalf = (near.grid.cell * near.grid.size) / 2 - 20;
  return (
    <group>
      <TerrainMesh f={near} shadows={shadows} />
      <TerrainMesh f={far} holeHalf={holeHalf} shadows={false} />
    </group>
  );
}
```

- [ ] **Step 5: World + App wiring (temporary light so terrain is visible)**

```tsx
// src/scene/World.tsx
import { QUALITY } from '../quality';
import { useStore } from '../state/store';
import { Terrain } from './Terrain';
import { useWorldFields } from './useWorldFields';

export function World() {
  const { near, far } = useWorldFields();
  const q = QUALITY[useStore((s) => s.quality)];
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[-300, 200, 400]} intensity={2} />
      <Terrain near={near} far={far} shadows={q.shadowMap > 0} />
    </>
  );
}
```

```tsx
// src/App.tsx
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { QUALITY } from './quality';
import { World } from './scene/World';
import { useStore } from './state/store';

export function App() {
  const q = QUALITY[useStore((s) => s.quality)];
  return (
    <Canvas dpr={q.dpr} shadows={q.shadowMap > 0} camera={{ fov: 42, near: 0.5, far: 40000, position: [600, 450, 700] }}>
      <color attach="background" args={['#9fb3c2']} />
      <World />
      <OrbitControls target={[0, 0, 0]} />
    </Canvas>
  );
}
```

- [ ] **Step 6: Verify visually.** `npm run dev`, open `http://localhost:5173/ancon-de-loiza/`. Expect: flat coastal plain, a dark river channel running SW→NE into the sea, sand along the coast, wetland patches. Take a screenshot with the browser pane. `npm test` and `npm run build` must pass.
- [ ] **Step 7: Commit** (`feat(scene): near/far terrain from OSM fields`).

---

### Task 7: Sky, sun light, shadows, distant mountains

**Files:**
- Create: `src/scene/useSun.ts`, `src/scene/SkyAndLight.tsx`, `src/scene/Backdrop.tsx`
- Modify: `src/scene/World.tsx` (replace temporary lights)

**Interfaces:**
- Consumes: `sunAt`, `sunDirection`, `atmosphereFor`, `useEra`, `useStore`, `fbm`, `QUALITY`.
- Produces: `useSun(): { dir: THREE.Vector3; elevation: number; atm: Atmosphere }`; `<SkyAndLight sun shadowMap/>`; `<Backdrop/>`.

- [ ] **Step 1: `useSun`**

```ts
// src/scene/useSun.ts
import { useMemo } from 'react';
import * as THREE from 'three';
import { atmosphereFor } from '../geo/atmosphere';
import { sunAt, sunDirection } from '../geo/sun';
import { useEra, useStore } from '../state/store';

export function useSun() {
  const era = useEra();
  const t = useStore((s) => s.timeOfDay);
  return useMemo(() => {
    const s = sunAt(era.date, t);
    return { dir: new THREE.Vector3(...sunDirection(s.azimuth, s.elevation)), elevation: s.elevation, atm: atmosphereFor(s.elevation) };
  }, [era.date, t]);
}
export type Sun = ReturnType<typeof useSun>;
```

- [ ] **Step 2: Sky and light**

```tsx
// src/scene/SkyAndLight.tsx
import { Environment, Sky } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Sun } from './useSun';

const FOCUS = new THREE.Vector3(0, 0, 0);

export function SkyAndLight({ sun, shadowMap }: { sun: Sun; shadowMap: number }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  const skyPos = sun.dir.clone().multiplyScalar(10000);
  const { atm } = sun;

  useEffect(() => { scene.environmentIntensity = atm.envIntensity; }, [scene, atm.envIntensity]);
  useEffect(() => {
    const l = light.current!;
    l.position.copy(FOCUS).addScaledVector(sun.dir, 1500);
    l.target.position.copy(FOCUS);
    l.target.updateMatrixWorld();
  }, [sun.dir]);

  const skyProps = { distance: 30000, sunPosition: skyPos, turbidity: atm.turbidity, rayleigh: atm.rayleigh, mieCoefficient: 0.006, mieDirectionalG: 0.86 };
  const envKey = `${sun.dir.x.toFixed(2)}${sun.dir.y.toFixed(2)}${sun.dir.z.toFixed(2)}`;

  return (
    <>
      <Sky {...skyProps} />
      <Environment key={envKey} resolution={128} frames={1}>
        <Sky {...skyProps} />
      </Environment>
      <directionalLight
        ref={light}
        color={new THREE.Color(...atm.sunColor)}
        intensity={atm.sunIntensity}
        castShadow={shadowMap > 0}
        shadow-mapSize={[shadowMap || 1, shadowMap || 1]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
        shadow-camera-left={-350} shadow-camera-right={350}
        shadow-camera-top={350} shadow-camera-bottom={-350}
        shadow-camera-near={10} shadow-camera-far={4000}
      />
    </>
  );
}
```

- [ ] **Step 3: Backdrop (Sierra de Luquillo to the SE, low foothills south)**

```tsx
// src/scene/Backdrop.tsx
import { useMemo } from 'react';
import * as THREE from 'three';
import { fbm } from '../terrain/noise';

/** A vertical ridge strip along an arc. Bearings in degrees from north, clockwise. */
function ridge(b0: number, b1: number, dist: (b: number) => number, height: (b: number, k: number) => number, segs = 240) {
  const pos: number[] = [], idx: number[] = [];
  for (let k = 0; k <= segs; k++) {
    const b = b0 + ((b1 - b0) * k) / segs, r = (b * Math.PI) / 180, d = dist(b);
    const x = Math.sin(r) * d, z = -Math.cos(r) * d;
    pos.push(x, -60, z, x, height(b, k), z);
    if (k < segs) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function Backdrop() {
  const { luquillo, foothills, mat, matNear } = useMemo(() => ({
    // El Yunque ≈ 1,065 m at ≈ 17 km, bearing ≈ 145° (landmarks.elYunque).
    luquillo: ridge(100, 190, (b) => 16500 + 2500 * fbm(b * 0.05, 1),
      (b, k) => 120 + 1000 * Math.exp(-(((b - 145) / 16) ** 2)) + 520 * fbm(k * 0.09, 3) * Math.exp(-(((b - 145) / 32) ** 2))),
    foothills: ridge(110, 250, (b) => 7000 + 1200 * fbm(b * 0.08, 5), (_b, k) => 40 + 140 * fbm(k * 0.15, 9)),
    mat: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.18, 0.24, 0.28), side: THREE.DoubleSide }),
    matNear: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.08, 0.12, 0.08), side: THREE.DoubleSide }),
  }), []);
  return (
    <>
      <mesh geometry={luquillo} material={mat} />
      <mesh geometry={foothills} material={matNear} />
    </>
  );
}
```

- [ ] **Step 4: Wire into World** — replace the temporary lights:

```tsx
// src/scene/World.tsx (replace body)
export function World() {
  const { near, far } = useWorldFields();
  const q = QUALITY[useStore((s) => s.quality)];
  const sun = useSun();
  return (
    <>
      <SkyAndLight sun={sun} shadowMap={q.shadowMap} />
      <Backdrop />
      <Terrain near={near} far={far} shadows={q.shadowMap > 0} />
    </>
  );
}
```

Remove `<color attach="background">` from `App.tsx`. Add renderer settings on the Canvas: `gl={{ antialias: false, powerPreference: 'high-performance' }}`, `onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; }}` (temporary until Task 9 moves tone mapping to post).

- [ ] **Step 5: Verify.** In dev, try `?t=6.2`, `?t=12`, `?t=17.6`. Expect warm low sun at 17.6, the Luquillo silhouette to the SE, no console errors. Screenshot. `npm test`, `npm run build` pass.
- [ ] **Step 6: Commit** (`feat(scene): physical sun, sky, environment light, Luquillo backdrop`).

---

### Task 8: Water (river + sea) with reflections and flow

**Files:**
- Create: `src/scene/water/waterShader.ts`, `src/scene/water/Water.tsx`
- Modify: `src/scene/World.tsx`

**Interfaces:**
- Consumes: `WorldFields.waterInfo`, `makeInfoTexture`, `Sun`, `QUALITY.reflScale`, `SNOISE_GLSL`, `era.river.flow`.
- Produces: `<Water near far sun flow reflScale frozen/>`.

River direction: the lower river runs SW→NE (research §1.1), so flow vector in world XZ = normalize(+1, -1) (east, north).
Trade winds: from the ENE, so wind-driven sea ripples travel toward WSW: normalize(-1, 0.35).

- [ ] **Step 1: Shader**

```ts
// src/scene/water/waterShader.ts
import { SNOISE_GLSL } from '../glsl/noise';

export const waterVertex = /* glsl */ `
uniform mat4 textureMatrix;
varying vec4 vReflUv;
varying vec3 vWorld;
void main() {
  vReflUv = textureMatrix * vec4(position, 1.0);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const waterFragment = /* glsl */ `
uniform vec3 color;
uniform sampler2D tDiffuse;
uniform sampler2D uNearInfo; uniform vec4 uNearRect;
uniform sampler2D uFarInfo;  uniform vec4 uFarRect;
uniform float uTime;
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uSunIntensity;
uniform vec2 uRiverFlow; uniform vec2 uWind;
varying vec4 vReflUv;
varying vec3 vWorld;
${SNOISE_GLSL}

vec4 waterInfo(vec2 p) {
  vec2 a = (p - uNearRect.xy) / uNearRect.z;
  if (all(greaterThan(a, vec2(0.003))) && all(lessThan(a, vec2(0.997)))) return texture2D(uNearInfo, a);
  vec2 b = (p - uFarRect.xy) / uFarRect.z;
  if (all(greaterThan(b, vec2(0.0))) && all(lessThan(b, vec2(1.0)))) return texture2D(uFarInfo, b);
  return vec4(1.0, 0.0, 1.0, 1.0);
}

vec2 grad(vec2 p) {
  const float e = 0.06;
  return vec2(snoise(p + vec2(e, 0.0)) - snoise(p - vec2(e, 0.0)), snoise(p + vec2(0.0, e)) - snoise(p - vec2(0.0, e))) / (2.0 * e);
}

vec3 waterNormal(vec2 p, float river, float dist) {
  vec2 flow = mix(uWind * 0.8, uRiverFlow, river);
  float fade = 1.0 - smoothstep(150.0, 1500.0, dist);           // calmer-looking far away (less aliasing)
  vec2 g = grad(p * 0.045 - flow * uTime * 0.05) * 0.9
         + grad(p * 0.23 - flow * uTime * 0.23 + 3.1) * 0.35
         + grad(p * 1.1  - flow * uTime * 1.0 + 7.7) * 0.14 * fade
         + grad(p * 3.9  - flow * uTime * 2.6 + 1.3) * 0.06 * fade;
  float amp = mix(0.55, 0.22, river);
  return normalize(vec3(-g.x * amp, 1.0, -g.y * amp));
}

void main() {
  vec4 inf = waterInfo(vWorld.xz);
  float depth = inf.r * 15.0;
  float river = step(0.7, inf.g);
  float shore = inf.b * 60.0;
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec3 n = waterNormal(vWorld.xz, river, dist);

  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  vec2 ruv = vReflUv.xy / vReflUv.w + n.xz * 0.035;
  vec3 refl = texture2D(tDiffuse, ruv).rgb;

  float sunUp = clamp(uSunDir.y * 4.0, 0.0, 1.0);
  vec3 riverBody = mix(vec3(0.20, 0.16, 0.09), vec3(0.035, 0.045, 0.03), 1.0 - exp(-depth * 0.7));
  vec3 seaBody = mix(vec3(0.08, 0.36, 0.34), vec3(0.01, 0.07, 0.13), 1.0 - exp(-depth * 0.22));
  vec3 body = mix(seaBody, riverBody, river) * (0.15 + 0.85 * sunUp) * mix(vec3(1.0), uSunColor, 0.5);

  vec3 H = normalize(uSunDir + V);
  float nh = max(dot(n, H), 0.0);
  vec3 spec = uSunColor * uSunIntensity * (pow(nh, 600.0) * 3.0 + pow(nh, 60.0) * 0.08) * sunUp;

  vec3 col = mix(body, refl, fres) + spec;

  float band = 1.0 - smoothstep(0.0, mix(7.0, 1.2, river), shore);
  float fn = snoise(vWorld.xz * 0.5 + uTime * vec2(0.25, 0.18)) * 0.5 + 0.5;
  float foam = band * smoothstep(0.4, 0.8, fn) * mix(0.85, 0.3, river);
  col = mix(col, vec3(0.85) * (0.2 + 0.8 * sunUp), foam);

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
```

- [ ] **Step 2: Component**

```tsx
// src/scene/water/Water.tsx
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import type { WorldFields } from '../../terrain/fields';
import type { Sun } from '../useSun';
import { makeInfoTexture } from '../useWorldFields';
import { waterFragment, waterVertex } from './waterShader';

const RIVER_DIR = new THREE.Vector2(1, -1).normalize();
const WIND_DIR = new THREE.Vector2(-1, 0.35).normalize();

export function Water({ near, far, sun, flow, reflScale, frozen }: {
  near: WorldFields; far: WorldFields; sun: Sun; flow: number; reflScale: number; frozen: boolean;
}) {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const rect = (f: WorldFields) => new THREE.Vector4(f.grid.minX, f.grid.minZ, f.grid.cell * f.grid.size, 0);

  const mirror = useMemo(() => {
    const r = new Reflector(new THREE.PlaneGeometry(40000, 40000), {
      textureWidth: Math.round(size.width * dpr * reflScale),
      textureHeight: Math.round(size.height * dpr * reflScale),
      clipBias: 0.003,
      shader: {
        name: 'AnconWater',
        uniforms: {
          color: { value: null },
          tDiffuse: { value: null },
          textureMatrix: { value: null },
          uNearInfo: { value: null }, uNearRect: { value: new THREE.Vector4() },
          uFarInfo: { value: null }, uFarRect: { value: new THREE.Vector4() },
          uTime: { value: 0 },
          uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() }, uSunIntensity: { value: 1 },
          uRiverFlow: { value: new THREE.Vector2() }, uWind: { value: WIND_DIR.clone() },
        },
        vertexShader: waterVertex,
        fragmentShader: waterFragment,
      },
    });
    r.rotation.x = -Math.PI / 2;
    return r;
  }, [size.width, size.height, dpr, reflScale]);

  const u = (mirror.material as THREE.ShaderMaterial).uniforms;

  useEffect(() => {
    const a = makeInfoTexture(near.waterInfo, near.grid.size), b = makeInfoTexture(far.waterInfo, far.grid.size);
    u.uNearInfo.value = a; u.uNearRect.value = rect(near);
    u.uFarInfo.value = b; u.uFarRect.value = rect(far);
    return () => { a.dispose(); b.dispose(); };
  }, [near, far, u]);

  useEffect(() => {
    u.uSunDir.value.copy(sun.dir);
    u.uSunColor.value.setRGB(...sun.atm.sunColor);
    u.uSunIntensity.value = sun.atm.sunIntensity;
    u.uRiverFlow.value.copy(RIVER_DIR).multiplyScalar(flow / 0.35);
  }, [sun, flow, u]);

  useEffect(() => () => { mirror.dispose(); }, [mirror]);

  useFrame((_, dt) => { if (!frozen) u.uTime.value += dt; else u.uTime.value = 10; });

  return <primitive object={mirror} />;
}
```

- [ ] **Step 3: Wire into World**

```tsx
// in World(): after <Terrain/>
const era = useEra();
const frozen = useStore((s) => s.frozen);
// ...
<Water near={near} far={far} sun={sun} flow={era.river.flow.value} reflScale={q.reflScale} frozen={frozen} />
```

- [ ] **Step 4: Verify.** Dev server, camera low over the river (`?t=17.5`, orbit down to ~3 m above water near the origin). Expect: brown-green river with reflections of the far bank and sky, ripples moving downstream (toward the mouth, NE), turquoise→deep blue sea with foam at the beach, sun glitter path at golden hour. Screenshot. Check frame time in the browser pane (`?debug=1` added in Task 10; for now use devtools performance). `npm run build` passes.
- [ ] **Step 5: Commit** (`feat(water): reflective river and sea with flow, depth colour, foam`).

---

### Task 9: Post-processing and height fog

**Files:**
- Create: `src/scene/post/HeightFogEffect.ts`, `src/scene/post/Post.tsx`
- Modify: `src/scene/World.tsx`, `src/App.tsx` (renderer tone mapping → none)

**Interfaces:**
- Consumes: `Sun`, `QUALITY.ao`.
- Produces: `class HeightFogEffect extends Effect { constructor(camera: THREE.Camera); setAtmosphere(sun: Sun): void }`; `<Post sun ao/>`.

- [ ] **Step 1: Fog effect**

```ts
// src/scene/post/HeightFogEffect.ts
import { Effect, EffectAttribute } from 'postprocessing';
import * as THREE from 'three';
import type { Sun } from '../useSun';

const frag = /* glsl */ `
uniform mat4 uProjInv; uniform mat4 uViewInv; uniform vec3 uCamPos;
uniform vec3 uFogColor; uniform vec3 uSunColor; uniform vec3 uSunDir;
uniform float uDensity; uniform float uFalloff;
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec4 ndc = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 view = uProjInv * ndc; view /= view.w;
  vec3 world = (uViewInv * view).xyz;
  vec3 ray = world - uCamPos;
  float dist = length(ray);
  vec3 dir = ray / max(dist, 1e-4);
  bool sky = depth >= 0.99999;
  if (sky) dist = 25000.0;
  float h0 = max(uCamPos.y, 0.0);
  float dy = dir.y * dist;
  float k = uFalloff;
  float ratio = abs(k * dy) > 1e-3 ? (1.0 - exp(-k * dy)) / (k * dy) : 1.0;
  float amount = uDensity * exp(-k * h0) * dist * ratio;
  float f = 1.0 - exp(-amount);
  if (sky) f *= 0.25;
  float sunAmt = pow(max(dot(dir, uSunDir), 0.0), 6.0);
  vec3 fogCol = mix(uFogColor, uSunColor * 1.4, sunAmt * 0.8);
  outputColor = vec4(mix(inputColor.rgb, fogCol, clamp(f, 0.0, 1.0)), inputColor.a);
}`;

export class HeightFogEffect extends Effect {
  private cam: THREE.Camera;
  constructor(camera: THREE.Camera) {
    super('HeightFogEffect', frag, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ['uProjInv', new THREE.Uniform(new THREE.Matrix4())],
        ['uViewInv', new THREE.Uniform(new THREE.Matrix4())],
        ['uCamPos', new THREE.Uniform(new THREE.Vector3())],
        ['uFogColor', new THREE.Uniform(new THREE.Color())],
        ['uSunColor', new THREE.Uniform(new THREE.Color())],
        ['uSunDir', new THREE.Uniform(new THREE.Vector3(0, 1, 0))],
        ['uDensity', new THREE.Uniform(0.0006)],
        ['uFalloff', new THREE.Uniform(0.012)],
      ]),
    });
    this.cam = camera;
  }
  setAtmosphere(sun: Sun) {
    this.uniforms.get('uFogColor')!.value.setRGB(...sun.atm.fogColor);
    this.uniforms.get('uSunColor')!.value.setRGB(...sun.atm.sunColor);
    this.uniforms.get('uSunDir')!.value.copy(sun.dir);
    this.uniforms.get('uDensity')!.value = sun.atm.fogDensity;
  }
  update() {
    this.uniforms.get('uProjInv')!.value.copy(this.cam.projectionMatrixInverse);
    this.uniforms.get('uViewInv')!.value.copy(this.cam.matrixWorld);
    this.uniforms.get('uCamPos')!.value.setFromMatrixPosition(this.cam.matrixWorld);
  }
}
```

- [ ] **Step 2: Post stack**

```tsx
// src/scene/post/Post.tsx
import { useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, Noise, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEffect, useMemo } from 'react';
import type { Sun } from '../useSun';
import { HeightFogEffect } from './HeightFogEffect';

export function Post({ sun, ao }: { sun: Sun; ao: boolean }) {
  const camera = useThree((s) => s.camera);
  const fog = useMemo(() => new HeightFogEffect(camera), [camera]);
  useEffect(() => fog.setAtmosphere(sun), [fog, sun]);
  useEffect(() => () => fog.dispose(), [fog]);
  return (
    <EffectComposer multisampling={0}>
      {ao ? <N8AO aoRadius={3} distanceFalloff={1.5} intensity={2.2} halfRes /> : <></>}
      <primitive object={fog} />
      <Bloom mipmapBlur intensity={0.35} luminanceThreshold={0.9} luminanceSmoothing={0.2} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette offset={0.3} darkness={0.5} />
      <Noise opacity={0.025} premultiply />
      <SMAA />
    </EffectComposer>
  );
}
```

If an empty fragment inside `EffectComposer` throws, build the children as an array filtered with `.filter(Boolean)`.

- [ ] **Step 3: Wire** `<Post sun={sun} ao={q.ao} />` at the end of `World`. In `App.tsx`, remove the `onCreated` tone-mapping line and set `gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}`.
- [ ] **Step 4: Verify** golden-hour look: `?t=17.6` — warm haze thickening toward the horizon and toward the sun, mountains faded blue-grey, no banding, no black sky. Compare side by side with the reference image for mood (haze, warmth, contrast). `?q=low` must run without AO. Screenshot both.
- [ ] **Step 5: Commit** (`feat(post): height fog with sun in-scatter, AO, bloom, AgX, grain`).

---

### Task 10: Cameras, debug panel, title card, ready signal

**Files:**
- Create: `src/scene/Cameras.tsx`, `src/scene/ReadySignal.tsx`, `src/ui/DebugPanel.tsx`, `src/ui/TitleCard.tsx`
- Modify: `src/App.tsx` (replace OrbitControls), `src/scene/World.tsx`

**Interfaces:**
- Consumes: `useStore`, `CAMERA_PRESETS`, `landmarkXZ`, `ERAS`.
- Produces: `CAMERA_POSES: Record<CameraPreset, { pos: [n,n,n]; target: [n,n,n] }>`; `window.__ANCON_READY__ = true` after 30 frames.

- [ ] **Step 1: Cameras**

```tsx
// src/scene/Cameras.tsx
import { CameraControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { landmarkXZ } from '../data/landmarks';
import { useStore } from '../state/store';
import type { CameraPreset } from '../state/url';

const [ex, ez] = landmarkXZ('eastLanding');
const [wx, wz] = landmarkXZ('westLanding');
const [mx, mz] = landmarkXZ('mouth');

export const CAMERA_POSES: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  // Behind and above the (future) ferry mid-river, looking at the far landing — the reference framing.
  ride: { pos: [ex * 0.35, 4.2, ez * 0.35], target: [wx, 1.5, wz] },
  // Standing at the Loíza landing.
  bank: { pos: [ex + 10, 2.2, ez + 8], target: [wx - 40, 2, wz - 30] },
  aerial: { pos: [520, 380, 640], target: [0, 0, 0] },
  mouth: { pos: [mx - 180, 22, mz + 260], target: [mx, 0, mz] },
};

export function Cameras() {
  const ref = useRef<CameraControls>(null);
  const preset = useStore((s) => s.camera);
  const first = useRef(true);
  useEffect(() => {
    const p = CAMERA_POSES[preset];
    ref.current?.setLookAt(...p.pos, ...p.target, !first.current);
    first.current = false;
  }, [preset]);
  return <CameraControls ref={ref} makeDefault minDistance={1} maxDistance={6000} maxPolarAngle={Math.PI * 0.495} />;
}
```

- [ ] **Step 2: Ready signal**

```tsx
// src/scene/ReadySignal.tsx
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

declare global { interface Window { __ANCON_READY__?: boolean } }

export function ReadySignal() {
  const frames = useRef(0);
  useFrame(() => {
    if (++frames.current === 30) { window.__ANCON_READY__ = true; document.body.dataset.ready = '1'; }
  });
  return null;
}
```

- [ ] **Step 3: Debug panel + title**

```tsx
// src/ui/DebugPanel.tsx
import { Leva, useControls } from 'leva';
import { ERA_IDS, type EraId } from '../data/eras';
import { useStore } from '../state/store';
import { CAMERA_PRESETS, type CameraPreset } from '../state/url';
import type { Quality } from '../quality';

export function DebugPanel() {
  const s = useStore();
  useControls({
    era: { value: s.eraId, options: ERA_IDS, onChange: (v: EraId) => useStore.getState().setEra(v) },
    time: { value: s.timeOfDay, min: 5, max: 19.5, step: 0.05, onChange: (v: number) => useStore.getState().setTime(v) },
    camera: { value: s.camera, options: CAMERA_PRESETS, onChange: (v: CameraPreset) => useStore.getState().setCamera(v) },
    quality: { value: s.quality, options: ['high', 'medium', 'low'], onChange: (v: Quality) => useStore.getState().setQuality(v) },
  });
  return <Leva hidden={!s.debug} collapsed={false} />;
}
```

```tsx
// src/ui/TitleCard.tsx
import { useEra } from '../state/store';

export function TitleCard() {
  const era = useEra();
  return (
    <div className="title-card">
      <div className="title-card__kicker">El Ancón de Loíza</div>
      <div className="title-card__era">{era.years} · {era.label}</div>
    </div>
  );
}
```

```css
/* append to src/styles.css */
.title-card { position: fixed; left: 24px; bottom: 24px; color: #f4ecdf; font: 500 13px/1.4 ui-serif, Georgia, serif; letter-spacing: 0.04em; text-shadow: 0 1px 12px rgba(0,0,0,0.45); pointer-events: none; }
.title-card__kicker { text-transform: uppercase; letter-spacing: 0.24em; font-size: 11px; opacity: 0.8; }
.title-card__era { font-size: 22px; margin-top: 4px; }
```

- [ ] **Step 4: Wire.** `App.tsx`: replace `<OrbitControls/>` with `<Cameras/>`; add `<ReadySignal/>` inside Canvas; render `<DebugPanel/>` and `<TitleCard/>` beside the Canvas; when `debug` is on, render drei `<StatsGl/>` inside the Canvas.
- [ ] **Step 5: Verify** every preset (`?cam=ride|bank|aerial|mouth`) frames the river sensibly; `?debug=1` shows leva + stats; switching era 1935 ↔ 1975 visibly changes river width a little. Commit (`feat: camera presets, debug panel, title card, ready signal`).

---

### Task 11: E2E screenshots, performance check, phase gate

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/phase1.spec.ts`
- Modify: `README.md` (roadmap tick, live link)

- [ ] **Step 1: Playwright config**

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:4173/ancon-de-loiza/',
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: { command: 'npm run build && npm run preview', port: 4173, reuseExistingServer: true, timeout: 180_000 },
});
```

- [ ] **Step 2: Spec**

```ts
// tests/e2e/phase1.spec.ts
import { expect, test } from '@playwright/test';

const SHOTS = [
  { era: '1935', cam: 'ride', t: 17.5 },
  { era: '1975', cam: 'bank', t: 8.0 },
  { era: '1984', cam: 'aerial', t: 12.0 },
  { era: '1986', cam: 'mouth', t: 18.0 },
];

for (const s of SHOTS) {
  test(`renders ${s.era} ${s.cam} @${s.t}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`?era=${s.era}&cam=${s.cam}&t=${s.t}&freeze=1&q=medium`);
    await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
    await page.screenshot({ path: `tests/snapshots/phase1/${s.era}-${s.cam}.png` });
    expect(errors).toEqual([]);
  });
}
```

Run: `npx playwright install chromium` (once), then `npm run e2e` → 4 PASS, 4 PNGs in `tests/snapshots/phase1/`.

- [ ] **Step 3: Quality gate.** Open each PNG. Judge against the reference image: atmosphere depth, water reflection, light warmth, horizon. Tune `atmosphere.ts`, water colours and fog constants until the golden-hour `ride` shot reads as cinematic. Re-run e2e after each tuning pass. Record fps on this Mac for `high` and `low` (`?debug=1`) in the commit message.
- [ ] **Step 4: Ship.** Tick Phase 1 in README, add the live link `https://gabriel-rene.github.io/ancon-de-loiza/`, commit (`chore: phase 1 gate — screenshots, perf numbers`), push, confirm the Actions deploy is green, open the live URL.

---

## Self-review

- Spec coverage (Phase 1 slice): real geography §4 → Tasks 4–6; sky/sun/fog §5 → Tasks 2, 7, 9; water §5 → Task 8; quality tiers §5 → Tasks 3, 6–9; eras as data §3 → Task 3; camera modes (preset subset) §7 → Task 10; testing §9 → unit tests in Tasks 2–5, Playwright in Task 11; delivery §10 → Tasks 1, 11. Deferred by design to later phases: vegetation, ancón, infrastructure, fauna, final UI, sound.
- Spec deviation: §5 says CSM shadows; this plan uses one directional shadow frustum around the crossing (simpler, enough for Phase 1). Revisit in Phase 2 when vegetation casts shadows.
- Names checked: `buildFields`, `WorldFields.waterInfo/info`, `makeInfoTexture`, `useSun`/`Sun`, `QUALITY.*`, `CAMERA_PRESETS`, `landmarkXZ` are used consistently.
