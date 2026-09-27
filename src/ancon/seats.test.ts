import { expect, test } from 'vitest';
import * as THREE from 'three';
import { ERAS, getEra } from '../data/eras';
import { createVesselPose } from './pose';
import { anchorToWorld, haulerStationX, haulerZ, seatAnchors } from './seats';
import { CAR_SLOT, deckLayout, vesselSpec } from './spec';

for (const e of ERAS) test(`${e.id}: car slots, standing spots, all on the deck`, () => {
  const s = vesselSpec(e), L = deckLayout(s), seats = seatAnchors(s, L);
  const cars = seats.filter((a) => a.kind === 'car'), standing = seats.filter((a) => a.kind === 'standing');
  expect(cars.length).toBe(s.cars);
  expect(seats.filter((a) => a.kind === 'cargo').length).toBe(s.cars === 0 ? 1 : 0);
  expect(standing.length).toBeGreaterThanOrEqual(Math.max(s.passengers, 2));
  for (const a of seats) {
    expect(Math.abs(a.pos[0])).toBeLessThanOrEqual(L.halfLength); expect(Math.abs(a.pos[2])).toBeLessThanOrEqual(L.halfBeam);
    expect(a.pos[1]).toBeCloseTo(L.deckY, 9);
  }
  for (const p of standing) for (const c of cars) {
    const inside = Math.abs(p.pos[0] - c.pos[0]) < CAR_SLOT.length / 2 && Math.abs(p.pos[2] - c.pos[2]) < CAR_SLOT.width / 2;
    expect(inside).toBe(false);
  }
  for (let i = 0; i < standing.length; i++) for (let j = i + 1; j < standing.length; j++)
    expect(Math.hypot(standing[i].pos[0] - standing[j].pos[0], standing[i].pos[2] - standing[j].pos[2])).toBeGreaterThan(0.6);
  expect(seatAnchors(s, L)).toEqual(seats);
});
test('anchorToWorld composes the vessel pose with the deck-local anchor', () => {
  const s = vesselSpec(getEra('1975')), a = seatAnchors(s, deckLayout(s))[0], p = createVesselPose();
  p.matrix.makeRotationY(Math.PI / 2).setPosition(10, 0, -5);
  const v = new THREE.Vector3().setFromMatrixPosition(anchorToWorld(p, a, new THREE.Matrix4()));
  expect(v.x).toBeCloseTo(10 + a.pos[2], 9); expect(v.z).toBeCloseTo(-5 - a.pos[0], 9); expect(v.y).toBeCloseTo(a.pos[1], 9);
});
test('rope haulers stand on the deck and outside every car slot (Phase 4 parks cars there)', () => {
  for (const e of ERAS) {
    const s = vesselSpec(e), L = deckLayout(s);
    if (s.propulsion !== 'ropes') continue;
    const cars = seatAnchors(s, L).filter((a) => a.kind === 'car'), perSide = Math.ceil(s.crew / 2);
    for (const side of [1, -1]) for (let k = 0; k < perSide; k++) {
      const x = haulerStationX(k, perSide, L, side), z = haulerZ(side, L);
      expect(Math.abs(x), e.id).toBeLessThanOrEqual(L.halfLength - 0.5);
      for (const c of cars) expect(Math.abs(x - c.pos[0]) < CAR_SLOT.length / 2 && Math.abs(z - c.pos[2]) < CAR_SLOT.width / 2, e.id).toBe(false);
    }
  }
});
