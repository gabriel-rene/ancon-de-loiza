import * as THREE from 'three';
import { hash3 } from '../rng';
import type { CaneLayout } from './caneFields';

export const CANE_FRINGE = 0.6;
/** Below the wall's own run-end ground samples (phase 2c review round 3: raised from 0.3 so a
 * long wall's flat bottom edge never floats over a bump partway along its run). */
export const CANE_SINK = 1.0;
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
  // Phase 2c art gate: amplitudes raised (rank 0.12 → 0.3, mottle 0.18 → 0.24, hue shifts ~2×)
  // — the old values left every field the same flat green at the fields-camera's distance.
  const val = 1 + 0.3 * rk + 0.24 * mottle;
  return [val * (1 + 0.18 * rk - 0.1 * mottle), val * (1 + 0.04 * rk + 0.03 * mottle), val * (1 - 0.32 * rk - 0.16 * mottle)];
}

/**
 * Cane blocks for the shown cells of `layout` (spec 2c §3). Top: per grid row, each run of
 * consecutive cells of one field becomes one quad; every field's top is flat, at the mean of
 * `heightAt` over that field's shown cell centres plus the field's height (phase 2c review round
 * 3) — sampling `heightAt` per vertex instead let two merged runs meeting along a shared edge (a
 * row's run and the next row's run, or a run and a wall) disagree on that edge's height wherever
 * the terrain wasn't flat between their own sample points, opening thin T-junction gaps that
 * showed the ground through. A field-constant Y makes that geometrically impossible: every top
 * vertex of a field is exactly the same height, so any two of its edges are trivially collinear
 * in Y. Sides: each straight run of boundary edges (a shown cell next to a cell that is not the
 * same shown field) becomes one wall from CANE_SINK below the ground *at that run's own
 * endpoints* to CANE_FRINGE above the field's flat top, facing out; the side texture's alpha-cut
 * leaf tips make that top edge ragged. Merged runs share their exact grid-corner (x, z) — no
 * per-vertex displacement — so the top and every wall meeting it stay watertight; each vertex is
 * coloured by `caneTint`.
 */
export function buildCaneGeometry(layout: CaneLayout, shown: Uint8Array, heightAt: (x: number, z: number) => number) {
  const { size: n, cell: c, minX, minZ } = layout.grid;
  const id = (i: number, j: number) => (i < 0 || j < 0 || i >= n || j >= n || !shown[j * n + i] ? -1 : layout.field[j * n + i]);
  const hOf = (f: number) => layout.fields[f].height;
  const rankOf = (f: number) => layout.fields[f].rank;

  // One flat Y per field: mean ground height over its shown cells' centres, plus field height.
  const nFields = layout.fields.length, sumY = new Float64Array(nFields), cnt = new Int32Array(nFields);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const f = id(i, j);
    if (f < 0) continue;
    sumY[f] += heightAt(minX + (i + 0.5) * c, minZ + (j + 0.5) * c);
    cnt[f]++;
  }
  const flatY = new Float64Array(nFields);
  for (let f = 0; f < nFields; f++) flatY[f] = (cnt[f] ? sumY[f] / cnt[f] : 0) + hOf(f);

  const tp: number[] = [], tn: number[] = [], tu: number[] = [], tf: number[] = [], tc: number[] = [], ti: number[] = [];
  for (let j = 0; j < n; j++) {
    let i = 0;
    while (i < n) {
      const f = id(i, j);
      if (f < 0) { i++; continue; }
      let e = i + 1;
      while (e < n && id(e, j) === f) e++;
      const xa = minX + i * c, xb = minX + e * c, za = minZ + j * c, zb = za + c, y = flatY[f], rank = rankOf(f), b = tp.length / 3;
      for (const [x, z] of [[xa, za], [xb, za], [xa, zb], [xb, zb]]) {
        const col = caneTint(rank, x, z);
        tp.push(x, y, z); tn.push(0, 1, 0); tu.push(x / CANE_TOP_TILE, z / CANE_TOP_TILE); tf.push(0.35);
        tc.push(...col);
      }
      ti.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      i = e;
    }
  }

  const sp: number[] = [], sn: number[] = [], su: number[] = [], sf: number[] = [], sc: number[] = [], si: number[] = [];
  /** One wall from (xa, za) to (xb, zb) with outward normal (nx, nz); top is the field's flat Y
   * (+ CANE_FRINGE), bottom is this run's own ground sample at each endpoint (− CANE_SINK). */
  const wall = (xa: number, za: number, xb: number, zb: number, nx: number, nz: number, flatTop: number, rank: number) => {
    const len = Math.hypot(xb - xa, zb - za), b = sp.length / 3;
    for (const [x, z, u] of [[xa, za, 0], [xb, zb, len / CANE_SIDE_TILE]] as const) {
      const g = heightAt(x, z), col = caneTint(rank, x, z);
      sp.push(x, g - CANE_SINK, z, x, flatTop + CANE_FRINGE, z);
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
      wall(minX + i * c, z, minX + e * c, z, 0, nz, flatY[f], rankOf(f));
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
      wall(x, minZ + j * c, x, minZ + e * c, nx, 0, flatY[f], rankOf(f));
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
