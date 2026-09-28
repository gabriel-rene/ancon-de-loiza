import type { GeoBundle } from '../../data/geo/types';
import { drawPolyline, fillPolygon, type Grid } from '../../terrain/raster';
import { hash3 } from '../rng';

/*
 * Sugar-cane fields (phase 2c, spec §2–§3). The OSM grassland — open, inland, on the Torrecilla /
 * Carolina side, where the Iturregui cane land lay [S1] — is cut by a jittered grid of field
 * boundaries (~220 m pitch, ±50 m) into fields on a 5 m cell grid. A cell within LANE_HALF metres
 * of a boundary line is a cart lane. Water, roads (+2 cells) and scraps under MIN_CELLS (2000 m²)
 * are dropped. Each field has a fixed random rank; an era shows the fields whose rank < its cane
 * share, so the era sets nest and no field moves between eras. Depends only on the geo bundle,
 * never on the quality tier.
 */

export const CANE_CELL = 5;
const PITCH = 220, JITTER = 50, SEED = 1900;
/** Half-width (m) of a boundary line's cart lane: a cell whose centre falls within this of a
 * jittered boundary line is a lane, not field — independent of CANE_CELL, so halving the cell
 * size sharpens the field raster without widening the lanes it cuts (spec: 6–10 m lanes). */
const LANE_HALF = 4;
/** Minimum field area (m²) to keep (drops raster scraps); MIN_CELLS follows from CANE_CELL. */
const MIN_AREA = 2000;
export const MIN_CELLS = Math.round(MIN_AREA / (CANE_CELL * CANE_CELL));
/** Road dilation, in cells (2 × 5 m = 10 m either way): how far from a road centreline cane is kept clear. */
const ROAD_DILATE = 2;
const u01 = (i: number, j: number, s: number) => hash3(i, j, s) / 4294967296;

export interface CaneField { rank: number; height: number; cells: number }
export interface CaneLayout { grid: Grid; field: Int32Array; fields: CaneField[] }

export function caneLayout(geo: GeoBundle): CaneLayout {
  const rings = geo.land.filter((l) => l.kind === 'grassland').map((l) => l.ring);
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const r of rings) for (const [x, z] of r) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  const size = Math.ceil((Math.max(x1 - x0, z1 - z0) + 40) / CANE_CELL);
  const grid: Grid = { size, cell: CANE_CELL, minX: x0 - 20, minZ: z0 - 20 };
  const N = size * size;

  const ok = new Uint8Array(N);
  for (const r of rings) fillPolygon(grid, ok, r, 1);
  for (const w of geo.water) fillPolygon(grid, ok, w.ring, 0);
  const road = new Uint8Array(N);
  for (const r of geo.roads) if (!r.bridge) drawPolyline(grid, road, r.points, 1);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    if (!road[j * size + i]) continue;
    for (let dj = -ROAD_DILATE; dj <= ROAD_DILATE; dj++) for (let di = -ROAD_DILATE; di <= ROAD_DILATE; di++) {
      const a = i + di, b = j + dj;
      if (a >= 0 && b >= 0 && a < size && b < size) ok[b * size + a] = 0;
    }
  }

  // Jittered boundary lines, shared by neighbouring fields so fields tile.
  const ext = size * CANE_CELL, K = Math.ceil(ext / PITCH) + 1;
  const lines = (axis: number, min: number) => Array.from({ length: K + 1 }, (_, k) => min + k * PITCH + (2 * u01(k, axis, SEED) - 1) * JITTER);
  const xs = lines(0, grid.minX), zs = lines(1, grid.minZ);
  const band = (ls: number[], v: number) => { let k = 0; while (k + 1 < ls.length && ls[k + 1] <= v) k++; return k; };
  const onLine = (ls: number[], v: number, k: number) => Math.abs(v - ls[k]) < LANE_HALF || (k + 1 < ls.length && Math.abs(ls[k + 1] - v) < LANE_HALF);

  const field = new Int32Array(N).fill(-1);
  const index = new Map<number, number>(), fields: CaneField[] = [];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const k = j * size + i;
    if (!ok[k]) continue;
    const x = grid.minX + (i + 0.5) * CANE_CELL, z = grid.minZ + (j + 0.5) * CANE_CELL;
    const c = band(xs, x), r = band(zs, z);
    if (onLine(xs, x, c) || onLine(zs, z, r)) continue;
    const key = c * 4096 + r;
    let f = index.get(key);
    if (f === undefined) {
      f = fields.length; index.set(key, f);
      fields.push({ rank: u01(c, r, SEED + 1), height: 2.5 + u01(c, r, SEED + 2), cells: 0 });
    }
    field[k] = f; fields[f].cells++;
  }

  // Drop scraps and re-index the survivors.
  const remap = fields.map(() => -1), kept: CaneField[] = [];
  fields.forEach((f, i) => { if (f.cells >= MIN_CELLS) { remap[i] = kept.length; kept.push(f); } });
  for (let k = 0; k < N; k++) if (field[k] >= 0) field[k] = remap[field[k]];
  return { grid, field, fields: kept };
}

export function shownMask(layout: CaneLayout, share: number): Uint8Array {
  const out = new Uint8Array(layout.field.length);
  for (let k = 0; k < out.length; k++) {
    const f = layout.field[k];
    if (f >= 0 && layout.fields[f].rank < share) out[k] = 1;
  }
  return out;
}

export function inCane(layout: CaneLayout, shown: Uint8Array) {
  const { size, cell, minX, minZ } = layout.grid;
  return (x: number, z: number) => {
    const i = Math.floor((x - minX) / cell), j = Math.floor((z - minZ) / cell);
    return i >= 0 && j >= 0 && i < size && j < size && shown[j * size + i] === 1;
  };
}
