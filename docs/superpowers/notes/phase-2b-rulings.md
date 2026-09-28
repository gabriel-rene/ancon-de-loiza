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
  look), and white mangrove shares its rule shape, so the same clumping fix (Clark–Evans test +
  stronger clumping + second noise octave) applies to both, not just coconut.

**Method.** Clark–Evans R = mean nearest-neighbour distance ÷ 0.5/√density (R ≈ 1 random, < 1
clustered, > 1 evenly spaced/planted-looking). Computed on a fixed 650 m square centred on each
species' own instance centroid (`centroidWindow` in `placement.test.ts`), not the whole 2560 m
map: over the whole map, R is dominated by the shape of the coastal habitat band itself (a
species confined to a thin strip already reads as "clustered" relative to its own huge bounding
box, R ≈ 0.3–0.45 for all three species, before or after this task's fix) and never exceeds 0.8,
so it can't detect the local grid/orchard look the brief and R8 are about. A 650 m window is large
enough to span several clumps (so real gaps reduce R, not just a bounding-box artefact) and small
enough for the O(n²) loop to stay fast even for blackMangrove's ~5.5k instances (< 50 ms measured).

**Before/after R (650 m centroid window) and counts**, `placeAll` fixture
(`{ redMangrove: 1, coconut: 1, casuarina: 1, blackMangrove: 1, whiteMangrove: 1 }`, seed 7):

| species | before R | after R | before count | after count | Δcount |
|---|---|---|---|---|---|
| coconut | 0.804 (fails <0.8) | 0.774 (passes) | 3605 | 3399 | −5.7% |
| blackMangrove | 0.619 (already passes) | 0.611 (passes, more margin) | 5580 | 5561 | −0.3% |
| whiteMangrove | 0.457 (already passes) | 0.450 (passes, more margin) | 1898 | 1887 | −0.6% |

Coconut is the only one of the three where this metric was genuinely red before the fix (RED
confirmed by reverting `rules.ts`/`placement.ts` and rerunning: `expected 0.8035... to be less
than 0.8`). Black and white mangrove were already under 0.8 on this metric before this task —
their habitat band is narrower/more river-hugging than coconut's coastal strip, so a 650 m window
around their centroid already mixes fringe and gap segments. R8's "orchard" complaint is a
close-up visual read (see baseline notes on `1975-bank-noon.png`/`1935-ride-golden.png`), which a
single aggregate R over one fixed window doesn't fully capture either way; the fix was applied
anyway per R8, verified to hold the metric's margin (R still drops, doesn't rise) and checked on
screen (below).

**Tuning** (`src/vegetation/rules.ts`, `clump: { scale, strength, size, octave }`):
- coconut: `{ scale: 45, strength: 0.8, size: 0 }` → `{ scale: 160, strength: 1, size: 0.08,
  octave: 1 }`. Deviates from the brief's example value (`scale: 70`): at scale 70 (with
  strength 1, size 0.08, octave 1) the 650 m window R was 0.808–0.852 depending on window size,
  still failing — a parameter sweep (45/70/100/130/160/200/240 in the full `placeAll` pipeline)
  showed R bottoms out around scale 160–200 and stays flat past that, so 160 was chosen as the
  smallest scale that clears 0.8 with margin, keeping the brief's strength/size/octave values.
- blackMangrove: `{ scale: 40, strength: 0.5, size: 0.2 }` → `{ scale: 55, strength: 1, size: 0.2,
  octave: 1 }`.
- whiteMangrove: `{ scale: 30, strength: 0.55, size: 0.2 }` → `{ scale: 40, strength: 0.9, size:
  0.2, octave: 1 }`.
- New `clump.octave?: number` field on `SpeciesRule` (`rules.ts`) and its application in
  `placement.ts`: `cn = cn * (0.6 + 0.8 * valueNoise(x, z, cs / 3, noiseSeed + 17))`, clamped to
  [0, 1], applied to the same `cn` used for both acceptance and instance-scale modulation.
- All three species' `rules.test.ts` habitat assertions stay green; counts stay within the ±25%
  band (see table above, all within 6%).

**Visual check** (`npm run dev`, `scripts/dev/shot.mjs`, `q=medium`):
- `?era=1986&cam=mouth&t=7.2&c=0&freeze=1&q=medium` (not `t=6.4`, which is pre-dawn black): both
  banks' palm lines break into distinct clusters with sky/water gaps between them, not a single
  continuous fringe.
- `?era=1975&cam=aerial&t=12&c=95&freeze=1&q=medium` vs `tests/snapshots/phase2b-before/
  1975-aerial-noon.png`: the near-shore palm field reads as irregular clumps with gaps in both;
  the baseline's "evenly spaced planted-grid" note describes an earlier, less-tuned state than
  what's on disk now (coconut clumping was already strengthened in a prior task, hence R already
  under 0.8 at 800 m+ windows before this task) — this task tightens it further at the medium
  (650 m) scale the R8 complaint was actually about.
