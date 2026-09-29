import { describe, expect, test } from 'vitest';
import { CROSSING_TIMINGS, legDuration } from '../ancon/crossing';
import { ERAS, getEra, type EraId } from '../data/eras';
import { tripAt, tripDuration } from './trip';
import { eraTimings, LegCache, MAX_STOP, planLeg, QUEUE_GAP, type MoverSched } from './schedule';
import { rearOverhang } from './models';
import { envFor } from './testing';

describe('eraTimings', () => {
  test('never shorter than today, never over 50 s, and today where nothing boards', () => {
    for (const e of ERAS) {
      const T = eraTimings(e);
      expect(T.load, e.id).toBeGreaterThanOrEqual(CROSSING_TIMINGS.load);
      expect(T.unload, e.id).toBeGreaterThanOrEqual(CROSSING_TIMINGS.unload);
      expect(T.load, e.id).toBeLessThanOrEqual(MAX_STOP); expect(T.unload, e.id).toBeLessThanOrEqual(MAX_STOP);
      expect([T.castOff, T.cross, T.dock]).toEqual([CROSSING_TIMINGS.castOff, CROSSING_TIMINGS.cross, CROSSING_TIMINGS.dock]);
    }
    expect(eraTimings(getEra('1986'))).toEqual(CROSSING_TIMINGS);
    expect(eraTimings(getEra('1984')).load).toBeGreaterThan(CROSSING_TIMINGS.load);
    expect(eraTimings(getEra('1975'))).toBe(eraTimings(getEra('1975')));   // memoised
  });
});

describe('planLeg', () => {
  const envT = envFor;
  test('every mover is parked with room for the passengers, and off the deck with room for them to leave', () => {
    for (const id of ['1840', '1900', '1925', '1935', '1959', '1975', '1984'] as const) for (const leg of [0, 1, 2, 3, 4]) {
      const env = envT(id), T = env.spec.timings, p = planLeg(env, leg);
      for (const s of p.movers) {
        expect(s.boardEnd, `${id} ${leg}`).toBeLessThanOrEqual(T.load - 20 + 1e-6);
        expect(s.offDeck, `${id} ${leg}`).toBeLessThanOrEqual(T.unload - 16 + 1e-6);
        expect(s.spawn.t0, id).toBeLessThan(0);                                   // queues during the previous leg
        expect(s.spawn.t0, id).toBeGreaterThan(-legDuration(T) + T.load + T.castOff);   // …after it cast off
        expect(tripDuration(s.spawn) + s.spawn.t0, id).toBeLessThan(-T.unload - T.dock);   // …and is in line before it docks
      }
      expect(p.load.boardEnd).toBe(Math.max(0, ...p.movers.map((s) => s.boardEnd)));
      expect(p.load.helmAshore).toBe(env.spec.helmsman && p.movers.length > 0);
    }
  });

  test('the waiting line keeps its gaps and its head at the queue point when the ferry docks', () => {
    const env = envT('1984'), T = env.spec.timings, p = planLeg(env, 2), pt = { s: 0, v: 0 }, dock = -T.unload - T.dock;
    const back = (s: MoverSched) => s.queueS - tripAt(s.spawn, dock, pt).s;
    for (const line of [p.movers.filter((s) => s.m.kind !== 'bicycle'), p.movers.filter((s) => s.m.kind === 'bicycle')]) {
      expect(back(line[0])).toBeCloseTo(0, 6);
      for (let k = 1; k < line.length; k++) {
        const a = line[k - 1].m.dims, b = line[k].m.dims;
        // front-to-front spacing ≥ leader's wheelbase + rear overhang + gap + follower's front
        expect(back(line[k]) - back(line[k - 1])).toBeGreaterThanOrEqual(a.wheelbase + rearOverhang(a) + QUEUE_GAP + b.front - 1e-6);
      }
    }
  });

  test('cache returns the same plan object for the same leg', () => {
    const c = new LegCache(envT('1975'));
    expect(c.get(3)).toBe(c.get(3));
    expect(c.get(4).movers.length).toBe(6);
  });
});
