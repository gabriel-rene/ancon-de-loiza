import { expect, test } from 'vitest';
import { waterAt } from '../ancon/geometry';
import { WATER } from '../terrain/fields';
import { FISHER, fisherEvents, fisherPlan, frigate, pelicanFisher, pelicanFlock } from './flyers';
import { createFaunaPose } from './pose';
import { distToCrossing, FRAME_RADIUS } from './site';
import { worldFor } from './testing';

const w = worldFor('1975'), p = createFaunaPose(), q = createFaunaPose();
const clear = (x: number, z: number) => Math.max(0, w.site.groundAt(x, z));

test('same clock, same pose', () => {
  for (const c of [0, 17.3, 400.9]) {
    expect(pelicanFlock(c, 2, w, p)).toEqual(pelicanFlock(c, 2, w, q));
    expect(pelicanFisher(c, 1, w, p)).toEqual(pelicanFisher(c, 1, w, q));
    expect(frigate(c, 0, w, p)).toEqual(frigate(c, 0, w, q));
  }
});

test('flock: 3–8 m up, ≥ 2 m clear, inside the frame', () => {
  for (let c = 0; c < 600; c += 0.37) for (let i = 0; i < 4; i++) {
    pelicanFlock(c, i, w, p);
    expect(p.y).toBeGreaterThanOrEqual(3 - 1e-6);
    expect(p.y).toBeLessThanOrEqual(8 + 1e-6);
    expect(p.y - clear(p.x, p.z)).toBeGreaterThanOrEqual(2);
    expect(distToCrossing(w.site, p.x, p.z)).toBeLessThan(FRAME_RADIUS);
  }
});

test('frigatebirds: 60–120 m up, inside the frame', () => {
  for (let c = 0; c < 900; c += 0.9) for (let i = 0; i < 3; i++) {
    frigate(c, i, w, p);
    expect(p.y).toBeGreaterThanOrEqual(60);
    expect(p.y).toBeLessThanOrEqual(120);
    expect(distToCrossing(w.site, p.x, p.z)).toBeLessThan(FRAME_RADIUS);
    expect(p.flap).toBe(0);
  }
});

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
