import * as THREE from 'three';
import { legDuration } from '../ancon/crossing';
import { moveEnd } from '../ancon/crew';
import { APRON_REST } from '../ancon/geometry';
import type { VesselPose } from '../ancon/pose';
import { landingTop } from '../infrastructure/landing';
import { ROAD_LIFT } from '../infrastructure/roadStrip';
import { PAD, padFrameInto } from '../terrain/landingPads';
import { arriveFrame, departFrame, pointAt, worldToDeckInto, type DockEnv, type DockFrame, type Polyline } from './env';
import { travelOf } from './plan';
import type { MoverSched } from './schedule';
import { tripAt, type TripPoint } from './trip';

export type Stage = 'hidden' | 'queue' | 'board' | 'park' | 'leave';
export interface MoverFrame {
  visible: boolean; stage: Stage;
  front: THREE.Vector3; rear: THREE.Vector3; matrix: THREE.Matrix4;
  dist: number; speed: number; onDeck: boolean;
}
export const createMoverFrame = (): MoverFrame => ({
  visible: false, stage: 'hidden', front: new THREE.Vector3(), rear: new THREE.Vector3(), matrix: new THREE.Matrix4(), dist: 0, speed: 0, onDeck: false,
});

const _e = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3(), _m = new THREE.Vector3(), _up = new THREE.Vector3();
const _xz: [number, number] = [0, 0], _dk: [number, number] = [0, 0], _pf: [number, number] = [0, 0], _tp: TripPoint = { s: 0, v: 0 };
const UP = new THREE.Vector3(0, 1, 0);

/**
 * World point (and height) of the ground a contact stands on at world (wx, wz), with the ferry docked at `f`:
 * the deck (through the live pose, so it rides the heave), the apron (a straight blend from the deck edge down
 * to the landing, 0.8 m onto the bank for an apron-less barge), the landing pad, or the road. Returns true on the deck.
 */
export function surfacePoint(env: DockEnv, f: DockFrame, wx: number, wz: number, pose: VesselPose, out: THREE.Vector3): boolean {
  const L = env.layout, dk = worldToDeckInto(f, wx, wz, _dk), x = dk[0], z = dk[1], ax = Math.abs(x);
  if (ax <= L.halfLength) { out.set(x, L.deckY, z).applyMatrix4(pose.matrix); return true; }
  const pf = padFrameInto(f.pad, wx, wz, _pf), a = pf[0], v = pf[1], land = landingTop(f.pad, env.look, a);
  const end = L.apron > 0 ? L.reach : L.halfLength + APRON_REST;
  if (ax <= end) {
    _e.set(Math.sign(x) * L.halfLength, L.deckY, z).applyMatrix4(pose.matrix);
    out.set(wx, _e.y + (land - _e.y) * ((ax - L.halfLength) / (end - L.halfLength)), wz);
    return false;
  }
  if (a <= PAD.length + 1 && Math.abs(v) <= PAD.halfWidth + 1) { out.set(wx, land, wz); return false; }
  out.set(wx, env.groundAt(wx, wz) + ROAD_LIFT, wz);
  return false;
}

/** Model → world from the two contacts: +X along rear → front, +Y as close to `up` as that allows, origin at their midpoint. */
export function bodyMatrix(front: THREE.Vector3, rear: THREE.Vector3, up: THREE.Vector3, out: THREE.Matrix4): THREE.Matrix4 {
  _f.subVectors(front, rear).normalize();
  _r.crossVectors(_f, up).normalize();
  _u.crossVectors(_r, _f);
  out.makeBasis(_f, _u, _r);
  _m.addVectors(front, rear).multiplyScalar(0.5);
  return out.setPosition(_m);
}

function onPath(env: DockEnv, f: DockFrame, p: Polyline, s: number, pose: VesselPose, out: THREE.Vector3): boolean {
  pointAt(p, s, _xz);
  return surfacePoint(env, f, _xz[0], _xz[1], pose, out);
}

/**
 * Mover `s` at crossing clock `clock`, the ferry at `pose` (this clock's pose). Queue and boarding run on the
 * boarding path at the departure dock, parking rides the deck, leaving runs on the leaving path at the arrival dock.
 * Pure and allocation-free.
 */
export function moverFrame(s: MoverSched, env: DockEnv, clock: number, pose: VesselPose, out: MoverFrame): MoverFrame {
  const T = env.spec.timings, Lg = legDuration(T), m = s.m, d = m.dims, tr = travelOf(m.leg), L = env.layout;
  const t = clock - m.leg * Lg, tl = t - moveEnd(T);
  out.visible = true; out.onDeck = false;
  if (t < s.spawn.t0 || tl > s.gone) { out.visible = false; out.stage = 'hidden'; out.speed = 0; return out; }
  if (t < s.boardEnd - 0.5) {   // queueing, then driving on (boarding path, departure dock)
    if (t < s.boardTrip.t0) { tripAt(s.spawn, t, _tp); out.stage = 'queue'; } else { tripAt(s.boardTrip, t, _tp); out.stage = 'board'; }
    const f = departFrame(env, m.leg);
    // Both contacts every frame (a short-circuit && would leave `rear` stale whenever the front is off the deck).
    const fOn = onPath(env, f, s.board, _tp.s, pose, out.front), rOn = onPath(env, f, s.board, _tp.s - d.wheelbase, pose, out.rear);
    out.onDeck = fOn && rOn;
    out.speed = _tp.v; out.dist = _tp.s - d.wheelbase;
  } else if (tl < s.leave1.t0) {   // parked: rides the deck
    out.front.set(tr * (m.park.x + d.wheelbase / 2), L.deckY, m.park.z).applyMatrix4(pose.matrix);
    out.rear.set(tr * (m.park.x - d.wheelbase / 2), L.deckY, m.park.z).applyMatrix4(pose.matrix);
    out.stage = 'park'; out.onDeck = true; out.speed = 0; out.dist = s.board.len - d.wheelbase;
  } else {   // driving off (leaving path, arrival dock)
    tripAt(tl < s.leave2.t0 ? s.leave1 : s.leave2, tl, _tp);
    const f = arriveFrame(env, m.leg);
    // Both contacts every frame (a short-circuit && would leave `rear` stale whenever the front is off the deck).
    const fOn = onPath(env, f, s.leave, _tp.s, pose, out.front), rOn = onPath(env, f, s.leave, _tp.s - d.wheelbase, pose, out.rear);
    out.onDeck = fOn && rOn;
    out.stage = 'leave'; out.speed = _tp.v; out.dist = s.board.len - d.wheelbase + (_tp.s - d.wheelbase);
  }
  if (out.onDeck) _up.set(0, 1, 0).applyQuaternion(pose.quaternion); else _up.copy(UP);
  bodyMatrix(out.front, out.rear, _up, out.matrix);
  return out;
}
