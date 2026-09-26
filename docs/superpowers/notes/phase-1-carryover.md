# Phase 1 carry-over: rulings and parked items

Decisions made while building Phase 1 (branch phase-1-world), and items parked for later phases. Source: the SDD ledger.

## Must address at the start of Phase 2
- Camera-following / cascaded shadows (current: one fixed ±350 m frustum at the origin).
- Grass-glow emissive in terrainMaterial.ts ignores shadows — mask or remove when trees cast shadows.
- Reflector re-renders the whole scene — add a no-reflect layer / low-LOD reflection before instanced vegetation.
- Move RIVER_DIR from Water.tsx to shared geo/era data (ferry drift + wake need it).
- Vegetation placement must mask by the water class (info weights ignore water under land polygons).
- Lazy-load leva + stats-gl (1.9 MB main chunk).
- Unexplained brown patch mid-river in the aerial view — check with a waterInfo debug view.

## Phase 6
- Era switch keeps absolute clock time; keep time relative to sunset (goldenHourAST).
- Cache fields per bankOffset (only two values) or build in a worker for smooth era transitions.

## Ledger (verbatim)

- Ruling: T1 pushes branch only; Pages deploy verification moves to phase end after merge to main — work happens on a branch per skill rules — cost if wrong: deploy issue found later.
- Ruling: T1 may run `gh api ... pages -f build_type=workflow` — spec §10 approved GitHub Pages delivery — cost if wrong: user can disable Pages.
- Ruling: if `node scripts/bake-osm.ts` fails on type stripping, use `node --experimental-strip-types` in the npm script — cost: none.
- Ruling: T4 loiza.test bridge threshold 200→300 m — test measures nearest bridge VERTEX; the PR-187 bridge way's vertices are its deck ends (~253 m), the deck line itself passes closer — cost if wrong: none, test still guards bridge presence near crossing
- Ruling: T4 review Important (relations ignored) conflicts with plan text (plan skipped relations) — fix: emit closed outer members of natural multipolygons, no stitching — cost if wrong: small extra land rings
- Task 4: minor (deferred): bridge detection only bridge=yes; dead ring computation for roads
- Task 5: minor (deferred): info weights ignore water mask where land polygons overlap water; Uint8 truncation
- Task 2: minor (deferred): commit 3f7b551 trailer is on the subject line (no blank line) — cosmetic; branch history not rewritten
- Task 6: minor (deferred): holeHalf uses size vs span size-1; no component tests
- Task 7: minor (deferred): envKey concatenation without delimiter; Backdrop geometries/materials not disposed on unmount; default camera does not show sky/Luquillo (Task 10 presets fix framing)
- Task 8: minor (deferred): Reflector PlaneGeometry not disposed on recreation; specular aliasing speckle at distance; sky overexposed / ripple scale too large near camera (Task 11 tuning)
- Ruling: default/demo times must be relative to each era's sunset (July sunset 19:01 AST) — 17.4–17.6 is not golden hour in summer; handle in Task 11 tuning — cost if wrong: minor retune
- Task 9: minor (deferred): Bloom luminanceThreshold 3 is a coarse fix for unbounded Sky radiance; look still grey not golden (Task 11)
- Task 10: minor (deferred): ReadySignal flag not reset on canvas remount; bank preset raised to 3.6 m
- Ruling: Task 11 runs on the most capable model (art-direction judgement) and may also fix deferred minors Reflector geometry dispose + Backdrop dispose — cost if wrong: slightly wider diff
- Ruling: Task 11 Step 4 pushes branch only; merge to main (public deploy) waits for user OK — cost: none
- Ruling: T11 AgX→ACES deviation kept — spec §5 says 'ACES/AgX tone mapping'; controller approved the look — cost if wrong: midday may run warm, easy to swap
- Task 11: minor (deferred): octave() comment overstates chain rule; Sky uniforms mutated in render body; high tier borderline 58.6 fps at DPR2; unexplained brown patch mid-river in aerial
- Ruling: parked for Phase 2 plan — cascaded/camera-following shadows, grass-glow shadow mask, no-reflect layer for Reflector, shared RIVER_DIR, bundle lazy-load of leva/stats — reviewer says not merge blockers — cost if wrong: Phase 2 starts with these as prerequisites
- Ruling: parked for Phase 6 — era switch keeps time relative to sunset; fields cache per bankOffset/worker — cost if wrong: janky era switch until then
- Ruling: parked — e2e overwrites tracked PNGs (keep as phase-gate evidence); multipolygon inner rings ignored — cost: dirty tree after e2e; clearings filled
