import { expect, test } from 'vitest';
import { goldenHourAST } from '../geo/sun';
import { defaultTime, useStore } from './store';
import { DEFAULT_CROSSING_START } from '../ancon/crossing';

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
