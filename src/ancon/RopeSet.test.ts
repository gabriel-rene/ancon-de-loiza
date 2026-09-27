// src/ancon/RopeSet.test.ts
import type * as THREE from 'three';
import { expect, test } from 'vitest';
import { getEra, type EraId } from '../data/eras';
import { computeVesselPose, createVesselPose } from './pose';
import { RopeSet } from './RopeSet';
import { mooringLocal, ropeRig } from './rigging';
import { ctxFor, fields512 } from './testing';

const make = (id: EraId) => {
  const ctx = ctxFor(id), bank = getEra(id).river.bankOffset.value;
  return { ctx, bank, set: new RopeSet({ spec: ctx.spec, layout: ctx.layout, geom: ctx.geom, fields: fields512(bank), segments: 32, radial: 6 }) };
};
const firstRing = (set: RopeSet, line = 0) => {
  const mesh = set.group.children.filter((c) => (c as THREE.Mesh).isMesh && !(c as THREE.InstancedMesh).isInstancedMesh)[line] as THREE.Mesh;
  const p = mesh.geometry.attributes.position.array as Float32Array;
  let cx = 0, cy = 0, cz = 0;
  for (let j = 0; j < 6; j++) { cx += p[j * 3] / 6; cy += p[j * 3 + 1] / 6; cz += p[j * 3 + 2] / 6; }
  return { p, c: [cx, cy, cz] };
};

test('line count per era kind', () => {
  expect(make('1935').set.lineCount).toBe(2);   // two hauling ropes
  expect(make('1840').set.lineCount).toBe(1);   // Lombera shore rope
  expect(make('1986').set.lineCount).toBe(2);   // mooring lines
  expect(make('1925').set.lineCount).toBe(0);
});
test('hauling rope starts at its east post and stays finite while crossing', () => {
  const { ctx, bank, set } = make('1975');
  set.update(computeVesselPose(90, ctx, createVesselPose()), 0.001);
  const { p, c } = firstRing(set), post = ropeRig(ctx.geom, ctx.layout, fields512(bank)).east[0];
  expect(p.every(Number.isFinite)).toBe(true);
  expect(Math.hypot(c[0] - post[0], c[1] - post[1], c[2] - post[2])).toBeLessThan(1e-3);
});
test('1986 mooring lines start at the top of an east bitt', () => {
  const { ctx, set } = make('1986'), pose = computeVesselPose(0, ctx, createVesselPose());
  set.update(pose, 0.001);
  const { c } = firstRing(set, 0), b = mooringLocal(ctx.layout, 0, [0, 0, 0]);
  const v = { x: b[0], y: b[1], z: b[2] };
  const e = pose.matrix.elements, w = [e[0] * v.x + e[4] * v.y + e[8] * v.z + e[12], e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13], e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14]];
  expect(Math.hypot(c[0] - w[0], c[1] - w[1], c[2] - w[2])).toBeLessThan(1e-3);
});
