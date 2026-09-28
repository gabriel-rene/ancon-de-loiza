import type * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { buildGrassClump, buildReedClump, buildVineClump } from './groundClumps';

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

const CASES: [string, (seed: number) => THREE.BufferGeometry, number, number][] = [
  ['grass', buildGrassClump, 0.3, 0.9],
  ['reeds', buildReedClump, 0.9, 2.2],
  ['vine', buildVineClump, 0.05, 0.35],
];

describe.each(CASES)('%s clump', (_name, build, hMin, hMax) => {
  test('attributes, aFlex 0 at the base and ≤ 1, height, triangle budget', () => {
    for (const seed of [1, 2, 3, 4]) {
      const g = build(seed);
      for (const a of ['position', 'normal', 'uv', 'color', 'aFlex']) expect(g.getAttribute(a), a).toBeDefined();
      const pos = g.getAttribute('position').array as Float32Array, f = g.getAttribute('aFlex').array as Float32Array;
      let maxY = -Infinity;
      for (let i = 0; i < f.length; i++) {
        expect(f[i]).toBeGreaterThanOrEqual(0); expect(f[i]).toBeLessThanOrEqual(1);
        const y = pos[i * 3 + 1];
        maxY = Math.max(maxY, y);
        if (y < 1e-4) expect(f[i]).toBeCloseTo(0, 5);
        for (let k = 0; k < 3; k++) expect(Number.isFinite(pos[i * 3 + k])).toBe(true);
      }
      expect(Math.min(...f)).toBe(0);
      expect(maxY).toBeGreaterThanOrEqual(hMin); expect(maxY).toBeLessThanOrEqual(hMax);
      expect(tris(g)).toBeLessThanOrEqual(24);
    }
  });
  test('deterministic', () => {
    const a = build(3), b = build(3);
    expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));
    expect(Array.from(a.getAttribute('color').array)).toEqual(Array.from(b.getAttribute('color').array));
  });
  test('normals lean up (≥ 0.5 of +Y)', () => {
    const n = build(2).getAttribute('normal') as THREE.BufferAttribute;
    for (let i = 0; i < n.count; i++) {
      expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 4);
      expect(n.getY(i)).toBeGreaterThan(0.5);
    }
  });
});
