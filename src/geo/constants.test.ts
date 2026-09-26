import { expect, test } from 'vitest';
import { RIVER_DIR, WIND_DIR } from './constants';

test('river flows SW→NE and wind blows toward the WSW, both unit length', () => {
  expect(Math.hypot(...RIVER_DIR)).toBeCloseTo(1, 9);
  expect(Math.hypot(...WIND_DIR)).toBeCloseTo(1, 9);
  expect(RIVER_DIR[0]).toBeGreaterThan(0); expect(RIVER_DIR[1]).toBeLessThan(0);   // east, north
  expect(WIND_DIR[0]).toBeLessThan(0); expect(WIND_DIR[1]).toBeGreaterThan(0);     // west, south
});
