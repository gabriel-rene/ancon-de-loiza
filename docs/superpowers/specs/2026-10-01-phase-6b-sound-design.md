# Phase 6b — Sound (approved in chat 2026-10-01)

Parent spec: [`2026-09-26-ancon-loiza-design.md`](2026-09-26-ancon-loiza-design.md) (§ Sound: "ambient river, birds, rope creak, distant plena on Sundays in 1975/1984 (CC0 or self-made), muted by default, toggle"). Previous phase: [`2026-09-30-phase-6a-design.md`](2026-09-30-phase-6a-design.md).

## 1. Scope

User rulings in chat, 2026-10-01:

- **All sound is made in code** (Web Audio). No audio files, no licenses.
- **No plena.** No source puts plena at the ferry on Sundays; the parent spec line is dropped.
- **Five sound groups:** river water, birds (calls and wing flaps), ferry work (pole or rope), hull knock at docking, cars (ferry load and 1986 bridge).
- **3D sound.** Sounds come from where their thing is in the scene and follow the 360° look. The river is all around.
- **Minimal mix (user, 2026-10-01, after listening).** The water is a quiet bed; the details (creak, chirps, knock, poles) stand out. Wind is dropped (it sounded like the water). The heron croak is dropped (it did not sound like a bird); calls are short chirps. Bridge traffic is a low hum with no hiss.
- **Clips are built once, at start.** When sound turns on, code renders short clips into buffers; the scene then plays them with small random pitch and rate changes. No live synthesis per frame.

Branch: `phase-6b-sound`. Merge to `main` only after the user approves.

Not in 6b: plena or any music; ox, horse or bicycle sounds (1925 animals are on screen only briefly); voices of crew or riders; sound in the title card; per-sound volume controls; audio files of any kind.

## 2. What plays, and when

Era facts used: the ferry is pushed with **poles** in 1840, 1900 and 1925, and pulled on **ropes** in 1935–1984 (`ancon.propulsion` in `src/data/eras.ts`). In 1986 it is moored (`'moored'`). Cars ride the ferry from 1925 (`LegRule.cars`).

| Sound | When | Source in the scene |
|---|---|---|
| River water (loop) | Always | All around (not positional). Level by view: Ride high, Shore mid, Sky low |
| Bird calls: short chirps (one-shots) | Random, every few seconds; rate × 0.2 when the sun is below the horizon | The wading birds (`src/fauna/waders.ts`) |
| Wing flaps (one-shot) | When a wader flushes at docking (never in 1986, same rule as Phase 5) | That bird |
| ~~Pole push and splash (one-shot)~~ | Dropped (user, 2026-10-02): one per stroke was a steady thump and hiss. The clip stays in `?debug=1` only. | — |
| Rope creak (one-shot) | Each haul while the ferry moves; 1935–1984 | The ferry (`useVesselPose`) |
| Hull knock (one-shot) | End of the `dock` phase, when the hull meets the landing (ruling 2026-10-01); not in 1986 | The ferry |
| Engine hum (loop per car) | While a car drives on or off (`load`, `unload`); 1925–1984 | That car (`src/traffic/TrafficSet.ts`) |
| Traffic hum (loop) | Always in 1986; very quiet | The bridge lanes (`src/traffic/bridgeTraffic.ts`), one source per lane at the car nearest the listener |

Cars stay quiet and far-sounding: a low, filtered hum, never a revving engine.

## 3. Control

- **Off at the start.** Browsers block sound until a click, so on-at-start is not possible anyway.
- **One speaker button in the toolbar** (`src/ui/Toolbar.tsx`), after the language switch. `aria-pressed` shows the state; the label is "Sound" / "Sonido" (`STRINGS`). Keyboard: normal button.
- **The choice is remembered** in `localStorage` (key `ancon.sound`). On a later visit with sound remembered on, the button shows on, and sound starts at the first click or key press anywhere on the page (the browser unlock rule). All `localStorage` calls are wrapped in try/catch; failure means "off".
- **Era change:** master volume follows the 6a dip: `gain = 1 − dip opacity` (`machine.opacity` in `src/ui/dipController.ts`).
- **Tab hidden:** the audio context suspends; it resumes when the tab shows again.
- **Reduced motion** does not change sound.

## 4. Code shape

New folder `src/sound/`. Each unit has one job.

1. **`clips/`** — one pure function per sound: `(seed, sampleRate) → Float32Array`. Built from noise, filters and envelopes in plain TypeScript (no `AudioContext`), so they run in unit tests. Same seed → same samples. Loops are seamless (first and last samples match within a small tolerance).
2. **`mix.ts`** — pure: `(view, era, crossing phase, sun height, dip opacity) → levels` for each sound group.
3. **`events.ts`** — pure: given the previous and current clock and the existing schedules (crossing phases from `src/ancon/crossing.ts`, haul or pole stroke timing, fauna event times from `src/fauna/clock.ts`, traffic trips), returns the one-shots that fire in that step. Never fires the same event twice across a frame boundary.
4. **`engine.ts`** — owns the `AudioContext`: unlock on user gesture, build `AudioBuffer`s from the clips once, master gain, suspend and resume on tab visibility. Voice pool of **12**; when full, the quietest or oldest voice is dropped.
5. **`Sound.tsx`** — R3F component: puts a `THREE.AudioListener` on the active camera, places `PositionalAudio` sources at the ferry, birds and cars each frame (reusing objects, no per-frame allocation), applies `mix.ts` levels and `events.ts` one-shots.
6. **Store and button** — `soundOn` and `setSound` in `src/state/store.ts`; the button in `Toolbar.tsx`.

**Lazy load.** `engine.ts`, `clips/` and `Sound.tsx` are in a separate chunk, loaded with `import()` the first time sound turns on. A visitor who never turns sound on downloads none of it.

**Debug.** With `?debug`, the debug panel lists every clip with a play button, so the user can listen to each one alone.

## 5. Limits

- At most **12 voices** play at once.
- All clips are built in **< 500 ms** on the low quality tier.
- **fps within 5 %** of `main` on all quality tiers, sound on, same method as 6a.
- The main chunk grows by **< 2 kB** gzipped (button and store only).

## 6. Testing

- **Unit:** each clip is deterministic, has no NaN, peaks within [−1, 1], has its set length, and loops are seamless; `mix.ts` levels per view, era and dip; `events.ts` fires each event once and only in the right eras (no poles after 1925, no ropes before 1935, no knock or flaps in 1986, no ferry cars in 1840 and 1900); voice pool never goes above 12.
- **Store and button:** toggles `aria-pressed`; writes and reads `localStorage`; a throwing `localStorage` gives "off".
- **E2E:** clicking the button turns sound on (a test hook reports the audio context state `running`); the choice survives a reload; the sound chunk is not requested while sound stays off.
- **By ear (user):** the user plays each clip in the debug panel and then listens in each view. Clips the user rejects are fixed before merge.

## 7. Done when

- All sounds in §2 play at the right times, from the right places, in the right eras.
- The button works, is remembered, and the sound chunk loads only on demand.
- Unit and E2E tests pass; limits in §5 hold.
- The user has listened and approved the sound.
