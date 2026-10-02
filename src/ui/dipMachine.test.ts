import { expect, test } from 'vitest';
import type { EraId } from '../data/eras';
import { DIP, EraDip } from './dipMachine';

function rig() {
  const applied: EraId[] = [];
  const dip = new EraDip((id) => applied.push(id));
  /** Runs `seconds` of 60 fps ticks, rendering a frame after each tick. */
  const run = (seconds: number, frames = true) => { for (let i = 0; i < Math.round(seconds * 60); i++) { dip.tick(1 / 60); if (frames) dip.frameRendered(); } };
  return { dip, applied, run };
}

test('full dip: fade out 0.3 s, swap once at full opacity, wait for frames, fade in 0.3 s', () => {
  const { dip, applied, run } = rig();
  dip.choose('1984', '1975', false);
  expect(dip.phase).toBe('out'); expect(dip.target).toBe('1984');
  run(0.15);
  expect(dip.opacity).toBeCloseTo(0.5, 1); expect(applied).toEqual([]);
  run(0.16);
  expect(applied).toEqual(['1984']); expect(dip.opacity).toBe(1);
  run(0.1);
  expect(dip.phase).toBe('in');
  run(0.4);
  expect(dip.phase).toBe('idle'); expect(dip.opacity).toBe(0); expect(dip.target).toBeNull();
  expect(applied).toEqual(['1984']);
});
test('choosing the current era while idle does nothing', () => {
  const { dip } = rig();
  dip.choose('1975', '1975', false);
  expect(dip.phase).toBe('idle');
});
test('a second choice during fade out changes the target, not the timing', () => {
  const { dip, applied, run } = rig();
  dip.choose('1984', '1975', false); run(0.1);
  dip.choose('1840', '1975', false);
  expect(dip.phase).toBe('out');
  run(0.25);
  expect(applied).toEqual(['1840']);
});
test('a second choice while fading in goes back to opaque from where it is, then swaps', () => {
  const { dip, applied, run } = rig();
  dip.choose('1984', '1975', false); run(0.35); run(0.05);   // swapped, fading in
  expect(dip.phase).toBe('in');
  const o = dip.opacity;
  dip.choose('1900', '1984', false);
  expect(dip.phase).toBe('out'); expect(dip.opacity).toBe(o);
  run(0.3);
  expect(applied).toEqual(['1984', '1900']);
});
test('a choice of the era already on screen during hold or fade in is ignored', () => {
  const { dip, applied, run } = rig();
  dip.choose('1984', '1975', false); run(0.31, false);
  expect(dip.phase).toBe('hold');
  dip.choose('1984', '1984', false);
  expect(dip.phase).toBe('hold');
  expect(applied).toEqual(['1984']);
});
test('hold waits for rendered frames, capped at 1 s', () => {
  const { dip, run } = rig();
  dip.choose('1984', '1975', false); run(0.31, false);
  expect(dip.phase).toBe('hold');
  run(DIP.holdCap - 0.05, false);
  expect(dip.phase).toBe('hold');
  run(0.1, false);
  expect(dip.phase).toBe('in');
});
test('frames rendered before the swap do not count', () => {
  const { dip, run } = rig();
  dip.choose('1984', '1975', false);
  for (let i = 0; i < 10; i++) dip.frameRendered();
  run(0.31, false);
  expect(dip.phase).toBe('hold');
  dip.frameRendered(); dip.tick(1 / 60);
  expect(dip.phase).toBe('hold');
  dip.frameRendered(); dip.tick(1 / 60);
  expect(dip.phase).toBe('in');
});
test('reduced motion: instant swap, no overlay', () => {
  const { dip, applied } = rig();
  dip.choose('1984', '1975', true);
  expect(applied).toEqual(['1984']); expect(dip.phase).toBe('idle'); expect(dip.opacity).toBe(0);
});
test('refresh dips on the era already on screen and swaps once at the bottom', () => {
  const { dip, applied, run } = rig();
  dip.refresh('1975', false);
  expect(dip.phase).toBe('out'); expect(dip.target).toBe('1975');
  run(0.31);
  expect(applied).toEqual(['1975']);
  run(0.5);
  expect(dip.phase).toBe('idle');
});
test('refresh during a fade out rides along with the era change', () => {
  const { dip, applied, run } = rig();
  dip.choose('1984', '1975', false); run(0.1);
  dip.refresh('1975', false);
  expect(dip.target).toBe('1984');
  run(0.25);
  expect(applied).toEqual(['1984']);
});
test('refresh while fading in goes back to opaque and swaps again', () => {
  const { dip, applied, run } = rig();
  dip.choose('1984', '1975', false); run(0.35); run(0.05);
  expect(dip.phase).toBe('in');
  dip.refresh('1984', false);
  expect(dip.phase).toBe('out');
  run(0.3);
  expect(applied).toEqual(['1984', '1984']);
});
test('refresh with reduced motion swaps at once', () => {
  const { dip, applied } = rig();
  dip.refresh('1975', true);
  expect(applied).toEqual(['1975']); expect(dip.phase).toBe('idle');
});
