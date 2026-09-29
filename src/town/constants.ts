import type { XZ } from '../data/geo/types';
import { landmarkXZ } from '../data/landmarks';

/** Spec 4b §1.1: only outlines within CIRCLE_R metres of the east landing are used (the bake keeps only these). */
export const CIRCLE_R = 350;
export const TOWN_CENTRE: XZ = landmarkXZ('eastLanding');
/** Does a polyline touch the town circle? */
export const inTownCircle = (points: readonly XZ[]) =>
  points.some(([x, z]) => Math.hypot(x - TOWN_CENTRE[0], z - TOWN_CENTRE[1]) <= CIRCLE_R);
/** The pieces of a polyline inside the town circle; segments are cut exactly at the circle's edge. */
export function clipToCircle(points: readonly XZ[]): XZ[][] {
  const [cx, cz] = TOWN_CENTRE, out: XZ[][] = [];
  let cur: XZ[] = [];
  const flush = () => { if (cur.length >= 2) out.push(cur); cur = []; };
  for (let k = 0; k + 1 < points.length; k++) {
    const a = points[k], b = points[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], ax = a[0] - cx, az = a[1] - cz;
    const A = dx * dx + dz * dz, B = 2 * (dx * ax + dz * az), C = ax * ax + az * az - CIRCLE_R * CIRCLE_R, disc = B * B - 4 * A * C;
    if (A === 0 || disc <= 0) { flush(); continue; }
    const lo = Math.max(0, (-B - Math.sqrt(disc)) / (2 * A)), hi = Math.min(1, (-B + Math.sqrt(disc)) / (2 * A));
    if (lo >= hi) { flush(); continue; }
    if (lo > 0) { flush(); cur.push([a[0] + lo * dx, a[1] + lo * dz]); } else if (!cur.length) cur.push(a);
    cur.push(hi < 1 ? [a[0] + hi * dx, a[1] + hi * dz] : b);
    if (hi < 1) flush();
  }
  flush();
  return out;
}
