import { expect, test } from 'vitest';
import { cellRng } from './rng';

test('cellRng is deterministic per (i, j, seed) and in [0,1)', () => {
  const a = cellRng(3, 7, 42), b = cellRng(3, 7, 42), c = cellRng(4, 7, 42);
  const va = [a(), a(), a()], vb = [b(), b(), b()];
  expect(va).toEqual(vb);
  expect(c()).not.toBe(va[0]);
  for (const v of va) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
});
