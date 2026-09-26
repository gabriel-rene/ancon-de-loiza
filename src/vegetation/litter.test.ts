import { expect, test } from 'vitest';
import { makeGrid } from '../terrain/raster';
import { litterMap } from './litter';

test('litter: dense stand saturates, lone tree is faint, empty ground is bare', () => {
  const g = makeGrid(2560, 256);
  const trees = [];
  for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) trees.push({ x: 400 + i * 7, y: 0, z: 400 + j * 7, rot: 0, scale: 1, variant: 0 });
  trees.push({ x: -800, y: 0, z: -800, rot: 0, scale: 1, variant: 0 });
  const m = litterMap(trees, g, 256);
  const at = (x: number, z: number) => m[Math.floor((z - g.minZ) / 10) * 256 + Math.floor((x - g.minX) / 10)];
  expect(at(440, 440)).toBe(255);
  expect(at(-800, -800)).toBeGreaterThan(0);
  expect(at(-800, -800)).toBeLessThan(160);
  expect(at(0, 0)).toBe(0);
});
