import { expect, test } from 'vitest';
import { goldenHourAST } from '../geo/sun';
import { defaultTime, shiftTime, useStore } from './store';
import { CROSSING_TIMINGS, DEFAULT_CROSSING_START, createCrossingState, crossingState } from '../ancon/crossing';
import { detectLang } from '../i18n/text';

test('default time is the default era’s golden hour (no ?t in the URL)', () => {
  expect(useStore.getState().timeOfDay).toBe(goldenHourAST('1975-07-27'));
  expect(defaultTime('1984')).toBeLessThan(defaultTime('1975')); // February sets earlier than July
});
test('defaults: ride camera, crossing clock about to cast off, 1× speed, ancón shown', () => {
  const s = useStore.getState();
  expect(s.camera).toBe('ride');
  expect(s.crossingStart).toBeNull();
  expect(s.crossingSpeed).toBe(1);
  expect(s.showAncon).toBe(true);
});
test('the page opens on the ferry loading at Loíza, casting off within 10 s', () => {
  const st = crossingState(useStore.getState().crossingStart ?? DEFAULT_CROSSING_START, createCrossingState());
  expect([st.phase, st.leg]).toEqual(['load', 0]);
  const wait = CROSSING_TIMINGS.load - st.tLeg;
  expect(wait).toBeGreaterThan(0); expect(wait).toBeLessThanOrEqual(10);
});
test('switching era keeps the time relative to that era’s golden hour', () => {
  useStore.setState({ eraId: '1975', timeOfDay: defaultTime('1975') + 0.25 });
  useStore.getState().setEra('1984');
  expect(useStore.getState().eraId).toBe('1984');
  expect(useStore.getState().timeOfDay).toBeCloseTo(defaultTime('1984') + 0.25, 9);
  expect(shiftTime(23.9, '1984', '1975')).toBeLessThanOrEqual(24);
});
test('language defaults from the browser and setLang changes it', () => {
  expect(useStore.getState().lang).toBe(detectLang(typeof navigator !== 'undefined' ? navigator.language : undefined));
  useStore.getState().setLang('es');
  expect(useStore.getState().lang).toBe('es');
  useStore.getState().setLang('en');
  expect(useStore.getState().lang).toBe('en');
});
