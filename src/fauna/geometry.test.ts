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
