import * as THREE from 'three';
import { expect, test } from 'vitest';
import { LOOK_STEP, lookKey } from './lookKeys';

/** View direction of a camera-controls camera at spherical (theta, phi) about its target. */
const dir = (theta: number, phi: number) => new THREE.Vector3().setFromSphericalCoords(10, phi, theta).negate().normalize();

test('→ turns the picture right and ← left, from any heading (spec 7b §2.1)', () => {
  // Shore orbits a target 1 m ahead (LOOK_IN_PLACE) and Ride orbits its pivot: the same geometry, so one sign for all views.
  for (const theta of [0, 1, 2.5, -2]) {
    const right = lookKey({ key: 'ArrowRight' })!, left = lookKey({ key: 'ArrowLeft' })!;
    const d0 = dir(theta, 1.2);
    expect(new THREE.Vector3().crossVectors(d0, dir(theta + right.dAz, 1.2)).y).toBeLessThan(0);
    expect(new THREE.Vector3().crossVectors(d0, dir(theta + left.dAz, 1.2)).y).toBeGreaterThan(0);
  }
});
test('↑ tilts the view up and ↓ down', () => {
  const d0 = dir(0.5, 1.2);
  expect(dir(0.5, 1.2 + lookKey({ key: 'ArrowUp' })!.dPol).y).toBeGreaterThan(d0.y);
  expect(dir(0.5, 1.2 + lookKey({ key: 'ArrowDown' })!.dPol).y).toBeLessThan(d0.y);
});
test('steps: 10° turn, 6° tilt; + and = zoom in, - and _ zoom out', () => {
  expect(LOOK_STEP.az).toBeCloseTo((10 * Math.PI) / 180);
  expect(LOOK_STEP.pol).toBeCloseTo((6 * Math.PI) / 180);
  expect(lookKey({ key: '+' })).toEqual({ dAz: 0, dPol: 0, dZoom: 1 });
  expect(lookKey({ key: '=' })).toEqual({ dAz: 0, dPol: 0, dZoom: 1 });
  expect(lookKey({ key: '-' })).toEqual({ dAz: 0, dPol: 0, dZoom: -1 });
  expect(lookKey({ key: '_' })).toEqual({ dAz: 0, dPol: 0, dZoom: -1 });
});
test('other keys and modified keys are not look keys', () => {
  for (const key of ['a', 'r', '1', 'Enter', ' ', 'Tab', 'toString']) expect(lookKey({ key })).toBeNull();
  expect(lookKey({ key: 'ArrowLeft', metaKey: true })).toBeNull();
  expect(lookKey({ key: 'ArrowLeft', ctrlKey: true })).toBeNull();
  expect(lookKey({ key: 'ArrowLeft', altKey: true })).toBeNull();
});
