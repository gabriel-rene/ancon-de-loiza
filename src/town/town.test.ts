import { describe, expect, test } from 'vitest';
import { ERAS, getEra } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { waterAt } from '../ancon/geometry';
import { toWorld, type Footprint } from '../infrastructure/parts';
import { bridgeWay, eraRoads } from '../infrastructure/roads';
import { stationLayout, upstreamSign } from '../infrastructure/station';
import { sampleField, WATER } from '../terrain/fields';
import { landingPadsFor, placementFields } from '../terrain/placementFields';
import { LANDING_CLEARING } from '../vegetation/masks';
import { CIRCLE_R, clipToCircle, TOWN_CENTRE } from './constants';
import { churchReach, distToLine, inRing, LOT, rectLineDist, rectRingOverlap, rectsOverlap } from './layout';
import { eraTown, lookOf, lotRules, lotsFor, STREET, townBlocked, type HouseLook } from './town';

const G = geo as unknown as GeoBundle;
const ORDER: Record<HouseLook, number> = { hut: 0, wood: 1, concrete: 2 };
const town = (e: (typeof ERAS)[number]) => eraTown(e.river.bankOffset.value, e);

describe('clipToCircle', () => {
  const [cx, cz] = TOWN_CENTRE, R = CIRCLE_R;
  test('cuts at the edge, keeps inside pieces, splits a line that leaves and comes back', () => {
    const [a] = clipToCircle([[cx - 2 * R, cz], [cx, cz]]);
    expect(a[0][0]).toBeCloseTo(cx - R, 6); expect(a[0][1]).toBeCloseTo(cz, 6); expect(a[1]).toEqual([cx, cz]);
    expect(clipToCircle([[cx + 2 * R, cz], [cx + 3 * R, cz]])).toEqual([]);
    const p = clipToCircle([[cx - 10, cz], [cx + 2 * R, cz], [cx + 2 * R, cz + 20], [cx + 10, cz + 20]]);
    expect(p).toHaveLength(2);
    expect(p[0][0]).toEqual([cx - 10, cz]); expect(p[0][1][0]).toBeCloseTo(cx + R, 6);
    expect(Math.hypot(p[1][0][0] - cx, p[1][0][1] - cz)).toBeCloseTo(R, 6); expect(p[1][1]).toEqual([cx + 10, cz + 20]);
  });
});

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
  const srcOf = (id: string) => G.roads.find((r) => r.id === id.split('#')[0])!;
  const numbered = (id: string) => ['PR-951', 'PR-188'].includes(srcOf(id).ref ?? '');
  test('streets: town kinds (and numbered roads before 1935) within 15 m of a shown house; more streets later', () => {
    for (const e of ERAS) {
      const t = town(e);
      for (const s of t.streets) {
        if (numbered(s.id) && Number(e.id) < 1935) expect(['tertiary', 'secondary']).toContain(srcOf(s.id).kind);
        else expect(Object.keys(STREET.kinds)).toContain(srcOf(s.id).kind);
        expect(t.houses.some((h) => distToLine(s.points, h.fp.c[0], h.fp.c[1]) <= STREET.reach)).toBe(true);
      }
      if (Number(e.id) >= 1935) expect(t.streets.some((s) => numbered(s.id))).toBe(false);   // then eraRoads paints them whole
    }
    expect(town(getEra('1986')).streets.length).toBeGreaterThanOrEqual(town(getEra('1840')).streets.length);
    expect(town(getEra('1986')).streets.length).toBeGreaterThan(0);
  });
  test('no painted street point lies outside the town circle, in any era', () => {
    for (const e of ERAS) for (const s of town(e).streets) for (const [x, z] of s.points) {
      expect(Math.hypot(x - TOWN_CENTRE[0], z - TOWN_CENTRE[1]), `${e.id} ${s.id}`).toBeLessThanOrEqual(CIRCLE_R + 0.01);
    }
  });
  test('before 1935 the numbered roads paint only in-town pieces; Calle Espíritu Santo shows in 1840', () => {
    for (const e of ERAS.filter((x) => Number(x.id) < 1935)) {
      const pieces = town(e).streets.filter((s) => numbered(s.id));
      for (const s of pieces) for (const [x, z] of s.points) expect(Math.hypot(x - TOWN_CENTRE[0], z - TOWN_CENTRE[1])).toBeLessThanOrEqual(CIRCLE_R + 0.01);
    }
    expect(town(getEra('1840')).streets.some((s) => s.id.startsWith('22182173#'))).toBe(true);
  });
  test('no house overlaps the church, the plaza, a story road or the 4a station (real data, every era)', () => {
    for (const e of ERAS) {
      const t = town(e), reach = churchReach(t.church), bank = e.river.bankOffset.value, f = placementFields(bank);
      const dryAt = (x: number, z: number) => waterAt(f, x, z) === WATER.LAND && sampleField(f, f.shore, x, z) >= 2;
      const [east] = landingPadsFor(bank), v = e.infrastructure, gone = v.bridge.value !== 'none' && !v.neighbourHouse.value;
      const st = stationLayout(east, v.station.value, gone, upstreamSign(east, bridgeWay(G)), dryAt);
      const station = [st.house, st.terrace, st.shelter, v.neighbourHouse.value ? st.neighbour : null].filter(Boolean) as Footprint[];
      expect(station.length).toBeGreaterThan(0);
      for (const h of t.houses) {
        expect(rectsOverlap(h.fp, reach), `${e.id} ${h.id} church`).toBe(false);
        expect(rectRingOverlap(h.fp, t.plaza), `${e.id} ${h.id} plaza`).toBe(false);
        for (const r of eraRoads(G, e).story) expect(rectLineDist(h.fp, r.points), `${e.id} ${h.id} ${r.id}`).toBeGreaterThan(r.width / 2);
        for (const s of station) expect(rectsOverlap(h.fp, s), `${e.id} ${h.id} station`).toBe(false);
      }
    }
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
