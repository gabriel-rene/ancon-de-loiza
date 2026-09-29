import type { XZ } from '../data/geo/types';
import { landmarkXZ } from '../data/landmarks';

/** Spec 4b §1.1: only outlines within CIRCLE_R metres of the east landing are used (the bake keeps only these). */
export const CIRCLE_R = 350;
export const TOWN_CENTRE: XZ = landmarkXZ('eastLanding');
/** Does a polyline touch the town circle? */
export const inTownCircle = (points: readonly XZ[]) =>
  points.some(([x, z]) => Math.hypot(x - TOWN_CENTRE[0], z - TOWN_CENTRE[1]) <= CIRCLE_R);
