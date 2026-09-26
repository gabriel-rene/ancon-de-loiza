import { expect, test } from 'vitest';
import { CellStream, cellRng } from './rng';

test('cellRng is deterministic per (i, j, seed) and in [0,1)', () => {
  const a = cellRng(3, 7, 42), b = cellRng(3, 7, 42), c = cellRng(4, 7, 42);
  const va = [a(), a(), a()], vb = [b(), b(), b()];
  expect(va).toEqual(vb);
  expect(c()).not.toBe(va[0]);
  for (const v of va) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
});

test('CellStream reproduces cellRng', () => {
  const s = new CellStream();
  for (const [i, j, k] of [[0, 0, 1], [5, -3, 77], [1234, 99, 1841]]) {
    const r = cellRng(i, j, k);
    s.reset(i, j, k);
    for (let n = 0; n < 6; n++) expect(s.next()).toBe(r());
  }
});
