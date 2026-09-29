import * as THREE from 'three';
import { PartBuilder } from '../ancon/vessels/common';
import type { XZ } from '../data/geo/types';

/**
 * One PartBuilder per material for all of an era's infrastructure (landings, station, bridge): each
 * builder merges into one mesh, so 4a costs one draw call per material in use (≤ 5) plus the road strip.
 */
export type InfraMaterialId = 'wood' | 'concrete' | 'zinc' | 'thatch' | 'iron';
export const INFRA_MATERIALS: readonly InfraMaterialId[] = ['wood', 'concrete', 'zinc', 'thatch', 'iron'];
export type Builders = Record<InfraMaterialId, PartBuilder>;
export type GroundAt = (x: number, z: number) => number;

export const makeBuilders = (): Builders =>
  ({ wood: new PartBuilder(), concrete: new PartBuilder(), zinc: new PartBuilder(), thatch: new PartBuilder(), iron: new PartBuilder() });

export function finish(b: Builders) {
  const out: Partial<Record<InfraMaterialId, THREE.BufferGeometry>> = {};
  for (const id of INFRA_MATERIALS) if (!b[id].empty) out[id] = b[id].build();
  return out;
}
export const triangleCount = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

/** A rectangle on the ground: centre, yaw (local +X = (cos, 0, −sin)), half sizes along local X and Z. */
export interface Footprint { c: XZ; yaw: number; hx: number; hz: number }
/** Footprint-local (x, z) → world. Local +X → (cos, −sin), local +Z → (sin, cos) (three.js rotY). */
export function toWorld(fp: Footprint, lx: number, lz: number): [number, number] {
  const c = Math.cos(fp.yaw), s = Math.sin(fp.yaw);
  return [fp.c[0] + c * lx + s * lz, fp.c[1] - s * lx + c * lz];
}
export const corners = (fp: Footprint, pad = 0): [number, number][] =>
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => toWorld(fp, sx * (fp.hx + pad), sz * (fp.hz + pad)));
