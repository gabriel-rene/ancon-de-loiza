import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { tris } from '../ancon/testing';
import { ANATOMY, ANIMAL_TRIS, buildAnimalBody, buildBicycle, buildCart, buildCartWheel, buildLegSegment, legMatrices, oxenCentreX, OXEN_Z } from './animals';
import { DIMS } from './models';

const feet = (sp: 'ox' | 'horse', dist: number, moving: boolean) => {
  const out = Array.from({ length: 8 }, () => new THREE.Matrix4()), p = new THREE.Vector3();
  legMatrices(sp, dist, moving, new THREE.Matrix4(), out);
  return out.slice(4).map((m) => p.set(0, -1, 0).applyMatrix4(m).clone());
};

describe('animals', () => {
  test('standing, all four hooves are on the ground; walking, none goes below it', () => {
    for (const sp of ['ox', 'horse'] as const) {
      for (const f of feet(sp, 0, false)) expect(f.y).toBeCloseTo(0, 2);
      for (let d = 0; d < 3; d += 0.1) for (const f of feet(sp, d, true)) expect(f.y).toBeGreaterThanOrEqual(-0.02);
      // walking lifts at least one hoof at some point of the stride
      let lifted = false; for (let d = 0; d < ANATOMY[sp].stride; d += 0.05) if (feet(sp, d, true).some((f) => f.y > 0.05)) lifted = true;
      expect(lifted).toBe(true);
    }
  });
  test('oxen fit the cart mover: front hooves on its front contact, within its width', () => {
    for (const k of ['oxCart', 'caneCart'] as const) {
      const x = oxenCentreX(k) + ANATOMY.ox.shoulder[0];
      expect(x).toBeCloseTo(DIMS[k].wheelbase / 2, 2);
      expect(OXEN_Z + 0.3).toBeLessThanOrEqual(DIMS[k].width / 2 + 1e-9);
    }
  });
  test('budgets', () => {
    expect(tris(buildAnimalBody('ox'))).toBeLessThanOrEqual(ANIMAL_TRIS.oxBody);
    expect(tris(buildAnimalBody('horse'))).toBeLessThanOrEqual(ANIMAL_TRIS.horseBody);
    expect(tris(buildLegSegment())).toBeLessThanOrEqual(ANIMAL_TRIS.leg);
    for (const k of ['oxCart', 'caneCart'] as const) expect(tris(buildCart(k))).toBeLessThanOrEqual(ANIMAL_TRIS.cart);
    expect(tris(buildCartWheel())).toBeLessThanOrEqual(ANIMAL_TRIS.cartWheel);
    expect(tris(buildBicycle())).toBeLessThanOrEqual(ANIMAL_TRIS.bicycle);
  });
});
