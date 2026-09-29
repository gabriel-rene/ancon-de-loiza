import { describe, expect, test } from 'vitest';
import { ERAS, getEra } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { BRIDGE_WAY, eraRoads, PR187_WAY, STORY_WAYS } from './roads';

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
      const src = byId.get(r.id.replace(/-approach$/, ''))!;
      expect(['secondary', 'secondary_link', 'tertiary', 'track', 'path', 'footway']).toContain(src.kind);
      expect(src.bridge).toBe(false);
      expect(story.has(src.id)).toBe(false);
    }
    const n = eraRoads(G, getEra('1975')).simple.length;
    expect(n).toBeGreaterThan(10); expect(n).toBeLessThan(40);   // "only a handful": ~30 of 263
  });
  test('PR-951 and PR-188 appear from 1935 (their in-town pieces before 1935 come from town.ts)', () => {
    const ids = (id: '1840' | '1925' | '1935' | '1986') => new Set(eraRoads(G, getEra(id)).simple.map((r) => r.id));
    const numbered = G.roads.filter((x) => x.ref === 'PR-951' || x.ref === 'PR-188');
    for (const r of numbered.filter((x) => !x.bridge)) {
      expect(ids('1840').has(r.id)).toBe(false); expect(ids('1925').has(r.id)).toBe(false);
      expect(ids('1935').has(r.id)).toBe(true);
    }
    for (const r of numbered.filter((x) => x.bridge)) expect(ids('1986').has(r.id)).toBe(false);
  });
  test('surface follows the era', () => {
    expect(ERAS.map((e) => eraRoads(G, e).surface)).toEqual(ERAS.map((e) => e.infrastructure.roadSurface.value));
  });
  test('bridge approaches: dirt while the bridge is building (1984), the era surface once open (1986)', () => {
    const approach = (id: '1984' | '1986') => {
      const r = eraRoads(G, getEra(id));
      return { story: r.story.find((x) => x.id === 'approach')!.surface, tail: r.simple.find((x) => x.id === `${PR187_WAY}-approach`)!.surface ?? r.surface };
    };
    expect(approach('1984')).toEqual({ story: 'sand', tail: 'sand' });
    expect(approach('1986')).toEqual({ story: 'asphalt', tail: 'asphalt' });
    for (const e of ERAS) for (const r of eraRoads(G, e).story) if (r.id !== 'approach') expect(r.surface).toBe(e.infrastructure.roadSurface.value);
  });
  test('before the bridge the modern PR-187 stops at the Antigua junction', () => {
    const full = G.roads.find((r) => r.id === PR187_WAY)!.points, antigua = G.roads.find((r) => r.id === STORY_WAYS.antigua)!.points[0];
    for (const e of ERAS) {
      const r = eraRoads(G, e), head = r.simple.find((x) => x.id === PR187_WAY)!, tail = r.simple.find((x) => x.id === `${PR187_WAY}-approach`);
      expect(head.points.at(-1)).toEqual(antigua);
      expect(head.points.length).toBeLessThan(full.length);
      if (e.infrastructure.bridge.value === 'none') expect(tail).toBeUndefined();
      else expect([...head.points.slice(0, -1), ...tail!.points]).toEqual(full);
    }
  });
});
