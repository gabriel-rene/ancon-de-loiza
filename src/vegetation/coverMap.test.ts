import { describe, expect, test } from 'vitest';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { crossingGeometry, landingClearings } from '../ancon/geometry';
import { buildFields, SEA_SEED, WATER } from '../terrain/fields';
import { coverMap } from './coverMap';
import { buildVegMasks, LANDING_CLEARING } from './masks';
import { siteAt } from './placement';
import { GROUND_ORDER, RULES } from './rules';

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

  // The far tint must agree with where the near clumps can grow: none in a landing clearing and
  // none where every ground rule's density is 0 (open sea, river, roads).
  const cell = (f.grid.cell * f.grid.size) / size;
  const texel = (i: number, j: number) => {
    const x = f.grid.minX + (i + 0.5) * cell, z = f.grid.minZ + (j + 0.5) * cell, k = (j * size + i) * 4;
    return { x, z, s: siteAt(f, m, x, z), rgb: [c[k], c[k + 1], c[k + 2]] };
  };

  test('landing clearings are bare, like the placement', () => {
    for (const [lx, lz] of landingClearings(crossingGeometry(f))) {
      let checked = 0;
      for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
        const t = texel(i, j);
        if (Math.hypot(t.x - lx, t.z - lz) > LANDING_CLEARING[0] || !t.s) continue;
        if (t.s.clear >= 1) { expect(t.rgb).toEqual([0, 0, 0]); checked++; }
      }
      expect(checked).toBeGreaterThan(0);
    }
  });

  test('cover is 0 wherever every ground rule gives density 0 (sea, river, roads)', () => {
    let road = 0, water = 0;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const t = texel(i, j);
      if (!t.s || GROUND_ORDER.some((id) => RULES[id].density(t.s!) > 0)) continue;
      expect(t.rgb).toEqual([0, 0, 0]);
      if (t.s.water !== WATER.LAND) water++; else if (t.s.roadDist < 2) road++;
    }
    expect(water).toBeGreaterThan(1000);
    expect(road).toBeGreaterThan(10);
  });

  test('zero densities produce an all-zero RGB map', () => {
    const zero = coverMap(f, m, { grass: 0, reeds: 0, morningGlory: 0 }, size);
    for (let k = 0; k < size * size; k++) {
      expect(zero[k * 4]).toBe(0);
      expect(zero[k * 4 + 1]).toBe(0);
      expect(zero[k * 4 + 2]).toBe(0);
    }
  });

  test('skip zeroes the cover weights where it returns true', () => {
    const dens = { grass: 1, reeds: 1, morningGlory: 1 };
    const a = coverMap(f, m, dens, 64), b = coverMap(f, m, dens, 64, () => true);
    expect(a.some((v, i) => i % 4 !== 3 && v > 0)).toBe(true);
    expect(b.every((v, i) => (i % 4 === 3 ? v === 255 : v === 0))).toBe(true);
  });
});
