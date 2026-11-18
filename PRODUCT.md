# Product

<!-- impeccable:product-schema 1 -->

Written 2026-11-17 from the repository (README, design spec, rulings notes) during an unattended UI overhaul. No interview took place; facts below come from committed documents only.

## Platform

web

## Users

Puerto Rican families and the Loíza community (many crossed on the ancón or have relatives who ran it), the Cortijo family, the Colectivo El Ancón de Loíza, and people who like local history. They open a shared link on a phone or a laptop. Spanish first; English second.

## Product Purpose

A cinematic, historically accurate, real-time 3D reconstruction of the Ancón de Loíza: the hand-powered river ferry across the Río Grande de Loíza, Puerto Rico, from the 1820s until the PR-187 bridge replaced it in 1985–86. The visitor picks one of eight eras (1840–1986) and watches the ferry, crew, landings, town, plants, animals and traffic change. Success: a visitor feels they stood at the landing, and can check every claim against its source.

## Positioning

Every detail in the scene comes from a sourced research dossier. Inferred details are labelled as inferred, in the docs and in the app. The models and the sound are made in code.

## Operating Context

One full-window WebGL scene. Three views: Ride (on deck), Shore (Loíza landing), Sky. Drag to look round. A true-scale timeline (1820–1986). A facts panel with 3–6 sourced facts per era. Sound is off by default. Quality tiers: Auto, High, Medium, Low. Static site on GitHub Pages; no backend.

## Capabilities and Constraints

- Era changes run through a full-screen "dip" that hides the scene rebuild.
- URL carries era, view and language.
- Works by keyboard; era changes are announced; reduced motion makes changes instant.
- Without WebGL the page still shows the facts.
- OpenStreetMap credit is a licence requirement and must stay visible and reachable.
- Phones are a first-class target (≥30 fps on a recent phone).
- No heavy downloaded assets: fonts and images must stay small.

## Brand Commitments

- Name: "El Ancón de Loíza".
- The hand-painted station sign, recreated as a vector at `docs/assets/el-ancon-de-loiza-sign.svg` (approved by the owner). The favicon is the sign's letter A.
- The scene is the subject. Golden-hour light, river haze.
- Sound taste: minimal.
- Build only what the cameras show.

## Evidence on Hand

- Research dossier: `docs/research/ancon-research.md`.
- Facts with sources: `src/data/facts.ts`, `src/data/sources.ts`.
- Sign vector: `docs/assets/el-ancon-de-loiza-sign.svg`. Logo drafts (not approved): `docs/assets/logo-drafts/`.
- Share card: `public/share-card.jpg`.
- No testimonials, visitor counts or press quotes exist; do not invent any.

## Product Principles

1. The scene leads; the interface gets out of its way.
2. Every claim shows its source; inference is labelled.
3. Spanish first, both languages complete.
4. Phones count as much as laptops.
5. Respect for the family and the community whose history this is.

## Accessibility & Inclusion

WCAG AA contrast for text over the scene on any sky. Full keyboard use. Screen-reader names and live announcements. Reduced-motion support. 44 px touch targets.
