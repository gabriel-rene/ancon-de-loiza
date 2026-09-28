import { describe, expect, test } from 'vitest';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { buildFields, SEA_SEED } from '../terrain/fields';
import { coverMap } from './coverMap';
import { buildVegMasks } from './masks';

const G = geo as unknown as GeoBundle;
const f = buildFields(G, { extent: 2560, size: 256, bankOffset: 0 });
const m = buildVegMasks(G, f);

describe('coverMap', () => {
  const size = 256;
  const c = coverMap(f, m, { grass: 1, reeds: 1, morningGlory: 1 }, size);

  test('has one RGBA texel per grid cell', () => {
    expect(c.length).toBe(size * size * 4);
  });

  test('sea is bare: all three cover channels are 0 under SEA_SEED', () => {
    const i = Math.floor((SEA_SEED[0] - f.grid.minX) / (f.grid.cell * f.grid.size / size));
    const j = Math.floor((SEA_SEED[1] - f.grid.minZ) / (f.grid.cell * f.grid.size / size));
    const k = (j * size + i) * 4;
    expect(c[k]).toBe(0);
    expect(c[k + 1]).toBe(0);
    expect(c[k + 2]).toBe(0);
  });

  test('grass channel is non-trivial over the map', () => {
    let nonzero = 0;
    for (let k = 0; k < size * size; k++) if (c[k * 4] > 0) nonzero++;
    expect(nonzero / (size * size)).toBeGreaterThan(0.05);
  });

  test('zero densities produce an all-zero RGB map', () => {
    const zero = coverMap(f, m, { grass: 0, reeds: 0, morningGlory: 0 }, size);
    for (let k = 0; k < size * size; k++) {
      expect(zero[k * 4]).toBe(0);
      expect(zero[k * 4 + 1]).toBe(0);
      expect(zero[k * 4 + 2]).toBe(0);
    }
  });
});
