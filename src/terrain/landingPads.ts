import { crossingGeometry, type XZ } from '../ancon/geometry';
import { sampleField, type WorldFields } from './fields';

/**
 * Flat landing pads (Phase 4a, carry-over from Phase 3): at each ferry shore point the bank becomes a
 * level ramp — flat across, rising gently inland — so the ferry's end boards meet flat ground and the
 * landing meshes sit on it. Pad frame: `a` metres inland from the shore point (negative = into the
 * water), `v` metres to the side. Lengths inferred (L).
 */
export interface LandingPad {
  side: 'east' | 'west';
  /** The ferry's shore point (waterline) on this bank. */
  shore: XZ;
  /** Unit vector pointing inland (away from the river). */
  inland: XZ;
  /** Unit vector = inland turned 90° (world [-inland.z, inland.x]); local +Z of a footprint with yaw padYaw(p). */
  lateral: XZ;
  /** Original ground height 2 m past the pad's inland end (m, ≥ shoreY). */
  hInland: number;
  /**
   * Pad level at the shore (m): PAD.shoreY, or lower on a bank where an apron-less barge docks — its floor
   * boards reach over the pad's end and must stay above it (placementFields.padShoreY). Aprons follow the
   * pad instead (pose.apronRestLift).
   */
  shoreY: number;
}
export const PAD = { length: 16, halfWidth: 5, wet: 4, margin: 6, shoreY: 0.3, wetY: -0.5 } as const;

const smooth = (t: number) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };

export function padFrame(p: LandingPad, x: number, z: number): [number, number] {
  const dx = x - p.shore[0], dz = z - p.shore[1];
  return [dx * p.inland[0] + dz * p.inland[1], dx * p.lateral[0] + dz * p.lateral[1]];
}
export const padPoint = (p: LandingPad, a: number, v: number): [number, number] =>
  [p.shore[0] + p.inland[0] * a + p.lateral[0] * v, p.shore[1] + p.inland[1] * a + p.lateral[1] * v];
/** three.js rotY convention: local +X → (cos, 0, −sin). */
export const padYaw = (p: LandingPad) => Math.atan2(-p.inland[1], p.inland[0]);

/**
 * Pad surface height at `a` (clamped to the pad): level at p.shoreY for the first 1.5 m into the water (the
 * ferry's end rests there), then down to wetY; inland it rises to hInland.
 */
export function padHeight(p: LandingPad, a: number): number {
  if (a <= 0) return p.shoreY + (PAD.wetY - p.shoreY) * smooth((-a - 1.5) / (PAD.wet - 1.5));
  return p.shoreY + (p.hInland - p.shoreY) * smooth(Math.min(a, PAD.length) / PAD.length);
}

/** Both pads from the ferry's crossing geometry on `f` (read before `f` is flattened). */
export function landingPads(f: WorldFields, shoreY: number = PAD.shoreY): [LandingPad, LandingPad] {
  const g = crossingGeometry(f);
  const mk = (side: 'east' | 'west', shore: XZ, inland: XZ): LandingPad => {
    const x = shore[0] + inland[0] * (PAD.length + 2), z = shore[1] + inland[1] * (PAD.length + 2);
    return { side, shore, inland, lateral: [-inland[1], inland[0]], hInland: Math.max(shoreY, sampleField(f, f.height, x, z)), shoreY };
  };
  return [mk('east', g.shoreEast, [-g.dir[0], -g.dir[1]]), mk('west', g.shoreWest, [g.dir[0], g.dir[1]])];
}

/** Blend the pads into `f.height` (full inside, fading out over PAD.margin). Runs once per fields object. */
export function flattenLandings(f: WorldFields, pads: readonly LandingPad[]) {
  if (f.padded) return;
  const { size, cell, minX, minZ } = f.grid, reach = PAD.length + PAD.wet + PAD.margin + PAD.halfWidth;
  for (const p of pads) {
    const i0 = Math.max(0, Math.floor((p.shore[0] - reach - minX) / cell)), i1 = Math.min(size - 1, Math.ceil((p.shore[0] + reach - minX) / cell));
    const j0 = Math.max(0, Math.floor((p.shore[1] - reach - minZ) / cell)), j1 = Math.min(size - 1, Math.ceil((p.shore[1] + reach - minZ) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * size + i, [a, v] = padFrame(p, minX + (i + 0.5) * cell, minZ + (j + 0.5) * cell);
      const out = Math.max(0, -PAD.wet - a, a - PAD.length, Math.abs(v) - PAD.halfWidth);
      if (out >= PAD.margin) continue;
      const w = 1 - smooth(out / PAD.margin), t = padHeight(p, Math.min(PAD.length, Math.max(-PAD.wet, a)));
      f.height[k] += (t - f.height[k]) * w;
      if (f.water[k]) f.waterInfo[k * 4] = Math.min(255, (Math.max(0, -f.height[k]) / 15) * 255);
    }
  }
  f.padded = true;
}
