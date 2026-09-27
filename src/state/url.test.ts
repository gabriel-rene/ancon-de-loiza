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
test('parses ?view=water debug view', () => {
  expect(parseUrlState('?view=water')).toEqual({ debugView: 'water' });
});
test('rejects unknown ?view', () => {
  expect(parseUrlState('?view=nope')).toEqual({});
});
test('round-trips debugView', () => {
  const s = { debugView: 'water' } as const;
  expect(parseUrlState(toSearch(s))).toEqual(s);
});
test('parses the crossing clock start and the ancón toggle', () => {
  expect(parseUrlState('?c=95.5&ancon=0')).toEqual({ crossingStart: 95.5, showAncon: false });
  expect(parseUrlState('?c=-3&ancon=1')).toEqual({});
  expect(parseUrlState('?c=abc')).toEqual({});
});
test('round-trips crossingStart and showAncon', () => {
  const s = { crossingStart: 42, showAncon: false } as const;
  expect(parseUrlState(toSearch(s))).toEqual(s);
});
test('blank ?c= and ?t= are absent, not 0', () => {
  expect(parseUrlState('?c=&t=')).toEqual({});
  expect(parseUrlState('?c=%20')).toEqual({});
});
test('parses ?perf=1', () => {
  expect(parseUrlState('?perf=1')).toEqual({ perf: true });
  expect(parseUrlState(toSearch({ perf: true }))).toEqual({ perf: true });
});
test('parses ?lang and rejects unknown languages', () => {
  expect(parseUrlState('?lang=es')).toEqual({ lang: 'es' });
  expect(parseUrlState('?lang=en')).toEqual({ lang: 'en' });
  expect(parseUrlState('?lang=fr')).toEqual({});
});
test('round-trips lang', () => {
  expect(parseUrlState(toSearch({ lang: 'es' }))).toEqual({ lang: 'es' });
});
