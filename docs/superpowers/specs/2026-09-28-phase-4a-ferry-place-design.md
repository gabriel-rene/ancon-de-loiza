# Phase 4a — The ferry's place: roads, landings, station, bridge (approved in chat 2026-09-28)

Parent spec: [`2026-09-26-ancon-loiza-design.md`](2026-09-26-ancon-loiza-design.md) (§3 eras, §4 world, §8 `scene/infrastructure/`). Previous phase: [`2026-09-28-phase-2c-landscapes-design.md`](2026-09-28-phase-2c-landscapes-design.md). Research base: [`docs/research/ancon-research.md`](../../research/ancon-research.md) §1.1, §2.5, §3, §7, §9; source IDs `[S#]` refer to it and to `src/data/sources.ts`.

## 1. Scope

Phase 4 is split in three (ruling in chat 2026-09-28): **4a** the ferry's place, **4b** the town (church, plaza, houses by era), **4c** things that move (carts, cars, animals, crowds). This spec is 4a only.

4a builds:

- Roads: a few story roads in full detail, and the other main roads and paths as a simple ground paint.
- Both landings, with a look per era.
- The station on the east (Loíza) bank: shelter, Cortijo house, bar terrace, and the neighbour's house that the bridge removed.
- The PR-187 bridge: under construction in 1984, open in 1986.
- Two Phase 3 carry-overs: flat ground pads at the landings, and the steering-pole tip resting on the bank while docked.

Branch: `phase-4a-ferry-place`. Merge to `main` only after the user approves.

Not in 4a: town streets and houses, the church, the plaza (4b); vehicles, carts, animals, bridge traffic, crowds (4c); aerial-view features (scoped later); any change to the cane fields or other plants.

### 1.1 Frame rule (user ruling, 2026-09-28)

Build only what the camera shows. The visitor-facing view is `ride` (low, on deck, ≤ ~20 m up); the other presets are debug/URL only. So:

- Full detail only for what sits close to the ride camera: landings, the ends of the story roads, the station.
- Medium detail for the bridge (always ≥ ~150 m from the ferry).
- Everything else is simple or left out. No hidden content "for completeness".
- Exception: the 2c cane fields stay as they are (user ruling).

## 2. What each era shows

All looks are inferred unless a source is named. Each value is `Sourced` in `eras.ts`; inferred values carry `inferred: true`.

| Era | Road surface | Landing | Station (east bank) | Neighbour's house | Bridge |
|---|---|---|---|---|---|
| `1840` | sand, cart ruts | bare bank | thatched shelter | — | none |
| `1900` | sand, cart ruts | bare bank | thatched shelter | — | none |
| `1925` | sand, cart ruts | bare bank | Cortijo house, wood on zocos, thatch/shingle roof | — | none |
| `1935` | packed gravel | timber-edged | Cortijo house, wood, zinc roof | yes | none |
| `1959` | asphalt, worn edges | timber-edged | Cortijo house, wood, zinc roof | yes | none |
| `1975` | asphalt, worn edges | concrete ramp | concrete Cortijo house + bar terrace | yes | none |
| `1984` | asphalt, worn edges | concrete ramp | concrete Cortijo house + bar terrace | gone (bare dirt) | building |
| `1986` | asphalt, worn edges | concrete ramp | concrete Cortijo house + bar terrace | gone (bare dirt) | open |

Sources and confidence:

- Road surface: sand camino real before the 20th century (research §9) [S3] M; PR-187 numbered 1953 [S30] H; gravel in 1935 and asphalt from 1959 are inferred, L.
- Landing: "street end on riverbank" [S9][S26] M; the three looks are inferred, L. The ferry's end boards meet the landing in every era.
- Station: the Cortijos ran the ancón from about 1920 [S1] H; wooden house on zocos, zinc roofs from the 1930s (research §7, general PR vernacular) L–M; concrete house built in the 1960s [S4] H; Bar Restaurante El Ancón with a river terrace [S1][S4] H (shown from 1975, inferred start). The thatched shelter before 1925 is inferred, L.
- Neighbour's house: "a house beside the landing was demolished to build [the bridge]" [S4] H; its look and its 1935 start are inferred, L.
- Bridge: built early to mid 1980s next to the station, "concrete, flags" in period photos [S4] H; inaugurated 1985 [S1][S3] H; alignment from OSM way 204521442 [S26] H; pier spacing, deck width and height are inferred, L.

## 3. Roads

Picked by name/ID from `src/data/geo/loiza.json`. No other roads are drawn.

**Story roads — real ground strips, full detail** (edges, ruts or wear, per-era surface):

| Road | OSM way | Eras |
|---|---|---|
| Antigua PR-187, to the west landing | 1058673941 | all |
| Calle Carlos Escobar, to the east landing | 22182236 | all |
| PR-187 bridge approaches | 204521441 (and the bridge way 204521442, drawn by the bridge unit) | `1984` dirt, `1986` asphalt |

**Simple roads — painted into the ground texture, no geometry:** OSM kinds `secondary`, `secondary_link`, `tertiary`, `track`, `path`, `footway`, minus the story roads and the bridge ways. Same surface-by-era rule. PR-951 and PR-188 show from `1935` (inferred, L); all others in every era.

**Left out:** `residential` and `service` roads (~230). 4b may bring a few back if the frame needs them.

The vegetation road exclusion (`masks.ts`, `caneFields.ts`) is unchanged.

## 4. Units

New folder `src/infrastructure/`, pure logic and components side by side (repo pattern, as `src/vegetation/`, `src/ancon/`).

| Unit | Job |
|---|---|
| `src/data/eras.ts` | New `infrastructure: { roadSurface, landing, station, neighbourHouse, bridge }`, each `Sourced`. Types: `RoadSurface = 'sand' \| 'gravel' \| 'asphalt'`, `LandingLook = 'bank' \| 'timber' \| 'concrete'`, `StationLook = 'shelter' \| 'woodThatch' \| 'woodZinc' \| 'concrete'`, `neighbourHouse: boolean`, `BridgeState = 'none' \| 'building' \| 'open'`. |
| `roads.ts` | Pure. Picks the story and simple roads for an era from the geo bundle; gives each its surface. |
| `roadMesh.ts` | Pure geometry. One merged strip mesh for the story roads, draped on the terrain, with shoulders; surface from a painted-in-code texture (canvas, as the leaf textures). |
| `roadMask.ts` | Pure. Rasterises the simple roads into a ground-mask texture read by the terrain material (same pattern as `uCover` / `uLitter` in `groundUniforms.ts`). |
| `landing.ts` | Pure geometry. Per landing: a flat ground pad (centre, size, height) that the terrain height blends to, and the landing mesh (trodden bank, timber edges and stakes, or concrete ramp). Exposes the bank point where the steering-pole tip rests. |
| `station.ts` | Pure geometry. Shelter, Cortijo house (wood or concrete, roof by era), bar terrace, neighbour's house, and the bare-dirt patch after it goes. One merged mesh per material. |
| `bridge.ts` | Pure geometry. Piers, deck, rails, lamps; for `building`, the deck covers both ends with a mid-river gap, plus wooden forms, flags and one crane. |
| `Infrastructure.tsx` | Mounts the era's parts; rebuilds only on era change. |
| Terrain | Height field blends to the landing pads; terrain material reads the road mask. |
| `src/ancon/` | While docked, the steering-pole tip rests on the landing's bank point (Phase 3 carry-over). |

Positions come from the geo bundle and `src/data/landmarks.ts` (`eastLanding`, `westLanding`, `bridgeSouth`, `bridgeNorth`). The Cortijo house stands at the end of Calle Carlos Escobar, beside the east landing [S9][S10].

## 5. Performance

- 4a adds at most **12 draw calls** (plus their shadows) and **40 000 triangles** in any era.
- Simple roads add **zero** triangles (a texture only).
- No new downloaded files: all geometry and textures are made in code.
- Frame rate on every tier stays within **5 %** of the pre-4a numbers. Measure before and after with the 2c method and record the numbers in `docs/superpowers/notes/phase-4a-rulings.md`.

## 6. Testing

- **Unit (vitest):**
  - Per era: the right story roads, simple roads and surface; the right landing, station, neighbour's house and bridge state.
  - Roads left out stay out (`residential`, `service`).
  - The ground under each landing pad is flat where the ferry docks; the ferry's end boards meet the landing.
  - The steering-pole tip rests on the bank point while docked.
  - Bridge: `building` leaves a gap over the river channel; `open` has none; the deck follows the OSM line.
  - Each unit stays within the §5 limits.
  - The era schema test covers `infrastructure` (every value has sources and a confidence flag).
- **Screenshots (Playwright):** before and after, per era, from `ride` and `bank`; plus 1984 and 1986 views of the bridge. Art gate against the quality-bar image and the research photos (V1), as in 2b/2c.
- **Fact check:** a review agent checks the §2 claims against the named sources. The user sees only flagged items.
- **Frame rate:** as §5.
- **Code review** at the end, as in earlier phases.

## 7. Done when

- Each era shows the roads, landing, station, neighbour's house and bridge in §2.
- The ferry docks on flat landings; the steering pole rests on the bank.
- Only the roads in §3 are drawn.
- The §5 limits hold.
- All tests pass, and the review has no open Important items.
