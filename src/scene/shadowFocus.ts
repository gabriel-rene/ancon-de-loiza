type V3 = [number, number, number];
export interface ShadowFocusResult { target: V3; position: V3 }

// Module-level scratch used by every call (with or without `out`) so the per-frame caller
// in SkyAndLight allocates nothing — see the `out` param below.
const F: V3 = [0, 0, 0];
const S: V3 = [0, 0, 0];
const RIGHT: V3 = [0, 0, 0];
const UP: V3 = [0, 0, 0];
const UP_WORLD: V3 = [0, 1, 0];

function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function crossInto(out: V3, a: V3, b: V3): void {
  const x = a[1] * b[2] - a[2] * b[1];
  const y = a[2] * b[0] - a[0] * b[2];
  const z = a[0] * b[1] - a[1] * b[0];
  out[0] = x; out[1] = y; out[2] = z;
}
function normInto(out: V3, a: V3): void {
  const l = Math.hypot(a[0], a[1], a[2]);
  out[0] = a[0] / l; out[1] = a[1] / l; out[2] = a[2] / l;
}

/**
 * Where to aim a single directional shadow map so it covers what the camera looks at.
 * Focus = where the view ray meets y=0, clamped to [20, 0.9·half] m ahead (horizontal views
 * use the clamp). The focus is snapped to whole shadow texels in light space so the map
 * does not shimmer as the camera moves.
 *
 * Pass `out` (a reused result object, e.g. module-level scratch in the caller) to avoid
 * allocating a new result each call — the default (no `out`) still returns a fresh object,
 * which is what the unit tests below rely on.
 */
export function shadowFocus(
  camPos: V3, camDir: V3, sunDir: V3, half: number, mapSize: number, out?: ShadowFocusResult,
): ShadowFocusResult {
  const maxAhead = 0.9 * half;
  let t = camDir[1] < -1e-3 ? -camPos[1] / camDir[1] : maxAhead;
  t = Math.min(maxAhead, Math.max(20, t));
  F[0] = camPos[0] + camDir[0] * t; F[1] = 0; F[2] = camPos[2] + camDir[2] * t;
  normInto(S, sunDir);
  crossInto(RIGHT, UP_WORLD, S);
  normInto(RIGHT, RIGHT);
  crossInto(UP, S, RIGHT);
  const texel = (2 * half) / mapSize;
  const snap = (v: number) => Math.round(v / texel) * texel;
  const r = snap(dot(F, RIGHT)), u = snap(dot(F, UP)), w = dot(F, S);
  const result = out ?? { target: [0, 0, 0] as V3, position: [0, 0, 0] as V3 };
  for (let i = 0; i < 3; i++) result.target[i] = RIGHT[i] * r + UP[i] * u + S[i] * w;
  for (let i = 0; i < 3; i++) result.position[i] = result.target[i] + S[i] * 1500;
  return result;
}
