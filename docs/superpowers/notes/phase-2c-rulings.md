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

## After (Task 9)

**Frame rate.** Same 9 queries, same command, against `npm run build && npm run preview`.

| query | tier | fps | mean ms | p95 ms | Task 1 mean | same-session baseline mean | Δ vs same-session |
|---|---|---|---|---|---|---|---|
| `?era=1900&cam=ride&t=17.5&c=95&freeze=1&q=high` | high | 79.6 | 12.56 | 14.0 | 9.71 | 12.58 | −0.02 |
| `?era=1900&cam=fields&t=12&freeze=1&q=high` | high | 91.3 | 10.95 | 12.7 | 8.39 | 11.02 | −0.07 |
| `?era=1975&cam=aerial&t=12&freeze=1&q=high` | high | 82.8 | 12.08 | 13.7 | 9.21 | 12.09 | −0.01 |
| `?era=1900&cam=ride&t=17.5&c=95&freeze=1&q=medium` | medium | 127.7 | 7.84 | 10.1 | 6.05 | 7.81 | +0.03 |
| `?era=1900&cam=fields&t=12&freeze=1&q=medium` | medium | 146.1 | 6.85 | 9.2 | 5.42 | 7.03 | −0.18 |
| `?era=1975&cam=aerial&t=12&freeze=1&q=medium` | medium | 126.6 | 7.90 | 9.8 | 6.04 | 7.89 | +0.01 |
| `?era=1900&cam=ride&t=17.5&c=95&freeze=1&q=low` (dpr=1) | low | 395.7 | 2.53 | 4.4 | 1.93 | 2.51 | +0.02 |
| `?era=1900&cam=fields&t=12&freeze=1&q=low` (dpr=1) | low | 441.5 | 2.27 | 4.5 | 1.82 | 2.26 | +0.01 |
| `?era=1975&cam=aerial&t=12&freeze=1&q=low` (dpr=1) | low | 370.3 | 2.70 | 4.5 | 2.10 | 2.69 | +0.01 |

Every number, 2c build and baseline alike, sits 1.5–3 ms above the Task 1 table. The machine
was not in the Task 1 state: `photoanalysisd`/`photolibraryd` were running at ~80 % CPU each
(Photos library analysis, which also uses the GPU), load average ~3–4. So the Task 1 table is
not a usable reference today. Instead I built the Task 1 commit (`0006e08`, pre-2c) in a
temporary worktree, served it on :4174, and ran it interleaved with the 2c build (base, 2c,
base, 2c; two runs each; the table shows the mean of both). Against that same-session baseline
the 2c build is within ±0.2 ms on every query and tier. The `fields` view is slightly *faster*
with cane, because cane replaces grass clumps and shrubs on the grassland. **Limits pass**
against the same-session baseline: high +≤0 ms (limit +0.5), no tier slower by more than 0.03 ms.
The literal comparison with the Task 1 table fails (+2.6–2.9 ms on high), but the pre-2c commit
fails it by the same amount, so the drift is machine state, not 2c. Re-measuring the Task 1
table on an idle machine would confirm this. After the tint fix below, `fields` measured
10.92 / 6.82 / 2.30 ms (high / medium / low), unchanged.

**Art gate.** `tests/snapshots/phase2c/` against `phase2c-before/` (Playwright, swiftshader,
q=medium). "Δ" is the share of pixels that changed by more than 20/255.

- `1840-bank`, `1840-bank-noon`, `1840-ride`, `1935-ride`, `1959-bank-docked`, `1975-bank`,
  `1975-ride`, `1984-ride`, `1986-bank`, `1986-mouth`: Δ 0.0 %. No cane, block or palm-age
  change in frame. Nothing new wrong.
- `1975-bank-noon`, `1984-aerial`, `default`: Δ ≤ 0.1 %. Wild coconuts re-seated around the
  (off-screen) farm blocks. Nothing wrong.
- `1975-fields-noon`: Δ 0.0 %. No cane in 1975. The grassland is unchanged.
- `1900-fields-noon`: Δ 30 %. The grassland east of the river is now a patchwork of cane
  blocks with 10 m lanes, and the road and track corridors stay clear. Before the tint fix,
  every field was the same flat dark green (a uniform slab). After it, neighbouring fields
  differ visibly in shade and hue. Still wrong: the 5 m staircase on diagonal edges, and dark
  wall lines on far edges (Minor).
- `1840-fields-noon`: Δ 6 %. About 60 % of the fields show, scattered through the plain,
  nested inside the 1900 set. Same notes as 1900.
- `1925-fields-noon`: Δ 2 %. About 30 % of the fields, a few blocks near the river. Same notes.
- `1900-aerial-noon`: Δ 2.6 %. The cane patchwork shows at the far-left edge. The wild beach
  palms are now young (low rosettes), and the tall 1840-style palms are gone from the shore,
  as the spec asks. Nothing wrong.
- `1975-aerial-noon`: Δ 0.2 %. A farm block reads near the bottom right, and the wild palms
  shift slightly. Nothing wrong.
- `1900-ride`: Δ 0.2 %. The tall far palms on the right horizon are now young and drop below
  the tree line. Correct for 1900.
- `1925-bank`, `1925-bank-noon`: Δ 0.3–0.4 %. Far palms on the right are half-grown and
  shorter. Correct.
- `1900-farm-noon` (new, no twin): a 15 × 10 grid of young palms, each a low rosette of fronds
  with no trunk and no nuts. They do **not** read as scaled-down old palms. The rows stop at
  the block edge, and the wild young palms beyond it are scattered, not in rows (no leak).
  Still wrong: an LOD step across the middle of the block. Near rows are the 3D mesh (fresh
  green, with shadows), and far rows are impostor cards (olive-yellow tufts, no shadow). A
  crossed side-view card is a poor match for a low rosette seen from 60 m up (Minor, deferred).
- `1935-farm-noon` (new): the same block, full-grown. Straight rows of tall palms and crowns
  casting shadows. It reads as a planted grove, unlike the wild palms behind it, which are
  irregular. Nothing wrong. The far cards are darker than the near meshes, the same LOD step
  every species has.

**Specific checks.**
- *Tall downhill walls.* Measured on the real layout (all fields shown, high-tier fields): wall
  heights above ground, taken at run ends, are mostly 3–5 m. 1,498 of 12,652 wall endpoints are
  5–6.5 m, 304 are 6.5–8 m, and the worst is 7.8 m at (−1470, 1711). An ad-hoc shot there (camera
  ~120 m off, 22 m up) shows a riverbank field ending in a straight green wall about twice cane
  height, standing at the water's edge like a hedge. The 5 m staircase shows as regular lighter
  vertical stripes, where the short cross-walls catch the sun. None of the tall walls is near
  any preset camera: they are 1.5–3.6 km out, and at `fields` distance they don't read. But
  users can orbit and zoom there (maxDistance 6000). A fix needs a design change: terraced tops
  (several flat levels per field, with walls between them) or dropping steep bank cells from
  the layout (which would then need a tier-independent height source). **Open, Important,
  needs a ruling.**
- *Flat uniform slabs.* Confirmed at `fields` distance: the texture detail is lost to mips, so
  the only lever is the per-vertex tint. **Fixed** (focused, `caneMesh.ts` `caneTint` only): rank
  amplitude 0.12 → 0.30, mottle 0.18 → 0.24, and hue shifts about doubled (mature fields
  yellower, young ones bluer-green). Fields now read as a staggered-harvest patchwork. All 19
  landscape unit tests pass unchanged, since no test pins the tint values.
- *Lockstep sway.* Confirmed in code (`windMaterial.ts`): a non-instanced mesh has `ip = 0`,
  so the phase is 0 for every cane vertex. Each field's whole top slides as one rigid plane,
  by a few cm (`aFlex` 0.35). This is not visible at `fields` distance, and even in the close
  ad-hoc shot it would be at most a few cm. **Minor, deferred.** The fix (phase from
  `position.xz` when not instanced) belongs in the shared wind material, not in cane code.
- *Young palms vs scaled-down old palms:* pass (see `1900-farm-noon`).
- *Farm rows leaking into wild clumps:* none seen in `1900-farm-noon`, `1935-farm-noon` or the
  aerials.
- *Flat-grey patch over a casuarina cluster at q=low:* also present in
  `?era=1975&cam=fields&t=12&freeze=1&q=low`, a view where 2c changes nothing (Δ 0.0 % vs
  before). So it **predates 2c**. It is a low-tier far ground/woody rendering artefact, not a
  2c issue.

## Deferred

- (Task 9) Tall downhill cane walls on riverbank fields (worst 7.8 m). Listed above as an open
  Important item that needs a design ruling.
- (Task 9) Young-palm LOD step: near 3D rosettes versus olive card tufts beyond LOD0 (visible
  in `1900-farm-noon`). This belongs to the impostor bake, not the palm geometry.
- (Task 9) Cane sways in lockstep (non-instanced wind phase = 0). The fix belongs in
  `windMaterial.ts`.
- (Task 9) The 5 m staircase on diagonal field edges shows as lit vertical stripes on close
  walls. The wall texture u restarts on every merged run.
- (Task 9) Pre-2c: flat-grey patch over a casuarina cluster at q=low.
