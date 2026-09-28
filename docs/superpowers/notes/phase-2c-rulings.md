# Phase 2c rulings and notes

Spec: `docs/superpowers/specs/2026-09-28-phase-2c-landscapes-design.md`. Plan: `docs/superpowers/plans/2026-09-28-phase-2c-landscapes.md`.

## Baseline (Task 1)

`fields` camera: pos [-500, 170, 250], target [-1800, 0, 1500]. Verified against `?era=1975&cam=fields&t=12&freeze=1&q=medium`: open, flat grassland fills the frame centre — the brief's values needed no tuning.

| query | tier | fps | mean ms | p95 ms |
|---|---|---|---|---|
| `?era=1900&cam=ride&t=17.5&c=95&freeze=1&q=high` | high | 103.0 | 9.71 | 10.40 |
| `?era=1900&cam=fields&t=12&freeze=1&q=high` | high | 119.2 | 8.39 | 9.10 |
| `?era=1975&cam=aerial&t=12&freeze=1&q=high` | high | 108.6 | 9.21 | 10.00 |
| `?era=1900&cam=ride&t=17.5&c=95&freeze=1&q=medium` | medium | 165.2 | 6.05 | 6.80 |
| `?era=1900&cam=fields&t=12&freeze=1&q=medium` | medium | 184.5 | 5.42 | 6.50 |
| `?era=1975&cam=aerial&t=12&freeze=1&q=medium` | medium | 165.7 | 6.04 | 6.50 |
| `?era=1900&cam=ride&t=17.5&c=95&freeze=1&q=low` (dpr=1) | low | 518.6 | 1.93 | 2.80 |
| `?era=1900&cam=fields&t=12&freeze=1&q=low` (dpr=1) | low | 548.8 | 1.82 | 2.80 |
| `?era=1975&cam=aerial&t=12&freeze=1&q=low` (dpr=1) | low | 475.6 | 2.10 | 2.90 |

All numbers from `node scripts/dev/perf.mjs "<query>" 10 2` (`10 1` for the low tier), against `npm run build && npm run preview` on this dev machine. `fields` and `aerial` are already the cheapest and second-cheapest of the three at every tier — the empty grassland has less geometry on screen than the `ride` view's river/vegetation/vessel. This baseline predates any phase-2c feature (cane fields, farm blocks, palm age) landing, so it's the "before" comparison point for perf regressions introduced by later tasks.

## Rulings

**Task 5: Cane geometry triangle count**

Real-layout cane mesh: 10,650 triangles (4,266 top + 6,384 sides) for all 96 fields shown. This is 17.8% of the 60,000-triangle budget.

**Task 6: `CaneFields.tsx` renamed to `CaneFieldsMesh.tsx` (case-only collision)**

The brief's file name `src/vegetation/landscape/CaneFields.tsx` differs from the existing
`src/vegetation/landscape/caneFields.ts` (Task 4) only in casing. TypeScript's compiler refuses
this outright (`TS1149: File name '…/CaneFields.ts' differs from already included file name
'…/caneFields.ts' only in casing`), independent of the actual filesystem's case sensitivity —
it's a hard error, not a lint warning, so `npx tsc --noEmit` cannot pass with both files present.
Renamed the new component file to `CaneFieldsMesh.tsx` (same exported `CaneFields` component,
same import surface `<CaneFields layout shown near far castShadow />`); only `Vegetation.tsx`'s
import path changed to match. No other interface changed.

**Task 6: opaque `caneTop` texture needed `alphaTest: 0`, not the brief's `0.5`**

The brief's `caneMaterials()` set `alphaTest: 0.5` on both the top and side materials, per the
existing `paintReedStems`-style pattern. `paintCaneTop()` paints a fully opaque canvas (fillRect
base, then opaque strokes — alpha is 255 everywhere), and `foliageTexture`'s coverage-preserving
mip chain (`coverageMips`, existing code) is built for cards with genuine alpha variation: it
binary-searches a per-mip alpha rescale so each mip's fraction of texels above the alpha-test cut
matches level 0. For a texture whose alpha is uniformly 255, that fraction is 1.0 at *any* positive
rescale, so the search has no signal and converges to the lower bound of its search range
(`SCALE_LO = 0.5`), which pushes mip-level-1's alpha down to ~127 — sitting right at the
`alphaTest * 255 = 127.5` cutoff. At the `fields` camera's far viewing distance (this mesh
plane sits under heavy minification), the GPU samples deep into the mip chain, so most/all
fragments landed on the wrong side of that knife-edge and were discarded: the top mesh had valid,
non-empty geometry (confirmed via a temporary render-time log: `topIdx: 12798` triangle-index
count) but was effectively invisible, showing bare terrain grass through the "cane" fields with
only the boundary walls (whose `caneSide` texture has real alpha variation, so its mips behaved
normally) visible. Fixed by dropping `alphaTest` (default 0) on the top material only — it never
needs an alpha cutout since it's opaque, so there's nothing to discard regardless of what the mip
chain does to its (irrelevant) alpha channel. The `foliageTexture "caneTop": coverage alpha scale
pinned at 0.5 on mip level 1 (128×128)` console warning still fires (the coverage search still
pins for the reason above) — this is now harmless, since the alpha it's warning about doesn't do
anything, but it's worth knowing this specific warning is expected and not a residual bug.

**Task 6: colour tuning**

Tuned `paintCaneTop`'s base fill from `#3f5a1d` to `#334c17` and its blade-stroke HSL range from
`hsl(76±24, 38–63%, 26–54%)` to `hsl(72±26, 45–75%, 24–54%)`; `paintCaneSide`'s background
gradient from `#2b3317 → #4d6a23` to `#232b12 → #46611f`, its stalk HSL from `hsl(62±18, 35–55%,
28–42%)` to `hsl(58±20, 42–66%, 26–40%)`, and its leaf-blade HSL from `hsl(78±22, 40–65%, 30–55%)`
to `hsl(74±24, 46–74%, 28–54%)`. All three shifts: darker base, higher saturation floor. At the
`fields` camera's distance and haze, the original values read almost the same tan-green as the
surrounding pasture grass; the darker, richer values read as a visibly denser, deeper-green crop
against the pasture while still sitting inside the same warm, hazy palette as the rest of the
scene.

**Task 6: on-screen check**

`?era=1900&cam=fields&t=12&freeze=1&q=medium`: tall(ish) green cane blocks fill most of the
grassland east of the river, cart lanes (unplanted boundary strips) visible between fields,
side-wall tops read ragged (the alpha-cut leaf tips), no floating/sunk walls or z-fighting
spotted on the near-terrain fields close to camera. `era=1840` shows visibly fewer fields than
1900 (0.6 vs 1 share); `era=1925` fewer still (0.3); `era=1935` shows none (only the bare field-
boundary grid lines, no green fill) — matches the nesting the nested nearest-rank shown-mask is
built to give. `q=low` (no shadows): cane still renders correctly; noted a pre-existing, unrelated
patch of flat grey rendering over one of the casuarina tree clusters at `q=low` (not present at
`q=medium`/`q=high`, not aligned with any cane field) — looks like a low-tier tree-impostor
artifact, out of this task's scope (nothing in Task 6 touches tree rendering), flagged here for
whoever owns that system rather than filed as a cane bug. Unfrozen (`t=12` without `freeze=1`):
scene renders without console errors; the cane meshes use the same shared wind-sway material
(`makePlantMaterials`) already exercised by every other foliage type, so sway wasn't re-verified
pixel-by-pixel beyond confirming no errors.

**Task 6, review round 2: per-corner jitter reverted; staircase fixed at the raster instead**

Round 1's per-grid-corner x/z jitter (±3 m, meant to break up the field boundary's 10 m
staircase and give the neon-flat colour some macro variation) broke mesh watertightness: merged
top-row quads and merged wall runs only carry jitter offsets at their *own* end corners, so a
neighbouring row's or wall's vertices at a different merged span landed at a different offset for
what should be the same shared edge — visible as thin light crack lines through field interiors
and wall faces in `cane_1900_tuned.png`'s round-1 successors. Reverted entirely: removed
`cornerOffset`/`cornerXZ` and its test from `caneMesh.ts`/`caneMesh.test.ts`; `buildCaneGeometry`
is back to Task 5's exact-grid-corner positions (fully watertight, `wall()` takes raw world
coordinates again, not grid indices). Kept the per-vertex colour (`caneTint`: per-field rank +
low-frequency world mottle) — that part of round 1 was correct and wasn't implicated in the
cracking.

The staircase itself is now addressed at the source, in `caneFields.ts`: `CANE_CELL` 10 → 5 m,
so a diagonal field boundary's steps are half as large. To keep the lane width from also halving
(spec: 6–10 m lanes), lane detection no longer scales with `CANE_CELL/2`; it uses a new,
independent `LANE_HALF = 4` m constant. `MIN_CELLS` (the scrap-drop threshold) is now derived
from a `MIN_AREA = 2000` m² constant divided by the (now smaller) cell area, giving `MIN_CELLS =
80` at `CANE_CELL = 5` — the same 2000 m² floor as before, just expressed in more, smaller cells.
Road dilation doubled from 1 to 2 cells, keeping it at the same ~10 m absolute clearance now that
cells are half as wide.

Real-layout numbers at the new cell size: **96 fields** (was 96 at the 10 m grid too, coincidentally
— well inside the 30–120 test range), **21,818 triangles** (9,022 top + 12,796 side) for all
fields shown — up from Task 5's 10,650 at the 10 m grid (roughly double, as expected: the finer
raster roughly doubles the row/column count merged-quad boundaries run along, in each axis), but
still only 36.4% of the 60,000-triangle budget.

`caneFields.test.ts`'s `f.cells >= 20` assertion now reads `f.cells >= MIN_CELLS` (imported,
rather than re-hardcoding the new threshold); the "uses 10 m cells" test title was renamed since
it no longer describes a fixed value (the assertion itself always compared against the exported
`CANE_CELL` constant, so it never actually hardcoded 10 and needed no logic change). The lane
test ("no two 4-neighbour cells belong to different fields") and the `tiny()` fixture in
`caneMesh.test.ts` (its own hardcoded synthetic 4×4/10 m grid, independent of `CANE_CELL`) needed
no changes and still pass.

**Task 6, review round 3: per-vertex `heightAt` on the top plane opened T-junction gaps; flattened
each field's top instead**

Round 2's fix (halving `CANE_CELL`) genuinely fixed the crack lines that round 1's corner jitter
had introduced, but a *different*, pre-existing artifact remained and only showed up on sloped
ground near the river: thin, light, dashed lines running parallel to the merged top-quad rows,
inside field interiors. Cause: `buildCaneGeometry`'s top loop called `heightAt(x, z)` once per
vertex, i.e. once per *merged run's own two end corners* — but a field's row-j run and its row-
(j+1) run don't generally span the same i-range (field shapes are irregular), so the two runs'
shared z-line edge is built from two different pairs of sample points. Where the terrain isn't
perfectly flat between those points (a linear top edge vs. genuinely curved terrain), the two
runs' edges at that shared z-line disagree in Y — not a geometric T-junction (no jitter, so x/z
still line up exactly), but a *height* mismatch that opens a sliver showing the grass terrain
through. This existed since Task 5; round 1's neon-flat colour and mid-distance zoom shots simply
made it easy to miss (a flat field reads as one solid colour regardless of a sub-metre seam), and
it only reads clearly near real elevation change, e.g. the riverbank slope.

Fixed by making each field's top geometrically flat: `buildCaneGeometry` now computes one Y per
field — the mean of `heightAt` over that field's shown cell centres, plus the field's height — and
every top vertex of that field uses it. Two edges of the same field can no longer disagree in Y
(they're both the same constant), so no seam is possible by construction, regardless of terrain
curvature. Wall tops use the same per-field flat Y (+ `CANE_FRINGE`) for the same reason (a wall
segment's top must agree with the top plane it borders, and with any other wall of the same
field). Wall *bottoms* still sample `heightAt` at each run's own two endpoints (real terrain, not
flattened — the wall's whole point is to reach the ground), but `CANE_SINK` was raised `0.3 → 1.0`
so a long wall's straight bottom edge can't float over a bump partway along its run before
reaching its own next endpoint sample.

`LANE_HALF` (round 2's new constant) was `4`; the controller's own review of round 2's field found
~40% of lanes fell under the spec's 6 m floor. Raised to `5` (= `CANE_CELL`), which makes every
lane exactly two 5 m cells (10 m) — inside the 6–10 m band, not just usually inside it.

Real-layout numbers after both round-3 changes: **96 fields** (unchanged; `LANE_HALF` only moves
where lanes fall, not how many macro fields the ~220 m pitch grid produces — still comfortably
inside the 30–120 test range), **21,568 triangles** (8,916 top + 12,652 side) — very close to
round 2's 21,818 (flattening tops and widening lanes slightly changes which raster cells merge
into which runs, but doesn't change the underlying row/column structure that drives triangle
count), **35.9%** of the 60,000 budget.

`caneMesh.test.ts`'s two height-dependent tests were rewritten for the flat-top model: the top
test now asserts every vertex of the field is at the same Y (computed independently in the test
by averaging `ground(x)` over the fixture's own shown cell centres, mirroring the production
formula, then comparing every vertex against that one value); the sides test now checks each
vertex individually is either at its local `ground(x) − CANE_SINK` (bottom) or at the field's flat
top `+ CANE_FRINGE` (top), rather than the old global lo/hi-of-the-whole-mesh check (which
assumed a per-vertex-height top and would no longer mean anything once the top is field-constant).
The other four Task 5 tests (triangle counts, side normals, aFlex, empty-when-nothing-shown) were
untouched and still pass.

### Task 8 — farm blocks in the placement

`placeAll` now takes `opts.planted: { coconut, inside }`: the planted palms are marked in the
shared occupancy grid before any species runs (so nothing else can occupy their trunk discs), the
combined skip is `inside(x,z) || opts.skip(x,z)` (blocks stay grass-only inside their rectangle,
whatever species is being placed), and `out.coconut` is `planted.coconut.concat(placeSpecies(...))`
so the planted palms are always first (matters for `nearCount`/trunk-disc code downstream, which
assumes the first N of a list are the near set). `placementKey` gained an `extra` parameter so the
cache key can vary with `p${survival}` independently of `tier` (tier is now only the grid/quality
shape; `extra` carries `p${survival}|c${caneShare}`, both stop-gap knobs that affect placement
without affecting density inputs).

`Vegetation.tsx`: `findBlocks`/`plantBlocks`/`insideBlocks` run once per near placement build
(inside the `placements.get` memo, gated by `survival > 0`), so a survival value of 0 (1840) skips
finding blocks entirely and costs nothing extra. Blocks are found on `pf` (the placement fields,
post bank-offset), matching the space the planted coordinates and `inside` predicate need to be
in.

Screenshot check (`npm run dev` + `scripts/dev/shot.mjs`, temporary `fields` camera pose edited to
`{ pos: [265, 60, -295], target: [160, 0, -400] }` — 150 m out, 60 m up, looking at the block
centred at (160, -400); reverted before committing, confirmed `git diff` was clean after revert):

- **1840** (`?era=1840&cam=fields&...`): no rectangular block — only the wild coconut fringe along
  the beach and scattered wild clumps inland. Correct (`plantation.value` is 0 that era).
- **1900** (`?era=1900&cam=fields&...`): a clean 15×10 grid of short palms with fronds close to the
  ground (age 0 → young), in straight rows, clearly distinct from the wild fringe.
- **1925** (`?era=1925&cam=fields&...`): the same grid, now half-grown (taller trunks, fuller
  fronds) — matches `palmAge.value = 0.5` for that era.
- **1935** (`?era=1935&cam=fields&...`): full-height mature palms filling the block densely.
- **1975** (`?era=1975&cam=fields&...`): same mature block with visible gaps scattered through the
  rows — consistent with `plantation.value = 0.85` (≈ 15% of planted positions skipped).
- **aerial** (`?era=1935&cam=aerial&...`, no camera edit): one of the six blocks is visible as a
  small grid of palms near the bottom-right of the frame, confirming at least one block reads in
  the standard preset too (not just the block-framing pose).

No rows or grid artefacts showed up in the wild clumps outside the blocks in any shot, and no
non-grass species appeared inside a block's rectangle.

## Deferred
