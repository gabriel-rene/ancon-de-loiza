import { describe, expect, test } from 'vitest';
import { crossingGeometry, landingClearings, waterAt } from '../ancon/geometry';
import { ERAS } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { sampleField, WATER } from '../terrain/fields';
import { landingPadsFor, placementFields } from '../terrain/placementFields';
import { LANDING_CLEARING } from '../vegetation/masks';
import { buildInfrastructure, drawCalls, LIMITS, triangles } from './build';
import { corners } from './parts';
import { bridgeWay, eraRoads } from './roads';

const G = geo as unknown as GeoBundle;
const input = (e: (typeof ERAS)[number]) => {
  const bank = e.river.bankOffset.value, f = placementFields(bank);
  return {
    infra: e.infrastructure, pads: landingPadsFor(bank), roads: eraRoads(G, e), bridgeWay: bridgeWay(G),
    groundAt: (x: number, z: number) => sampleField(f, f.height, x, z),
    landAt: (x: number, z: number) => waterAt(f, x, z) === WATER.LAND,
    dryAt: (x: number, z: number) => waterAt(f, x, z) === WATER.LAND && sampleField(f, f.shore, x, z) >= 2,
    waterAt: (x: number, z: number) => waterAt(f, x, z),
  };
};

describe('one era of infrastructure', () => {
  for (const e of ERAS) test(`${e.id}: within budget; buildings inside the plant-free clearing`, () => {
    const i = input(e), o = buildInfrastructure(i);
    expect(drawCalls(o)).toBeLessThanOrEqual(LIMITS.drawCalls);
    expect(triangles(o)).toBeLessThanOrEqual(LIMITS.triangles);
    expect(o.road).not.toBeNull();
    const f = placementFields(e.river.bankOffset.value), [clear] = landingClearings(crossingGeometry(f));
    const s = o.station, fps = [s.house, s.terrace, s.shelter, e.infrastructure.neighbourHouse.value ? s.neighbour : null];
    for (const fp of fps) if (fp) for (const [x, z] of corners(fp)) {
      expect(Math.hypot(x - clear[0], z - clear[1]), `${e.id}`).toBeLessThanOrEqual(LANDING_CLEARING[0]);
      expect(i.dryAt(x, z), `${e.id} corner on dry ground`).toBe(true);
    }
  });
  test('deterministic', () => {
    const a = buildInfrastructure(input(ERAS[5])), b = buildInfrastructure(input(ERAS[5]));
    expect(triangles(a)).toBe(triangles(b));
    expect(Array.from(a.parts.concrete!.attributes.position.array)).toEqual(Array.from(b.parts.concrete!.attributes.position.array));
  });
});
