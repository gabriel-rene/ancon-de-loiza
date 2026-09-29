import { expect, test } from 'vitest';
import { CAR_SLOT } from '../ancon/spec';
import { DIMS, isAnimal, isCar, MAX_CAR_LENGTH, rearOverhang, type MoverKind } from './models';

test('every car fits a deck slot with room to spare', () => {
  expect(MAX_CAR_LENGTH).toBeCloseTo(CAR_SLOT.length - 0.3, 9);
  for (const k of Object.keys(DIMS) as MoverKind[]) if (isCar(k)) {
    expect(DIMS[k].length, k).toBeLessThanOrEqual(MAX_CAR_LENGTH);
    expect(DIMS[k].width, k).toBeLessThanOrEqual(CAR_SLOT.width - 0.5);
  }
});

test('contacts lie inside the body and overhangs are positive', () => {
  for (const k of Object.keys(DIMS) as MoverKind[]) {
    const d = DIMS[k];
    expect(d.front, k).toBeGreaterThan(0);
    expect(rearOverhang(d), k).toBeGreaterThan(0);
    expect(d.wheelbase, k).toBeGreaterThan(0.5);
  }
  expect(isAnimal('horse')).toBe(true); expect(isCar('horse')).toBe(false); expect(isCar('publico')).toBe(true);
});

test('carts clear the polers on the narrow colonial barge (half width ≤ 0.8 m)', () => {
  expect(DIMS.oxCart.width / 2).toBeLessThanOrEqual(0.8);
  expect(DIMS.caneCart.width / 2).toBeLessThanOrEqual(0.8);
  expect(DIMS.horse.width / 2).toBeLessThanOrEqual(0.3);
});
