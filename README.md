# El Ancón de Loíza

A cinematic, historically accurate 3D reconstruction of the **Ancón de Loíza** — the hand-powered river ferry that crossed the Río Grande de Loíza, Puerto Rico, from the 1820s until the PR-187 bridge ("Puente de la Restauración") replaced it in 1985–86.

Pick an era. Watch the crossing, the mangroves, the town, and the ferry itself change across 160 years.

**Live:** https://gabriel-rene.github.io/ancon-de-loiza/

> Status: **Phase 3** — the hand-powered ferry per era — poled barges, the growing rope-hauled platform, the 1980s steel barge and the idle 1986 barge — crossing between the real landings with its crew and passengers; a decade picker switches eras. It sails through the Phase 1–2a world: real terrain, river, sea, sky, sun, haze and water, with mangroves, coconut palms and casuarinas per era. No buildings yet. See the [roadmap](#roadmap).

## Research

All scene details come from a sourced dossier: [`docs/research/ancon-research.md`](docs/research/ancon-research.md). Every claim has a citation and a confidence level. Inferred details are labelled as such, in the docs and in the app.

## Design

[`docs/superpowers/specs/2026-09-26-ancon-loiza-design.md`](docs/superpowers/specs/2026-09-26-ancon-loiza-design.md)

## Roadmap

- [x] Phase 0 — Repo, research, design, plan
- [x] Phase 1 — Terrain, river, sky, light, water
- [ ] Phase 2 — Vegetation (2a done: mangroves, palms, casuarinas; 2b: remaining species, cane, polish)
- [x] Phase 3 — The ancón, per era (crossing loop, crew, decade picker)
- [ ] Phase 4 — Infrastructure per era
- [ ] Phase 5 — Fauna
- [ ] Phase 6 — Timeline UI, sourced facts, sound, cameras
- [ ] Phase 7 — Performance, mobile, polish, launch

Phase 3 ran before Phase 2b: the ferry is the subject, so it came first; 2b's remaining species and polish follow.

## Stack

Vite · React · TypeScript · React Three Fiber · drei · postprocessing · zustand. Deployed to GitHub Pages.

## Acknowledgements

The Cortijo family, the Colectivo El Ancón de Loíza, and the Archivo Negro collection *El Ancón de Loíza: Un Vínculo Histórico*, whose photographs and testimony make this reconstruction possible.

Map data © OpenStreetMap contributors (ODbL). The derived geography bundle `src/data/geo/loiza.json` is licensed under ODbL 1.0 — see [`src/data/geo/README.md`](src/data/geo/README.md); the rest of the repository is MIT ([LICENSE](LICENSE)).
