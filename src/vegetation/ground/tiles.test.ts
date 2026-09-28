import { expect, test } from 'vitest';
import { TileCache, tileKey, tilesInRadius } from './tiles';

test('tilesInRadius covers the disc, nearest first, nothing far outside', () => {
  const t = tilesInRadius(10, 10, 60, 32);
  expect(t[0]).toEqual([0, 0]);
  for (const [i, j] of t) {
    const nx = Math.max(i * 32, Math.min(10, (i + 1) * 32)), nz = Math.max(j * 32, Math.min(10, (j + 1) * 32));
    expect(Math.hypot(nx - 10, nz - 10)).toBeLessThanOrEqual(60);
  }
  expect(t.length).toBeGreaterThan(12); expect(t.length).toBeLessThan(40);
});
test('TileCache places each tile once and evicts the oldest', () => {
  let calls = 0;
  const c = new TileCache(() => { calls++; return { grass: [], reeds: [], morningGlory: [] }; }, 2);
  c.get(0, 0); c.get(0, 0); c.get(1, 0); c.get(2, 0); c.get(0, 0);
  expect(calls).toBe(4);
  expect(tileKey(-1, 3)).toBe('-1,3');
});
