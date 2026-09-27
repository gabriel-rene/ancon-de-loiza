# Phase 3b — Sourced info panel, Spanish and English (approved in chat 2026-09-27)

Parent spec: [`2026-09-26-ancon-loiza-design.md`](2026-09-26-ancon-loiza-design.md) (§7 UI, §8 phases). Research base: [`docs/research/ancon-research.md`](../../research/ancon-research.md); source IDs `[S#]` refer to it and to `src/data/sources.ts`.

## 1. Why, and phase order

The site must work as an educational source, not only as a scene. A visitor must be able to read what happened in each decade and check where each statement comes from.

Phase order changes again: a minimal info panel is pulled forward from Phase 6 and runs **before Phase 2b**, the same way the decade picker was pulled forward into Phase 3. Branch: `phase-3b-info-panel`.

## 2. Scope

In scope:
- 3–5 facts for each of the 8 eras, in Spanish and English, each with its source links.
- A panel that shows the facts for the current era.
- A Spanish / English switch for all on-screen text.
- The UI works when WebGL is not available.

Not in scope (stay in Phase 6): points to tap in the 3D scene, crossfades between eras, sound, camera-mode UI. Confidence badges are **not** shown (ruling in chat 2026-09-27).

## 3. Data

### 3.1 Bilingual text
```ts
// src/i18n/text.ts
export type Lang = 'es' | 'en';
export type Bilingual = { es: string; en: string };
```
No i18n library. Every visible string is a `Bilingual`. The types force both languages; a test forces both to be non-empty.

### 3.2 Facts — `src/data/facts.ts`
```ts
export interface Fact {
  text: Bilingual;
  sources: string[];   // keys of SOURCES in src/data/sources.ts, at least one
  inferred?: true;     // worked out by us from the sources, not stated in them
}
export const FACTS: Record<EraId, Fact[]>;
```
- 3–5 facts per era.
- Facts come from the research doc, mainly §2 (vessel, propulsion, anconeros, fares), §3 (timeline by decade) and §7 (human and cultural details).
- Only H or M research items are stated as fact. An item graded L in the research doc is left out, or it is written as a report ("según la historia oral…" / "family oral history says…").
- Spanish is written as Spanish, not word-for-word from the English.
- No confidence field: the badges were dropped, and the data does not keep what the UI does not use.

### 3.3 Era labels
`Era.label` and `Era.years` in `src/data/eras.ts` become `Bilingual` (for example `{ es: 'Las sogas', en: 'The ropes' }`, `{ es: 'décadas de 1930–1940', en: '1930s–1940s' }`). All readers of these fields read them through the current language.

### 3.4 UI strings — `src/i18n/strings.ts`
One object of `Bilingual` values for the panel and controls: button "Datos / Facts", "Cerrar / Close", "Fuente / Source", "Inferido / Inferred", the rail's `aria-label`, the language-switch labels, and the no-WebGL message.

## 4. Language state

- `lang: Lang` lives in the zustand store with `setLang`.
- URL: `?lang=es|en`, parsed in `src/state/url.ts` like the other params and written back with `history.replaceState` when it changes (same pattern as the decade picker). Invalid values are ignored.
- Default without `?lang`: `en` if `navigator.language` starts with `en`; otherwise `es`.
- `<html lang>` is set to the current language.
- A hook `useT()` returns a function that picks the current language from a `Bilingual`.

## 5. The panel

### 5.1 Open and close
- A "Datos / Facts" button next to the title card (top left). The panel starts closed.
- Next to it, an "ES | EN" toggle: two buttons, the current one marked `aria-pressed="true"`.
- Close: the panel's close button, the "Datos / Facts" button again, or Esc.

### 5.2 Layout
- Phone (narrow viewport): a sheet from the bottom, at most ~50% of the screen height, content scrolls inside. The decade rail stays visible and tappable above it.
- Wide viewport: a column on the right side, full height between the top edge and the rail.
- The 3D scene stays visible and live behind or beside the panel.

### 5.3 Content
- Heading: the era id, years and label, for example "1935 · décadas de 1930–1940 · Las sogas".
- A list of the era's facts. Under each fact: the title of each source as a link (`target="_blank" rel="noreferrer"`), and the tag "Inferido / Inferred" when `inferred` is set.
- If the era changes while the panel is open, the content changes to the new era and the panel stays open.

### 5.4 Keyboard and accessibility
- The panel is a non-modal dialog: `role="dialog"`, `aria-labelledby` its heading.
- On open, focus moves to the heading of the panel; on close, focus returns to the "Datos / Facts" button.
- Esc closes it. ← → still change the era while the panel is open (the rail's key handler already ignores typing targets; the panel has none).
- Text contrast meets WCAG AA over the panel background. Motion of the sheet is disabled under `prefers-reduced-motion`.

### 5.5 Without WebGL
The `<Canvas>` is wrapped in an error boundary. If WebGL is unavailable or the scene throws, the boundary shows a short message ("Tu navegador no puede mostrar la escena 3D…" / "Your browser cannot show the 3D scene…") and the title card, language switch, decade rail and panel still work.

## 6. Writing and checking the facts

1. I draft all facts in both languages from the research doc, with source IDs.
2. A review agent checks every fact against its sources: it opens each source URL and gives one verdict per fact — **supported**, **partly supported** or **not supported** — with a short quote or reason.
3. Partly or not supported → I rewrite the fact to match the source, or mark it `inferred`, or drop it.
4. A source does not open (paywall, dead link, blocked) → the agent checks the fact against the research doc's entry for that source and flags it.
5. The user gets one short list: only the flagged facts, each with the reason. Supported facts need no user review.

## 7. Testing

Unit (vitest):
- Every era has 3–5 facts.
- Every `Bilingual` in facts, era labels/years and UI strings has non-empty `es` and `en`.
- Every source ID in `FACTS` exists in `SOURCES`; every fact has at least one.
- `?lang` parsing and the browser-language default.

Component (vitest + `@testing-library/react`, `jsdom` environment per test file — both are new dev dependencies, test-only):
- The button opens and closes the panel; Esc closes it; focus returns to the button.
- The facts change when the era changes while the panel is open.
- The language switch changes the text and the URL.
- The error boundary shows the fallback and keeps the UI when the canvas throws.

E2E (playwright, phone viewport):
- Open the panel, see facts and source links, switch language, tap another decade on the rail while the panel is open, close with Esc; no console errors.

## 8. Done when

- All tests pass and the site builds.
- Every fact is supported by the review agent, marked inferred, or cleared by the user from the flagged list.
- The user checks the panel on a phone and on a computer.
