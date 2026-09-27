import { describe, expect, test } from 'vitest';
import { ERAS } from '../data/eras';
import { landmarkXZ } from '../data/landmarks';
import { RIVER_DIR } from '../geo/constants';
import { WATER, type WorldFields } from '../terrain/fields';
import { LANDING_CLEARING } from '../vegetation/masks';
import { dockPoint, landingClearings, waterAt, type XZ } from './geometry';
import { deckLayout, vesselSpec } from './spec';
import { fields512, geom512 } from './testing';

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Brute force: distance from p to the nearest RIVER cell centre. */
const nearestRiverCell = (f: WorldFields, p: XZ) => {
  const g = f.grid;
  let best = Infinity;
  for (let j = 0; j < g.size; j++) for (let i = 0; i < g.size; i++) if (f.water[j * g.size + i] === WATER.RIVER)
    best = Math.min(best, Math.hypot(g.minX + (i + 0.5) * g.cell - p[0], g.minZ + (j + 0.5) * g.cell - p[1]));
  return best;
};

describe.each([0, 8])('crossing geometry, bankOffset %i (512 placement fields)', (bank) => {
  const f = fields512(bank), g = geom512(bank);
  test('landings are the research §1.1 coordinates, on land, ~220 m apart', () => {
    expect(g.east).toEqual(landmarkXZ('eastLanding')); expect(g.west).toEqual(landmarkXZ('westLanding'));
    expect(dist(g.east, g.west)).toBeGreaterThan(200); expect(dist(g.east, g.west)).toBeLessThan(235);
    expect(waterAt(f, ...g.east)).toBe(WATER.LAND); expect(waterAt(f, ...g.west)).toBe(WATER.LAND);
  });
  test('each shore point is the waterline nearest its landing coordinate (within one cell)', () => {
    for (const [s, l] of [[g.shoreEast, g.east], [g.shoreWest, g.west]] as const) {
      expect(waterAt(f, s[0], s[1])).toBe(WATER.RIVER);
      const ux = (l[0] - s[0]) / dist(s, l), uz = (l[1] - s[1]) / dist(s, l);
      expect(waterAt(f, s[0] + ux * 0.5, s[1] + uz * 0.5)).not.toBe(WATER.RIVER);     // next step toward the landing leaves the river
      const d = nearestRiverCell(f, l);
      expect(dist(s, l)).toBeLessThanOrEqual(d + 1e-9); expect(dist(s, l)).toBeGreaterThan(d - f.grid.cell);
    }
  });
  test('dir is the unit shore→shore vector, yaw maps local +X onto it, and it crosses the current', () => {
    expect(Math.hypot(...g.dir)).toBeCloseTo(1, 9);
    expect(Math.cos(g.yaw)).toBeCloseTo(g.dir[0], 9); expect(-Math.sin(g.yaw)).toBeCloseTo(g.dir[1], 9);
    expect(Math.abs(g.dir[0] * RIVER_DIR[0] + g.dir[1] * RIVER_DIR[1])).toBeLessThan(0.3);
    expect(g.span).toBeCloseTo(dist(g.shoreEast, g.shoreWest), 9);
    expect(g.span).toBeGreaterThan(120); expect(g.span).toBeLessThan(200);
  });
  test('the whole line between the shores is river', () => {
    for (let k = 1; k < 50; k++) {
      const t = k / 50;
      expect(waterAt(f, g.shoreEast[0] + (g.shoreWest[0] - g.shoreEast[0]) * t, g.shoreEast[1] + (g.shoreWest[1] - g.shoreEast[1]) * t)).toBe(WATER.RIVER);
    }
  });
  test('every era docks in the water, inside its landing clearing, apron tip APRON_REST onto the bank', () => {
    const [cE, cW] = landingClearings(g);
    for (const e of ERAS) {
      const L = deckLayout(vesselSpec(e)), de = dockPoint(g, 'east', L.reach), dw = dockPoint(g, 'west', L.reach);
      expect(waterAt(f, de[0], de[1])).toBe(WATER.RIVER); expect(waterAt(f, dw[0], dw[1])).toBe(WATER.RIVER);
      expect(dist(de, cE)).toBeLessThan(LANDING_CLEARING[0]); expect(dist(dw, cW)).toBeLessThan(LANDING_CLEARING[0]);
      expect(dist(de, g.shoreEast)).toBeCloseTo(L.reach - 0.8, 6);
    }
  });
});
test('the pre-dam river is wider at the crossing', () => {
  expect(geom512(8).span).toBeGreaterThan(geom512(0).span + 8);
});
