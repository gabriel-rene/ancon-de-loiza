import { cellRng } from '../../vegetation/rng';
import type { DeckLayout, VesselSpec } from '../spec';
import { PartBuilder, plankApron, WOOD, woodTone, type VesselPart } from './common';

const PLANK_W = 0.28, GAP = 0.02, PLANK_T = 0.06, BOTTOM = -0.3, LOG_R = 0.14;

/** 1920s Cortijo platform: rough planks on three log stringers over a shallow tarred scow, single-plank aprons, no rails. */
export function buildPlankPlatform(spec: VesselSpec, L: DeckLayout, seed: number): VesselPart[] {
  void spec;
  const r = cellRng(seed, 2, 704), hl = L.halfLength, hb = L.halfBeam, top = L.deckY;
  const wood = new PartBuilder();
  const scowTop = top - PLANK_T - 2 * LOG_R;
  wood.box([2 * hl - 0.8, scowTop - BOTTOM, 2 * hb - 0.3], [0, (scowTop + BOTTOM) / 2, 0], WOOD.tar);
  for (const sx of [-1, 1]) wood.box([0.5, (scowTop - BOTTOM) * 0.8, 2 * hb - 0.3], [sx * (hl - 0.55), (scowTop + BOTTOM) / 2, 0], WOOD.tar, sx * 0.4);
  for (const z of [-hb + 0.4, 0, hb - 0.4]) wood.cylinder(LOG_R, LOG_R, 2 * hl - 0.2, [0, top - PLANK_T - LOG_R, z], woodTone(r, 0.6), 'x', 8);
  const n = Math.floor((2 * hl) / PLANK_W);
  for (let i = 0; i < n; i++) {
    const t = PLANK_T * (0.85 + 0.3 * r()), len = 2 * hb - 0.1 + 0.2 * r();
    wood.box([PLANK_W - GAP, t, len], [-hl + (i + 0.5) * PLANK_W, top - t / 2, (r() - 0.5) * 0.1], woodTone(r));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wood.box([0.14, 0.45, 0.14], [sx * (hl - 0.25), top + 0.225, sz * (hb - 0.25)], WOOD.dark);
  const parts: VesselPart[] = [{ material: 'wood', geometry: wood.build() }];
  for (const end of [-1, 1] as const) parts.push(plankApron(end, L, r, { plankW: PLANK_W, gap: GAP, thick: PLANK_T, beams: false }));
  return parts;
}
