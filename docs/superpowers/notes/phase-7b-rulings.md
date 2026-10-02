# Phase 7b rulings (accessibility gaps and launch)

Spec: [`../specs/2026-10-02-phase-7b-launch-design.md`](../specs/2026-10-02-phase-7b-launch-design.md). Plan: [`../plans/2026-10-02-phase-7b-launch.md`](../plans/2026-10-02-phase-7b-launch.md).

## User rulings (spec §1, 2026-10-02)

- **A11y scope: the 2D UI gaps plus keyboard look.** The visitor can look around the 3D scene with the keyboard. This closes the biggest WCAG 2.1.1 gap. (2026-10-02)
- **Share card: a real scene frame plus the title.** One image for both languages. (2026-10-02)
- **Favicon: the "A" from the El Ancón sign vector.** The sign stays out of the 3D scene. (2026-10-02)

## Controller rulings

- **Ambient motion keeps moving under reduced motion.** The ferry, water, birds, people and cars are the content, not decoration. Reduced motion stops only eases and glides (CameraControls `smoothTime` and `draggingSmoothTime` of 0). (2026-10-02)
- **The sign file comes in by copy.** Only `docs/assets/el-ancon-de-loiza-sign.svg` was copied from branch `sign-svg`; the copy is byte-identical. PR #10 is untouched and stays open. (2026-10-02)
- **Glass alpha 0.65.** `--glass` is `rgba(12, 15, 15, 0.65)`, the lowest alpha that keeps `#f4ecdf` at 4.5:1 over pure white. The toolbar buttons and groups moved from 0.55 to 0.65 as well, because they fail the same worst case. (2026-10-02)
- **Dip and load-card colour.** The gradient centre stop went from `#8a7556` to `#75624a` (in `index.html` and `--era-dip`), so the small kicker and the dip label reach 4.5:1. The big year stays as it was. (2026-10-02)
- **Keyboard zoom builds on the end value.** The dolly reads the end radius (`getSpherical(tmp, true).radius`) and the lens zoom is additive (`zoom(LOOK_STEP.zoom * dZoom)`), so held or quick + and − add up. Cost: Shore's lens step is now +0.1 absolute instead of ×1.1, about the same over its 1–1.3 range. (2026-10-02)
- **Quality menu ignores a `focusout` with no `relatedTarget`.** iOS Safari taps do not focus buttons, so a tap on an item would otherwise close the menu before the click lands. (2026-10-02)
- **One look-key sign for all views.** "Right" turns the picture right in Ride, Sky and Shore. Shore's inverted drag ("grab the world") is pointer-only. A unit test pins the sign per view. (2026-10-02)
- **R1: skip-link e2e starts from a fresh load.** After the 24-Tab sweep the test reloads the page, then presses Tab and Enter. `page.locator('body').focus()` does not work, because Chrome keeps the sequential-focus start point on the last focused element. (2026-10-02)
- **R2: React blur test.** If `fireEvent.blur` does not reach React's `onBlur` (React listens to `focusout`), the test uses `fireEvent.focusOut` with the same `relatedTarget`. (2026-10-02)
- **Recenter live text is "Centrar disponible".** The spec said "Recentrar disponible"; the text now matches the "Centrar" button. (2026-10-02)
- **Pointer clicks do not focus the scene frame (final review).** Mouse users keep ← → for eras; keyboard users Tab in to look. (2026-10-02)
- **The phase5 snapshot baselines were stale** from earlier phases (old toolbar and timeline), so the refresh cannot show that only §3.1 changed. (2026-10-02)
- **Scene focus ring is drawn as an `::after` overlay.** An outline on the frame is hidden under the R3F canvas wrapper. (2026-10-02)
- **Co-author trailer.** Each commit carries the `Co-Authored-By` line of the model that wrote it. (2026-10-02)

## Found while building

- **Playwright and `launchOptions`.** `test.use({ launchOptions })` is not allowed inside a `describe` group (it forces a new worker). The no-WebGL e2e launches its own Chromium with `--disable-webgl --disable-3d-apis` and a fresh context instead. The assertions are as in the plan. (2026-10-02)
- **No-WebGL fallback works as built.** With WebGL off, the scene throws into `SceneBoundary`, the fallback shows, Facts opens by itself, and `EraAnnouncer` (outside the boundary) still says "Now showing: 1984" after an era click. No fix was needed. (2026-10-02)
- **e2e under load.** The full `npm run e2e:fast` run (6 workers, 39 min) had 3 timeouts, all of which pass alone with `--workers=1`: the decade-picker title check, the quality-button test and one 1935 world render (SwiftShader ready timeouts). Result: 56 passed in the full run, 3 flaky under load, no code change. (2026-10-02)
- **Snapshots.** `tests/snapshots/phase5/*.png` were regenerated for the glass backing (title pill, darker timeline, toolbar). (2026-10-02)

## Open items for the user

- **Share card image waits for your approval.** The title overlaps the bottom of the front cars in `public/share-card.jpg`. The image was sent to you in chat; merge waits for your word. (2026-10-02)

### iPhone checklist (user)

- [ ] Paste https://gabriel-rene.github.io/ancon-de-loiza/ in Messages: the share card shows.
- [ ] Safari tab shows the A favicon; Add to Home Screen shows the brown A icon.
- [ ] https://gabriel-rene.github.io/ancon-de-loiza/nope shows the 404 page; its button goes home.
- [ ] VoiceOver reads the title (heading level 1), the timeline, and the scene label.

### Deferred minors (from the reviews; none blocks merge)

- `reduced` motion is read at render time, not live when the OS setting changes (same as the rest of the app).
- The camera look effect in `Cameras.tsx` has no unit test; it is covered by the e2e and a browser check.
- Switching language while off-front re-announces "Recenter available" in the new language.
- The `SceneBoundary` test does not assert the "once" part (the panel stays closed after Close and a rerender).
- `EraAnnouncer` announces on first load in dev (StrictMode double effect). Dev only.
- The share-card script has a dead `.fps-readout` selector in its hide CSS, and `ui-serif` varies per OS.
- The head test checks that the PNGs exist, not their size or opacity.
- The contrast test's `opacity()` defaults to 1 when absent and `decl()` reads only the first matching rule.
