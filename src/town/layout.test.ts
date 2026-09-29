import { describe, expect, test } from 'vitest';
import geo from '../data/geo/loiza.json';
import type { GeoBundle, Outline, XZ } from '../data/geo/types';
import { corners, toWorld, type Footprint } from '../infrastructure/parts';
import { CHURCH_WAY, churchPlan, inRing, LOT, orientedBox, PLAZA_WAY, rectsOverlap, toLocal, townLots, type LotRules } from './layout';

const G = geo as unknown as GeoBundle;
const rect = (id: string, cx: number, cz: number, hx: number, hz: number, yaw = 0, kind = 'yes'): Outline =>
  ({ id, kind, ring: corners({ c: [cx, cz], yaw, hx, hz }) as XZ[] });
const bundle = (buildings: Outline[]): GeoBundle => ({
  origin: G.origin, water: [], land: [], coastline: [], roads: [],
  buildings: [rect(CHURCH_WAY, 0, 0, 15, 6, 0, 'church'), ...buildings],
  parks: [{ id: PLAZA_WAY, kind: 'park', ring: corners({ c: [40, 0], yaw: 0, hx: 10, hz: 10 }) as XZ[] }],
});
const rules: LotRules = {
  centre: [0, 0], church: [0, 0], clear: [0, 120],
  roads: [{ points: [[-200, -60], [200, -60]], half: 3 }], corridor: (x) => x < -150,
};

describe('rectangles', () => {
  test('orientedBox recovers a turned rectangle, long side on local X', () => {
    const f = orientedBox(corners({ c: [5, -3], yaw: 0.6, hx: 2, hz: 4 }) as XZ[]);
    expect(f.hx).toBeCloseTo(4); expect(f.hz).toBeCloseTo(2);
    expect(f.c[0]).toBeCloseTo(5); expect(f.c[1]).toBeCloseTo(-3);
  });
  test('toLocal undoes toWorld', () => {
    const f: Footprint = { c: [3, 4], yaw: 1.1, hx: 2, hz: 1 }, [x, z] = toWorld(f, 1.5, -0.5), [lx, lz] = toLocal(f, x, z);
    expect(lx).toBeCloseTo(1.5); expect(lz).toBeCloseTo(-0.5);
  });
  test('rectsOverlap', () => {
    const a: Footprint = { c: [0, 0], yaw: 0, hx: 2, hz: 2 };
    expect(rectsOverlap(a, { c: [3.5, 0], yaw: 0, hx: 2, hz: 2 })).toBe(true);
    expect(rectsOverlap(a, { c: [5, 0], yaw: 0, hx: 2, hz: 2 })).toBe(false);
    expect(rectsOverlap(a, { c: [5, 0], yaw: 0, hx: 2, hz: 2 }, 0.6)).toBe(true);
    expect(rectsOverlap(a, { c: [4.6, 0], yaw: Math.PI / 4, hx: 2, hz: 2 })).toBe(true);   // corner reaches in
  });
  test('inRing', () => {
    const ring = corners({ c: [0, 0], yaw: 0, hx: 1, hz: 1 }) as XZ[];
    expect(inRing(ring, 0.5, 0.5)).toBe(true); expect(inRing(ring, 1.5, 0)).toBe(false);
  });
});

describe('lots (synthetic)', () => {
  test('drops outlines on the clearing, a road, the corridor, the plaza and the church', () => {
    const ids = townLots(bundle([
      rect('keep', 0, 60, 4, 3),
      rect('clear', 0, 110, 4, 3),      // inside the landing clearing
      rect('road', 0, -58, 4, 3),       // on the road
      rect('corridor', -170, 0, 4, 3),  // in the bridge corridor
      rect('plaza', 40, 0, 3, 3),       // in the plaza
      rect('church', 0, 9, 3, 2),       // against the church (tower side)
      rect('far', 400, 0, 4, 3),        // outside the circle
    ]), rules).map((l) => l.id);
    expect(ids).toEqual(['keep']);
  });
  test('ranked nearest the church first; of two overlapping lots the lower rank stays', () => {
    const lots = townLots(bundle([rect('b', 0, 100 - 30, 4, 3), rect('a', 0, 40, 4, 3), rect('a2', 5, 40, 4, 3)]), { ...rules, clear: [0, 400] });
    expect(lots[0].rank).toBeLessThan(lots[lots.length - 1].rank);
    expect(lots.map((l) => l.id).filter((id) => id === 'a' || id === 'a2')).toHaveLength(1);
  });
  test('sizes clamp to the spec 4b §2 ranges; wood fits inside concrete', () => {
    for (const l of townLots(bundle([rect('big', 0, 60, 20, 12), rect('small', 60, 60, 1, 1)]), rules)) {
      expect(l.wood.hx).toBeGreaterThanOrEqual(LOT.wood.hx[0]); expect(l.wood.hx).toBeLessThanOrEqual(LOT.wood.hx[1]);
      expect(l.wood.hz).toBeGreaterThanOrEqual(LOT.wood.hz[0]); expect(l.wood.hz).toBeLessThanOrEqual(LOT.wood.hz[1]);
      expect(l.concrete.hx).toBeGreaterThanOrEqual(LOT.concrete.hx[0]); expect(l.concrete.hx).toBeLessThanOrEqual(LOT.concrete.hx[1]);
      expect(l.concrete.hz).toBeLessThanOrEqual(LOT.concrete.hz[1]);
      expect(l.wood.hx).toBeLessThanOrEqual(l.concrete.hx); expect(l.wood.hz).toBeLessThanOrEqual(l.concrete.hz);
    }
  });
  test('deterministic', () => {
    const b = bundle([rect('1', 0, 60, 4, 3), rect('2', 30, 60, 4, 3)]);
    expect(townLots(b, rules)).toEqual(townLots(b, rules));
  });
});

describe('church plan', () => {
  test('the front is the end facing the plaza', () => {
    const p = churchPlan(bundle([]));
    expect(toLocal(p.fp, 40, 0)[0] * p.front).toBeGreaterThan(0);
  });
  test('real data: the church outline and the plaza are found', () => {
    const p = churchPlan(G);
    expect(p.fp.hx).toBeGreaterThan(8);
  });
});
