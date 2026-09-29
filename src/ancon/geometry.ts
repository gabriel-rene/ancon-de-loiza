import { landmarkXZ } from '../data/landmarks';
import { WATER, type WorldFields } from '../terrain/fields';

export type XZ = readonly [number, number];
export interface CrossingGeometry {
  /** Landing coordinates (research §1.1), projected. They lie on land, some way from the water. */
  east: XZ; west: XZ;
  /** The river waterline nearest each landing coordinate (depends on the era's bankOffset). The crossing runs between them. */
  shoreEast: XZ; shoreWest: XZ;
  /** Unit vector shoreEast → shoreWest (= vessel-local +X). */
  dir: XZ;
  /** Shore-to-shore distance, m. */
  span: number;
  /** Rotation about +Y that takes local +X onto `dir` (three.js convention: +X → (cos, 0, −sin)). */
  yaw: number;
}
/** The docked apron tip (or barge bow) rests this far onto the bank. */
export const APRON_REST = 0.8;
/** Docked, an apron's underside sits this far above the landing surface, at its tip and at its hinge (m). */
export const APRON_GAP = 0.01;
/** Docked, an apron-less barge's floor boards stand this far above the pad at its end (m). */
export const BARGE_CLEAR = 0.04;
/** Each landing clearing is centred this far inland of its shore point: docked hull, bank posts and the ride camera then all fall inside LANDING_CLEARING[0]. */
export const CLEAR_INLAND = 6;
const SEARCH = 150, STEP = 0.25;

/** Water class at a world point (WATER.LAND outside the grid). */
export function waterAt(f: WorldFields, x: number, z: number): number {
  const g = f.grid, i = Math.floor((x - g.minX) / g.cell), j = Math.floor((z - g.minZ) / g.cell);
  return i >= 0 && j >= 0 && i < g.size && j < g.size ? f.water[j * g.size + i] : WATER.LAND;
}

/** The river waterline nearest `p`: the nearest RIVER cell centre within 150 m, then walk from it toward `p` to the last river sample. */
export function nearestShore(f: WorldFields, p: XZ): XZ {
  const g = f.grid, r = Math.ceil(SEARCH / g.cell);
  const ci = Math.floor((p[0] - g.minX) / g.cell), cj = Math.floor((p[1] - g.minZ) / g.cell);
  let best = Infinity, bx = 0, bz = 0;
  for (let j = Math.max(0, cj - r); j <= Math.min(g.size - 1, cj + r); j++) for (let i = Math.max(0, ci - r); i <= Math.min(g.size - 1, ci + r); i++) {
    if (f.water[j * g.size + i] !== WATER.RIVER) continue;
    const x = g.minX + (i + 0.5) * g.cell, z = g.minZ + (j + 0.5) * g.cell, d = Math.hypot(x - p[0], z - p[1]);
    if (d < best) { best = d; bx = x; bz = z; }
  }
  if (best === Infinity) throw new Error(`no river within ${SEARCH} m of ${p}`);
  const ux = (p[0] - bx) / best, uz = (p[1] - bz) / best;
  let s = 0;
  while (s + STEP <= best && waterAt(f, bx + ux * (s + STEP), bz + uz * (s + STEP)) === WATER.RIVER) s += STEP;
  return [bx + ux * s, bz + uz * s];
}

/** Compute from the fixed 512 placement fields (terrain/placementFields.ts), never the tier's grid. */
export function crossingGeometry(f: WorldFields): CrossingGeometry {
  const east = landmarkXZ('eastLanding'), west = landmarkXZ('westLanding');
  const shoreEast = nearestShore(f, east), shoreWest = nearestShore(f, west);
  const span = Math.hypot(shoreWest[0] - shoreEast[0], shoreWest[1] - shoreEast[1]);
  const dir: XZ = [(shoreWest[0] - shoreEast[0]) / span, (shoreWest[1] - shoreEast[1]) / span];
  return { east, west, shoreEast, shoreWest, dir, span, yaw: Math.atan2(-dir[1], dir[0]) };
}

/** Vessel centre (XZ) when docked on `side`, its end (apron tip) `APRON_REST` m onto the bank. */
export function dockPoint(g: CrossingGeometry, side: 'east' | 'west', reach: number): XZ {
  const s = side === 'east' ? g.shoreEast : g.shoreWest, k = (side === 'east' ? 1 : -1) * (reach - APRON_REST);
  return [s[0] + g.dir[0] * k, s[1] + g.dir[1] * k];
}

/** Centres of the two landing clearings (vegetation masks), CLEAR_INLAND m inland of each shore point. */
export function landingClearings(g: CrossingGeometry): [XZ, XZ] {
  return [
    [g.shoreEast[0] - g.dir[0] * CLEAR_INLAND, g.shoreEast[1] - g.dir[1] * CLEAR_INLAND],
    [g.shoreWest[0] + g.dir[0] * CLEAR_INLAND, g.shoreWest[1] + g.dir[1] * CLEAR_INLAND],
  ];
}
