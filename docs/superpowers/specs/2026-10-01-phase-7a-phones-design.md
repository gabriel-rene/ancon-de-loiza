# Phase 7a — Phones and speed (approved in chat 2026-10-01)

Parent spec: [`2026-09-26-ancon-loiza-design.md`](2026-09-26-ancon-loiza-design.md) (§5 "Performance targets: 60 fps on Apple-silicon laptop at 1440p; ≥30 fps on a recent phone with a 'low' quality tier … Auto-detect tier, manual override"; §10 phase 7). Previous phase: [`2026-10-01-phase-6b-sound-design.md`](2026-10-01-phase-6b-sound-design.md).

## 1. Scope

User rulings in chat, 2026-10-01:

- **Phase 7 is split in two.** **7a** = phones and speed (this spec). **7b** = accessibility gaps and launch (share card, favicon, 404 page, README).
- **Test phone: iPhone 16 Pro.** All phone targets in §6 are measured on it.
- **Best look that stays smooth.** The site tries a higher tier and steps down when it is slow (§2). Strong phones are no longer locked to `low`.
- **Try, then step down** (not a speed test before the scene shows). Never step up by itself.
- **A small quality button** in the toolbar: Auto, High, Medium, Low (§3).
- **A calm title card** while the site loads: title, era year, a progress line (§4). No facts on the card.

Branch: `phase-7a-phones`. Merge to `main` only after the user approves.

Not in 7a: new quality tiers or new tier settings (the three tiers in `src/quality.ts` stay as they are, unless §5 measurement shows one setting is the main cost); auto step-up; Android-specific tuning (no Android test phone); any 7b item; a service worker or offline mode.

## 2. Auto quality (the governor)

### 2.1 Start tier

`detectQuality()` in `src/quality.ts` changes:

| Device | Start tier |
|---|---|
| Touch (`pointer: coarse`) and `navigator.deviceMemory` reported and ≤ 4 | `low` |
| Other touch devices (this includes every iPhone: Safari does not report `deviceMemory`) | `medium` |
| Not touch, `hardwareConcurrency` ≤ 4 | `medium` |
| Not touch, other | `high` |

### 2.2 Which tier wins

1. `?q=high|medium|low` in the URL: used for this visit; auto is off; not saved.
2. A hand pick saved from the quality button (§3): auto is off.
3. Otherwise **Auto**: start tier from §2.1, then the governor.

The governor is also off with `?freeze=1`, `?perf=1` or `?debug=1` (screenshots and perf runs need a fixed tier; the Leva quality control still works in debug).

### 2.3 Rules

All times are wall-clock seconds; fps = frames ÷ elapsed time over the window.

- **First check.** After the scene is ready (`__ANCON_READY__`), wait 2 s, then measure for 4 s. Under **40 fps** → step down one tier.
- **Keep watching.** After the first check, measure in rolling 10 s windows. A window under **30 fps** → step down one tier.
- **Settle after a step.** After any step (or any era change), wait 2 s, then run a new 4 s first check on the new tier (same 40 fps rule).
- **Pause.** No measuring while the era dip runs, while the tab is hidden (`document.hidden`), or for 2 s after the tab comes back. A paused window is thrown away, not counted.
- **Floor.** Never below `low`. On `low`, the governor stops.
- **Never up.** The governor never raises the tier.

### 2.4 How a step looks

A step goes through the existing dip (`src/ui/dipController.ts`, `src/ui/dipMachine.ts`): fade to dark, swap the tier at the bottom, fade in. The era stays. With reduced motion, the dip is the existing instant cut. The dip machine gets a generic "swap at the bottom" action, so era changes and tier changes share one path; an era change and a tier step asked at the same time run in one dip.

### 2.5 Code

- `src/state/qualityGovernor.ts`: the rules in §2.3 as a pure state machine (`tick(dt, frameCount, paused)` → `'stay' | 'down'`). No three.js, no DOM. Unit tested.
- A small React/R3F hook feeds it frame counts and pause state and calls the dip on `'down'`.
- `window.__ANCON_QUALITY__` exposes `{ tier, mode: 'auto' | 'hand' | 'url' | 'off', steps }` for e2e and phone checks; a test hook can force a fake fps.

## 3. Quality button

- One button in the toolbar, next to the sound button. Label shows the state, e.g. "Auto · Medium" / "Auto · Media", or "High" / "Alta" for a hand pick.
- Tapping it opens a small menu: **Auto, High, Medium, Low** (Spanish: **Auto, Alta, Media, Baja**).
- A hand pick sets the tier at once (through the dip) and turns auto off. Picking Auto turns it back on, starting from the §2.1 start tier.
- Saved in `localStorage` key `ancon.quality` (`auto|high|medium|low`), same pattern as `src/sound/prefs.ts`: any storage failure means Auto.
- Keyboard and screen reader: a button with `aria-haspopup="menu"` and `aria-expanded`; a menu with `role="menuitemradio"` and `aria-checked`; arrow keys move, Enter/Space picks, Esc closes and returns focus. Touch size as the other toolbar buttons. Bilingual strings in `src/i18n/strings.ts`.
- When `?q=` is in the URL, the button shows that tier and a pick replaces `?q=` (the URL drops `q`).

## 4. Title card while loading

- Plain HTML and CSS inside `index.html` (id `load-card`), plus a tiny inline script. It shows before the 2 MB bundle arrives.
- Content: "El Ancón de Loíza", the era year from `?era=` (default era otherwise), and a thin progress line. No facts.
- Language: `?lang=` if set, else the `detectLang` rule (English browsers → English, others → Spanish). The inline script copies this rule; a unit test checks both agree.
- The line moves in three real steps, never faked: bundle running (⅓) → scene mounted (⅔) → ready, 30 frames drawn (full). The app sets the steps through `document.body.dataset.load`.
- At ready: the card fades out (0.6 s) and is removed. With `prefers-reduced-motion`, it is removed at once.
- If WebGL fails, the card is removed and the existing `SceneBoundary` message shows.
- The card looks like the existing era dip: same dark tone and type as `src/ui/EraDip.tsx`, so card → scene feels like one fade.

## 5. Load size, touch, and the phone check

- **Measure first.** Build and serve on the Mac's local network (`vite preview --host`). The iPhone opens that address. A new `?fps=1` shows a small on-screen fps number and the current tier (no Leva, no StatsGl). Record: time to card, time to ready, ride fps per tier, fps after 5 minutes.
- **Fix the biggest one or two costs** that the measurement shows (for example shader compile, vegetation placement, or a tier setting). Each fix is recorded in `docs/superpowers/notes/phase-7a-rulings.md` with before/after numbers.
- **Vendor chunk.** Split `three`, `@react-three/*` and `postprocessing` into their own chunk so repeat visits keep it cached across deploys.
- **Touch.** `touch-action: none` on the canvas, so dragging to look never scrolls or zooms the page. Check that pinch-zoom on the page is still possible outside the canvas.
- **Layout.** Check portrait and landscape on the iPhone: toolbar, timeline, view switch and the new button do not overlap and respect the safe areas.

## 6. Targets (iPhone 16 Pro, home Wi-Fi, Safari)

| What | Target |
|---|---|
| Title card visible | < 1 s |
| Scene ready (`__ANCON_READY__`) | < 10 s, first visit |
| Ride view fps on the tier Auto settles on | ≥ 40 |
| After 5 minutes in Ride view | Auto has settled; ≥ 30 fps; no more than one step after the first check |
| Desktop (Apple-silicon laptop, 1440p) | Still ≥ 60 fps on `high` in Ride view; Auto stays on `high` |

## 7. Tests

- **Unit (vitest):**
  - Governor: steps down under 40 fps in the first check; under 30 fps in a 10 s window; never steps up; ignores paused windows; stops at `low`; re-checks after a step and after an era change.
  - Tier precedence (§2.2): URL beats hand pick beats Auto; governor off with `?freeze`, `?perf`, `?debug`.
  - `detectQuality` table (§2.1).
  - Quality prefs: save, load, storage failure → Auto.
  - Quality button: opens, keys move and pick, Esc closes, labels in both languages.
  - Title card language rule matches `detectLang`.
  - Dip machine: tier swap at the bottom; era + tier in one dip.
- **E2E (Playwright, production build):**
  - The title card shows, then is gone after ready.
  - The button changes the tier (`__ANCON_QUALITY__`) and survives a reload.
  - A forced fake fps of 20 makes Auto step down one tier through the dip.
  - Phone viewport: dragging on the canvas does not scroll the page.
- **By hand (user, on the iPhone):** look, smoothness, feel after 5 minutes, portrait and landscape.
