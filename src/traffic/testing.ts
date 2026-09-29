// Shared test fixtures for src/traffic (imported by *.test.ts only).
import * as THREE from 'three';
import { fields512, geom512 } from '../ancon/testing';
import { computeVesselPose, createVesselPose, makePoseContext, type VesselPose } from '../ancon/pose';
import { vesselSpec } from '../ancon/spec';
import { getEra, type EraId } from '../data/eras';
import { sampleField } from '../terrain/fields';
import { dockEnv, type DockEnv } from './env';
import type { MoverFrame } from './motion';
import { rearOverhang, type MoverDims } from './models';
import { eraTimings } from './schedule';

/** An era's dock environment with its own dock timings, on the 512 placement fields (the grid the app computes the crossing from). */
export const envFor = (id: EraId) => {
  const e = getEra(id), f = fields512(e.river.bankOffset.value), groundAt = (x: number, z: number) => sampleField(f, f.height, x, z);
  const ctx = makePoseContext(geom512(e.river.bankOffset.value), vesselSpec(e, eraTimings(e)), e.river.flow.value, groundAt);
  return dockEnv(e, ctx, groundAt);
};
export const poseFor = (env: DockEnv, clock: number): VesselPose => computeVesselPose(clock, env.ctx, createVesselPose());

export interface OBB { c: [number, number]; u: [number, number]; hx: number; hz: number }
/** The body's ground rectangle (XZ): centre, forward unit axis, half length and half width (+ pad). */
export function obbOf(fr: MoverFrame, d: MoverDims, pad = 0): OBB {
  const e = fr.matrix.elements, fx = e[0], fz = e[2], l = Math.hypot(fx, fz) || 1, u: [number, number] = [fx / l, fz / l];
  const off = (d.front - rearOverhang(d)) / 2;
  return { c: [e[12] + u[0] * off, e[14] + u[1] * off], u, hx: d.length / 2 + pad, hz: d.width / 2 + pad };
}
const proj = (b: OBB, ax: [number, number]) => {
  const v: [number, number] = [-b.u[1], b.u[0]];
  return Math.abs(b.u[0] * ax[0] + b.u[1] * ax[1]) * b.hx + Math.abs(v[0] * ax[0] + v[1] * ax[1]) * b.hz;
};
export function obbOverlap(a: OBB, b: OBB): boolean {
  const d: [number, number] = [b.c[0] - a.c[0], b.c[1] - a.c[1]];
  for (const ax of [a.u, [-a.u[1], a.u[0]], b.u, [-b.u[1], b.u[0]]] as [number, number][]) {
    if (Math.abs(d[0] * ax[0] + d[1] * ax[1]) > proj(a, ax) + proj(b, ax)) return false;
  }
  return true;
}
export function discInObb(x: number, z: number, r: number, b: OBB): boolean {
  const dx = x - b.c[0], dz = z - b.c[1], lx = dx * b.u[0] + dz * b.u[1], lz = -dx * b.u[1] + dz * b.u[0];
  const qx = Math.max(-b.hx, Math.min(b.hx, lx)), qz = Math.max(-b.hz, Math.min(b.hz, lz));
  return Math.hypot(lx - qx, lz - qz) < r;
}
/** World height of deck-local (x, deck, z) under `pose`. */
export const deckHeight = (env: DockEnv, pose: VesselPose, x: number, z: number) => new THREE.Vector3(x, env.layout.deckY, z).applyMatrix4(pose.matrix).y;
