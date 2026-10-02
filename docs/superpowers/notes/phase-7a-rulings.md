# Phase 7a rulings (phones and speed)

Spec: [`../specs/2026-10-01-phase-7a-phones-design.md`](../specs/2026-10-01-phase-7a-phones-design.md). Plan: [`../plans/2026-10-01-phase-7a-phones.md`](../plans/2026-10-01-phase-7a-phones.md).

## Main chunk size

| Chunk | Before (main) | After |
|---|---|---|
| `index-*.js` | 2,028.95 kB (671.80 kB gzip) | 635.34 kB (225.94 kB gzip) |
| `vendor-3d-*.js` (three, @react-three/*, postprocessing, n8ao, three-custom-shader-material, camera-controls) | — | 1,398.99 kB (447.77 kB gzip) |
| `DebugPanel-*.js` (Leva, `?debug=1` only) | 207.50 kB | 207.59 kB |

The total first-visit download is about the same. The gain is on repeat visits: a deploy that changes only app code leaves `vendor-3d` cached.

## Desktop fps, branch vs main

`scripts/dev/perf.mjs`, Metal flags, 1440×900, dpr 2, 10 s. Runs were interleaved (branch, main, branch, main), because this Mac ran slower tonight than at 6b time, and the non-interleaved runs were not comparable.

| Query | Tier | branch fps | main fps |
|---|---|---|---|
| 1984 ride | high | 69.9 / 70.1 | 69.9 / 68.5 |
| 1986 shore | high | 63.6 / 63.6 | 62.9 / 64.3 |
| 1984 ride | low | 165.1 / 166.6 | 166.2 / 167.0 |

All rows are within 2 %. High stays at 60 fps or more. On a non-touch Mac with more than 4 cores, Auto starts on High.

## Rulings made while building

1. **Governor test window.** One plan test ran a single 10 s window at 25 fps right after a 35 fps stretch. That window closes mid-run as a pass, so the test now runs two windows. The governor rule is unchanged.
2. **`__ANCON_READY__` waits for the load card.** At frame 30, `body[data-ready]` fills the bar and the card fades (0.6 s). `__ANCON_READY__` is set only after the card is removed. This means every screenshot and perf script (all of them wait on `__ANCON_READY__`) never catches the card mid-fade, and none of them had to change. Cost: ready comes about 0.7 s later.
3. **Fake fps also drives the hitch guard.** Under SwiftShader every frame is longer than 0.5 s, so the "pause on a long frame" rule paused the governor forever in e2e. With the test hook `__ANCON_FAKE_FPS__` set, the guard uses the fake frame time. Real devices never set the hook.
4. **Quality menu placement.** At phone widths the toolbar wraps, and a right-anchored menu could leave the screen. The menu is now placed by a small pure function (`src/ui/menuPlacement.ts`) that keeps it inside the viewport at any width.
5. **Toolbar above the Facts sheet** (`z-index` 21). On a phone the open Facts sheet hid the bottom of the quality menu, so "Low" could not be picked. An e2e at 402×600 checks this.
6. **Governor never stuck.** If a dip ends with no change (for example, Auto picked during an auto step), the governor resets itself, so Auto keeps watching.
7. **Slow e2e timeouts.** The quality-button test and the phone step-down test have a 240 s timeout. Each takes 1.5–2 minutes alone under SwiftShader. The governor timings are not changed.
8. **The phone check waits for you.** The iPhone measurement and the "fix the one or two biggest costs" step (spec §5) need your phone. See below.

## Open items for the user

### iPhone 16 Pro checklist (spec §5–§6)

1. On this Mac, run:

   ```bash
   npm run build && npx vite preview --host --port 4173
   ```

   You can also use the `ancon-preview` launch config.
2. Put the iPhone on the same Wi-Fi. In Safari, open `http://192.168.4.21:4173/ancon-de-loiza/?fps=1`. If the Mac's address changed, run `ipconfig getifaddr en0` to get the new one.
3. Write down these numbers:
   - **Time to card:** time until the brown card with the year shows. Target: under 1 s.
   - **Time to ready:** time until the card fades and the scene shows. Target: under 10 s on the first visit.
   - **Auto tier:** the tier the readout shows after about 10 s, for example "Media (auto)", and the fps. Target: 40 fps or more in Ride view.
   - **After 5 minutes in Ride:** the tier and fps. Target: 30 fps or more, and at most one step after the first check.
   - **Each tier by hand:** pick High, Medium and Low with the quality button. Write down the fps in Ride for each.
4. Check these by eye:
   - **Portrait and landscape:** the toolbar, timeline, view switch and quality button must not overlap.
   - **Facts open + quality menu:** every menu item must be visible and easy to tap.
   - **A tier step:** a step shows the same brown fade as an era change, with the current year. This is expected.
   - **Drag to look around:** the page must not scroll or zoom.
   - **Safe areas:** `index.html` has no `viewport-fit=cover`, so Safari adds bars in landscape and the safe-area rules in `styles.css` have no effect. This is fine as it is. Keep it in mind when you judge landscape.
5. Send me the numbers. I then fix the one or two biggest costs and write the before and after numbers in this file.

### Deferred minors (from the reviews; none blocks merge)

These are listed in the final review. Main ones:
- Desktop-only e2e coverage for touch: the `touch-action` test passes even without the CSS rule, because camera-controls sets the same style inline.
- While the quality menu is open, Tab leaves it open, and ← → still change the era.
- Under `?freeze` / `?debug`, picking Auto shows the tier as checked, not Auto.
- `steps` counts an auto step whose dip ends with no change.
- Optional: put `react-dom` in a vendor chunk to save about 180 kB gzip per deploy for repeat visitors.
