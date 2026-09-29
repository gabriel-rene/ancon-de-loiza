import type * as THREE from 'three';
import type { Infrastructure, RoadSurface } from '../data/eras';
import type { XZ } from '../data/geo/types';
import type { LandingPad } from '../terrain/landingPads';
import { bridgePlan, buildBridge } from './bridge';
import type { DirtPatch } from './groundMask';
import { buildLanding, landingDirt } from './landing';
import { finish, makeBuilders, triangleCount, type GroundAt, type InfraMaterialId } from './parts';
import { buildRoadStrip } from './roadStrip';
import type { EraRoads } from './roads';
import { buildStation, stationLayout, upstreamSign, type StationLayout } from './station';

export interface InfraInput {
  infra: Infrastructure; pads: readonly [LandingPad, LandingPad]; roads: EraRoads; bridgeWay: readonly XZ[];
  groundAt: GroundAt; landAt: (x: number, z: number) => boolean; dryAt: (x: number, z: number) => boolean;
  waterAt: (x: number, z: number) => number;
}
export interface InfraOutput {
  parts: Partial<Record<InfraMaterialId, THREE.BufferGeometry>>; roads: RoadStrip[]; dirt: DirtPatch[]; station: StationLayout;
}
/** One story-road strip mesh per surface in use (at most 2: the era's, and dirt approaches in `building`). */
export interface RoadStrip { surface: RoadSurface; geometry: THREE.BufferGeometry }
/** Spec 4a §5. */
export const LIMITS = { drawCalls: 12, triangles: 40000 } as const;

/** All of one era's infrastructure: ≤ 5 merged meshes (one per material) plus ≤ 2 story-road strips. Pure. */
export function buildInfrastructure(i: InfraInput): InfraOutput {
  const b = makeBuilders(), v = i.infra, [east, west] = i.pads;
  buildLanding(b, east, v.landing.value, 1);
  buildLanding(b, west, v.landing.value, 2);
  const gone = v.bridge.value !== 'none' && !v.neighbourHouse.value;
  const station = stationLayout(east, v.station.value, gone, upstreamSign(east, i.bridgeWay), i.dryAt);
  buildStation(b, station, v.station.value, v.neighbourHouse.value, i.groundAt, 3);
  const plan = bridgePlan(i.bridgeWay, v.bridge.value, i.waterAt, i.groundAt);
  if (plan) buildBridge(b, plan, v.bridge.value, i.groundAt);
  return {
    parts: finish(b),
    roads: [...new Set(i.roads.story.map((r) => r.surface))].flatMap((surface) => {
      const geometry = buildRoadStrip(i.roads.story.filter((r) => r.surface === surface), i.groundAt, i.landAt);
      return geometry ? [{ surface, geometry }] : [];
    }),
    dirt: [...landingDirt(east, v.landing.value), ...landingDirt(west, v.landing.value), ...station.dirt],
    station,
  };
}
export const drawCalls = (o: InfraOutput) => Object.keys(o.parts).length + o.roads.length;
export const triangles = (o: InfraOutput) =>
  Object.values(o.parts).reduce((n, g) => n + triangleCount(g!), 0) + o.roads.reduce((n, r) => n + triangleCount(r.geometry), 0);
