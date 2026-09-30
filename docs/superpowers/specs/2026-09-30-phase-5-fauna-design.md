# Phase 5 — Fauna: birds, fish and the manatee (approved in chat 2026-09-30)

Parent spec: [`2026-09-26-ancon-loiza-design.md`](2026-09-26-ancon-loiza-design.md) (§10 phase list: "5. Fauna"). Previous phase: [`2026-09-29-phase-4c-traffic-design.md`](2026-09-29-phase-4c-traffic-design.md). Research base: [`docs/research/ancon-research.md`](../../research/ancon-research.md) §6; source IDs `[S#]` refer to it and to `src/data/sources.ts`.

## 1. Scope

User rulings in chat, 2026-09-30:

- **Birds plus water life:** brown pelicans, frigatebirds, egrets and herons, jumping mullet, one manatee. No crabs (too small for the ride view).
- **Same animals in every era.** The research has no counts per decade; we do not invent them.
- **Four new info-panel facts** about animals (§6), checked by a review agent.
- **One reaction to the ferry:** birds by a landing fly up when the ferry docks there (§3.3).
- **Built in code**, like the 4c oxen and horse. No model files.

Branch: `phase-5-fauna`. Merge to `main` only after the user approves.

Not in Phase 5: crabs, bats, osprey, kingfisher (not sourced for this site, research §6 marks them L); land animals in town (dogs, chickens); era changes in numbers; birds reacting to anything but docking; sounds (Phase 6); the 1986 ride view framing the bridge (deferred in 4c, stays deferred).

### 1.1 Frame rule (user ruling, 2026-09-28)

Build only what the `ride` camera shows. Every animal stays within **300 m of the crossing line** (east landing to west landing) and inside the height band the ride view frames. Nothing is placed for the aerial or debug cameras.

## 2. Animals and counts

Species and places are sourced (H) [S22] for the birds and fish and [S17][S18] for the manatee at the river mouth. Numbers, paths, timings and colours are inferred (L).

| Animal | Count (high / medium / low) | Where |
|---|---|---|
| Brown pelican, flock | 4 / 4 / 2 | Low over the river, 3–8 m above the water, crossing the ride view |
| Brown pelican, fisher | 2 / 2 / 1 | Circling 8–15 m above the water, 40–200 m from the crossing line |
| Magnificent frigatebird | 3 / 3 / 2 | Soaring 60–120 m up, above the crossing |
| Egrets and herons | 10 / 10 / 5 | On the mangrove edge and mud at the waterline, both banks; 3–4 of them by each landing (§3.3) |
| Mullet | 1 jump every 3–6 s | Water within 120 m of the ferry, never inside the ferry footprint or the rope line |
| West Indian manatee | 1 | 40–100 m from the crossing line, on the river-mouth side |

Egrets and herons: great egret (*garza real*) and snowy egret (*garza blanca*), white; little blue heron (*garza azul*) and tricolored heron (*garza pechiblanca*), dark. About 6 white, 4 dark on high; about 3 white, 2 dark on low.

Low tier counts are about half (user ruling). The manatee and the mullet stay on every tier.

## 3. Behaviour

All motion is a pure function of the scene clock (the same clock the crossing uses), so a given time always gives the same picture. No random numbers at run time: every per-animal value comes from a fixed seed.

### 3.1 Birds

- **Pelican flock:** flies in a line (echelon), 4–6 m apart, flap-flap-glide. Enters and leaves the ride view at points the camera does not frame (§1.1), on a loop of 60–90 s.
- **Pelican fisher:** circles, then dives: wings fold, a steep drop, a splash ring (§4.4), sits on the water 4–8 s, runs across the water and takes off. One cycle 25–40 s. The two fishers are out of phase.
- **Frigatebird:** slow circles and figure-eights, wings held out, no flapping, a slight bank in the turns. Black, long narrow bent wings, forked tail.
- **Egrets and herons:** stand, walk a few steps along the waterline, stop, peck at the water. They stay on the bank strip between the mangrove edge and the water.

### 3.2 Water life

- **Mullet:** a small silver fish arcs out of the water (about 0.4 s, 0.3–0.6 m high) and falls back; a ring spreads where it lands.
- **Manatee:** every 60–90 s it surfaces: the snout breaks the water, then the back rolls over (about 4 s), a ring spreads, and it goes down. It moves 5–15 m between surfacings. Dark grey-brown, rounded; no detail below the waterline is needed.

### 3.3 Reaction to docking

- At each landing, 3–4 birds stand on the bank within 40 m of the pad.
- When the crossing enters its `dock` phase at that landing, they take off one after another (0–1.5 s apart), fly low along the bank, and land again 30–60 m away. They walk back toward the pad over the next legs.
- In 1986 the ferry is moored and does not dock, so these birds only stand, walk and peck.

## 4. Build

### 4.1 Files

A new folder `src/fauna/`: one module per animal kind (geometry, path function, tests), a `FaunaSet` that owns the instanced meshes, and `rings.ts` for water rings. Path functions take `(clock, seed, crossing state)` and return a pose; they import nothing from React.

### 4.2 Geometry and draw calls

- One `InstancedMesh` per shape: pelican, frigatebird, egret/heron (one shape, colour per instance), mullet, manatee, rings. At most **8 draw calls** (plus shadows and the reflection pass).
- Wings flap and fold in the vertex shader, from a per-instance phase and a per-instance "mode" (flap, glide, fold, stand). The CPU writes one matrix and two numbers per animal per frame.
- All animals together: **30 000 triangles or fewer** on high.

### 4.3 Reflection and shadows

- All animals draw in the water's reflection pass (they are small).
- Only birds on the bank cast shadows. Flying birds, fish, manatee and rings do not.

### 4.4 Water rings

A flat ring on the water surface that grows (to 1–3 m) and fades over 1.5–3 s. Used by the pelican dive and take-off, the mullet and the manatee. One instanced mesh, a fixed pool of rings. The water shader does not change.

## 5. Performance

- At most 8 draw calls and 30 000 triangles (§4.2).
- No new downloaded files.
- Frame rate on every tier stays within **5 %** of the 4c numbers. Measure before and after with the 2c method; record the numbers in `docs/superpowers/notes/phase-5-rulings.md`.

## 6. Info-panel facts

Four new facts, Spanish and English, in `src/data/facts.ts`:

| Era | Fact | Sources |
|---|---|---|
| 1984 | A 1980s photo shows fishermen cleaning a shark at El Ancón. | [S4] |
| 1984 | In the 1980s Tony Croatto was filmed with a *cocolía* (blue crab) trap in the river. | [S4] |
| 1986 | Piñones has about 96 bird species, among them the brown pelican (endangered). The Carmelita islet may be Puerto Rico's most important heron nesting place. | [S22] |
| 1986 | Manatees were trapped behind the closed river mouth in 1995 and in June 2026. In 2026 DRNA cut a channel to free them. | [S17][S18] |

`[S18]` (El Nuevo Día, "Atrapados entre el río y el mar…") is in the research list but not yet in `src/data/sources.ts`; add it. The 1986 era runs to today, so the 2026 fact belongs there.

A review agent checks each fact against its source, as in 3b. The user sees only flagged facts.

## 7. Testing

- **Unit (vitest):**
  - Same clock and seed give the same pose for every animal.
  - Counts per tier match §2.
  - The §5 limits hold.
  - Every animal stays within §1.1: within 300 m of the crossing line; flying birds above the water or ground by at least 2 m (except the pelican dive and sit); bank birds on the bank strip; mullet never inside the ferry footprint or the rope line.
  - Docking: landing birds take off within 1.5 s of `dock` starting at their landing and land again 30–60 m away; in 1986 they never take off.
  - Rings: each dive, take-off, fish jump and manatee surfacing starts one ring; the pool never overflows.
  - Facts: every new fact has both languages and a known source key.
- **Screenshots (Playwright):** `ride` view per era; one shot of the landing birds flying up during a dock; one shot of a manatee surfacing; one of a pelican dive. Art gate against the quality-bar image, as in earlier phases.
- **Fact check:** as §6.
- **Frame rate:** as §5.
- **Code review** at the end, as in earlier phases.

## 8. Done when

- Every era shows the animals in §2 behaving as in §3, including the docking reaction.
- The four facts are in the panel and pass the fact check (or the user rules on flagged ones).
- The §5 limits hold.
- All tests pass, and the review has no open Important items.
