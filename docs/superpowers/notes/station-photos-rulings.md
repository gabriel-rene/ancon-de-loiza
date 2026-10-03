# Station from the family photos (2026-10-03)

The user shared four 1970s–80s photos of the east landing. The 1975–86 station now follows them.
Shots: `tests/snapshots/station-photos/` (`before-*` = main at `340a149`; `close-*` use a temporary
camera that is not in the app).

## What the photos show, and what the sim does

| Photo detail | Sim |
| --- | --- |
| Bar Restaurant El Ancón: long, low, on a stone river wall | `bar()` in `station.ts`, downstream of the ramp, along the bank |
| Open dining room: maroon half-wall, wooden posts, open above | Downstream part; "BAR RESTAURANT. EL ANCON Mariscos HIELO" painted on the river face |
| Closed room: cream over maroon, dark doors, "BAR REST. EL ANCON", "HIELO" | Part next to the ramp; lettering on the river face and the ramp-side end |
| One rusty zinc shed roof, low to the river | One roof over both parts, rust-tinted |
| Steel canopy over the end of the road, red trusses, thick white columns | `canopy()`, over the top of the ramp, posts beside it; 1984–86 only (user's choice "A") |
| "El ANCON de LOIZA" sign | `docs/assets/el-ancon-de-loiza-sign.svg`, both faces; on the bar roof in 1975 (photo 1), on the canopy from 1984 (photos 2, 4) |
| "PASEOS FINES DE SEMANA" board under the canopy | Hanging board, both faces |
| Casa Cortijo across the street: orange-red yard wall, white pillars, striped awning, roof room | `casaCortijo()`, upstream of the ramp; its front faces the street that runs past it down to the ramp (louvred window inland, porch toward the river, wire gate inland, red iron gate at the river end); the wooden house of 1925–59 stands on the same lot |

## Rulings

- The Casa Cortijo is the house across the street (user, 2026-10-03), not part of the bar.
- The canopy appears from 1984: photo 4 shows the bridge behind it; photo 2 shows a 1980s car. New look
  `concreteCanopy` in `eras.ts`.
- Left out: interiors, people, cars, wires, palm-frond curtains, the 7up logos (the SVG has plain green panels).
- The canopy is 8 m deep so its river-side posts stand beside the `shore` view's eye, not in front of it.
- The house first faced away from the ramp; user ruling (2026-10-03): it faces the street, as in photo 4. A street's
  width (≥ 4.5 m, painted as trodden dirt) runs between its yard wall and the canopy.
- The neighbour's house (1935–75) moved upstream by the water, so the Cortijo lot stays free.
- Lettering is one new `sign` material (one atlas, `signAtlas.ts`): one more draw call in 1975–86.
