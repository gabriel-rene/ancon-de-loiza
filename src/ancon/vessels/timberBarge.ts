import * as THREE from 'three';
import { cellRng } from '../../vegetation/rng';
import type { DeckLayout, VesselSpec } from '../spec';
import { PartBuilder, tone, WOOD, woodTone, type VesselPart } from './common';

const BOTTOM = -0.3, RAKE = 0.8, SIDE_T = 0.06;

/**
 * Colonial / early-1900s ancón de pasaje: a flat-bottomed plank scow, no aprons — its raked bow
 * noses onto the bank (APRON = 0). Hull ends (gunwale caps, top strake, transom tops) reach exactly
 * x = ±halfLength, the point dockPoint() assumes.
 */
export function buildTimberBarge(spec: VesselSpec, L: DeckLayout, seed: number): VesselPart[] {
  const r = cellRng(seed, 1, 703), hl = L.halfLength, hb = L.halfBeam, floor = L.deckY, top = floor + 0.45;
  const wood = new PartBuilder(), iron = new PartBuilder();
  /** |x| of the raked hull end at height y. */
  const xAt = (y: number) => hl - (RAKE * (top - y)) / (top - BOTTOM);
  // Bottom (tarred).
  wood.box([2 * xAt(BOTTOM), SIDE_T, 2 * hb - 2 * SIDE_T], [0, BOTTOM + SIDE_T / 2, 0], WOOD.tar);
  // Sides: three strakes, each a trapezoid following the rake, tar below the waterline.
  const sh = (top - BOTTOM) / 3;
  for (const sz of [-1, 1]) for (let k = 0; k < 3; k++) {
    const y0 = BOTTOM + k * sh, y1 = y0 + sh;
    const shape = new THREE.Shape([new THREE.Vector2(-xAt(y0), y0), new THREE.Vector2(xAt(y0), y0), new THREE.Vector2(xAt(y1), y1), new THREE.Vector2(-xAt(y1), y1)]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: SIDE_T, bevelEnabled: false }).translate(0, 0, sz > 0 ? hb - SIDE_T : -hb);
    wood.add(g, (y0 + y1) / 2 < 0.05 ? WOOD.tar : tone(WOOD.strake, WOOD.dark, WOOD.bleach, r, 0.16));
  }
  // Raked end panels (transoms) from the bottom edge up to the gunwale at x = ±hl.
  const rakeLen = Math.hypot(RAKE, top - BOTTOM), ang = Math.atan2(top - BOTTOM, RAKE);
  for (const sx of [-1, 1]) wood.box([rakeLen, SIDE_T, 2 * hb - 2 * SIDE_T], [sx * (hl - RAKE / 2), (top + BOTTOM) / 2, 0], WOOD.tar, sx * ang);
  // Floorboards, ribs, gunwale caps, tholes.
  const nf = Math.floor((2 * hb - 0.3) / 0.22);
  for (let i = 0; i < nf; i++) wood.box([2 * (hl - 0.45), 0.04, 0.2], [0, floor - 0.02, -hb + 0.15 + (i + 0.5) * 0.22], woodTone(r));
  for (let x = -(hl - RAKE) + 0.35; x <= hl - RAKE - 0.35 + 1e-9; x += 0.7) for (const sz of [-1, 1])
    wood.box([0.06, top - floor, 0.08], [x, (top + floor) / 2, sz * (hb - SIDE_T - 0.04)], WOOD.dark);
  for (const sz of [-1, 1]) wood.box([2 * hl, 0.05, 0.1], [0, top + 0.025, sz * (hb - 0.05)], WOOD.dark);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wood.cylinder(0.03, 0.03, 0.25, [sx * (hl - 0.25), top + 0.175, sz * (hb - 0.05)], WOOD.dark, 'y', 6);
  // Lombera (1840s): a cleat amidships on each gunwale; RopeSet ties the shore rope to the upstream one.
  if (spec.shoreRope) for (const sz of [-1, 1]) {
    iron.box([0.3, 0.06, 0.08], [0, top + 0.13, sz * (hb - 0.05)], WOOD.iron);
    for (const dx of [-0.1, 0.1]) iron.box([0.06, 0.1, 0.06], [dx, top + 0.05, sz * (hb - 0.05)], WOOD.iron);
  }
  const parts: VesselPart[] = [{ material: 'wood', geometry: wood.build() }];
  if (!iron.empty) parts.push({ material: 'iron', geometry: iron.build() });
  return parts;
}
