# Phase 2c — Cane fields, coconut farm blocks, palm age (approved in chat 2026-09-28)

Parent spec: [`2026-09-26-ancon-loiza-design.md`](2026-09-26-ancon-loiza-design.md) (§4 vegetation, §12 Phase 2 detail). Previous phase: [`2026-09-27-phase-2b-vegetation-design.md`](2026-09-27-phase-2b-vegetation-design.md). Research base: [`docs/research/ancon-research.md`](../../research/ancon-research.md) §2.4 and §5; source IDs `[S#]` refer to it and to `src/data/sources.ts`.

## 1. Scope

2c is the second half of the old 2b: era landscapes, **plants only** (ruling in chat 2026-09-28).

- Sugar cane fields in the sugar eras.
- Coconut farm blocks (planted rows) from 1900 on.
- Palm age: palms are young in 1900, half grown in 1925, full grown from 1935.
- Pasture: when the cane goes, the land is the open grass we already draw.

Branch: `phase-2c-landscapes`. Merge to `main` only after the user approves.

Not in 2c: houses, roads, cart tracks, ground colour changes per era (all Phase 4); close-up cane detail; river changes (already done by `bankOffset`).

## 2. What each era shows

All values are inferred (no source gives field sizes or grove dates). Each one is `Sourced` in `eras.ts` with `inferred: true`.

| Era | `cane` (share of grassland fields shown) | `plantation` (palm survival in farm blocks; 0 = no blocks) | `palmAge` (0 young … 1 full) |
|---|---|---|---|
| `1840` | 0.6 [S1] L | 0 [S23] L | 1 (wild palms only) L |
| `1900` | 1.0 [S1] M | 1.0 [S23] L | 0 (young, 3–6 m) L |
| `1925` | 0.3 [S1] L | 1.0 [S23] L | 0.5 L |
| `1935`, `1959` | 0 [S1][S23] L | 1.0 [S23] L | 1 L |
| `1975`, `1984`, `1986` | 0 [S1][S23] L | 0.85 [S23] L | 1 L |

Sources: cane on the Iturregui estates and the cane-worker traffic ([S1], research §2.4 and §5, "late 1800s – early 1900s"); the shift from sugar to coconut ([S23]).

- **Cane place:** the OSM `grassland` polygon — open, inland, on the west (Torrecilla / Carolina) side, about 0.6–3 km from the river. The Iturregui cane land reached Carolina [S1].
- **Farm-block place:** the flat sand behind the beach: 60–400 m from the sea, height < 3 m, not wetland, at least 40 m from the river, clear of roads, the town core and the landing clearings. 3–6 blocks, each about 80 × 120 m, turned to follow the coast.
- **Wild palms** keep their clumps (2b coverage mode). Only their age changes per era.

## 3. Units

| Unit | Job |
|---|---|
| `src/data/eras.ts` | New `landscape: { cane, plantation, palmAge }`, each `Sourced<number>`. |
| `src/vegetation/landscape/caneFields.ts` | Pure. Cuts the grassland into fields of 150–300 m (jittered grid, clipped to the grassland) with 6–10 m cart lanes. Each field gets a fixed random rank. An era shows the fields whose rank < `cane`, so era sets nest (1925 ⊂ 1840 ⊂ 1900) and fields never move between eras. |
| `src/vegetation/landscape/caneMesh.ts` | One merged mesh for all shown fields: a top surface 2.5–3.5 m above the ground that follows the terrain, a ragged top edge, and textured sides. The cane texture is painted in code (canvas, as the leaf textures). The mesh sways with the existing wind material. |
| `src/vegetation/landscape/plantation.ts` | Pure. Finds the farm blocks by the §2 rules, fills them with palms in rows 8 m apart (small jitter), and removes palms by `plantation` survival (deterministic). |
| `src/vegetation/species/palm.ts` | `buildPalm(seed, age)`. A young palm has a short trunk or none and full-size fronds near the ground; it is not a scaled-down old palm. Three cached ages: 0, 0.5, 1. Impostor cards are baked per age. |
| `Vegetation.tsx` / placement | Farm palms are placed first; they claim occupancy and join the coconut set, so they use the coconut LOD, cards and shadows. Wild coconut is excluded inside blocks. |
| Ground cover | Grass (near clumps and far tint) is off inside shown cane fields. |

## 4. Performance

- Cane: 1 draw call plus its shadow; ≤ 60 000 triangles for all fields.
- Farm blocks: ≤ ~1 500 extra palms, drawn through the existing coconut pipeline.
- Frame time on `high` must not rise more than 0.5 ms; no tier may drop below the 2b numbers. Measure before and after with the existing performance scripts and record the numbers in `docs/superpowers/notes/phase-2c-rulings.md`.

## 5. Testing

- **Unit (vitest):**
  - Cane layout is deterministic; era field sets nest; every field lies inside the grassland; lanes stay open.
  - Farm blocks satisfy the §2 rules; row spacing is 8 m; survival removes the right share.
  - Palm age changes trunk height; young palms stay under 6 m; each age stays within the palm triangle budget.
  - The era schema test covers `landscape` (every value has sources and a confidence flag).
  - Cane mesh stays within its triangle budget.
- **Screenshots (Playwright):** 1900 aerial and ride, 1840 aerial, 1925 bank, 1975 aerial. Art gate against the quality-bar image, as in 2b.
- **Fact check:** a review agent checks the §2 claims against [S1] and [S23]. The user sees only flagged items.
- **Code review** at the end, as in earlier phases.

## 6. Done when

- Cane fields show in 1840, 1900 and 1925 at the §2 shares, and are gone from 1935.
- Farm blocks show from 1900, with young palms in 1900 and half-grown palms in 1925.
- The performance limits in §4 hold.
- All tests pass, and the review has no open Important items.
