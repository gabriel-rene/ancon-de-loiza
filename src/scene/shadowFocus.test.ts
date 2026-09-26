import { expect, test } from 'vitest';
import { shadowFocus } from './shadowFocus';

const SUN: [number, number, number] = [-0.6, 0.35, 0.72];
const n = (v: number[]) => { const l = Math.hypot(...v); return v.map((x) => x / l) as [number, number, number]; };

test('focus sits on the ground ahead of a downward-looking camera', () => {
  const { target } = shadowFocus([0, 50, 100], n([0, -1, -1]), n(SUN), 140, 4096);
  expect(target[1]).toBeCloseTo(0, 0);
  expect(target[2]).toBeGreaterThan(40); expect(target[2]).toBeLessThan(60); // hits y=0 at z≈50
});
test('horizontal camera focuses a clamped distance ahead', () => {
  const { target } = shadowFocus([0, 4, 0], [0, 0, -1], n(SUN), 140, 4096);
  expect(-target[2]).toBeGreaterThan(60); expect(-target[2]).toBeLessThanOrEqual(141);
});
test('light position is 1500 m toward the sun from the target', () => {
  const s = n(SUN);
  const { target, position } = shadowFocus([0, 4, 0], [0, 0, -1], s, 140, 4096);
  for (let i = 0; i < 3; i++) expect(position[i] - target[i]).toBeCloseTo(s[i] * 1500, 3);
});
test('small camera moves do not move the shadow grid off texel multiples (no shimmer)', () => {
  const s = n(SUN), texel = (2 * 140) / 4096;
  const a = shadowFocus([0, 4, 0], [0, 0, -1], s, 140, 4096).target;
  const b = shadowFocus([0.013, 4, 0.021], [0, 0, -1], s, 140, 4096).target;
  // Project the difference onto the light's right/up axes: must be a whole number of texels.
  const up = [0, 1, 0];
  const right = n([up[1] * s[2] - up[2] * s[1], up[2] * s[0] - up[0] * s[2], up[0] * s[1] - up[1] * s[0]]);
  const d = a.map((v, i) => v - b[i]);
  const k = (d[0] * right[0] + d[1] * right[1] + d[2] * right[2]) / texel;
  expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
});
