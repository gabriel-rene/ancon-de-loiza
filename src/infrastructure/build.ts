import type * as THREE from 'three';
import type { Infrastructure } from '../data/eras';
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
  parts: Partial<Record<InfraMaterialId, THREE.BufferGeometry>>; road: THREE.BufferGeometry | null; dirt: DirtPatch[]; station: StationLayout;
}
/** Spec 4a §5. */
export const LIMITS = { drawCalls: 12, triangles: 40000 } as const;

/** All of one era's infrastructure: ≤ 5 merged meshes (one per material) plus the story-road strip. Pure. */
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
    road: buildRoadStrip(i.roads.story, i.groundAt, i.landAt),
    dirt: [...landingDirt(east, v.landing.value), ...landingDirt(west, v.landing.value), ...station.dirt],
    station,
  };
}
export const drawCalls = (o: InfraOutput) => Object.keys(o.parts).length + (o.road ? 1 : 0);
export const triangles = (o: InfraOutput) =>
  Object.values(o.parts).reduce((n, g) => n + triangleCount(g!), 0) + (o.road ? triangleCount(o.road) : 0);
