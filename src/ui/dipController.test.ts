// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useStore } from '../state/store';
import { pendingEra, requestEra, requestQuality, useDip, __dipForTests } from './dipController';

let now = 0;
const frames: FrameRequestCallback[] = [];
beforeEach(() => {
  now = 0; frames.length = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  window.history.replaceState(null, '', '/?era=1975&cam=ride');
  useStore.getState().setEra('1975');
  __dipForTests.reset();
});
afterEach(() => vi.unstubAllGlobals());
/** Runs queued animation frames for `seconds` at 60 fps, with the 3D scene rendering each frame. */
const step = (seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const cb = frames.shift(); if (!cb) return;
    now += 1000 / 60; cb(now); __dipForTests.frameRendered();
  }
};

test('requestEra updates the URL at once and the era after the fade out', () => {
  expect(requestEra('1984')).toBe(true);
  expect(window.location.search).toContain('era=1984');
  expect(useStore.getState().eraId).toBe('1975');
  expect(useDip.getState().target).toBe('1984');
  expect(pendingEra()).toBe('1984');
  step(0.4);
  expect(useStore.getState().eraId).toBe('1984');
  step(0.5);
  expect(useDip.getState().target).toBeNull();
  expect(frames).toHaveLength(0);                 // the loop stops when idle
});
test('requesting the pending era again is a no-op', () => {
  requestEra('1984');
  expect(requestEra('1984')).toBe(false);
});
test('reduced motion swaps at once', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  requestEra('1840');
  expect(useStore.getState().eraId).toBe('1840');
  expect(frames).toHaveLength(0);
});
test('requestQuality swaps the tier at the bottom of a dip and keeps the era', () => {
  useStore.getState().setQuality('high');
  expect(requestQuality('medium')).toBe(true);
  expect(useStore.getState().quality).toBe('high');      // not yet: fading out
  step(0.35);
  expect(useStore.getState().quality).toBe('medium');
  expect(useStore.getState().eraId).toBe('1975');
  expect(requestQuality('medium')).toBe(false);           // nothing to do
});
test('an era change and a tier step asked together run in one dip', () => {
  useStore.getState().setQuality('high');
  requestEra('1984');
  requestQuality('low');
  step(0.35);
  expect(useStore.getState().eraId).toBe('1984');
  expect(useStore.getState().quality).toBe('low');
});
