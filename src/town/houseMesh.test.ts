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
  const shape = (look: HouseLook, mat: 'zinc' | 'thatch', f: Footprint) => {
    const b = makeBuilders(); buildHouse(b, { id: 'x', look, fp: f, paint: 0x6f9f98 } as House, () => 0);
    const p = finish(b)[mat]!.attributes.position, v: { lx: number; lz: number; y: number }[] = [];
    for (let i = 0; i < p.count; i++) { const [lx, lz] = toLocal(f, p.getX(i), p.getZ(i)); v.push({ lx, lz, y: p.getY(i) }); }
    const yMax = Math.max(...v.map((q) => q.y)), yMin = Math.min(...v.map((q) => q.y));
    return { v, yMax, yMin, top: v.filter((q) => q.y > yMax - 0.05), low: v.filter((q) => q.y < yMin + 0.05),
      ext: (k: 'lx' | 'lz') => Math.max(...v.map((q) => q[k])) - Math.min(...v.map((q) => q[k])) };
  };
  const fp2: Footprint = { c: [3, 8], yaw: -0.4, hx: 5, hz: 3 };
  test('wood roof: ridge along the long side, sloping down to the eaves', () => {
    const r = shape('wood', 'zinc', fp2);
    expect(r.ext('lx')).toBeCloseTo(2 * fp2.hx + 2 * HOUSE.eave, 0);
    expect(r.ext('lz')).toBeCloseTo(2 * fp2.hz + 2 * HOUSE.eave, 0);
    for (const q of r.top) expect(Math.abs(q.lz)).toBeLessThan(0.3);
    for (const q of r.low) expect(Math.abs(q.lz)).toBeGreaterThan(fp2.hz + HOUSE.eave - 0.3);
    expect(r.yMin + HOUSE.wall.wood + HOUSE.zoco.wood).toBeLessThan(r.yMax + HOUSE.wall.wood + HOUSE.zoco.wood);   // sanity
    expect(r.yMin).toBeLessThan(HOUSE.zoco.wood + HOUSE.wall.wood);   // eave dips below the wall top
    expect(r.yMax).toBeGreaterThan(HOUSE.zoco.wood + HOUSE.wall.wood);
  });
  test('hut roof: apex over the centre above the walls, lowest at the overhang corners', () => {
    const r = shape('hut', 'thatch', fp2);
    for (const q of r.top) { expect(Math.abs(q.lx)).toBeLessThan(0.1); expect(Math.abs(q.lz)).toBeLessThan(0.1); }
    expect(r.yMax).toBeGreaterThan(HOUSE.zoco.hut + HOUSE.wall.hut);
    const rim = r.low.filter((q) => Math.abs(q.lx) > 0.1 || Math.abs(q.lz) > 0.1);   // the cone's base-cap centre sits at the base level too
    expect(rim.length).toBeGreaterThan(0);
    for (const q of rim) { expect(Math.abs(q.lx)).toBeGreaterThan(fp2.hx); expect(Math.abs(q.lz)).toBeGreaterThan(fp2.hz); }
  });
});
