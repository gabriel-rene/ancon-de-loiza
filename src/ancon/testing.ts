// Shared test fixtures for src/ancon (imported by *.test.ts only; not collected as a test file).
import type * as THREE from 'three';
import { placementFields } from '../terrain/placementFields';
import { crossingGeometry } from './geometry';

/** The 512 placement fields — the grid the app computes the crossing from. */
export const fields512 = (bankOffset = 0) => placementFields(bankOffset);
export const geom512 = (bankOffset = 0) => crossingGeometry(fields512(bankOffset));
export const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
