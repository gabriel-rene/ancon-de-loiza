// src/people/geometry.test.ts
import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { buildFigureGeometries, buildHairGeometries, buildHatGeometries, FIGURE_TRI_BUDGET_HI, FIGURE_TRI_BUDGET_LO, GEO_ALT, PART_GEO, type Detail, type GeoKind } from './geometry';
import { PARTS } from './rig';

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const figureTris = (d: Detail) => {
  const g = buildFigureGeometries(d), hats = buildHatGeometries(d), hair = buildHairGeometries(d);
  const part = (k: GeoKind) => Math.max(tris(g[k]), GEO_ALT[k] ? tris(g[GEO_ALT[k]!]) : 0);
  return PARTS.reduce((n, p) => n + part(PART_GEO[p]), 0) + Math.max(...Object.values(hats).map(tris)) + Math.max(...Object.values(hair).map(tris));
};

describe.each([['hi', FIGURE_TRI_BUDGET_HI], ['lo', FIGURE_TRI_BUDGET_LO]] as const)('%s tier', (d, budget) => {
  test('one figure (all parts with the larger alternate, the biggest hair and hat) fits the triangle budget', () => {
    expect(figureTris(d)).toBeLessThanOrEqual(budget);
  });
  test('every geometry carries position, normal and a 0–1 occlusion attribute', () => {
    for (const g of [...Object.values(buildFigureGeometries(d)), ...Object.values(buildHatGeometries(d)), ...Object.values(buildHairGeometries(d))]) {
      expect(Object.keys(g.attributes).sort()).toEqual(['normal', 'occlusion', 'position']);
      const o = g.attributes.occlusion.array as Float32Array;
      expect(o.length).toBe(g.attributes.position.count);
      expect(o.every((v) => v >= 0 && v <= 1)).toBe(true);
    }
  });
  test('limbs follow the segment convention (y 0 → −1) with rounded caps overlapping both joints', () => {
    const g = buildFigureGeometries(d);
    for (const k of ['thigh', 'shin', 'shinFlare', 'upperArm', 'foreArm'] as const) {
      g[k].computeBoundingBox();
      const b = g[k].boundingBox!;
      expect(b.max.y).toBeGreaterThan(0.05); expect(b.max.y).toBeLessThan(0.3);
      expect(b.min.y).toBeLessThan(-1.05); expect(b.min.y).toBeGreaterThan(-1.3);
    }
  });
  test('normals face outward', () => {
    const g = buildFigureGeometries(d);
    for (const k of ['thigh', 'shin', 'upperArm', 'foreArm', 'torso', 'hips', 'head', 'handL', 'handR', 'foot', 'footBare'] as const) {
      const p = g[k].attributes.position, n = g[k].attributes.normal;
      const c = new THREE.Vector3(); g[k].computeBoundingBox(); g[k].boundingBox!.getCenter(c);
      let s = 0;
      for (let i = 0; i < p.count; i++) s += (p.getX(i) - c.x) * n.getX(i) + (p.getY(i) - c.y) * n.getY(i) + (p.getZ(i) - c.z) * n.getZ(i);
      expect(s, k).toBeGreaterThan(0);
    }
  });
});

test('the hi tier is the detailed one; hands are mirror images', () => {
  expect(figureTris('hi')).toBeGreaterThan(2 * figureTris('lo'));
  const g = buildFigureGeometries('hi');
  g.handL.computeBoundingBox(); g.handR.computeBoundingBox();
  expect(g.handR.boundingBox!.min.x).toBeCloseTo(-g.handL.boundingBox!.max.x, 6);
});
