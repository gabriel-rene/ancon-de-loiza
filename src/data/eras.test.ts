import { describe, expect, test } from 'vitest';
import { ERAS, ERA_IDS, getEra, type Sourced } from './eras';
import { SOURCES } from './sources';

const sourcedFields = (e: (typeof ERAS)[number]): Sourced<unknown>[] => [
  e.summary,
  e.river.bankOffset,
  e.river.flow,
  e.vegetation.redMangrove,
  e.vegetation.coconut,
  e.vegetation.casuarina,
];

describe('eras', () => {
  test('ids are unique and chronological', () => {
    expect(ERA_IDS).toEqual(['1840', '1900', '1925', '1935', '1959', '1975', '1984', '1986']);
    expect(new Set(ERAS.map((e) => e.id)).size).toBe(ERAS.length);
  });
  test('every fact is sourced or explicitly inferred', () => {
    for (const e of ERAS) for (const f of sourcedFields(e)) {
      expect(f.sources.length > 0 || f.inferred === true, `${e.id}`).toBe(true);
      for (const s of f.sources) expect(SOURCES[s], `${e.id} → ${s}`).toBeDefined();
    }
  });
  test('vegetation densities are in [0, 1.5]', () => {
    for (const e of ERAS) for (const v of [e.vegetation.redMangrove, e.vegetation.coconut, e.vegetation.casuarina]) {
      expect(v.value).toBeGreaterThanOrEqual(0);
      expect(v.value).toBeLessThanOrEqual(1.5);
    }
  });
  test('dates parse', () => {
    for (const e of ERAS) expect(Number.isNaN(Date.parse(e.date))).toBe(false);
  });
  test('river is wider and faster before Carraízo dam (1953–54)', () => {
    expect(getEra('1935').river.bankOffset.value).toBeGreaterThan(getEra('1975').river.bankOffset.value);
    expect(getEra('1935').river.flow.value).toBeGreaterThan(getEra('1975').river.flow.value);
  });
});
