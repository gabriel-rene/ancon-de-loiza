// src/scene/water/reflTaps.ts — leaf module: the reflection resolve filter used by the water shader.
import { glslFloat } from '../../ancon/wakeConstants';

/**
 * Four-tap rotated-grid offsets (in reflection texels) for resolving the mirror texture.
 * The reflection target is rendered at `reflScale` of the screen (0.35 on medium), so one
 * texel spans ~3 screen pixels; alpha-tested foliage in it has binary edges that MSAA cannot
 * smooth, and bilinear magnification alone leaves them as visible stair-steps. Averaging four
 * bilinear taps on a rotated grid (each axis sees four distinct offsets) turns a one-texel
 * step into a ramp ~2 texels wide without a separate blur pass.
 * `r` is the tap radius in texels; the pattern is centred (offsets sum to zero).
 */
export function reflTaps(r = REFL_TAP_RADIUS): [number, number][] {
  const a = Math.atan2(1, 3);                  // rotated-grid angle: projections at ±1/√10, ±3/√10 of r
  const c = Math.cos(a) * r, s = Math.sin(a) * r;
  return [[c, s], [-s, c], [-c, -s], [s, -c]];
}

/** Tap radius in reflection texels. */
export const REFL_TAP_RADIUS = 0.75;

/** GLSL for `vec3 reflSample(vec2 uv)`: the averaged taps, given `uniform vec2 uReflTexel`. */
export function reflSampleGlsl(taps = reflTaps()): string {
  const v = (n: number) => glslFloat(+n.toFixed(5));
  const lines = taps.map(([x, y]) => `texture2D(tDiffuse, uv + vec2(${v(x)}, ${v(y)}) * uReflTexel).rgb`);
  return `vec3 reflSample(vec2 uv) {\n  return (${lines.join('\n        + ')}) * ${glslFloat(1 / taps.length)};\n}`;
}
