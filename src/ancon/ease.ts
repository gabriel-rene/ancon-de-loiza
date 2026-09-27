/** Small shared easing / interpolation helpers for the ferry modules (one copy, no per-module duplicates). */
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Smoothstep on [0, 1]. */
export const smooth = (u: number) => u * u * (3 - 2 * u);
/** ∫₀ᵘ smoothstep = u³ − u⁴/2 (a ramp whose speed eases in and out). */
export const smoothIntegral = (u: number) => u * u * u - 0.5 * u * u * u * u;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const fract = (x: number) => x - Math.floor(x);
/** Blend angles the short way (a fixed direction when exactly opposite). */
export function lerpAngle(a: number, b: number, w: number) {
  const d = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + d * w;
}
