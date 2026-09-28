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
