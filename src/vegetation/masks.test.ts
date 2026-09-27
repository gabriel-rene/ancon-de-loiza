import { describe, expect, test } from 'vitest';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { buildFields } from '../terrain/fields';
import { buildVegMasks } from './masks';

const G = geo as unknown as GeoBundle;

describe('buildVegMasks', () => {
  test('does not throw when a landing has no river within reach (far-ring-field grids can lose it; masks.ts:28)', () => {
    // crossingGeometry → nearestShore searches only 150 m for a RIVER cell near each landing. A coarse
    // or otherwise ill-suited grid (the far vegetation-ring fields, whose extent and cell size differ
    // from the near fields the crossing was designed against) can come up empty and throw. This used to
    // propagate out of buildVegMasks and crash placement; it must instead skip the landing clearings.
    const emptyWater: GeoBundle = { ...G, water: [] };
    const f = buildFields(emptyWater, { extent: 10240, size: 128, bankOffset: 0 });
    expect(() => buildVegMasks(emptyWater, f)).not.toThrow();
    const masks = buildVegMasks(emptyWater, f);
    expect(masks.clear.every((v) => v === 0)).toBe(true);   // no landings found → no clearings carved
  });

  test('near fields (fine grid) still carve out the two landing clearings', () => {
    const near = buildFields(G, { extent: 2560, size: 512, bankOffset: 0 });
    const m = buildVegMasks(G, near);
    let max = 0;
    for (const v of m.clear) max = Math.max(max, v);
    expect(max).toBeGreaterThan(0.9);
  });
});
