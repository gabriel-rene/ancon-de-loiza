# Phase 6b rulings (code-made sound)

## Main chunk size
Vite gzip of the main `index-*.js`: main 670.51 kB, this branch 671.45 kB, growth 0.94 kB (limit 2 kB). The sound code loads lazily as `assets/Sound-<hash>.js` (6.68 kB, 2.85 kB gzip) and is not requested until Sound is turned on.

## fps with Sound on (Metal flags, 1440x900, dpr 2, 10 s, better of two runs per row)

| Query | Tier | main fps | sound on fps | delta |
|---|---|---|---|---|
| 1984 ride | high | 86.8 | 86.2 | -0.7 % |
| 1984 ride | medium | 142.8 | 143.2 | +0.3 % |
| 1984 ride | low | 408.8 | 410.5 | +0.4 % |
| 1986 shore | high | 93.5 | 92.2 | -1.4 % |
| 1986 shore | medium | 155.7 | 155.8 | +0.1 % |
| 1986 shore | low | 467.4 | 470.8 | +0.7 % |

All rows are within 5 %.

## buildMs on the Mac
About 43.6 ms (1935 low) and 42.1 ms (1986 shore low) to synthesize all clips.

## Rulings made while building
1. Subagent commits carry their own model in the `Co-Authored-By` trailer.
2. The per-clip by-hand play check moved to the user's listening list below, because the in-app preview pane runs hidden and cannot play audio.
3. E2E in headless swiftshader reaches `running` without extra Chromium flags, so `playwright.config.ts` is unchanged. Extra checks added: `?era=1840&q=low` raises `shots` within 30 s; `?era=1986&q=low&cam=shore` reaches 3 or more voices within 15 s.
4. In the full `e2e:fast` run, 3 tests (picker, world 1935 ride, world 1975 bank) timed out waiting for `__ANCON_READY__` under swiftshader load with 2 workers; all three passed when re-run alone. They do not touch sound.

5. Work ran on branch `phase-6b-sound` in the main checkout (no worktree), as in Phases 5 and 6a.
6. Final review: the hull knock now fires when the hull meets the landing (end of `dock`), not at the start of `dock`; spec §2 row amended.
7. Final review: a small speaker icon sits beside the "Sound" label (spec §3 "speaker button"); the accessible name is unchanged.
8. Final review also fixed: Sound off threw an error in the dev server (StrictMode) and remembered-on sound could fail to start on touch devices.
9. User listen, 2026-10-02 (during 7b): the pole stroke sound is dropped in 1840–1925. It played every 3.5 s (two polers, 7 s stroke) at gain 0.6 and was heard as a steady, unnatural thump and hiss. The `pole` clip stays in `clips.ts` (debug panel only) so the seeds of the later clips do not change.

## Open for later (not blocking)
- Rope creak sounds from the hull centre.
- Bird calls come from both banks, so about half are far and quiet.
- Ten HRTF panners run on every tier; consider `equalpower` on low if phones struggle.
- `events.ts` copies the hauler phase and `strokeAt` formulas from `crew.ts` (drift risk).

## Listening checklist (for the user)
1. Open `?debug=1`, open **sound**, press each of the 10 clips; note any that sound wrong.
2. Turn on **Sound**; in 1935 Ride, listen through one crossing (creak, knock, birds, water).
3. 1840 Shore: no pole sound (water, birds, knock). 1984 Ride: cars driving on. 1986 Sky and Shore: bridge hum, no ferry sounds.
4. Change era once: sound fades out and back in.
