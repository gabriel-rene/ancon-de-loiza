import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import geo from '../../data/geo/loiza.json';
import type { GeoBundle } from '../../data/geo/types';
import { buildFields, WATER } from '../../terrain/fields';
import { caneLayout, shownMask, type CaneLayout } from './caneFields';
import { caneHeightAt, caneWaterAt } from './CaneFieldsMesh';
import { buildCaneGeometry, CANE_FRINGE, CANE_SINK, trimSteep, trimWet } from './caneMesh';

const tris = (g: THREE.BufferGeometry) => g.index!.count / 3;
/** 4×4 cells of 10 m at the origin; one 2×2 field in the middle (cells (1,1)–(2,2)). */
function tiny(): CaneLayout {
  const field = new Int32Array(16).fill(-1);
  for (const [i, j] of [[1, 1], [2, 1], [1, 2], [2, 2]]) field[j * 4 + i] = 0;
  return { grid: { size: 4, cell: 10, minX: 0, minZ: 0 }, field, fields: [{ rank: 0.1, height: 3, cells: 4 }] };
}

describe('buildCaneGeometry', () => {
  const L = tiny(), ground = (x: number) => 0.01 * x; // linear (sloped), so a per-vertex sample would vary
  const { top, sides } = buildCaneGeometry(L, shownMask(L, 1), ground);
  // Mirrors the production mean: ground at every shown cell's centre, averaged, plus field height.
  const cellCentres: [number, number][] = [];
  for (let k = 0; k < L.field.length; k++) if (L.field[k] === 0) {
    const i = k % L.grid.size, j = Math.floor(k / L.grid.size);
    cellCentres.push([L.grid.minX + (i + 0.5) * L.grid.cell, L.grid.minZ + (j + 0.5) * L.grid.cell]);
  }
  const flatTop = cellCentres.reduce((s, [x]) => s + ground(x), 0) / cellCentres.length + L.fields[0].height;

  test('top: one merged quad per row run; every vertex of a field is flat at its mean ground + field height', () => {
    expect(tris(top)).toBe(4);
    const p = top.getAttribute('position');
    for (let i = 0; i < p.count; i++) expect(p.getY(i)).toBeCloseTo(flatTop, 5);
  });
  test('sides: one quad per straight boundary run; bottom follows local ground (− CANE_SINK), top is the field’s flat Y (+ CANE_FRINGE)', () => {
    expect(tris(sides)).toBe(8);
    const p = sides.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), x = p.getX(i);
      const atBottom = Math.abs(y - (ground(x) - CANE_SINK)) < 1e-5;
      const atTop = Math.abs(y - (flatTop + CANE_FRINGE)) < 1e-5;
      expect(atBottom || atTop, `y=${y} at x=${x} matched neither bottom nor top`).toBe(true);
    }
  });
  test('side normals point out of the field', () => {
    const p = sides.getAttribute('position'), n = sides.getAttribute('normal');
    for (let i = 0; i < p.count; i++) expect((p.getX(i) - 20) * n.getX(i) + (p.getZ(i) - 20) * n.getZ(i)).toBeGreaterThan(0);
  });
  test('aFlex: top 0.35, sides 0 → 0.5', () => {
    expect([...(top.getAttribute('aFlex').array as Float32Array)].every((v) => Math.abs(v - 0.35) < 1e-6)).toBe(true);
    const f = sides.getAttribute('aFlex').array as Float32Array;
    expect(Math.min(...f)).toBeCloseTo(0, 5); expect(Math.max(...f)).toBeCloseTo(0.5, 5);
  });
  test('nothing shown ⇒ empty geometry', () => {
    const e = buildCaneGeometry(L, shownMask(L, 0), ground);
    expect(tris(e.top)).toBe(0); expect(tris(e.sides)).toBe(0);
  });
  test('real layout, all fields shown: within the 60 000-triangle budget', () => {
    const R = caneLayout(geo as unknown as GeoBundle);
    const g = buildCaneGeometry(R, shownMask(R, 1), () => 1);
    expect(tris(g.top) + tris(g.sides)).toBeLessThanOrEqual(60_000);
    expect(tris(g.top)).toBeGreaterThan(0);
  });
});

describe('trimSteep', () => {
  /** One row of five 10 m cells, all one field; ground per cell centre falls downhill: 1, 1, 1, −1, −2 (mean 0). */
  const row: CaneLayout = {
    grid: { size: 5, cell: 10, minX: 0, minZ: 0 },
    field: Int32Array.from({ length: 25 }, (_, k) => (k < 5 ? 0 : -1)),
    fields: [{ rank: 0.1, height: 3, cells: 5 }],
  };
  const slope = [1, 1, 1, -1, -2];
  const sloped = (x: number) => slope[Math.floor(x / 10)];
  const shown = shownMask(row, 1);

  test('drops a cell 2 m below its field mean, keeps one 1 m below', () => {
    const out = trimSteep(row, shown, sloped);
    expect(Array.from(out.slice(0, 5))).toEqual([1, 1, 1, 1, 0]);
    expect(Array.from(shown.slice(0, 5))).toEqual([1, 1, 1, 1, 1]); // input untouched
  });

  test('flat ground: nothing dropped', () => {
    expect(Array.from(trimSteep(row, shown, () => 0.4))).toEqual(Array.from(shown));
  });

  test('hidden cells stay hidden and do not count toward the mean', () => {
    const half = shown.slice(); half[0] = half[1] = half[2] = 0; // mean of shown = −1.5
    expect(Array.from(trimSteep(row, half, sloped).slice(0, 5))).toEqual([0, 0, 0, 1, 1]);
  });
});

describe('trimWet', () => {
  /** Six 10 m cells in a row; cell 4 (centre x=45) sits on river water. Cell 3's centre (x=35) is
   * exactly the 5 m water buffer away from cell 4's, so it is dropped too; cell 2 (x=25, 15 m from
   * the water) is not. */
  const row: CaneLayout = {
    grid: { size: 6, cell: 10, minX: 0, minZ: 0 },
    field: Int32Array.from({ length: 36 }, (_, k) => (k < 6 ? 0 : -1)),
    fields: [{ rank: 0.1, height: 3, cells: 6 }],
  };
  const shown = shownMask(row, 1);
  const waterAt = (x: number) => (Math.floor(x / 10) === 4 ? WATER.RIVER : WATER.LAND);

  test('drops a wet cell and its buffer neighbour, keeps cells further away', () => {
    expect(Array.from(trimWet(row, shown, waterAt).slice(0, 6))).toEqual([1, 1, 1, 0, 0, 1]);
    expect(Array.from(shown.slice(0, 6))).toEqual([1, 1, 1, 1, 1, 1]); // input untouched
  });

  test('all dry: nothing dropped', () => {
    expect(Array.from(trimWet(row, shown, () => WATER.LAND))).toEqual(Array.from(shown));
  });

  test('an already-hidden wet cell stays hidden (never re-shown) and still buffers its neighbour', () => {
    const half = shown.slice(); half[4] = 0; // cell 4 (the river cell) already hidden
    expect(Array.from(trimWet(row, half, waterAt).slice(0, 6))).toEqual([1, 1, 1, 0, 0, 1]);
  });
});

describe('trimWet + trimSteep on the real layout', () => {
  const G = geo as unknown as GeoBundle;
  const L = caneLayout(G);
  // High-tier sizes (src/scene/useWorldFields.ts): near extent 2560/size 512, far extent 10240/size 512.
  const near = buildFields(G, { extent: 2560, size: 512, bankOffset: 8 });
  const far = buildFields(G, { extent: 10240, size: 512, bankOffset: 8 });
  const heightAt = caneHeightAt(near, far), waterAt = caneWaterAt(near, far);
  const shown = shownMask(L, 1);
  const wet = trimWet(L, shown, waterAt);
  const trimmed = trimSteep(L, wet, heightAt);

  test('no shown cell sits on rendered water', () => {
    const { size: n, cell: c, minX, minZ } = L.grid;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (!trimmed[j * n + i]) continue;
      const x = minX + (i + 0.5) * c, z = minZ + (j + 0.5) * c;
      expect(waterAt(x, z)).toBe(WATER.LAND);
    }
  });

  test('worst wall (flat top + fringe − lowest wall-bottom ground) stays within 7 m', () => {
    // Each wall quad's vertices come in (bottom, top) pairs at each of its two endpoints (see
    // caneMesh.ts `wall()`): consecutive vertices 6 floats apart share an x,z column, bottom at
    // `g - CANE_SINK` and top at `flatTop + CANE_FRINGE` — so the *visible* wall height above
    // ground adds CANE_SINK back to the bottom vertex before taking the difference.
    const { sides } = buildCaneGeometry(L, trimmed, heightAt);
    const p = sides.getAttribute('position').array as Float32Array;
    let worst = 0;
    for (let i = 0; i + 5 < p.length; i += 6) worst = Math.max(worst, p[i + 4] - (p[i + 1] + CANE_SINK));
    expect(worst).toBeLessThanOrEqual(7);
  });
});
