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
test('golden-hour haze is warm toward the sun and cool away from it', () => {
  const a = atmosphereFor(6);
  expect(a.fogColor[0] / a.fogColor[2]).toBeGreaterThan(1.5);
  expect(a.fogAway[2] / a.fogAway[0]).toBeGreaterThan(1.1);
});
test('the sky is haziest at golden hour', () => {
  expect(atmosphereFor(6).skyHaze).toBeGreaterThan(atmosphereFor(60).skyHaze);
});
