# Phase 4b rulings and notes

Spec: `docs/superpowers/specs/2026-09-28-phase-4b-town-design.md`. Plan: `docs/superpowers/plans/2026-09-28-phase-4b-town.md`.

## Baseline (Task 1)

`town` camera: pos [ex * 0.3, 5, ez * 0.3], target [285, 6, 171] (brief values kept; checked at ?era=1975&cam=town&t=12&freeze=1&q=medium, the east bank behind the station fills the frame).

Frame rate before the town (`perf.mjs`, 10 s, vsync and cap off, `freeze=1`, dpr 2 except low at dpr 1; real GPU, Metal).

| query | tier | fps | mean ms | p95 ms |
|---|---|---|---|---|
| era=1975 cam=ride t=17 c=95 | high | 81.7 | 12.24 | 14.7 |
| era=1984 cam=ride t=17 c=95 | high | 82.0 | 12.20 | 14.4 |
| era=1975 cam=bank t=12 c=5 | high | 92.4 | 10.82 | 13.3 |
| era=1975 cam=ride t=17 c=95 | medium | 131.1 | 7.63 | 10.5 |
| era=1984 cam=ride t=17 c=95 | medium | 130.4 | 7.67 | 10.5 |
| era=1975 cam=bank t=12 c=5 | medium | 157.4 | 6.35 | 9.3 |
| era=1975 cam=ride t=17 c=95 | low (dpr 1) | 419.9 | 2.38 | 4.2 |
| era=1984 cam=ride t=17 c=95 | low (dpr 1) | 434.8 | 2.30 | 3.4 |
| era=1975 cam=bank t=12 c=5 | low (dpr 1) | 451.0 | 2.22 | 3.2 |

## After (Task 10)

Same queries and settings, after the town (`perf.mjs`, 10 s, dpr 2 except low at dpr 1). The first run came in faster than the Task 1 baseline on every tier (machine state differs), so the before state (commit b8c4171, scratch worktree, `vite preview` on :4174) was measured back to back with the after state, query by query. The limit is judged on the back-to-back pair.

| query | tier | baseline ms (Task 1) | before ms (b2b) | after ms (b2b) | change vs b2b | first after run ms |
|---|---|---|---|---|---|---|
| era=1975 cam=ride t=17 c=95 | high | 12.24 | 9.59 | 9.61 | +0.2 % | 9.61 |
| era=1984 cam=ride t=17 c=95 | high | 12.20 | 9.42 | 9.44 | +0.2 % | 9.43 |
| era=1975 cam=bank t=12 c=5 | high | 10.82 | 8.34 | 8.51 | +2.0 % | 8.31 |
| era=1975 cam=ride t=17 c=95 | medium | 7.63 | 5.98 | 5.96 | −0.3 % | 6.02 |
| era=1984 cam=ride t=17 c=95 | medium | 7.67 | 5.77 | 5.79 | +0.3 % | 5.90 |
| era=1975 cam=bank t=12 c=5 | medium | 6.35 | 4.92 | 4.95 | +0.6 % | 4.97 |
| era=1975 cam=ride t=17 c=95 | low (dpr 1) | 2.38 | 1.97 | 1.97 | 0 % | 1.92 |
| era=1984 cam=ride t=17 c=95 | low (dpr 1) | 2.30 | 1.93 | 1.90 | −1.6 % | 1.82 |
| era=1975 cam=bank t=12 c=5 | low (dpr 1) | 2.22 | 1.74 | 1.74 | 0 % | 1.81 |

Every tier is within the 5 % limit (worst +2.0 %, high bank; also under Task 1's baseline in absolute terms).

## Art gate (Task 10)

After set in `tests/snapshots/phase4b/`, before set in `phase4b-before/`. Town shots taken on the real GPU as below; world and leak specs pass (27 passed, 9 skipped station/town; leak 1 passed). The 5 `station` shots are not in the before set, so no after station shots were taken. Pixel diff (>15/255) against the twin: every shot not listed below is identical (0.00 %); `default` differs 0.03 % (HUD only).

- `1840-town-noon` (0.7 % changed): the church (lime-white, bell tower, three-bay front) stands above the trees behind the landing, thatched huts on the ground either side; nothing floats or sinks; church reads blocky at this range, texture flat.
- `1925-town-noon` (0.7 %): church plus wood houses on zocos, thatch and first zinc, pastel paint (pink, blue); the 4a Cortijo house in front unchanged; houses sit behind the trees, few read clearly.
- `1959-town` (0.9 %): at golden hour the church front and tower show between the two 4a station houses, warm-lit; more houses (peach, yellow) far right; no house on a street, no roof inside-out.
- `1986-town-noon` (2.3 %): concrete boxes with flat roofs, one green-painted zinc house by the road, church behind the plaza trees; the road to the town is clear of houses.
- `1900-aerial-noon` (3.1 %), `1975-aerial-noon` (4.2 %), `1984-aerial` (5.4 %): the town from above: houses grounded, varied sizes, colours and roofs along the OSM streets, not a grid; none on a street; church on its outline beside the bare dirt plaza; plaza trees are few and small from this height.
- `1840-ride`, `1900-ride`, `1935-ride`, `1975-ride`, `1984-ride`, `default`: identical to before. At c=95 and golden hour the ferry heads west, away from the town, so the town is behind the camera.
- Ride from the deck (extra shots, not in the set, scratchpad only): 1840 at c=240/300 (eastbound leg) and 1959 at c=240: the church front and tower read clearly above the roofs and trees behind the landing, huts / zinc-roof houses either side; the town reads from the deck. 1986: the barge is moored at the east landing facing west, so the default ride view shows the west bank and no town (a Phase 3 framing, not a town defect; orbiting turns the camera to the town).
- Against V1 (Archivo Negro captions: wooden and zinc houses at the station, the 1959 público scene, the 1970s passenger views, the bar terrace): the era progression thatch → wood/zinc on zocos → concrete matches the captions; no photo shows the church from the river, so its framing is unconfirmed.
- Important problems found: none (no floating or sunk houses, no inside-out roofs, no house on a street or in the river, no tree through a roof seen, church present from `ride` on the eastbound leg, paint pastel, not a grid). No fixes were needed.

## Rulings

- Houses keep off every road in the town circle (story roads, main roads and town streets), not only the story roads the spec names: a house on painted street reads as a bug.
- Overlaps between lots are tested with the concrete (largest) size in every era, so a house never disappears when it turns concrete.
- Exact lot tests replace the plan's 9-point sampling; the bridge corridor is one more road entry in `LotRules`.
- The component file is `src/town/TownMeshes.tsx`: `Town.tsx` and `town.ts` collide on case-insensitive filesystems.
- The zinc gable slabs are lowered by tan(tilt)·eave so they meet the wall top.
- The PR-951/PR-188 roads test skips bridge-tagged ways.
- 2c plantation palms also skip the town (guard only; 0 palms were affected).
- F1 (final review): the PR-951/PR-188 fix lives in `src/town/town.ts`, not `roads.ts`. `roads.ts` keeps the plain 4a gate (numbered roads hidden before 1935). Before 1935, `townStreets` clips those roads to the town circle (`clipToCircle`, cut exactly at the edge) and paints each piece only when a shown house stands within 15 m, like any town street. Town streets are clipped the same way, so no street paint lies outside the circle in any era.
- F3 (fact check): the belfry is a bell gable (espadaña) on the front's centre bay, per [S14]: two piers and a top around one open arch, two bells side by side on a beam, a cross on top. The side tower is gone. `LOT.churchReach` drops from 5 to 3 m (buttresses + 1.4 m).
- F4: houses keep 1 m off every road edge (was 0.3 m), so eaves (0.5–0.6 m) stay off the carriageway. Lots drop from 97 to 88 on both banks.

## Town shots and the software GPU

- The 4 `town` shots time out in Playwright (swiftshader software GPU, close water reflection), like the 4a `station` shots; `world.spec.ts` skips both.
- Ruling: town shots are taken with the real GPU against `npm run preview`, same settings for every shot (before and after sets):
  `PORT=4173 node scripts/dev/shot.mjs "?era=<era>&cam=town&t=<t>&c=95&freeze=1&q=medium" tests/snapshots/<dir>/<name>.png 2000`
  (t = 12, except 1959 = golden('1959') = 18.46). The before set was made this way and includes the HUD.

## Final fixes: after shots

Retaken after F1–F4: the 4 town shots on the real GPU as above, and the 3 aerials with Playwright.
- Town shots: the church front now carries a bell gable centred over the middle bay, the open arch with the two dark bells and the cross on top reading clearly in 1840 and 1925; seen behind the plaza trees in 1959 and 1986. No side tower.
- `1900-aerial-noon`: the long numbered-road paint out of town is gone; the town streets stop at the circle edge (lower left and right), and the short in-town PR-951 piece with no house near it is not painted.
- The 1925 "pink house touching the church" minor is closed: the final review proved no contact is possible (perspective overlap).

## Fact check

Summary of `.superpowers/sdd/2026-09-28-phase-4b-town/factcheck.md` (sources: Wikipedia [S14][S12][S16], PRAHA photo caption).
- Confirmed: built 1645, enlarged 1729; single barrel-vaulted nave with massive walls and buttresses; two-storey three-bay front; two bells; the front faces the plaza (church at the plaza's north end); 1692 100 houses; 1899 833 residents (barrio-pueblo count).
- Wrong: "bell tower beside the front". The source describes a belfry holding two bells within a single open arch above the centre bay (a bell gable with a cross). Fixed (F3).
- Unsupported, kept inferred (L): the lime-white wall colour (sources say only "plastered masonry"); the low exterior barrel roof (only the interior vault is confirmed). Street data rests on OSM and was not checked.
- The house shares and looks per era remain inferred (L), no contradiction found.

## Deferred

- 1986 `ride`: the moored barge faces west, so the default ride view never frames the town or church; if the 1986 town should show to visitors, the moored heading or the ride rig's resting view needs a look (outside `src/town/`).
- The church reads as a flat lime-white block at 150–350 m: no wall texture or weathering, buttresses barely read; a subtle wash texture or AO would help.
- Plaza trees are few and small from the aerial and hidden from the deck (by design); the plaza reads as bare dirt from above.
- The 1986 green zinc house is the most saturated paint in the town; within range but could be toned down a step.
- No research photo shows the church from the river; the fact check fixed the belfry (bell gable) but found no source for the wall colour (kept inferred).
