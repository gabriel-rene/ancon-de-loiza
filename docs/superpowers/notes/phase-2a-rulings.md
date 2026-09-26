# Phase 2a — rulings and carry-over

Decisions made while building Phase 2a (vegetation), and items left for later phases. Copied from the build ledger.

## Rulings
- T3 final shadow-glow check deferred to T10 gate — trees don't exist yet — cost: none
- T7–T9 are art tasks → implementers on the most capable model; T1/T2/T5 on sonnet; reviewers sonnet — cost: tokens
- T5 mangrove rule widened (depth<1.8, shore>-15, band 9–20 m) — plan thresholds were narrower than a grid cell; measured max 15 m into water — cost if wrong: slightly wider fringe
- T5 review Important (placement counts vary ~13% with nearSize) → resolved structurally in T10: placement always runs on a fixed 512 near grid regardless of quality tier (quality only scales density) — cost: one extra fields build on low tier
- card normals lean toward viewer (deviation) accepted — spec normals lay in card plane — cost: view-dependent card shading
- T7 review 'Important' items (sRGB-space mip averaging; alpha-rescale search range [0.5,4] without guard) are latent, not defects in the shipped texture — carried into T8 dispatch (T8 reuses foliageTexture): average in linear space + warn when search hits bounds — cost: slight mip darkening until fixed
- T9 registry shape = plan interface + optional vertexColors/alphaTest/textureName per part; material values copied from the visually tuned testTree.ts (mangrove foliage roughness 0.62, not plan's 0.45) — tuned values were checked on screen in T8 — cost: none, one number
- T10 carry-over file task-10-carryover.md is binding (fixed 512 grid, shared occupancy, anti-plantation jitter, per-species rotation, perf order, all routed minors) — cost: larger task
- T10 implementer does not push; controller pushes after final review — push to public repo waits for gate — cost: none
- 1840 casuarina density → 0, 1900 → 0.05 inferred:true conf L — dossier: introduced, mass planting early–mid 20th c.; plan value lacked a pre-1918 source — cost: fewer trees in 1840/1900 skyline
- phase1 snapshots kept as frozen baseline, documented in tests/snapshots/README.md — history for the Phase 1 look — cost: 3.4 MB
- era-switch placement cost → Phase 6 (timeline UI); adaptive quality → Phase 7 — cost: none now

## Deferred items
- Task 4: minor (deferred): single combined commit (fix + debug view); debug branch skips tonemapping (intended raw readout)
- Task 5: minor (deferred): in-water acceptance flat 0.85; wetland term inert on this map (polygons outside extent)
- Task 6: minor (deferred → T10): before-hooks outside try (Water.tsx:103); CARD_AO=0.3 single-frame tuning → uniform + recheck dusk/night; impostor re-bake on instance change (split effects); addUpdateRange/partition tuple allocs at 4 Hz; far cards cast shadows beyond shadow extent; temp imports in World.tsx unmarked; no normal correction after sway; fringe clear colour
- Task 7: minor (deferred → T10): palm lean baked in local -Z vs random instance rotation; 3.4k tris within 220 m budget check
- Task 8: minor (deferred → T10): low tier shows near plants only in main view (far cards off) — pre-existing tier behaviour
- Task 9: minor (deferred → T10): casuarina tube dup of mangrove tube; lean test couples to bark merge layout; rot narrowing only in temp hook
- Task 10: minor (→ final review / 2b): bake-effect dispose before mesh swap (latent use-after-dispose); far ring counts depend on tier far grid; 40 m double-density overlap band; cards never cast → shadow gap LOD0..shadow reach (high 220–266, medium 150–209); vegTiming accumulates in prod; perf margin thin (belt 66 fps ±5); reflection of fringe blocky at medium reflScale; mangrove wall uniform dark; palms evenly spaced on skyline; noon teal grade
- Final review: With fixes — Important: S19→S19b citation + inferred for 1959–86 casuarina. Minors: 1840/1900 casuarina vs dossier; spec §12 stale; era switch sync placement (→ Phase 6); stale phase1 snapshots; .superpowers not in .gitignore; weak desktops default high (→ Phase 7); latent bake use-after-dispose

## Later phases
- Noon colour grade is teal across the scene (2b / Phase 6).
- Era switch runs placement on the main thread, 200–400 ms (Phase 6: cache or worker).
- Desktops with weak GPUs default to high quality (Phase 7: adaptive quality).
- Fringe reflection is blocky at medium reflScale; mangrove wall is one flat dark band; palms are evenly spaced on the skyline (2b polish).
