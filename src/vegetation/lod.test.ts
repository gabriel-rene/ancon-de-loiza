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

test('gatherMatrices honours index and destination offsets', () => {
  const src = new Float32Array(48).map((_, i) => i);
  const dst = new Float32Array(48);
  gatherMatrices(src, new Uint32Array([9, 2, 0]), 2, dst, 1, 1); // idx[1..3) → slots 1..3
  expect(dst[16]).toBe(32); expect(dst[32]).toBe(0); expect(dst[0]).toBe(0);
});

import { inWedge, newWedge, partitionView, viewWedge, wedgeCovers } from './lod';

const deg = Math.PI / 180;
/** Corner rays of a level camera at yaw 0 (looking +x) with horizontal half-angle `h` and ±10° pitch. */
function levelRays(h: number, yaw = 0) {
  const out: number[] = [];
  for (const s of [-1, 1]) for (const p of [-1, 1]) {
    const a = yaw + s * h;
    out.push(Math.cos(a), Math.tan(p * 10 * deg), Math.sin(a));
  }
  return out;
}

test('view wedge: bisector and half-angle from the corner rays, plus margin', () => {
  const w = viewWedge(5, 7, levelRays(30 * deg, 90 * deg), 10 * deg, newWedge());
  expect(w.all).toBe(false);
  expect(w.cx).toBe(5); expect(w.cz).toBe(7);
  expect(w.fx).toBeCloseTo(0, 6); expect(w.fz).toBeCloseTo(1, 6);
  expect(w.half).toBeCloseTo(40 * deg, 6);
});

test('view wedge: looking straight down (or a near-180° spread) disables culling', () => {
  const down = [0.3, -1, 0.2, -0.3, -1, 0.2, 0.3, -1, -0.2, -0.3, -1, -0.2];
  expect(viewWedge(0, 0, down, 0, newWedge()).all).toBe(true);
  expect(viewWedge(0, 0, levelRays(80 * deg), 10 * deg, newWedge()).all).toBe(true);
  // A pitched-down frustum whose rays stay in front of the camera keeps a finite wedge.
  const pitched = [1, -2, -0.5, 1, -2, 0.5, 1, -0.2, -0.6, 1, -0.2, 0.6];
  const w = viewWedge(0, 0, pitched, 0, newWedge());
  expect(w.all).toBe(false);
  expect(w.half).toBeCloseTo(Math.atan(0.6), 6);
});

test('inWedge: inside, outside, near the edge within the radius, behind the apex', () => {
  const w = viewWedge(0, 0, levelRays(30 * deg), 0, newWedge()); // looking +x, ±30°
  expect(inWedge(w, 100, 0, 0)).toBe(true);
  expect(inWedge(w, 100, 50, 0)).toBe(true);               // 26.6°
  expect(inWedge(w, 100, 70, 0)).toBe(false);              // 35°: edge distance ≈ 10.6
  expect(inWedge(w, 100, 70, 11)).toBe(true);
  expect(inWedge(w, -100, 0, 20)).toBe(false);             // behind
  expect(inWedge(w, -3, 0, 5)).toBe(true);                 // disc contains the camera
  expect(inWedge(w, 0, 100, 5)).toBe(false);               // side
  const all = viewWedge(0, 0, levelRays(89 * deg), 0, newWedge());
  expect(inWedge(all, -100, 0, 0)).toBe(true);
});

test('wedgeCovers: rotation within the margin stays covered, beyond it does not', () => {
  const outer = viewWedge(0, 0, levelRays(30 * deg), 12 * deg, newWedge());
  expect(wedgeCovers(outer, viewWedge(0, 0, levelRays(30 * deg, 10 * deg), 0, newWedge()))).toBe(true);
  expect(wedgeCovers(outer, viewWedge(0, 0, levelRays(30 * deg, -14 * deg), 0, newWedge()))).toBe(false);
  expect(wedgeCovers(outer, viewWedge(0, 0, levelRays(89 * deg), 0, newWedge()))).toBe(false); // inner: all
  expect(wedgeCovers(viewWedge(0, 0, levelRays(89 * deg), 0, newWedge()), outer)).toBe(true);  // outer: all
});

test('partitionView: in-view near rings and far; out-of-view instances dropped', () => {
  // Camera at the origin looking +x, ±30°. Instances: [in 0–dR, in dR–d0, off near, in far, off far, off 0–dR].
  const xs = new Float32Array([10, 100, -50, 400, -400, -5]), zs = new Float32Array([0, 10, 0, 0, 0, 20]);
  const rs = new Float32Array(6).fill(1);
  const near = new Uint32Array(6), far = new Uint32Array(6);
  const w = viewWedge(0, 0, levelRays(30 * deg), 0, newWedge());
  expect(Array.from(partitionView(xs, zs, rs, 0, 0, 50, 220, w, near, far, new Uint32Array(3)))).toEqual([1, 1, 1]);
  expect(near[0]).toBe(0);
  expect(near[5]).toBe(1);                       // in-view dR..d0 ring at the back of `near`
  expect(far[0]).toBe(3);
  // No wedge: nothing is culled.
  expect(Array.from(partitionView(xs, zs, rs, 0, 0, 50, 220, null, near, far, new Uint32Array(3)))).toEqual([3, 1, 2]);
});

import { inLightBox, lightBox, newLightBox, partitionShadow } from './lod';

test('light box: light-space square around the shadow target, with the sun overhead and low', () => {
  const up = lightBox([0, 0, 0], [0, 1, 0], 100, 0, newLightBox()); // noon: a 200 m ground square
  expect(inLightBox(up, 90, 0, 0, 0)).toBe(true);
  expect(inLightBox(up, 0, 5, -99, 0)).toBe(true);
  expect(inLightBox(up, 110, 0, 0, 0)).toBe(false);
  expect(inLightBox(up, 110, 0, 0, 11)).toBe(true);           // sphere reaches in
  const low = lightBox([0, 0, 0], [1, 0.2, 0], 100, 10, newLightBox()); // sun low in +x: box stretched along x
  expect(inLightBox(low, 400, 0, 0, 0)).toBe(true);            // light-space up ≈ 400·0.196 = 78 < 110
  expect(inLightBox(low, 0, 0, 105, 0)).toBe(true);            // margin 10
  expect(inLightBox(low, 0, 0, 115, 0)).toBe(false);
  expect(inLightBox(low, 0, 0, 115, 6)).toBe(true);
});

test('partitionShadow: LOD0 instances (in view or not) whose sphere reaches into the light box', () => {
  const xs = new Float32Array([10, -50, -200, 150, 300]), zs = new Float32Array(5), ys = new Float32Array(5), ls = new Float32Array(5).fill(1);
  const box = lightBox([40, 0, 0], [0, 1, 0], 100, 0, newLightBox()); // x in [-60, 140]
  const out = new Uint32Array(5);
  expect(partitionShadow(xs, ys, zs, ls, 0, 0, 220, box, out)).toBe(2);
  expect(Array.from(out.slice(0, 2))).toEqual([0, 1]);
  ls[3] = 11;                                   // x = 150, reaches 139
  expect(partitionShadow(xs, ys, zs, ls, 0, 0, 220, box, out)).toBe(3);
  expect(partitionShadow(xs, ys, zs, ls, 0, 0, 220, null, out)).toBe(4); // no box: all within d0
});
