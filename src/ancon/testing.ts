// Shared test fixtures for src/ancon (imported by *.test.ts only; not collected as a test file).
import type * as THREE from 'three';
import { getEra, type EraId } from '../data/eras';
import { placementFields } from '../terrain/placementFields';
import { crossingGeometry } from './geometry';
import { makePoseContext } from './pose';
import { vesselSpec } from './spec';

/** The 512 placement fields — the grid the app computes the crossing from. */
export const fields512 = (bankOffset = 0) => placementFields(bankOffset);
export const geom512 = (bankOffset = 0) => crossingGeometry(fields512(bankOffset));
export const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
/** Pose context for an era on its own (pre- or post-dam) river; `flow` overrides the era's current. */
export const ctxFor = (id: EraId, flow?: number) => {
  const e = getEra(id);
  return makePoseContext(geom512(e.river.bankOffset.value), vesselSpec(e), flow ?? e.river.flow.value);
};
