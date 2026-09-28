import { describe, expect, test } from 'vitest';
import geo from '../../data/geo/loiza.json';
import type { GeoBundle, XZ } from '../../data/geo/types';
import { CANE_CELL, caneLayout, inCane, MIN_CELLS, shownMask } from './caneFields';

const G = geo as unknown as GeoBundle;
const pip = (r: XZ[], x: number, z: number) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i], [xj, zj] = r[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};
const L = caneLayout(G);
const centre = (k: number) => {
  const g = L.grid, i = k % g.size, j = Math.floor(k / g.size);
  return [g.minX + (i + 0.5) * g.cell, g.minZ + (j + 0.5) * g.cell] as const;
};

describe('caneLayout', () => {
  test('uses CANE_CELL-metre cells and is deterministic', () => {
    expect(L.grid.cell).toBe(CANE_CELL);
    expect(caneLayout(G).field).toEqual(L.field);
  });
  test('field count is plausible for ~3.2 km² of grassland at ~220 m pitch', () => {
    expect(L.fields.length).toBeGreaterThanOrEqual(30);
    expect(L.fields.length).toBeLessThanOrEqual(120);
    for (const f of L.fields) {
      expect(f.cells).toBeGreaterThanOrEqual(MIN_CELLS);
      expect(f.rank).toBeGreaterThanOrEqual(0); expect(f.rank).toBeLessThan(1);
      expect(f.height).toBeGreaterThanOrEqual(2.5); expect(f.height).toBeLessThanOrEqual(3.5);
    }
  });
  test('every cane cell is inside the grassland and outside water', () => {
    const grass = G.land.filter((l) => l.kind === 'grassland').map((l) => l.ring);
    for (let k = 0; k < L.field.length; k += 7) if (L.field[k] >= 0) {
      const [x, z] = centre(k);
      expect(grass.some((r) => pip(r, x, z)), `${x},${z}`).toBe(true);
      expect(G.water.some((w) => pip(w.ring, x, z)), `${x},${z}`).toBe(false);
    }
  });
  test('lanes: no two 4-neighbour cells belong to different fields', () => {
    const n = L.grid.size;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = L.field[j * n + i];
      if (a < 0) continue;
      if (i + 1 < n) { const b = L.field[j * n + i + 1]; if (b >= 0) expect(b).toBe(a); }
      if (j + 1 < n) { const b = L.field[(j + 1) * n + i]; if (b >= 0) expect(b).toBe(a); }
    }
  });
});

describe('shownMask / inCane', () => {
  const m0 = shownMask(L, 0), m3 = shownMask(L, 0.3), m6 = shownMask(L, 0.6), m1 = shownMask(L, 1);
  test('era shares nest: 0 ⊆ 0.3 ⊆ 0.6 ⊆ 1', () => {
    for (let k = 0; k < m1.length; k++) {
      expect(m0[k]).toBe(0);
      if (m3[k]) expect(m6[k]).toBe(1);
      if (m6[k]) expect(m1[k]).toBe(1);
      expect(m1[k]).toBe(L.field[k] >= 0 ? 1 : 0);
    }
  });
  test('share ≈ fraction of fields shown', () => {
    const f = L.fields.filter((x) => x.rank < 0.6).length / L.fields.length;
    expect(f).toBeGreaterThan(0.4); expect(f).toBeLessThan(0.8);
  });
  test('inCane matches the mask', () => {
    const hit = inCane(L, m1);
    let k = L.field.findIndex((v) => v >= 0);
    expect(hit(...centre(k))).toBe(true);
    k = L.field.findIndex((v) => v < 0);
    expect(hit(...centre(k))).toBe(false);
    expect(hit(1e6, 1e6)).toBe(false);
  });
});
