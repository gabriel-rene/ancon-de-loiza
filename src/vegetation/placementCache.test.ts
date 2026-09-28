import { expect, test } from 'vitest';
import { getEra, type EraId } from '../data/eras';
import { KeyedCache, placementKey } from './placementCache';
import { PLACEMENT_ORDER } from './rules';
import type { WoodyId } from './types';

test('builds once per key and evicts the least recently used', () => {
  const c = new KeyedCache<object>(2);
  let builds = 0;
  const mk = () => { builds++; return {}; };
  const a = c.get('a', mk);
  expect(c.get('a', mk)).toBe(a); expect(builds).toBe(1);
  c.get('b', mk); c.get('a', mk); c.get('c', mk);   // b is the least recently used → evicted
  expect(c.size).toBe(2);
  c.get('a', mk); expect(builds).toBe(3);
  c.get('b', mk); expect(builds).toBe(4);
});
const d = (id: EraId) => Object.fromEntries(PLACEMENT_ORDER.map((s) => [s, getEra(id).vegetation[s].value])) as Record<WoodyId, number>;
test('placement key: equal densities share an entry; bank offset and tier separate them', () => {
  expect(placementKey(d('1959'), 0, 'high')).toBe(placementKey(d('1975'), 0, 'high'));
  expect(placementKey(d('1935'), 8, 'high')).not.toBe(placementKey(d('1959'), 0, 'high'));
  expect(placementKey(d('1975'), 0, 'high')).not.toBe(placementKey(d('1975'), 0, 'low'));
});
test('placementKey: extra separates otherwise equal keys', () => {
  expect(placementKey(d('1975'), 0, 'high', 'p0.85')).not.toBe(placementKey(d('1975'), 0, 'high', 'p1'));
  expect(placementKey(d('1975'), 0, 'high')).toBe(placementKey(d('1975'), 0, 'high', ''));
});
