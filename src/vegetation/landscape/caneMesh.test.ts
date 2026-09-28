import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import geo from '../../data/geo/loiza.json';
import type { GeoBundle } from '../../data/geo/types';
import { caneLayout, shownMask, type CaneLayout } from './caneFields';
import { buildCaneGeometry, CANE_FRINGE, CANE_SINK } from './caneMesh';

const tris = (g: THREE.BufferGeometry) => g.index!.count / 3;
/** 4×4 cells of 10 m at the origin; one 2×2 field in the middle (cells (1,1)–(2,2)). */
function tiny(): CaneLayout {
  const field = new Int32Array(16).fill(-1);
  for (const [i, j] of [[1, 1], [2, 1], [1, 2], [2, 2]]) field[j * 4 + i] = 0;
  return { grid: { size: 4, cell: 10, minX: 0, minZ: 0 }, field, fields: [{ rank: 0.1, height: 3, cells: 4 }] };
}

describe('buildCaneGeometry', () => {
  const L = tiny(), ground = (x: number) => 0.01 * x;
  const { top, sides } = buildCaneGeometry(L, shownMask(L, 1), ground);
  test('top: one merged quad per row run; y = ground + field height', () => {
    expect(tris(top)).toBe(4);
    const p = top.getAttribute('position');
    for (let i = 0; i < p.count; i++) expect(p.getY(i)).toBeCloseTo(ground(p.getX(i)) + 3, 5);
  });
  test('sides: one quad per straight boundary run, from below ground to above the top', () => {
    expect(tris(sides)).toBe(8);
    const p = sides.getAttribute('position');
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < p.count; i++) { lo = Math.min(lo, p.getY(i) - ground(p.getX(i))); hi = Math.max(hi, p.getY(i) - ground(p.getX(i))); }
    expect(lo).toBeCloseTo(-CANE_SINK, 5); expect(hi).toBeCloseTo(3 + CANE_FRINGE, 5);
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
