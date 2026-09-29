import { describe, expect, test } from 'vitest';
import { ERAS, getEra } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { BRIDGE_WAY, eraRoads, STORY_WAYS } from './roads';

const G = geo as unknown as GeoBundle;

describe('era roads', () => {
  test('story roads: both landing roads always; the bridge approach only with a bridge', () => {
    for (const e of ERAS) {
      const ids = eraRoads(G, e).story.map((r) => r.id).sort();
      expect(ids).toEqual(e.infrastructure.bridge.value === 'none' ? ['antigua', 'escobar'] : ['antigua', 'approach', 'escobar']);
    }
  });
  test('simple roads: main kinds only — no residential, service, bridges or story ways', () => {
    const story = new Set([...Object.values(STORY_WAYS), BRIDGE_WAY]);
    const byId = new Map(G.roads.map((r) => [r.id, r]));
    for (const e of ERAS) for (const r of eraRoads(G, e).simple) {
      const src = byId.get(r.id)!;
      expect(['secondary', 'secondary_link', 'tertiary', 'track', 'path', 'footway']).toContain(src.kind);
      expect(src.bridge).toBe(false);
      expect(story.has(r.id)).toBe(false);
    }
    const n = eraRoads(G, getEra('1975')).simple.length;
    expect(n).toBeGreaterThan(10); expect(n).toBeLessThan(40);   // "only a handful": ~30 of 263
  });
  test('PR-951 and PR-188 appear from 1935', () => {
    const refs = (id: '1925' | '1935') => new Set(eraRoads(G, getEra(id)).simple.map((r) => G.roads.find((x) => x.id === r.id)!.ref));
    expect(refs('1925').has('PR-951')).toBe(false);
    expect(refs('1935').has('PR-951')).toBe(true);
    expect(refs('1925').has('PR-188')).toBe(false);
    expect(refs('1935').has('PR-188')).toBe(true);
  });
  test('surface follows the era', () => {
    expect(ERAS.map((e) => eraRoads(G, e).surface)).toEqual(ERAS.map((e) => e.infrastructure.roadSurface.value));
  });
});
