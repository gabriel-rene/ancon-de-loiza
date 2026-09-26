import * as THREE from 'three';
import { expect, test } from 'vitest';
import { buildPalm } from './palm';

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

test('palm has bark + foliage with aFlex in [0,1] and plausible size', () => {
  const parts = buildPalm(1);
  expect(parts.map((p) => p.name).sort()).toEqual(['bark', 'foliage']);
  for (const p of parts) {
    const f = p.geometry.getAttribute('aFlex').array as Float32Array;
    expect(Math.min(...f)).toBeGreaterThanOrEqual(0); expect(Math.max(...f)).toBeLessThanOrEqual(1);
    expect(p.geometry.getAttribute('normal')).toBeDefined(); expect(p.geometry.getAttribute('uv')).toBeDefined();
  }
  const box = new THREE.Box3();
  for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox!); }
  expect(box.max.y).toBeGreaterThan(11); expect(box.max.y).toBeLessThan(23);
  expect(parts.reduce((n, p) => n + tris(p.geometry), 0)).toBeLessThan(4000);
});
test('deterministic by seed, different across seeds', () => {
  const a = buildPalm(5)[0].geometry.getAttribute('position').array;
  expect(buildPalm(5)[0].geometry.getAttribute('position').array).toEqual(a);
  expect(buildPalm(6)[0].geometry.getAttribute('position').array).not.toEqual(a);
});
test('bark carries vertex colours; geometry has no NaNs', () => {
  for (const seed of [1, 2, 3, 4]) {
    const parts = buildPalm(seed);
    expect(parts[0].geometry.getAttribute('color')).toBeDefined();
    for (const p of parts) for (const v of p.geometry.getAttribute('position').array as Float32Array) expect(Number.isFinite(v)).toBe(true);
  }
});
