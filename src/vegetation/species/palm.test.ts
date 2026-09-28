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

const top = (parts: ReturnType<typeof buildPalm>) => {
  const box = new THREE.Box3();
  for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox!); }
  return box.max.y;
};
test('age 1 is the default and unchanged', () => {
  for (const seed of [1, 2, 3]) {
    const a = buildPalm(seed), b = buildPalm(seed, 1);
    for (let i = 0; i < a.length; i++)
      expect(b[i].geometry.getAttribute('position').array).toEqual(a[i].geometry.getAttribute('position').array);
  }
});
test('young palms stay under 6 m; half-grown palms sit between young and full', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const y0 = top(buildPalm(seed, 0)), y5 = top(buildPalm(seed, 0.5)), y1 = top(buildPalm(seed, 1));
    expect(y0).toBeLessThan(6); expect(y0).toBeGreaterThan(2.5);
    expect(y5).toBeGreaterThan(y0); expect(y5).toBeLessThan(y1);
  }
});
test('young palms have no nuts and stay within the triangle budget', () => {
  for (const age of [0, 0.5]) {
    const parts = buildPalm(2, age);
    expect(parts.reduce((n, p) => n + tris(p.geometry), 0)).toBeLessThan(4000);
    for (const p of parts) for (const v of p.geometry.getAttribute('position').array as Float32Array) expect(Number.isFinite(v)).toBe(true);
  }
  const bark = (age: number) => tris(buildPalm(2, age)[0].geometry);
  expect(bark(0)).toBeLessThan(bark(1)); // nuts dropped
});
