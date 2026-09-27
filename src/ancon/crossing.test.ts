import { describe, expect, test } from 'vitest';
import { advanceClock, createCrossingState, CROSSING_TIMINGS as T, crossingState, legDuration, mooredState, PHASES } from './crossing';

const L = legDuration();
const at = (c: number) => ({ ...crossingState(c, createCrossingState()) });

describe('crossing state machine', () => {
  test('one crossing ≈ 3 min, round trip = 2 legs', () => {
    expect(L).toBe(180);
    expect(T.load + T.castOff + T.cross + T.dock + T.unload).toBe(L);
  });
  test('phases run in order through each leg', () => {
    let t0 = 0;
    for (const ph of PHASES) {
      const st = at(t0 + T[ph] / 2);
      expect(st.phase).toBe(ph); expect(st.phaseT).toBeCloseTo(0.5, 6); expect(st.leg).toBe(0);
      expect(at(L + t0 + T[ph] / 2).phase).toBe(ph);
      t0 += T[ph];
    }
  });
  test('leg 0 goes east → west (s 0 → 1), leg 1 comes back', () => {
    expect(at(5).s).toBe(0); expect(at(L - 5).s).toBe(1);
    expect(at(L + 5).s).toBe(1); expect(at(2 * L - 5).s).toBe(0);
    expect(at(5).travel).toBe(1); expect(at(L + 5).travel).toBe(-1);
  });
  test('s is monotonic within a leg, continuous everywhere, and v/a are its derivatives', () => {
    let prev = at(0);
    for (let c = 0.1; c <= 2 * L; c += 0.1) {
      const st = at(c);
      if (st.legIndex === prev.legIndex) expect((st.s - prev.s) * st.travel).toBeGreaterThanOrEqual(-1e-12);
      expect(Math.abs(st.s - prev.s)).toBeLessThan(0.002);
      expect(Math.abs(st.v - prev.v)).toBeLessThan(2e-4);
      expect((st.s - prev.s) / 0.1).toBeCloseTo((st.v + prev.v) / 2, 4);
      expect((st.v - prev.v) / 0.1).toBeCloseTo((st.a + prev.a) / 2, 4);
      prev = st;
    }
  });
  test('cruise ≈ 1 m/s on the real 122–138 m dock-to-dock line', () => {
    const st = at(T.load + T.castOff + T.cross / 2);
    expect(st.v * 122).toBeGreaterThan(0.9); expect(st.v * 138).toBeLessThan(1.2);
  });
  test('ropes slack while docked, taut mid-crossing; effort continuous 0 → 1 → 0', () => {
    expect(at(5).slack).toBe(1); expect(at(T.load + T.castOff + 40).slack).toBe(0); expect(at(L - 3).slack).toBe(1);
    expect(at(5).effort).toBe(0); expect(at(T.load + T.castOff + 40).effort).toBe(1);
    let prev = at(0);
    for (let c = 0.05; c <= L; c += 0.05) {
      const st = at(c);
      expect(Math.abs(st.slack - prev.slack)).toBeLessThan(0.02);
      expect(Math.abs(st.effort - prev.effort)).toBeLessThan(0.03);
      prev = st;
    }
  });
  test('deterministic, periodic over a round trip, negative clocks wrap', () => {
    const a = at(123.4), b = at(123.4 + 2 * L), n = at(123.4 - 2 * L);
    for (const k of ['phaseT', 's', 'v', 'a', 'slack', 'effort'] as const) { expect(b[k]).toBeCloseTo(a[k], 9); expect(n[k]).toBeCloseTo(a[k], 9); }
    for (const k of ['phase', 'leg', 'travel'] as const) { expect(b[k]).toBe(a[k]); expect(n[k]).toBe(a[k]); }
  });
  test('reuses the out object', () => {
    const o = createCrossingState(); expect(crossingState(10, o)).toBe(o);
  });
  test('crossing clock: integrates dt × speed, holds when frozen, stays continuous when the speed changes', () => {
    expect(advanceClock(12, 0.5, false, 1)).toBe(12.5);
    expect(advanceClock(12, 0.5, false, 4)).toBe(14);
    expect(advanceClock(12, 0.5, true, 4)).toBe(12);
    let c = 12;
    for (let i = 0; i < 100; i++) c = advanceClock(c, 0.1, false, 1);
    const before = c;
    c = advanceClock(c, 0.1, false, 8);                     // speed jumps 1 → 8: one frame advances 0.8 s, no jump
    expect(c - before).toBeCloseTo(0.8, 12);
  });
  test('moored state writes in place: docked east, slack, idle', () => {
    const o = at(90) as ReturnType<typeof createCrossingState>;
    expect(mooredState(o)).toBe(o);
    expect([o.phase, o.s, o.v, o.slack, o.effort]).toEqual(['load', 0, 0, 1, 0]);
  });
});
