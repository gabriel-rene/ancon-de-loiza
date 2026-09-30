import { describe, expect, test } from 'vitest';
import { ERAS, getEra, type EraId } from '../data/eras';
import { seatAnchors } from '../ancon/seats';
import { deckLayout, vesselSpec } from '../ancon/spec';
import { rearOverhang, type MoverDims } from './models';
import { footprint, legMovers, travelOf } from './plan';

const planFor = (id: EraId, leg: number) => {
  const era = getEra(id), spec = vesselSpec(era), L = deckLayout(spec);
  return { spec, L, movers: legMovers(era.ancon.load.value, spec, L, seatAnchors(spec, L), Number(id), leg) };
};
/** Body centre along x' (the parked origin is the contact midpoint, which sits off-centre by (front − rear) / 2). */
const centre = (x: number, d: MoverDims) => x + (d.front - rearOverhang(d)) / 2;
const overlap = (a: number[], b: number[]) => a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3];

describe('legMovers', () => {
  test('same era and leg ⇒ same movers; legs cycle', () => {
    expect(planFor('1975', 5)).toEqual(planFor('1975', 5));
    expect(planFor('1975', 4).movers.filter((m) => m.kind === 'tvVan').length).toBe(2);
    expect(planFor('1975', 5).movers.filter((m) => m.kind === 'tvVan').length).toBe(0);
    expect(planFor('1925', 0).movers.map((m) => m.kind)).toEqual(['oxCart']);
    expect(planFor('1925', 1).movers.map((m) => m.kind)).toEqual(['modelT']);
    expect(planFor('1925', 2).movers.map((m) => m.kind)).toEqual(['horse']);
    expect(planFor('1925', -1).movers.map((m) => m.kind)).toEqual(['horse']);   // negative legs cycle too
    expect(planFor('1900', 1).movers).toEqual([]);
    expect(planFor('1986', 0).movers).toEqual([]);
  });

  test('counts, drivers and attendants', () => {
    const p = planFor('1984', 0).movers;
    expect(p.filter((m) => m.kind === 'bicycle').length).toBe(2);
    expect(p.length).toBe(10);
    for (const m of p) expect(m.people.length).toBe(1);
    expect(p.filter((m) => m.people[0].role === 'driver').length).toBe(8);
    expect(planFor('1959', 3).movers[0].kind).toBe('publico');
    const ox = planFor('1840', 0).movers[0];
    expect(ox.people[0]).toMatchObject({ role: 'attendant', goad: true });
    expect(planFor('1840', 1).movers[0].people[0].goad).toBe(false);   // the horse is led, not goaded
    // Drivers sit on the left (left-hand drive: model z < 0).
    for (const m of p.filter((x) => x.people[0].role === 'driver')) expect(m.people[0].at[2]).toBeLessThan(0);
  });

  test('boarding order: the farthest from the entry end first', () => {
    for (const id of ['1959', '1975', '1984'] as const) {
      const cars = planFor(id, 0).movers.filter((m) => m.kind !== 'bicycle');
      for (let k = 1; k < cars.length; k++) expect(centre(cars[k].park.x, cars[k].dims)).toBeLessThanOrEqual(centre(cars[k - 1].park.x, cars[k - 1].dims) + 1e-9);
      expect(cars.map((m) => m.order)).toEqual(cars.map((_, k) => k));
    }
  });

  test('parked loads stay on deck, clear of each other, the helmsman and the crew lanes', () => {
    for (const e of ERAS) for (let leg = 0; leg < 4; leg++) {
      const { spec, L, movers } = planFor(e.id, leg), tr = travelOf(leg);
      const fps = movers.map((m) => footprint(m, tr));
      for (const f of fps) {
        expect(Math.max(Math.abs(f[0]), Math.abs(f[1])), e.id).toBeLessThanOrEqual(L.halfLength + 1e-9);
        expect(Math.max(Math.abs(f[2]), Math.abs(f[3])), e.id).toBeLessThanOrEqual(L.halfBeam + 1e-9);
      }
      for (let i = 0; i < fps.length; i++) for (let j = i + 1; j < fps.length; j++) expect(overlap(fps[i], fps[j]), `${e.id} ${leg}`).toBe(false);
      if (spec.helmsman) {   // the helmsman's station at the trailing end (x = −tr·(hl − 0.5), z = 0, r 0.25)
        const hx = -tr * (L.halfLength - 0.5), helm = [hx - 0.25, hx + 0.25, -0.25, 0.25];
        for (const f of fps) expect(overlap(f, helm), e.id).toBe(false);
      }
      if (spec.propulsion === 'poles') for (const f of fps) {   // polers walk the side lanes (r 0.25); one poler walks side +z only
        const lane = L.halfBeam - 0.45 - 0.25 + 1e-9;
        expect(f[3], e.id).toBeLessThanOrEqual(lane);
        if (spec.crew >= 2) expect(-f[2], e.id).toBeLessThanOrEqual(lane);
      }
    }
  });
});
