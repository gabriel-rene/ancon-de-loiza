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
test('noon haze is near-neutral, not teal', () => {
  const a = atmosphereFor(60);
  expect(a.fogColor[1] / a.fogColor[0]).toBeLessThan(1.1);
  expect(a.fogColor[2] / a.fogColor[0]).toBeLessThan(1.25);
});
// Controller ruling R2: the golden-hour invariance check uses atmosphereFor(3) (there
// high = smooth(3, 35, 3) = 0) for exact equality with the pre-existing constant grade
// balance/saturation, plus atmosphereFor(6) within 0.02/component since it is not exactly
// at the golden end of the high-sun ramp.
test('grade balance/saturation at pure golden hour match the old constant exactly', () => {
  const a = atmosphereFor(3);
  expect(a.balance).toEqual([1.06, 1.0, 0.9]);
  expect(a.saturation).toBe(1.15);
});
test('grade balance near golden hour stays close to the old constant', () => {
  const a = atmosphereFor(6);
  const old: [number, number, number] = [1.06, 1.0, 0.9];
  a.balance.forEach((v, i) => expect(Math.abs(v - old[i])).toBeLessThan(0.02));
});
