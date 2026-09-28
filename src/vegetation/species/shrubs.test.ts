import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import type { PlantPart } from '../types';
import { buildButtonwood, buildSeaGrape } from './shrubs';

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const bounds = (parts: PlantPart[]) => {
  const box = new THREE.Box3();
  for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox!); }
  return box;
};

const CASES: [string, (seed: number) => PlantPart[], number, number][] = [
  ['buttonwood', buildButtonwood, 1.5, 6],
  ['sea grape', buildSeaGrape, 0.8, 4],
];

describe.each(CASES)('%s', (_name, build, hMin, hMax) => {
  test('bark + foliage, aFlex in [0,1], attributes, plausible height, triangle budget', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const parts = build(seed);
      expect(parts.map((p) => p.name).sort()).toEqual(['bark', 'foliage']);
      for (const p of parts) {
        const f = p.geometry.getAttribute('aFlex').array as Float32Array;
        expect(Math.min(...f)).toBeGreaterThanOrEqual(0); expect(Math.max(...f)).toBeLessThanOrEqual(1);
        expect(p.geometry.getAttribute('normal')).toBeDefined(); expect(p.geometry.getAttribute('uv')).toBeDefined();
        expect(p.geometry.getAttribute('color')).toBeDefined();
      }
      const box = bounds(parts);
      expect(box.max.y).toBeGreaterThan(hMin); expect(box.max.y).toBeLessThan(hMax);
      expect(parts.reduce((n, p) => n + tris(p.geometry), 0)).toBeLessThan(2500);
    }
  });
  test('no NaNs, unit normals', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const p of build(seed)) {
        for (const a of ['position', 'normal']) {
          for (const v of p.geometry.getAttribute(a).array as Float32Array) expect(Number.isFinite(v)).toBe(true);
        }
        const n = p.geometry.getAttribute('normal') as THREE.BufferAttribute;
        for (let i = 0; i < n.count; i++) expect(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1)).toBeLessThan(1e-3);
      }
    }
  });
  test('deterministic by seed, different across seeds', () => {
    for (const k of [0, 1]) {
      const a = build(5)[k].geometry.getAttribute('position').array;
      expect(build(5)[k].geometry.getAttribute('position').array).toEqual(a);
      expect(build(6)[k].geometry.getAttribute('position').array).not.toEqual(a);
    }
  });
});

test('sea grape sprawls: horizontal extent at least 1.3 × height', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const box = bounds(buildSeaGrape(seed));
    const width = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    expect(width).toBeGreaterThanOrEqual(1.3 * box.max.y);
  }
});

test('sea grape: about 10 % of leaf cards carry a red tint', () => {
  let red = 0, cards = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const col = buildSeaGrape(seed).find((p) => p.name === 'foliage')!.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < col.count; i += 4) {
      cards++;
      if (col.getX(i) > 1.25 * col.getY(i)) red++;
    }
  }
  expect(red / cards).toBeGreaterThan(0.04); expect(red / cards).toBeLessThan(0.2);
});
