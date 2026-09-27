// src/ancon/rope.ts
export type V3 = [number, number, number];
/** Largest mid-span sag, m: a slack rope rests about a metre under the surface instead of on the bed. */
export const MAX_SAG = 2.4;
/** Mid-span sag (m): taut ≈ 0.4 % of the span, slack adds up to 2 %. */
export const spanSag = (span: number, slack: number) => Math.min(MAX_SAG, span * (0.004 + 0.02 * slack));

/** n + 1 points from a to b sagging by `sag` at mid-span (parabolic catenary approximation). Returns offset + n + 1. */
export function writeSpan(a: V3, b: V3, sag: number, n: number, out: Float32Array, offset: number): number {
  for (let i = 0; i <= n; i++) {
    const s = i / n, k = (offset + i) * 3;
    out[k] = a[0] + (b[0] - a[0]) * s;
    out[k + 1] = a[1] + (b[1] - a[1]) * s - 4 * sag * s * (1 - s);
    out[k + 2] = a[2] + (b[2] - a[2]) * s;
  }
  return offset + n + 1;
}

const dist = (a: V3, b: V3) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
/** A hauling rope: bank post A → deck guide A (water span), straight over the deck, guide B → post B. */
export function writeRopeLine(postA: V3, guideA: V3, guideB: V3, postB: V3, slack: number, segs: number, out: Float32Array): number {
  const o = writeSpan(postA, guideA, spanSag(dist(postA, guideA), slack), segs, out, 0);
  return writeSpan(guideB, postB, spanSag(dist(guideB, postB), slack), segs, out, o);
}

/** Tube vertices around a polyline (rings of `radial` vertices, outward unit normals). */
export function writeTube(pts: Float32Array, count: number, radius: number, radial: number, pos: Float32Array, nrm: Float32Array) {
  for (let i = 0; i < count; i++) {
    const i0 = Math.max(0, i - 1) * 3, i1 = Math.min(count - 1, i + 1) * 3;
    let tx = pts[i1] - pts[i0], ty = pts[i1 + 1] - pts[i0 + 1], tz = pts[i1 + 2] - pts[i0 + 2];
    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    let rx = 0, ry = 1, rz = 0;
    if (Math.abs(ty) > 0.95) { rx = 1; ry = 0; }
    // b = normalize(t × r); n = b × t
    let bx = ty * rz - tz * ry, by = tz * rx - tx * rz, bz = tx * ry - ty * rx;
    const bl = Math.hypot(bx, by, bz); bx /= bl; by /= bl; bz /= bl;
    const nx = by * tz - bz * ty, ny = bz * tx - bx * tz, nz = bx * ty - by * tx;
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), k = (i * radial + j) * 3;
      const ox = c * nx + s * bx, oy = c * ny + s * by, oz = c * nz + s * bz;
      nrm[k] = ox; nrm[k + 1] = oy; nrm[k + 2] = oz;
      pos[k] = pts[i * 3] + ox * radius; pos[k + 1] = pts[i * 3 + 1] + oy * radius; pos[k + 2] = pts[i * 3 + 2] + oz * radius;
    }
  }
}

/** Static index for a tube of `count` rings (outward-facing winding). */
export function tubeIndex(count: number, radial: number): Uint16Array {
  const idx = new Uint16Array((count - 1) * radial * 6);
  let o = 0;
  for (let i = 0; i < count - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = a + radial, d = b + radial;
    idx[o++] = a; idx[o++] = b; idx[o++] = c;
    idx[o++] = b; idx[o++] = d; idx[o++] = c;
  }
  return idx;
}
