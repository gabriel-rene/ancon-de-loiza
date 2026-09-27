import { expect, test } from 'vitest';
import { getEra } from '../../data/eras';
import { deckLayout, vesselSpec } from '../spec';
import { BITT_H, bittXZ, type VesselPart } from './common';
import { buildVessel } from './index';
import { bounds, vesselSuite } from './suite';

vesselSuite(['steelPontoon']);

/**
 * Mean colour luminance and g/r ratio of the hull's outer skin: side triangles (|normal.z| > 0.9,
 * centroid |z| > halfBeam − 0.02) whose centroid y lies in `band`. Non-indexed geometry (PartBuilder).
 */
const colourStats = (parts: VesselPart[], hb: number, band: [number, number]) => {
  let lum = 0, g = 0, r = 0, n = 0;
  for (const p of parts) {
    const pos = p.geometry.attributes.position, nrm = p.geometry.attributes.normal, col = p.geometry.attributes.color;
    for (let t = 0; t < pos.count; t += 3) {
      const y = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3, z = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
      if (Math.abs(nrm.getZ(t)) < 0.9 || Math.abs(z) < hb - 0.02 || y < band[0] || y > band[1]) continue;
      lum += 0.2126 * col.getX(t) + 0.7152 * col.getY(t) + 0.0722 * col.getZ(t); g += col.getY(t); r += col.getX(t); n++;
    }
  }
  expect(n).toBeGreaterThan(0);
  return { lum: lum / n, greenness: g / Math.max(r, 1e-6) };
};
const HB = 7.5 / 2;
const build = (id: '1984' | '1986') => { const s = vesselSpec(getEra(id)); return buildVessel(s, deckLayout(s), 1); };

test('the fouling band at the waterline is greener and darker than the topsides', () => {
  const parts = build('1984');
  expect(parts.some((p) => p.material === 'steel')).toBe(true);
  const band = colourStats(parts, HB, [-0.3, 0.05]), top = colourStats(parts, HB, [0.25, 0.65]);
  expect(band.greenness).toBeGreaterThan(top.greenness);
  expect(band.lum).toBeLessThan(top.lum);
});
test('the idle 1986 barge is rustier (darker topsides) than the working 1984 one', () => {
  expect(colourStats(build('1986'), HB, [0.25, 0.65]).lum).toBeLessThan(colourStats(build('1984'), HB, [0.25, 0.65]).lum);
});
test('steel ramps, longer than the wooden aprons', () => {
  const ramps = build('1984').filter((p) => p.apron);
  expect(ramps.map((p) => p.material)).toEqual(['steel', 'steel']);
  const b = bounds([ramps[0]]);
  expect(b.max.x - b.min.x).toBeGreaterThan(1.4);
});
test('bitts stand where the 1986 mooring lines start (bittXZ, BITT_H)', () => {
  const s = vesselSpec(getEra('1986')), L = deckLayout(s), iron = buildVessel(s, L, 1).find((p) => p.material === 'iron')!;
  const a = iron.geometry.attributes.position.array as Float32Array;
  for (const side of [1, -1] as const) {
    const [bx, bz] = bittXZ(L, -1, side), y = L.deckY + BITT_H;
    let best = Infinity;
    for (let i = 0; i < a.length; i += 3) best = Math.min(best, Math.hypot(a[i] - bx, a[i + 1] - y, a[i + 2] - bz));
    expect(best).toBeLessThan(0.12);
  }
});
