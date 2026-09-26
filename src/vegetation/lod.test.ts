import { expect, test } from 'vitest';
import { composeInstanceMatrices, gatherMatrices, partitionLod } from './lod';
import * as THREE from 'three';

test('splits by horizontal distance to the camera', () => {
  const xs = new Float32Array([0, 10, 100, 300]), zs = new Float32Array([0, 0, 0, 0]);
  const near = new Uint32Array(4), far = new Uint32Array(4);
  const [a, b] = partitionLod(xs, zs, 0, 0, 120, near, far);
  expect([a, b]).toEqual([3, 1]);
  expect(Array.from(near.slice(0, a))).toEqual([0, 1, 2]);
  expect(Array.from(far.slice(0, b))).toEqual([3]);
});

test('partition uses the camera position and includes the d0 boundary', () => {
  const xs = new Float32Array([50, 50, 50]), zs = new Float32Array([-30, 10, 60]);
  const near = new Uint32Array(3), far = new Uint32Array(3);
  const [a, b] = partitionLod(xs, zs, 50, 10, 20, near, far);
  expect([a, b]).toEqual([1, 2]);
  expect(near[0]).toBe(1);
  expect(Array.from(far.slice(0, b))).toEqual([0, 2]);
  expect(partitionLod(xs, zs, 50, 10, 40, near, far)).toEqual([2, 1]); // |dz| = 40 → near
});

test('instance matrices match THREE.compose (translation, Y rotation, uniform scale)', () => {
  const inst = [
    { x: 1, y: 2, z: 3, rot: 0.7, scale: 1.5, variant: 0 },
    { x: -40, y: 0.5, z: 12, rot: -2.1, scale: 0.8, variant: 0 },
  ];
  const out = composeInstanceMatrices(inst);
  expect(out.length).toBe(32);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3();
  inst.forEach((p, i) => {
    m.compose(v.set(p.x, p.y, p.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot), new THREE.Vector3(p.scale, p.scale, p.scale));
    for (let k = 0; k < 16; k++) expect(out[i * 16 + k]).toBeCloseTo(m.elements[k], 5);
  });
});

test('gatherMatrices packs the selected 16-float blocks in order', () => {
  const src = new Float32Array(48).map((_, i) => i);
  const dst = new Float32Array(48);
  gatherMatrices(src, new Uint32Array([2, 0, 7]), 2, dst);
  expect(Array.from(dst.slice(0, 16))).toEqual(Array.from(src.slice(32, 48)));
  expect(Array.from(dst.slice(16, 32))).toEqual(Array.from(src.slice(0, 16)));
  expect(dst[32]).toBe(0);
});
