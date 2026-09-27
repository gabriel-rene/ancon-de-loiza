// src/ancon/rope.test.ts
import { expect, test } from 'vitest';
import { MAX_SAG, spanSag, tubeIndex, writeRopeLine, writeSpan, writeTube, type V3 } from './rope';

test('sag grows with span and slack, capped', () => {
  expect(spanSag(150, 0)).toBeCloseTo(0.6, 9);
  expect(spanSag(150, 1)).toBeGreaterThan(spanSag(150, 0.5));
  expect(spanSag(1000, 1)).toBe(MAX_SAG);
});
test('a taut 150 m span stays above the water, a slack one dips into it (ends 1.4 m up)', () => {
  const a: V3 = [0, 1.4, 0], b: V3 = [150, 1.4, 0], out = new Float32Array(3 * 41);
  writeSpan(a, b, spanSag(150, 0), 40, out, 0);
  expect(Math.min(...Array.from({ length: 41 }, (_, i) => out[i * 3 + 1]))).toBeGreaterThan(0.5);
  writeSpan(a, b, spanSag(150, 1), 40, out, 0);
  expect(out[20 * 3 + 1]).toBeLessThan(0);
});
test('span endpoints exact, midpoint lowered by the sag, symmetric', () => {
  const out = new Float32Array(3 * 11), a: V3 = [1, 2, 3], b: V3 = [11, 4, -7];
  expect(writeSpan(a, b, 0.5, 10, out, 0)).toBe(11);
  expect(Array.from(out.slice(0, 3))).toEqual(a);
  expect(Array.from(out.slice(30, 33))).toEqual(b);
  expect(out[5 * 3 + 1]).toBeCloseTo(3 - 0.5, 9);
  expect(out[2 * 3 + 1] - (2 + 0.2 * 2)).toBeCloseTo(out[8 * 3 + 1] - (2 + 0.8 * 2), 5);   // float32 output
});
test('rope line = post → guide, guide → post; the deck run is the straight segment between the spans', () => {
  const out = new Float32Array(3 * 2 * 21);
  const n = writeRopeLine([0, 1, 0], [50, 1.4, 0], [57, 1.4, 0], [200, 1, 0], 0, 20, out);
  expect(n).toBe(42);
  expect(Array.from(out.slice(20 * 3, 21 * 3))).toEqual([50, 1.4, 0].map(Math.fround));
  expect(Array.from(out.slice(21 * 3, 22 * 3))).toEqual([57, 1.4, 0].map(Math.fround));
});
test('tube: rings at the radius, unit normals, outward winding', () => {
  const pts = new Float32Array([0, 0, 0, 1, 0, 0, 2, 0.2, 0]), r = 0.03, radial = 6;
  const pos = new Float32Array(3 * radial * 3), nrm = new Float32Array(pos.length);
  writeTube(pts, 3, r, radial, pos, nrm);
  for (let i = 0; i < 3; i++) for (let j = 0; j < radial; j++) {
    const k = (i * radial + j) * 3;
    expect(Math.hypot(pos[k] - pts[i * 3], pos[k + 1] - pts[i * 3 + 1], pos[k + 2] - pts[i * 3 + 2])).toBeCloseTo(r, 6);
    expect(Math.hypot(nrm[k], nrm[k + 1], nrm[k + 2])).toBeCloseTo(1, 6);
  }
  const idx = tubeIndex(3, radial);
  expect(idx.length).toBe(2 * radial * 6);
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]].map((v) => v * 3);
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    expect(fn[0] * nrm[a] + fn[1] * nrm[a + 1] + fn[2] * nrm[a + 2]).toBeGreaterThan(0);
  }
});
