import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import geo from '../../data/geo/loiza.json';
import type { GeoBundle } from '../../data/geo/types';
import { caneLayout, shownMask, type CaneLayout } from './caneFields';
import { buildCaneGeometry, CANE_FRINGE, CANE_SINK, trimSteep } from './caneMesh';

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
