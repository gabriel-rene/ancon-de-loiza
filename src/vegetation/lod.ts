import type { PlantInstance } from './types';

/** Indices within d0 (horizontal) of the camera go to `near`, the rest to `far`. No allocation. */
export function partitionLod(xs: Float32Array, zs: Float32Array, cx: number, cz: number, d0: number, near: Uint32Array, far: Uint32Array): [number, number] {
  let a = 0, b = 0; const d2 = d0 * d0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - cx, dz = zs[i] - cz;
    if (dx * dx + dz * dz <= d2) near[a++] = i; else far[b++] = i;
  }
  return [a, b];
}

/**
 * Column-major 4×4 matrices (16 floats per instance, three.js layout): translation (x, y, z),
 * rotation `rot` about +Y, uniform `scale`.
 */
export function composeInstanceMatrices(instances: readonly PlantInstance[], out = new Float32Array(instances.length * 16)): Float32Array {
  for (let i = 0; i < instances.length; i++) {
    const p = instances[i], o = i * 16, c = Math.cos(p.rot) * p.scale, s = Math.sin(p.rot) * p.scale;
    out[o] = c; out[o + 1] = 0; out[o + 2] = -s; out[o + 3] = 0;
    out[o + 4] = 0; out[o + 5] = p.scale; out[o + 6] = 0; out[o + 7] = 0;
    out[o + 8] = s; out[o + 9] = 0; out[o + 10] = c; out[o + 11] = 0;
    out[o + 12] = p.x; out[o + 13] = p.y; out[o + 14] = p.z; out[o + 15] = 1;
  }
  return out;
}

/** Copy the matrices at `idx[0..n)` from `src` into the packed `dst` (no allocation). */
export function gatherMatrices(src: Float32Array, idx: Uint32Array, n: number, dst: Float32Array) {
  for (let k = 0; k < n; k++) {
    const s = idx[k] * 16, d = k * 16;
    for (let j = 0; j < 16; j++) dst[d + j] = src[s + j];
  }
}
