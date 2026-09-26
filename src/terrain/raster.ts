import type { XZ } from '../data/geo/types';

export interface Grid { size: number; cell: number; minX: number; minZ: number }
export const makeGrid = (extent: number, size: number): Grid => ({ size, cell: extent / size, minX: -extent / 2, minZ: -extent / 2 });

/** Even-odd scanline fill of a closed ring. */
export function fillPolygon(g: Grid, out: Uint8Array, ring: XZ[], value: number) {
  const n = ring.length;
  for (let j = 0; j < g.size; j++) {
    const zc = g.minZ + (j + 0.5) * g.cell;
    const xs: number[] = [];
    for (let k = 0; k < n; k++) {
      const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % n];
      if ((az <= zc && bz > zc) || (bz <= zc && az > zc)) xs.push(ax + ((zc - az) / (bz - az)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - g.minX) / g.cell - 0.5));
      const i1 = Math.min(g.size - 1, Math.floor((xs[k + 1] - g.minX) / g.cell - 0.5));
      for (let i = i0; i <= i1; i++) out[j * g.size + i] = value;
    }
  }
}

/** 8-connected polyline raster (blocks 4-connected flood fills). */
export function drawPolyline(g: Grid, out: Uint8Array, pts: XZ[], value: number) {
  const step = g.cell * 0.5;
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / step));
    for (let s = 0; s <= n; s++) {
      const x = ax + ((bx - ax) * s) / n, z = az + ((bz - az) * s) / n;
      const i = Math.floor((x - g.minX) / g.cell), j = Math.floor((z - g.minZ) / g.cell);
      if (i >= 0 && j >= 0 && i < g.size && j < g.size) out[j * g.size + i] = value;
    }
  }
}

/** 4-connected flood fill from seedIdx into cells where out==0 and !blocked. */
export function floodFill(g: Grid, out: Uint8Array, blocked: (idx: number) => boolean, seedIdx: number, value: number) {
  const stack = [seedIdx];
  while (stack.length) {
    const idx = stack.pop()!;
    if (out[idx] !== 0 || blocked(idx)) continue;
    out[idx] = value;
    const i = idx % g.size, j = (idx - i) / g.size;
    if (i > 0) stack.push(idx - 1);
    if (i < g.size - 1) stack.push(idx + 1);
    if (j > 0) stack.push(idx - g.size);
    if (j < g.size - 1) stack.push(idx + g.size);
  }
}
