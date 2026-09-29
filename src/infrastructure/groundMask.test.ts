import { describe, expect, test } from 'vitest';
import { getEra } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle, XZ } from '../data/geo/types';
import { groundMask, MASK, type GroundMask } from './groundMask';
import { eraRoads } from './roads';

const G = geo as unknown as GeoBundle;
const at = (m: GroundMask, [x, z]: XZ, ch: 0 | 1) => {
  const i = Math.floor((x - m.rect[0]) / (m.rect[2] / m.size)), j = Math.floor((z - m.rect[1]) / (m.rect[2] / m.size));
  return m.data[(j * m.size + i) * 4 + ch];
};
const way = (id: string) => G.roads.find((r) => r.id === id)!;
const mid = (id: string): XZ => { const p = way(id).points; return p[Math.floor(p.length / 2)]; };

describe('ground mask', () => {
  const roads = eraRoads(G, getEra('1975'));
  const m = groundMask(roads, [{ c: [300, -300], axis: [1, 0], hu: 6, hv: 4 }]);
  test('covers the near extent', () => {
    expect(m.size).toBe(MASK.size);
    expect(m.rect).toEqual([-MASK.extent / 2, -MASK.extent / 2, MASK.extent]);
  });
  test('roads are painted at full weight on their centre line; far from roads nothing', () => {
    expect(at(m, mid('1058673941'), 0)).toBe(255);   // Antigua PR-187 (story, painted as its shoulder)
    expect(at(m, mid('22182312'), 0)).toBe(255);     // PR-187 through town (simple)
    expect(at(m, [1100, -1100], 0)).toBe(0);
  });
  test('residential streets are not painted', () => {
    const calleA = way('22179633').points[0];        // "Calle A", residential
    expect(at(m, calleA, 0)).toBe(0);
  });
  test('dirt patches go to G, soft at the edge', () => {
    expect(at(m, [300, -300], 1)).toBe(255);
    expect(at(m, [300 + 6 + MASK.soft + 1, -300], 1)).toBe(0);
  });
  test('no bridge approach before 1984', () => {
    const early = groundMask(eraRoads(G, getEra('1975')), []), late = groundMask(eraRoads(G, getEra('1986')), []);
    expect(at(early, mid('204521441'), 0)).toBe(0);
    expect(at(late, mid('204521441'), 0)).toBe(255);
  });
});
