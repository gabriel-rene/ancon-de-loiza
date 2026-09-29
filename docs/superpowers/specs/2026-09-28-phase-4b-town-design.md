# Phase 4b — The town: houses by era, church, plaza, streets (approved in chat 2026-09-28)

Parent spec: [`2026-09-26-ancon-loiza-design.md`](2026-09-26-ancon-loiza-design.md) (§3 eras, §4 world). Previous phase: [`2026-09-28-phase-4a-ferry-place-design.md`](2026-09-28-phase-4a-ferry-place-design.md). Research base: [`docs/research/ancon-research.md`](../../research/ancon-research.md) §1, §7, §9; source IDs `[S#]` refer to it and to `src/data/sources.ts`.

## 1. Scope

Phase 4 is split in three (ruling in chat 2026-09-28): **4a** the ferry's place (shipped), **4b** the town, **4c** things that move. This spec is 4b only.

4b builds:

- Houses of Loíza Aldea on the east bank, from real OpenStreetMap building outlines, with a look and a count per era.
- The church, Parroquia del Espíritu Santo y San Patricio, in full detail.
- The plaza, simple: open ground and trees.
- The town streets next to the shown houses, as ground paint.
- A fix for a 4a deferred item: the PR-951 era rule also hid old town streets.

Branch: `phase-4b-town`. Merge to `main` only after the user approves.

Not in 4b: vehicles, carts, animals, crowds (4c); plaza furniture (benches, lamps, kiosk); houses on the west bank; aerial-view features (scoped later); changes to the station, landings, bridge or cane fields.

### 1.1 Frame rule (user ruling, 2026-09-28)

Build only what the `ride` camera shows (low, on deck). The town is 150–350 m from the ferry, behind the station. So:

- Houses are simple shapes; doors, windows and shutters are painted on a texture, not modelled.
- The church gets full detail: its front and bell tower show above the roofs.
- The plaza ground is hidden by houses from the deck; only its trees can show. So the plaza gets open ground and trees only.
- Only outlines within 350 m of the east landing are used (123 outlines today). The west bank has 7 within 350 m of its landing; they are left out.

## 2. What each era shows

All looks and shares are inferred (general Puerto Rico vernacular, research §7) unless a source is named. Each value is `Sourced` in `eras.ts`; inferred values carry `inferred: true`, confidence L.

| Era | Houses shown | House look |
|---|---|---|
| `1840` | 25 % | thatched huts on short posts (zocos) |
| `1900` | 35 % | thatch; some wood walls |
| `1925` | 45 % | wood on zocos; thatch or zinc roofs |
| `1935` | 55 % | wood on zocos, zinc roofs, bright paint, storm shutters (tormenteras) |
| `1959` | 70 % | wood and zinc; 10 % concrete |
| `1975` | 100 % | 50 % concrete with flat roofs; the rest wood and zinc |
| `1984` | 100 % | 65 % concrete |
| `1986` | 100 % | 65 % concrete |

Rules:

- **Which houses.** Each outline gets a rank: distance to the church, plus a small fixed random jitter (seeded by its OSM id). An era shows the lowest-ranked share. So the old town grows out from the church, and a house shown in one era is shown in every later era.
- **Dropped outlines.** An outline is never used if it touches the landing clearing (22 m, `LANDING_CLEARING`), the 4a station footprints, a story road, the bridge corridor, the church outline or the plaza. The station's houses stay 4a's (the Cortijo house is one of the OSM outlines).
- **Which look.** Each house gets a fixed random number (seeded by its OSM id). The era's shares turn that number into a look. So a house that is concrete in 1975 stays concrete in 1984.
- **Size.** Today's outlines are larger than old houses. For thatch and wood looks, the house is a rectangle inside the outline's oriented bounding box, clamped to 5–9 m × 4–7 m. Concrete houses use the bounding box, clamped to 6–14 m × 5–12 m.
- **Church.** Same shape in every era: it was built in 1645 and enlarged in 1729 [S14] H. Single nave, massive walls and buttresses, two-storey three-bay front, bell tower with two bells [S14] H. Position and outline from OSM (`building=church`) [S26] H. Wall colour lime-white, inferred L (fact check to confirm or correct).
- **Plaza.** Plaza Don Ricardo Sanjurjo, position from OSM [S26] H. Open trodden ground and 6–10 trees (almendro and palm, existing species), inferred L.
- **Streets.** OSM `residential` and `service` roads inside the 350 m circle are painted into the ground mask only where an era's house stands within 15 m of them. Same surface-by-era rule as 4a (sand, gravel, asphalt).
- **4a fix.** The PR-951 gate before 1935 applies only to the PR-951 highway segments outside the town circle; town streets that carry the number follow the street rule above.

## 3. Units

New folder `src/town/`, pure logic and components side by side (repo pattern, as `src/infrastructure/`).

| Unit | Job |
|---|---|
| `scripts/osm-parse.ts`, `scripts/bake-osm.ts` | Add `buildings: { id, kind, ring }[]` to the geo bundle, only outlines within 350 m of the east landing. Uses the cached `scripts/.cache/osm.xml`; no download. `GeoBundle` type and README updated. |
| `src/data/eras.ts` | New `town: { houseShare, concreteShare, thatchShare }`, each `Sourced<number>`. Era schema test covers it. |
| `houses.ts` | Pure. Ranks outlines, picks the era's houses, gives each a look (`thatch`, `woodThatch`, `woodZinc`, `concrete`), a rectangle and a paint colour. |
| `houseMesh.ts` | Pure geometry. Zocos, walls, gable roof (thatch or zinc) or flat roof with parapet (concrete). Doors, windows and shutters from a painted-in-code texture. One merged mesh per material. |
| `church.ts` | Pure geometry. Nave, buttresses, three-bay front, bell tower with two bells, on the OSM church outline. |
| `plaza.ts` | Pure. Plaza dirt patch and tree positions. |
| `streets.ts` | Pure. Picks the era's town streets; feeds them to the 4a ground mask (`groundMask.ts`). |
| `Town.tsx` | Mounts the era's town. Rebuilds only on era or tier change. |
| Vegetation | A no-plants patch per shown house (1 m past its walls), the church and the plaza, per era. |
| Ground | Each house, the church and the plaza sit on ground levelled under them; yards get trodden-dirt paint (4a `DirtPatch`). |

Heights read the tier's `near` terrain, as in 4a.

## 4. Performance

- 4b adds at most **8 draw calls** (plus their shadows) and **40 000 triangles** in any era.
- Town streets add **zero** triangles (ground mask only).
- No new downloaded files; all geometry and textures are made in code. The geo bundle grows by the 350 m outlines only.
- Frame rate on every tier stays within **5 %** of the 4a numbers. Measure before and after with the 2c method; record the numbers in `docs/superpowers/notes/phase-4b-rulings.md`.

## 5. Testing

- **Unit (vitest):**
  - Per era: house count matches the share; every house shown in an era is shown in all later eras; a house's look never goes back (concrete stays concrete).
  - Sizes stay in the §2 ranges; no house overlaps another, the church, the plaza, the station or a story road.
  - The church sits on its OSM outline; the plaza trees sit inside the plaza.
  - Streets: each painted street has a shown house within 15 m; no `residential`/`service` street outside the circle is painted.
  - No plant stands inside a house, the church or the plaza.
  - The §4 limits hold in every era.
  - Era schema test covers `town`.
- **Screenshots (Playwright):** before and after, per era, from `ride` and `bank`. Art gate against the quality-bar image and the research photos (V1), as in 4a.
- **Fact check:** a review agent checks the §2 claims against the named sources. The user sees only flagged items.
- **Frame rate:** as §4.
- **Code review** at the end, as in earlier phases.

## 6. Done when

- Each era shows the houses, church, plaza and streets in §2.
- Only the content in §1.1 is built.
- The §4 limits hold.
- All tests pass, and the review has no open Important items.
