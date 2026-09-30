import { expect, test } from 'vitest';
import { createCrossingState, crossingState, CROSSING_TIMINGS, legDuration } from '../ancon/crossing';
import { eventTime, lastDockStart, u01 } from './clock';

const T = CROSSING_TIMINGS, L = legDuration(T);

test('u01 is deterministic and in [0, 1)', () => {
  for (let k = -50; k < 50; k++) {
    const a = u01(k, 3, 7);
    expect(a).toBe(u01(k, 3, 7));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  }
});

test('eventTime gaps stay in [period − 2·jitter, period + 2·jitter]', () => {
  for (let k = -20; k < 400; k++) {
    const g = eventTime(k + 1, 4.5, 0.75, 83) - eventTime(k, 4.5, 0.75, 83);
    expect(g).toBeGreaterThanOrEqual(3 - 1e-9);
    expect(g).toBeLessThanOrEqual(6 + 1e-9);
  }
});

test('lastDockStart matches the crossing state machine at both landings', () => {
  const st = createCrossingState();
  for (let clock = -300; clock < 6 * L; clock += 0.5) {
    for (const landing of [0, 1] as const) {
      const d = lastDockStart(clock, T, landing, false);
      expect(d).toBeLessThanOrEqual(clock);
      expect(clock - d).toBeLessThan(2 * L);
      crossingState(d + 0.01, st, T);
      expect(st.phase).toBe('dock');
      // leg 0 travels east → west and docks at the west landing (1).
      expect(st.leg === 0 ? 1 : 0).toBe(landing);
    }
  }
});

test('lastDockStart is -Infinity when moored', () => {
  expect(lastDockStart(100, T, 0, true)).toBe(-Infinity);
});
