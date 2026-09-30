import { expect, test } from 'vitest';
import { waterAt } from '../ancon/geometry';
import { createCrossingState, crossingState } from '../ancon/crossing';
import { WATER } from '../terrain/fields';
import { fisherEvents } from './flyers';
import { createFaunaPose } from './pose';
import { RING_POOL, ringsAt } from './rings';
import { distToCrossing, FRAME_RADIUS } from './site';
import { worldFor } from './testing';
import { manatee, manateeSpot, manateeTime, MANATEE, MULLET, mullet, mulletJump, type Jump } from './waterLife';

const w = worldFor('1975'), g = w.site.geom, p = createFaunaPose();
const lateralOff = (x: number, z: number) => (x - g.shoreEast[0]) * w.site.lateral[0] + (z - g.shoreEast[1]) * w.site.lateral[1];

test('mullet: jumps 3–6 s apart, in the river, off the crossing line, within 120 m of the ferry', () => {
  const j: Jump = { x: 0, z: 0, hx: 0, hz: 0, h: 0, t0: 0 }, st = createCrossingState();
  let found = 0;
  for (let k = 0; k < 300; k++) {
    if (!mulletJump(k, w, j)) continue;
    found++;
    expect(waterAt(w.site.fields, j.x, j.z)).toBe(WATER.RIVER);
    expect(Math.abs(lateralOff(j.x, j.z))).toBeGreaterThanOrEqual(MULLET.clear);
    crossingState(j.t0, st, w.T);
    const fx = g.shoreEast[0] + g.dir[0] * g.span * st.s, fz = g.shoreEast[1] + g.dir[1] * g.span * st.s;
    expect(Math.hypot(j.x - fx, j.z - fz)).toBeLessThanOrEqual(120 + 1e-6);
    expect(j.h).toBeGreaterThanOrEqual(0.3);
    expect(j.h).toBeLessThanOrEqual(0.6);
  }
  expect(found).toBeGreaterThan(270);
});

test('mullet is visible only during a jump, and rises above the water mid-jump', () => {
  const j: Jump = { x: 0, z: 0, hx: 0, hz: 0, h: 0, t0: 0 };
  let k = 10; while (!mulletJump(k, w, j)) k++;
  expect(mullet(j.t0 + MULLET.dur / 2, w, p).on).toBe(true);
  expect(p.y).toBeGreaterThan(0.1);
  expect(mullet(j.t0 - 0.5, w, p).on).toBe(false);
});

test('manatee: surfaces 60–90 s apart, moves 5–15 m between surfacings, inside its zone', () => {
  const a = [0, 0, 0], b = [0, 0, 0];
  for (let k = 0; k < 100; k++) {
    const gap = manateeTime(k + 1) - manateeTime(k);
    expect(gap).toBeGreaterThanOrEqual(60 - 1e-9);
    expect(gap).toBeLessThanOrEqual(90 + 1e-9);
    manateeSpot(k, w, a); manateeSpot(k + 1, w, b);
    const d = Math.hypot(a[0] - b[0], a[2] - b[2]);
    expect(d).toBeGreaterThanOrEqual(5);
    expect(d).toBeLessThanOrEqual(15);
    const off = lateralOff(a[0], a[2]);
    expect(Math.sign(off)).toBe(w.site.mouthSide);
    expect(Math.abs(off)).toBeGreaterThanOrEqual(25);
    expect(Math.abs(off)).toBeLessThanOrEqual(40);
  }
  const t0 = manateeTime(5);
  expect(manatee(t0 + MANATEE.dur * 0.5, w, p).on).toBe(true);
  expect(p.y + 0.47).toBeGreaterThan(0.05);     // the back breaks the water (body half-height 0.47)
  expect(manatee(t0 - 1, w, p).on).toBe(false);
});

test('rings: every event starts one, the pool never overflows, all inside the frame', () => {
  const buf = new Float32Array(RING_POOL * 4);
  let worst = 0;
  for (let c = 0; c < 2400; c += 0.25) {
    const n = ringsAt(c, w, 2, buf);
    worst = Math.max(worst, n);
    for (let r = 0; r < Math.min(n, RING_POOL); r++) {
      expect(buf[r * 4 + 2]).toBeGreaterThanOrEqual(0);
      expect(buf[r * 4 + 2]).toBeLessThan(1);
      expect(distToCrossing(w.site, buf[r * 4], buf[r * 4 + 1])).toBeLessThan(FRAME_RADIUS);
    }
  }
  expect(worst).toBeLessThanOrEqual(RING_POOL);
  const { impact } = fisherEvents(0, 500);
  expect(ringsAt(impact + 0.1, w, 2, buf)).toBeGreaterThanOrEqual(1);
  expect(ringsAt(manateeTime(9) + 0.1 * MANATEE.dur, w, 2, buf)).toBeGreaterThanOrEqual(1);
});
