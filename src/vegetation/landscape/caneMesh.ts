import * as THREE from 'three';
import type { CaneLayout } from './caneFields';

export const CANE_FRINGE = 0.6;
export const CANE_SINK = 0.3;
export const CANE_TOP_TILE = 4, CANE_SIDE_TILE = 2.5;

/**
 * Cane blocks for the shown cells of `layout` (spec 2c §3). Top: per grid row, each run of
 * consecutive cells of one field becomes one quad at ground + field height (the four corners
 * follow `heightAt`). Sides: each straight run of boundary edges (a shown cell next to a cell that
 * is not the same shown field) becomes one wall from CANE_SINK below the ground to CANE_FRINGE
 * above the top, facing out; the side texture's alpha-cut leaf tips make that top edge ragged.
 */
export function buildCaneGeometry(layout: CaneLayout, shown: Uint8Array, heightAt: (x: number, z: number) => number) {
  const { size: n, cell: c, minX, minZ } = layout.grid;
  const id = (i: number, j: number) => (i < 0 || j < 0 || i >= n || j >= n || !shown[j * n + i] ? -1 : layout.field[j * n + i]);
  const hOf = (f: number) => layout.fields[f].height;

  const tp: number[] = [], tn: number[] = [], tu: number[] = [], tf: number[] = [], ti: number[] = [];
  for (let j = 0; j < n; j++) {
    let i = 0;
    while (i < n) {
      const f = id(i, j);
      if (f < 0) { i++; continue; }
      let e = i + 1;
      while (e < n && id(e, j) === f) e++;
      const xa = minX + i * c, xb = minX + e * c, za = minZ + j * c, zb = za + c, h = hOf(f), b = tp.length / 3;
      for (const [x, z] of [[xa, za], [xb, za], [xa, zb], [xb, zb]]) {
        tp.push(x, heightAt(x, z) + h, z); tn.push(0, 1, 0); tu.push(x / CANE_TOP_TILE, z / CANE_TOP_TILE); tf.push(0.35);
      }
      ti.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      i = e;
    }
  }

  const sp: number[] = [], sn: number[] = [], su: number[] = [], sf: number[] = [], si: number[] = [];
  /** One wall from (xa, za) to (xb, zb) with outward normal (nx, nz), for field height h. */
  const wall = (xa: number, za: number, xb: number, zb: number, nx: number, nz: number, h: number) => {
    const len = Math.hypot(xb - xa, zb - za), b = sp.length / 3;
    for (const [x, z, u] of [[xa, za, 0], [xb, zb, len / CANE_SIDE_TILE]] as const) {
      const g = heightAt(x, z);
      sp.push(x, g - CANE_SINK, z, x, g + h + CANE_FRINGE, z);
      sn.push(nx, 0, nz, nx, 0, nz); su.push(u, 0, u, 1); sf.push(0, 0.5);
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
      wall(minX + i * c, z, minX + e * c, z, 0, nz, hOf(f));
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
      wall(x, minZ + j * c, x, minZ + e * c, nx, 0, hOf(f));
      j = e;
    }
  }

  const make = (p: number[], nn: number[], u: number[], f: number[], idx: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    g.setAttribute('aFlex', new THREE.Float32BufferAttribute(f, 1));
    g.setIndex(idx);
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  };
  return { top: make(tp, tn, tu, tf, ti), sides: make(sp, sn, su, sf, si) };
}
