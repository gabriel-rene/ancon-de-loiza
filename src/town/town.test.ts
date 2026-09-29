import { describe, expect, test } from 'vitest';
import { ERAS, getEra } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { toWorld } from '../infrastructure/parts';
import { LANDING_CLEARING } from '../vegetation/masks';
import { distToLine, inRing, LOT, rectsOverlap } from './layout';
import { eraTown, lookOf, lotRules, lotsFor, STREET, townBlocked, type HouseLook } from './town';

const G = geo as unknown as GeoBundle;
const ORDER: Record<HouseLook, number> = { hut: 0, wood: 1, concrete: 2 };
const town = (e: (typeof ERAS)[number]) => eraTown(e.river.bankOffset.value, e);

describe('lots on the real map', () => {
  test('enough lots, none overlapping, none in the landing clearing', () => {
    for (const bank of new Set(ERAS.map((e) => e.river.bankOffset.value))) {
      const lots = lotsFor(bank), r = lotRules(bank);
      expect(lots.length).toBeGreaterThanOrEqual(40);
      for (let i = 0; i < lots.length; i++) {
        const c = lots[i].concrete.c;
        expect(Math.hypot(c[0] - r.clear[0], c[1] - r.clear[1])).toBeGreaterThan(LANDING_CLEARING[0]);
        for (let j = i + 1; j < lots.length; j++) expect(rectsOverlap(lots[i].concrete, lots[j].concrete)).toBe(false);
      }
    }
  });
});

describe('era town', () => {
  test('looks: concrete below concreteShare, huts above 1 − thatchShare', () => {
    const t = getEra('1959').town;
    expect(lookOf(0.05, t)).toBe('concrete'); expect(lookOf(0.5, t)).toBe('wood'); expect(lookOf(0.97, t)).toBe('hut');
    expect(lookOf(0, getEra('1840').town)).toBe('hut');
  });
  test('house count follows the share', () => {
    for (const e of ERAS) {
      const n = lotsFor(e.river.bankOffset.value).length;
      expect(town(e).houses).toHaveLength(Math.round(n * e.town.houseShare.value));
    }
  });
  test('a house shown once is shown later; its look never goes back', () => {
    for (let k = 1; k < ERAS.length; k++) {
      const before = new Map(town(ERAS[k - 1]).houses.map((h) => [h.id, h.look])), after = new Map(town(ERAS[k]).houses.map((h) => [h.id, h.look]));
      for (const [id, look] of before) {
        expect(after.has(id), `${ERAS[k].id} keeps ${id}`).toBe(true);
        expect(ORDER[after.get(id)!]).toBeGreaterThanOrEqual(ORDER[look]);
      }
    }
  });
  test('sizes per look; no two houses overlap', () => {
    for (const e of ERAS) {
      const hs = town(e).houses;
      for (const h of hs) {
        const r = h.look === 'concrete' ? LOT.concrete : LOT.wood;
        expect(h.fp.hx).toBeGreaterThanOrEqual(r.hx[0]); expect(h.fp.hx).toBeLessThanOrEqual(r.hx[1]);
        expect(h.fp.hz).toBeLessThanOrEqual(r.hz[1]);
      }
      for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) expect(rectsOverlap(hs[i].fp, hs[j].fp)).toBe(false);
    }
  });
  test('streets: town kinds in the circle, each within 15 m of a shown house; more streets later', () => {
    for (const e of ERAS) {
      const t = town(e);
      for (const s of t.streets) {
        const src = G.roads.find((r) => r.id === s.id)!;
        expect(Object.keys(STREET.kinds)).toContain(src.kind);
        expect(t.houses.some((h) => distToLine(s.points, h.fp.c[0], h.fp.c[1]) <= STREET.reach)).toBe(true);
      }
    }
    expect(town(getEra('1986')).streets.length).toBeGreaterThanOrEqual(town(getEra('1840')).streets.length);
    expect(town(getEra('1986')).streets.length).toBeGreaterThan(0);
  });
  test('plaza: 6–10 trees inside it; yards, church and plaza get dirt', () => {
    const t = town(getEra('1975'));
    expect(t.plazaTrees.length).toBeGreaterThanOrEqual(6); expect(t.plazaTrees.length).toBeLessThanOrEqual(10);
    for (const p of t.plazaTrees) expect(inRing(t.plaza, p.x, p.z)).toBe(true);
    expect(t.dirt).toHaveLength(t.houses.length + 2);
  });
  test('no plants inside a house, the church or the plaza', () => {
    const t = town(getEra('1986')), blocked = townBlocked(t);
    for (const h of t.houses) for (const [sx, sz] of [[0, 0], [0.9, 0.9], [-0.9, 0.9], [0.9, -0.9], [-0.9, -0.9]]) {
      expect(blocked(...toWorld(h.fp, sx * h.fp.hx, sz * h.fp.hz))).toBe(true);
    }
    expect(blocked(...t.church.fp.c)).toBe(true);
    for (const p of t.plazaTrees) expect(blocked(p.x, p.z)).toBe(true);   // other plants keep out; plaza trees are added after placement
    expect(blocked(-900, -900)).toBe(false);
  });
  test('deterministic and cached', () => {
    const e = getEra('1935');
    expect(eraTown(e.river.bankOffset.value, e)).toBe(eraTown(e.river.bankOffset.value, e));
  });
});
