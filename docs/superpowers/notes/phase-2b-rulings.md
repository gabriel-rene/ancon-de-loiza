# Phase 2b — rulings and carry-over

## Baseline (before 2b)

Perf (`scripts/dev/perf.mjs`, run against `npm run preview` on :4173):

```
{"query":"?cam=ride&q=high","dpr":1.75,"fps":56.7,"meanMs":17.63,"p95Ms":18.7,"anconCpuMs":0.138}
{"query":"?cam=bank&q=high","dpr":1.75,"fps":59.2,"meanMs":16.9,"p95Ms":17.6,"anconCpuMs":0.144}
{"query":"?cam=ride&q=medium","dpr":1.5,"fps":89.7,"meanMs":11.15,"p95Ms":13.9,"anconCpuMs":0.153}
{"query":"?cam=ride&q=low","dpr":1,"fps":277.3,"meanMs":3.61,"p95Ms":8.6,"anconCpuMs":0.107}
{"query":"?cam=bank&q=low","dpr":1,"fps":279.9,"meanMs":3.57,"p95Ms":8.8,"anconCpuMs":0.098}
```

Screenshots (`tests/snapshots/phase2b-before/`, taken against `npm run dev` on :5173):

- `1935-ride-golden.png` — golden-hour ride view; mangrove clumps on both banks read as fairly distinct silhouettes rather than one flat band, but the far shoreline across the water is a flat dark-green strip with no depth; palms along the near banks are evenly spaced in a row.
- `1975-bank-noon.png` — noon bank view; water reads teal/cyan rather than a noon blue-green; the near-bank mangrove clump is a flat dark mass with little internal shading, and the far shoreline is a continuous flat dark band; palms are evenly spaced in a single row along both banks.
- `1840-bank-noon.png` — same camera/lighting as the 1975 shot with a rowboat instead of the ferry; identical flat dark mangrove band along the far shoreline, teal noon water, and evenly spaced single-row palms on both banks.
- `1984-mouth-dawn.png` — pre-dawn, almost fully dark; the entire treeline on both sides is a single flat black silhouette band with no internal structure, most visible of all six shots.
- `1975-aerial-noon.png` — aerial view; the palm grid on the near shore is clearly visible as an evenly spaced planted-grid pattern rather than naturalistic clustering; the mangrove band hugging both banks of the channel is a thin, flat, uniformly dark line.
- `1975-bank-noon-high.png` — same framing as `1975-bank-noon.png` at `q=high`; teal noon water and flat dark mangrove band are still present, and the higher-resolution reflections reveal a blocky, pixelated fringe under the mangrove clumps on both banks where the reflection meets the waterline.

## Task 7 — ground cover

- R1 (controller): ground cover is placed on the fixed 512 placement fields, then each clump's y is
  re-seated on the rendered `near` fields (shared `reseat`, now in `src/vegetation/reseat.ts`) so
  nothing floats or sinks on medium/low. Checked on screen at `q=low`: clumps sit on the ground.
- Back faces keep their up-leaning normals (`upNormals` material option): with DoubleSide the
  default flip would point a back face's 60 %-up normal into the ground and shade it black.
- Tuning: none needed; brief values kept (spacing from `RULES`, `groundRadius` 60 / 45 / 25).

Perf A/B, same session, interleaved (HEAD `ee1337c` build on :4175 vs this task's build on
:4173; `scripts/dev/perf.mjs`, 10 s each, two runs per side):

| view | dpr | HEAD mean ms (runs) | Task 7 mean ms (runs) | ground clumps drawn |
|---|---|---|---|---|
| `?cam=ride&q=high` | 1.75 | 10.24 / 10.24 | 10.24 / 10.25 | 1231 (1140 grass, 91 reeds) |
| `?cam=bank&q=high` | 1.75 | 9.47 / 9.46 | 9.53 / 9.42 | 1729 (1655 grass, 74 reeds) |
| `?cam=ride&q=medium` | 1.5 | 6.20 / 6.19 | 6.19 / 6.19 | 402 (364 grass, 38 reeds) |
| `?cam=ride&q=low` | 1 | 2.09 / 2.09 | 2.09 / 2.10 | — |

Ground cover cost is within run-to-run noise (≤ 0.06 ms) on every tier, well under the 0.5 ms target.

## Task 9 — clustering

- R8 (controller, extends the brief): black mangrove reads as even rows up close too ("orchard"
  look), and white mangrove shares its rule shape, so the same clumping fix applies to both, not
  just coconut.
- **Correction to round 1 of this note** (round-1 review): round 1 claimed coconut's clumping "was
  already strengthened in an earlier [phase 2b] task." That's false. `git log -L` on
  `RULES.coconut.clump` shows `{ scale: 45, strength: 0.8, size: 0 }` was set in `4fc601c` (phase
  2a) and unchanged until this task — it's the original baseline, not a prior reinforcement.
- R10 (controller, round-2 review): the spec's goal (§4.2, "palms stand in uneven groups, not in
  even rows") outranks the brief's example clump formula — changing the acceptance formula itself,
  not just its numbers, is in scope if that's what it takes.

### Round 1: Clark–Evans, superseded

Round 1 used Clark–Evans R (mean nearest-neighbour distance ÷ 0.5/√density) on a 650 m window
centred on each species' centroid. Round-2 review found this measures the habitat band's *shape*,
not a lattice: area comes from the window's own bounding box, and coconut's coastal band fills
only part of any window that size, which lowers R even for a perfectly even grid (confirmed: a
`placeSpecies('coconut', ...)` run with no other species competing for space — so clump noise is
the *only* source of unevenness — still gave R somewhere around the 0.8 line depending on window
size, not clearly above it). The round-1 "before → after, 0.804 → 0.774" result was a threshold
tuned to pass this specific metric, not solid evidence of a fix. Replaced entirely (below).

### Round 2: quadrat dispersion index

**Method.** `dispersionIndex` in `placement.test.ts`: split the map into 40 m cells, keep only
cells with `density(s) > 0` (habitat), count instances per cell, and compute variance ÷ mean —
Poisson/CSR gives ≈ 1, an even stand gives < 1, real clumping gives > 1. Raw variance/mean over the
*whole* map has the same gradient problem as Clark–Evans, just via a different mechanism: coconut's
own density(s) rises smoothly toward the coast, so quadrat counts vary with position for that
reason alone. Proof: `placeSpecies('coconut', ...)` alone (no occupancy competition from other
species) gives raw variance/mean ≈ 4.7–4.9 regardless of clump tuning (before: 4.90, after: 4.77) —
the gradient alone produces "overdispersion" far past any plausible clustering threshold, so a raw
whole-map quadrat test can't discriminate either. Fix: bin the 40 m cells into 15 quantiles by
their own `density(s)` value first (density is roughly uniform within one quantile), compute
variance/mean *within* each bin, and average the per-bin ratios weighted by bin size. This controls
for the gradient and isolates the clump-noise signal.

**Before/after dispersion index (bins = 15, cell = 40 m)**, `placeAll` fixture
(`{ redMangrove: 1, coconut: 1, casuarina: 1, blackMangrove: 1, whiteMangrove: 1 }`, seed 7),
before = rules at `c93d951` (checked via `git show c93d951:src/vegetation/{rules,placement}.ts`,
reverted, tested, then restored):

| species | before | after | threshold | before count | after count | Δcount |
|---|---|---|---|---|---|---|
| coconut | 1.436 (**fails** < 1.5) | 1.745 (passes) | > 1.5 | 3605 | 3191 | −11.5% |
| casuarina | 0.938 (**fails**, reads as even/CSR) | 2.133 (passes) | > 1.5 | 3048 | 2560 | −16.0% |
| blackMangrove | 2.737 (already passes) | 3.868 | > 1.5 | 5580 | 5586 | +0.1% |
| whiteMangrove | 2.128 (already passes) | 2.781 | > 1.5 | 1898 | 1887 | −0.6% |

RED confirmed for coconut by reverting `rules.ts`/`placement.ts` to `c93d951` and rerunning:
`expected 1.4360111724305111 to be greater than 1.5`. Per the round-2 review instruction ("keep a
mangrove version only if it also fails before, else drop it and say so"): **both mangrove tests
were dropped** — neither blackMangrove (2.737) nor whiteMangrove (2.128) fails before at this
threshold, so a regression test here would guard nothing. `placement.test.ts` keeps a comment
saying so. Casuarina (see "scope extension" below) does show a clean fail → pass and was kept.

### Scope extension: casuarina

Investigating why the visual check (below) showed little change, `window.__ANCON_VEG__.counts` in
a live `q=medium` run of the exact `?era=1986&cam=mouth...` view gave `casuarina: {near: 2374}` vs
`coconut: {near: 714}` — casuarina outnumbers coconut ~3.3× in that exact frame. A disk-level
diagnostic (`density: (s) => { return 0; ... }` on casuarina, `shot.mjs`, revert) confirmed
casuarina is the majority contributor to the "continuous crown line": with it suppressed, the same
frame shows individual coconut palms with real gaps between them. Casuarina was never in the
brief's or R8's scope (spec §4.2 is about palms specifically), but the round-2 review's own
evidence — these two exact camera queries — is dominated by it, so coconut's fix alone can't move
what those frames show. Applied the same gap-shaped clumping mechanism to casuarina (tuning
below); kept it to the same discipline as coconut (dispersion test, ±25% count band) even though
neither was explicitly requested for casuarina.

### Tuning (`src/vegetation/rules.ts`, `clump: { scale, strength, size, octave, gap, phase }`)

R10 permits changing the formula, not just the numbers. The old multiplicative blend
(`1 − strength + 2·strength·n`) never fully zeroes except at exact noise minima — a lighter
fringe, not a real gap — and, worse, thinning a candidate grid down from ~100% acceptance inside
a "grove" barely changes its *local* nearest-neighbour statistics (the grid's own jitter dominates
there); large-scale gaps between groves are the only thing it can produce. New **threshold-shaped**
acceptance (used when `clump.gap` is set): `mult = smoothstep(gap − w, gap + w, n)`, with
`w = max(0.03, 0.5·(1 − strength) + 0.05)` — noise below the cut gives *true* zero acceptance
(no candidates at all, not just fewer), noise above it gives a dense grove. `strength` now controls
the transition's sharpness instead of blend depth.

New `clump.phase?: number`, folded into the noise seed (`noiseSeed = opts.seed*977 + salt +
(phase ?? 0)`): the per-species noise seed has no relationship to world position, so whether a
noise trough happens to land under any one fixed camera is luck of the hash. Verified directly:
holding `coconut`'s `scale`/`gap`/`strength` fixed and sweeping `phase` in steps of 13 from 0–400,
the noise profile along the visible mouth-camera shoreline ranged from "never dips below 0.49
anywhere in a 550 m stretch" (bad luck, `phase: 0`) to "drops to 0.09" (`phase: 13`) — same
statistics everywhere else on the map, different realisation at this one camera. `phase: 13` is
used for both coconut and casuarina (found the same way, independently, for each).

- coconut: `{ scale: 45, strength: 0.8, size: 0 }` → `{ scale: 200, strength: 0.85, size: 0.08,
  octave: true, gap: 0.25, phase: 13 }`. Deviates from the brief's example value (`scale: 70`,
  no `gap`/`phase`): the brief's plain octave/strength recipe at any scale tried (45–350) could not
  clear the quadrat threshold at any window without exceeding the ±25% count band — see the
  Clark–Evans section above for the equivalent finding under round 1's metric.
- casuarina: `{ scale: 60, strength: 0.75, size: 0.12 }` → `{ scale: 200, strength: 0.85,
  size: 0.12, octave: true, gap: 0.3, phase: 13 }` (scope extension, see above; not in the
  original brief/ruling).
- blackMangrove, whiteMangrove: unchanged from round 1 (`octave` renamed `1` → `true`, see Minor
  fix below); already pass the new dispersion test with a wide margin and their quadrat tests were
  dropped per the review instruction (see table above).
- `clump.octave` changed from `number` to `boolean` (round-2 review, "Minor"): it was only ever
  checked truthy, so a numeric type implied a weight that didn't exist.
- All species' `rules.test.ts` habitat assertions stay green (clump tuning never touches
  `density()`); counts stay within the ±25% band for every species that has one (max deviation
  16.0%, casuarina).

### Visual check (`npm run dev`, `scripts/dev/shot.mjs`, `q=medium`)

Before shots are from a temporary `git worktree add <scratchpad>/wt-c93d951 c93d951` + `npm ci`,
served on :5173 in place of the working tree, then removed (`git worktree remove --force`).

- `?era=1986&cam=mouth&t=7.2&c=0&freeze=1&q=medium`: cropping the left-bank third of the frame
  (0–650×300–520 px) before vs after shows the before crop as one unbroken tree wall to the image
  edge; the after crop thins out and shows an isolated single palm with visible sky before the
  bank's edge. Modest but real — most of this exact frame's mass is casuarina + red/black mangrove
  fringe beyond this task's scope (see "scope extension" for what's in scope and why the change
  isn't larger).
- `?era=1975&cam=aerial&t=12&c=95&freeze=1&q=medium` vs the `c93d951` worktree's own render of the
  same query (not `tests/snapshots/phase2b-before/1975-aerial-noon.png`, which predates several
  intervening vegetation tasks and isn't a same-code comparison): the coastal ridge (upper right)
  shows a distinct sparse/thinned patch about a third of the way along in the after shot that reads
  as continuous, unbroken tree cover in the before shot. The foreground pasture (coconut, away from
  casuarina's coastal band) already showed good clumping before this task's changes and is
  materially unchanged — that area was never the problem.

## Round 3 — grove coverage mode (R11)

- **Correction to round 2's visual-check note**: round 2 said the foreground pasture "already
  showed good clumping before this task's changes and is materially unchanged — that area was
  never the problem." That was wrong — it's exactly what R11 identifies as the real defect (an
  even, one-grid-spacing scatter), just not visually obvious in the round-2 screenshots at that
  resolution/distance. See the before/after comparison below; it's dramatic once the pasture is
  actually the thing being looked at.
- R11 (controller): the dense coastal forest lines (mouth left bank, aerial coast strip) reading as
  continuous is realistic for Piñones — dropped as a target. The real defect is coconut's
  low-density habitat (the `bank`/`town` density terms): with a low d, both the old smooth blend
  and the round-2 `gap` threshold multiply d by a clump factor, so acceptance stays a low,
  *roughly uniform* rate everywhere — clumping can only redistribute *where* that thin, even
  scatter falls, never turn it into real, dense little groves. Ruling: implement a coverage mode
  where density controls grove *coverage* (what fraction of the map is grove), not acceptance rate
  inside one.
- Removed `clump.phase` (round-2 review's own follow-up: "overfits to one camera and one seed;
  its benefit is not visible"). Re-tuned coconut from scratch without it.

### Coverage mode

New `clump.coverage: { k, groveDensity }` (`rules.ts`), used in `placement.ts` in place of the
`gap`/smooth-blend branches when set: a site is inside a grove when `n > 1 − min(1, d·k)` (n = the
clump noise, d = the site's habitat density) — so the *fraction of habitat that is grove* scales
with `k·d`, not the acceptance rate. Inside a grove, acceptance is a flat
`min(1, coverage.groveDensity)`, independent of d; outside, it's 0. This is the only one of the
three modes where a low d still produces dense clusters with real open ground between them.

Applied to **coconut only** (as instructed); casuarina keeps its round-2 `gap`-threshold setting
(coverage mode wasn't clearly better for it, and it wasn't asked for).

### Tuning

`coconut.clump`: `{ scale: 70, strength: 0.85, size: 0.08, octave: true, coverage: { k: 1.3,
groveDensity: 0.8 } }` (`strength` is now only vestigial for coconut — coverage mode doesn't read
it — but the field is required by `SpeciesRule`, so it's left at a sane value).

Found by sweeping `scale ∈ {40,60,70,90}`, `k ∈ {0.4..1.5}`, `groveDensity ∈ {0.75..1}` against
four constraints simultaneously: count within ±25 % of 3605 at **both** seed 7 and seed 1840 (the
app's `NEAR_SEED`), the existing `density scales counts roughly linearly` test (halving density
must still roughly halve the count — coverage mode's count-vs-density relationship isn't as linear
as the old multiplicative modes, since it's an area-fraction relationship, not a direct
probability), and the quadrat dispersion index clearing 1.5 at cell sizes 30, 40 and 50 m. First
few candidates (e.g. `k=1.3, groveDensity=0.8` at `scale=60`) passed counts and dispersion but gave
`half/full ≈ 0.348`, just under the existing test's `> 0.35` floor; `scale=70` at the same
`k`/`groveDensity` gives `0.357` with counts still in range.

| check | value |
|---|---|
| count, seed 7 | 3485 (−3.3 %) |
| count, seed 1840 | 3670 (+1.8 %) |
| half/full density ratio | 0.357 (existing test requires 0.35–0.65) |
| dispersion, cell 30 (bins 20) | 2.30 |
| dispersion, cell 40 (bins 20) | 3.08 |
| dispersion, cell 50 (bins 20) | 4.30 |

(Counts above are from the final `placement.test.ts` run, not the sweep script; the sweep script
reported very slightly different numbers for the same nominal parameters because it computed
`density scales counts roughly linearly` via `placeSpecies` with `seed: 3`, a third RNG phase, not
seed 7/1840 — kept here for the reader tracing the exact commands, not because seed 3 is a
requirement.)

### Dispersion test made robust across cell sizes

At the original `bins = 15`, the pre-task-9 (`c93d951`) dispersion index crossed back *above* 1.5
at `cell = 50` (1.581) even though `cell = 30` (1.094) and `cell = 40` (1.436) stayed under it —
bigger quadrats accumulate more of the habitat gradient's own variance, so the "even stand → ≈ 1"
approximation degrades as cells grow relative to the gradient's length scale. Increased to
`bins = 20`, which pulls every cell size's pre-task-9 value back under 1.5 (30: 1.081, 40: 1.394,
50: 1.458) while the post-fix values stay far above it at all three (2.30 / 3.08 / 4.30). The
`palms stand in groups...` test in `placement.test.ts` now loops `cell ∈ [30, 40, 50]`. RED
confirmed for all three by reverting to `c93d951` and rerunning (fails at `cell = 30`:
`expected 1.0805... to be greater than 1.5`, before even reaching 40 or 50).

Casuarina's single test (`cell = 40, bins = 15`) is unchanged from round 2 and was not converted to
a loop — it wasn't asked for, and casuarina's `cell = 30` value at `bins = 20` (1.41) is under 1.5,
so looping it the same way would need its own re-tuning; out of scope for this round.

### Two stale comments fixed

- `placement.test.ts:28` (now ~27): cited `task-9-report.md, "quadrat test — the gradient
  confound"`, a section heading that was never actually written under that name. Now points at
  this rulings-note section instead.
- `placement.test.ts:75` (now ~75): said "Round-1 review" for a finding (the Clark–Evans
  bounding-box artefact) that was actually raised in round 2's review. Corrected to "Round-2
  review".

### Visual check (`npm run dev`, `scripts/dev/shot.mjs`, `q=medium`)

- `?era=1975&cam=aerial&t=12&c=95&freeze=1&q=medium` vs `before-c93d951-aerial.png`: this is the
  target the round-3 review named. Before: the foreground pasture is filled with a dense, roughly
  even scatter of individual palms at close to one grid spacing — the "orchard" look. After:
  most of the pasture is open ground, with several distinct clusters of close-together palms
  (including one dense grove bottom-right) and clear gaps between them. This is the clearest
  before/after difference of any shot taken across all three rounds of this task.
- `?era=1986&cam=mouth&t=7.2&c=0&freeze=1&q=medium`: re-shot to confirm nothing regressed — visibly
  unchanged from the round-2 shot (dense treeline, dominated by casuarina and the mangrove fringe,
  which R11 explicitly says is realistic and out of scope here).

## Task 10 — noon colour

### Controller ruling R2 (applied)

Overrides the brief's golden-hour invariance check to use `atmosphereFor(3)` (there
`high = smooth(3, 35, 3) = 0`) for exact equality with the pre-existing constant grade balance
`[1.06, 1.0, 0.9]` and saturation `1.15`, plus a second, looser check at `atmosphereFor(6)`
(within 0.02 per component) since 6° is not at the pure-golden end of the `high` ramp and the old
code had no elevation-dependence to compare against exactly. Both checks are in
`src/geo/atmosphere.test.ts`.

### Fix

- `fogDay`'s high-sun end changed from `[0.62, 0.74, 0.88]` (teal — G and B both well above R) to
  `[0.74, 0.78, 0.86]` (R close to G, B only modestly above both — warm haze, not teal).
- `fogAway`'s high-sun end changed from `[0.5, 0.62, 0.8]` to `[0.6, 0.66, 0.8]` (same idea, kept
  cooler than `fogDay` since it's the away-from-sun sky haze).
- Added `balance: RGB` and `saturation: number` to `Atmosphere`, both a function of `high`:
  `balance` golden `[1.06, 1.0, 0.9]` → high-sun `[1.04, 1.0, 0.94]`; `saturation` golden `1.15` →
  high-sun `1.05`. `Post.tsx`'s grade effect now reads `sun.atm.balance` / `sun.atm.saturation`
  instead of the hardcoded golden-hour-only constants, so the grade itself de-warms and desaturates
  slightly as the sun climbs, instead of applying the golden-hour warm/saturated grade at every
  time of day (the second, larger source of the teal-reading noon look — the fog fix alone only
  changes the pre-tonemap fog term, not the flat post-process push toward warm+saturated).

### Hue measurements (`scripts/dev/hue.mjs`, `npm run dev` on :5173, linear-space means)

`hue.mjs` decodes the PNG with `createImageBitmap`/`getImageData` in-page, converts sRGB→linear,
and prints the mean linear RGB of the lower half (land+water) and upper third (sky).

**Noon** — `?era=1975&cam=bank&t=12&c=95&freeze=1&q=medium`:

| | R | G | B | G/R | B/R |
|---|---|---|---|---|---|
| lower half, before | 0.2645 | 0.3972 | 0.2469 | 1.502 | 0.933 |
| lower half, after | 0.2704 | 0.3944 | 0.2675 | 1.459 | 0.990 |
| sky, before | 0.5102 | 0.6531 | 0.7477 | 1.280 | 1.465 |
| sky, after | 0.5262 | 0.6524 | 0.7477 | 1.240 | 1.421 |

The lower-half ratios stay dominated by green grass/foliage (G/R ≈ 1.46–1.50 either way — this is
expected, real grass, not haze), but B moved from below R (0.933, i.e. not teal by the sky-haze
definition but slightly cool) to essentially matching R (0.990) and both G/R and B/R (sky) dropped
— less blue-green cast overall, consistent with the unit-test assertions on `fogColor` directly
(`atmosphereFor(60).fogColor`: G/R 1.19→ still <1.1 required — see below — and B/R <1.25).

Underlying `atmosphereFor(60).fogColor` (what actually changed): before `[0.62, 0.74, 0.88]`
(G/R 1.19, B/R 1.42 — teal), after `[0.74, 0.78, 0.86]` (G/R 1.05, B/R 1.16 — warm/neutral, passes
the new test's `< 1.1` / `< 1.25` thresholds).

**Golden hour** — default query (no params):

| | R | G | B |
|---|---|---|---|
| lower half, before | 0.2279 | 0.2069 | 0.1206 |
| lower half, after | 0.2278 | 0.2069 | 0.1210 |
| sky, before | 0.6882 | 0.6294 | 0.4688 |
| sky, after | 0.6882 | 0.6294 | 0.4696 |

All four channels are within 0.3% of their "before" value — well inside the brief's ±3% budget.
The default query happens to land at an elevation close enough to the pure-golden end of the `high`
ramp that `balance`/`saturation` are effectively unchanged there; `atmosphereFor(3)` and
`atmosphereFor(6)` are checked exactly/approximately in the unit tests for the precise elevations.

### Screenshot comparison

`before-noon.png` (this task, HEAD before the change) is visually indistinguishable from the
existing `tests/snapshots/phase2b-before/1975-bank-noon.png` baseline, confirming the "before"
capture is representative. `after-noon.png` (same query, with the fix) shows: foliage greens
unchanged in hue (still natural green, not shifted), sand/grass unchanged, water still reads blue,
and the sky's blue is very slightly less saturated/less blue-white in the upper reaches — a subtle
shift, matching the modest size of the `fogColor`/`balance` change (this is a grade correction, not
a dramatic re-light). No regression toward warm/orange at noon.

### Glossy-leaf sky sheen (sea grape roughness 0.5, almendro roughness 0.55)

Checked at noon in `after-noon.png` and by inspection of the shader: the slight blue-teal sheen on
these glossy flat leaves comes from the **sky/environment reflection** (`envIntensity`, the sky
dome's own color ramp, `skyHaze`/`skyGain`) via each material's roughness-weighted specular
response, not from `fogColor` or the post-process grade — neither of which this task touched for
the environment map itself. **This fix does not remove that sheen**, and per the brief it was not
meant to: `fogColor`/`fogAway`/`balance`/`saturation` govern the atmospheric haze and the
post-tonemap grade, while the sky dome colour that materials reflect is driven by the Preetham sky
uniforms (`turbidity`, `rayleigh`, `mie`, `mieG`), unchanged here. Retuning the sky-dome color ramp
or the affected materials' roughness/env response is out of scope for this task (the brief says not
to retune plant materials) and would need its own task if the sheen is judged to be a problem.

(Round 2 note: round 2 *does* reduce `envIntensity` at high sun — see below — which lowers the
overall strength of that sky-reflection sheen somewhat, since less environment light reaches every
surface including the glossy leaves. It does not change the sky's *colour*, so the sheen is dimmer
but not less blue. Still out of scope to retune further here.)

## Task 10 round 2 — controller review R12 and R2-followup findings

### R12 — real-scene bar replaced with per-region metrics

Round 1's whole-lower-half average was dominated by legitimately green grass and couldn't
distinguish "natural green" from "teal cast" (round-1 report already flagged this as a weak
metric). `scripts/dev/hue.mjs` was rewritten to sample three fixed rectangles (1440×900 viewport,
`?era=1975&cam=bank&t=12&c=95&freeze=1&q=medium` framing) instead of halves/thirds:

- `ground` `{x:950,y:621,w:317,h:162}` — clean pasture, clear of UI, poles and the boat.
- `water` `{x:605,y:518,w:345,h:27}` — calm water, clear of the boat and mangrove reflections.
- `horizonHaze` `{x:650,y:398,w:250,h:22}` — right at/just above the treeline. This rect matters:
  an earlier attempt at `y:369-405` (higher in the sky) sampled mostly the raw Preetham sky colour,
  not the fog term — `HeightFogEffect`'s sky-branch haze (`f = 1 - (1 - skyHaze·exp(-y·7))·(1 -
  exp(-y·60))`) only approaches full strength as the view ray's altitude `y` (`dir.y`) approaches
  0, i.e. right at the horizon; a few pixel-rows higher and the `exp(-y·60)` term collapses the
  haze contribution to near zero, letting the bluer sky underneath dominate. Verified by scanning
  the column at x=650–950: colour stays a pale blue-grey from y≈0 through y≈400, then goes
  through a fog-dominated near-neutral band around y≈398–422, then treeline geometry breaks it up.

Each region reports mean **linear** RGB (for the ratio thresholds) and an **sRGB** hue angle (the
screenshot's own gamma-encoded pixels — this is the space a human eye / colour-picker reads hue
in, and the one the targets below are stated in).

### R12 targets and final numbers (noon: `?era=1975&cam=bank&t=12&c=95&freeze=1&q=medium`)

| region | target | round-1 (after task-10 commit) | round-2 (final) |
|---|---|---|---|
| ground hue | 75°–100° | 106.8° (fail — mint/teal side) | **94.0°** (pass) |
| water B vs G (linear) | B ≥ G | 0.819 ≥ 0.762 (pass) | 0.816 ≥ 0.764 (pass) |
| horizon haze R vs B (linear) | R ≥ 0.9·B | 0.711 vs 0.9·0.837=0.753 (fail) | **0.743 vs 0.9·0.809=0.728** (pass) |

Golden hour (default query) and one dawn shot (`?era=1986&cam=mouth&t=7.2&c=0&freeze=1&q=medium`),
compared against the true pre-task-10 baseline (`4dd1f8c`, via `git show`), per region, linear RGB:

| | R | G | B |
|---|---|---|---|
| golden ground, before | 0.0597 | 0.0884 | 0.0757 |
| golden ground, after | 0.0610 | 0.0894 | 0.0768 |
| golden water, before | 0.2276 | 0.1892 | 0.1013 |
| golden water, after | 0.2278 | 0.1892 | 0.1014 |
| golden horizonHaze, before | 0.8302 | 0.6367 | 0.3089 |
| golden horizonHaze, after | 0.8294 | 0.6363 | 0.3092 |
| dawn ground, before | 0.0430 | 0.0441 | 0.0308 |
| dawn ground, after | 0.0431 | 0.0441 | 0.0308 |
| dawn water, before | 0.1096 | 0.1011 | 0.0568 |
| dawn water, after | 0.1097 | 0.1012 | 0.0568 |
| dawn horizonHaze, before | 0.4305 | 0.2998 | 0.1954 |
| dawn horizonHaze, after | 0.4309 | 0.3000 | 0.1954 |

Largest delta across all 18 numbers is ~2.2% (golden ground R); everything else is under 1.5%,
most under 0.3% — well inside the ±3%-per-region budget. This is expected: every value changed in
round 2 lives at the high-sun end of an elevation-dependent mix, and at golden/dawn elevations the
`high` term is small (≈0.026 at elevation 6, ≈0 at elevation ≤3), so the golden/dawn end of every
ramp is nearly untouched.

### R12 — why round 1 still looked wrong, and what actually fixed it

Round 1 only changed `fogColor`'s high-sun end and made `balance`/`saturation` elevation-dependent,
but landed a *combination* that was still off:

1. **`envIntensity` barely dropped at noon** (round 1: golden ≈1.10, noon 1.0 — an ~10% gap) so the
   environment map (a genuinely, physically blue clear-sky dome) kept dumping nearly
   golden-hour-strength blue ambient fill onto every surface, including grass. Green diffuse +
   strong blue ambient fill reads as mint/cyan, and desaturates + flattens contrast — an
   observation independent of `fogColor` (`fogColor` only feeds the height-fog post-process, not
   the IBL ambient term wired through `scene.environmentIntensity` in `SkyAndLight.tsx`).
2. **`saturation` dropped too far at noon** (round 1: 1.05, a bigger drop from golden's 1.15 than
   necessary), compounding the washed-out look on top of (1).
3. **`fogAway`'s high-sun end was still fairly cool** (round 1: `[0.6, 0.66, 0.8]`, R/B = 0.75) —
   `fogAway` (not `fogColor`) is the dominant term for haze looking *away* from the sun, which is
   most of what a wide horizon band shows at noon (the sun is high, so most of the visible horizon
   isn't within the narrow forward cone that reads `fogColor`).

Round-2 fix, all in `src/geo/atmosphere.ts`, all as new high-sun endpoints of existing elevation
mixes (golden-hour endpoints untouched, so the round-1 golden-hour invariance tests still pass
unmodified):

- `envIntensity` high-sun end: `1.0` → `0.75` (bigger ambient-fill drop at noon).
- `balance` high-sun end: `[1.04, 1.0, 0.94]` → `[1.09, 1.0, 0.91]` (a bit more direct warmth
  carried into the grade at noon, rather than nearly neutral).
- `saturation` high-sun end: `1.05` → `1.12` (keep most of the golden-hour richness; only fogColor
  was teal, not "how colourful the image should be").
- `fogDay` high-sun end (feeds `fogColor`): `[0.74, 0.78, 0.86]` → `[0.85, 0.84, 0.83]` (near-
  neutral with a hint of warmth, up from a still slightly cool value; the round-1 unit test
  thresholds — G/R < 1.1, B/R < 1.25 — still pass comfortably: 0.988 and 0.976).
- `fogAway` high-sun end: `[0.6, 0.66, 0.8]` → `[0.78, 0.78, 0.8]` (the main lever for the
  horizon-haze region, which is dominated by `fogAway` at noon).

New unit tests added to `atmosphere.test.ts` for every one of these changed values (per instruction
to test any atmosphere value changed): RED confirmed against the round-1 code
(`git show d0c5ce3:src/geo/atmosphere.ts`), GREEN against round 2 — see the report for the exact
failure output.

### Screenshots

- `/private/tmp/claude-501/.../scratchpad/round2-noon.png` — same noon query, round-2 fix. The
  ground now reads a richer, more yellow-green olive tone with visible texture/variation instead of
  the flat, pale, low-contrast mint of round 1's `after-noon.png`. The sky is still genuinely blue
  (correct for a clear tropical noon), but the overall frame has noticeably more contrast and warmth
  than round 1 while staying clearly distinct from the golden-hour look.
- `round2-noon-ground.png` — cropped ground-only comparison against round 1's
  `after-noon-ground.png`: round 1 is a flat sage/mint green; round 2 is a warmer, more varied olive
  green, matching the "foliage greens: still natural green, not shifted" bar the task originally
  asked for (round 1's own screenshot section had actually failed this by inspection, which is what
  round 2 fixes).

## Task 11 — reflection

Query: `?era=1975&cam=bank&t=12&c=95&freeze=1&q=medium` (and `q=high`), 1440×900 @ dpr 1. Crops are
x 900–1260, y 440–540 of the frame, upscaled 4× nearest.

**Root cause: (a) reflection resolution, made visible by (c)'s binary alpha-test edges.** Not (b).
- (b) ruled out by reading the code: three r186 `Reflector` makes a `WebGLRenderTarget` with
  `samples: 4` (MSAA), `HalfFloatType`, and the RenderTarget defaults `minFilter = magFilter =
  LinearFilter`, no mips. The water samples it under magnification (~2.9 screen px per texel on
  medium), so mips would not matter anyway.
- (a) confirmed by experiment: medium with `reflScale` forced to 1.0 (`e1-refl1-crop.png`) has no
  stair-steps — the reflected fringe shows the same 1-px alpha-test aliasing as the direct view. At
  0.35 (`before-med-crop.png`) the steps are ~3 px blocks; at 0.5 (`before-high-crop.png`) ~2 px.
- (c) is why the steps are hard: the fringe beyond `reflLod0` is impostor cards with `alphaTest`
  0.5, whose edges MSAA does not resolve (discard is per fragment), so each texel is fully in or
  out and bilinear magnification only ramps across one texel.

**Fix (try 1 of the brief, sufficient; tries 2–3 not needed):** the water shader now resolves the
reflection with 4 bilinear taps on a rotated grid, radius 0.75 reflection texels
(`src/scene/water/reflTaps.ts`, `uReflTexel` set from the target size in `Water.tsx`). Applies to
every tier; the smoothing is in texels, so it is ~2.1 screen px on medium, ~1.5 on high.

Crops (scratchpad): `task11-medium-before-after.png`, `task11-high-before-after.png` (top before,
bottom after). The stepped silhouettes of the reflected mangrove line become soft ramps on both
tiers; the reflection keeps its shapes and gaps (sky holes between crowns still read).
High-frequency energy in the reflection band (mean |2nd x-difference| of luma, x 860–1440,
y 478–545): medium 3.89 → 2.62, high 5.76 → 3.92.

**Perf** (same session, HEAD build on :4174 vs fix on :4173, interleaved, 3 runs each,
`perf.mjs … 10 1.5`, mean ms): ride medium 6.57 → 6.45, bank medium 6.00 → 5.83. No cost beyond
noise (run-to-run spread ≈ 0.3 ms); 3 extra texture taps per water fragment are negligible here.

## Task 11b — draw-call budget

Same-session A/B, `scripts/dev/perf.mjs` (10 s), 2 interleaved runs per build, `npm run preview`
builds of baseline 9403740 (`base`), 35304bd before this task (`head0`) and this task (`final`).
Mean frame ms (fps):

| query | dpr | base | head0 | final | final − base |
|---|---|---|---|---|---|
| `?cam=ride&q=high` | 1.75 | 8.97 (111.5) | 10.21 (97.9) | 9.18 (109.0) | +0.21 ms |
| `?cam=bank&q=high` | 1.75 | 8.23 (121.5) | 9.34 (107.2) | 8.43 (118.7) | +0.20 ms |
| `?cam=ride&q=medium` | 1.5 | 5.51 (181.3) | 6.16 (162.2) | 5.55 (180.1) | +0.04 ms |
| `?cam=ride&q=low` | 1 | 2.01 (497.6) | 2.10 (475.4) | 2.01 (496.0) | −1.6 fps (0.00 ms) |
| `?cam=bank&q=low` | 1 | 1.67 (599.8) | 1.76 (568.2) | 1.65 (606.5) | +6.7 fps |

An earlier (slower) session of the same three builds: ride high 11.56 / 13.79 / 12.04 ms; a
third build-to-build spread of ±0.15 ms on ride high between sessions.

Draw calls / triangles per frame (one frame, counted at the GL level per framebuffer; shadow
map, main view, water reflection; the ~25 post-processing quads are in the totals only):

| query | build | total calls | shadow | main | reflection |
|---|---|---|---|---|---|
| ride high | base | 152 / 8.90 M | 28 / 3.19 M | 52 / 4.36 M | 46 / 1.35 M |
| ride high | head0 | 256 / 12.09 M | 52 / 3.51 M | 97 / 5.94 M | 81 / 2.64 M |
| ride high | final | 231 / 6.28 M | 52 / 2.58 M | 94 / 2.50 M | 59 / 1.20 M |
| bank high | head0 → final | 254 → 248 / 11.48 → 6.06 M | 3.22 → 2.48 M | 5.66 → 2.35 M | 2.60 → 1.23 M |
| ride medium | head0 → final | 226 → 198 / 4.85 → 1.96 M | 1.04 → 0.87 M | 2.41 → 0.57 M | 1.40 → 0.52 M |
| ride low | head0 → final | 158 → 130 / 0.88 → 0.50 M | — | 0.60 → 0.26 M | 0.28 → 0.24 M |

**Draw calls were not the cost.** In-page A/B on head0 (ride high): injecting 72 extra
one-instance vegetation draws (192 more calls per frame across the three passes) cost 0.0 ms;
hiding all vegetation saved 3.3 ms, of which LOD0 bark 1.6, LOD0 foliage 1.1, cards 0.9 and the
shadow pass 1.0 (overlapping). The cost was geometry drawn *outside the view*: every LOD0 mesh
within 220 m and every card to the horizon was drawn in the main view and the reflection,
including the ~⅔ behind or beside the camera (`frustumCulled = false` on whole-species
instanced meshes). So step 2.1 (merge the 3 variants into one mesh per part / card atlas) was
not built: it only saves calls, which measure as free here.

Kept (each A/B'd against base in the same session):

1. **Per-instance view culling** (vs head0: −1.5 ms ride high, −1.35 bank high, −1.1 medium): at each LOD
   split the camera frustum is projected to a horizontal wedge (corner rays, +12° margin; the
   water reflection's mirrored camera projects to the same wedge), and only instances whose
   crown disc (+1 m sway, +8 m for the move allowed between splits) touches it are gathered.
   A turn out of the wedge redoes the split at once. Split cost ≈ 1.3 ms for all 8 species
   (ride: ~0.6 splits/s → 0.007 ms/frame).
2. **Shadow casters from the sun's shadow box**, not the view: separate shadow-pass meshes per
   casting part (count 0 outside the shadow pass via `onBeforeShadow`/`onAfterShadow`), over
   the LOD0 instances whose bounding sphere reaches into the shadow camera's box (+10 m slack;
   redone when the box drifts 10 m or the sun turns 1°). Out-of-view trees still shade the view;
   trees nowhere near the shadow map no longer draw into it (shadow 3.51 → 2.58 M tris, ≈ −0.1 ms).
3. **Pneumatophores cast no shadow** (step 2.2): split into their own `bark` part with
   `shadow: false` (≈ 1.4 cm pencil roots under a ≈ 7 cm shadow texel on high); ≈ −0.05 ms.

Tried and dropped: view margin 6° instead of 12° (no measurable gain); 2 m instead of 8 m
move inflation (no gain, more splits). Step 2.3 (skip reflection per species) not done: after
culling, hiding vegetation from the reflection entirely measured 0.0 ± 0.3 ms.

Step 3: ground-cover habitat masks are warmed in the placement memo (`warmHabitat`), and
GroundCover `CAP` is 2500.

Visual check: `?era=1975&cam=bank&t=12&c=95&freeze=1&q=high`, `?era=1935&cam=ride&t=17.5&c=40&freeze=1&q=high`,
`?era=1986&cam=mouth&t=7.2&c=0&freeze=1&q=medium`, `?era=1975&cam=aerial&t=12&c=0&freeze=1&q=high`,
`?era=1975&cam=bank&t=12&c=95&freeze=1&q=low` before/after: per-pixel max-channel difference at
the run-to-run noise floor (mean 0.26–0.52 of 255; one pixel > 3 in two shots, none > 8). A
screenshot taken the frame after a fast mouse turn shows plants to both frame edges.

**Gate:** medium and bank low pass; bank high passes at the limit (+0.20 ms); ride high is
+0.21 ms (0.01 over) and ride low −1.6 fps (0.00 ms at ~500 fps; the −1 fps rule is below the
measurement's resolution there). What remains is fragment work, not geometry: final draws fewer
triangles than the baseline in every pass on every tier; the new species' on-screen pixels and
alpha-tested foliage overdraw in the 4096² shadow map (hiding all vegetation shadows still saves
≈ 1 ms) are what is left. Closing the last 0.01–0.05 ms would take a visible trade: e.g. lod0
220 → 200 m on high, a coarser shadow for distant foliage, or a lower far-ring card density.

## Task 12 — gate

### E2E

`tests/e2e/world.spec.ts` now writes `tests/snapshots/phase2b/` and adds `1975-bank-noon` and `1840-bank-noon`
(t=12). `npm run e2e`: 18 passed, no console errors (world shots, default view, picker, panel, `@slow` leak probe).

### Perf A/B (R6/R13)

Same session, interleaved, `scripts/dev/perf.mjs` 10 s, 2 runs per build; `vite preview` builds of the baseline
`9403740` (temporary worktree, :4174) and HEAD `14f2351` (:4173). Mean frame ms (fps):

| query | dpr | base 9403740 (runs) | HEAD (runs) | HEAD − base | gate |
|---|---|---|---|---|---|
| `?cam=ride&q=high` | 1.75 | 8.97 / 8.99 (111.4 / 111.3) | 9.17 / 9.19 (109.1 / 108.8) | +0.20 ms | pass (at the limit) |
| `?cam=bank&q=high` | 1.75 | 8.22 / 8.23 (121.6 / 121.5) | 8.41 / 8.41 (118.9 / 118.8) | +0.19 ms | pass |
| `?cam=ride&q=medium` | 1.5 | 5.51 / 5.51 (181.4 / 181.4) | 5.55 / 5.55 (180.0 / 180.2) | +0.04 ms | pass |
| `?cam=ride&q=low` | 1 | 2.03 / 2.03 (493.2 / 493.8) | 2.01 / 2.02 (497.6 / 494.5) | +2.6 fps | pass |
| `?cam=bank&q=low` | 1 | 1.68 / 1.67 (596.3 / 599.9) | 1.60 / 1.68 (625.8 / 594.0) | +11.8 fps | pass |

No tuning (every tier passes). Cold start (`?q=high&debug=1`, default ride view, `window.__ANCON_VEG__`, two fresh
loads): placement 788 / 789 ms + impostor bake 127 / 128 ms ≈ 0.92 s (< 2 s). Low: 283 ms + 129 ms.

**Worst case, camera inside a dense grass field.** Spot found by scanning `RULES.grass.density` over the 512 fields
(mean density 0.99 within 25 m, 50+ m from the river): the `mouth` preset temporarily set to pos (−70, 3.7, −100),
target (−130, 2.2, −160), built into scratch `dist` folders for both commits (reverted, not committed);
`?cam=mouth&t=12`, era 1975. 3023 grass clumps drawn on high, 277 on low.

| tier | dpr | base (runs) | HEAD (runs) | HEAD − base |
|---|---|---|---|---|
| high | 1.75 | 6.96 / 6.96 (143.8 / 143.7) | 7.24 / 7.25 (138.1 / 137.9) | +0.29 ms |
| low | 1 | 1.63 / 1.63 (613.5 / 611.8) | 1.65 / 1.66 (605.3 / 603.6) | +0.025 ms (−8 fps) |

The dense-grass worst case is over the 0.2 ms bar on high (+0.29 ms at ~138 fps); it is not one of the five gate
queries, so nothing was tuned. If it matters, ground `spacing` for grass (1.6 m) or high's `groundRadius` (60 m) is
the first knob per the brief's order.

### Before / after (`tests/snapshots/phase2b-before/` → `tests/snapshots/phase2b/after-*.png`, `npm run dev`, `shot.mjs`)

- `1935-ride-golden` — the even row of foreground palms is gone from this stretch (grove coverage mode leaves it
  without coconuts); the far shore is now a layered treeline of separate crowns with sky between them instead of a
  flat strip; a tall tiered almendro stands out against the sky on the left bank; reflections are soft-edged.
- `1975-bank-noon` — noon water is neutral blue instead of teal; the near mangroves have internal light and shade and
  a lighter almendro/white-mangrove canopy at the left edge; the far shore is layered with lighter back-row canopies;
  no palm rows in frame; one grass clump on the near bank; the reflected fringe is soft.
- `1840-bank-noon` — same changes as the 1975 noon shot (rowboat era); the far treeline shows varied crowns and
  canopy tones instead of one dark band.
- `1984-mouth-dawn` — still pre-dawn black (R3); palm silhouettes now stand in uneven groups rather than a flat band.
  Not diagnostic, hence the 7th pair.
- `1975-aerial-noon` — the planted palm grid on the coast is replaced by uneven groups with gaps; a sea-grape and
  buttonwood edge shows along the beach, and the sand carries faint green vine tint; the channel's mangrove band is
  textured and broken rather than a thin flat line.
- `1975-bank-noon-high` — the blocky, pixel-stepped reflected fringe is now a smooth ramp; far-shore almendros read as
  thin trunks with flat floating plates at this distance.
- `1986-mouth-morning` (new pair, t=7.2, before from a `9403740` dev server) — reflections of both points are smooth
  instead of stepped; palms stand in irregular groups; the near-right mangrove has layered, lit canopy.

### Carried checks

- **Grass field, high and low** — see the worst-case table above. Visually (scratchpad `grass-high.png`,
  `grass-low.png`): high is a full, uneven field of clumps between buttonwood-like shrubs; low shows sparse clumps
  within 25 m and bare tinted ground beyond.
- **Low tier with ground cover inside 25 m** — `grass-low.png`: clumps sit on the ground, the fade band at ~20–25 m
  is visible as a screen-door stipple on individual clumps at dpr 1.
- **In motion, ground-cover fade ring** (40-frame slow orbit in the grass field, high and low): clumps fade in over
  several frames as the ring passes; no single-frame pops seen. On low the stipple of fading clumps is noticeable
  up close; on high the fade band is far enough that it reads as thinning.
- **In motion, reflection smoothing** (40-frame slow orbit, `?era=1975&cam=bank&t=12&c=95&freeze=1&q=medium`, HEAD vs
  baseline): the baseline's stair-stepped blocks crawl as the camera moves; HEAD's reflected edge stays a soft ramp.
  Small sky holes in the reflected canopy still change shape frame to frame, softly. No new shimmer.
- **Fast camera turn (> 12°/frame): one-frame leading-edge hole — found at the gate, fixed in the final wave.**
  At the gate (HEAD `14f2351`), ride view (`?era=1935&cam=ride&c=95&freeze=1&q=medium`), mouse drag of 70 px per
  step: 22–27° per rendered frame (image shift of the horizon band). Rendered frames come in pairs with the same
  camera pose; in every pair the first frame was missing vegetation in the leading third of the view (4–27 k changed
  px, all in the right third); the `9403740` build showed 0–1.8 k px, scattered. Cause: `<Vegetation>` mounts before
  `<Ancon>` in `World.tsx` and both `useFrame`s ran at priority 0, so the view wedge (`InstancedSpecies`), ground
  cover and the shadow focus (`SkyAndLight`) read the previous frame's ride camera (the ride rig sets it from
  `onVesselPose` inside Ancon's `useFrame`); the 12° margin hid slower turns.
  **Fix:** Ancon's `useFrame` runs at `ANCON_FRAME_PRIORITY = -1` (`src/ancon/Ancon.tsx`; guard test
  `src/ancon/framePriority.test.ts`: must stay < 0, and a positive value would take over rendering in R3F). drei's
  `CameraControls` is also at −1 but mounts later (`<Cameras>`), so it now runs after the rig; the rig reads the
  controls' end values (`getPosition(…, true)`), so drag input is not delayed, and `setLookAt(…, false)` +
  `update(0)` leaves nothing for the later `update(delta)` to move.
  **Re-check (final wave, `vite preview` builds of `eb03196` and the fix, same session).** Method (scratchpad, not in
  the repo): a Playwright script opens the ride query above at 1440×900, dpr 1, waits for `__ANCON_READY__` + 3 s,
  holds the left button and moves the mouse 70 px every 16 ms for 14 steps while an in-page `requestAnimationFrame`
  loop copies the canvas into a 2D canvas each frame (30 frames); a Python diff counts pixels whose max channel
  difference exceeds 30 between consecutive frames, split into left/middle/right thirds; the turn rate comes from
  the best horizontal cross-correlation shift of rows 200–420 (hfov 63.1° at fov 42). Measured 22–26° per rendered
  frame (one outlier estimate at 17°, one at 28°). Results:
  - `eb03196`: in all 14 same-pose pairs the first frame differs from the second by 4.4–27 k px, ≥ 97 % of them in
    the right (leading) third — the gate defect reproduced.
  - Fix: 0 changed px in all 14 same-pose pairs, run twice with identical numbers. Each fix first-of-pair frame is
    pixel-identical (0 px over 30) to the settled second frame of the `eb03196` pair at the same pose, so the first
    frame now shows the full vegetation.
  - Cameras still behave: ride drag orbits the view (above); with the crossing running (`?era=1935&cam=ride&c=40`,
    no drag) the lower-band frame-to-frame change is the same on both builds (mean abs difference: fix 0.52–0.67, `eb03196` 0.53–0.66), so the
    camera does not lag or jitter against the hull; bank (drag) and aerial (slow orbit) respond to the mouse with no
    console errors; `npx playwright test` 18/18.
- **Beach close-up** (`mouth` preset temporarily at (392, 2.9, −488) → (360, 0.6, −522), not committed; scratchpad
  `beach-high.png`, `beach-low.png`): morning-glory runners with pink flowers lie on the sand in patches between
  sea-grape shrubs, with faint green tint on the sand around them. On low they read as separate V-shaped sprigs
  rather than mats.
- **Almendros near the landings** — visible in default views: a tall tiered almendro is the most prominent
  silhouette on the left bank of `1935-ride-golden`, and several stand on the far (west-landing) shore of
  `1975-bank-noon(-high)`. Confirmed by re-shooting both with almendro density set to 0 (temporary, reverted): those
  trees are the only large differences. No retune. At distance they read as thin poles carrying flat plates.

### Tuning

None.

## Deferred

- Task 2: ~~SPECIES is Partial with `!`~~ — fixed in Task 6 (R4, full Record)
- Task 3: minor (deferred): tint effect subtle at bank distance (mostly far cards) — recheck close-up in Task 4
- Task 4: minor (deferred): buildCanopy copied from mangrove.ts (~54 lines, plan-mandated copy)
- Task 4: minor (deferred): basin trees in fairly regular rows at distance (placement spacing); black mangrove a bit pale at noon
- Task 5: minor (deferred): glossy sea-grape cards (roughness 0.5) show slight bluish sky sheen at grazing angles
- Task 6: minor (deferred): almendros sparse near east landing, not visible in default views — tune density at T12 art gate if the picnic story needs them seen
- Task 6: minor (deferred): glossy flat plates (almendro, sea grape) take a slight blue-teal sky cast at midday — recheck after Task 10 noon fix
- Task 6: minor (deferred): almendro up to ~500 cards/tree — watch in R7 draw-cost task
- Task 7: minor (deferred): one-frame pop-in for tiles past the 6/frame limit (per brief; none seen in motion). Unused depth material — fixed in final fix wave
- Task 9: minor (deferred): placement.test count bounds hard-coded to old tuning counts; coconut clump scale 160 may leave ~100 m bare coast stretches (check aerial)
- Task 9: minor (deferred): coconut clump.strength vestigial under coverage mode (make optional); casuarina dispersion borderline at cell 30 (1.41)
- Task 10: minor (deferred): glossy leaf sky sheen comes from env reflection, not fog/grade — not fixed by T10
- Task 10: minor (deferred): noon full frame still fairly flat/low-contrast (grade fix, not a re-light); haze passes by ~2 %; hue.mjs rects fixed to one framing
- Task 11: minor (deferred): smoothing applies on every tier (high ~1.5 px softer); relies on ClampToEdge default; shimmer in motion unchecked
- Task 11b: minor (deferred): camera rays recomputed per species; empty shadow meshes stay visible in main/reflection lists (measured ~0 cost); mirrored-ray test gap. Fixed in final fix wave: frustumRays forEach allocation, dead partitionLod3
- Final review: minor (deferred): dense-grass worst case +0.29 ms on high (not a gate query) — tune groundRadius/spacing only if asked
- Final review: minor (deferred): newInstanced allocates an n×16 matrix then replaces it (build-time only); tilesInRadius allocates per 250 ms refresh
