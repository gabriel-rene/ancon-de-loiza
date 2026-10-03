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

/** Camera heights (m) between which the shadow extent grows from the tier's `half` toward SHADOW_HALF_MAX. */
export const SHADOW_GROW = { from: 40, perMetre: 1.8, max: 600 };
/**
 * Shadow half-extent for a camera at height `y`: the tier's `half` at deck height; a high camera (Sky view,
 * ~380 m) widens it so the map covers the town and the groves it looks at instead of a strip, and the far
 * shadows soften with the coarser texel (6a open items 3 and 4). 0 (no shadows) stays 0.
 */
export function shadowHalfFor(half: number, y: number): number {
  if (half <= 0) return 0;
  return Math.max(half, Math.min(SHADOW_GROW.max, (y - SHADOW_GROW.from) * SHADOW_GROW.perMetre));
}

export interface ShadowSetup { half: number; mapSize: number; radius: number }
/** Settings for a high camera soften the far shadows: the extent widens, the map texel grows and PCF blurs it. */
export const SHADOW_HIGH = { mapDiv: 4, radius: 4 };
/**
 * The shadow map's extent, resolution and PCF radius for a camera at height `y`. Once the extent has grown past
 * the tier's (a high camera), a quarter-size map with a wider PCF radius turns crisp blocks under houses and
 * groves into the soft smudges of an aerial photo. The swap happens inside the era dip or a view change.
 */
export function shadowSetupFor(half: number, mapSize: number, y: number): ShadowSetup {
  const h = shadowHalfFor(half, y);
  if (h <= 0 || mapSize <= 0) return { half: 0, mapSize: 0, radius: 1 };
  if (h <= half) return { half: h, mapSize, radius: 1 };
  return { half: h, mapSize: mapSize / SHADOW_HIGH.mapDiv, radius: SHADOW_HIGH.radius };
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
