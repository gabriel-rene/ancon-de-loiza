import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import type { PlantPart } from '../types';
import { buildBlackMangrove, buildWhiteMangrove } from './basinMangrove';

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

const CASES: [string, (seed: number) => PlantPart[], number, number][] = [
  ['black mangrove', buildBlackMangrove, 3, 10],
  ['white mangrove', buildWhiteMangrove, 3, 9],
];

describe.each(CASES)('%s', (_name, build, hMin, hMax) => {
  test('bark + foliage, aFlex in [0,1], attributes, plausible height, triangle budget', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const parts = build(seed);
      expect([...new Set(parts.map((p) => p.name))].sort()).toEqual(['bark', 'foliage']);
      for (const p of parts) {
        const f = p.geometry.getAttribute('aFlex').array as Float32Array;
        expect(Math.min(...f)).toBeGreaterThanOrEqual(0); expect(Math.max(...f)).toBeLessThanOrEqual(1);
        expect(p.geometry.getAttribute('normal')).toBeDefined(); expect(p.geometry.getAttribute('uv')).toBeDefined();
        expect(p.geometry.getAttribute('color')).toBeDefined();
      }
      const box = new THREE.Box3();
      for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox!); }
      expect(box.max.y).toBeGreaterThan(hMin); expect(box.max.y).toBeLessThan(hMax);
      expect(parts.reduce((n, p) => n + tris(p.geometry), 0)).toBeLessThan(3000);
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

test('black mangrove has a disc of pneumatophores 1–3 m around the trunk, as a part that casts no shadow', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const parts = buildBlackMangrove(seed);
    expect(parts.filter((p) => p.shadow === false).length).toBe(1);
    const bark = parts.find((p) => p.name === 'bark' && p.shadow === false)!.geometry;
    const pos = bark.getAttribute('position') as THREE.BufferAttribute;
    let n = 0;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), r = Math.hypot(pos.getX(i), pos.getZ(i));
      if (y > 0 && y < 0.35 && r >= 1 && r <= 3) n++;
    }
    expect(n).toBeGreaterThanOrEqual(40);
  }
});
