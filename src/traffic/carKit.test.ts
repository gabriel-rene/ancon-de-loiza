import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import type { CarModel } from '../data/eras';
import { tris } from '../ancon/testing';
import { buildCar, buildWheel, CAR_PARTS, CAR_TRIS, WHEEL_TRIS, wheelMatrix, SILHOUETTES } from './carKit';
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

describe('kit detail and wheels', () => {
  test('hi has more triangles than lo for every model', () => {
    const n = (m: CarModel, dt: 'hi' | 'lo') => { const g = buildCar(m, dt); return CAR_PARTS.reduce((a, p) => a + tris(g[p]), 0); };
    for (const m of MODELS) expect(n(m, 'hi'), m).toBeGreaterThan(n(m, 'lo'));
  });
  test('wheelMatrix places the four wheels at +-wb/2, wheelR, +-track', () => {
    const d = DIMS.sedan50, id = new THREE.Matrix4(), out = new THREE.Matrix4(), v = new THREE.Vector3();
    const seen = new Set<string>();
    for (let k = 0; k < 4; k++) {
      v.setFromMatrixPosition(wheelMatrix(d, k, 0, id, out));
      expect(Math.abs(v.x)).toBeCloseTo(d.wheelbase / 2, 6); expect(v.y).toBeCloseTo(d.wheelR, 6); expect(Math.abs(v.z)).toBeCloseTo(d.track, 6);
      seen.add(`${Math.sign(v.x)},${Math.sign(v.z)}`);
    }
    expect(seen.size).toBe(4);
  });
  test('a positive dist rolls the wheel forward along +x', () => {
    const d = DIMS.sedan50, id = new THREE.Matrix4(), out = new THREE.Matrix4();
    wheelMatrix(d, 0, 1, id, out);
    // the wheel-top point (0,1,0) moves toward +x when rolling forward
    const top = new THREE.Vector3(0, 1, 0).applyMatrix4(out), c = new THREE.Vector3().setFromMatrixPosition(out);
    expect(top.x - c.x).toBeGreaterThan(0);
    // and the contact point (0,-1,0) moves toward -x relative to the hub
    const bot = new THREE.Vector3(0, -1, 0).applyMatrix4(out); expect(bot.x - c.x).toBeLessThan(0);
  });
  test('hi modern models leave a wheel-arch gap around each wheel', () => {
    for (const m of MODELS.filter((k) => !SILHOUETTES[k].vintage)) {
      const d = DIMS[m], pos = buildCar(m, 'hi').paint.getAttribute('position');
      for (const sx of [-1, 1]) for (let i = 0; i < pos.count; i++) {
        const dx = pos.getX(i) - sx * d.wheelbase / 2, dy = pos.getY(i) - d.wheelR;
        expect(Math.hypot(dx, dy), m).toBeGreaterThanOrEqual(d.wheelR);
      }
    }
  });
});
