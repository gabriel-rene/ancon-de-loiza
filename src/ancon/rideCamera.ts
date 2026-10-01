import * as THREE from 'three';
import { CROSSING_TIMINGS, legDuration, type CrossingTimings } from './crossing';
import { WATER_Y } from '../geo/constants';
import { clamp01, smooth as sm } from './ease';
import type { PoseContext, VesselPose } from './pose';
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

/**
 * User orbit while riding. A drag orbits about the pivot — the point of the canonical sightline over the
 * deck centre, so the view direction is unchanged at rest and the deck stays in frame however it is turned.
 * Polar angles are measured from +Y (camera-controls convention); scale is the pivot distance factor.
 * The offset stays where the visitor leaves it; recenter() glides it back (spec 6a §4.2).
 */
export const RIDE_ORBIT = {
  // The steepest, widest drag stays a raised deck view (≤ ~20 m up), never a top-down aerial.
  minPolar: 0.33 * Math.PI, maxPolar: 0.478 * Math.PI, minScale: 0.6, maxScale: 1.7,
  /** Camera floor above the water surface (the terrain field is the riverbed mid-river). */
  waterClear: 1.5,
  /** Recenter glide time constant (s). */
  recenterTau: 0.25,
  /** Offset (rad, or log-scale) past which the view counts as turned away from the front (shows Recenter). */
  frontEps: 0.02,
};

/** Keep the camera above the water surface and the bank. Writes `out` (may be `pos`). */
export function clampForRender(pos: THREE.Vector3, out: THREE.Vector3, groundAt?: (x: number, z: number) => number) {
  out.copy(pos);
  out.y = Math.max(out.y, WATER_Y + RIDE_ORBIT.waterClear);
  if (groundAt) clampAboveGround(out, groundAt);
  return out;
}

const _c = new THREE.Vector3(), _d = new THREE.Vector3();
/** The point of the sightline pos→target nearest the deck centre (the orbit pivot). */
export function ridePivot(pose: VesselPose, L: DeckLayout, pos: THREE.Vector3, target: THREE.Vector3, out: THREE.Vector3) {
  _c.set(0, L.deckY, 0).applyMatrix4(pose.matrix);
  _d.subVectors(target, pos);
  const t = clamp01(_c.sub(pos).dot(_d) / _d.lengthSq());
  return out.copy(pos).addScaledVector(_d, t);
}

export interface RideOrbit { az: number; pol: number; logScale: number }
export const wrapPi = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

/**
 * The ride camera's per-frame state, kept apart from what is rendered: `pos`/`target` are always the
 * canonical rideView of this frame's pose (never read back, so nothing accumulates); `orbit` holds the
 * user's offset; `eye` = orbit applied about `pivot`, clamped above water and bank for rendering only.
 * Allocation-free per frame.
 */
export class RideRig {
  readonly orbit: RideOrbit = { az: 0, pol: 0, logScale: 0 };
  readonly pos = new THREE.Vector3(); readonly target = new THREE.Vector3();
  readonly pivot = new THREE.Vector3(); readonly eye = new THREE.Vector3();
  private readonly sph = new THREE.Spherical(); private readonly last = new THREE.Spherical();
  private readonly v = new THREE.Vector3();
  private has = false;
  private returning = false;

  /** Glide the user's offset back to the front framing; `instant` (reduced motion) snaps. New input cancels it. */
  recenter(instant: boolean) {
    if (instant) { this.orbit.az = 0; this.orbit.pol = 0; this.orbit.logScale = 0; this.returning = false; }
    else this.returning = true;
  }

  /** True when the offset is past RIDE_ORBIT.frontEps (shows Recenter). */
  get offFront() {
    const o = this.orbit, e = RIDE_ORBIT.frontEps;
    return Math.abs(wrapPi(o.az)) > e || Math.abs(o.pol) > e || Math.abs(o.logScale) > e;
  }

  /**
   * One frame. `userEye`/`userTarget`: where the controls hold the camera now (after this frame's pointer
   * input), or null; the change since the last frame's `eye`/`pivot` is the user's orbit. `dt`: real seconds.
   */
  frame(pose: VesselPose, ctx: PoseContext, userEye: THREE.Vector3 | null, userTarget: THREE.Vector3 | null, dragging: boolean, dt: number) {
    const o = this.orbit, R = RIDE_ORBIT;
    let input = dragging;
    if (this.has && userEye && userTarget) {
      this.sph.setFromVector3(this.v.subVectors(userEye, userTarget));
      const dAz = wrapPi(this.sph.theta - this.last.theta), dPol = this.sph.phi - this.last.phi;
      const dS = Math.log(Math.max(this.sph.radius, 1e-6) / Math.max(this.last.radius, 1e-6));
      if (Math.abs(dAz) + Math.abs(dPol) + Math.abs(dS) > 1e-7) { o.az += dAz; o.pol += dPol; o.logScale += dS; input = true; }
    }
    if (input) this.returning = false;
    if (this.returning) {
      const k = Math.exp(-dt / R.recenterTau);
      o.az = wrapPi(o.az) * k; o.pol *= k; o.logScale *= k;
      if (Math.abs(o.az) + Math.abs(o.pol) + Math.abs(o.logScale) < 1e-4) { o.az = 0; o.pol = 0; o.logScale = 0; this.returning = false; }
    }
    rideView(pose, ctx.layout, rideYaw(pose.clock, ctx.spec.moored, ctx.spec.timings), this.pos, this.target);
    ridePivot(pose, ctx.layout, this.pos, this.target, this.pivot);
    // Orbit about the pivot, limits applied to the stored offset so a drag past them does not wind up.
    this.sph.setFromVector3(this.v.subVectors(this.pos, this.pivot));
    o.pol = Math.min(R.maxPolar, Math.max(R.minPolar, this.sph.phi + o.pol)) - this.sph.phi;
    o.logScale = Math.min(Math.log(R.maxScale), Math.max(Math.log(R.minScale), o.logScale));
    this.sph.theta += o.az; this.sph.phi += o.pol; this.sph.radius *= Math.exp(o.logScale);
    this.eye.setFromSpherical(this.sph).add(this.pivot);
    clampForRender(this.eye, this.eye, ctx.groundAt);
    this.last.setFromVector3(this.v.subVectors(this.eye, this.pivot));
    this.has = true;
  }
}
