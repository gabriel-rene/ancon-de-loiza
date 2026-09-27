# Phase 2b — Remaining species, ground cover, polish (approved in chat 2026-09-27)

Parent spec: [`2026-09-26-ancon-loiza-design.md`](2026-09-26-ancon-loiza-design.md) (§4 vegetation, §12 Phase 2 detail). Research base: [`docs/research/ancon-research.md`](../../research/ancon-research.md) §5; source IDs `[S#]` refer to it and to `src/data/sources.ts`. Carry-over: [`docs/superpowers/notes/phase-2a-rulings.md`](../notes/phase-2a-rulings.md).

## 1. Scope and split

The old 2b ("remaining species, era landscapes, polish") is split in two (ruling in chat 2026-09-27):

- **2b (this spec):** the remaining species (trees, shrubs and ground cover) and four polish fixes.
- **2c (later):** sugar cane fields, young coconut groves, era-specific landscapes.

Branch: `phase-2b-vegetation`. Merge to `main` only after the user approves.

Not in 2b: cane, young groves, era landscape changes beyond per-species density, GPU grass blades, adaptive quality (Phase 7), era-switch placement cost (Phase 6).

## 2. Species

| Id | Species | Kind | Habitat rule (summary) | Era density |
|---|---|---|---|---|
| `blackMangrove` | *Avicennia germinans* | tree, 4–8 m, grey-green canopy, pneumatophores (pencil roots) near the trunk | wet land behind the red-mangrove band; wetland land class; low height | all eras, 1 [S22][S34] H |
| `whiteMangrove` | *Laguncularia racemosa* | tree, 4–7 m, lighter yellow-green | mixed with black mangrove, biased toward the fringe side | all eras, 1 [S22][S34] H |
| `buttonwood` | *Conocarpus erectus* | shrub/small tree, 2–5 m, silvery-green | drier ground behind the mangroves, away from the water | all eras, 1 [S22] H |
| `almendro` | *Terminalia catappa* | tree, 6–12 m, tiered horizontal branches, large leaves, some red leaves | river banks near the landings, town | low in 1840/1900 (inferred, L); full from 1925 [S1] |
| `seaGrape` | *Coccoloba uvifera* | shrub, 1–3 m, round leaves | beach edge and dunes, seaward of the casuarinas | all eras, 1 [S22] H |
| `morningGlory` | *Ipomoea pes-caprae* | ground cover, trailing vines | open sand at the beach | all eras, 1 [S22] H |
| `grass` | coastal grasses | ground cover, clumps | open land, not in wetland, not on road | all eras, 1 (inferred, M) |
| `reeds` | wet-edge reeds / sedges | ground cover, tall clumps | wet river edges and wetland | all eras, 1 (inferred, M) |

- `SpeciesId` and `EraSpec.vegetation` grow to include every id. Every era value is `Sourced`, with `inferred` set where the value is a guess.
- Exact density numbers and habitat thresholds are set in the plan and tuned on screen; each keeps its source.
- **Placement order:** casuarina, almendro, coconut, blackMangrove, whiteMangrove, redMangrove, buttonwood, seaGrape. Big plants claim space first. Ground cover is placed after, and it ignores tree occupancy except for trunks (clumps may sit under canopies).
- The ferry-landing clearings (`LANDING_CLEARING`) apply to every species, ground cover included.

## 3. Rendering

### 3.1 Trees and shrubs
The five new woody species use the 2a path unchanged: code-generated geometry with `bark` + `foliage` parts, per-instance variants, LOD0 meshes near the camera, baked impostor cards beyond `lod0`, the shared wind material, and per-species rotation and clump noise. Each species has a triangle budget checked by a test (the same pattern as the 2a species).

### 3.2 Ground cover (new)
- A clump is a few crossed alpha cards with a small generated texture (grass blades, reed stems, vine and leaf).
- Clumps draw only within a per-tier radius (`veg.groundRadius`: high 60 m, medium 45 m, low 25 m) and fade out over the last 20% by dithered alpha, so there is no hard edge.
- Clumps cast no shadows and do not appear in the water reflection.
- Clumps use the shared wind uniforms.
- Placement uses the fixed 512 near grid, like the other species. Density scales with `veg.density`.

### 3.3 Far ground tint (new)
The terrain material gets a ground-cover tint so the land beyond `groundRadius` is not bare: grass green on open land, sand with green patches at the beach. The tint comes from the same habitat rules as the clumps, so the near clumps and the far color agree.

## 4. Polish

1. **Mangrove wall.** The new black and white mangroves add two more greens and heights behind the red fringe. The red mangrove also gets per-instance colour variation.
2. **Palm skyline.** Coconut placement gets stronger clumping and gaps, so palms stand in uneven groups, not in even rows.
3. **Noon colour.** The noon grade looks teal. Retune the grade and the atmosphere so noon reads warm and natural; dawn and dusk must not get worse. Check with before/after screenshots.
4. **Blocky reflection.** On medium, the reflected plant edge is blocky. Fix it so the fringe reads smooth, without a frame-rate loss (for example, raise `reflScale` only for the fringe band, or filter the reflection).

Latent items from the 2a rulings that the new code touches are fixed on the way (for example the impostor bake dispose order).

## 5. Performance

- The frame rate must not drop below the 2a numbers on any tier (desktop high; phone-size low).
- Low tier: fewer clumps and a short `groundRadius`.
- Measure before and after with the existing performance scripts. Record the numbers in the rulings note.

## 6. Testing

- **Unit tests** per species: density is 0 where the plant must not grow (open sea, road, landing clearing, the wrong land class), and above 0 in its habitat; geometry stays within its triangle budget; era values are `Sourced`.
- **Screenshots** from the fixed camera spots: dawn, noon, dusk, for 1840, 1935 and 1984, before and after. The phase-1 snapshots stay frozen.
- **Fact check:** a review agent checks each species' habitat and era claims against the cited sources. The user sees only flagged items.
- **Code review** at the end, as in earlier phases.

## 7. Done when
- All eight species are on screen in the right places, and the landings are clear.
- The four polish items are fixed and shown in before/after screenshots.
- Frame rate is at or above 2a on every tier.
- All tests pass, and the review has no open Important items.
