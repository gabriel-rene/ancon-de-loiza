import * as THREE from 'three';
import { CROSSING_TIMINGS, legDuration, type CrossingTimings } from './crossing';
import { smooth as sm } from './ease';
import type { VesselPose } from './pose';
import type { DeckLayout } from './spec';

/** Third-person deck camera: behind the trailing end, raised, a little to one side, looking over the crew ahead. */
export const RIDE = { back: 8, up: 4.2, side: 2.6, ahead: 22, lookY: 0.4, minClear: 1.8 };

/** Orbit angle about the deck: π·(legs done), easing half a turn across unload + the next load. */
export function rideYaw(clock: number, moored: boolean, T: CrossingTimings = CROSSING_TIMINGS): number {
  if (moored) return 0;
  const L = legDuration(T), U = T.unload, W = T.unload + T.load;
  const k = Math.floor(clock / L), tau = clock - k * L;
  if (tau < T.load) return Math.PI * (k - 1) + Math.PI * sm((tau + U) / W);
  if (tau > L - U) return Math.PI * k + Math.PI * sm((tau - (L - U)) / W);
  return Math.PI * k;
}

export function clampAboveGround(pos: THREE.Vector3, groundAt: (x: number, z: number) => number) {
  pos.y = Math.max(pos.y, groundAt(pos.x, pos.z) + RIDE.minClear);
}

/** The ride view for this pose, orbited by `yaw` about the deck's vertical axis. */
export function rideView(pose: VesselPose, L: DeckLayout, yaw: number, pos: THREE.Vector3, target: THREE.Vector3, groundAt?: (x: number, z: number) => number) {
  const c = Math.cos(yaw), s = Math.sin(yaw), bx = -(L.reach + RIDE.back), bz = RIDE.side;
  pos.set(bx * c + bz * s, L.deckY + RIDE.up, -bx * s + bz * c).applyMatrix4(pose.matrix);
  target.set(RIDE.ahead * c, RIDE.lookY, -RIDE.ahead * s).applyMatrix4(pose.matrix);
  if (groundAt) clampAboveGround(pos, groundAt);
}

const inv = new THREE.Matrix4(), rot = new THREE.Matrix4();
/** Move pos/target rigidly from the vessel's previous frame to the next, adding the scheduled orbit dYaw. */
export function carryCamera(prev: THREE.Matrix4, next: THREE.Matrix4, dYaw: number, pos: THREE.Vector3, target: THREE.Vector3) {
  inv.copy(prev).invert();
  pos.applyMatrix4(inv); target.applyMatrix4(inv);
  if (dYaw !== 0) { rot.makeRotationY(dYaw); pos.applyMatrix4(rot); target.applyMatrix4(rot); }
  pos.applyMatrix4(next); target.applyMatrix4(next);
}
