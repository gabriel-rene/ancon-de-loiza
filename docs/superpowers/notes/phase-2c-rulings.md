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

## Deferred
