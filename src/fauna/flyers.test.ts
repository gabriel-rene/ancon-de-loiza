import { expect, test } from 'vitest';
import { createCrossingState, crossingState } from '../ancon/crossing';
import { waterAt } from '../ancon/geometry';
import { WATER } from '../terrain/fields';
import { FISHER, fisherEvents, fisherPlan, FLOCK, flockAlong, frigate, pelicanFisher, pelicanFlock } from './flyers';
import { createFaunaPose } from './pose';
import { distToCrossing, FRAME_RADIUS } from './site';
import { worldFor } from './testing';

const w = worldFor('1975'), p = createFaunaPose(), q = createFaunaPose();

test('same clock, same pose', () => {
  for (const c of [0, 17.3, 400.9]) {
    expect(pelicanFlock(c, 2, w, p)).toEqual(pelicanFlock(c, 2, w, q));
    expect(pelicanFisher(c, 1, w, p)).toEqual(pelicanFisher(c, 1, w, q));
    expect(frigate(c, 0, w, p)).toEqual(frigate(c, 0, w, q));
  }
});

for (const id of ['1975', '1840'] as const) {
  const ew = worldFor(id), g = ew.site.geom;
  const ground = (x: number, z: number) => Math.max(0, ew.site.groundAt(x, z));
  const alongOf = (x: number, z: number) => (x - g.shoreEast[0]) * g.dir[0] + (z - g.shoreEast[1]) * g.dir[1];

  test(`flock ${id}: 3–8 m up, ≥ 2 m clear, inside the frame`, () => {
    for (let c = 0; c < 900; c += 0.37) for (let i = 0; i < 4; i++) {
      pelicanFlock(c, i, ew, p);
      expect(p.y).toBeGreaterThanOrEqual(3 - 1e-6);
      expect(p.y).toBeLessThanOrEqual(8 + 1e-6);
      expect(p.y - ground(p.x, p.z)).toBeGreaterThanOrEqual(2);
      expect(distToCrossing(ew.site, p.x, p.z)).toBeLessThan(FRAME_RADIUS);
    }
  });

  test(`flock ${id}: each pass ahead of a crossing ferry crosses the line 40–70 m ahead, inside the banks`, () => {
    const st = createCrossingState();
    let ahead = 0;
    for (let k = 0; k < 60; k++) {
      const a = flockAlong(k, ew);
      expect(a).toBeGreaterThanOrEqual(FLOCK.margin);
      expect(a).toBeLessThanOrEqual(g.span - FLOCK.margin);
      crossingState((k + 0.5) * FLOCK.period, st, ew.T);
      if (st.phase !== 'cross') continue;
      const d = (a - g.span * st.s) * st.travel;
      if (d < 0) continue;                                          // no room ahead: it crosses behind (next test)
      if (a > FLOCK.margin && a < g.span - FLOCK.margin) { expect(d).toBeGreaterThanOrEqual(40 - 1e-6); expect(d).toBeLessThanOrEqual(70 + 1e-6); ahead++; }
    }
    expect(ahead).toBeGreaterThan(5);
  });

  test(`flock ${id}: a pass never crosses less than ${FLOCK.near} m ahead of the ferry (then it crosses behind)`, () => {
    const st = createCrossingState();
    let behind = 0;
    for (let k = 0; k < 200; k++) {
      const a = flockAlong(k, ew);
      crossingState((k + 0.5) * FLOCK.period, st, ew.T);
      const facing = st.phase === 'unload' ? -st.travel : st.travel, d = (a - g.span * st.s) * facing;
      if (d < FLOCK.near) { expect(d, `loop ${k}`).toBeLessThan(0); behind++; }
    }
    expect(behind).toBeGreaterThan(0);
  });

  test(`frigatebirds ${id}: 60–68 m up, beyond their bank, inside the frame, continuous`, () => {
    for (let i = 0; i < 3; i++) {
      frigate(0, i, ew, q);
      for (let c = 0.1; c < 900; c += 0.1) {
        frigate(c, i, ew, p);
        expect(p.y).toBeGreaterThanOrEqual(60);
        expect(p.y).toBeLessThanOrEqual(68);
        expect(distToCrossing(ew.site, p.x, p.z)).toBeLessThan(FRAME_RADIUS);
        expect(p.flap).toBe(0);
        const al = alongOf(p.x, p.z);
        if (i & 1) expect(al).toBeGreaterThan(g.span + 30); else expect(al).toBeLessThan(-30);
        expect(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)).toBeLessThan(1);
        Object.assign(q, p);
      }
    }
  });
}

test('fisher: circles at 11 m, dives to the water at the impact time, sits, takes off', () => {
  for (let i = 0; i < 2; i++) {
    const { impact, takeoff } = fisherEvents(i, 200);
    expect(impact).toBeGreaterThanOrEqual(200);
    expect(takeoff - impact).toBeCloseTo(fisherPlan(i).sit, 6);
    pelicanFisher(impact - FISHER.dive - 0.5, i, w, p);
    expect(p.y).toBeCloseTo(FISHER.h, 6);
    pelicanFisher(impact + 0.5, i, w, p);
    expect(p.y).toBeLessThan(0.05);
    expect(p.fold).toBe(1);
    expect(waterAt(w.site.fields, p.x, p.z)).toBe(WATER.RIVER);
    pelicanFisher(takeoff + FISHER.run + FISHER.climb + 0.5, i, w, p);
    expect(p.y).toBeCloseTo(FISHER.h, 6);
  }
});

test('fisher positions are continuous (no jumps > 2.5 m per 0.1 s; the dive drops fastest)', () => {
  for (let i = 0; i < 2; i++) {
    pelicanFisher(0, i, w, q);
    for (let c = 0.1; c < 300; c += 0.1) {
      pelicanFisher(c, i, w, p);
      expect(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)).toBeLessThan(2.5);
      Object.assign(q, p);
    }
  }
});
