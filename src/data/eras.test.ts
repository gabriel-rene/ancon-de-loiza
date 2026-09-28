import { describe, expect, test } from 'vitest';
import { ERAS, ERA_IDS, getEra, type Sourced } from './eras';
import { SOURCES } from './sources';

const sourcedFields = (e: (typeof ERAS)[number]): Sourced<unknown>[] => [
  e.summary,
  e.river.bankOffset,
  e.river.flow,
  ...(Object.values(e.vegetation) as Sourced<unknown>[]),
  ...(Object.values(e.ancon) as Sourced<unknown>[]),
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
    for (const e of ERAS) for (const v of Object.values(e.vegetation)) {
      expect(v.value).toBeGreaterThanOrEqual(0);
      expect(v.value).toBeLessThanOrEqual(1.5);
    }
  });
  test('every species has an era density; almendro grows in from 1925 (research §5, S1)', () => {
    const ids = ['redMangrove', 'coconut', 'casuarina', 'blackMangrove', 'whiteMangrove', 'buttonwood', 'almendro', 'seaGrape', 'grass', 'reeds', 'morningGlory'];
    for (const e of ERAS) expect(Object.keys(e.vegetation).sort()).toEqual([...ids].sort());
    expect(getEra('1840').vegetation.almendro.value).toBeLessThan(getEra('1925').vegetation.almendro.value);
    expect(getEra('1925').vegetation.almendro.value).toBe(1);
    for (const e of ERAS) for (const id of ['grass', 'reeds'] as const) expect(e.vegetation[id].inferred).toBe(true);
  });
  test('dates parse', () => {
    for (const e of ERAS) expect(Number.isNaN(Date.parse(e.date))).toBe(false);
  });
  test('river is wider and faster before Carraízo dam (1953–54)', () => {
    expect(getEra('1935').river.bankOffset.value).toBeGreaterThan(getEra('1975').river.bankOffset.value);
    expect(getEra('1935').river.flow.value).toBeGreaterThan(getEra('1975').river.flow.value);
  });
  test('vessel kind and propulsion follow the decade table (research §9, spec §3)', () => {
    expect(ERAS.map((e) => e.ancon.kind.value)).toEqual([
      'timberBarge', 'timberBarge', 'plankPlatform', 'woodPlatform', 'woodPlatform', 'woodPlatform', 'steelPontoon', 'steelPontoon',
    ]);
    expect(ERAS.map((e) => e.ancon.propulsion.value)).toEqual(['poles', 'poles', 'poles', 'ropes', 'ropes', 'ropes', 'ropes', 'moored']);
  });
  test('the wooden platform grows 1 → 4 → 6 cars and the steel barge carries 8', () => {
    const [a, b, c] = (['1935', '1959', '1975'] as const).map((id) => getEra(id).ancon);
    expect([a.cars.value, b.cars.value, c.cars.value]).toEqual([1, 4, 6]);
    expect(a.length.value).toBeLessThan(b.length.value); expect(b.length.value).toBeLessThan(c.length.value);
    expect(getEra('1984').ancon.cars.value).toBe(8);
  });
  test('sizes stay inside research §2.2 (1-car ≈ 7–8 × 3–3.5 m; steel ≈ 20–22 × 7–8 m)', () => {
    const one = getEra('1935').ancon, steel = getEra('1984').ancon;
    expect(one.length.value).toBeGreaterThanOrEqual(7); expect(one.length.value).toBeLessThanOrEqual(8);
    expect(one.beam.value).toBeGreaterThanOrEqual(3); expect(one.beam.value).toBeLessThanOrEqual(3.5);
    expect(steel.length.value).toBeGreaterThanOrEqual(20); expect(steel.length.value).toBeLessThanOrEqual(22);
    expect(steel.beam.value).toBeGreaterThanOrEqual(7); expect(steel.beam.value).toBeLessThanOrEqual(8);
  });
  test('era details: Lombera shore rope, push + steer poles, anconera, idle 1986', () => {
    expect(getEra('1840').ancon.shoreRope.value).toBe(true);
    expect(ERAS.filter((e) => e.ancon.shoreRope.value).map((e) => e.id)).toEqual(['1840']);
    expect(getEra('1925').ancon.crew.value).toBe(1); expect(getEra('1925').ancon.helmsman.value).toBe(true);
    expect(getEra('1984').ancon.anconera.value).toBe(true);
    const idle = getEra('1986').ancon;
    expect([idle.crew.value, idle.passengers.value]).toEqual([0, 0]);
    for (const e of ERAS) if (e.ancon.propulsion.value === 'ropes') {
      // "two or three" [S1] haulers, except 1984: María Luisa Cortijo ran it alone (research §2.4, §9).
      if (e.id === '1984') { expect(e.ancon.crew.value).toBe(1); continue; }
      expect(e.ancon.crew.value).toBeGreaterThanOrEqual(2); expect(e.ancon.crew.value).toBeLessThanOrEqual(3);
    }
  });
  test('clothing style per era (research §7, inferred)', () => {
    expect(ERAS.map((e) => e.ancon.clothing.value)).toEqual([
      'colonial', 'earlyCentury', 'earlyCentury', 'earlyCentury', 'midCentury', 'modern', 'modern', 'modern',
    ]);
    for (const e of ERAS) expect(e.ancon.clothing.inferred).toBe(true);
  });
});
