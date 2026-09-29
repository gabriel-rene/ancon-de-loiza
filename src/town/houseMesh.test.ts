import { describe, expect, test } from 'vitest';
import { finish, makeBuilders, triangleCount, type Footprint } from '../infrastructure/parts';
import { buildHouse, HOUSE, HOUSE_TRIANGLES } from './houseMesh';
import { toLocal } from './layout';
import type { House, HouseLook } from './town';

const fp: Footprint = { c: [10, -4], yaw: 0.7, hx: 4, hz: 3 };
const slope = (x: number) => 1 + 0.05 * x;
const one = (look: HouseLook) => { const b = makeBuilders(); buildHouse(b, { id: 'x', look, fp, paint: 0x6f9f98 } as House, slope); return finish(b); };

describe('house', () => {
  test('materials per look', () => {
    expect(Object.keys(one('hut')).sort()).toEqual(['thatch', 'wood']);
    expect(Object.keys(one('wood')).sort()).toEqual(['wood', 'zinc']);
    expect(Object.keys(one('concrete')).sort()).toEqual(['concrete', 'iron']);
  });
  test(`at most ${HOUSE_TRIANGLES} triangles`, () => {
    for (const look of ['hut', 'wood', 'concrete'] as const) {
      const n = Object.values(one(look)).reduce((s, g) => s + triangleCount(g!), 0);
      expect(n, look).toBeLessThanOrEqual(HOUSE_TRIANGLES);
    }
  });
  test('stays inside its footprint plus the eaves; reaches into the ground; roof above the walls', () => {
    for (const look of ['hut', 'wood', 'concrete'] as const) {
      let yMin = Infinity, yMax = -Infinity;
      for (const g of Object.values(one(look))) {
        const p = g!.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const [lx, lz] = toLocal(fp, p.getX(i), p.getZ(i));
          expect(Math.abs(lx), look).toBeLessThanOrEqual(fp.hx + 1);
          expect(Math.abs(lz), look).toBeLessThanOrEqual(fp.hz + 1);
          yMin = Math.min(yMin, p.getY(i)); yMax = Math.max(yMax, p.getY(i));
        }
      }
      const low = Math.min(...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) =>
        slope(fp.c[0] + Math.cos(fp.yaw) * sx * fp.hx + Math.sin(fp.yaw) * sz * fp.hz)));   // ground at the lowest corner
      expect(yMin, look).toBeLessThan(low);
      expect(yMax - yMin, look).toBeGreaterThan(HOUSE.wall[look]);
    }
  });
});
