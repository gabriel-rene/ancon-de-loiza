import { expect, test } from 'vitest';
import { sunAt, sunDirection } from './sun';

test('Dec 21 solar noon elevation ≈ 48° (research §1.3)', () => {
  expect(sunAt('2025-12-21', 12 + 21 / 60).elevation).toBeCloseTo(48, 0);
});
test('Jun 21 solar noon sun is ~85° high and to the north', () => {
  const s = sunAt('2026-06-21', 12 + 24 / 60);
  expect(s.elevation).toBeGreaterThan(84);
  expect(sunDirection(s.azimuth, s.elevation)[2]).toBeLessThan(0); // -Z is north
});
test('Jun 21 sunrise azimuth ≈ 65°', () => {
  const s = sunAt('2026-06-21', 5 + 47 / 60);
  expect(Math.abs(s.elevation)).toBeLessThan(1.5);
  expect(s.azimuth).toBeGreaterThan(63);
  expect(s.azimuth).toBeLessThan(67);
});
test('sunDirection is unit length', () => {
  const [x, y, z] = sunDirection(200, 20);
  expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
});
