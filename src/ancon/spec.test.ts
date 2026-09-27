import { expect, test } from 'vitest';
import { ERAS, getEra } from '../data/eras';
import { APRON, CAR_SLOT, deckLayout, GUIDE_H, vesselSpec } from './spec';

test('vesselSpec flattens the Sourced era values', () => {
  const s = vesselSpec(getEra('1984'));
  expect(s).toMatchObject({ kind: 'steelPontoon', length: 20, beam: 7.5, cars: 8, propulsion: 'ropes', crew: 1, anconera: true, moored: false });
  expect(vesselSpec(getEra('1986')).moored).toBe(true);
});
test('every deck fits its car slots with a 0.3 m margin all round', () => {
  for (const e of ERAS) {
    const s = vesselSpec(e), L = deckLayout(s);
    expect(L.lanes * L.rows, e.id).toBeGreaterThanOrEqual(s.cars);
    expect(L.rows * CAR_SLOT.length, e.id).toBeLessThanOrEqual(s.length - 0.6);
    expect(L.lanes * CAR_SLOT.width, e.id).toBeLessThanOrEqual(s.beam - 0.6);
  }
});
test('layout: reach = half length + apron, guides above the deck, rope lines inside the beam', () => {
  for (const e of ERAS) {
    const s = vesselSpec(e), L = deckLayout(s);
    expect(L.reach).toBeCloseTo(s.length / 2 + APRON[s.kind], 9);
    expect(L.guideY).toBeCloseTo(s.freeboard + GUIDE_H, 9);
    expect(L.ropeZ).toBeLessThan(L.halfBeam); expect(L.ropeZ).toBeGreaterThan(L.halfBeam - 0.5);
  }
  expect(deckLayout(vesselSpec(getEra('1840'))).lanes).toBe(0);
});
