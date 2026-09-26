import { expect, test } from 'vitest';
import geo from './loiza.json';
import type { GeoBundle } from './types';

const g = geo as unknown as GeoBundle;

test('has the river polygon and coastline', () => {
  expect(g.water.some((w) => w.kind === 'river' && w.ring.length > 100)).toBe(true);
  expect(g.coastline.length).toBeGreaterThanOrEqual(3);
});
test('has the PR-187 bridge near the crossing', () => {
  const bridge = g.roads.find((r) => r.bridge && r.ref?.includes('187'));
  expect(bridge).toBeDefined();
  expect(Math.min(...bridge!.points.map(([x, z]) => Math.hypot(x, z)))).toBeLessThan(300);
});
test('bundle stays small', () => {
  expect(JSON.stringify(g).length).toBeLessThan(1_500_000);
});
