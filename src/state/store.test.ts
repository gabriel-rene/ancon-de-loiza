import { expect, test } from 'vitest';
import { goldenHourAST } from '../geo/sun';
import { defaultTime, useStore } from './store';

test('default time is the default era’s golden hour (no ?t in the URL)', () => {
  expect(useStore.getState().timeOfDay).toBe(goldenHourAST('1975-07-27'));
  expect(defaultTime('1984')).toBeLessThan(defaultTime('1975')); // February sets earlier than July
});
