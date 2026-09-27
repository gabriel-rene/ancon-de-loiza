# Phase 3 — rulings and carry-over

Decisions made while building Phase 3 (the ancón, crossing loop, crew, wake, ride camera, decade picker), and items left for later. Copied from the build ledger.

## Rulings
- preflight F1–F13, F16–F20, F22–F26 → plan revised by plan author (geometry on fixed 512 placement fields; clearings re-centred on computed dock points; zero matrices; steel palette; wake 0 when docked; no per-frame allocs; shared fixtures) — cost: one plan revision
- F14 accepted (1935=1, 1959=4, 1975=6 cars; research 1950s 2–4), F15 accepted (?c crossing clock, ?t stays time of day), F21 accepted — cost: none
- models — T1, T2, T10 sonnet (full code in plan); T3–T9 art/rig/shader tasks opus; T11 gate opus; reviewers sonnet, T8/T11 reviews opus — cost: tokens
- palette brief correction approved — detail-map fill ~#f4f1ec, WOOD base 0x9a8f7e, bleach 0xb9b5ac, dark 0x5f5549, strake 0x7d7263 (tune by eye) — spec asks sun-bleached weathered timber — cost: tests on palette values updated
- figure budget moves to hi/lo tiers — FIGURE_TRI_BUDGET_HI 2500 (crew + near passengers), lo ≈ current 720; brief interfaces (PARTS, PER_KIND, GeoKind) may change accordingly, tests updated — spec §13 perf ≤1.5 ms still binds — cost: +~4 draw calls per batch
- T7 uses ONE FigureBatch ('hi', max ≈ 12) and FigureBatch.commit hides meshes with no live instance — cost is draw calls (21 meshes × 3 passes ≈ 0.75 ms), two batches would hit the §13 1.5 ms limit — cost: none
- ride orbit fix = water-surface floor (min height above water, ~1.5 m) + ride-only polar limits + damped return to canonical framing ~1 s after release; clamp applied to a render-only scratch (non-accumulating) — cost: none
- cap q=high DPR at 1.75 — ride sits at the 60 fps floor at DPR 2 and the world alone is 62–65; 2a ruling named this as the first fallback — cost: slightly softer image on retina
- 1984 María Luisa hauls alone (crew 1, sourced to the dossier's §2.4/§9 H, not inferred) — follows the high-confidence source for a named person on a public site — cost: slower-looking crossing, test allows 1 for 1984

## Deferred items
- Task 1: minor (→ final): placement.test.ts still builds a local 256 grid (brief kept it)
- Task 3: minor (→ gate/final): distant seam aliasing (no MSAA); barge sides honey-brown in raking light; rotated-box UVs pre-transform; nails removed from shared tile
- Task 4: minor (→ final): plate() duplicates box() — add BoxOpts.grain override; hard rust-blot edges <5 m; charcoal deck at low sun
- Task 5: minor (→ gate): rope shimmer only checked on stills; CSM rope material first use under src/ancon
- Task 6: minor (→ T11 gate): tail hem sawtooth at 4 m; white cloth narrow tonal range (strengthen AO not palette); DoubleSide doubles fabric noise cost
- Task 7: minor (→ T11/final): pole ends ~12 m/s at stroke switch (whip); 1925/1935 body gap 0.34 m; steering pole tip on bank (Phase 4); hauler IK blend added
- Task 8: minor (→ final): single-source wake constants (leaf module + GLSL interpolation); segment caps at bends; double pose eval; ripple under hull; rope reads orange from above (albedo/width comp)
- Task 9: minor (→ final): disable truck while riding (pan discarded); carryCamera unused dead code; extreme drag ~40 m top-down (tighten RIDE_ORBIT)
- Task 10: minor (→ final): fields cache cap 6 can thrash when debug quality switches; preventDefault at range ends

## Open follow-ups
- GPU resources leak on a live quality switch (debug panel / quality change without reload); era switches are leak-free and probed in e2e.
- Terrain art: flat bank polygons at the landings (Phase 4).
- Steering-pole tip rests on the landing bank while docked (Phase 4).
- Figure 'lo' tier reserved for distant crowds (Phase 4).
