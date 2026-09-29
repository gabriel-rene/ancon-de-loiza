import { describe, expect, test } from 'vitest';
import { buildRoadStrip, clipToLand, resample, ROAD_LIFT, ROAD_STEP } from './roadStrip';
import { triangleCount } from './parts';

const ground = (x: number, z: number) => 1 + 0.02 * x + 0.01 * z;
describe('story road strip', () => {
  test('resample keeps both ends and steps ≤ ROAD_STEP', () => {
    const r = resample([[0, 0], [10, 0], [10, 7]]);
    expect(r[0]).toEqual([0, 0]); expect(r[r.length - 1]).toEqual([10, 7]);
    for (let i = 1; i < r.length; i++) expect(Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1])).toBeLessThanOrEqual(ROAD_STEP + 1e-9);
  });
  test('clipToLand keeps the longest dry run', () => {
    const r = clipToLand([[0, 0], [40, 0]], (x) => x < 30);
    expect(Math.max(...r.map((p) => p[0]))).toBeLessThan(30);
    expect(Math.min(...r.map((p) => p[0]))).toBe(0);
  });
  test('the strip lies ROAD_LIFT above the ground, is as wide as the road, stops at the water', () => {
    const g = buildRoadStrip([{ id: 'escobar', points: [[0, 0], [60, 0]], width: 6 }], ground, (x) => x < 50)!;
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      expect(p.getY(i)).toBeCloseTo(ground(p.getX(i), p.getZ(i)) + ROAD_LIFT, 3);
      expect(p.getX(i)).toBeLessThan(50);
    }
    for (let i = 0; i < p.count; i += 2) expect(Math.hypot(p.getX(i) - p.getX(i + 1), p.getZ(i) - p.getZ(i + 1))).toBeCloseTo(6, 3);
    expect(triangleCount(g)).toBe(p.count - 2);
    expect(g.attributes.uv).toBeDefined();
  });
  test('no roads, no geometry', () => {
    expect(buildRoadStrip([], ground, () => true)).toBeNull();
  });
});
