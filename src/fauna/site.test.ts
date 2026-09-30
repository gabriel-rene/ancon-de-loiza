import { describe, expect, test } from 'vitest';
import { waterAt } from '../ancon/geometry';
import { WATER } from '../terrain/fields';
import { BANK_HALF, BANK_STEP, bankAt, distToCrossing, FRAME_RADIUS } from './site';
import { worldFor } from './testing';

// Pre-dam (bank offset 8) and post-dam (0) rivers.
for (const id of ['1840', '1975'] as const) describe(`site ${id}`, () => {
  const { site } = worldFor(id);
  const f = site.fields;

  test('bank samples sit on land, with river just toward the water', () => {
    let valid = 0;
    for (const b of site.banks) {
      for (let k = 0; k * 3 < b.pts.length; k++) {
        const x = b.pts[k * 3], y = b.pts[k * 3 + 1], z = b.pts[k * 3 + 2];
        if (Number.isNaN(x)) continue;
        valid++;
        expect(waterAt(f, x, z)).toBe(WATER.LAND);
        expect(waterAt(f, x - b.inland[0], z - b.inland[1])).toBe(WATER.RIVER);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1.5);
      }
    }
    expect(valid).toBeGreaterThan((2 * (2 * BANK_HALF / BANK_STEP + 1)) * 0.4);
  });

  test('bankAt interpolates between valid samples', () => {
    const b = site.banks[0], out = [0, 0, 0];
    for (let u = -40; u <= 40; u += 0.7) if (bankAt(b, u, out)) expect(Number.isFinite(out[0] + out[1] + out[2])).toBe(true);
  });

  test('fisher circles lie over the river, 20–200 m from the crossing line, inside the frame', () => {
    expect(site.fishers.length).toBe(2);
    const g = site.geom;
    site.fishers.forEach(({ c, r }, i) => {
      const side = (c[0] - g.shoreEast[0]) * site.lateral[0] + (c[1] - g.shoreEast[1]) * site.lateral[1];
      expect(Math.sign(side)).toBe(i === 0 ? site.mouthSide : -site.mouthSide);
      for (let a = 0; a < 32; a++) {
        const x = c[0] + r * Math.cos(a * Math.PI / 16), z = c[1] + r * Math.sin(a * Math.PI / 16);
        expect(waterAt(f, x, z)).toBe(WATER.RIVER);
        const off = Math.abs((x - g.shoreEast[0]) * site.lateral[0] + (z - g.shoreEast[1]) * site.lateral[1]);
        expect(off).toBeGreaterThanOrEqual(20);
        expect(off).toBeLessThanOrEqual(200);
        expect(distToCrossing(site, x, z)).toBeLessThan(FRAME_RADIUS);
      }
    });
  });

  test('manatee zone: a strip of river along the crossing, 40–100 m from the crossing line, on the mouth side', () => {
    const { c, a, b } = site.manatee, g = site.geom;
    expect(2 * a).toBeGreaterThanOrEqual(0.5 * g.span);      // spans most of the river width
    for (let al = -a; al <= a + 1e-9; al += 2.5) for (const la of [-b, 0, b]) {
      const x = c[0] + g.dir[0] * al + site.lateral[0] * la, z = c[1] + g.dir[1] * al + site.lateral[1] * la;
      expect(waterAt(f, x, z)).toBe(WATER.RIVER);
      const off = (x - g.shoreEast[0]) * site.lateral[0] + (z - g.shoreEast[1]) * site.lateral[1];
      expect(Math.sign(off)).toBe(site.mouthSide);
      expect(Math.abs(off)).toBeGreaterThanOrEqual(40);
      expect(Math.abs(off)).toBeLessThanOrEqual(100);
    }
  });
});
