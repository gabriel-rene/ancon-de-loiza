// src/ancon/CrewSet.test.ts
import type * as THREE from 'three';
import { expect, test } from 'vitest';
import type { EraId } from '../data/eras';
import { castActors } from './crew';
import { CrewSet } from './CrewSet';
import { computeVesselPose, createVesselPose } from './pose';
import { seatAnchors } from './seats';
import { ctxFor } from './testing';

test.each([['1925', 2], ['1935', 0], ['1840', 3]] as [EraId, number][])('%s: one pole per poler/helmsman, all matrices finite', (id, poles) => {
  const ctx = ctxFor(id), set = new CrewSet(castActors(ctx.spec, seatAnchors(ctx.spec, ctx.layout), 1));
  set.update(computeVesselPose(90, ctx, createVesselPose()), ctx);
  expect(set.poleCount).toBe(poles);
  set.group.traverse((o) => {
    if ((o as THREE.InstancedMesh).isInstancedMesh) expect(Array.from((o as THREE.InstancedMesh).instanceMatrix.array).every(Number.isFinite)).toBe(true);
  });
});
test('1986: nobody aboard — no figure or pole mesh is drawn; dispose empties the group', () => {
  const ctx = ctxFor('1986'), set = new CrewSet(castActors(ctx.spec, seatAnchors(ctx.spec, ctx.layout), 1));
  set.update(computeVesselPose(90, ctx, createVesselPose()), ctx);
  let drawn = 0;
  set.group.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh && o.visible) drawn++; });
  expect(drawn).toBe(0);
  set.dispose();
  expect(set.group.children.length).toBe(0);
});
test('1975 mid-crossing: only the kinds worn are drawn (≤ 21 figure meshes + no pole)', () => {
  const ctx = ctxFor('1975'), set = new CrewSet(castActors(ctx.spec, seatAnchors(ctx.spec, ctx.layout), 1975));
  set.update(computeVesselPose(90, ctx, createVesselPose()), ctx);
  let drawn = 0, total = 0;
  set.group.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) { total++; if (o.visible) drawn++; } });
  expect(total).toBe(22);
  expect(drawn).toBeGreaterThan(8); expect(drawn).toBeLessThan(21);
  set.dispose();
});
