import type * as THREE from 'three';
import { finish, makeBuilders, triangleCount, type GroundAt, type InfraMaterialId } from '../infrastructure/parts';
import { buildChurch } from './church';
import { buildHouse } from './houseMesh';
import type { EraTown } from './town';

/** Spec 4b §4. */
export const TOWN_LIMITS = { drawCalls: 8, triangles: 40000 } as const;
export type TownParts = Partial<Record<InfraMaterialId, THREE.BufferGeometry>>;

/** One era's houses and the church: one merged mesh per material in use (≤ 5). Pure. */
export function buildTown(t: EraTown, g: GroundAt): TownParts {
  const b = makeBuilders();
  for (const h of t.houses) buildHouse(b, h, g);
  buildChurch(b, t.church, g);
  return finish(b);
}
export const townDrawCalls = (p: TownParts) => Object.keys(p).length;
export const townTriangles = (p: TownParts) => Object.values(p).reduce((n, g) => n + triangleCount(g!), 0);
