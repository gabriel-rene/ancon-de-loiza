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

// Round 2 (controller ruling R12): the round-1 fix made the fogColor ratios pass in
// isolation, but the rendered noon scene still read as a washed-out, low-contrast, cool
// mint — driven by the away-from-sun haze colour, the ambient (environment-map) fill
// dimming much less than the direct grade balance/saturation did, and saturation dropping
// too far. These tests pin the atmosphere-level values that fixed it; the actual
// region-based (ground/water/horizon-haze) verification is real-scene, via
// `scripts/dev/hue.mjs`, and recorded in docs/superpowers/notes/phase-2b-rulings.md.
test('noon away-from-sun haze reads near-neutral, not cool blue (feeds the horizon-haze read)', () => {
  const a = atmosphereFor(60);
  expect(a.fogAway[0] / a.fogAway[2]).toBeGreaterThan(0.9);
});
test('ambient (environment-map) fill is meaningfully dimmer at high sun than golden hour', () => {
  // A golden-hour-sized ambient fill at noon is what makes the blue sky wash the grass
  // toward mint; the ratio (not just an ordering) is what changed in round 2.
  const ratio = atmosphereFor(6).envIntensity / atmosphereFor(60).envIntensity;
  expect(ratio).toBeGreaterThan(1.3);
});
test('midday grade keeps most of its saturation, avoiding a washed-out look', () => {
  expect(atmosphereFor(60).saturation).toBeGreaterThanOrEqual(1.1);
});
