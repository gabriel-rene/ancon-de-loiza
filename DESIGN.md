---
name: El Ancón de Loíza
description: Painted station signage over a full-window 3D river scene.
colors:
  green: "#1e4a33"
  green-deep: "#123524"
  ink: "#08140e"
  cream: "#e7ece3"
  ochre: "#b7834f"
  ochre-ink: "#7a4d21"
  gold: "#f2c46d"
  field-centre: "#2a5f43"
  field-edge: "#143625"
  green-hover: "#28603f"
  cream-hover: "#f4f7f1"
  ochre-hover: "#c79461"
  board-ink: "#14261c"
  board-meta: "#3d4f44"
  scrim: "rgba(8, 20, 14, 0.72)"
  scrim-large: "rgba(8, 20, 14, 0.56)"
typography:
  display:
    fontFamily: "Archivo, 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(110px, 24vw, 300px)"
    fontWeight: 900
    lineHeight: 0.8
    fontVariation: "'wdth' 66"
    fontFeature: "'tnum', 'lnum'"
  headline:
    fontFamily: "Archivo, 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(58px, 7.2vw, 100px)"
    fontWeight: 900
    lineHeight: 0.8
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 68"
    fontFeature: "'tnum', 'lnum'"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(19px, 1.75vw, 25px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  meta:
    fontFamily: "Archivo, ui-sans-serif, system-ui, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "13.5px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 82"
  stop:
    fontFamily: "Archivo, 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.03em"
    fontVariation: "'wdth' 72"
    fontFeature: "'tnum', 'lnum'"
rounded:
  xs: "2px"
  sm: "3px"
  md: "4px"
spacing:
  placard-gap: "6px"
  pad: "clamp(12px, 2.2vw, 28px)"
  lift: "26px"
  lift-narrow: "14px"
  stack-narrow: "56px"
  rail: "92px"
  rail-two-rows: "140px"
components:
  placard:
    backgroundColor: "{colors.green}"
    textColor: "{colors.cream}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "1px 15px 0"
    height: "44px"
  placard-hover:
    backgroundColor: "{colors.green-hover}"
  placard-pressed:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.green-deep}"
  placard-pressed-hover:
    backgroundColor: "{colors.cream-hover}"
  placard-facts:
    backgroundColor: "{colors.ochre}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "1px 15px 0"
    height: "44px"
  placard-facts-hover:
    backgroundColor: "{colors.ochre-hover}"
  menu:
    backgroundColor: "{colors.green-deep}"
    textColor: "{colors.cream}"
    rounded: "{rounded.sm}"
    padding: "5px"
  menu-item-checked:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.green-deep}"
    rounded: "{rounded.xs}"
  route-stop:
    textColor: "{colors.cream}"
    typography: "{typography.stop}"
    rounded: "{rounded.xs}"
    padding: "7px 6px 6px"
    height: "48px"
  route-stop-current:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.green-deep}"
  facts-board:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.board-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    width: "min(430px, calc(100vw - 2 * var(--pad)))"
  facts-board-head:
    backgroundColor: "{colors.green}"
    textColor: "{colors.cream}"
    padding: "12px 10px 12px 20px"
  drag-hint:
    backgroundColor: "{colors.green}"
    textColor: "{colors.cream}"
    rounded: "{rounded.sm}"
    padding: "10px 14px 9px"
---

# Design System: El Ancón de Loíza

## Overview

**Creative North Star: "The Landing's Own Signage"**

The overlay is the ferry landing's painted signage, hung over a full-window 3D scene. It has a station sign, small painted placards, a route line with year stops, and one cream facts board. The scene is the subject. The overlay names the year, offers the controls, and steps back.

Every colour comes from the owner's approved sign vector (`docs/assets/el-ancon-de-loiza-sign.svg`): bottle green, sign cream, painted ochre. Sun gold marks focus and the route marker. One type family, Archivo, speaks in two voices: narrow and heavy for signs and years, normal width for reading.

Objects are opaque paint, not glass. Text that sits straight on the scene gets a green-black scrim so it reads on any sky. This system applies to the HTML overlay only (`src/styles.css`, `src/ui/*`, the load card in `index.html`, `public/404.html`). The 3D scene has its own art direction.

**Key Characteristics:**
- Full-bleed scene; controls sit at the four corners and the bottom edge.
- Painted placards with an inner cream keyline. Radii are 2–4px.
- Years are heavy narrow numerals in fixed digit cells.
- State changes are colour cuts with a small lift-and-settle, never a glide.
- One green field covers loading, era changes, the no-WebGL fallback and the 404 page.

## Colors

Three sign colours, one focus colour, and green-black ink for shadow and scrim. `src/ui/contrast.test.ts` checks that green, cream and ochre match the sign vector's fills.

### Primary
- **Bottle Green** (`--green`, #1e4a33): placard ground, facts board header, drag hint, browser theme colour.
- **Deep Green** (`--green-deep`, #123524): text on cream; ground of the quality menu.
- **Sign Cream** (`--cream`, #e7ece3): all text over the scene and on green; ground of the facts board and of every chosen state.

### Secondary
- **Painted Ochre** (`--ochre`, #b7834f): ground of the Facts placard only.
- **Ochre Ink** (`--ochre-ink`, #7a4d21): ochre for text on cream: fact numerals, the era span, the "inferred" stamp.

### Tertiary
- **Sun Gold** (`--gold`, #f2c46d): every focus ring, the route marker, text selection.

### Neutral
- **Green-Black Ink** (`--ink`, #08140e): page ground behind the canvas, text on ochre, all shadows (as `rgba(8, 20, 14, a)`).
- **Scrim** (`--scrim`, rgba(8, 20, 14, 0.72)) and **Scrim Large** (`--scrim-large`, rgba(8, 20, 14, 0.56)): the bottom gradient under text on the scene.
- **Green Field** (`--field`): `radial-gradient(ellipse at 50% 42%, #2a5f43 0%, #1e4a33 55%, #143625 100%)`. The same string in `styles.css`, `index.html` and `public/404.html`.
- **Board Ink** (#14261c) and **Board Meta** (#3d4f44): body text and source lines on the cream board.
- **Hover tints**: green #28603f, cream #f4f7f1, ochre #c79461. Cream at 12–16% alpha for hover on transparent buttons.
- **Line tints**: cream at 66% for the route line and leaders, 45% for decade ticks, 50% for the placard keyline. Deep green at 16% for rules on the board.

### Named Rules
**The Sign Palette Rule.** `--green`, `--cream` and `--ochre` must equal fills in the sign vector. A unit test fails if they drift.

**The One Ochre Rule.** Ochre as a ground appears once: the Facts placard. It marks the way to the sourced content.

**The Gold Is Not Paint Rule.** Gold marks focus, the route marker and selection. It is never a placard ground or a text colour on the scene.

## Typography

**Sign voice:** Archivo at 66–84% width (`--sign`: `'Archivo', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif`).
**Reading voice:** Archivo at normal width (`--text`: `'Archivo', ui-sans-serif, system-ui, 'Helvetica Neue', Arial, sans-serif`).

Archivo is one variable file (wght 100–900, wdth 62–125), self-hosted at `public/fonts/archivo-latin.woff2` and preloaded. Licence: `public/fonts/Archivo-OFL.txt`. Width is set with `font-stretch`.

**Character:** A sign painter's narrow capitals for anything you would paint on a board; the same face, relaxed, for sentences.

### Hierarchy
- **Display** (900, 66% width, `clamp(110px, 24vw, 300px)`, line-height 0.8): the year on the era dip.
- **Headline** (900, 68% width, `clamp(58px, 7.2vw, 100px)`, line-height 0.8, tracking -0.01em): the era year, bottom left. The same style at 34px heads the facts board; at 22px it numbers the facts; at `clamp(44px, 9vw, 76px)` it is the load card year.
- **Title** (700, normal width, `clamp(19px, 1.75vw, 25px)`, line-height 1.12): the era name. 17px in the board header; `clamp(17px, 2.2vw, 26px)` on the dip.
- **Body** (400, 16px, line-height 1.55, max 62ch): fact text on the board.
- **Meta** (400, 13px, line-height 1.5): source lines and notes on the board. The map credit is 11px.
- **Label** (700, 82% width, 13.5px, tracking 0.08em, uppercase): placards and menu items. Small sign labels use 84% width at 12–13px with 0.07–0.1em tracking: era span, hover label, drag hint, "inferred" stamp.
- **Stop** (800, 72% width, 16px, tracking 0.03em): year labels on the route line.

### Named Rules
**The Fixed Cell Rule.** Each digit of a year sits in a cell 0.5em wide with `tabular-nums lining-nums`. A digit changes in place. Nothing slides sideways.

**The Two Voices Rule.** Narrow width means "this is painted on a sign": years, labels, stamps. Normal width means "read this": era names, facts, sources. Do not set sentences in the sign voice.

## Layout

The scene fills the window (`position: fixed; inset: 0`). The page never scrolls. Every overlay object is fixed to an edge.

- **Top left:** the station sign (48px tall).
- **Top right:** utility placards: language pair, sound, quality.
- **Bottom left:** the era title (year, name, span).
- **Bottom right:** action placards: Facts, then Ride / Shore / Sky, then Recenter when the view is turned.
- **Bottom edge:** the route line block, `--rail-h` tall (safe-area inset + 92px; + 140px when year labels need two rows).
- **Right side:** the facts board when open, 430px wide, between the top placards and the action placards.

Side padding is `--pad: clamp(12px, 2.2vw, 28px)`. Placards sit 6px apart. `--lift` (26px) is the gap between the route line block and the row above it; it leaves room for the hover label. `--safe-t` and `--safe-b` respect device safe areas.

### Responsive
**At 759px and below:**
- `--stack` becomes 56px and `--lift` becomes 14px. `--stack` is the height of the action placards, which move to the bottom left and sit directly on the route line block. The era title and the scrim rise by `--stack` to clear them.
- The sign shrinks to 36px (31px at 380px and below).
- Sound and quality placards show their icon only; the label stays for screen readers.
- The facts board becomes a bottom sheet: 8px side margins, max height `min(56vh, 100vh − rail − 150px)`. The era title hides while it is open.
- The map credit moves to the bottom left.

**At 639px and below:**
- The route line is never squeezed. The track becomes 190vw wide inside a horizontal scroller with 16px edge fades. The chosen stop scrolls to the centre.

The drag hint sits higher below 1100px so it clears the title row.

Stacking order, low to high: scrim 1, era title 2, drag hint 3, era dip 12, route line 15, map credit 16, facts board 20, sign and placards 21, quality menu 25, load card 40.

## Elevation & Depth

Objects are flat paint with a short, soft, green-black drop shadow that lifts them off the scene. There is no blur, no translucency and no glow. All shadows use the ink colour.

### Shadow Vocabulary
- **Placard** (`inset 0 0 0 2px var(--green), inset 0 0 0 3px rgba(231, 236, 227, 0.5), 0 1px 0 rgba(8, 20, 14, 0.5), 0 8px 18px -10px rgba(8, 20, 14, 0.7)`): the inner pair draws the keyline; the outer pair is a hard 1px edge plus a tight drop.
- **Pressed placard** (`inset 0 0 0 2px var(--cream), inset 0 0 0 3px rgba(18, 53, 36, 0.45)`): keyline only; a pressed placard has no drop shadow.
- **Menu** (`0 1px 0 rgba(8, 20, 14, 0.5), 0 18px 36px -14px rgba(8, 20, 14, 0.8)`).
- **Facts board** (`0 30px 60px -24px rgba(8, 20, 14, 0.75), 0 2px 0 rgba(8, 20, 14, 0.35)`).
- **Route marker** (`0 0 0 3px rgba(8, 20, 14, 0.6), 0 2px 8px rgba(8, 20, 14, 0.5)`): a dark ring so gold reads on any sky.
- **Sign** (`drop-shadow(0 2px 5px rgba(8, 20, 14, 0.45))`; on the load card `0 14px 22px`).
- **Year on the scene** (`text-shadow: 0 2px 18px rgba(8, 20, 14, 0.5)`).

### The scrim
Text that sits on the scene (era title, route stops, map credit) rests on one bottom gradient. It is solid `--scrim` up to 58px above the route block, eases to `--scrim-large` at 124px, and is clear at 262px. Small text stays in the solid zone; the big year may reach the lighter zone.

### Named Rules
**The Own Ground Rule.** A placard, menu or board carries its own opaque ground and needs no scrim. Only bare text on the scene uses the scrim.

**The Keyline Rule.** Every placard has a 1px inner line, inset 2px, in the opposite sign colour at about half strength. It is drawn with inset box-shadow, not a border.

## Shapes

Near-square painted boards. Radii are 2px (route stops, menu items, hover label, stamp), 3px (placards, menu, drag hint, close button) and 4px (facts board, scene focus ring). Nothing is a pill.

Two shapes are round on purpose: the route marker (16px gold disc) and the stop dots (r 3.5, 4.5 when current). They are points on a route diagram, not buttons.

Lines are thin: the route line is 2px, leaders and ticks 1px, rules on the board 1px. Icons are 16px line drawings at 1.5–2px stroke in `currentColor`. The "inferred" stamp has a 1.5px outline and is rotated −2°.

## Components

### The sign
The owner's vector, cropped to its cream panel (`#svgView(viewBox(35,29,856,142))`). It is the page's `h1`. It is 48px tall top left, and up to 560px wide on the load card and no-script page. It is an image and takes no pointer events.

### Placards
- **Shape:** 3px radius, 44px minimum height and width, inner keyline.
- **Default:** green ground, cream sign-voice label.
- **Hover:** ground lightens to #28603f.
- **Active:** moves down 1px.
- **Pressed or open** (`aria-pressed`, `aria-expanded`): cream ground, deep green text, and the settle-press motion.
- **Grouped placards** (language pair, Ride / Shore / Sky): one green board with one keyline; the buttons inside are transparent, 12px side padding. The chosen one turns cream. On mouse devices the view buttons show their key (1, 2, 3) at 62% opacity.
- **Facts:** ochre ground, ink text. When open it keeps ochre and gains an ink keyline and an ochre outer ring.
- **Recenter:** appears only when the view is turned; enters with `placard-in` (320ms).
- **Focus:** 2px gold outline, 2px offset.

### Quality menu
Deep green board under its placard, 168px minimum width, 5px padding. Items are 44px tall in the label style. The checked item is cream with a drawn tick. The placard's icon is three bars that fill by tier. Opens with `placard-in` (220ms).

### Era title
The year in headline style in fixed cells, with the era name and the span (label style, 13px) beside its foot. Cream on the scrim. It takes no pointer events.

### Route line
A true-scale line from 1820 to 1986. It has a 2px cream line at 66%, a full-cream progress line up to the chosen year, decade ticks (taller at half-centuries), a dot per era, and a year button per era joined to its dot by a leader. Labels spread to avoid overlap and drop to a second row when needed.
- **Stop:** 48 × 44px minimum target; the year sits on a 2px-radius chip.
- **Hover / drag target:** chip gets cream at 16%.
- **Current:** chip turns cream with deep green text.
- **Hover label:** a small cream board 20px above the stop with the era name and span. Shows on hover, focus, and under the dragged marker. The first two and last two stops align it to their own edge.
- **Marker:** 16px gold disc with a 44px hit area. Drag it; release snaps to the nearest era. It scales to 1.15 on hover and 1.3 while dragged.

### Facts board
The one panel. Cream ground, 4px radius, green header rail with the year (34px) and era name, and a 44px close button. The body scrolls with a 24px bottom fade. Each fact has an ochre-ink numeral, body text, then its sources on the next line as underlined deep green links. Rules between facts are 1px deep green at 16%. Inferred facts carry the rotated outline stamp. Selection on the board is green on cream. It is a non-modal dialog; the scene stays live beside it.

### Green field
One gradient, four uses.
- **Load card:** the sign, the year, and a 2px progress bar that fills to 33%, 67%, then 100%.
- **Era dip:** the field with the display year and era name.
- **Scene fallback:** the field with one centred sentence when WebGL fails. Scene-only controls hide and the facts board opens.
- **404:** the field with "404", two short lines (Spanish, then English) and one cream placard link.

### Drag hint
One green placard, centred above the title row: "Drag to look around" with a two-way arrow that sways 3px each way over 2.4s. It shows 3.2s after the scene is ready, stays 7s, and leaves on the first drag. Once per session. Hidden from screen readers.

### Motion grammar
The standard easing is `--ease: cubic-bezier(0.16, 1, 0.3, 1)`.

- **Arrival** (once, when the scene is ready, `body[data-ready]`): the sign settles down (900ms, delay 150ms), then the utility placards (300ms delay). The scrim fades in (1200ms). The year digits rise in their cells (800ms, 70ms apart from 380ms). The era words and action placards rise (900ms, delays 650ms and 700ms). The route line draws left to right (1400ms, `cubic-bezier(0.3, 0, 0.2, 1)`, delay 200ms) and each stop lands as the line reaches it (600ms, delay 260ms + position × 1250ms). The marker and credit fade in at 1500ms.
- **Settle-press:** a placard or stop that becomes chosen starts 3px up and settles in 260ms. Its colour cuts; it does not fade.
- **Era dip:** two green leaves close from the top and bottom edges to the horizon (clip-path inset, smoothstep, 0.3s). The year counts from the old era to the new in 380ms with a cubic ease-out. The field holds until the new scene has drawn two frames (1s cap), then opens the same way in 0.3s. The dip sits under the route line and placards, so they stay usable.
- **Route marker and progress:** move to the new stop in 700ms with `--ease`; no transition while dragged.
- **Facts board:** slides in 28px from the right in 420ms (from below, 24px, on narrow screens). Facts follow, 520ms each, 55ms apart from 90ms.
- **Idle fade:** after 7s without input on a mouse device, the utility and action placards fade out over 1400ms. They return in 320ms on any input. They do not fade while hovered, focused, or while the board or menu is open. The sign, era title, route line and credit stay.
- **Reduced motion:** all animations and transitions are off. The era dip is not shown; the era changes at once. The idle fade is off. The load card is removed without a fade.

## Do's and Don'ts

### Do:
- **Do** take colours from the `:root` tokens. Green, cream and ochre must match the sign vector.
- **Do** give every control its own opaque ground: green placard, cream when chosen.
- **Do** put bare text on the scene inside the scrim zone, in cream. Small text needs 4.5:1 and large text 3:1 against the scrim over a white sky; `contrast.test.ts` checks this.
- **Do** keep targets at least 44 × 44px.
- **Do** use the gold 2px outline with 2px offset for focus on every control. Links on the cream board use a green outline.
- **Do** set years in the sign voice at weight 900 with tabular lining numerals in fixed cells.
- **Do** show state with a colour cut plus settle-press.
- **Do** keep every fact's sources on the line beside it, and stamp inferred facts.
- **Do** keep the map credit visible and keyboard-reachable; it is a licence requirement.
- **Do** offset bottom objects with `--rail-h`, `--stack` and `--lift` so they clear the route line at every width.
- **Do** announce era changes and the Recenter button through the polite live regions, and keep the skip link.

### Don't:
- **Don't** use glass: no `backdrop-filter`, no blurred or translucent panels.
- **Don't** add a second accent colour. Ochre is the only accent ground, and only on Facts.
- **Don't** use rounded pills. Radii are 2–4px; only the route marker and stop dots are round.
- **Don't** add a second panel. The facts board is the only one.
- **Don't** use gradients on objects. The only gradients are the green field, the scrim, and edge fade masks.
- **Don't** fade or glide a state colour, and don't slide digits sideways.
- **Don't** shrink the route line on phones; scroll it and centre the chosen stop.
- **Don't** fade the placards on touch devices; a hidden button could take the tap meant to wake it.
- **Don't** add a second typeface or set sentences in the narrow sign voice.
- **Don't** let any motion run under `prefers-reduced-motion: reduce`.
