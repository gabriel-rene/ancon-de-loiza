import type { GeoBundle } from '../data/geo/types';
import { landmarkXZ } from '../data/landmarks';
import { distanceTransform } from '../terrain/edt';
import { WATER, type WorldFields } from '../terrain/fields';
import { drawPolyline } from '../terrain/raster';

export const TOWN_RADIUS = 230;
export interface VegMasks { roadDist: Float32Array; riverDist: Float32Array; town: Float32Array }

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Distances (m) to road centrelines and to river/pond water, plus a 0..1 Loíza town-core weight. */
export function buildVegMasks(geo: GeoBundle, f: WorldFields): VegMasks {
  const g = f.grid, N = g.size * g.size;
  const road = new Uint8Array(N);
  for (const r of geo.roads) if (!r.bridge) drawPolyline(g, road, r.points, 1);
  const river = new Uint8Array(N);
  for (let i = 0; i < N; i++) river[i] = f.water[i] === WATER.RIVER || f.water[i] === WATER.POND ? 1 : 0;
  const dRoad = distanceTransform(road, g.size, g.size), dRiver = distanceTransform(river, g.size, g.size);
  const [px, pz] = landmarkXZ('plaza');
  const roadDist = new Float32Array(N), riverDist = new Float32Array(N), town = new Float32Array(N);
  for (let j = 0; j < g.size; j++) for (let i = 0; i < g.size; i++) {
    const k = j * g.size + i, x = g.minX + (i + 0.5) * g.cell, z = g.minZ + (j + 0.5) * g.cell;
    roadDist[k] = dRoad[k] * g.cell;
    riverDist[k] = dRiver[k] * g.cell;
    town[k] = f.water[k] ? 0 : 1 - smooth(TOWN_RADIUS * 0.6, TOWN_RADIUS, Math.hypot(x - px, z - pz));
  }
  return { roadDist, riverDist, town };
}
