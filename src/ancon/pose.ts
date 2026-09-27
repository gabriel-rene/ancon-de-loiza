import * as THREE from 'three';
import { RIVER_DIR } from '../geo/constants';
import { createCrossingState, crossingState, mooredState, type CrossingState } from './crossing';
import { dockPoint, type CrossingGeometry, type XZ } from './geometry';
import { deckLayout, type DeckLayout, type VesselSpec } from './spec';
import type { Propulsion } from '../data/eras';

/** Everything the pose needs that does not change per frame (docks precomputed: no per-frame allocation). */
export interface PoseContext {
  geom: CrossingGeometry; spec: VesselSpec; layout: DeckLayout;
  /** Surface current, m/s (era.river.flow). */
  flow: number;
  dockEast: XZ; dockWest: XZ;
  /** Dock-to-dock distance, m. */
  lineLen: number;
  /** Terrain height (m) at a world point; set by <Ancon> for the ride camera (Task 9). */
  groundAt?: (x: number, z: number) => number;
}
export function makePoseContext(geom: CrossingGeometry, spec: VesselSpec, flow: number, groundAt?: (x: number, z: number) => number): PoseContext {
  const layout = deckLayout(spec), dockEast = dockPoint(geom, 'east', layout.reach), dockWest = dockPoint(geom, 'west', layout.reach);
  return { geom, spec, layout, flow, dockEast, dockWest, lineLen: Math.hypot(dockWest[0] - dockEast[0], dockWest[1] - dockEast[1]), groundAt };
}
export interface VesselPose {
  /** World position of the local origin (hull centre at the waterline). */
  position: THREE.Vector3; quaternion: THREE.Quaternion;
  /** world ← vessel-local. */
  matrix: THREE.Matrix4;
  yaw: number; pitch: number; roll: number; heave: number;
  /** Signed speed along local +X, m/s. */
  speed: number;
  /** Downstream offset from the straight line, m (along RIVER_DIR). */
  drift: number;
  travel: 1 | -1; clock: number; state: CrossingState;
}
/** Mid-river drift (m) per m/s of current. Poles can only correct so much; the ropes hold the line (inferred). */
export const DRIFT_PER_FLOW: Record<Propulsion, number> = { poles: 6, ropes: 1.5, moored: 0 };
/** Crab angle (rad) per m/s of current: the crew points the leading end upstream (research §2.3: the helmsman "moves with the river's flow"). */
export const CRAB_PER_FLOW: Record<Propulsion, number> = { poles: 0.05, ropes: 0.015, moored: 0 };
/** Bow-up pitch (rad) per m/s² of surge acceleration. */
export const PITCH_PER_ACCEL = 0.15;
const APRON_UP = 0.12, APRON_DOWN = -0.14;

export const createVesselPose = (): VesselPose => ({
  position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), matrix: new THREE.Matrix4(),
  yaw: 0, pitch: 0, roll: 0, heave: 0, speed: 0, drift: 0, travel: 1, clock: 0, state: createCrossingState(),
});

const euler = new THREE.Euler(0, 0, 0, 'YZX');   // matrix = Ry(yaw) · Rz(pitch) · Rx(roll)
const ONE = new THREE.Vector3(1, 1, 1);

export function computeVesselPose(clock: number, ctx: PoseContext, out: VesselPose): VesselPose {
  const { geom: g, spec, flow, dockEast: e, dockWest: w, lineLen } = ctx, st = out.state;
  if (spec.moored) mooredState(st); else crossingState(clock, st);
  const bump = Math.sin(Math.PI * st.s);                        // 0 at both docks: the crew corrects the drift
  const drift = flow * DRIFT_PER_FLOW[spec.propulsion] * bump;
  const x = e[0] + (w[0] - e[0]) * st.s + RIVER_DIR[0] * drift;
  const z = e[1] + (w[1] - e[1]) * st.s + RIVER_DIR[1] * drift;
  // Periodic motion, smaller for bigger hulls; half as much moored.
  const k = Math.sqrt(8 / Math.max(spec.length, 4)) * (spec.moored ? 0.5 : 1), t = clock;
  const heave = k * (0.025 * Math.sin(1.3 * t) + 0.012 * Math.sin(2.9 * t + 1));
  const pitch = k * 0.012 * Math.sin(0.9 * t + 0.4) + PITCH_PER_ACCEL * st.a * lineLen;
  const roll = k * 0.018 * Math.sin(0.7 * t + 2);
  // +yaw turns the heading toward (dir.z, −dir.x); pick the sign that points the leading end upstream.
  const up = -(g.dir[1] * RIVER_DIR[0] - g.dir[0] * RIVER_DIR[1]);
  const crab = flow * CRAB_PER_FLOW[spec.propulsion] * bump * st.travel * (up >= 0 ? 1 : -1);
  out.yaw = g.yaw + crab; out.pitch = pitch; out.roll = roll; out.heave = heave;
  euler.set(roll, out.yaw, pitch);
  out.quaternion.setFromEuler(euler);
  out.position.set(x, heave, z);
  out.matrix.compose(out.position, out.quaternion, ONE);
  out.speed = st.v * lineLen; out.drift = drift; out.travel = st.travel; out.clock = clock;
  return out;
}

/** Apron angle (rad, + raised) of the end at local x sign `end` (−1 east, +1 west). */
export function apronLift(st: CrossingState, end: 1 | -1): number {
  const nearEast = st.s < 0.5, docked = (end === -1) === nearEast ? st.slack : 0;
  return APRON_UP + (APRON_DOWN - APRON_UP) * docked;
}
