import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { tris } from '../ancon/testing';
import { ANATOMY, HOOF_Y, ANIMAL_TRIS, buildAnimalBody, buildBicycle, buildCart, buildCartWheel, buildLegSegment, legMatrices, oxenCentreX, OXEN_Z } from './animals';
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
  test('leg: a hard hoof band below the split ring, coat above, clean knee on the upper segment', () => {
    const colours = (g: THREE.BufferGeometry) => { const p = g.attributes.position, c = g.attributes.color; return Array.from({ length: p.count }, (_, i) => ({ y: p.getY(i), r: c.getX(i) })); };
    const v = colours(buildLegSegment());
    expect(v.some((q) => q.y < HOOF_Y - 1e-6)).toBe(true);
    for (const q of v) { if (q.y > HOOF_Y + 1e-6) expect(q.r).toBeCloseTo(1, 3); if (q.y < HOOF_Y - 1e-6) expect(q.r).toBeLessThan(0.3); }
    for (const q of colours(buildLegSegment(false))) expect(q.r).toBeCloseTo(1, 3);
  });
  test('bodies keep smooth normals: vertices sharing a position mostly share a normal', () => {
    for (const sp of ['ox', 'horse'] as const) {
      const g = buildAnimalBody(sp), p = g.attributes.position, n = g.attributes.normal, groups = new Map<string, THREE.Vector3[]>();
      for (let i = 0; i < p.count; i++) { const k = [p.getX(i), p.getY(i), p.getZ(i)].map((x) => Math.round(x * 1e3)).join(); (groups.get(k) ?? groups.set(k, []).get(k)!).push(new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i))); }
      let shared = 0, smooth = 0;
      for (const l of groups.values()) if (l.length > 1) { shared++; if (l.every((v) => v.dot(l[0]) > 0.99)) smooth++; }
      expect(shared).toBeGreaterThan(50);
      expect(smooth / shared).toBeGreaterThan(0.8);
    }
  });
  test('gait amplitude scales the swing: 0.5 gives about half of 1', () => {
    const knee = (moving: boolean | number) => {
      const out = Array.from({ length: 8 }, () => new THREE.Matrix4());
      legMatrices('ox', 0, moving, new THREE.Matrix4(), out);
      return new THREE.Vector3(0, -1, 0).applyMatrix4(out[0]).x - ANATOMY.ox.shoulder[0];
    };
    expect(knee(1)).toBeGreaterThan(0.1);
    expect(knee(0.5) / knee(1)).toBeCloseTo(0.5, 1);
    expect(knee(true)).toBeCloseTo(knee(1), 6);
    expect(knee(false)).toBeCloseTo(0, 6);
  });
});
