import { expect, test } from 'vitest';
import { goldenHourAST, sunAt, sunDirection } from './sun';

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
test('goldenHourAST puts the sun ≈ 6° up, later in July than in December', () => {
  const jul = goldenHourAST('1975-07-27'), dec = goldenHourAST('2025-12-21');
  expect(sunAt('1975-07-27', jul).elevation).toBeCloseTo(6, 0);
  expect(sunAt('2025-12-21', dec).elevation).toBeCloseTo(6, 0);
  // Sunsets: July ≈ 19:01, December ≈ 17:52 AST (research §1.3); 6° is ~25–30 min before.
  expect(jul).toBeGreaterThan(18.3); expect(jul).toBeLessThan(18.75);
  expect(dec).toBeGreaterThan(17.2); expect(dec).toBeLessThan(17.6);
  expect(sunAt('1975-07-27', jul + 0.05).elevation).toBeLessThan(6); // afternoon (descending) crossing
});
test('goldenHourAST accepts a custom elevation', () => {
  expect(goldenHourAST('1975-07-27', 2)).toBeGreaterThan(goldenHourAST('1975-07-27', 6));
});
test('goldenHourAST morning crossing', () => {
  const am = goldenHourAST('2026-06-21', 6, 'am');
  // Jun 21 sunrise ≈ 5:47 AST; 6° is ~25–30 min later, with the sun still rising.
  expect(am).toBeGreaterThan(6.0); expect(am).toBeLessThan(6.4);
  expect(sunAt('2026-06-21', am).elevation).toBeCloseTo(6, 0);
  expect(sunAt('2026-06-21', am + 0.05).elevation).toBeGreaterThan(6);
});
