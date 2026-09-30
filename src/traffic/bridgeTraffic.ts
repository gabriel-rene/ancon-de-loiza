import * as THREE from 'three';
import type { CarModel } from '../data/eras';
import type { GeoBundle, XZ } from '../data/geo/types';
import { deckTop, type BridgePlan } from '../infrastructure/bridge';
import { ROAD_LIFT } from '../infrastructure/roadStrip';
import { antiguaJunction, PR187_WAY, STORY_WAYS } from '../infrastructure/roads';
import { offsetRight, pointAt, polyline, type Polyline } from './env';
import { DIMS } from './models';
import { PAINT } from './plan';

/** 40 km/h (inferred L), lane centres 2.4 m either side of the bridge axis (the 9.6 m asphalt), 1984–86 models. */
export const BRIDGE_SPEED = 11, BRIDGE_LANE = 2.4;
export const BRIDGE_MODELS: readonly CarModel[] = ['sedan80', 'compact80'];
/** Deck ↔ approach blend length at each abutment (m). */
const BLEND = 8;

export interface BridgeLane { path: Polyline; y: (x: number, z: number) => number }

/** West approach (PR-187's last ~145 m) → bridge → east approach (Ruta de la Tradición), and back; each lane keeps right. */
export function bridgeLanes(geo: GeoBundle, plan: BridgePlan, groundAt: (x: number, z: number) => number): [BridgeLane, BridgeLane] {
  const way = (id: string) => geo.roads.find((r) => r.id === id)!.points;
  const west = way(PR187_WAY).slice(antiguaJunction(geo));   // PR-187 past the Antigua junction: the bridge's west approach (as eraRoads)
  const east = way(STORY_WAYS.approach);
  const centre: XZ[] = [...west, plan.b, ...east.slice(1)];
  const y = (x: number, z: number) => {
    const t = ((x - plan.a[0]) * plan.dir[0] + (z - plan.a[1]) * plan.dir[1]) / plan.len, g = groundAt(x, z) + ROAD_LIFT;
    if (t >= 0 && t <= 1) return deckTop(plan, t) + 0.06;
    const e = t < 0 ? -t * plan.len : (t - 1) * plan.len, deck = deckTop(plan, t < 0 ? 0 : 1) + 0.06;
    return e < BLEND ? deck + (g - deck) * (e / BLEND) : g;
  };
  return [{ path: polyline(offsetRight(centre, BRIDGE_LANE)), y }, { path: polyline(offsetRight([...centre].reverse(), BRIDGE_LANE)), y }];
}

export interface BridgeCar { lane: 0 | 1; model: CarModel; paint: number; offset: number }
/** n cars, half per lane, evenly spaced along it (offset = share of the lane length); 1984–86 paint (src/traffic/plan.ts). */
export function bridgeCars(n: number): BridgeCar[] {
  const per = Math.ceil(n / 2), paint = PAINT[1984];
  return Array.from({ length: n }, (_, k) => ({
    lane: (k % 2) as 0 | 1, model: BRIDGE_MODELS[(k >> 1) % 2], paint: paint[(k * 5) % paint.length], offset: Math.floor(k / 2) / per + (k % 2) * 0.37 / per,
  }));
}
/**
 * How many cars to run so about `onBridge` are on the bridge at once (spec 4c §6): the loops run the approaches too,
 * so scale by lane length / bridge length (ruling R9).
 */
export const bridgeCarCount = (onBridge: number, lanes: readonly BridgeLane[], plan: BridgePlan) =>
  2 * Math.round((onBridge / 2) * (lanes[0].path.len / plan.len));
const _xz: [number, number] = [0, 0];
/** Front and rear contacts of `car` at `clock`; false while it is in the hidden gap at the path's end. */
export function bridgeCarAt(lane: BridgeLane, car: BridgeCar, clock: number, front: THREE.Vector3, rear: THREE.Vector3): boolean {
  const L = lane.path.len, wb = DIMS[car.model].wheelbase, s = (((BRIDGE_SPEED * clock) / L + car.offset) % 1 + 1) % 1 * L;
  if (s < wb) return false;
  pointAt(lane.path, s, _xz); front.set(_xz[0], lane.y(_xz[0], _xz[1]), _xz[1]);
  pointAt(lane.path, s - wb, _xz); rear.set(_xz[0], lane.y(_xz[0], _xz[1]), _xz[1]);
  return true;
}
