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
/** Widths (m), inferred. */
export const STORY_WIDTH: Record<StoryId, number> = { antigua: 5, escobar: 6, approach: 9 };
export const ROAD_WIDTH: Record<string, number> = { secondary: 7, secondary_link: 5, tertiary: 6, track: 3.5, path: 1.5, footway: 1.5 };
/** Numbered roads shown only from 1935 (inferred, L). */
const FROM_1935 = new Set(['PR-951', 'PR-188']);

export interface StoryRoad { id: StoryId; points: XZ[]; width: number }
export interface SimpleRoad { id: string; points: XZ[]; width: number }
export interface EraRoads { story: StoryRoad[]; simple: SimpleRoad[]; surface: RoadSurface }

const way = (geo: GeoBundle, id: string) => {
  const r = geo.roads.find((x) => x.id === id);
  if (!r) throw new Error(`OSM way ${id} missing from loiza.json`);
  return r;
};
export const bridgeWay = (geo: GeoBundle) => way(geo, BRIDGE_WAY).points;

export function eraRoads(geo: GeoBundle, era: Era): EraRoads {
  const bridge = era.infrastructure.bridge.value !== 'none';
  const ids: StoryId[] = bridge ? ['antigua', 'escobar', 'approach'] : ['antigua', 'escobar'];
  const story = ids.map((id) => ({ id, points: way(geo, STORY_WAYS[id]).points, width: STORY_WIDTH[id] }));
  const skip = new Set([...Object.values(STORY_WAYS), BRIDGE_WAY]);
  const year = Number(era.id);
  const simple = geo.roads
    .filter((r) => Object.hasOwn(ROAD_WIDTH, r.kind) && !r.bridge && !skip.has(r.id) && !(r.ref && FROM_1935.has(r.ref) && year < 1935))
    .map((r) => ({ id: r.id, points: r.points, width: ROAD_WIDTH[r.kind] }));
  return { story, simple, surface: era.infrastructure.roadSurface.value };
}
