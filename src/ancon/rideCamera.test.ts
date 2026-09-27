import * as THREE from 'three';
import { expect, test } from 'vitest';
import { ERAS } from '../data/eras';
import { sampleField } from '../terrain/fields';
import { LANDING_CLEARING } from '../vegetation/masks';
import { CROSSING_TIMINGS as T, legDuration } from './crossing';
import { actorFrame, castActors, createActorFrame } from './crew';
import { landingClearings } from './geometry';
import { computeVesselPose, createVesselPose } from './pose';
import { WATER_Y } from '../geo/constants';
import { carryCamera, clampForRender, RIDE, RIDE_ORBIT, RideRig, rideView, rideYaw } from './rideCamera';
import { guideLocal, ropeRig } from './rigging';
import { seatAnchors } from './seats';
import { ctxFor, fields512 } from './testing';

const ctx = ctxFor('1975'), layout = ctx.layout;
const L = legDuration(), MID = T.load + T.castOff + T.cross / 2;
const poseAt = (c: number) => computeVesselPose(c, ctx, createVesselPose());

test('rideYaw: behind the trailing end on each leg, a slow continuous swing while docked', () => {
  expect(Math.cos(rideYaw(MID, false))).toBeCloseTo(1, 9);
  expect(Math.cos(rideYaw(L + MID, false))).toBeCloseTo(-1, 9);
  let prev = rideYaw(0, false);
  for (let c = 0.1; c <= 4 * L; c += 0.1) {
    const y = rideYaw(c, false);
    expect(Math.abs(y - prev)).toBeLessThan(0.02); expect(y).toBeGreaterThanOrEqual(prev - 1e-12);
    prev = y;
  }
  expect(rideYaw(500, true)).toBe(0);
});
test('rideView: behind and above the trailing end, looking ahead, on both legs', () => {
  for (const c of [MID, L + MID]) {
    const p = poseAt(c), pos = new THREE.Vector3(), tgt = new THREE.Vector3();
    rideView(p, layout, rideYaw(c, false), pos, tgt);
    const hx = Math.cos(p.yaw) * p.travel, hz = -Math.sin(p.yaw) * p.travel;
    expect((pos.x - p.position.x) * hx + (pos.z - p.position.z) * hz).toBeLessThan(-layout.reach);
    expect((tgt.x - p.position.x) * hx + (tgt.z - p.position.z) * hz).toBeGreaterThan(0);
    expect(pos.y).toBeGreaterThan(layout.deckY + 3);
  }
});
test('carrying the camera with the vessel equals re-deriving the view', () => {
  const a = poseAt(60), b = poseAt(170), ya = rideYaw(60, false), yb = rideYaw(170, false);
  const pos = new THREE.Vector3(), tgt = new THREE.Vector3(), pos2 = new THREE.Vector3(), tgt2 = new THREE.Vector3();
  rideView(a, layout, ya, pos, tgt);
  carryCamera(a.matrix, b.matrix, yb - ya, pos, tgt);
  rideView(b, layout, yb, pos2, tgt2);
  expect(pos.distanceTo(pos2)).toBeLessThan(1e-6); expect(tgt.distanceTo(tgt2)).toBeLessThan(1e-6);
});
test('the camera never dips under the bank', () => {
  const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
  rideView(poseAt(5), layout, 0, pos, tgt, () => 10);
  expect(pos.y).toBeCloseTo(11.8, 9);
});
test('docked, the ride camera stands inside the landing clearing (no trees in the lens)', () => {
  for (const e of ERAS) {
    const c = ctxFor(e.id), [cE, cW] = landingClearings(c.geom), pos = new THREE.Vector3(), tgt = new THREE.Vector3();
    for (const [clock, centre] of (c.spec.moored ? [[5, cE]] : [[5, cE], [L + 5, cW]]) as [number, readonly [number, number]][]) {   // 1986 stays at Loíza
      rideView(computeVesselPose(clock, c, createVesselPose()), c.layout, rideYaw(clock, c.spec.moored), pos, tgt);
      expect(Math.hypot(pos.x - centre[0], pos.z - centre[1]), `${e.id} @${clock}`).toBeLessThan(LANDING_CLEARING[0]);
    }
  }
});

/** Distance from p to segment ab. */
function segDist(p: THREE.Vector3, a: readonly number[], b: readonly number[]) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l2 = dx * dx + dy * dy + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy + (p.z - a[2]) * dz) / l2)) : 0;
  return Math.hypot(p.x - a[0] - dx * t, p.y - a[1] - dy * t, p.z - a[2] - dz * t);
}
test('the ride camera keeps clear of crew (≥ 4 m: figures read stylised closer), poles, ropes, hull and bank, every era and phase', () => {
  for (const e of ERAS) {
    const c = ctxFor(e.id), lay = c.layout, f = fields512(e.river.bankOffset.value);
    const actors = castActors(c.spec, seatAnchors(c.spec, lay), Number(e.id)), fr = createActorFrame();
    const rig = c.spec.propulsion === 'ropes' ? ropeRig(c.geom, lay, f) : null, guide: [number, number, number] = [0, 0, 0];
    const pose = createVesselPose(), pos = new THREE.Vector3(), tgt = new THREE.Vector3(), loc = new THREE.Vector3(), g = new THREE.Vector3(), inv = new THREE.Matrix4();
    let crew = Infinity, pole = Infinity, rope = Infinity, hull = Infinity, bank = Infinity;
    for (let clock = 0; clock < 2 * L; clock += 0.1) {
      computeVesselPose(clock, c, pose);
      rideView(pose, lay, rideYaw(clock, c.spec.moored), pos, tgt);
      bank = Math.min(bank, pos.y - sampleField(f, f.height, pos.x, pos.z));
      loc.copy(pos).applyMatrix4(inv.copy(pose.matrix).invert());
      hull = Math.min(hull, Math.hypot(Math.max(0, Math.abs(loc.x) - lay.reach), Math.max(0, Math.abs(loc.z) - lay.halfBeam), Math.max(0, loc.y - lay.deckY - 1.2)));
      for (const a of actors) {
        actorFrame(a, pose.state, clock, c, fr);
        if (!fr.visible) continue;
        crew = Math.min(crew, segDist(loc, fr.pos, [fr.pos[0], fr.pos[1] + 1.8, fr.pos[2]]));
        if (fr.hasPole) pole = Math.min(pole, segDist(loc, fr.poleTop, fr.poleTip));
      }
      if (rig) for (const line of [0, 1] as const) for (const [side, end] of [['east', -1], ['west', 1]] as const) {
        g.fromArray(guideLocal(lay, end, line, guide)).applyMatrix4(pose.matrix);
        rope = Math.min(rope, segDist(pos, g.toArray(), rig[side][line]));   // straight chord: the sagging rope only hangs lower
      }
    }
    expect(crew, `${e.id} crew`).toBeGreaterThan(4);
    expect(pole, `${e.id} pole`).toBeGreaterThan(2);
    expect(rope, `${e.id} rope`).toBeGreaterThan(2);
    expect(hull, `${e.id} hull`).toBeGreaterThan(3);
    expect(bank, `${e.id} bank`).toBeGreaterThan(RIDE.minClear);   // the ground clamp never has to act (it would ratchet the carried camera up)
  }
});

test('at rest the rig renders exactly the canonical ride view, orbiting about a pivot on its sightline over the deck', () => {
  for (const e of ERAS) {
    const c = ctxFor(e.id), rig = new RideRig(), pos = new THREE.Vector3(), tgt = new THREE.Vector3(), d = new THREE.Vector3();
    for (let clock = 0; clock < 2 * L; clock += 1.3) {
      rig.frame(poseAt2(clock, c), c, rig.eye, rig.pivot, false, 1 / 60);
      rideView(poseAt2(clock, c), c.layout, rideYaw(clock, c.spec.moored), pos, tgt);
      expect(rig.eye.distanceTo(pos), `${e.id} @${clock}`).toBeLessThan(1e-9);
      expect(d.subVectors(rig.pivot, pos).normalize().dot(tgt.clone().sub(pos).normalize())).toBeCloseTo(1, 9);
      expect(Math.abs(rig.orbit.az) + Math.abs(rig.orbit.pol) + Math.abs(rig.orbit.logScale)).toBe(0);
    }
  }
});
const poseAt2 = (clock: number, c = ctx) => computeVesselPose(clock, c, createVesselPose());

test('the bank clamp is render-only: it never accumulates into the carried state', () => {
  const rig = new RideRig(), pos = new THREE.Vector3(), tgt = new THREE.Vector3();
  const high = { ...ctx, groundAt: () => 10 };
  for (let i = 0; i < 600; i++) {
    const clock = 40 + i / 60;
    rig.frame(poseAt2(clock), high, rig.eye, rig.pivot, false, 1 / 60);   // the controls report back what was set
    expect(rig.eye.y).toBeCloseTo(10 + RIDE.minClear, 9);
    rideView(poseAt2(clock), layout, rideYaw(clock, false), pos, tgt);
    expect(rig.pos.distanceTo(pos)).toBeLessThan(1e-9);
  }
  expect(Math.abs(rig.orbit.az) + Math.abs(rig.orbit.pol) + Math.abs(rig.orbit.logScale)).toBeLessThan(1e-9);
  rig.frame(poseAt2(50), ctx, rig.eye, rig.pivot, false, 1 / 60);   // bank gone: straight back to the canonical view
  rideView(poseAt2(50), layout, rideYaw(50, false), pos, tgt);
  expect(rig.eye.distanceTo(pos)).toBeLessThan(1e-6);
});

test('water floor: the camera never goes below the water surface + waterClear (mid-river the terrain is the riverbed)', () => {
  expect(clampForRender(new THREE.Vector3(3, -4, 5), new THREE.Vector3()).y).toBe(WATER_Y + RIDE_ORBIT.waterClear);
  const up = RIDE.up;
  try {
    RIDE.up = -3;   // a view that would sit under the water
    const rig = new RideRig(), pos = new THREE.Vector3(), tgt = new THREE.Vector3();
    for (let i = 0; i < 120; i++) rig.frame(poseAt2(90 + i / 60), ctx, rig.eye, rig.pivot, false, 1 / 60);
    expect(rig.eye.y).toBeCloseTo(WATER_Y + RIDE_ORBIT.waterClear, 9);
    rideView(poseAt2(90 + 119 / 60), layout, rideYaw(90, false), pos, tgt);
    expect(rig.pos.distanceTo(pos)).toBeLessThan(1e-9);   // the unclamped state is untouched
  } finally { RIDE.up = up; }
});

test('a drag orbits within the polar limits, holds ~1 s after release, then eases back smoothly', () => {
  const rig = new RideRig(), user = new THREE.Vector3(), v = new THREE.Vector3(), sph = new THREE.Spherical(), prev = new THREE.Vector3();
  const dt = 1 / 60;
  let clock = 60;
  rig.frame(poseAt2(clock), ctx, null, null, false, dt);
  // Drag: turn 1.2 rad and try to dive far below the horizon, over 30 frames.
  for (let i = 0; i < 30; i++) {
    clock += dt;
    sph.setFromVector3(v.subVectors(rig.eye, rig.pivot)); sph.theta += 0.04; sph.phi += 0.05;
    user.setFromSpherical(sph).add(rig.pivot);
    rig.frame(poseAt2(clock), ctx, user, rig.pivot, true, dt);
    sph.setFromVector3(v.subVectors(rig.eye, rig.pivot));
    expect(sph.phi).toBeLessThanOrEqual(RIDE_ORBIT.maxPolar + 1e-9);
    expect(rig.eye.y).toBeGreaterThanOrEqual(WATER_Y + RIDE_ORBIT.waterClear - 1e-9);
  }
  expect(rig.orbit.az).toBeCloseTo(1.2, 6);
  // Released: the offset holds for returnDelay, then decays to nothing without a jump.
  let maxStep = 0;
  for (let i = 0; i < 9 / dt; i++) {
    clock += dt; prev.copy(rig.eye);
    rig.frame(poseAt2(clock), ctx, rig.eye, rig.pivot, false, dt);
    if (i === Math.floor(0.9 / dt)) expect(rig.orbit.az).toBeCloseTo(1.2, 6);
    maxStep = Math.max(maxStep, rig.eye.distanceTo(prev));
  }
  expect(Math.abs(rig.orbit.az) + Math.abs(rig.orbit.pol)).toBeLessThan(1e-3);
  expect(maxStep).toBeLessThan(0.3);   // ≤ 18 m/s at 60 fps round an ~18 m orbit: a glide, not a snap
});
