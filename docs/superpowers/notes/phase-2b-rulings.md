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
