# Phase 3b — Sourced info panel, Spanish and English Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every era 3–5 checked facts with source links, shown in a panel, with a Spanish / English switch for all on-screen text, and keep the UI usable when WebGL fails.

**Architecture:** Text is data: every visible string is a `Bilingual` (`{ es, en }`), picked by a `useT()` hook from `lang` in the zustand store; `?lang=` keeps the choice in the URL. Facts live in `src/data/facts.ts`, keyed by era, pointing at `SOURCES`. A `Toolbar` (top left) owns the panel's open state, the "Datos / Facts" button and the ES | EN switch; `InfoPanel` renders the current era's facts. A `SceneBoundary` error boundary wraps the `<Canvas>`.

**Tech Stack:** React 19, zustand 5, vitest 5 (node by default; `jsdom` per component test file), `@testing-library/react` (new, dev only), Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-27-info-panel-design.md` (binding) · Parent: `docs/superpowers/specs/2026-09-26-ancon-loiza-design.md` §7 · Research: `docs/research/ancon-research.md` (§2, §3, §4, §7)

## Global Constraints

- No i18n library. Every visible string is a `Bilingual` = `{ es: string; en: string }` from `src/i18n/text.ts`; both non-empty (tested).
- Language default without `?lang`: `en` if `navigator.language` starts with `en`; otherwise `es`. `?lang=es|en`; invalid values ignored. `<html lang>` follows the store.
- Facts: 3–5 per era; each has ≥ 1 source ID that exists in `SOURCES`; optional `inferred: true`. No confidence field, no confidence badges.
- Only H or M research items are stated as fact; an L item is left out or written as a report ("según la historia oral…").
- Spanish is written as Spanish, not word-for-word from the English.
- The panel starts closed; it is a non-modal dialog; Esc closes it; focus goes to its heading on open and back to the "Datos / Facts" button on close; ← → keep changing the era while it is open.
- Phone (≤ 720 px wide): bottom sheet ≤ 50vh, the decade rail stays visible and tappable. Wider: right-side column.
- Touch targets ≥ 44 px. Text contrast WCAG AA. Sheet motion off under `prefers-reduced-motion`.
- Not in scope: 3D tap points, crossfades, sound, camera-mode UI (Phase 6).
- Verification per task: `npm test` and `npm run build` pass. Full `npm run e2e` runs in the final task.
- Commit message bodies end, after a blank line, with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push — the controller pushes.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/i18n/text.ts` | new | `Lang`, `LANGS`, `Bilingual`, `detectLang`, `withLang` |
| `src/i18n/useT.ts` | new | `useT()` hook: `Bilingual → string` in the current language |
| `src/i18n/strings.ts` | new | `STRINGS`: UI labels |
| `src/state/url.ts` | modify | parse / write `?lang` |
| `src/state/store.ts` | modify | `lang`, `setLang` |
| `src/data/eras.ts` | modify | `label`, `years` become `Bilingual` |
| `src/data/facts.ts` | new | `Fact`, `FACTS` |
| `src/ui/TitleCard.tsx`, `src/ui/DecadePicker.tsx` | modify | read labels through `useT()` |
| `src/ui/Toolbar.tsx` | new | Facts button, ES/EN switch, panel open state, Esc, focus return |
| `src/ui/InfoPanel.tsx` | new | facts for the current era |
| `src/ui/SceneBoundary.tsx` | new | error boundary + no-WebGL message |
| `src/App.tsx` | modify | `<html lang>` sync, `SceneBoundary`, `Toolbar` |
| `src/styles.css` | modify | toolbar, panel, sheet, fallback |
| `vite.config.ts`, `package.json` | modify | `.test.tsx` include; dev deps |
| `docs/superpowers/notes/phase-3b-factcheck.md` | new | review-agent verdicts |
| tests | new/modify | `src/i18n/text.test.ts`, `src/i18n/bilingual.test.ts`, `src/state/url.test.ts`, `src/state/store.test.ts`, `src/data/facts.test.ts`, `src/ui/Toolbar.test.tsx`, `src/ui/SceneBoundary.test.tsx`, `tests/e2e/panel.spec.ts` |

---

### Task 1: Language core — types, URL, store, `<html lang>`

**Files:**
- Create: `src/i18n/text.ts`, `src/i18n/useT.ts`, `src/i18n/text.test.ts`
- Modify: `src/state/url.ts`, `src/state/url.test.ts`, `src/state/store.ts`, `src/state/store.test.ts`, `src/App.tsx`

**Interfaces:**
- Produces: `type Lang = 'es' | 'en'`; `LANGS: Lang[]`; `type Bilingual = { es: string; en: string }`; `detectLang(navLang: string | undefined): Lang`; `withLang(search: string, lang: Lang): string`; `useT(): (b: Bilingual) => string`; store fields `lang: Lang`, `setLang(l: Lang): void`; `UrlState.lang`.

- [ ] **Step 1: Write the failing tests**

`src/i18n/text.test.ts`:
```ts
import { expect, test } from 'vitest';
import { detectLang, withLang } from './text';

test('detectLang: English browsers get en, everyone else es', () => {
  expect(detectLang('en-US')).toBe('en');
  expect(detectLang('EN')).toBe('en');
  expect(detectLang('es-PR')).toBe('es');
  expect(detectLang('fr-FR')).toBe('es');
  expect(detectLang(undefined)).toBe('es');
});
test('withLang sets ?lang and keeps other params', () => {
  expect(withLang('?era=1935&freeze=1', 'es')).toBe('?era=1935&freeze=1&lang=es');
  expect(withLang('?lang=es&era=1984', 'en')).toBe('?lang=en&era=1984');
  expect(withLang('', 'en')).toBe('?lang=en');
});
```

Append to `src/state/url.test.ts`:
```ts
test('parses ?lang and rejects unknown languages', () => {
  expect(parseUrlState('?lang=es')).toEqual({ lang: 'es' });
  expect(parseUrlState('?lang=en')).toEqual({ lang: 'en' });
  expect(parseUrlState('?lang=fr')).toEqual({});
});
test('round-trips lang', () => {
  expect(parseUrlState(toSearch({ lang: 'es' }))).toEqual({ lang: 'es' });
});
```

Append to `src/state/store.test.ts` (add `import { detectLang } from '../i18n/text';` at the top):
```ts
test('language defaults from the browser and setLang changes it', () => {
  expect(useStore.getState().lang).toBe(detectLang(typeof navigator !== 'undefined' ? navigator.language : undefined));
  useStore.getState().setLang('es');
  expect(useStore.getState().lang).toBe('es');
  useStore.getState().setLang('en');
  expect(useStore.getState().lang).toBe('en');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/i18n/text.test.ts src/state/url.test.ts src/state/store.test.ts`
Expected: FAIL — `./text` not found; `lang` missing from parsed state and store.

- [ ] **Step 3: Implement**

`src/i18n/text.ts`:
```ts
export type Lang = 'es' | 'en';
export const LANGS: Lang[] = ['es', 'en'];
/** Every visible string carries both languages (spec 3b §3.1). */
export type Bilingual = { es: string; en: string };

/** First visit without ?lang: English for English browsers, Spanish for everyone else. */
export function detectLang(navLang: string | undefined): Lang {
  return navLang?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

/** New search string with ?lang set; other params survive. */
export function withLang(search: string, lang: Lang): string {
  const p = new URLSearchParams(search);
  p.set('lang', lang);
  return `?${p.toString()}`;
}
```

`src/i18n/useT.ts`:
```ts
import { useStore } from '../state/store';
import type { Bilingual } from './text';

/** Picks the current language from a Bilingual. */
export function useT() {
  const lang = useStore((s) => s.lang);
  return (b: Bilingual) => b[lang];
}
```

`src/state/url.ts`:
- add `import { LANGS, type Lang } from '../i18n/text';`
- in `UrlState` add `/** ?lang=es|en: UI language. */ lang: Lang;`
- in `parseUrlState`, before `return out;`:
```ts
  const lang = p.get('lang');
  if (lang && (LANGS as string[]).includes(lang)) out.lang = lang as Lang;
```
- in `toSearch`, before `return`: `if (s.lang) p.set('lang', s.lang);`

`src/state/store.ts`:
- add `import { detectLang, type Lang } from '../i18n/text';`
- in `AppState` add `lang: Lang;` to the field list and `setLang: (l: Lang) => void;` to the setters.
- in the initial object, before `...fromUrl`: `lang: detectLang(typeof navigator !== 'undefined' ? navigator.language : undefined),`
- add setter: `setLang: (lang) => set({ lang }),`

`src/App.tsx`: add `useEffect` to the react import and, inside `App()` after the `perf` line:
```tsx
  const lang = useStore((s) => s.lang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/i18n/text.test.ts src/state/url.test.ts src/state/store.test.ts`
Expected: PASS. Then `npm test` and `npm run build`: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n src/state src/App.tsx
git commit -m "feat(i18n): language state, ?lang in the URL, <html lang> sync

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Bilingual era labels and UI strings

**Files:**
- Create: `src/i18n/strings.ts`, `src/i18n/bilingual.test.ts`
- Modify: `src/data/eras.ts` (the `Era` interface and the `ERAS` array), `src/ui/TitleCard.tsx`, `src/ui/DecadePicker.tsx`

**Interfaces:**
- Consumes: `Bilingual`, `useT()` (Task 1).
- Produces: `Era.label: Bilingual`, `Era.years: Bilingual`; `STRINGS` with keys `chooseEra, facts, close, sources, inferred, inferredNote, language, noWebgl` (all `Bilingual`).

- [ ] **Step 1: Write the failing test**

`src/i18n/bilingual.test.ts`:
```ts
import { expect, test } from 'vitest';
import { ERAS } from '../data/eras';
import { STRINGS } from './strings';
import type { Bilingual } from './text';

const filled = (b: Bilingual) => b.es.trim().length > 0 && b.en.trim().length > 0;

test('every UI string has Spanish and English', () => {
  for (const [k, b] of Object.entries(STRINGS)) expect(filled(b), k).toBe(true);
});
test('every era label and years has Spanish and English', () => {
  for (const e of ERAS) {
    expect(filled(e.label), `${e.id} label`).toBe(true);
    expect(filled(e.years), `${e.id} years`).toBe(true);
  }
});
test('English labels are unchanged (the e2e picker test reads them)', () => {
  expect(ERAS.map((e) => e.label.en)).toEqual(['Colonial crossing', 'Sugar era', 'The Cortijo ancón', 'The ropes', 'Públicos', 'Weekend outings', 'The steel barge', 'The bridge']);
  expect(ERAS.map((e) => e.years.en)).toEqual(['1820s–1890s', '1900s–1910s', '1920s', '1930s–1940s', '1950s', '1960s–1970s', '1980–1986', '1986']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/i18n/bilingual.test.ts`
Expected: FAIL — `./strings` not found.

- [ ] **Step 3: Implement**

`src/i18n/strings.ts`:
```ts
import type { Bilingual } from './text';

/** UI labels (spec 3b §3.4). Language names in the switch stay in their own language and live in Toolbar. */
export const STRINGS = {
  chooseEra: { es: 'Escoge una época', en: 'Choose an era' },
  facts: { es: 'Datos', en: 'Facts' },
  close: { es: 'Cerrar', en: 'Close' },
  sources: { es: 'Fuentes', en: 'Sources' },
  inferred: { es: 'Inferido', en: 'Inferred' },
  inferredNote: {
    es: 'Inferido: lo deducimos a partir de las fuentes; ellas no lo dicen directamente.',
    en: 'Inferred: we worked this out from the sources; they do not say it directly.',
  },
  language: { es: 'Idioma', en: 'Language' },
  noWebgl: {
    es: 'Tu navegador no puede mostrar la escena 3D. Los datos de cada época siguen disponibles en «Datos».',
    en: 'Your browser cannot show the 3D scene. The facts for each era are still available under “Facts”.',
  },
} satisfies Record<string, Bilingual>;
```

`src/data/eras.ts`:
- add `import type { Bilingual } from '../i18n/text';`
- in `interface Era`: `label: Bilingual;` and `years: Bilingual;`
- in `ERAS`, replace only the `label` and `years` values, one per era:

| id | label | years |
|---|---|---|
| 1840 | `{ es: 'Cruce colonial', en: 'Colonial crossing' }` | `{ es: 'décadas de 1820–1890', en: '1820s–1890s' }` |
| 1900 | `{ es: 'Era del azúcar', en: 'Sugar era' }` | `{ es: 'décadas de 1900–1910', en: '1900s–1910s' }` |
| 1925 | `{ es: 'El ancón de los Cortijo', en: 'The Cortijo ancón' }` | `{ es: 'década de 1920', en: '1920s' }` |
| 1935 | `{ es: 'Las sogas', en: 'The ropes' }` | `{ es: 'décadas de 1930–1940', en: '1930s–1940s' }` |
| 1959 | `{ es: 'Públicos', en: 'Públicos' }` | `{ es: 'década de 1950', en: '1950s' }` |
| 1975 | `{ es: 'Paseos de fin de semana', en: 'Weekend outings' }` | `{ es: 'décadas de 1960–1970', en: '1960s–1970s' }` |
| 1984 | `{ es: 'La barcaza de acero', en: 'The steel barge' }` | `{ es: '1980–1986', en: '1980–1986' }` |
| 1986 | `{ es: 'El puente', en: 'The bridge' }` | `{ es: '1986', en: '1986' }` |

`src/ui/TitleCard.tsx`: add `import { useT } from '../i18n/useT';`, `const t = useT();` after `useEra()`, and change the era line to:
```tsx
        <div className="title-card__era">{t(era.years)} · {t(era.label)}</div>
```

`src/ui/DecadePicker.tsx`: add `import { STRINGS } from '../i18n/strings';` and `import { useT } from '../i18n/useT';`, `const t = useT();` at the top of the component, and change the JSX to:
```tsx
    <nav className="decade-rail" aria-label={t(STRINGS.chooseEra)}>
      {ERAS.map((e) => {
        const name = `${e.id} · ${t(e.years)} · ${t(e.label)}`;
        return (
          <button key={e.id} type="button" className="decade-rail__btn" aria-current={e.id === eraId ? 'true' : undefined}
            aria-label={name} title={name} onClick={() => choose(e.id)}>
            <span className="decade-rail__year">{e.id}</span>
            <span className="decade-rail__label">{t(e.label)}</span>
          </button>
        );
      })}
    </nav>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/i18n/bilingual.test.ts`
Expected: PASS. Then `npm test` and `npm run build`: PASS (the build catches any other reader of `label` / `years` as a type error — fix each through `useT()`).

- [ ] **Step 5: Commit**

```bash
git add src/i18n src/data/eras.ts src/ui/TitleCard.tsx src/ui/DecadePicker.tsx
git commit -m "feat(i18n): Spanish and English era labels and UI strings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Facts data

**Files:**
- Create: `src/data/facts.ts`, `src/data/facts.test.ts`

**Interfaces:**
- Consumes: `Bilingual` (Task 1), `EraId`, `ERA_IDS` (`src/data/eras.ts`), `SOURCES` (`src/data/sources.ts`).
- Produces: `interface Fact { text: Bilingual; sources: string[]; inferred?: true }`; `FACTS: Record<EraId, Fact[]>`.

- [ ] **Step 1: Write the failing test**

`src/data/facts.test.ts`:
```ts
import { expect, test } from 'vitest';
import { ERA_IDS } from './eras';
import { FACTS } from './facts';
import { SOURCES } from './sources';

test('every era has 3–5 facts', () => {
  for (const id of ERA_IDS) {
    expect(FACTS[id].length, id).toBeGreaterThanOrEqual(3);
    expect(FACTS[id].length, id).toBeLessThanOrEqual(5);
  }
});
test('every fact has Spanish and English text', () => {
  for (const id of ERA_IDS) FACTS[id].forEach((f, i) => {
    expect(f.text.es.trim().length, `${id}#${i} es`).toBeGreaterThan(0);
    expect(f.text.en.trim().length, `${id}#${i} en`).toBeGreaterThan(0);
  });
});
test('every fact cites at least one known source, without repeats', () => {
  for (const id of ERA_IDS) FACTS[id].forEach((f, i) => {
    expect(f.sources.length, `${id}#${i}`).toBeGreaterThan(0);
    expect(new Set(f.sources).size, `${id}#${i} repeats`).toBe(f.sources.length);
    for (const s of f.sources) expect(SOURCES[s], `${id}#${i} → ${s}`).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/data/facts.test.ts`
Expected: FAIL — `./facts` not found.

- [ ] **Step 3: Implement**

`src/data/facts.ts` (draft from research §2–§4 and §7; Task 4 checks every line against its sources):
```ts
import type { Bilingual } from '../i18n/text';
import type { EraId } from './eras';

/** One statement in the info panel (spec 3b §3.2). `sources` are keys of SOURCES. */
export interface Fact {
  text: Bilingual;
  sources: string[];
  /** Worked out by us from the sources, not stated in them. */
  inferred?: true;
}

export const FACTS: Record<EraId, Fact[]> = {
  '1840': [
    { text: { es: 'En 1824 el gobernador Miguel de la Torre ordenó poner un «ancón de pasaje» en el camino real. Ya funcionaba en 1827.',
              en: 'In 1824 Governor Miguel de la Torre ordered an “ancón de pasaje” for the royal road. It was running by 1827.' },
      sources: ['S3'] },
    { text: { es: 'Auguste Plée dibujó la desembocadura del río hacia 1821–1823. Su dibujo muestra una barcaza que cruza empujada con una vara. El original está en el Muséum d’Histoire Naturelle de París.',
              en: 'Auguste Plée drew the river mouth around 1821–1823. His drawing shows a barge crossing, pushed with a pole. The original is at the Muséum d’Histoire Naturelle in Paris.' },
      sources: ['S3'] },
    { text: { es: 'Un plano de desagüe de las ciénagas, de la década de 1840 (Lombera), incluye un dibujo del ancón con una soga desde la embarcación hasta la orilla.',
              en: 'A drainage plan of the marshes from the 1840s (Lombera) includes a drawing of the ancón with a rope from the craft to the shore.' },
      sources: ['S3'] },
    { text: { es: 'Los dos caminos de la capital a Loíza, uno por la costa y otro por el interior, tenían que cruzar el río. La carretera San Juan–Loíza se terminó en agosto de 1853.',
              en: 'Both roads from the capital to Loíza, one along the coast and one inland, had to cross the river. The San Juan–Loíza road was finished in August 1853.' },
      sources: ['S3'] },
    { text: { es: 'La iglesia de San Patricio, en el pueblo, se construyó en 1645 y se amplió en 1729. Sus muros gruesos sirvieron de refugio en huracanes e inundaciones.',
              en: 'The San Patricio church in town was built in 1645 and enlarged in 1729. Its thick walls served as a refuge in hurricanes and floods.' },
      sources: ['S14'] },
  ],
  '1900': [
    { text: { es: 'La familia Iturregui, dueña de tierras de caña, operaba el cruce para los trabajadores que venían del este (Río Grande, Luquillo, Fajardo) y del oeste (Carolina, San Juan). No se sabe con certeza cuándo empezó; quizás a finales del siglo XIX.',
              en: 'The Iturregui family, who owned cane land, ran the crossing for workers coming from the east (Río Grande, Luquillo, Fajardo) and the west (Carolina, San Juan). When it started is not certain; possibly the late 1800s.' },
      sources: ['S1'] },
    { text: { es: 'Existe una foto del ancón de 1900, publicada en el libro «Puerto Rico Urbano» de Sepúlveda Rivera.',
              en: 'A photo of the ancón from 1900 exists. It is published in Sepúlveda Rivera’s book “Puerto Rico Urbano”.' },
      sources: ['S3'] },
    { text: { es: 'En 1909–1910 la sede del municipio pasó a Canóvanas. El pueblo viejo se quedó con el nombre de «Loíza Aldea».',
              en: 'In 1909–1910 the seat of the municipality moved to Canóvanas. The old town was left with the name “Loíza Aldea”.' },
      sources: ['S16', 'S23'] },
    { text: { es: 'En 1918 Piñones fue declarado bosque. Los pinos australianos (casuarinas) de la costa le dan el nombre.',
              en: 'In 1918 Piñones was declared a forest. The Australian pines (casuarinas) along the coast give it its name.' },
      sources: ['S22', 'S28'] },
  ],
  '1925': [
    { text: { es: 'Pedro Cortijo Calderón, «Papá Pedro», trabajaba la barcaza para los Iturregui. En 1920 la compró y fue su primer concesionario.',
              en: 'Pedro Cortijo Calderón, “Papá Pedro”, worked the barge for the Iturreguis. In 1920 he bought it and became its first concession holder.' },
      sources: ['S1', 'S6', 'S11'] },
    { text: { es: 'El ancón era una plataforma de madera. Se movía con dos varas de mangle o majagüilla: una empujaba y la otra mantenía el rumbo, como un timón.',
              en: 'The ancón was a wooden platform. It moved with two poles of mangrove or majagüilla: one pushed and the other kept the course, like a rudder.' },
      sources: ['S1', 'S4'] },
    { text: { es: 'Cruzar costaba 10 centavos por persona, con su medio de transporte incluido.',
              en: 'A crossing cost 10 cents per person, their means of transport included.' },
      sources: ['S1'] },
    { text: { es: 'La plataforma llevaba un solo vehículo o una carreta de bueyes, además de gente y caballos.',
              en: 'The platform carried one vehicle or one ox cart, plus people and horses.' },
      sources: ['S4'] },
  ],
  '1935': [
    { text: { es: 'Cuando llegaron los carros se empezaron a usar sogas: dos sogas marinas tensas de una orilla a la otra. Dos o tres personas halaban y se turnaban según el pasaje del día.',
              en: 'When cars arrived, ropes came into use: two marine ropes kept taut from one bank to the other. Two or three people hauled and took turns according to the day’s traffic.' },
      sources: ['S1'] },
    { text: { es: 'Feliciano «Chano» Cortijo, hijo de Pedro, operó el ancón desde los años 30 hasta los 70. Una foto de los años 30 lo muestra moviéndolo con sogas.',
              en: 'Feliciano “Chano” Cortijo, Pedro’s son, ran the ancón from the 1930s to the 1970s. A 1930s photo shows him moving it with ropes.' },
      sources: ['S4', 'S11'] },
    { text: { es: 'Amelia «Tanén» Rosario, esposa de Chano, llevaba la casa, el negocio y la cocina al burén. También curaba con hierbas.',
              en: 'Amelia “Tanén” Rosario, Chano’s wife, ran the house, the business and the kitchen, cooking al burén. She also healed with herbs.' },
      sources: ['S4', 'S11'] },
    { text: { es: 'Con más carros, la plataforma se fue agrandando: para dos vehículos, luego para cuatro, luego para seis.',
              en: 'As cars increased, the platform was made bigger: for two vehicles, then for four, then for six.' },
      sources: ['S1'] },
  ],
  '1959': [
    { text: { es: 'La represa de Carraízo, río arriba, se construyó en 1953–1954 y regula el caudal del Río Grande de Loíza.',
              en: 'The Carraízo dam upstream was built in 1953–1954 and regulates the flow of the Río Grande de Loíza.' },
      sources: ['S15'] },
    { text: { es: 'Una foto de hacia 1959 muestra el carro público del chofer Florencio «Colo» Ramos frente al negocio El Ancón.',
              en: 'A photo from around 1959 shows the público (shared taxi) of driver Florencio “Colo” Ramos in front of the El Ancón business.' },
      sources: ['S4'] },
    { text: { es: 'La carretera que pasa por el ancón recibió el número PR-187 en 1953.',
              en: 'The road through the crossing was numbered PR-187 in 1953.' },
      sources: ['S30'] },
  ],
  '1975': [
    { text: { es: 'Cruzar en el ancón era el paseo familiar de fin de semana. Las familias traían calderos de comida, pasaban el día bajo los almendros y regresaban por la tarde.',
              en: 'Crossing on the ancón was the family weekend outing. Families brought pots of food, spent the day under the almond trees and crossed back in the afternoon.' },
      sources: ['S1'] },
    { text: { es: 'El Bar Restaurante El Ancón, de la familia, tenía una terraza sobre el río, vellonera, cerveza y alcapurrias.',
              en: 'The family’s Bar Restaurante El Ancón had a terrace over the river, a jukebox (vellonera), beer and alcapurrias.' },
      sources: ['S1', 'S4'] },
    { text: { es: 'El 16 de agosto de 1970 Canóvanas se separó y Loíza Aldea volvió a ser la sede de Loíza: «la Restauración».',
              en: 'On 16 August 1970 Canóvanas became separate and Loíza Aldea was again the seat of Loíza: “la Restauración”.' },
      sources: ['S12', 'S23'] },
    { text: { es: 'Visitaron el ancón Iris Chacón, Tony Croatto, Lucecita Benítez y Cheo Feliciano, entre otros. Allí se grabaron anuncios, especiales de televisión y películas.',
              en: 'Iris Chacón, Tony Croatto, Lucecita Benítez and Cheo Feliciano, among others, visited the ancón. Commercials, TV specials and films were shot there.' },
      sources: ['S1', 'S4'] },
    { text: { es: 'En los años 60 la familia construyó en cemento la casa Cortijo junto a la estación. Hoy es la Casa Museo Cortijo.',
              en: 'In the 1960s the family built the Cortijo house in concrete next to the station. Today it is the Casa Museo Cortijo.' },
      sources: ['S4', 'S6'] },
  ],
  '1984': [
    { text: { es: 'Desde 1980 el ancón fue una barcaza de metal con planchas de acero, para 6 a 8 carros.',
              en: 'From 1980 the ancón was a metal barge with steel plates, for 6 to 8 cars.' },
      sources: ['S1', 'S4'] },
    { text: { es: 'Chano murió en 1978 y su hija María Luisa «Magui» Cortijo Rosario tomó el mando. Los anconeros se fueron a la huelga y ella operó el ancón sola. Es la única mujer que lo ha operado.',
              en: 'Chano died in 1978 and his daughter María Luisa “Magui” Cortijo Rosario took charge. The anconeros went on strike and she ran the ancón alone. She is the only woman who has run it.' },
      sources: ['S4', 'S6', 'S11'] },
    { text: { es: 'Al final, cruzar con un vehículo costaba $2.50.',
              en: 'At the end, crossing with a vehicle cost $2.50.' },
      sources: ['S1', 'S5'] },
    { text: { es: 'Hacia 1982 sacaron la barcaza con una grúa para darle mantenimiento, porque caracoles y otros organismos cubrían el casco.',
              en: 'Around 1982 the barge was lifted out with a crane for maintenance, because snails and other growth covered the hull.' },
      sources: ['S4'] },
    { text: { es: 'El poema «Río Grande de Loíza» de Julia de Burgos es parte de la identidad del lugar. En los años 80, grupos escolares tiraban flores al río en su cumpleaños, el 17 de febrero.',
              en: 'Julia de Burgos’s poem “Río Grande de Loíza” is part of the place’s identity. In the 1980s, school groups threw flowers into the river on her birthday, 17 February.' },
      sources: ['S1', 'S4'] },
  ],
  '1986': [
    { text: { es: 'El puente de la PR-187 sobre el río se inauguró en 1985. El servicio regular del ancón terminó en 1986.',
              en: 'The PR-187 bridge over the river opened in 1985. Regular ancón service ended in 1986.' },
      sources: ['S1', 'S4', 'S27'] },
    { text: { es: 'En 1987 la familia operó «La Paseadora», un bote turístico de fin de semana: $2 los adultos y $1.50 los niños.',
              en: 'In 1987 the family ran “La Paseadora”, a weekend tourist boat: $2 for adults and $1.50 for children.' },
      sources: ['S4', 'S7'] },
    { text: { es: 'La familia quiso conservar la barcaza como atracción turística, pero no recibió apoyo municipal. Más tarde un huracán se la llevó mar afuera.',
              en: 'The family wanted to keep the barge as a tourist attraction, but got no support from the municipality. Later a hurricane carried it out to sea.' },
      sources: ['S4', 'S6'] },
    { text: { es: 'Hoy el Colectivo El Ancón de Loíza (fundado en 2019) y la Casa Museo Cortijo (abierta el 26 de junio de 2024) ocupan el sitio original. Un plan con fondos de la Fundación Mellon propone una nueva barcaza movida por personas.',
              en: 'Today the Colectivo El Ancón de Loíza (founded 2019) and the Casa Museo Cortijo (opened 26 June 2024) occupy the original site. A plan funded by the Mellon Foundation proposes a new human-powered barge.' },
      sources: ['S5', 'S6', 'S9'] },
  ],
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/data/facts.test.ts`
Expected: PASS. Then `npm test` and `npm run build`: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/facts.ts src/data/facts.test.ts
git commit -m "feat(data): draft sourced facts per era, Spanish and English

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Fact check by a review agent

No production code of its own; it changes `src/data/facts.ts` and writes the verdicts file. The controller dispatches one review agent (model: opus) with WebFetch, then applies the results.

**Files:**
- Create: `docs/superpowers/notes/phase-3b-factcheck.md`
- Modify: `src/data/facts.ts`

**Interfaces:**
- Consumes: `FACTS` (Task 3), `SOURCES`, `docs/research/ancon-research.md`.
- Produces: the same `FACTS` shape; texts corrected, `inferred: true` added, or facts dropped (3–5 per era still holds).

- [ ] **Step 1: Dispatch the review agent with this prompt**

```
You are checking facts for a public educational site about El Ancón de Loíza (Puerto Rico).
Read src/data/facts.ts and src/data/sources.ts in /Users/gabrielrodriguez/dev/ancon.
For EVERY fact (era id + index), open EACH cited source URL with WebFetch and decide:
  supported | partly supported | not supported
Check both the Spanish and the English text: same meaning, no detail that the sources do not give.
Give a short quote (≤ 15 words, in the source's language) or a reason for every verdict.
If a source does not open (paywall, dead link, blocked), check the fact against that source's
entry in docs/research/ancon-research.md instead, and mark the row "FLAG: source unreachable".
Also flag: wrong names, dates, numbers or places; Spanish that reads as a translation.
Do not edit any file. Return a Markdown table:
| era | # | verdict | quote or reason | suggested fix |
followed by a list "Flagged for the user" (every row that is not plainly supported, and every unreachable source).
```

- [ ] **Step 2: Write the verdicts file**

Save the agent's table and flagged list to `docs/superpowers/notes/phase-3b-factcheck.md` under the heading `# Phase 3b — fact check (review agent, <date>)`.

- [ ] **Step 3: Apply the results in `src/data/facts.ts`**

For each row that is not "supported":
- partly supported → rewrite `es` and `en` to say only what the source says; or
- the statement is our reasoning from the sources → add `inferred: true`; or
- not supported → delete the fact.
Keep 3–5 facts per era; if an era drops below 3, add a replacement from research §2–§4/§7 (H or M items only) and have the agent check that new fact the same way.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/data/facts.test.ts` then `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/facts.ts docs/superpowers/notes/phase-3b-factcheck.md
git commit -m "fix(data): facts corrected after source check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Toolbar and info panel

**Files:**
- Create: `src/ui/Toolbar.tsx`, `src/ui/InfoPanel.tsx`, `src/ui/Toolbar.test.tsx`
- Modify: `package.json` (dev deps), `vite.config.ts` (test include), `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `useT`, `withLang`, `Lang` (Task 1); `STRINGS` (Task 2); `FACTS` (Task 3/4); `SOURCES`; `useStore`, `useEra`.
- Produces: `export function Toolbar(): JSX.Element` (rendered once in `App`); `export function InfoPanel(props: { onClose: () => void }): JSX.Element` (rendered only by `Toolbar`).

- [ ] **Step 1: Add the test tools**

Run: `npm i -D @testing-library/react @testing-library/dom jsdom`

In `vite.config.ts`, change the `include` to:
```ts
  test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'], environment: 'node', testTimeout: 30_000 },
```

- [ ] **Step 2: Write the failing test**

`src/ui/Toolbar.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { FACTS } from '../data/facts';
import { useStore } from '../state/store';
import { Toolbar } from './Toolbar';

beforeEach(() => {
  window.history.replaceState(null, '', '/?era=1935');
  act(() => { useStore.getState().setLang('en'); useStore.getState().setEra('1935'); });
});
afterEach(cleanup);

test('the panel starts closed and the Facts button opens it on the current era', () => {
  render(<Toolbar />);
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Facts' }));
  const panel = screen.getByRole('dialog');
  expect(within(panel).getByRole('heading').textContent).toContain('The ropes');
  expect(within(panel).getAllByRole('listitem')).toHaveLength(FACTS['1935'].length);
  expect(document.activeElement).toBe(within(panel).getByRole('heading'));
  for (const a of within(panel).getAllByRole('link')) {
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noreferrer');
  }
});
test('Esc closes the panel and focus returns to the Facts button', () => {
  render(<Toolbar />);
  const btn = screen.getByRole('button', { name: 'Facts' });
  fireEvent.click(btn);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(btn);
});
test('the close button and a second press of Facts both close it', () => {
  render(<Toolbar />);
  const btn = screen.getByRole('button', { name: 'Facts' });
  fireEvent.click(btn);
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(btn);
  fireEvent.click(btn);
  expect(screen.queryByRole('dialog')).toBeNull();
});
test('the facts follow the era while the panel is open', () => {
  render(<Toolbar />);
  fireEvent.click(screen.getByRole('button', { name: 'Facts' }));
  act(() => useStore.getState().setEra('1984'));
  const panel = screen.getByRole('dialog');
  expect(within(panel).getByRole('heading').textContent).toContain('The steel barge');
  expect(within(panel).getAllByRole('listitem')).toHaveLength(FACTS['1984'].length);
});
test('the language switch changes the text, the pressed button and the URL', () => {
  render(<Toolbar />);
  fireEvent.click(screen.getByRole('button', { name: 'Español' }));
  expect(useStore.getState().lang).toBe('es');
  expect(window.location.search).toContain('lang=es');
  expect(window.location.search).toContain('era=1935');
  expect(screen.getByRole('button', { name: 'Español' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: 'Datos' }));
  expect(within(screen.getByRole('dialog')).getByRole('heading').textContent).toContain('Las sogas');
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/ui/Toolbar.test.tsx`
Expected: FAIL — `./Toolbar` not found.

- [ ] **Step 4: Implement**

`src/ui/InfoPanel.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { FACTS } from '../data/facts';
import { SOURCES } from '../data/sources';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { useEra } from '../state/store';

/** Sourced facts for the current era (spec 3b §5). Non-modal: the scene stays live beside it. */
export function InfoPanel({ onClose }: { onClose: () => void }) {
  const era = useEra();
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  // Focus the heading once, on open; an era change while open keeps focus where it is.
  useEffect(() => { heading.current?.focus(); }, []);
  const facts = FACTS[era.id];
  return (
    <section id="info-panel" className="info-panel" role="dialog" aria-modal="false" aria-labelledby="info-panel-title">
      <header className="info-panel__head">
        <h2 id="info-panel-title" ref={heading} tabIndex={-1}>{era.id} · {t(era.years)} · {t(era.label)}</h2>
        <button type="button" className="info-panel__close" onClick={onClose}>{t(STRINGS.close)}</button>
      </header>
      <ol className="info-panel__facts">
        {facts.map((f, i) => (
          <li key={`${era.id}-${i}`} className="info-panel__fact">
            <p className="info-panel__text">{t(f.text)}</p>
            <p className="info-panel__meta">
              {f.inferred && <span className="info-panel__inferred">{t(STRINGS.inferred)}</span>}
              <span>{t(STRINGS.sources)}: </span>
              {f.sources.map((id, j) => (
                <span key={id}>{j > 0 && ' · '}<a href={SOURCES[id].url} target="_blank" rel="noreferrer">{SOURCES[id].title}</a></span>
              ))}
            </p>
          </li>
        ))}
      </ol>
      {facts.some((f) => f.inferred) && <p className="info-panel__note">{t(STRINGS.inferredNote)}</p>}
    </section>
  );
}
```

`src/ui/Toolbar.tsx`:
```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { STRINGS } from '../i18n/strings';
import { withLang, type Lang } from '../i18n/text';
import { useT } from '../i18n/useT';
import { useStore } from '../state/store';
import { InfoPanel } from './InfoPanel';

/** Language names stay in their own language, whatever the current one. */
const LANG_BUTTONS: { lang: Lang; short: string; name: string }[] = [
  { lang: 'es', short: 'ES', name: 'Español' },
  { lang: 'en', short: 'EN', name: 'English' },
];

/** Top-left controls: the Facts button (owns the panel's open state) and the ES | EN switch (spec 3b §5.1). */
export function Toolbar() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const [open, setOpen] = useState(false);
  const factsBtn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(false); factsBtn.current?.focus(); }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);
  const chooseLang = (l: Lang) => {
    if (l === useStore.getState().lang) return;
    useStore.getState().setLang(l);
    window.history.replaceState(null, '', withLang(window.location.search, l));
  };
  return (
    <>
      <div className="toolbar">
        <button ref={factsBtn} type="button" className="toolbar__btn" aria-expanded={open}
          aria-controls={open ? 'info-panel' : undefined} onClick={() => (open ? close() : setOpen(true))}>
          {t(STRINGS.facts)}
        </button>
        <div className="toolbar__lang" role="group" aria-label={t(STRINGS.language)}>
          {LANG_BUTTONS.map((b) => (
            <button key={b.lang} type="button" lang={b.lang} className="toolbar__btn toolbar__btn--lang"
              aria-pressed={lang === b.lang} aria-label={b.name} onClick={() => chooseLang(b.lang)}>
              {b.short}
            </button>
          ))}
        </div>
      </div>
      {open && <InfoPanel onClose={close} />}
    </>
  );
}
```

`src/App.tsx`: add `import { Toolbar } from './ui/Toolbar';` and render `<Toolbar />` after `<DecadePicker />`.

`src/styles.css` — append:
```css
.toolbar { position: fixed; top: max(12px, env(safe-area-inset-top)); left: 12px; z-index: 20; display: flex; gap: 8px; }
.toolbar__lang { display: flex; gap: 2px; padding: 0 2px; border-radius: 10px; background: rgba(12, 15, 15, 0.55);
  border: 1px solid rgba(244, 236, 223, 0.14); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.toolbar__btn { min-height: 44px; min-width: 44px; padding: 0 14px; border: 1px solid rgba(244, 236, 223, 0.14); border-radius: 10px;
  background: rgba(12, 15, 15, 0.55); color: #f4ecdf; font: 600 14px/1 ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.02em;
  cursor: pointer; touch-action: manipulation; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.toolbar__btn--lang { border: 0; background: transparent; padding: 0 10px; backdrop-filter: none; -webkit-backdrop-filter: none; }
.toolbar__btn[aria-pressed='true'], .toolbar__btn[aria-expanded='true'] { background: #f4ecdf; color: #1b1a17; }
.toolbar__btn:focus-visible, .info-panel__close:focus-visible, .info-panel a:focus-visible { outline: 2px solid #f2c46d; outline-offset: 2px; }

.info-panel { position: fixed; z-index: 20; top: calc(max(12px, env(safe-area-inset-top)) + 56px); right: 12px;
  bottom: calc(max(12px, env(safe-area-inset-bottom)) + 84px); width: min(400px, calc(100vw - 24px)); box-sizing: border-box;
  overflow-y: auto; overscroll-behavior: contain; padding: 14px 18px 18px; border-radius: 14px;
  background: rgba(20, 19, 17, 0.94); border: 1px solid rgba(244, 236, 223, 0.14); color: #f4ecdf;
  font: 400 15px/1.5 ui-sans-serif, system-ui, sans-serif; }
.info-panel__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.info-panel__head h2 { margin: 6px 0 0; font: 500 19px/1.3 ui-serif, Georgia, serif; outline: none; }
.info-panel__close { flex: none; min-height: 44px; min-width: 44px; padding: 0 12px; border: 0; border-radius: 9px;
  background: rgba(244, 236, 223, 0.1); color: #f4ecdf; font: 600 13px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
.info-panel__facts { margin: 12px 0 0; padding-left: 20px; display: grid; gap: 14px; }
.info-panel__text { margin: 0; }
.info-panel__meta { margin: 4px 0 0; font-size: 12.5px; line-height: 1.45; color: rgba(244, 236, 223, 0.78); }
.info-panel__meta a { color: #f2c46d; text-underline-offset: 2px; }
.info-panel__inferred { display: inline-block; margin-right: 8px; padding: 1px 6px; border-radius: 5px;
  border: 1px solid rgba(244, 236, 223, 0.4); font-weight: 600; }
.info-panel__note { margin: 14px 0 0; font-size: 12.5px; color: rgba(244, 236, 223, 0.78); }
@media (max-width: 720px) {
  .info-panel { top: auto; left: 8px; right: 8px; width: auto; max-height: 50vh;
    bottom: calc(max(12px, env(safe-area-inset-bottom)) + 64px); border-radius: 14px 14px 10px 10px;
    animation: info-sheet-up 180ms ease-out; }
}
@keyframes info-sheet-up { from { transform: translateY(16px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .info-panel { animation: none; } }
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/ui/Toolbar.test.tsx`
Expected: PASS. Then `npm test` and `npm run build`: PASS.

- [ ] **Step 6: Look at it**

Run `npx vite --port 5173 --strictPort`, open `http://localhost:5173/ancon-de-loiza/?era=1935&lang=es` at 1440×900 and at 375×812, open the panel. Check: sheet above the rail on the phone size, column on the right on the wide size, links readable, no horizontal scroll.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/ui/Toolbar.tsx src/ui/InfoPanel.tsx src/ui/Toolbar.test.tsx src/App.tsx src/styles.css
git commit -m "feat(ui): facts panel with sources and ES/EN switch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The UI survives without WebGL

**Files:**
- Create: `src/ui/SceneBoundary.tsx`, `src/ui/SceneBoundary.test.tsx`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `STRINGS.noWebgl` (Task 2), `useT` (Task 1).
- Produces: `export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }>`.

- [ ] **Step 1: Write the failing test**

`src/ui/SceneBoundary.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useStore } from '../state/store';
import { SceneBoundary } from './SceneBoundary';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Boom(): never { throw new Error('WebGL context could not be created'); }

test('shows the no-WebGL message instead of the scene, and siblings keep rendering', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  act(() => useStore.getState().setLang('en'));
  render(<><SceneBoundary><Boom /></SceneBoundary><button type="button">Facts</button></>);
  expect(screen.getByRole('status').textContent).toContain('cannot show the 3D scene');
  expect(screen.getByRole('button', { name: 'Facts' })).toBeTruthy();
});
test('renders its children when nothing throws', () => {
  render(<SceneBoundary><p>scene</p></SceneBoundary>);
  expect(screen.getByText('scene')).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/SceneBoundary.test.tsx`
Expected: FAIL — `./SceneBoundary` not found.

- [ ] **Step 3: Implement**

`src/ui/SceneBoundary.tsx`:
```tsx
import { Component, type ReactNode } from 'react';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';

/** Keeps the page usable when WebGL is missing or the scene throws (spec 3b §5.5): the UI around it stays. */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.warn('3D scene failed:', error); }
  render() { return this.state.failed ? <SceneFallback /> : this.props.children; }
}

function SceneFallback() {
  const t = useT();
  return <div className="scene-fallback" role="status">{t(STRINGS.noWebgl)}</div>;
}
```

`src/App.tsx`: add `import { SceneBoundary } from './ui/SceneBoundary';` and wrap the whole `<Canvas …>…</Canvas>` element in `<SceneBoundary>…</SceneBoundary>`.

`src/styles.css` — append:
```css
.scene-fallback { position: fixed; inset: 0; display: grid; place-items: center; padding: 24px; box-sizing: border-box;
  background: linear-gradient(#2a3a44, #1b1a17); color: #f4ecdf; font: 400 16px/1.5 ui-sans-serif, system-ui, sans-serif; text-align: center; }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ui/SceneBoundary.test.tsx`
Expected: PASS. Then `npm test` and `npm run build`: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/SceneBoundary.tsx src/ui/SceneBoundary.test.tsx src/App.tsx src/styles.css
git commit -m "feat(ui): keep the UI when WebGL fails

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: End-to-end check, final gate, flagged list

**Files:**
- Create: `tests/e2e/panel.spec.ts`
- Modify: `docs/superpowers/specs/2026-09-26-ancon-loiza-design.md` (§8 phase list: one line), `docs/superpowers/notes/phase-3b-factcheck.md` (final state)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the e2e test**

`tests/e2e/panel.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test('phone: facts panel opens, switches language, follows the rail, closes with Esc', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('?era=1935&freeze=1&q=low&lang=en');
  await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
  await page.getByRole('button', { name: 'Facts' }).click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading')).toContainText('The ropes');
  const n = await panel.getByRole('listitem').count();
  expect(n).toBeGreaterThanOrEqual(3);
  expect(n).toBeLessThanOrEqual(5);
  await expect(panel.getByRole('link').first()).toHaveAttribute('target', '_blank');
  await page.getByRole('button', { name: 'Español' }).click();
  await expect(page).toHaveURL(/lang=es/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(panel.getByRole('heading')).toContainText('Las sogas');
  // The rail stays tappable above the sheet (a covered button would fail the click).
  await page.getByRole('navigation', { name: 'Escoge una época' }).getByRole('button', { name: /^1984/ }).click();
  await expect(page).toHaveURL(/era=1984/);
  await expect(panel.getByRole('heading')).toContainText('La barcaza de acero');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Datos' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run the full gate**

Run: `npm test && npm run build && npm run e2e`
Expected: all PASS (including the existing `picker.spec.ts`, which reads the English labels; Playwright's browser language is `en-US`).

- [ ] **Step 3: Screenshots for the user**

Write `<scratchpad>/panel-shots.mjs` (dev server on :5173 must be running):
```js
import { chromium } from '@playwright/test';
const out = process.argv[2];
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
for (const [name, viewport] of [['phone', { width: 375, height: 812 }], ['desktop', { width: 1440, height: 900 }]]) {
  const page = await browser.newPage({ viewport });
  await page.goto('http://localhost:5173/ancon-de-loiza/?era=1935&lang=es&freeze=1');
  await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 60000 });
  await page.getByRole('button', { name: 'Datos' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/panel-${name}.png` });
  await page.close();
}
await browser.close();
```
Run: `node <scratchpad>/panel-shots.mjs <scratchpad>` and look at both images: sheet above the rail on the phone, right column on desktop, text readable over the scene.

- [ ] **Step 4: Update the parent spec's phase list**

In `docs/superpowers/specs/2026-09-26-ancon-loiza-design.md` §8, after the line `  3. The ancón per era + crossing loop + crew`, add:
```
  3b. Sourced info panel, Spanish and English (pulled forward from 6; see 2026-09-27-info-panel-design.md)
```

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/panel.spec.ts docs/superpowers/specs/2026-09-26-ancon-loiza-design.md docs/superpowers/notes/phase-3b-factcheck.md
git commit -m "test(e2e): facts panel on a phone; docs: phase 3b in the phase list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Hand over to the user**

Send the user: the two screenshots, and the "Flagged for the user" list from `docs/superpowers/notes/phase-3b-factcheck.md` (only flagged facts, each with its reason). The phase is done when the user clears the list and checks the panel on a phone and a computer (spec 3b §8).
