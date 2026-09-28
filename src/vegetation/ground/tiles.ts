import type { GroundId, PlantInstance } from '../types';

/** Ground-cover tile edge (m): placement runs per tile, only for tiles near the camera. */
export const GROUND_TILE = 32;

export const tileKey = (i: number, j: number) => `${i},${j}`;

/**
 * Indices of the `tile`-sized squares (tile (i, j) spans [i·tile, (i+1)·tile) × [j·tile, (j+1)·tile))
 * whose nearest point lies within `r` of (cx, cz), sorted by squared distance of the tile centre.
 */
export function tilesInRadius(cx: number, cz: number, r: number, tile: number): [number, number][] {
  const i0 = Math.floor((cx - r) / tile), i1 = Math.floor((cx + r) / tile);
  const j0 = Math.floor((cz - r) / tile), j1 = Math.floor((cz + r) / tile);
  const out: { t: [number, number]; d: number }[] = [];
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const nx = Math.max(i * tile, Math.min(cx, (i + 1) * tile)), nz = Math.max(j * tile, Math.min(cz, (j + 1) * tile));
    if ((nx - cx) ** 2 + (nz - cz) ** 2 > r * r) continue;
    const mx = (i + 0.5) * tile - cx, mz = (j + 0.5) * tile - cz;
    out.push({ t: [i, j], d: mx * mx + mz * mz });
  }
  return out.sort((a, b) => a.d - b.d).map((o) => o.t);
}

export type GroundTile = Record<GroundId, PlantInstance[]>;

/** Placed tiles by index; the oldest insertion is evicted once more than `max` are held. */
export class TileCache {
  private map = new Map<string, GroundTile>();
  constructor(private place: (i: number, j: number) => GroundTile, private max = 256) {}
  has(i: number, j: number) { return this.map.has(tileKey(i, j)); }
  get(i: number, j: number): GroundTile {
    const k = tileKey(i, j);
    let t = this.map.get(k);
    if (!t) {
      t = this.place(i, j);
      this.map.set(k, t);
      if (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
    }
    return t;
  }
  clear() { this.map.clear(); }
}
