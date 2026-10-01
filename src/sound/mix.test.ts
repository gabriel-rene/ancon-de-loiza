import { expect, test } from 'vitest';
import { createLevels, GAIN, mixLevels, type MixInput } from './mix';

const base: MixInput = { view: 'ride', sunElevation: 10, dip: 0, bridgeOpen: false };
const mix = (p: Partial<MixInput>) => mixLevels({ ...base, ...p }, createLevels());

test('water is loudest on the ferry and quietest from the sky, and always a quiet bed', () => {
  const ride = mix({ view: 'ride' }), shore = mix({ view: 'shore' }), sky = mix({ view: 'sky' });
  expect(ride.water).toBeGreaterThan(shore.water); expect(shore.water).toBeGreaterThan(sky.water);
  expect(ride.water).toBeLessThanOrEqual(0.2);
});
test('dev views mix like Shore', () => {
  expect(mix({ view: 'bridge' })).toEqual(mix({ view: 'shore' }));
});
test('master follows the era dip: 1 − opacity, clamped', () => {
  expect(mix({ dip: 0 }).master).toBe(1);
  expect(mix({ dip: 0.25 }).master).toBeCloseTo(0.75);
  expect(mix({ dip: 1 }).master).toBe(0);
  expect(mix({ dip: 1.2 }).master).toBe(0);
});
test('bird calls drop to 0.2× at night (sun 6° below the horizon), full by sunrise', () => {
  expect(mix({ sunElevation: 5 }).birdRate).toBe(1);
  expect(mix({ sunElevation: 0 }).birdRate).toBe(1);
  expect(mix({ sunElevation: -3 }).birdRate).toBeCloseTo(0.6);
  expect(mix({ sunElevation: -20 }).birdRate).toBeCloseTo(0.2);
});
test('traffic hum only while the bridge is open (1986)', () => {
  expect(mix({ bridgeOpen: false }).traffic).toBe(0);
  expect(mix({ bridgeOpen: true }).traffic).toBe(GAIN.traffic);
});
test('writes into and returns `out`', () => {
  const out = createLevels();
  expect(mixLevels(base, out)).toBe(out);
});
