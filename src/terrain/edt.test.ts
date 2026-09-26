import { expect, test } from 'vitest';
import { distanceTransform } from './edt';

test('distance to a single seed', () => {
  const w = 7, h = 5, m = new Uint8Array(w * h);
  m[2 * w + 3] = 1;
  const d = distanceTransform(m, w, h);
  expect(d[2 * w + 3]).toBe(0);
  expect(d[2 * w + 6]).toBeCloseTo(3, 5);
  expect(d[0]).toBeCloseTo(Math.hypot(3, 2), 5);
});
