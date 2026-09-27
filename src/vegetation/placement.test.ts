import { describe, expect, test } from 'vitest';
import { crossingGeometry, landingClearings } from '../ancon/geometry';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { buildFields, WATER } from '../terrain/fields';
import { buildVegMasks, LANDING_CLEARING } from './masks';
import { placeAll, placeSpecies } from './placement';
import { RULES } from './rules';

const G = geo as unknown as GeoBundle;
const f = buildFields(G, { extent: 2560, size: 256, bankOffset: 0 });
const m = buildVegMasks(G, f);
const at = (arr: Float32Array | Uint8Array, x: number, z: number) => {
  const i = Math.floor((x - f.grid.minX) / f.grid.cell), j = Math.floor((z - f.grid.minZ) / f.grid.cell);
  return arr[j * f.grid.size + i];
};

describe('placement', () => {
  const all = placeAll(f, m, { redMangrove: 1, coconut: 1, casuarina: 1 }, 7);

  test('deterministic', () => {
    expect(placeAll(f, m, { redMangrove: 1, coconut: 1, casuarina: 1 }, 7)).toEqual(all);
  });
  test('plausible counts on the real map', () => {
    expect(all.redMangrove.length).toBeGreaterThan(400);
    expect(all.coconut.length).toBeGreaterThan(300);
    expect(all.casuarina.length).toBeGreaterThan(150);
  });
  test('mangroves hug the river, never the open coast', () => {
    for (const p of all.redMangrove) {
      expect(at(m.riverDist, p.x, p.z)).toBeLessThan(45);
      expect(at(f.seaDist, p.x, p.z)).toBeGreaterThanOrEqual(60);
    }
  });
  test('palms and pines stand on dry land, off roads', () => {
    for (const p of [...all.coconut, ...all.casuarina]) {
      expect(at(f.water, p.x, p.z)).toBe(WATER.LAND);
      expect(at(m.roadDist, p.x, p.z)).toBeGreaterThanOrEqual(5);
    }
  });
  test('occupancy keeps different species apart', () => {
    const big = [...all.casuarina, ...all.coconut];
    const r = Math.min(RULES.casuarina.radius, RULES.coconut.radius);
    // sample check: first 300 against all; track the minimum and assert once (expect() per pair is slow on CI)
    let min = Infinity;
    for (const a of big.slice(0, 300)) for (const b of big) {
      if (a !== b) min = Math.min(min, Math.hypot(a.x - b.x, a.z - b.z));
    }
    expect(min).toBeGreaterThanOrEqual(r - 1e-6);
  });
  test('density scales counts roughly linearly', () => {
    const full = placeSpecies(f, m, 'coconut', { density: 1, seed: 3 }).length;
    const half = placeSpecies(f, m, 'coconut', { density: 0.5, seed: 3 }).length;
    expect(half / full).toBeGreaterThan(0.35);
    expect(half / full).toBeLessThan(0.65);
  });
  test('per-species rotation range keeps baked leans downwind; mangroves spin freely', () => {
    for (const id of ['coconut', 'casuarina'] as const) for (const p of all[id]) expect(Math.abs(p.rot)).toBeLessThanOrEqual(RULES[id].rot);
    const rots = all.redMangrove.map((p) => p.rot);
    expect(Math.max(...rots) - Math.min(...rots)).toBeGreaterThan(5);
  });
  test('skip and spacingMul thin the candidate set', () => {
    const base = placeSpecies(f, m, 'coconut', { density: 1, seed: 3 }).length;
    expect(placeSpecies(f, m, 'coconut', { density: 1, seed: 3, spacingMul: 2 }).length).toBeLessThan(base * 0.5);
    expect(placeSpecies(f, m, 'coconut', { density: 1, seed: 3, skip: () => true })).toEqual([]);
  });
  test('ferry landings are kept clear', () => {
    const cell = f.grid.cell * Math.SQRT1_2; // mask is per cell: allow half a cell diagonal
    for (const [lx, lz] of landingClearings(crossingGeometry(f))) {
      for (const p of Object.values(all).flat()) expect(Math.hypot(p.x - lx, p.z - lz)).toBeGreaterThan(LANDING_CLEARING[0] - cell);
    }
  });
  test('instances sit on the terrain height', () => {
    for (const p of all.coconut.slice(0, 50)) expect(p.y).toBeGreaterThan(0);
  });
});
