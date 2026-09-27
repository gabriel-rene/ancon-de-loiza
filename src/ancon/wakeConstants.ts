// src/ancon/wakeConstants.ts — leaf module: shared by the CPU trail (wake.ts, wakeUniforms.ts) and the water shader.

/** Trail samples and their spacing (s). */
export const WAKE_N = 16, WAKE_DT = 1.5;
/** Speed (m/s) that draws a full-strength wake: the cruise on the 122–138 m dock-to-dock line is ≈ 1.0–1.1 m/s. */
export const WAKE_REF = 1.1;
/** Trail half-width: WAKE_W0 · half-beam + WAKE_SPREAD · age (≈ the Kelvin angle at 1 m/s). */
export const WAKE_W0 = 0.6, WAKE_SPREAD = 0.35;

/** A number as a GLSL float literal (always with a decimal point: `1` → `1.0`). */
export const glslFloat = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
