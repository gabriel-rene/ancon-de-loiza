import { expect, test } from 'vitest';
import { tripAt, tripDuration, tripEndSpeed, tripTimeAt, type Trip } from './trip';

const pt = { s: 0, v: 0 };
test('a stopping trip starts and ends at rest and never exceeds vmax', () => {
  const t: Trip = { t0: 2, s0: 5, s1: 45, v0: 0, vmax: 3, accel: 1, stop: true };
  const T = tripDuration(t);
  expect(tripAt(t, 0, pt)).toEqual({ s: 5, v: 0 });
  expect(tripAt(t, 2 + T + 5, pt)).toEqual({ s: 45, v: 0 });
  let prev = 5;
  for (let x = 2; x <= 2 + T; x += 0.05) {
    const p = tripAt(t, x, pt);
    expect(p.v).toBeLessThanOrEqual(3 + 1e-9); expect(p.s).toBeGreaterThanOrEqual(prev - 1e-9); prev = p.s;
  }
  expect(T).toBeCloseTo(31 / 3 + 6, 6);   // 3 s up (4.5 m), 31 m at 3 m/s, 3 s down (4.5 m)
});
test('a short trip peaks below vmax (triangle)', () => {
  const t: Trip = { t0: 0, s0: 0, s1: 2, v0: 0, vmax: 3, accel: 1, stop: true };
  expect(tripDuration(t)).toBeCloseTo(2 * Math.sqrt(2), 6);
  expect(tripAt(t, Math.sqrt(2), pt).v).toBeCloseTo(Math.sqrt(2), 6);
});
test('a non-stopping trip keeps its end speed; tripTimeAt inverts tripAt', () => {
  const t: Trip = { t0: 1, s0: 0, s1: 30, v0: 2, vmax: 5, accel: 1, stop: false };
  expect(tripEndSpeed(t)).toBeCloseTo(5, 9);
  for (const s of [0, 3, 10.5, 29.9]) expect(tripAt(t, tripTimeAt(t, s), pt).s).toBeCloseTo(s, 6);
});
