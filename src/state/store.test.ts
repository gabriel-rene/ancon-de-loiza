import { expect, test } from 'vitest';
import { goldenHourAST } from '../geo/sun';
import { defaultTime, useStore } from './store';
import { CROSSING_TIMINGS, DEFAULT_CROSSING_START, createCrossingState, crossingState } from '../ancon/crossing';

test('default time is the default era’s golden hour (no ?t in the URL)', () => {
  expect(useStore.getState().timeOfDay).toBe(goldenHourAST('1975-07-27'));
  expect(defaultTime('1984')).toBeLessThan(defaultTime('1975')); // February sets earlier than July
});
test('defaults: ride camera, crossing clock about to cast off, 1× speed, ancón shown', () => {
  const s = useStore.getState();
  expect(s.camera).toBe('ride');
  expect(s.crossingStart).toBe(DEFAULT_CROSSING_START);
  expect(s.crossingSpeed).toBe(1);
  expect(s.showAncon).toBe(true);
});
test('the page opens on the ferry loading at Loíza, casting off within 10 s', () => {
  const st = crossingState(useStore.getState().crossingStart, createCrossingState());
  expect([st.phase, st.leg]).toEqual(['load', 0]);
  const wait = CROSSING_TIMINGS.load - st.tLeg;
  expect(wait).toBeGreaterThan(0); expect(wait).toBeLessThanOrEqual(10);
});
