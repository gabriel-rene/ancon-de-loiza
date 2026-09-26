import type { Grid } from '../terrain/raster';
import type { PlantInstance } from './types';

/**
 * Needle-litter weight (0..255 per cell, `size`² over the grid's extent) from casuarina
 * instances: each tree drops litter within ~its crown radius; two box blurs soften the edge.
 * A belt of casuarinas has a brown needle floor, a lone tree only a faint patch.
 */
export function litterMap(trees: readonly PlantInstance[], grid: Grid, size = 256, perTree = 0.55): Uint8Array {
  const ext = grid.cell * grid.size, cell = ext / size, n = size * size;
  let a = new Float32Array(n), b = new Float32Array(n);
  const r = Math.max(1, Math.round(5 / cell));
  for (const t of trees) {
    const ci = Math.floor((t.x - grid.minX) / cell), cj = Math.floor((t.z - grid.minZ) / cell);
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++)
      if (i >= 0 && j >= 0 && i < size && j < size) a[j * size + i] += perTree;
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      let s = 0, c = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const x = i + di, y = j + dj;
        if (x >= 0 && y >= 0 && x < size && y < size) { s += a[y * size + x]; c++; }
      }
      b[j * size + i] = s / c;
    }
    [a, b] = [b, a];
  }
  const out = new Uint8Array(n);
  for (let k = 0; k < n; k++) out[k] = Math.round(255 * Math.min(1, a[k]));
  return out;
}
