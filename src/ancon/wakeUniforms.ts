import * as THREE from 'three';
import { createVesselPose, type PoseContext, type VesselPose } from './pose';
import { writeWake } from './wake';
import { WAKE_N, WAKE_SPREAD, WAKE_W0 } from './wakeConstants';

/** Shared with the water material (Water.tsx swaps these objects into the Reflector's uniforms). */
export const wakeUniforms = {
  uWake: { value: new Float32Array(4 * WAKE_N) },
  uHull: { value: new THREE.Vector4() },
  uHullSize: { value: new THREE.Vector3() },
  uWakeOn: { value: 0 },
  /** Hull-local (x min, x max, z min, z max) box around the live trail, spread included; empty (min > max) when docked. */
  uWakeBox: { value: new THREE.Vector4(1, -1, 1, -1) },
};
const scratch = createVesselPose();
export function updateWakeUniforms(pose: VesselPose, ctx: PoseContext) {
  writeWake(pose.clock, ctx, wakeUniforms.uWake.value, scratch);
  wakeUniforms.uHull.value.set(pose.position.x, pose.position.z, Math.cos(pose.yaw), Math.sin(pose.yaw));
  // The hull's own waterline footprint (halfLength, not reach: a raised apron is above the water).
  wakeUniforms.uHullSize.value.set(ctx.layout.halfLength, ctx.layout.halfBeam, Math.abs(pose.speed));
  // The shader only walks the trail inside this box (cost: the water pass runs full-screen at DPR 2).
  const w = wakeUniforms.uWake.value, c = Math.cos(pose.yaw), sn = Math.sin(pose.yaw);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < WAKE_N; i++) {
    // A sample matters if it or a neighbour (the other end of either of its segments) has strength.
    if (w[i * 4 + 3] <= 0 && (i === 0 || w[i * 4 - 1] <= 0) && (i === WAKE_N - 1 || w[i * 4 + 7] <= 0)) continue;
    const dx = w[i * 4] - pose.position.x, dz = w[i * 4 + 1] - pose.position.z;
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
    const r = ctx.layout.halfBeam * WAKE_W0 + w[i * 4 + 2] * WAKE_SPREAD + 2;   // the shader's w + its 2 m cut-off
    x0 = Math.min(x0, lx - r); x1 = Math.max(x1, lx + r); z0 = Math.min(z0, lz - r); z1 = Math.max(z1, lz + r);
  }
  if (x0 > x1) wakeUniforms.uWakeBox.value.set(1, -1, 1, -1); else wakeUniforms.uWakeBox.value.set(x0, x1, z0, z1);
  wakeUniforms.uWakeOn.value = 1;
}
export function clearWakeUniforms() { wakeUniforms.uWakeOn.value = 0; }
