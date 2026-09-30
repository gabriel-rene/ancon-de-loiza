# Phase 6a — Look: timeline, era transition, camera modes (approved in chat 2026-09-30)

Parent spec: [`2026-09-26-ancon-loiza-design.md`](2026-09-26-ancon-loiza-design.md) (§10 phase list: "6. Timeline UI, transitions, sound, camera modes"). Previous phase: [`2026-09-30-phase-5-fauna-design.md`](2026-09-30-phase-5-fauna-design.md).

## 1. Scope

User rulings in chat, 2026-09-30:

- **Phase 6 is split in two.** **6a** = timeline + era transition + camera modes (all visual). **6b** = sound (needs audio files and licenses; separate spec).
- **Era transition: dip and swap** (§3), not a live morph. Only one era is on screen at a time.
- **Timeline: a true-scale line** from 1820 to 1986 (§2), not polished equal buttons.
- **Camera: 3 public views** — Ride, Shore, Sky — with a switch (§4). No free fly.
- **360° look in all 3 views; the camera stays where the visitor leaves it** (§4.2). A recenter control brings back the front view. This replaces the ride view's ease-back.

Branch: `phase-6a-look`. Merge to `main` only after the user approves.

Not in 6a: sound (6b); free-fly or walking cameras; the first-person car drive onto the ferry (future release); a play/auto-tour button; per-era thumbnails; live morphing between eras; the 1986 ride view framing the bridge (deferred since 4c, stays deferred).

### 1.1 Frame rule (user ruling, 2026-09-28)

Build only what the cameras show. The visitor can turn and zoom, never move the camera to a new place (§4.3), so no new land, roads or plants are needed.

## 2. Timeline

Replaces `src/ui/DecadePicker.tsx` (the "decade rail").

### 2.1 Look

- A thin horizontal line at the bottom of the screen, 1820 at the left, 1986 at the right.
- The x position of each era is linear in its year (`ERAS[i].id` as a number). Real gaps show: 1840→1900 is long, 1984→1986 is short.
- 8 marks, one per era. Each mark shows the year and the era label (`t(e.label)`) in the current language.
- Labels that would overlap (1984 and 1986; any pair closer than the label width) are staggered: alternate labels sit above and below the line. The layout function decides this from measured widths, not from a hard-coded list.
- The current era's mark is highlighted and carries a knob.

### 2.2 Input

- **Tap or click a mark** → choose that era.
- **Drag the knob** along the line; on release it snaps to the nearest mark (nearest by x on screen). While dragging, the mark under the knob is shown as the target; the era does not change until release.
- **← →** step one era, as now (same rules: ignored while typing, with modifier keys, or at the ends).
- The URL stays in sync (`?era=`), as now (`withEra`).

### 2.3 Phones (width < 640 px)

- The line is wider than the screen (at least 2× the viewport width) and scrolls sideways inside its strip.
- After a choice, the strip scrolls so the chosen mark is centred (smooth scroll; instant with reduced motion).
- Drag on the strip scrolls it; drag on the knob moves the knob. Tap on a mark chooses.

### 2.4 Accessibility

- Semantics do not change: a `<nav>` with 8 `<button>`s, `aria-current` on the current era, the same accessible names as now (`"1840 · 1820s–1890s · Colonial crossing"`).
- The knob is decorative for screen readers (`aria-hidden`); keyboard and screen-reader users use the buttons and arrow keys.
- Focus rings stay visible.

## 3. Era transition (dip and swap)

### 3.1 Sequence

1. The visitor chooses a new era (any input in §2.2).
2. **Fade out, 0.3 s**: a full-screen overlay goes from transparent to opaque. Colour: a soft sepia haze (one CSS token, `--era-dip`). The new era's year shows big in the middle of the overlay, with its label below it.
3. At full opacity the store's `eraId` changes (`setEra`). The info panel, if open, updates now.
4. The overlay stays opaque until the new era's scene has rendered **one frame** (the existing frame hook; no fixed wait), with a cap of 1 s.
5. **Fade in, 0.3 s**: the overlay goes back to transparent.

### 3.2 Rules

- The **camera does not move** during the dip. The view mode and the visitor's angle (§4.2) are kept.
- The ferry keeps its place in the crossing loop (the loop clock is not reset by an era change).
- **A choice during a fade** changes the target era. It does not start a second fade:
  - during fade out → the fade continues; the new target is applied at full opacity;
  - while opaque or fading in → the overlay goes back to opaque (from its current opacity), applies the new target, then fades in.
- The URL updates when the choice is made (not when the swap happens), so a reload lands on the chosen era.
- **Reduced motion** (`prefers-reduced-motion: reduce`): no overlay, instant swap, as now.
- The overlay is an HTML layer over the canvas, not a post effect. It does not add draw calls.
- The big year on the overlay has `aria-hidden`; an `aria-live="polite"` region announces the new era name once, after the swap.

### 3.3 Code shape

- `src/ui/eraDip.ts` — a small pure state machine: states `idle | out | hold | in`, inputs `choose(era)`, `tick(dt)`, `frameRendered()`; outputs overlay opacity, the era to show on the overlay, and when to call `setEra`. Unit-tested without React.
- `src/ui/EraDip.tsx` — renders the overlay and drives the machine with `requestAnimationFrame`.
- `DecadePicker`'s `choose` goes through the machine instead of calling `setEra` directly.

## 4. Camera modes

### 4.1 Views

| View | URL `cam=` | Where | Replaces |
|---|---|---|---|
| **Ride** | `ride` | On the ferry, moves with it (existing `RideRig`) | `ride` |
| **Shore** | `shore` | Standing on the Loíza landing, eye height | `bank` |
| **Sky** | `sky` | High above the river, looking at the crossing | `aerial` |

- Old URL values `bank` and `aerial` still load (mapped to `shore` and `sky`); the URL is then rewritten to the new name.
- Poses for Shore and Sky start from the current `bank` and `aerial` poses in `src/scene/Cameras.tsx`; they may be retuned for the art check (§6) but stay at the same places.
- Dev views (`mouth`, `fields`, `farm`, `station`, `bridge`, `town`) keep working **only with `?debug=1`**. Without it, those `cam=` values fall back to `ride`.

### 4.2 Switching and 360° look

- **Switch**: a 3-button group in the toolbar (after the language switch), `role="group"`, `aria-pressed` on the current view. Labels in both languages (Paseo / Orilla / Cielo; Ride / Shore / Sky).
- **Keys 1, 2, 3** pick Ride, Shore, Sky (same guards as the arrow keys).
- The camera **glides** to the new view in about 1.5 s (`CameraControls.setLookAt(..., true)`). With reduced motion it jumps.
- **360° look**: in all 3 views the visitor drags to turn the view all the way around (azimuth unlimited) and up/down within each view's polar limits.
- **The camera stays where the visitor leaves it.** The ride view's ease-back (`RIDE_ORBIT.returnDelay/returnRamp/returnTau` in `src/ancon/rideCamera.ts`) is removed. In Ride, the orbit offset stays relative to the ferry: the ferry moves the camera, the visitor's angle is kept.
- **Recenter**: a button in the toolbar (shown only when the angle differs from the front view) and key **R** glide back to the view's front framing (instant with reduced motion).
- The chosen view goes in the URL (`?cam=`), as now. The visitor's angle does not.

### 4.3 Limits

- **No truck/pan in any public view.** Right-drag and three-finger drag do nothing; two-finger drag is dolly (zoom) only. This keeps the visitor at the view's place, so the empty edges of the world never show.
- **Zoom** is limited per view: a small range around the view's distance (Ride: the existing `RIDE_ORBIT` range; Shore and Sky: ±30 % of the start distance, fixed numbers set in code).
- Shore and Sky orbit about their own target, like Ride orbits about its pivot. The camera never goes under the water or the ground (existing water clearance for Ride; each fixed view gets a min height).
- In `?debug=1`, the dev views keep today's free controls.

## 5. Performance

- No new draw calls in the 3D scene (the dip overlay and the timeline are HTML).
- No new downloaded files.
- Frame rate on every tier stays within **5 %** of the Phase 5 numbers, in each of the 3 views. Measure before and after with the 2c method; record the numbers in `docs/superpowers/notes/phase-6a-rulings.md`.
- The dip must not drop frames on the swap beyond the swap frame itself; record the longest frame during a dip on each tier.

## 6. Testing

Unit (vitest):
- Timeline layout: year → x is linear; the 8 marks are in order; overlapping labels are staggered; snap picks the nearest mark.
- `eraDip`: the full sequence; a second choice in each state (`out`, `hold`, `in`); the 1 s hold cap; reduced motion gives an instant swap.
- URL: `cam=shore|sky` parse and write; `bank`/`aerial` map to the new names; dev views need `debug=1`.
- Camera: key 1/2/3 and R handling; no ease-back after release (the ride angle is unchanged after 5 s idle); recenter returns to the front framing.

End-to-end (Playwright, `tests/e2e`):
- Pick an era by tap: the overlay appears, the era changes, the overlay goes away; the URL is updated.
- Arrow keys still step eras.
- Phone viewport: the strip scrolls and centres the chosen mark.
- Switch each of the 3 views by button and by key; `?cam=bank` loads Shore.
- Reduced motion: no overlay, instant swap.

Art check:
- New screenshots of each of the 8 eras in each of the 3 views (24 shots), plus mid-dip shots, for the user to review.

## 7. Done when

- §2–§4 behave as written on desktop and on a phone viewport.
- All unit and e2e tests pass.
- Frame rate is within 5 % of Phase 5 on every tier, in every view (§5), numbers recorded.
- The user has seen the 24 screenshots and approved the look.
