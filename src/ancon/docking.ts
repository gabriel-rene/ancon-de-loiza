import type { LandingLook } from '../data/eras';
import { landingTop } from '../infrastructure/landing';
import type { LandingPad } from '../terrain/landingPads';
import { APRON_GAP, APRON_REST } from './geometry';
import { APRON_REST_RANGE } from './pose';
import type { VesselPart } from './vessels/common';

/** A hinged apron's docked contact: its tip's lowest edge (hinge-relative) and the landing height under it. */
export interface ApronRest {
  /** Hinge height (local y) and tip x (local, signed). */
  hy: number; xTip: number;
  /** Tip underside, hinge-relative: u metres out from the hinge, dy below it; R, beta its polar form. */
  R: number; beta: number;
  /** Landing surface under the tip + APRON_GAP (world y). */
  restY: number;
}

/**
 * For each apron part (undefined for the rest): where its tip must rest when docked — on the landing at its
 * end (east pad for end −1, west for +1), whatever the pad's level and the vessel's freeboard.
 */
export function apronRests(parts: readonly VesselPart[], pads: readonly [LandingPad, LandingPad], look: LandingLook): (ApronRest | undefined)[] {
  return parts.map((p) => {
    if (!p.apron) return undefined;
    const { end, hinge: [hx, hy] } = p.apron, pos = p.geometry.attributes.position;
    let u = -Infinity, dy = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const ui = end * (pos.getX(i) - hx), di = pos.getY(i) - hy;
      if (ui > u + 1e-4) { u = ui; dy = di; } else if (ui > u - 1e-4 && di < dy) dy = di;
    }
    return { hy, xTip: hx + end * u, R: Math.hypot(u, dy), beta: Math.atan2(dy, u), restY: landingTop(pads[end === -1 ? 0 : 1], look, APRON_REST) + APRON_GAP };
  });
}

/**
 * Docked apron angle (rad, + raised, as apronLift) that puts the tip's underside on the landing for the
 * vessel's current heave and pitch: tip local y = hy + u·sin(l) + dy·cos(l) = R·sin(l + beta). Allocation-free.
 */
export function restLift(r: ApronRest, heave: number, pitch: number): number {
  const t = r.restY - heave - r.xTip * Math.sin(pitch) - r.hy;
  const l = Math.asin(Math.min(1, Math.max(-1, t / r.R))) - r.beta;
  return Math.min(APRON_REST_RANGE[1], Math.max(APRON_REST_RANGE[0], l));
}
