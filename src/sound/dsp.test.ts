import { expect, test } from 'vitest';
import { bandpass, brown, envAD, fadeEdges, highpass, loopify, lowpass, maxStep, normalize, rng, samples, tone, white } from './dsp';

const SR = 22050;
const rms = (x: Float32Array) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
const peak = (x: Float32Array) => x.reduce((a, v) => Math.max(a, Math.abs(v)), 0);

test('rng is deterministic per seed and in [0, 1)', () => {
  const a = rng(7), b = rng(7), c = rng(8);
  const xs = Array.from({ length: 1000 }, a);
  expect(xs).toEqual(Array.from({ length: 1000 }, b));
  expect(xs.every((v) => v >= 0 && v < 1)).toBe(true);
  expect(c()).not.toBe(rng(7)());
});
test('white noise is in [-1, 1]; brown noise is darker than white', () => {
  const w = white(SR, rng(1)), b = brown(SR, rng(1));
  expect(peak(w)).toBeLessThanOrEqual(1);
  expect(maxStep(normalize(b, 1))).toBeLessThan(maxStep(normalize(w, 1)) / 4);
});
test('lowpass removes a high tone; highpass removes a low tone; bandpass keeps its centre', () => {
  const hi = () => tone(SR, SR, 5000, 5000, 'sine'), lo = () => tone(SR, SR, 60, 60, 'sine');
  expect(rms(lowpass(hi(), 200, SR))).toBeLessThan(0.05);
  expect(rms(highpass(lo(), 2000, SR))).toBeLessThan(0.05);
  expect(rms(bandpass(tone(SR, SR, 800, 800, 'sine'), 800, 2, SR))).toBeGreaterThan(0.5);
  expect(rms(bandpass(tone(SR, SR, 8000, 8000, 'sine'), 800, 2, SR))).toBeLessThan(0.1);
});
test('envAD is 0 before start, peaks at start + attack, then decays', () => {
  const e = envAD(SR, SR, 0.1, 0.05, 0.1);
  expect(e[samples(0.09, SR)]).toBe(0);
  expect(e[samples(0.15, SR)]).toBeCloseTo(1, 2);
  expect(e[samples(0.45, SR)]).toBeLessThan(0.1);
});
test('normalize sets the peak; fadeEdges zeroes both ends', () => {
  const x = normalize(white(1000, rng(3)), 0.5);
  expect(peak(x)).toBeCloseTo(0.5, 6);
  fadeEdges(x, SR);
  expect(x[0]).toBe(0); expect(x[x.length - 1]).toBe(0);
});
test('loopify shortens by the fade and joins end to start without a jump', () => {
  const n = samples(1, SR), f = samples(0.1, SR), y = loopify(lowpass(white(n + f, rng(5)), 500, SR), f);
  expect(y.length).toBe(n);
  expect(Math.abs(y[n - 1] - y[0])).toBeLessThanOrEqual(maxStep(y) + 1e-6);
});
