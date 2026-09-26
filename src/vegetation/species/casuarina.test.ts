import * as THREE from 'three';
import { expect, test } from 'vitest';
import { WIND_DIR } from '../../geo/constants';
import { buildCasuarina } from './casuarina';

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

test('casuarina has bark + foliage with aFlex in [0,1], height 13–26 m, < 4000 triangles', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const parts = buildCasuarina(seed);
    expect(parts.map((p) => p.name).sort()).toEqual(['bark', 'foliage']);
    for (const p of parts) {
      const f = p.geometry.getAttribute('aFlex').array as Float32Array;
      expect(Math.min(...f)).toBeGreaterThanOrEqual(0); expect(Math.max(...f)).toBeLessThanOrEqual(1);
      for (const a of ['normal', 'uv', 'color']) expect(p.geometry.getAttribute(a)).toBeDefined();
    }
    const box = new THREE.Box3();
    for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox!); }
    expect(box.max.y).toBeGreaterThan(13); expect(box.max.y).toBeLessThan(26);
    expect(parts.reduce((n, p) => n + tris(p.geometry), 0)).toBeLessThan(4000);
  }
});

test('foliage cards hang with aFlex 0.4–0.9; normals finite and unit length', () => {
  for (const seed of [1, 2, 3, 4]) {
    const parts = buildCasuarina(seed);
    const fol = parts.find((p) => p.name === 'foliage')!.geometry;
    const f = fol.getAttribute('aFlex').array as Float32Array;
    expect(Math.min(...f)).toBeGreaterThanOrEqual(0.4 - 1e-6); expect(Math.max(...f)).toBeLessThanOrEqual(0.9 + 1e-6);
    for (const p of parts) {
      for (const a of ['position', 'normal']) for (const v of p.geometry.getAttribute(a).array as Float32Array) expect(Number.isFinite(v)).toBe(true);
      const n = p.geometry.getAttribute('normal') as THREE.BufferAttribute;
      for (let i = 0; i < n.count; i++) expect(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1)).toBeLessThan(1e-3);
    }
  }
});

test('trunk leans downwind (toward WIND_DIR), at most ~6°', () => {
  let sum = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const bark = buildCasuarina(seed)[0].geometry;
    const pos = bark.getAttribute('position') as THREE.BufferAttribute;
    // The trunk is the first tube in the merged bark: its top ring is the highest trunk ring.
    let top = 0;
    for (let i = 0; i < 8 * 11; i++) if (pos.getY(i) > pos.getY(top)) top = i;
    const ring = Math.floor(top / 8) * 8;
    let cx = 0, cz = 0, cy = 0;
    for (let i = ring; i < ring + 8; i++) { cx += pos.getX(i) / 8; cy += pos.getY(i) / 8; cz += pos.getZ(i) / 8; }
    const along = cx * WIND_DIR[0] + cz * WIND_DIR[1];
    expect(Math.atan2(Math.hypot(cx, cz), cy)).toBeLessThan(7 * Math.PI / 180);
    sum += along;
  }
  expect(sum).toBeGreaterThan(0);
});

test('deterministic by seed, different across seeds', () => {
  const a = buildCasuarina(5)[1].geometry.getAttribute('position').array;
  expect(buildCasuarina(5)[1].geometry.getAttribute('position').array).toEqual(a);
  expect(buildCasuarina(6)[1].geometry.getAttribute('position').array).not.toEqual(a);
});
