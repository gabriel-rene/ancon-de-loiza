import * as THREE from 'three';
import { expect, test } from 'vitest';
import { RIDE_ORBIT } from '../ancon/rideCamera';
import { PUBLIC_VIEWS } from '../state/url';
import { controlLimits, frontOf, glideK, isOffFront, LOOK_IN_PLACE, VIEW_GLIDE_S, VIEW_KEYS, VIEW_POSES } from './views';

const dist = (p: { pos: number[]; target: number[] }) => Math.hypot(p.pos[0] - p.target[0], p.pos[1] - p.target[1], p.pos[2] - p.target[2]);

test('Shore turns in place: its target is LOOK_IN_PLACE ahead of the eye, inside its zoom and polar limits', () => {
  const p = VIEW_POSES.shore, L = controlLimits('shore', true), f = frontOf(p);
  expect(dist(p)).toBeCloseTo(LOOK_IN_PLACE, 9);
  expect([L.minDistance, L.maxDistance]).toEqual([LOOK_IN_PLACE, LOOK_IN_PLACE]);
  expect([L.minZoom, L.maxZoom]).toEqual([1, 1.3]);
  expect(L.lookInPlace).toBe(true);
  expect(f.pol).toBeGreaterThan(L.minPolar); expect(f.pol).toBeLessThan(L.maxPolar);
});
test('Sky orbits its target with ±30 % zoom; its front is inside its polar limits', () => {
  const L = controlLimits('sky', true), f = frontOf(VIEW_POSES.sky), d = dist(VIEW_POSES.sky);
  expect(L.minDistance).toBeCloseTo(0.7 * d, 6); expect(L.maxDistance).toBeCloseTo(1.3 * d, 6);
  expect(f.pol).toBeGreaterThan(L.minPolar); expect(f.pol).toBeLessThan(L.maxPolar);
});
test('public views never pan; dev views and ride without the ferry keep the free controls', () => {
  for (const v of PUBLIC_VIEWS) expect(controlLimits(v, true).pan, v).toBe(false);
  expect(controlLimits('fields', true).pan).toBe(true);
  expect(controlLimits('ride', false).pan).toBe(true);
  expect(controlLimits('ride', true).minPolar).toBeCloseTo(RIDE_ORBIT.minPolar - 0.02, 9);
});
test('off-front: any turn, tilt, zoom or lens zoom past the threshold; a full turn is not off-front', () => {
  const f = frontOf(VIEW_POSES.sky);
  expect(isOffFront(f, f.az, f.pol, f.dist, 1)).toBe(false);
  expect(isOffFront(f, f.az + 2 * Math.PI, f.pol, f.dist, 1)).toBe(false);
  expect(isOffFront(f, f.az + 0.1, f.pol, f.dist, 1)).toBe(true);
  expect(isOffFront(f, f.az, f.pol - 0.1, f.dist, 1)).toBe(true);
  expect(isOffFront(f, f.az, f.pol, f.dist * 1.1, 1)).toBe(true);
  expect(isOffFront(f, f.az, f.pol, f.dist, 1.1)).toBe(true);
});
test('frontOf matches camera-controls angles (three.Spherical, Y up)', () => {
  const p = VIEW_POSES.sky, s = new THREE.Spherical().setFromVector3(new THREE.Vector3(p.pos[0] - p.target[0], p.pos[1] - p.target[1], p.pos[2] - p.target[2]));
  expect(frontOf(p)).toEqual({ az: s.theta, pol: s.phi, dist: s.radius });
});
test('glide eases from 0 to 1 over VIEW_GLIDE_S', () => {
  expect(glideK(0)).toBe(0); expect(glideK(VIEW_GLIDE_S)).toBe(1); expect(glideK(99)).toBe(1);
  expect(glideK(VIEW_GLIDE_S / 2)).toBeCloseTo(0.5, 9);
});
test('keys 1, 2, 3 pick Ride, Shore, Sky', () => {
  expect(VIEW_KEYS).toEqual({ '1': 'ride', '2': 'shore', '3': 'sky' });
});
