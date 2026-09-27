import { computeVesselPose, type PoseContext, type VesselPose } from './pose';

export const WAKE_N = 16, WAKE_DT = 1.5;
/** Speed (m/s) that draws a full-strength wake: the cruise on the 122–138 m dock-to-dock line is ≈ 1.0–1.1 m/s. */
export const WAKE_REF = 1.1;
/** Trail half-width in the water shader: WAKE_W0 · half-beam + WAKE_SPREAD · age (≈ the Kelvin angle at 1 m/s). Keep in sync with vesselWake(). */
export const WAKE_W0 = 0.6, WAKE_SPREAD = 0.35;
/**
 * Trailing-end track: [x, z, age s, strength 0..1] × WAKE_N; sample i is the trailing end i·WAKE_DT s ago.
 * Strength = |speed| / WAKE_REF, faded by the *current* state (× (1 − slack)): exactly 0 whenever the
 * ferry is docked (slack = 1 in load/unload and for the moored barge), easing in at cast-off and out
 * while docking. Pure: recomputes past poses into `scratch`; no allocation.
 */
export function writeWake(clock: number, ctx: PoseContext, out: Float32Array, scratch: VesselPose): Float32Array {
  const live = 1 - computeVesselPose(clock, ctx, scratch).state.slack;
  for (let i = 0; i < WAKE_N; i++) {
    const p = computeVesselPose(clock - i * WAKE_DT, ctx, scratch), r = ctx.layout.reach * p.travel;
    out[i * 4] = p.position.x - Math.cos(p.yaw) * r;
    out[i * 4 + 1] = p.position.z + Math.sin(p.yaw) * r;
    out[i * 4 + 2] = i * WAKE_DT;
    out[i * 4 + 3] = Math.min(1, Math.abs(p.speed) / WAKE_REF) * live;
  }
  return out;
}
