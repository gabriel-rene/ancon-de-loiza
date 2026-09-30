import { expect, test } from 'vitest';
import { HIP, WING_K } from './geometry';
import { animateVertex, faunaMaterials, ringMaterial } from './material';

const K = WING_K.wader, hip = HIP.wader;
const tip: [number, number, number] = [0, K.hinge, K.root + 0.64];

test('flap raises the wing tip; the body does not move', () => {
  const up = animateVertex(tip, [1, 0], [0.5, 0, 0], K, hip);
  expect(up[1]).toBeGreaterThan(K.hinge + 0.2);
  const body = animateVertex([0.1, 0.6, 0.05], [0, 0], [0.5, 1, 1], K, hip);
  expect(body).toEqual([0.1, 0.6, 0.05]);
});

test('fold pulls the tip in to the body side and back, and cancels the flap', () => {
  const f = animateVertex(tip, [1, 0], [0.5, 1, 0], K, hip);
  expect(f[2]).toBeLessThanOrEqual(K.root + 0.08 * 0.64 + 1e-6);
  expect(f[0]).toBeLessThan(-0.2);
  expect(f[1]).toBeCloseTo(K.hinge, 6);
});

test('left wing mirrors the right', () => {
  const r = animateVertex(tip, [1, 0], [0.4, 0.3, 0], K, hip), l = animateVertex([tip[0], tip[1], -tip[2]], [-1, 0], [0.4, 0.3, 0], K, hip);
  expect(l[0]).toBeCloseTo(r[0], 6); expect(l[1]).toBeCloseTo(r[1], 6); expect(l[2]).toBeCloseTo(-r[2], 6);
});

test('legs trail back in flight', () => {
  const foot = animateVertex([0, 0, 0.06], [0, 1], [0, 0, 1], K, hip);
  expect(foot[0]).toBeLessThan(-0.3);
  expect(foot[1]).toBeGreaterThan(0.1);
});

test('materials build', () => {
  const m = faunaMaterials('pelican'); expect(m.material).toBeTruthy(); expect(m.depth).toBeTruthy();
  m.material.dispose(); m.depth.dispose();
  const r = ringMaterial(); expect(r.transparent).toBe(true); expect(r.depthWrite).toBe(false); r.dispose();
});
