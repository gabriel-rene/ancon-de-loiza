import { expect, test } from 'vitest';
import { parseUrlState, toSearch } from './url';

test('parses known params and ignores junk', () => {
  expect(parseUrlState('?era=1935&t=17.5&cam=ride&q=low&debug=1&freeze=1&x=9')).toEqual({
    eraId: '1935', timeOfDay: 17.5, camera: 'ride', quality: 'low', debug: true, frozen: true,
  });
});
test('rejects invalid values', () => {
  expect(parseUrlState('?era=1999&t=99&cam=moon&q=ultra')).toEqual({});
});
test('round-trips', () => {
  const s = { eraId: '1984', timeOfDay: 7.25, camera: 'bank' } as const;
  expect(parseUrlState(toSearch(s))).toEqual(s);
});
