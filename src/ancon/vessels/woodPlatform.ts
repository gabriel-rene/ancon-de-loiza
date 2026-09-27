import { cellRng } from '../../vegetation/rng';
import type { DeckLayout, VesselSpec } from '../spec';
import { PartBuilder, plankApron, WOOD, woodTone, type VesselPart } from './common';

const PLANK_W = 0.25, GAP = 0.012, PLANK_T = 0.06, DRAFT = 0.45, STRINGER_H = 0.18;

/** Wooden platform on stringers over a tarred pontoon hull, hinged plank aprons at both ends (research §2.2). */
export function buildWoodPlatform(spec: VesselSpec, L: DeckLayout, seed: number): VesselPart[] {
  const r = cellRng(seed, 3, 701), hl = L.halfLength, hb = L.halfBeam, top = L.deckY;
  const wood = new PartBuilder(), iron = new PartBuilder();
  const hullTop = top - PLANK_T - STRINGER_H;
  // Pontoon hull (tarred), shorter than the deck, with raked end blocks.
  wood.box([2 * hl - 1.2, hullTop + DRAFT, 2 * hb - 0.3], [0, (hullTop - DRAFT) / 2, 0], WOOD.tar);
  for (const sx of [-1, 1]) wood.box([0.8, (hullTop + DRAFT) * 0.8, 2 * hb - 0.3], [sx * (hl - 0.75), hullTop - (hullTop + DRAFT) * 0.4, 0], WOOD.tar, sx * 0.55);
  // Longitudinal stringers under the planks, visible along the sides.
  const nStr = Math.max(3, Math.round((2 * hb) / 1.1));
  for (let i = 0; i < nStr; i++) {
    const z = -hb + 0.12 + (i * (2 * hb - 0.24)) / (nStr - 1);
    wood.box([2 * hl, STRINGER_H, 0.2], [0, hullTop + STRINGER_H / 2, z], woodTone(r, 0.6));
  }
  // Transverse deck planks with gaps and slight height/tone variation.
  const n = Math.floor((2 * hl) / PLANK_W);
  for (let i = 0; i < n; i++) {
    const t = PLANK_T * (0.9 + 0.2 * r());
    wood.box([PLANK_W - GAP, t, 2 * hb - 0.02 * r()], [-hl + (i + 0.5) * PLANK_W, top - PLANK_T + t / 2, 0], woodTone(r));
  }
  // Rub rails and corner bitts.
  for (const sz of [-1, 1]) wood.box([2 * hl, 0.14, 0.1], [0, top - 0.06, sz * (hb + 0.03)], WOOD.dark);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wood.box([0.16, 0.5, 0.16], [sx * (hl - 0.3), top + 0.25, sz * (hb - 0.25)], WOOD.dark);
  // Rope guides: a post pair around each rope line with an iron roller; the rope rests on the roller top at guideY.
  if (spec.propulsion === 'ropes') for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const dz of [0.16, -0.16]) wood.box([0.14, L.guideY - top + 0.05, 0.14], [sx * (hl - 0.3), (top + L.guideY) / 2, sz * L.ropeZ + dz], WOOD.dark);
    iron.cylinder(0.07, 0.07, 0.34, [sx * (hl - 0.3), L.guideY - 0.07, sz * L.ropeZ], WOOD.iron, 'z', 10);
  }
  const parts: VesselPart[] = [{ material: 'wood', geometry: wood.build() }];
  if (!iron.empty) parts.push({ material: 'iron', geometry: iron.build() });
  for (const end of [-1, 1] as const) parts.push(plankApron(end, L, r, { plankW: PLANK_W, gap: GAP, thick: PLANK_T, beams: true }));
  return parts;
}
