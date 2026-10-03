# Phase 6a — rulings, frame rate, screenshots, art check

Spec: `docs/superpowers/specs/2026-09-30-phase-6a-design.md`. Plan: `docs/superpowers/plans/2026-09-30-phase-6a-look.md`.

## Spec amendments

Three amendments were made to the spec on 2026-09-30, while planning:

- **§2.1 timeline labels:** each era's dot sits at its true x. Its label is spread along the line as close to the dot as it fits, with a thin leader, and the labels go in two rows when one row does not fit. Staggering alone cannot keep 1984 and 1986 apart.
- **§4.1 dev views:** `mouth`, `fields`, `farm`, `station`, `bridge` and `town` work only with `?debug=1` or `?freeze=1`. Without one of those flags they fall back to `ride`. The screenshot tests use `freeze=1` and must not show the debug panel.
- **§4.3 Shore turns in place:** the target sits 1 m ahead of the eye, and zoom is a lens zoom from 1× to 1.3×. Orbiting a far target would carry the visitor off the bank.

## Rulings

Rulings 1–12 below are copied from the controller's ledger.

Ruling 1: T3 recenter-glide test bound may rise from 1.5 to 2.0 m if the measured first step is 1.5–2.0 m — a 21 m snap is still ruled out — cost if wrong: a slightly weaker "no snap" check.
Ruling 2: T4 hand check is done with a headless Playwright script against `npm run dev` (implementer has no browser pane); controller does the 360° look check in the built-in browser before Task 5 — cost if wrong: camera feel issues found later at Task 10/11.
Ruling 3: T9 imports `type PointerEvent as ReactPointerEvent` from 'react' instead of the `React.` namespace — plain TS fix — cost if wrong: none.
Ruling 4: commit trailers name the model that actually wrote the commit (subagents sign as themselves, e.g. Haiku 4.5); the plan's 'Opus 5.5 on every commit' constraint is dropped — accurate attribution beats a uniform label, and haiku re-signs regardless — cost if wrong: a trailer reword over the branch before merge.
Ruling 5: Task 4 finding 2 (plan-mandated: fixed-view glides use camera-controls' default smoothTime 0.25 s, settle well under the spec's ~1.5 s) — fix it: set CameraControls smoothTime so programmatic view/recenter glides settle in ~1.5 s (user drag damping uses draggingSmoothTime, unaffected) — spec §4.2 binds over plan text — cost if wrong: glides feel slower than intended; one constant to retune.
Ruling 6: Task 4 minor 2 (?ancon=0 Ride gets free/pan controls) accepted — ?ancon=0 is a debug-only param that hides the ferry — cost if wrong: a debug URL can pan to world edges.
Ruling 7: plan defect — src/ui/eraDip.ts (machine) and src/ui/EraDip.tsx (component) collide in module resolution on case-insensitive macOS ('./EraDip' resolves eraDip.ts). Implementer's workaround (eradip.ts + explicit '.tsx' import) is fragile. Decision: rename the machine to src/ui/dipMachine.ts (+ dipMachine.test.ts), keep EraDip.tsx, plain extensionless imports — cost if wrong: one more rename.
Ruling 8: the last/first marks (1840, 1986) cannot be centred in the phone strip (scroll clamps at the ends). Task 10's phone test centres an interior era (1935) and only checks that 1986 is fully inside the strip — spec §2.3 'centred' is read as 'centred where the scroll range allows' — cost if wrong: none visible.
Ruling 9: Task 9 labels hidden ≤720 px (plan CSS) contradicts spec §2.1 'each mark shows the year and the era label' — show labels at every width; the layout's two-row mode absorbs the width — cost if wrong: a taller (≈110 px) timeline on phones.
Ruling 10: Task 9 plan-mandated CSS defects (knob clipped by overflow, OSM credit under two-row timeline) are fixed in this task — licence attribution must stay visible — cost if wrong: none.
Ruling 11: phone-strip centring checks the chosen mark's dot/knob, not its label (spec §2.3 'the chosen mark is centred'; labels spread away from dots by design) — cost if wrong: a label may sit ~115 px off centre, still on screen.
Ruling 12: spec §5 'no dropped frames beyond the swap frame' — the second long frame (45–65 ms, once 234 ms) falls in the dip's hold, while the overlay is fully opaque, so the visitor never sees it; accepted, recorded in phase-6a-rulings.md — cost if wrong: a hitch hidden today could show if the hold is ever shortened.

## Shore pose (Task 11 art fix, spec §4.1)

In the controller's browser check, the 1975 Shore view had the neighbour's wooden house filling the left half of the frame. That house stands 1935–75. Commit 1bd5c28 `fix(6a): Shore view clears the station house` moved the eye.

| | eye `pos` | looks toward |
|---|---|---|
| before | `[ex + 10, 3.6, ez + 8]`: ~29 m inland of the ferry's shore point, 10 m to the upstream side, behind the neighbour's house | `[wx − 40, 2.5, wz − 30]` (level) |
| after | `[ex + 3, 2.7, ez − 6.5]`: ~14 m inland of the shore point, 3 m beside the pad, in front of the station and the neighbour's house | `[wx − 40, −20, wz − 30]` (~5° down, so the bank shows) |

`ex, ez` and `wx, wz` are the east (Loíza) and west landing landmarks. The view still uses `inPlace(...)`, so the target stays 1 m ahead of the eye.

The station, terrace, shelter, neighbour footprints and the town houses within 250 m were checked from the real layout code for all 8 eras. No building corner comes within 45° of the view line in any era. The horizontal half field of view at 1440 × 900 is 31.5°. The ground under the eye is 0.6–1.2 m depending on the era, so the eye stands 1.5–2.1 m above it.

The polar angle of the front view is about 95°, inside Shore's limits of 72°–100.8°. `src/scene/views.test.ts` and `npm test` (675 tests) pass.

Rejected tries:

- An eye 8 m from the water left 1840–1935 looking at nothing but water: the early bank sits ~7 m further inland.
- A level eye showed no ground.

## Frame rate

Method: the Phase 5 method. `node scripts/dev/perf.mjs "<query>" 10 2` (`10 1` for low): 10 s, vsync and the frame cap off, `freeze=1`, real GPU (Metal).

- **Base:** main a855aea (Phase 5) was built in a scratch worktree and served on `:4174` (`BASE=http://localhost:4174/ancon-de-loiza/`). On main, Shore is `cam=bank` and Sky is `cam=aerial`.
- **After:** this branch, with the final Shore pose (1bd5c28), built and served on `:4173`.
- **Runs:** each query ran 3 interleaved pairs: base, after, base, after, base, after. Change = after median / base median − 1.
- **Pass rule:** a tier passes if the change is ≤ +5 % on every query.

Measured 2026-09-30/10-01.

| query | tier | base runs ms | after runs ms | base median | after median | change |
|---|---|---|---|---|---|---|
| 1975 ride c=95 | high | 10.61, 10.72, 10.66 | 10.63, 10.72, 10.66 | 10.66 | 10.66 | +0.0 % |
| 1984 ride c=95 | high | 10.57, 10.57, 10.57 | 10.58, 10.57, 10.57 | 10.57 | 10.57 | +0.0 % |
| 1975 shore c=95 | high | 9.65, 9.63, 9.66 | 9.73, 9.73, 9.74 | 9.65 | 9.73 | +0.8 % |
| 1975 sky c=95 | high | 10.49, 10.48, 10.50 | 10.49, 10.49, 10.53 | 10.49 | 10.49 | +0.0 % |
| 1975 ride c=95 | medium | 6.66, 6.63, 6.63 | 6.64, 6.62, 6.62 | 6.63 | 6.62 | −0.2 % |
| 1984 ride c=95 | medium | 6.54, 6.55, 6.53 | 6.55, 6.54, 6.54 | 6.54 | 6.54 | +0.0 % |
| 1975 shore c=95 | medium | 5.65, 5.65, 5.65 | 5.79, 5.80, 5.80 | 5.65 | 5.80 | +2.7 % |
| 1975 sky c=95 | medium | 6.89, 6.89, 6.89 | 6.90, 6.89, 6.90 | 6.89 | 6.90 | +0.1 % |
| 1975 ride c=95 | low | 2.08, 2.06, 2.15 | 2.03, 2.04, 2.06 | 2.08 | 2.04 | −1.9 % |
| 1984 ride c=95 | low | 2.12, 2.12, 2.12 | 2.12, 2.13, 2.13 | 2.12 | 2.13 | +0.5 % |
| 1975 shore c=95 | low | 2.13, 2.15, 2.13 | 2.29, 2.09, 2.09 | 2.13 | 2.09 | −1.9 % |
| 1975 sky c=95 | low | 2.44, 2.44, 2.44 | 2.44, 2.44, 2.44 | 2.44 | 2.44 | +0.0 % |

**All three tiers pass.** The worst change is +2.7 % (medium, Shore).

Shore is not a like-for-like pair. Base Shore is the old `bank` pose, and after Shore is the retuned pose. The new pose frames more near ground and the pad and less sky, which likely accounts for the Shore difference on high and medium. Ride and Sky have the same poses on both sides, and they changed by −1.9 % to +0.5 %.

The absolute numbers are lower than in Phase 5's table (e.g. high 1975 ride 10.66 ms vs 12.73 ms). That is a same-day machine difference that shows on both sides.

## Longest frame during a dip

Measured on the production build on `:4173` with the perf.mjs launch flags (vsync off) and the same DPR as above. Steps:

1. Open `?era=1975&cam=ride&c=95&freeze=1&perf=1&q=<tier>` and wait for ready + 3 s.
2. Clear `window.__ANCON_PERF__.frames` and press → once (to 1984).
3. Read `Math.max(...frames)` after 2 s. A second read at 4.5 s, after the fade-in ends, gave the same maximum.

Each tier ran 3 times.

| tier | longest frame, runs (ms) | next-longest frame, runs (ms) | longest idle frame, 1 s before the dip (ms) |
|---|---|---|---|
| high | 712.9, 733.9, 747.2 | 234.4, 61.2, 65.2 | 14.7, 15.3, 13.4 |
| medium | 704.5, 696.1, 700.0 | 65.3, 60.2, 61.0 | 10.3, 10.8, 10.6 |
| low | 193.6, 180.2, 183.1 | 45.4, 45.7, 47.5 | 2.9, 2.8, 2.7 |

The swap frame is the long one: the new era builds in that frame, behind the full overlay. One more long frame of 45–65 ms follows on every tier. On the first high run there was also a 234 ms and a 106 ms frame. All other frames are at the idle level.

Spec §5 says the dip must not drop frames beyond the swap frame. The second long frame (~45–65 ms, once 234 ms) falls in the dip's hold, while the overlay is fully opaque, so the visitor never sees it. It is accepted under Ruling 12 and was not tuned. If the hold is ever shortened, measure again.

## Screenshots

`tests/snapshots/phase6a/` holds 26 shots. All were taken with `scripts/dev/shot.mjs` on the real GPU against a dev server: golden hour (no `t`), `c=95`, `freeze=1`, `q=high`, 1440 × 900.

- **View shots:** `<era>-<view>.png` for era 1840, 1900, 1925, 1935, 1959, 1975, 1984, 1986 and view `ride`, `shore`, `sky` (24 shots). They show the final Shore pose. The only console messages were `THREE.Clock` deprecation warnings.
- **`dip-desktop.png`** (1440 × 900) and **`dip-phone.png`** (375 × 812): 1975 Ride, → pressed, taken when `.era-dip` opacity passes 0.95.

Checks:

- **The timeline does not cover the title card:** ✓ at desktop. On the phone, see open item 1.
- **Shore stands on the bank:** ✓ in all 8 eras. Ground or the landing pad is in the foreground, and no building is in the frame. In 1840–1935 the foreground is a narrow strip of beach; the river was wider then.
- **Sky shows the crossing and no world edge:** ✓ in all 8 eras.
- **The 1984 and 1986 labels are apart:** ✓ in every shot.

## 360° turn check (Shore and Sky, 1840 and 1986)

A Playwright script turned each view by dragging the canvas with `page.mouse`, 45° per step. The step size follows camera-controls' azimuth formula θ = 2π · speed · dx / height:

- Shore, rotateSpeed −0.3: 375 px per 45° step.
- Sky, rotateSpeed 1: 112.5 px per 45° step.

The script took a screenshot at 0°, 45°, … 315° and again at 360°. At 360° each view was back on its front framing, and Recenter was hidden again.

The 36 shots were not committed (53 MB). They are in the session scratchpad, `…/scratchpad/turn/<era>-<shore|sky>-<deg>.png`, with contact sheets `sheet-<era>-<view>.png`.

- **Shore:** no world edge and no floating object in either era. Turning round shows the grass clearing, roads and the town behind. In 1840 the thatched shelter is close behind the eye at 225–270°. In 1986 the concrete station fills the view at 270°. Both are expected when looking back inland.
- **Sky:** no world edge. The land and sea run into the horizon haze at every angle.

## Open items for the user (not fixed)

1. **Phone title card vs OSM credit.** In `dip-phone.png` (375 × 812), the "Map data © OpenStreetMap contributors" credit sits on the lower edge of the title card's second line ("1980–1986 · The steel barge"), just above the two-row timeline. This is related to the deferred Task 9 items. **Fixed in the final review fix:** the title card, credit and timeline now stack with clearance at every width, and `dip-phone.png` was retaken (taken after the dip clears, so the title card shows) and shows no overlap.
2. **Sky, 225°–315° (both eras): wide empty land.** Behind the town, the land is a flat, even grassland with large bare cane-field polygons. The polygons have hard straight edges and almost nothing stands on them. Facing away from the sea, this side reads as empty.
3. **Sky, 270°–315° (both eras): houses read as standing on dark columns.** With the low sun behind the camera, each town house's long shadow falls straight toward the viewer. From above it looks like a dark block under the house, so the houses seem raised on pillars or floating.
4. **Sky front view, 1900–1986: dark soft blob in the bottom-right corner**, below the OSM credit (e.g. `1935-sky.png`). It is probably a near, out-of-focus canopy or bird; it was not identified.
5. **Sky, 1840 at 180°: a lone grey oval patch** on the grass west of the farm block, near a road. Possibly a dirt patch with no object on it.
6. **Ride 1986:** the barge is empty at `c=95`, and the bridge is not in the frame. This is the known open item from Phase 5 ("1986 ride view misses bridge").

## Open items 2–6: fixed 2026-10-02 (branch `art-6a`)

User ruling 2026-10-02: fix all five (item 1 was already fixed). Shots taken with `scripts/dev/turn.mjs` (the
360° helper, now committed) on the real GPU at 1440×900, `q=high`, `freeze=1`, `c=95`.

2. **Empty land, hard polygon edges.** Two causes. (a) The OSM land polygons (wood, scrub, sand, wetland) are
   rasterised with straight edges and one flat value inside. The ground shader now warps the lookup by ±22 m
   of low-frequency noise, so every edge wanders like a field margin, and the dry-pasture noise thins the
   woodland tint into glades. (b) No tree rule had an inland habitat, so the wood/scrub polygons were dark
   paint with nothing on them. Coconut (0.1 wood, 0.05 scrub — Loíza is plantation country) and almendro
   (0.1 wood) now grow there in thin groves. Counts stay inside the ±25 % budget in `placement.test.ts`.
   Cane fields keep their straight edges: real fields have them.
3. **Houses on dark columns.** Three causes, all in the Sky view. The shadow map (±140 m) covered only a strip
   of what a 380 m-high camera sees, so the town had crisp 7 cm-texel shadows and the rest of the land had
   none; the shadows were near black (no fill light; the PMREM sky alone); and a crisp block attached to the
   house base reads as a plinth. Now `shadowSetupFor` widens the extent with camera height (to ±600 m),
   drops the map to a quarter size with PCF radius 4 above the tier extent — aerial shadows become soft
   smudges — and a hemisphere fill (`fillIntensity` 0.6 by day, sky `fogAway` from above, warm earth from
   below) lifts shadows off black. Ride and Shore keep the full-resolution map (camera under 40 m).
   The zocos stay: wooden houses on posts are correct for Loíza.
4. **Dark soft blob, bottom right.** Identified: the cast shadow of the casuarina belt on the inland sand lot
   east of the town (13–26 m trees at a low sun), not litter, not a bird. `q=low` (no shadows) removes it.
   It stays as a real shadow; the needle floor is lighter and thinner (0.6, lighter browns) and the fixes in
   item 3 soften it. Grass-to-blob ratio 2.15 → 1.84.
5. **Grey oval in 1840.** Identified: the OSM `sand` polygon at (525, 130), 500 m from the sea, the same lot
   the casuarinas stand on from 1900. `fields.ts` now gives inland sand (seaDist > 150 m) weight 0.4 — sandy
   ground, not a bare beach — and the warp in item 2 feathers its edge. Pinned by `fields.test.ts`.
6. **1986 ride view.** User ruling: the barge stays empty (out of service by 1986); the camera turns to the
   bridge. `RIDE.mooredYaw` (0.95 rad) aims the moored ride view upstream from the Loíza landing; a test
   pins it to within 8° of the PR-187 bridge landmarks. The bridge is 244 m away, thin and backlit: in
   frame, not big. The barge cannot get closer. This closes the Phase 4b/4c/5 "ride misses the bridge" item.

Frame rate (perf.mjs, production build, DPR 2, high, paired runs against a `main` build on :4174 — the Mac
drifts ±2 fps between runs, so only pairs count): Ride 61.3 → 60.4, Shore 65.4 → 64.1, Sky 45.5 → 44.9
(within 5 %). A first cut of the shader cost Sky 6.7 %: four extra `snoise` calls per ground pixel at 2× DPR.
Cut to one (the warp uses one noise value along two diagonals; the glades reuse the pasture noise).
