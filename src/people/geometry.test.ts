// src/people/geometry.test.ts
import { expect, test } from 'vitest';
import { buildFigureGeometries, buildHatGeometries, FIGURE_TRI_BUDGET, PART_GEO } from './geometry';
import { PARTS } from './rig';

const tris = (g: import('three').BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
test('one figure (all parts + the biggest hat) fits the triangle budget', () => {
  const g = buildFigureGeometries(), h = buildHatGeometries();
  const body = PARTS.reduce((n, p) => n + tris(g[PART_GEO[p]]), 0);
  expect(body + Math.max(...Object.values(h).map(tris))).toBeLessThanOrEqual(FIGURE_TRI_BUDGET);
});
test('limb geometry spans y 0 → −1 (segmentMatrix convention)', () => {
  const g = buildFigureGeometries().limb;
  g.computeBoundingBox();
  expect(g.boundingBox!.max.y).toBeCloseTo(0, 6); expect(g.boundingBox!.min.y).toBeCloseTo(-1, 6);
});
