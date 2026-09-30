import * as THREE from 'three';
import { expect, test } from 'vitest';
import { tris } from '../ancon/testing';
import { buildFaunaShape, FAUNA_TRIS, WING_K, type Shape } from './geometry';

const SHAPES: Shape[] = ['pelican', 'frigate', 'wader', 'mullet', 'manatee', 'ring'];

test('each shape stays under its triangle cap', () => {
  for (const s of SHAPES) { const g = buildFaunaShape(s); expect(tris(g), s).toBeLessThanOrEqual(FAUNA_TRIS[s]); g.dispose(); }
});

test('birds: wing vertices sit outside the wing root, on both sides; wader legs are tagged', () => {
  for (const s of ['pelican', 'frigate', 'wader'] as const) {
    const g = buildFaunaShape(s), pos = g.attributes.position, part = g.attributes.aPart;
    let left = 0, right = 0, legs = 0;
    for (let k = 0; k < pos.count; k++) {
      const wSide = part.getX(k);
      if (wSide !== 0) { expect(Math.abs(pos.getZ(k)), s).toBeGreaterThanOrEqual(WING_K[s].root - 1e-6); expect(Math.sign(pos.getZ(k))).toBe(wSide); }
      if (wSide > 0) right++; if (wSide < 0) left++;
      if (part.getY(k) > 0) legs++;
    }
    expect(left, s).toBeGreaterThan(0);
    expect(right, s).toBe(left);
    if (s === 'wader') expect(legs).toBeGreaterThan(0);
    g.dispose();
  }
});

test('sizes: pelican span ≈ 2.1 m, frigate ≈ 2.2 m, great egret ≈ 1 m tall, manatee 3–3.8 m long', () => {
  const box = (s: Shape) => { const g = buildFaunaShape(s); g.computeBoundingBox(); const b = g.boundingBox!; g.dispose(); return b; };
  expect(box('pelican').max.z * 2).toBeCloseTo(2.1, 1);
  expect(box('frigate').max.z * 2).toBeCloseTo(2.2, 1);
  expect(box('wader').max.y).toBeGreaterThan(0.95);
  expect(box('wader').max.y).toBeLessThan(1.1);
  expect(box('wader').min.y).toBeCloseTo(0, 2);
  const m = box('manatee');
  expect(m.max.x - m.min.x).toBeGreaterThan(3);
  expect(m.max.x - m.min.x).toBeLessThan(3.8);
});

test('wings face outward on both sides: top-face normals point up and agree with the triangle winding', () => {
  for (const s of ['pelican', 'frigate', 'wader'] as const) {
    for (const side of [-1, 1]) {
      const g = buildFaunaShape(s), pos = g.attributes.position, nor = g.attributes.normal, part = g.attributes.aPart;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
      let top = 0;
      for (let t = 0; t < pos.count; t += 3) {
        if (part.getX(t) !== side) continue;
        a.fromBufferAttribute(pos, t); b.fromBufferAttribute(pos, t + 1); c.fromBufferAttribute(pos, t + 2);
        n.crossVectors(b.sub(a), c.sub(a)).normalize();
        // A top-face triangle has all three vertices above the hinge (the side faces straddle it).
        const isTop = [t, t + 1, t + 2].every((k) => pos.getY(k) > WING_K[s].hinge);
        if (isTop) top++;
        for (let k = t; k < t + 3; k++) {
          // Winding agrees with the stored normal at every vertex of every wing triangle.
          expect(n.dot(new THREE.Vector3().fromBufferAttribute(nor, k)), `${s} ${side} winding`).toBeGreaterThan(0);
          if (isTop) expect(nor.getY(k), `${s} ${side} normal.y`).toBeGreaterThan(0);
        }
      }
      expect(top, `${s} ${side} top verts`).toBeGreaterThan(0);
      g.dispose();
    }
  }
});
