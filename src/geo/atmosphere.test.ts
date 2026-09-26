import { expect, test } from 'vitest';
import { atmosphereFor } from './atmosphere';

test('low sun is warmer than high sun', () => {
  const low = atmosphereFor(4), high = atmosphereFor(60);
  expect(low.sunColor[0] / low.sunColor[2]).toBeGreaterThan(high.sunColor[0] / high.sunColor[2]);
});
test('sun below horizon gives no direct light', () => {
  expect(atmosphereFor(-6).sunIntensity).toBe(0);
});
test('haze is thicker near the horizon', () => {
  expect(atmosphereFor(3).fogDensity).toBeGreaterThan(atmosphereFor(60).fogDensity);
});
