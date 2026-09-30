# Phase 5 — Fauna: birds, fish and the manatee (approved in chat 2026-09-30)

Parent spec: [`2026-09-26-ancon-loiza-design.md`](2026-09-26-ancon-loiza-design.md) (§10 phase list: "5. Fauna"). Previous phase: [`2026-09-29-phase-4c-traffic-design.md`](2026-09-29-phase-4c-traffic-design.md). Research base: [`docs/research/ancon-research.md`](../../research/ancon-research.md) §6; source IDs `[S#]` refer to it and to `src/data/sources.ts`.

## 1. Scope

User rulings in chat, 2026-09-30:

- **Birds plus water life:** brown pelicans, frigatebirds, egrets and herons, jumping mullet, one manatee. No crabs (too small for the ride view).
- **Same animals in every era.** The research has no counts per decade; we do not invent them.
- **Three new info-panel facts** about animals (§6), checked by a review agent. The per-era cap goes from 5 to 6 facts (ruling in chat 2026-09-30).
- **One reaction to the ferry:** birds by a landing fly up when the ferry docks there (§3.3).
- **Built in code**, like the 4c oxen and horse. No model files.

Branch: `phase-5-fauna`. Merge to `main` only after the user approves.

Not in Phase 5: crabs, bats, osprey, kingfisher (not sourced for this site, research §6 marks them L); land animals in town (dogs, chickens); era changes in numbers; birds reacting to anything but docking; sounds (Phase 6); the 1986 ride view framing the bridge (deferred in 4c, stays deferred).

### 1.1 Frame rule (user ruling, 2026-09-28)

Build only what the `ride` camera shows. Every animal stays within **300 m of the crossing line** (east landing to west landing) and inside the height band the ride view frames. Nothing is placed for the aerial or debug cameras.

**Amendment 2026-09-30 (framing).** Being within 300 m is not enough: the animals must be where the ride camera looks. A ride-view test (`src/fauna/view.test.ts`) builds the app's un-orbited ride camera (fov 42°, aspect 1.6) for 1975 and 1840 over two full legs, 1 s steps, and counts an animal in view when it is inside the frustum and within 400 m (occlusion ignored, high-tier counts). Thresholds, as the share of samples with at least one of that kind in view: frigatebirds ≥ 40 %, pelicans (flock and fishers) ≥ 30 %, waders ≥ 50 %; manatee ≥ 30 % of its surfacings, long-run (300 surfacings, framed at mid-roll); mullet reported only.

**Amendment 2026-09-30 (closer, user decision).** In the first shots the animals were in frame but a few pixels big. The user chose (chat, 2026-09-30) to bring them closer at real size. The ride-view test now also needs each animal to be big enough on a 900 px tall view: projected size = size / distance / (2·tan 21°) · 900 px, with sizes pelican wingspan 2.1 m, frigatebird 2.2 m, wader 1.0 m × its model scale, manatee 3 m. Thresholds (1975 and 1840, two legs, high-tier counts; they replace the framing thresholds above):

| Kind | Seen when | Share of samples |
|---|---|---|
| Pelicans (flock and fishers) | in frame, ≥ 25 px | ≥ 30 % |
| Frigatebirds | in frame, ≥ 10 px | ≥ 40 % |
| Waders | in frame, ≥ 10 px | ≥ 40 % |
| Wader take-off | ≥ 2 flying waders in frame, ≥ 8 px, at every 0.25 s from 2 to 6 s after each dock start (the camera faces that landing) | every dock |
| Manatee | in frame (as above) | ≥ 30 % of surfacings, long-run |

To meet them: the flock crosses 40–70 m ahead of the ferry; the fishers circle 32–40 m to the side; the frigatebirds soar 60–62.6 m up with their figure-eight kept 220 m ahead of the ferry toward their bank (so about 230–250 m from the camera, where a 2.2 m bird is ≥ 10 px and still under the top of the frame); the waders stand 10–22 m from the pad and their flush flight crosses the front of the pad. On the low tier the animals are left out of the water reflection (§4.3).

## 2. Animals and counts

Species and places are sourced (H) [S22] for the birds and fish and [S17][S18] for the manatee at the river mouth. Numbers, paths, timings and colours are inferred (L).

| Animal | Count (high / medium / low) | Where |
|---|---|---|
| Brown pelican, flock | 4 / 4 / 2 | Low over the river, 3–8 m above the water, crossing the ride view 40–70 m ahead of the ferry |
| Brown pelican, fisher | 2 / 2 / 1 | Circling 8–15 m above the water, 20–200 m from the crossing line: one toward each end of the crossing (≈ 0.3 and 0.7 of the span), circle centre 32–40 m to the side, radius 10–12 m, the first on the river-mouth side |
| Magnificent frigatebird | 3 / 3 / 2 | Soaring 60–120 m up (60–62.6 m used), in a figure-eight beyond a bank (some over each bank) whose centre keeps 220 m from the ferry toward that bank (55–220 m beyond the landing), ahead of the ride camera |
| Egrets and herons | 10 / 10 / 6 | At the waterline near the two landings: 5 per landing (3 on low). All but one per landing stand 10–22 m from the pad, in the landing clearing where no mangrove hides them, and fly up on docking (§3.3); the last one stands 22–30 m away and stays |
| Mullet | 1 jump every 3–6 s | Water within 120 m of the ferry, never inside the ferry footprint or the rope line |
| West Indian manatee | 1 | 25–40 m to the side of the crossing line on the river-mouth side (usually 40–100 m from the ferry, as approved in chat 2026-09-30): a long thin strip (25.5–29.5 m out) running along the crossing over most of the river width; it steps 10 m along the strip between surfacings, back and forth |

Egrets and herons: great egret (*garza real*) and snowy egret (*garza blanca*), white; little blue heron (*garza azul*) and tricolored heron (*garza pechiblanca*), dark. 6 white, 4 dark on high; 4 white, 2 dark on low.

Low tier counts are about half (user ruling). The manatee and the mullet stay on every tier.

## 3. Behaviour

All motion is a pure function of the scene clock (the same clock the crossing uses), so a given time always gives the same picture. No random numbers at run time: every per-animal value comes from a fixed seed.

### 3.1 Birds

- **Pelican flock:** flies in a line (echelon), 4–6 m apart, flap-flap-glide, along the river. Each loop (60–90 s; 64 s used) it crosses the crossing line 40–70 m ahead of the ferry, in the direction the ride camera faces (when the banks leave less than 30 m ahead, it crosses behind the ferry instead, out of the ride view: art gate, Task 11b), and enters and leaves the ride view at points the camera does not frame in steady headings (§1.1), ≤ 272 m out to the side (it starts 240 m out and flies 8 m/s × 64 s = 512 m).
- **Pelican fisher:** circles, then dives: wings fold, a steep drop, a splash ring (§4.4), sits on the water 4–8 s, runs across the water and takes off. One cycle 25–40 s. The two fishers are out of phase.
- **Frigatebird:** slow circles and figure-eights, wings held out, no flapping, a slight bank in the turns. The figure-eight drifts with the ferry (at its speed, ≤ 1.3 m/s) so it stays the same distance ahead. Black, long narrow bent wings, forked tail.
- **Egrets and herons:** stand, walk a few steps along the waterline, stop, peck at the water. They stay on the bank strip between the mangrove edge and the water.

### 3.2 Water life

- **Mullet:** a small silver fish arcs out of the water (about 0.4 s, 0.3–0.6 m high) and falls back; a ring spreads where it lands.
- **Manatee:** every 60–90 s it surfaces: the snout breaks the water, then the back rolls over (about 4 s), a ring spreads, and it goes down. It moves 5–15 m between surfacings. Dark grey-brown, rounded; no detail below the waterline is needed.

### 3.3 Reaction to docking

- At each landing, 4 birds (2 on low) stand on the bank 10–22 m from the pad, in pairs (one each side of the pad; the first pair nearer).
- When the crossing enters its `dock` phase at that landing, they take off one after another (0–1.5 s apart), fly low along the bank across the front of the pad (5.5 m up, ≥ 4 m above the docked deck, about 5 m/s), and land again 30–60 m away on the other side, at most 30 m from the pad. They walk back over the next legs, while the ferry is away.
- In 1986 the ferry is moored and does not dock, so these birds only stand, walk and peck.

## 4. Build

### 4.1 Files

A new folder `src/fauna/`: one module per animal kind (geometry, path function, tests), a `FaunaSet` that owns the instanced meshes, and `rings.ts` for water rings. Path functions take `(clock, seed, crossing state)` and return a pose; they import nothing from React.

### 4.2 Geometry and draw calls

- One `InstancedMesh` per shape: pelican, frigatebird, egret/heron (one shape, colour per instance), mullet, manatee, rings. At most **8 draw calls** (plus shadows and the reflection pass).
- Wings flap and fold, and legs trail, in the vertex shader, from per-instance values. The CPU writes one matrix and three numbers (wing angle, wing fold, legs back) per animal per frame.
- All animals together: **30 000 triangles or fewer** on high.

### 4.3 Reflection and shadows

- All animals draw in the water's reflection pass (they are small), except on the low tier: its reflection is 0.25-scale and shows no bird, so the animals are hidden for that pass (frame-rate budget, §5).
- Only birds on the bank cast shadows. Flying birds, fish, manatee and rings do not.

### 4.4 Water rings

A flat ring on the water surface that grows (to 1–3 m) and fades over 1.5–3 s. Used by the pelican dive and take-off, the mullet and the manatee. One instanced mesh, a fixed pool of rings. The water shader does not change.

## 5. Performance

- At most 8 draw calls and 30 000 triangles (§4.2).
- No new downloaded files.
- Frame rate on every tier stays within **5 %** of the 4c numbers. Measure before and after with the 2c method; record the numbers in `docs/superpowers/notes/phase-5-rulings.md`.

## 6. Info-panel facts

Three new facts, Spanish and English, in `src/data/facts.ts`. The 1984 and 1986 eras already had 5 facts, the old cap; the user ruled (2026-09-30): raise the cap to 6, join the shark and *cocolía* facts, and put the birds fact in 1900 next to the 1918 Piñones forest fact.

| Era | Fact | Sources |
|---|---|---|
| 1900 | Piñones has about 96 bird species, among them the endangered brown pelican. The Carmelita islet may be Puerto Rico's most important heron colony. | [S22] |
| 1984 | The river also gave fish and crabs: a photo in Archivo Negro’s “El Ancón de Loíza” collection shows fishermen scaling a shark, and in the 1980s Tony Croatto was photographed carrying a *cocolía* (blue crab) trap in the river. | [S4][S22] |
| 1986 | In June 2026, manatees were trapped behind the river mouth after sand closed it. DRNA cut a channel about 8 feet wide so they could return to the sea. | [S17][S18] |

`[S18]` (El Nuevo Día, "Atrapados entre el río y el mar…") is in the research list but not yet in `src/data/sources.ts`; add it. The 1986 era runs to today, so the 2026 fact belongs there. `facts.test.ts` checks 3–6 facts per era.

A review agent checks each fact against its source, as in 3b. The user sees only flagged facts.

## 7. Testing

- **Unit (vitest):**
  - Same clock and seed give the same pose for every animal.
  - Counts per tier match §2.
  - The §5 limits hold.
  - Ride view (§1.1 amendments): the thresholds there, in `src/fauna/view.test.ts`; the flock's pass ends are outside the steady ride view; a flock pass never crosses 0–30 m ahead of the ferry (`flyers.test.ts`).
  - The manatee surfaces 25–40 m to the side of the crossing line on the river-mouth side (usually 40–100 m from the ferry), river only, 5–15 m between surfacings.
  - Every animal stays within §1.1: within 300 m of the crossing line; flying birds above the water or ground by at least 2 m (except the pelican dive and sit); bank birds on the bank strip; mullet never inside the ferry footprint or the rope line.
  - Docking: landing birds take off within 1.5 s of `dock` starting at their landing and land again 30–60 m away, on the other side of the pad, ≤ 30 m from it; their flights pass ≥ 4 m above the docked deck in every era; in 1986 they never take off.
  - Low tier: every animal is hidden in the reflection pass and shown again after it.
  - Rings: each dive, take-off, fish jump and manatee surfacing starts one ring; the pool never overflows.
  - Facts: every new fact has both languages and a known source key.
- **Screenshots (Playwright):** `ride` view per era; one `ride` shot per river (1975, 1840) of the landing birds flying up during a dock; one shot of a manatee surfacing; one of a pelican dive. Art gate against the quality-bar image, as in earlier phases.
- **Fact check:** as §6.
- **Frame rate:** as §5.
- **Code review** at the end, as in earlier phases.

## 8. Done when

- Every era shows the animals in §2 behaving as in §3, including the docking reaction.
- The three facts are in the panel and pass the fact check (or the user rules on flagged ones).
- The §5 limits hold.
- All tests pass, and the review has no open Important items.
