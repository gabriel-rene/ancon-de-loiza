import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import type { CarModel } from '../data/eras';
import { tris } from '../ancon/testing';
import { buildCar, buildWheel, CAR_PARTS, CAR_TRIS, WHEEL_TRIS } from './carKit';
import { DIMS, rearOverhang } from './models';

const MODELS: CarModel[] = ['modelT', 'modelA', 'sedan50', 'publico', 'sedan70', 'wagon70', 'tvVan', 'sedan80', 'compact80'];
const box = (g: Record<string, THREE.BufferGeometry>) => { const b = new THREE.Box3(); for (const x of Object.values(g)) { x.computeBoundingBox(); b.union(x.boundingBox!); } return b; };

describe('buildCar', () => {
  test('each model fills its size, sits on the ground, and stays in budget', () => {
    for (const m of MODELS) for (const detail of ['hi', 'lo'] as const) {
      const g = buildCar(m, detail), d = DIMS[m], b = box(g);
      expect(b.max.x, m).toBeCloseTo(d.wheelbase / 2 + d.front, 1);
      expect(b.min.x, m).toBeCloseTo(-(d.wheelbase / 2 + rearOverhang(d)), 1);
      expect(b.max.y, m).toBeLessThanOrEqual(d.height + 0.35);   // roof sign / mast allowed above
      expect(b.min.y, m).toBeGreaterThanOrEqual(0.1);             // wheels are separate; the body clears the ground
      expect(b.max.z - b.min.z, m).toBeLessThanOrEqual(d.width + 0.02);
      expect(CAR_PARTS.reduce((n, p) => n + tris(g[p]), 0), `${m} ${detail}`).toBeLessThanOrEqual(CAR_TRIS[detail]);
      expect(g.paint.getAttribute('color'), m).toBeUndefined();
      for (const p of ['glass', 'trim', 'dark'] as const) expect(g[p].getAttribute('position').count, `${m} ${p}`).toBeGreaterThan(0);
    }
  });
  test('the wheel is a unit disc on the z axis, in budget', () => {
    for (const detail of ['hi', 'lo'] as const) {
      const w = buildWheel(detail); w.computeBoundingBox();
      expect(w.boundingBox!.max.y).toBeCloseTo(1, 2); expect(w.boundingBox!.max.x).toBeCloseTo(1, 2);
      expect(w.boundingBox!.max.z).toBeLessThan(0.4);
      expect(tris(w)).toBeLessThanOrEqual(WHEEL_TRIS[detail]);
    }
  });
});
