# El Ancón de Loíza — 3D Historical Simulation · Design Spec

Date: 2026-09-26 · Status: approved (chat, 2026-09-26)
Research base: [`docs/research/ancon-research.md`](../../research/ancon-research.md) (source IDs `[S#]` below refer to it).

## 1. Goal

A cinematic, historically accurate, real-time 3D reconstruction of the Ancón de Loíza — the hand-powered river ferry across the Río Grande de Loíza between Torrecilla Baja (Piñones side) and Loíza Aldea, Puerto Rico. The visitor picks an era and watches the crossing, the landscape, and the infrastructure change, up to the 1985 PR-187 bridge ("Puente de la Restauración") and the end of service in 1986.

Quality bar: the reference three.js scene the user shared (golden atmospheric light, reflective water, dense detailed vegetation, strong third-person composition). Target: Webby-grade craft, runs in a browser from a link.

## 2. Non-goals

- Not a game (no scoring, no free-roam avatar controls beyond camera).
- No backend, accounts, or CMS. Static site.
- No photoreal human faces. People are stylised-real silhouettes at a distance.
- Post-1987 eras (Paseadora, Colectivo, Casa Museo) appear only as an epilogue card, not a full scene.

## 3. Eras

Each era is one entry in `src/data/eras.ts`. The scene is a pure function of the selected era plus time of day.

| id | Label | Vessel | Propulsion | Load on deck | Key scene changes |
|---|---|---|---|---|---|
| `1840` | 1820s–1890s · Colonial | small timber barge | poles + shore rope (Plée, Lombera) | walkers, ox cart, horse | fuller/wider river, thatched bohíos, church over low town, sand camino real |
| `1900` | 1900s–1910s · Sugar era | wooden barge | 2 poles | cane cart, workers | cane fields inland, young coconut groves, wooden houses on zocos |
| `1925` | 1920s · Cortijo begins | wooden plank platform | 2 mangrove poles (push + steer) | 1 cart or Model T, horse | Cortijo house (wood), almond trees, 10¢ |
| `1935` | 1930s–40s · The ropes | wooden 1-car platform | two taut marine ropes, 2–3 haulers | 1–2 cars | first cars, zinc roofs, Casuarinas thickening |
| `1959` | 1950s · Públicos | enlarged wooden platform | ropes | 2–4 cars incl. público | PR-187 numbered, lower flow (Carraízo dam 1953–54), kiosks start |
| `1975` | 1960s–70s · Weekend outings | large platform | ropes | ~6 cars, TV van | concrete Cortijo house, Bar Restaurante El Ancón terrace, weekend crowds |
| `1984` | 1980–86 · Steel barge | steel-plate barge ~20 × 7.5 m | hand-hauled rope/wire | 6–8 cars, bicycles | bridge under construction next door, house demolished |
| `1986` | 1986 · The bridge | barge moored, idle | — | — | bridge open with traffic; quiet station; epilogue card |

Every field in an era carries `sources: string[]` (IDs from the research doc) and a `confidence: 'H'|'M'|'L'` flag. Inferred values are marked `inferred: true` and shown as such in the UI.

## 4. World

- **Frame:** local tangent plane centred on the crossing midpoint (≈18.43485, -65.8823). 1 unit = 1 m. +X east, +Z south, +Y up.
- **Extent:** ~2.5 × 2.5 km detailed zone (landings, town edge, river to mouth, sandbar, beach), plus low-detail far ring and horizon (Atlantic to N, Sierra de Luquillo / El Yunque silhouette to SE).
- **Shoreline:** baked from OpenStreetMap (Overpass) into `src/data/geo/*.json` via a one-off script in `scripts/`. Era variants adjust river width (pre-1953 wider/fuller) and the sandbar.
- **Terrain:** heightfield generated from the shoreline mask: 0–3 m coastal plain, dunes along the beach, riverbanks with mud/sand gradient, shallow river bathymetry (1.5–3 m). Optional later upgrade to USGS 3DEP lidar if it improves the look.
- **Landmarks:** San Patricio church (1645/1729, fortified-style, belfry), town plaza edge, Calle Carlos Escobar, Cortijo house/station, west landing on "Antigua PR-187", bridge line.

## 5. Rendering

- **Stack:** Vite + React + TypeScript + React Three Fiber + drei + `postprocessing` (via `@react-three/postprocessing`), zustand for state.
- **Water:** custom shader — planar reflections (river), flow-mapped normals following the river direction, depth-based colour (tannin-brown shallows → green-grey), shoreline foam, wake behind the ancón, rain/ripple rings optional.
- **Sky & light:** physically-based sky (Preetham/Hosek), sun position computed from lat/lon + date/time (research §1.3), ACES/AgX tone mapping, height fog + aerial perspective for the golden-haze look, soft shadows (CSM).
- **Post:** SMAA, N8AO (ambient occlusion), bloom (restrained), subtle vignette + film grain, optional DOF in cinematic camera.
- **Vegetation:** instanced + wind-animated. Red mangrove (prop roots) at water edge, black/white mangrove behind, buttonwood, coconut palms, Casuarina, almendro, sea grape, beach morning glory, grasses. Densities per era.
- **Models:** built procedurally in code (no heavy downloaded meshes). Textures: CC0 only (Poly Haven / ambientCG), downloaded with user approval, stored in `public/textures`, KTX2-compressed.
- **Performance targets:** 60 fps on Apple-silicon laptop at 1440p; ≥30 fps on a recent phone with a "low" quality tier (fewer instances, no AO, lower shadow res). Auto-detect tier, manual override.

## 6. Simulation

- The ancón loops a crossing (~3–4 min real time, time-scalable): load → cast off → cross → dock → unload.
- Poles: pole-men walk the deck and push (1840–1925). Ropes: haulers pull hand over hand along two taut lines (1935–1984); ropes sag when idle.
- Current pushes the vessel slightly downstream; poles/ropes correct it.
- Ambient life: pelicans diving, egrets on mangrove roots, frigatebirds soaring, land crabs (jueyes) on banks, mullet jumps, occasional manatee surfacing. Density per era.
- Vehicles and people board/unboard by era.

## 7. UI

- **Era timeline:** horizontal decade rail (bottom), keyboard ← →, crossfade transition between eras (fade to haze, rebuild, fade in).
- **Info panel:** era title, 3–5 facts, each with its source link and confidence badge; inferred items visibly labelled.
- **Camera modes:** Ride (on deck, third-person like the reference), Bank (fixed from Loíza landing), Orbit (free), Cinematic (auto-tour).
- **Time of day** slider (dawn / noon / golden hour).
- **Sound:** ambient river, birds, rope creak, distant plena on Sundays in 1975/1984 (CC0 or self-made), muted by default, toggle.
- Accessibility: keyboard operable, reduced-motion mode, readable contrast, text alternative (the info panels work without WebGL).

## 8. Architecture

```
src/
  data/eras.ts            era configs (typed, sourced)
  data/sources.ts         source list mirrored from research doc
  data/geo/               baked shoreline/landmark JSON
  geo/                    lat/lon → local metres, sun position
  state/store.ts          zustand: era, timeOfDay, cameraMode, quality
  scene/                  Canvas root, Terrain, Water, Sky, Lighting, Post
  scene/vegetation/       instanced species + wind
  scene/ancon/            vessel variants, poles, ropes, crew, crossing loop
  scene/infrastructure/   landings, houses, church, roads, vehicles, bridge
  scene/fauna/            birds, crabs, fish, manatee
  ui/                     Timeline, InfoPanel, CameraModes, Controls
scripts/                  OSM fetch + bake
tests/                    vitest (geo, eras), playwright (per-era screenshots)
```

Units stay small and single-purpose. Scene components read the era config; they never hardcode era logic.

## 9. Testing

- **Unit (vitest):** projection maths, sun position vs. research table, era schema validation (every field has sources/confidence), crossing-loop state machine.
- **Visual (Playwright):** one screenshot per era per camera mode, checked into `tests/snapshots`; reviewed by eye at each phase gate.
- **Perf:** fps/frame-time overlay in dev (`?debug`), recorded at each phase gate.

## 10. Delivery

- Repo: `github.com/gabriel-rene/ancon-de-loiza` (public).
- CI: GitHub Actions → build + test → deploy to GitHub Pages on push to `main`.
- Phases (each ends with commit, push, and a user check):
  0. Repo, research, spec, plan
  1. Terrain, river, sandbar, ocean, sky, light, water, post — reach the quality bar
  2. Vegetation + wind
  3. The ancón per era + crossing loop + crew
  4. Infrastructure per era (landings, houses, church, roads, vehicles, bridge)
  5. Fauna
  6. Timeline UI, transitions, sourced facts, sound, camera modes
  7. Performance, mobile, a11y, polish, launch

## 11. Risks

- **Quality bar vs. procedural assets.** Mitigation: invest in shaders/lighting first (Phase 1 gate), use CC0 PBR textures.
- **Sparse historical detail** (exact hull sizes, bridge span). Mitigation: marked as inferred; easy to update in `eras.ts`.
- **Mobile perf** with dense vegetation. Mitigation: quality tiers from day one.

## 12. Phase 2 detail — Vegetation (approved in chat 2026-09-26)

- **Art source:** every plant is generated in code (geometry + canvas-painted leaf textures). No downloaded models.
- **Species:** red mangrove (prop roots, river/lagoon edge and shallows), black/white mangrove + buttonwood (behind), coconut palm, Casuarina ("piñones"), almendro, sea grape, beach morning glory, grasses/reeds; sugar cane fields in 1840/1900.
- **Placement:** deterministic, from world fields (water class, shore/sea/river distance, height, OSM land class) with exclusions for roads and the Loíza town core (reserved for Phase 4). Per-era density multipliers live in `eras.ts` as sourced/inferred values.
- **Rendering:** per species, instanced full-geometry LOD0 near the camera and baked-impostor cross cards beyond; the reflection pass sees cards only (cheap reflections). All foliage sways in the ENE trade wind (shared wind uniforms, matching depth material for shadows).
- **Shadows:** one directional shadow map that follows the camera focus with texel snapping (replaces the fixed ±350 m frustum; supersedes the CSM note in §5).
- **Split:** 2a = Phase-1 carry-over fixes + vegetation core + red mangrove, coconut palm, Casuarina. 2b = remaining species, era-specific landscapes (cane, young groves), polish.
