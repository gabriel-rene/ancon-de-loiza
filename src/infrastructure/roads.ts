import type { Era, RoadSurface } from '../data/eras';
import type { GeoBundle, XZ } from '../data/geo/types';

/**
 * Only a handful of roads (user ruling 2026-09-28, spec 4a §3): three story roads drawn as real strips
 * (roadStrip.ts), and the main roads and paths painted into the ground mask. Residential and service
 * streets are left out (4b may bring a few back).
 */
export type StoryId = 'antigua' | 'escobar' | 'approach';
export const STORY_WAYS: Record<StoryId, string> = { antigua: '1058673941', escobar: '22182236', approach: '204521441' };
export const BRIDGE_WAY = '204521442';
/** Modern PR-187 through Piñones; its last ~145 m, past the Antigua junction, is the bridge's west approach. */
export const PR187_WAY = '528811967';
/** Widths (m), inferred. */
export const STORY_WIDTH: Record<StoryId, number> = { antigua: 5, escobar: 6, approach: 9 };
export const ROAD_WIDTH: Record<string, number> = { secondary: 7, secondary_link: 5, tertiary: 6, track: 3.5, path: 1.5, footway: 1.5 };
/** Numbered roads shown only from 1935 (inferred, L). */
const FROM_1935 = new Set(['PR-951', 'PR-188']);

/** `surface` is the era's, except the bridge approaches while the bridge is being built: dirt ('sand'). */
export interface StoryRoad { id: StoryId; points: XZ[]; width: number; surface: RoadSurface }
/** A painted road; `surface` set only where it differs from the era's (then it is painted as dirt). */
export interface SimpleRoad { id: string; points: XZ[]; width: number; surface?: RoadSurface }
export interface EraRoads { story: StoryRoad[]; simple: SimpleRoad[]; surface: RoadSurface }

const way = (geo: GeoBundle, id: string) => {
  const r = geo.roads.find((x) => x.id === id);
  if (!r) throw new Error(`OSM way ${id} missing from loiza.json`);
  return r;
};
export const bridgeWay = (geo: GeoBundle) => way(geo, BRIDGE_WAY).points;

/** Index of the PR-187 point where the Antigua PR-187 branches off (its first point). */
function antiguaJunction(geo: GeoBundle) {
  const [ax, az] = way(geo, STORY_WAYS.antigua).points[0], p = way(geo, PR187_WAY).points;
  let best = 0;
  for (let k = 1; k < p.length; k++) if (Math.hypot(p[k][0] - ax, p[k][1] - az) < Math.hypot(p[best][0] - ax, p[best][1] - az)) best = k;
  return best;
}

export function eraRoads(geo: GeoBundle, era: Era): EraRoads {
  const state = era.infrastructure.bridge.value, bridge = state !== 'none', surface = era.infrastructure.roadSurface.value;
  const approach: RoadSurface = state === 'building' ? 'sand' : surface;   // spec §3: 1984 dirt, 1986 asphalt
  const ids: StoryId[] = bridge ? ['antigua', 'escobar', 'approach'] : ['antigua', 'escobar'];
  const story = ids.map((id) => ({ id, points: way(geo, STORY_WAYS[id]).points, width: STORY_WIDTH[id], surface: id === 'approach' ? approach : surface }));
  const skip = new Set([...Object.values(STORY_WAYS), BRIDGE_WAY]);
  const year = Number(era.id);
  const simple: SimpleRoad[] = geo.roads
    .filter((r) => Object.hasOwn(ROAD_WIDTH, r.kind) && !r.bridge && !skip.has(r.id) && !(r.ref && FROM_1935.has(r.ref) && year < 1935))
    .map((r) => ({ id: r.id, points: r.points, width: ROAD_WIDTH[r.kind] }));
  // Before the bridge the modern PR-187 stops at the Antigua junction; its tail to the river is the west approach.
  const k = simple.findIndex((r) => r.id === PR187_WAY);
  if (k >= 0) {
    const r = simple[k], j = antiguaJunction(geo);
    simple[k] = { ...r, points: r.points.slice(0, j + 1) };
    if (bridge) simple.push({ id: `${PR187_WAY}-approach`, points: r.points.slice(j), width: r.width, ...(approach !== surface ? { surface: approach } : {}) });
  }
  return { story, simple, surface };
}
