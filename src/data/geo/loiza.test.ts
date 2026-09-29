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

test('has the town outlines: the church, the plaza and ~120 buildings (spec 4b §1.1)', () => {
  expect(g.buildings.find((b) => b.id === '430399958')?.kind).toBe('church');
  expect(g.parks.find((p) => p.id === '429703572')?.name).toMatch(/Sanjurjo/);
  expect(g.buildings.length).toBeGreaterThan(100);
  expect(g.buildings.length).toBeLessThan(150);
});
