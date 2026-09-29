import { describe, expect, test } from 'vitest';
import { ERAS } from '../data/eras';
import { sampleField } from '../terrain/fields';
import { placementFields } from '../terrain/placementFields';
import { buildTown, TOWN_LIMITS, townDrawCalls, townTriangles } from './build';
import { eraTown } from './town';

describe('one era of town', () => {
  for (const e of ERAS) test(`${e.id}: within the spec 4b §4 budget`, () => {
    const bank = e.river.bankOffset.value, f = placementFields(bank);
    const parts = buildTown(eraTown(bank, e), (x, z) => sampleField(f, f.height, x, z));
    expect(townDrawCalls(parts)).toBeLessThanOrEqual(TOWN_LIMITS.drawCalls);
    expect(townTriangles(parts)).toBeLessThanOrEqual(TOWN_LIMITS.triangles);
    expect(townTriangles(parts)).toBeGreaterThan(0);
  });
  test('deterministic', () => {
    const e = ERAS[5], bank = e.river.bankOffset.value, f = placementFields(bank), g = (x: number, z: number) => sampleField(f, f.height, x, z);
    const a = buildTown(eraTown(bank, e), g), b = buildTown(eraTown(bank, e), g);
    expect(Array.from(a.concrete!.attributes.position.array)).toEqual(Array.from(b.concrete!.attributes.position.array));
  });
});
