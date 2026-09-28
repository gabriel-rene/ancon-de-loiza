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
 * Three-way split for the main view + water reflection: `near` gets the instances within `dR`
 * at its front ([0, n0)) and those in (dR, d0] at its back ([len − n1, len)); `far` gets the
 * rest at its front. Returns [n0, n1, nFar] (written into `out` when given — no allocation).
 * dR ≤ 0 puts nothing in the first group.
 */
export function partitionLod3<T extends Uint32Array | [number, number, number] = [number, number, number]>(xs: Float32Array, zs: Float32Array,
  cx: number, cz: number, dR: number, d0: number, near: Uint32Array, far: Uint32Array, out?: T): T {
  let a = 0, b = 0, f = 0; const r2 = dR > 0 ? dR * dR : -1, d2 = d0 * d0, last = near.length - 1;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - cx, dz = zs[i] - cz, q = dx * dx + dz * dz;
    if (q <= r2) near[a++] = i; else if (q <= d2) near[last - b++] = i; else far[f++] = i;
  }
  const o = out ?? ([0, 0, 0] as unknown as T);
  o[0] = a; o[1] = b; o[2] = f;
  return o;
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

/**
 * Copy the matrices at `idx[idxOff .. idxOff + n)` from `src` into `dst`, packed from matrix slot
 * `dstOff` on (no allocation).
 */
export function gatherMatrices(src: Float32Array, idx: Uint32Array, n: number, dst: Float32Array, idxOff = 0, dstOff = 0) {
  for (let k = 0; k < n; k++) {
    const s = idx[idxOff + k] * 16, d = (dstOff + k) * 16;
    for (let j = 0; j < 16; j++) dst[d + j] = src[s + j];
  }
}

/**
 * Horizontal view wedge: the camera frustum projected onto the ground plane is the cone of its
 * corner rays' horizontal directions, apex at the camera (cx, cz), bisector (fx, fz), half-angle
 * `half` (s = the bisector turned 90°). The water reflection's mirrored camera projects to the
 * same wedge (the mirror only flips y). `all` = no culling (the frustum sees straight down or
 * spans too wide an angle for a wedge).
 */
export interface Wedge { cx: number; cz: number; fx: number; fz: number; cosA: number; sinA: number; half: number; all: boolean }
export const newWedge = (): Wedge => ({ cx: 0, cz: 0, fx: 1, fz: 0, cosA: 0, sinA: 1, half: Math.PI / 2, all: true });
const WEDGE_MAX = 85 * Math.PI / 180;

/** Wedge (widened by `margin` rad) from the frustum's corner ray directions `dirs` ([x, y, z] × k, world). */
export function viewWedge(cx: number, cz: number, dirs: ArrayLike<number>, margin: number, out: Wedge): Wedge {
  out.cx = cx; out.cz = cz; out.all = true;
  let sx = 0, sz = 0;
  const k = dirs.length / 3;
  for (let i = 0; i < k; i++) {
    const x = dirs[i * 3], y = dirs[i * 3 + 1], z = dirs[i * 3 + 2], h = Math.hypot(x, z);
    if (h < 1e-3 * Math.hypot(x, y, z)) return out;
    sx += x / h; sz += z / h;
  }
  const s = Math.hypot(sx, sz);
  if (s < 1e-6) return out;
  const fx = sx / s, fz = sz / s;
  let minDot = 1;
  for (let i = 0; i < k; i++) {
    const x = dirs[i * 3], z = dirs[i * 3 + 2], h = Math.hypot(x, z);
    minDot = Math.min(minDot, (x * fx + z * fz) / h);
  }
  const half = Math.acos(Math.max(-1, Math.min(1, minDot))) + margin;
  if (half >= WEDGE_MAX) return out;
  out.fx = fx; out.fz = fz; out.half = half; out.cosA = Math.cos(half); out.sinA = Math.sin(half); out.all = false;
  return out;
}

/** Does a disc of radius `r` at (x, z) touch the wedge? (Conservative near the apex.) */
export function inWedge(w: Wedge, x: number, z: number, r: number): boolean {
  if (w.all) return true;
  const dx = x - w.cx, dz = z - w.cz;
  const along = dx * w.fx + dz * w.fz, side = Math.abs(dx * w.fz - dz * w.fx);
  return along >= -r && side * w.cosA - along * w.sinA <= r;
}

/** Is `inner`'s angular range inside `outer`'s (apex movement is not considered)? */
export function wedgeCovers(outer: Wedge, inner: Wedge): boolean {
  if (outer.all) return true;
  if (inner.all) return false;
  const c = Math.max(-1, Math.min(1, outer.fx * inner.fx + outer.fz * inner.fz));
  return Math.acos(c) + inner.half <= outer.half;
}

/**
 * `partitionLod3` with view culling (`w` null = none; `rs` = per-instance cull radius): only
 * instances whose disc touches the wedge are kept — `near` gets those within `dR` at its front
 * ([0, nA)) and those in (dR, d0] at its back ([len − nB, len)); `far` gets those beyond d0.
 * Returns [nA, nB, nFar] (written into `out` — no allocation).
 */
export function partitionView<T extends Uint32Array | number[]>(xs: Float32Array, zs: Float32Array, rs: Float32Array,
  cx: number, cz: number, dR: number, d0: number, w: Wedge | null, near: Uint32Array, far: Uint32Array, out: T): T {
  let a = 0, b = 0, f = 0; const r2 = dR > 0 ? dR * dR : -1, d2 = d0 * d0, last = near.length - 1;
  for (let i = 0; i < xs.length; i++) {
    if (w !== null && !inWedge(w, xs[i], zs[i], rs[i])) continue;
    const dx = xs[i] - cx, dz = zs[i] - cz, q = dx * dx + dz * dz;
    if (q <= r2) near[a++] = i; else if (q <= d2) near[last - b++] = i; else far[f++] = i;
  }
  out[0] = a; out[1] = b; out[2] = f;
  return out;
}

/**
 * Shadow casters: indices of the instances within `d0` (LOD0; horizontal) of the camera whose
 * sphere (centre height `ys`, radius `ls`) reaches into `box` (null = all of them), into `out`.
 * Returns the count.
 */
export function partitionShadow(xs: Float32Array, ys: Float32Array, zs: Float32Array, ls: Float32Array,
  cx: number, cz: number, d0: number, box: LightBox | null, out: Uint32Array): number {
  let n = 0; const d2 = d0 * d0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - cx, dz = zs[i] - cz;
    if (dx * dx + dz * dz > d2) continue;
    if (box === null || inLightBox(box, xs[i], ys[i], zs[i], ls[i])) out[n++] = i;
  }
  return n;
}

/**
 * The directional shadow camera's square footprint: `half` (+ `margin`) m either side of
 * `target` along the light-space right/up axes (built as in `shadowFocus`), unbounded along
 * the light. Anything outside cannot cast into the shadow map.
 */
export interface LightBox { tx: number; ty: number; tz: number; rx: number; rz: number; ux: number; uy: number; uz: number; ext: number }
export const newLightBox = (): LightBox => ({ tx: 0, ty: 0, tz: 0, rx: 1, rz: 0, ux: 0, uy: 0, uz: 1, ext: Infinity });

export function lightBox(target: ArrayLike<number>, sunDir: ArrayLike<number>, half: number, margin: number, out: LightBox): LightBox {
  const sl = Math.hypot(sunDir[0], sunDir[1], sunDir[2]), sx = sunDir[0] / sl, sy = sunDir[1] / sl, sz = sunDir[2] / sl;
  // right = normalize(up × s) = normalize((sz, 0, −sx)); up' = s × right.
  let rx = sz, rz = -sx; const rl = Math.hypot(rx, rz);
  if (rl < 1e-6) { rx = 1; rz = 0; } else { rx /= rl; rz /= rl; }
  out.tx = target[0]; out.ty = target[1]; out.tz = target[2];
  out.rx = rx; out.rz = rz;
  out.ux = sy * rz; out.uy = sz * rx - sx * rz; out.uz = -sy * rx;
  out.ext = half + margin;
  return out;
}

/** Does a sphere of radius `r` at (x, y, z) reach into the light box? */
export function inLightBox(b: LightBox, x: number, y: number, z: number, r: number): boolean {
  const dx = x - b.tx, dy = y - b.ty, dz = z - b.tz, e = b.ext + r;
  return Math.abs(dx * b.rx + dz * b.rz) <= e && Math.abs(dx * b.ux + dy * b.uy + dz * b.uz) <= e;
}
