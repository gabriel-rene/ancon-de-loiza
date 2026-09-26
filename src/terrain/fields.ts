import type { GeoBundle, LandKind, XZ } from '../data/geo/types';
import { project } from '../geo/project';
import { distanceTransform } from './edt';
import { fbm } from './noise';
import { drawPolyline, fillPolygon, floodFill, makeGrid, type Grid } from './raster';

export const WATER = { LAND: 0, RIVER: 1, SEA: 2, POND: 3 } as const;
export const LANDCLS = { NONE: 0, SAND: 1, WETLAND: 2, WOOD: 3, SCRUB: 4, GRASS: 5 } as const;
const LAND_VALUE: Record<LandKind, number> = { sand: 1, wetland: 2, wood: 3, scrub: 4, grassland: 5 };
export const SEA_SEED: XZ = project(18.444, -65.874);

export interface WorldFields {
  grid: Grid;
  water: Uint8Array; landCls: Uint8Array;
  /** Signed distance to shoreline, metres. Negative in water. */
  shore: Float32Array;
  /** Distance to open sea, metres (0 in the sea). */
  seaDist: Float32Array;
  height: Float32Array;
  /** RGBA8 per cell: R sand, G mud/wet, B forest, A 255. */
  info: Uint8Array;
  /** RGBA8 per cell: R depth/15m, G river(255)/pond(128)/sea(0), B shore distance/60m, A 255. */
  waterInfo: Uint8Array;
}

export function buildFields(geo: GeoBundle, opts: { extent: number; size: number; bankOffset: number }): WorldFields {
  const g = makeGrid(opts.extent, opts.size);
  const N = g.size * g.size;
  const water = new Uint8Array(N);
  for (const w of geo.water) fillPolygon(g, water, w.ring, w.kind === 'river' ? WATER.RIVER : WATER.POND);

  if (opts.bankOffset > 0) {
    const riverMask = new Uint8Array(N);
    for (let i = 0; i < N; i++) riverMask[i] = water[i] === WATER.RIVER ? 1 : 0;
    const d = distanceTransform(riverMask, g.size, g.size);
    for (let i = 0; i < N; i++) if (water[i] === WATER.LAND && d[i] * g.cell <= opts.bankOffset) water[i] = WATER.RIVER;
  }

  const walls = new Uint8Array(N);
  for (const line of geo.coastline) drawPolyline(g, walls, line, 1);
  const si = Math.floor((SEA_SEED[0] - g.minX) / g.cell), sj = Math.floor((SEA_SEED[1] - g.minZ) / g.cell);
  const sea = new Uint8Array(N);
  floodFill(g, sea, (i) => walls[i] === 1 || water[i] !== WATER.LAND, sj * g.size + si, 1);
  for (let i = 0; i < N; i++) if (sea[i]) water[i] = WATER.SEA;
  openRiverMouth(g, water, walls);

  const landCls = new Uint8Array(N);
  for (const l of geo.land) fillPolygon(g, landCls, l.ring, LAND_VALUE[l.kind]);

  const isWater = new Uint8Array(N), isLand = new Uint8Array(N), isSea = new Uint8Array(N);
  for (let i = 0; i < N; i++) { isWater[i] = water[i] ? 1 : 0; isLand[i] = water[i] ? 0 : 1; isSea[i] = water[i] === WATER.SEA ? 1 : 0; }
  const toWater = distanceTransform(isWater, g.size, g.size);
  const toLand = distanceTransform(isLand, g.size, g.size);
  const toSea = distanceTransform(isSea, g.size, g.size);

  const shore = new Float32Array(N), seaDist = new Float32Array(N), height = new Float32Array(N);
  const info = new Uint8Array(N * 4), waterInfo = new Uint8Array(N * 4);
  for (let j = 0; j < g.size; j++) for (let i = 0; i < g.size; i++) {
    const k = j * g.size + i;
    const x = g.minX + (i + 0.5) * g.cell, z = g.minZ + (j + 0.5) * g.cell;
    const s = water[k] ? -toLand[k] * g.cell : toWater[k] * g.cell;
    shore[k] = s;
    seaDist[k] = toSea[k] * g.cell;
    height[k] = water[k] ? -waterDepth(water[k], -s) : landHeight(s, seaDist[k], landCls[k], x, z);

    const sand = landCls[k] === LANDCLS.SAND || (seaDist[k] < 70 && height[k] < 2.5) ? 1 : 0;
    const mud = landCls[k] === LANDCLS.WETLAND ? 0.7 : water[k] === WATER.LAND && s < 6 && seaDist[k] > 40 ? 1 - s / 6 : 0;
    const forest = landCls[k] === LANDCLS.WOOD || landCls[k] === LANDCLS.SCRUB ? 0.85 : 0;
    info.set([sand * 255, mud * 255, forest * 255, 255], k * 4);
    const kind = water[k] === WATER.RIVER ? 255 : water[k] === WATER.POND ? 128 : 0;
    waterInfo.set([Math.min(255, (Math.max(0, -height[k]) / 15) * 255), kind, Math.min(255, (Math.abs(s) / 60) * 255), 255], k * 4);
  }
  return { grid: g, water, landCls, shore, seaDist, height, info, waterInfo };
}

/**
 * The rasterised coastline is a one-cell wall. Where it crosses the river mouth outside the
 * river polygon (bankOffset 0, post-dam eras) it leaves a strip of LAND between river and
 * sea. Open those wall cells: a LAND wall cell that touches the river (4-neighbour) and the
 * sea (8-neighbour, the wall is often diagonal) becomes SEA. Wall cells along an ordinary
 * beach touch only the sea, so real coastline is untouched.
 */
function openRiverMouth(g: Grid, water: Uint8Array, walls: Uint8Array) {
  const n = g.size, open: number[] = [];
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= n || j >= n ? -1 : water[j * n + i]);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (!walls[k] || water[k] !== WATER.LAND) continue;
    let river = false, sea = false;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const w = at(i + di, j + dj);
      if (w === WATER.SEA) sea = true;
      if (w === WATER.RIVER && Math.abs(di) + Math.abs(dj) === 1) river = true;
    }
    if (river && sea) open.push(k);
  }
  for (const k of open) water[k] = WATER.SEA;
}

function landHeight(s: number, seaDist: number, cls: number, x: number, z: number) {
  let h = 0.5 + 2.6 * (1 - Math.exp(-s / 70)) + (fbm(x * 0.01, z * 0.01) - 0.5) * 1.2 * Math.min(1, s / 25);
  if (seaDist < 90) {
    const t = 1 - seaDist / 90;
    const beach = 0.15 + seaDist * 0.03 + 1.6 * fbm(x * 0.03 + 7, z * 0.03) ** 2 * Math.min(1, seaDist / 15);
    h = h * (1 - t) + beach * t;
  }
  if (cls === LANDCLS.WETLAND) h = Math.min(h, 0.35 + 0.15 * fbm(x * 0.05, z * 0.05));
  return Math.max(h, 0.12);
}

function waterDepth(kind: number, d: number) {
  if (kind === WATER.RIVER) return 0.35 + 2.8 * (1 - Math.exp(-d / 22));
  if (kind === WATER.SEA) return 0.3 + 14 * (1 - Math.exp(-d / 300));
  return 0.8;
}

/** Bilinear sample of a per-cell array at world x,z. */
export function sampleField(f: WorldFields, arr: Float32Array, x: number, z: number) {
  const { size, cell, minX, minZ } = f.grid;
  const fx = Math.min(size - 1.001, Math.max(0, (x - minX) / cell - 0.5));
  const fz = Math.min(size - 1.001, Math.max(0, (z - minZ) / cell - 0.5));
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const a = arr[j * size + i], b = arr[j * size + i + 1], c = arr[(j + 1) * size + i], d = arr[(j + 1) * size + i + 1];
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
