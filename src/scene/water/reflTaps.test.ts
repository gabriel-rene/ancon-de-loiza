import { describe, expect, it } from 'vitest';
import { REFL_TAP_RADIUS, reflSampleGlsl, reflTaps } from './reflTaps';

describe('reflection resolve taps', () => {
  const taps = reflTaps();

  it('is four taps centred on the sample (no image shift)', () => {
    expect(taps).toHaveLength(4);
    const sx = taps.reduce((a, t) => a + t[0], 0), sy = taps.reduce((a, t) => a + t[1], 0);
    expect(Math.abs(sx)).toBeLessThan(1e-9);
    expect(Math.abs(sy)).toBeLessThan(1e-9);
  });

  it('sits on a circle of the tap radius, under one texel (a smooth, not a blur)', () => {
    for (const [x, y] of taps) expect(Math.hypot(x, y)).toBeCloseTo(REFL_TAP_RADIUS, 9);
    expect(REFL_TAP_RADIUS).toBeLessThan(1);
    expect(REFL_TAP_RADIUS).toBeGreaterThanOrEqual(0.5);
  });

  it('is a rotated grid: four distinct offsets along each axis', () => {
    const uniq = (v: number[]) => new Set(v.map((n) => n.toFixed(6))).size;
    expect(uniq(taps.map((t) => t[0]))).toBe(4);
    expect(uniq(taps.map((t) => t[1]))).toBe(4);
  });

  it('emits GLSL that averages every tap in texel units', () => {
    const g = reflSampleGlsl();
    expect(g).toContain('vec3 reflSample(vec2 uv)');
    expect(g.match(/texture2D\(tDiffuse/g)).toHaveLength(4);
    expect(g.match(/\* uReflTexel/g)).toHaveLength(4);
    expect(g).toContain('* 0.25;');
    expect(g).not.toMatch(/vec2\(-?\d+,/); // float literals only
  });
});
