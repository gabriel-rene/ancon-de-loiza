// src/ancon/rigging.ts
import { RIVER_DIR } from '../geo/constants';
import { sampleField, WATER, type WorldFields } from '../terrain/fields';
import { waterAt, type CrossingGeometry, type XZ } from './geometry';
import type { V3 } from './rope';
import type { DeckLayout } from './spec';
import { BITT_H, bittXZ } from './vessels/common';

/** Bank posts stand this far inland of the waterline (snapped further inland onto land if needed), rope eye POST_H above the ground (inferred). */
export const POST_BACK = 4, POST_H = 1.1;
const SNAP_STEP = 0.5, SNAP_MAX = 20;
export interface RopeRig { east: [V3, V3]; west: [V3, V3] }
/** World XZ direction of vessel-local +Z. */
export const lateral = (g: CrossingGeometry): XZ => [-g.dir[1], g.dir[0]];
/** +1 when local +Z points upstream. */
export const upstreamSide = (g: CrossingGeometry): 1 | -1 => {
  const n = lateral(g);
  return -(n[0] * RIVER_DIR[0] + n[1] * RIVER_DIR[1]) >= 0 ? 1 : -1;
};
/** A post at (x, z), moved inland along (ix, iz) in 0.5 m steps until it stands on land. */
function post(f: WorldFields, x: number, z: number, ix: number, iz: number): V3 {
  for (let s = 0; s <= SNAP_MAX && waterAt(f, x, z) !== WATER.LAND; s += SNAP_STEP) { x += ix * SNAP_STEP; z += iz * SNAP_STEP; }
  return [x, sampleField(f, f.height, x, z) + POST_H, z];
}

/** Two bank posts per shore, one per rope line (line 0 on local +Z, line 1 on −Z). */
export function ropeRig(g: CrossingGeometry, L: DeckLayout, f: WorldFields): RopeRig {
  const n = lateral(g);
  const at = (s: XZ, inland: number, zo: number) =>
    post(f, s[0] + g.dir[0] * inland + n[0] * zo, s[1] + g.dir[1] * inland + n[1] * zo, g.dir[0] * Math.sign(inland), g.dir[1] * Math.sign(inland));
  return {
    east: [at(g.shoreEast, -POST_BACK, L.ropeZ), at(g.shoreEast, -POST_BACK, -L.ropeZ)],
    west: [at(g.shoreWest, POST_BACK, L.ropeZ), at(g.shoreWest, POST_BACK, -L.ropeZ)],
  };
}
/** 1840s Lombera inset: one post on the Loíza bank, 3 m to the upstream side of the line. */
export function shoreRopePost(g: CrossingGeometry, f: WorldFields): V3 {
  const n = lateral(g), k = upstreamSide(g) * 3;
  return post(f, g.shoreEast[0] - g.dir[0] * POST_BACK + n[0] * k, g.shoreEast[1] - g.dir[1] * POST_BACK + n[1] * k, -g.dir[0], -g.dir[1]);
}
const set3 = (o: V3, x: number, y: number, z: number) => { o[0] = x; o[1] = y; o[2] = z; return o; };
/** Deck-local point where rope `line` crosses the guide roller at `end` (writes into `out`). */
export const guideLocal = (L: DeckLayout, end: 1 | -1, line: 0 | 1, out: V3): V3 => set3(out, end * (L.halfLength - 0.3), L.guideY, (line === 0 ? 1 : -1) * L.ropeZ);
/** 1986: a mooring line leaves the top of the east bitt on `line`'s side (bittXZ, BITT_H — the steel builder puts the bitt there). */
export const mooringLocal = (L: DeckLayout, line: 0 | 1, out: V3): V3 => {
  const [x, z] = bittXZ(L, -1, line === 0 ? 1 : -1);
  return set3(out, x, L.deckY + BITT_H, z);
};
/** 1840: the shore rope ties to the gunwale cleat amidships on `side`. */
export const cleatLocal = (L: DeckLayout, side: 1 | -1, out: V3): V3 => set3(out, 0, L.deckY + 0.5, side * L.halfBeam);
