import { describe, expect, test } from 'vitest';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { landmarkXZ } from '../data/landmarks';
import { buildFields, sampleField, WATER, SEA_SEED } from './fields';

const f = buildFields(geo as unknown as GeoBundle, { extent: 2560, size: 256, bankOffset: 0 });
const at = (arr: Float32Array | Uint8Array, [x, z]: [number, number]) => {
  const i = Math.floor((x - f.grid.minX) / f.grid.cell), j = Math.floor((z - f.grid.minZ) / f.grid.cell);
  return arr[j * f.grid.size + i];
};

describe('real fields', () => {
  test('crossing midpoint is river, ≥1 m deep', () => {
    expect(at(f.water, [0, 0])).toBe(WATER.RIVER);
    expect(sampleField(f, f.height, 0, 0)).toBeLessThan(-1);
  });
  test('open sea off the mouth', () => expect(at(f.water, SEA_SEED)).toBe(WATER.SEA));
  test('town plaza is dry land above 0.5 m', () => {
    const p = landmarkXZ('plaza');
    expect(at(f.water, p)).toBe(WATER.LAND);
    expect(sampleField(f, f.height, ...p)).toBeGreaterThan(0.5);
  });
  test('shore distance is negative in water, positive on land', () => {
    expect(at(f.shore, [0, 0])).toBeLessThan(0);
    expect(at(f.shore, landmarkXZ('church'))).toBeGreaterThan(0);
  });
  test('bankOffset widens the river', () => {
    const wide = buildFields(geo as unknown as GeoBundle, { extent: 2560, size: 256, bankOffset: 10 });
    const count = (w: Uint8Array) => w.reduce((n, v) => n + (v === WATER.RIVER ? 1 : 0), 0);
    expect(count(wide.water)).toBeGreaterThan(count(f.water));
  });
});
