import { describe, expect, test } from 'vitest';
import { APRON_REST } from '../ancon/geometry';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { buildFields, sampleField, type WorldFields } from './fields';
import { flattenLandings, PAD, padFrame, padHeight, padPoint, type LandingPad } from './landingPads';
import { landingPadsFor, padShoreY, placementFields } from './placementFields';

const G = geo as unknown as GeoBundle;
const cellCentres = (f: WorldFields, p: LandingPad, keep: (a: number, v: number) => boolean) => {
  const out: { k: number; a: number; v: number }[] = [], g = f.grid;
  for (let j = 0; j < g.size; j++) for (let i = 0; i < g.size; i++) {
    const x = g.minX + (i + 0.5) * g.cell, z = g.minZ + (j + 0.5) * g.cell, [a, v] = padFrame(p, x, z);
    if (keep(a, v)) out.push({ k: j * g.size + i, a, v });
  }
  return out;
};

describe('landing pads', () => {
  for (const bank of [0, 8]) {
    const f = placementFields(bank), pads = landingPadsFor(bank);
    test(`bank ${bank}: every grid vertex inside a pad sits on the pad profile`, () => {
      for (const p of pads) {
        const inside = cellCentres(f, p, (a, v) => a >= -PAD.wet && a <= PAD.length && Math.abs(v) <= PAD.halfWidth);
        expect(inside.length).toBeGreaterThan(4);
        for (const c of inside) expect(f.height[c.k]).toBeCloseTo(padHeight(p, c.a), 5);
      }
    });
    test(`bank ${bank}: the pad is level across and never drops going inland`, () => {
      for (const p of pads) {
        for (const a of [2, 6, 10, 14]) {
          // Bilinear over 5 m cells also reads cells in the blend margin, so this is looser than the vertex test above.
          const hs = [-2, 0, 2].map((v) => padHeight(p, a) - sampleField(f, f.height, ...padPoint(p, a, v)));
          expect(Math.max(...hs) - Math.min(...hs)).toBeLessThan(0.2);
        }
        let prev = -Infinity;
        for (let a = -PAD.wet; a <= PAD.length; a += 0.5) { const h = padHeight(p, a); expect(h).toBeGreaterThanOrEqual(prev - 1e-9); prev = h; }
      }
    });
    test(`bank ${bank}: the ferry's end rests on the pad`, () => {
      for (const p of pads) {
        const [x, z] = padPoint(p, APRON_REST, 0);
        // The ferry samples the same bilinear field; within 0.2 m of the pad the apron still reads as resting on it.
        expect(Math.abs(sampleField(f, f.height, x, z) - padHeight(p, APRON_REST))).toBeLessThan(0.2);
        expect(padHeight(p, 0)).toBe(p.shoreY);
        expect(p.shoreY).toBe(padShoreY(bank));                 // lowered per bank so every docking ferry fits (docking.test)
        expect(p.shoreY).toBeLessThanOrEqual(PAD.shoreY); expect(p.shoreY).toBeGreaterThan(0);
      }
    });
    test(`bank ${bank}: ground beyond the margin is untouched`, () => {
      const raw = buildFields(G, { extent: 2560, size: 512, bankOffset: bank });
      for (const p of pads) {
        const far = cellCentres(f, p, (a, v) => a > PAD.length + PAD.margin + 1 && a < PAD.length + 30 && Math.abs(v) < 10);
        for (const c of far) expect(f.height[c.k]).toBe(raw.height[c.k]);
      }
    });
  }
  test('flattening twice changes nothing; coarse tiers get the same pad', () => {
    const f = placementFields(0), before = f.height.slice();
    flattenLandings(f, landingPadsFor(0));
    expect(f.height).toEqual(before);
    const low = buildFields(G, { extent: 2560, size: 256, bankOffset: 0 }), pads = landingPadsFor(0);
    flattenLandings(low, pads);
    for (const p of pads) for (const c of cellCentres(low, p, (a, v) => a >= 0 && a <= PAD.length && Math.abs(v) <= PAD.halfWidth))
      expect(low.height[c.k]).toBeCloseTo(padHeight(p, c.a), 5);
  });
});
