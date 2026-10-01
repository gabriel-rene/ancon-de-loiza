import { expect, test } from 'vitest';
import { CLIP_IDS, CLIP_SEED, CLIPS } from './clips';
import { highpass, maxStep, samples } from './dsp';

const SR = 22050;

test.each(CLIP_IDS)('%s: set length, finite, peak in (0.05, 1]', (id) => {
  const c = CLIPS[id], x = c.build(CLIP_SEED[id], SR);
  expect(x.length).toBe(samples(c.seconds, SR));
  let p = 0;
  for (const v of x) { expect(Number.isFinite(v)).toBe(true); p = Math.max(p, Math.abs(v)); }
  expect(p).toBeGreaterThan(0.05);
  expect(p).toBeLessThanOrEqual(1);
});
test.each(CLIP_IDS)('%s: same seed gives the same samples; another seed differs', (id) => {
  const a = CLIPS[id].build(3, SR), b = CLIPS[id].build(3, SR), c = CLIPS[id].build(4, SR);
  expect(a).toEqual(b);
  expect(a).not.toEqual(c);
});
test.each(CLIP_IDS.filter((id) => CLIPS[id].loop))('%s loops without a jump', (id) => {
  const x = CLIPS[id].build(CLIP_SEED[id], SR);
  expect(Math.abs(x[x.length - 1] - x[0])).toBeLessThanOrEqual(maxStep(x) + 1e-6);
});
test.each(CLIP_IDS.filter((id) => !CLIPS[id].loop))('%s starts and ends silent', (id) => {
  const x = CLIPS[id].build(CLIP_SEED[id], SR);
  expect(x[0]).toBe(0); expect(x[x.length - 1]).toBe(0);
});
test('loops are the four beds; one-shots are short', () => {
  expect(CLIP_IDS.filter((id) => CLIPS[id].loop).sort()).toEqual(['engine', 'traffic', 'water', 'wind']);
  for (const id of CLIP_IDS) if (!CLIPS[id].loop) expect(CLIPS[id].seconds, id).toBeLessThanOrEqual(1.5);
});
test('all clips build fast at 48 kHz (spec 6b §5: < 500 ms on the dev Mac; CI runs ~4× slower)', () => {
  const t0 = performance.now();
  for (const id of CLIP_IDS) CLIPS[id].build(CLIP_SEED[id], 48000);
  expect(performance.now() - t0).toBeLessThan(2000);
});
test.each(['water', 'traffic'] as const)('%s has no deep rumble (speakers play it as random banging)', (id) => {
  const sr = 48000, x = CLIPS[id].build(CLIP_SEED[id], sr);
  const rms = (y: Float32Array) => Math.sqrt(y.reduce((a, v) => a + v * v, 0) / y.length);
  const all = rms(x), above = rms(highpass(x.slice(), 60, sr));
  expect(1 - (above * above) / (all * all)).toBeLessThan(0.1);
});
