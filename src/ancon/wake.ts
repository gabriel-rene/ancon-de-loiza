import { computeVesselPose, type PoseContext, type VesselPose } from './pose';
import { WAKE_DT, WAKE_N, WAKE_REF } from './wakeConstants';

export { WAKE_DT, WAKE_N, WAKE_REF, WAKE_SPREAD, WAKE_W0 } from './wakeConstants';

/**
 * Trailing-end track: [x, z, age s, strength 0..1] × WAKE_N; sample i is the trailing end i·WAKE_DT s ago.
 * Strength = |speed| / WAKE_REF, faded by the *current* state (× (1 − slack)): exactly 0 whenever the
 * ferry is docked (slack = 1 in load/unload and for the moored barge), easing in at cast-off and out
 * while docking. Pure: recomputes past poses into `scratch` (sample 0 is the current pose); no allocation.
 */
export function writeWake(clock: number, ctx: PoseContext, out: Float32Array, scratch: VesselPose): Float32Array {
  let live = 0;
  for (let i = 0; i < WAKE_N; i++) {
    const p = computeVesselPose(clock - i * WAKE_DT, ctx, scratch), r = ctx.layout.reach * p.travel;
    if (i === 0) live = 1 - p.state.slack;   // sample 0 is the pose now
    out[i * 4] = p.position.x - Math.cos(p.yaw) * r;
    out[i * 4 + 1] = p.position.z + Math.sin(p.yaw) * r;
    out[i * 4 + 2] = i * WAKE_DT;
    out[i * 4 + 3] = Math.min(1, Math.abs(p.speed) / WAKE_REF) * live;
  }
  return out;
}
