import * as THREE from 'three';
import { expect, test } from 'vitest';
import { buildMangrove } from './mangrove';

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

test('mangrove has bark + foliage with aFlex in [0,1], plausible size and roots in the mud', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const parts = buildMangrove(seed);
    expect(parts.map((p) => p.name).sort()).toEqual(['bark', 'foliage']);
    for (const p of parts) {
      const f = p.geometry.getAttribute('aFlex').array as Float32Array;
      expect(Math.min(...f)).toBeGreaterThanOrEqual(0); expect(Math.max(...f)).toBeLessThanOrEqual(1);
      expect(p.geometry.getAttribute('normal')).toBeDefined(); expect(p.geometry.getAttribute('uv')).toBeDefined();
      expect(p.geometry.getAttribute('color')).toBeDefined();
    }
    const box = new THREE.Box3();
    for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox!); }
    expect(box.max.y).toBeGreaterThan(3.5); expect(box.max.y).toBeLessThan(9);
    const bark = parts.find((p) => p.name === 'bark')!.geometry;
    expect(bark.boundingBox!.min.y).toBeLessThanOrEqual(-0.2);
    expect(parts.reduce((n, p) => n + tris(p.geometry), 0)).toBeLessThan(3500);
  }
});
test('deterministic by seed, different across seeds', () => {
  const a = buildMangrove(5)[0].geometry.getAttribute('position').array;
  expect(buildMangrove(5)[0].geometry.getAttribute('position').array).toEqual(a);
  expect(buildMangrove(6)[0].geometry.getAttribute('position').array).not.toEqual(a);
});
test('prop roots reach the mud 1.5–3.5 m out; no NaNs', () => {
  for (const seed of [1, 2, 3, 4]) {
    const parts = buildMangrove(seed);
    for (const p of parts) for (const v of p.geometry.getAttribute('position').array as Float32Array) expect(Number.isFinite(v)).toBe(true);
    const pos = parts[0].geometry.getAttribute('position') as THREE.BufferAttribute;
    let far = 0, maxR = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < -0.2) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      maxR = Math.max(maxR, r); if (r > 1.4) far++;
    }
    expect(far).toBeGreaterThan(0); expect(maxR).toBeLessThan(3.7);
  }
});
