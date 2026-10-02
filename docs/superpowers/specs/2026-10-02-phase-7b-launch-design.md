# Phase 7b — Accessibility gaps and launch (approved in chat 2026-10-02)

Parent spec: [`2026-09-26-ancon-loiza-design.md`](2026-09-26-ancon-loiza-design.md) (§7 "Accessibility: keyboard operable, reduced-motion mode, readable contrast, text alternative (the info panels work without WebGL)"; §10 phase 7). Previous phase: [`2026-10-01-phase-7a-phones-design.md`](2026-10-01-phase-7a-phones-design.md).

## 1. Scope

User rulings in chat, 2026-10-02:

- **A11y scope: the 2D UI gaps plus keyboard look.** The visitor can look around the 3D scene with the keyboard (§2.1). This closes the biggest WCAG 2.1.1 gap.
- **Share card: a real scene frame plus the title** (§5.2). One image for both languages.
- **Favicon: the "A" from the El Ancón sign vector** (§5.1). The sign stays out of the 3D scene (memory ruling 2026-10-01).

Controller rulings (presented in chat, approved with the design):

- **Ambient motion keeps moving under reduced motion.** The ferry, water, birds, people and cars are the content, not decoration. Reduced motion stops only *eases and glides* (§3.2).
- **The sign file comes in by copy.** Only `docs/assets/el-ancon-de-loiza-sign.svg` is copied from branch `sign-svg` (PR #10). PR #10 stays open as it is.

Branch: `phase-7b-launch`. Merge to `main` only after the user approves.

Not in 7b: the timeline knob leader-line fix (user feedback 2026-10-01, a later UI pass); the open 6a art items; the open fact checks (3b, 4c, 5); an in-app reduced-motion toggle (the OS setting is enough); WebGL context-lost recovery; a service worker; Android tuning.

Audit baseline (2026-10-02): every control is already a native button; focus rings, Escape, `aria-*` state, the era live region, `<html lang>` and reduced motion for the era dip and camera presets are done. §2–§4 list only the gaps.

## 2. Keyboard and screen reader

### 2.1 Keyboard look

- The canvas wrapper gets `tabindex="0"`, an `aria-label` (§2.3) and a visible `:focus-visible` ring drawn inside its edge (same 2px `#f2c46d` as the buttons). No `role="application"`: screen-reader keys keep working.
- While the scene has focus:
  - **← / →** turn the view left / right. **↑ / ↓** tilt it up / down.
  - One key press turns a fixed step (`LOOK_STEP`, about 10° azimuth, 6° tilt). Holding the key repeats through the browser's key repeat.
  - **+ / −** zoom in / out where the view allows zoom (the same limits as the wheel). 
  - The same limits as the drag apply in every view (polar clamp, Shore's look-in-place, Ride's orbit clamp).
  - **"Right" means the picture turns right** in every view, also in Shore, which "grabs the world" with the pointer. A unit test pins the sign per view.
  - Recenter (R) shows and works the same as after a drag.
- Code: one pure function `lookKey(key, view, riding) → { dAz, dPol, dZoom } | null` in `src/scene/lookKeys.ts`; `Cameras.tsx` applies it with `CameraControls.rotate` / `zoom` (transition on unless reduced motion). In Ride the rig picks the step up through its existing input check (it compares where the controls hold the camera with its own last eye), so it keeps the new angle like a dragged one.

### 2.2 Who owns the arrow keys

- **← / →** step the era only when focus is **not** on the scene, not inside the Facts panel and not inside the Quality menu. Today the era keys are global (`src/ui/Timeline.tsx:48-56`); the guard goes in `src/ui/picker.ts` next to the "typing" check, as a pure function with tests.
- 1 / 2 / 3 and R stay global (they do not clash).

### 2.3 Structure and labels

- **`<h1>`:** the title card kicker "El Ancón de Loíza" becomes the page's only `<h1>` (same look). The era line stays a plain div.
- **`<main>`:** wraps the scene and the overlay UI in `App.tsx`. The timeline stays a `<nav>`.
- **Skip link:** the first focusable element, "Saltar a la línea del tiempo" / "Skip to timeline", visible only on focus, moves focus to the selected era button.
- **Scene label:** the canvas wrapper's `aria-label` names the scene, the era and the keys, from `src/i18n/strings.ts`, e.g. "Vista 3D del ancón, 1975. Flechas para mirar alrededor." / "3D view of the ferry, 1975. Arrow keys look around." It updates with era and language.
- **Recenter:** when the Recenter button appears, the existing polite live region says "Recentrar disponible" / "Recenter available" once. It says nothing when the button goes away.
- **Era announcer outside the boundary:** `<EraAnnouncer />` moves out of `<SceneBoundary>` so era changes are announced without WebGL too.

### 2.4 Quality menu

- The menu closes when focus leaves it (a `focusout` whose `relatedTarget` is outside the menu and its button). Focus is not pulled back in that case.
- Home / End jump to the first / last item.

### 2.5 Without WebGL or JavaScript

- **No WebGL:** the Facts panel opens by itself once, after the fallback message shows. The fallback gets an explicit `z-index` above the scene layer.
- **No JavaScript:** a `<noscript>` block in `index.html`, styled like the load card, in both languages: the site needs JavaScript and WebGL; a link to the research dossier on GitHub for the text.

## 3. Contrast and motion

### 3.1 Contrast (WCAG AA: 4.5:1 text, 3:1 non-text UI)

- **One backing token** `--glass: rgba(12, 15, 15, 0.65)` — the lowest alpha that keeps `#f4ecdf` at 4.5:1 over pure white. Used by the title card, the map credit, the timeline, and the toolbar buttons and groups (today 0.55; added here because the toolbar fails the same worst case).
- **Title card and map credit:** a blurred `--glass` pill, not only a text shadow. The 11px kicker opacity goes to 1.
- **Timeline:** backing from `rgba(12,15,15,0.42)` to `--glass`. The era sublabel opacity from 0.75 to at least 0.9. The rail line and leaders go to alpha 0.6 (3:1 against the backing).
- **Load card and era dip:** the gradient's centre stop goes from `#8a7556` to `#75624a` (in `index.html` and `--era-dip`), and the small kicker and the dip label go to opacity 1, so they reach 4.5:1; the big year stays as it is.
- **Measured, not guessed:** a unit test computes the contrast ratio for each listed text/backing pair from the CSS values (worst case: backing alone over pure white sky, i.e. the backing alpha blended on `#ffffff`).

### 3.2 Reduced motion

- Under `prefers-reduced-motion: reduce`, CameraControls gets `smoothTime` and `draggingSmoothTime` of 0: no glide after letting go of a drag, no glide on keyboard steps.
- Everything already reduced (era dip, presets, Ride entry, recenter, load card, Facts slide) stays.
- Ambient motion is unchanged (§1 ruling).

## 4. Touch targets

No change. Inline source links and the map credit link are exempt (WCAG 2.5.8 inline exception); the map credit link gets a `:focus-visible` ring like the Facts links.

## 5. Launch

All new static files live in a new `public/` folder (Vite copies it to `dist/` with the `/ancon-de-loiza/` base).

### 5.1 Favicon and icons

- Source: the `glyph-A` path from `docs/assets/el-ancon-de-loiza-sign.svg`, filled cream `#f4ecdf` on a rounded square of the load-card brown `#5e4d38`.
- Files: `public/favicon.svg`, `public/favicon-32.png`, `public/apple-touch-icon.png` (180×180, no transparency).
- The PNGs are made by a script (`scripts/make-icons.ts`, run by hand, output committed) from the SVG.
- `index.html`: `<link rel="icon" type="image/svg+xml">`, the PNG fallback, `apple-touch-icon`, and `<meta name="theme-color" content="#3f3426">`.

### 5.2 Share card

- `public/share-card.jpg`, 1200×630, under 300 KB.
- Picture: the default view (Ride, golden hour, era 1975) from the production build with `?freeze=1&q=high`. The user approves the image before merge.
- Text: "El Ancón de Loíza" in the load-card serif, cream, bottom left, with "1840–1986" under it, on a soft dark gradient. No other words.
- Made by `scripts/make-share-card.ts` (Playwright against `npm run preview`: one screenshot of the scene, then one screenshot of a small HTML page that sets the text over it). Run by hand; the image is committed.
- `index.html` meta:
  - `og:type` website, `og:site_name`, `og:title` "El Ancón de Loíza", `og:url` and `<link rel="canonical">` `https://gabriel-rene.github.io/ancon-de-loiza/`.
  - `og:description` and `<meta name="description">`, Spanish first then English, one line each, e.g. "El ancón del Río Grande de Loíza, Puerto Rico, en 3D, de 1840 a 1986. · The Loíza river ferry, Puerto Rico, in 3D, 1840–1986."
  - `og:image` (absolute URL), `og:image:width/height/alt`, `og:locale` `es_PR`, `og:locale:alternate` `en_US`.
  - `twitter:card` `summary_large_image` (the `og:` tags cover the rest).
- The static `<html lang>` becomes `es` (the default language; the script still sets it before the bundle runs).

### 5.3 404 page

- `public/404.html`, a standalone page (GitHub Pages serves it for any unknown path under the site).
- Look: the load card — same brown gradient, serif, cream text, the favicon.
- Text in both languages: "Esta página no existe." / "This page does not exist." and one link "Volver al ancón · Back to the ferry" to `/ancon-de-loiza/`.
- No JavaScript. `noindex`.

### 5.4 README

Rewritten for launch:

- One-paragraph intro, live link, the share card image.
- What you can do: pick an era on the timeline, three views, Facts with sources, sound, quality.
- Keyboard: Tab, ← → (era), arrows on the scene (look), 1 / 2 / 3, R, Escape, + / −.
- Accessibility notes: reduced motion, the no-WebGL fallback.
- Roadmap: phases 0–7 checked, with one line each; open items point to the rulings notes.
- Research, design, development commands, stack, acknowledgements (kept).

## 6. Tests

- **Unit:** `lookKey` (every key, every view, the "right is right" sign, limits); the arrow-key owner guard; the Quality menu `focusout` close and Home/End; contrast ratios (§3.1); scene label text per era and language; the skip link target; the no-WebGL fallback opens Facts once and still announces era changes.
- **E2E (Playwright, production build):**
  - Tab order from the top: skip link → … → every control → the scene; Enter on the skip link focuses the selected era.
  - Focus on the scene, press → several times: the camera azimuth changes and the era does not.
  - The built `index.html` has every meta tag in §5.1–§5.2 and every linked file returns 200; `404.html` is in `dist/`.
- `npm test`, `npm run build` and `npm run e2e:fast` green; snapshot diffs only where §3.1 changes the UI.

## 7. Done when

- §6 is green.
- The user checks on the iPhone: the share card preview (paste the link in Messages), the favicon in a Safari tab, the 404 page, and VoiceOver reads the title, the timeline and the scene label.
- Notes and rulings in `docs/superpowers/notes/phase-7b-rulings.md`.
