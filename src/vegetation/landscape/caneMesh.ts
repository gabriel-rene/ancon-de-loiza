import * as THREE from 'three';
import { hash3 } from '../rng';
import type { CaneLayout } from './caneFields';

export const CANE_FRINGE = 0.6;
export const CANE_SINK = 0.3;
export const CANE_TOP_TILE = 4, CANE_SIDE_TILE = 2.5;

/** Smooth value noise in [0, 1] on a `scale`-metre lattice (bilinear, deterministic in `seed`). */
function fieldNoise(x: number, z: number, scale: number, seed: number): number {
  const fx = x / scale, fz = z / scale, i = Math.floor(fx), j = Math.floor(fz);
  const u = fx - i, v = fz - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const h = (a: number, b: number) => hash3(a, b, seed) / 4294967296;
  const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1);
  return (a + (b - a) * su) * (1 - sv) + (c + (d - c) * su) * sv;
}

const CANE_MOTTLE_SCALE = 55, CANE_COLOR_SEED = 4210;
/**
 * Per-vertex colour multiplier (applied on top of the painted texture, so it centres near 1):
 * a per-field shift from the field's rank (young/green vs mature/yellow-green cane) plus a
 * low-frequency world-space mottle that ignores field boundaries, so neighbouring fields — and
 * different parts of the same field — read as visibly different, not a flat, uniform slab. This
 * is what survives at the fields-camera's distance, where the painted texture detail itself is
 * lost to mip blending.
 */
function caneTint(rank: number, x: number, z: number): [number, number, number] {
  const mottle = fieldNoise(x, z, CANE_MOTTLE_SCALE, CANE_COLOR_SEED) - 0.5; // -0.5 .. 0.5
  const rk = rank - 0.5; // -0.5 .. 0.5
  const val = 1 + 0.12 * rk + 0.18 * mottle;
  return [val * (1 + 0.08 * rk - 0.07 * mottle), val * (1 + 0.02 * rk + 0.02 * mottle), val * (1 - 0.16 * rk - 0.11 * mottle)];
}

/**
 * Cane blocks for the shown cells of `layout` (spec 2c §3). Top: per grid row, each run of
 * consecutive cells of one field becomes one quad at ground + field height (the four corners
 * follow `heightAt`). Sides: each straight run of boundary edges (a shown cell next to a cell that
 * is not the same shown field) becomes one wall from CANE_SINK below the ground to CANE_FRINGE
 * above the top, facing out; the side texture's alpha-cut leaf tips make that top edge ragged.
 * Merged runs share their exact grid-corner positions (no per-vertex displacement), so the top and
 * every wall meeting it stay watertight; each vertex is coloured by `caneTint`. The raw 10 m-grid
 * staircase this leaves on field boundaries is broken up at the source instead, by cutting
 * `caneLayout` on a finer cell (`CANE_CELL`, phase 2c review round 2).
 */
export function buildCaneGeometry(layout: CaneLayout, shown: Uint8Array, heightAt: (x: number, z: number) => number) {
  const { size: n, cell: c, minX, minZ } = layout.grid;
  const id = (i: number, j: number) => (i < 0 || j < 0 || i >= n || j >= n || !shown[j * n + i] ? -1 : layout.field[j * n + i]);
  const hOf = (f: number) => layout.fields[f].height;
  const rankOf = (f: number) => layout.fields[f].rank;

  const tp: number[] = [], tn: number[] = [], tu: number[] = [], tf: number[] = [], tc: number[] = [], ti: number[] = [];
  for (let j = 0; j < n; j++) {
    let i = 0;
    while (i < n) {
      const f = id(i, j);
      if (f < 0) { i++; continue; }
      let e = i + 1;
      while (e < n && id(e, j) === f) e++;
      const xa = minX + i * c, xb = minX + e * c, za = minZ + j * c, zb = za + c, h = hOf(f), rank = rankOf(f), b = tp.length / 3;
      for (const [x, z] of [[xa, za], [xb, za], [xa, zb], [xb, zb]]) {
        const col = caneTint(rank, x, z);
        tp.push(x, heightAt(x, z) + h, z); tn.push(0, 1, 0); tu.push(x / CANE_TOP_TILE, z / CANE_TOP_TILE); tf.push(0.35);
        tc.push(...col);
      }
      ti.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      i = e;
    }
  }

  const sp: number[] = [], sn: number[] = [], su: number[] = [], sf: number[] = [], sc: number[] = [], si: number[] = [];
  /** One wall from (xa, za) to (xb, zb) with outward normal (nx, nz), for field height h. */
  const wall = (xa: number, za: number, xb: number, zb: number, nx: number, nz: number, h: number, rank: number) => {
    const len = Math.hypot(xb - xa, zb - za), b = sp.length / 3;
    for (const [x, z, u] of [[xa, za, 0], [xb, zb, len / CANE_SIDE_TILE]] as const) {
      const g = heightAt(x, z), col = caneTint(rank, x, z);
      sp.push(x, g - CANE_SINK, z, x, g + h + CANE_FRINGE, z);
      sn.push(nx, 0, nz, nx, 0, nz); su.push(u, 0, u, 1); sf.push(0, 0.5);
      sc.push(...col, ...col);
    }
    // Wind so that the front face (normal side) is counter-clockwise.
    if (nx * (zb - za) - nz * (xb - xa) > 0) si.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    else si.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  };
  // Edges along x (north/south faces), merged per row.
  for (const [dj, nz] of [[-1, -1], [1, 1]] as const) for (let j = 0; j < n; j++) {
    const z = minZ + (dj < 0 ? j : j + 1) * c;
    let i = 0;
    while (i < n) {
      const f = id(i, j);
      if (f < 0 || id(i, j + dj) === f) { i++; continue; }
      let e = i + 1;
      while (e < n && id(e, j) === f && id(e, j + dj) !== f) e++;
      wall(minX + i * c, z, minX + e * c, z, 0, nz, hOf(f), rankOf(f));
      i = e;
    }
  }
  // Edges along z (west/east faces), merged per column.
  for (const [di, nx] of [[-1, -1], [1, 1]] as const) for (let i = 0; i < n; i++) {
    const x = minX + (di < 0 ? i : i + 1) * c;
    let j = 0;
    while (j < n) {
      const f = id(i, j);
      if (f < 0 || id(i + di, j) === f) { j++; continue; }
      let e = j + 1;
      while (e < n && id(i, e) === f && id(i + di, e) !== f) e++;
      wall(x, minZ + j * c, x, minZ + e * c, nx, 0, hOf(f), rankOf(f));
      j = e;
    }
  }

  const make = (p: number[], nn: number[], u: number[], f: number[], col: number[], idx: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    g.setAttribute('aFlex', new THREE.Float32BufferAttribute(f, 1));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  };
  return { top: make(tp, tn, tu, tf, tc, ti), sides: make(sp, sn, su, sf, sc, si) };
}
