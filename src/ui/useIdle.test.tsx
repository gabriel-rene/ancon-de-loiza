// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { IDLE_MS, useIdle } from './useIdle';

function Probe() { useIdle(); return null; }
const media = (fine: boolean, reduced: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') ? reduced : fine }));
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

test('mouse devices: idle after IDLE_MS of stillness, awake again on any input', () => {
  media(true, false);
  render(<Probe />);
  vi.advanceTimersByTime(IDLE_MS - 1);
  expect(document.body.dataset.idle).toBeUndefined();
  vi.advanceTimersByTime(1);
  expect(document.body.dataset.idle).toBe('1');
  window.dispatchEvent(new Event('pointermove'));
  expect(document.body.dataset.idle).toBeUndefined();
  vi.advanceTimersByTime(IDLE_MS - 1);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
  vi.advanceTimersByTime(IDLE_MS - 1);
  expect(document.body.dataset.idle).toBeUndefined();
});
test('never idle on touch devices or with reduced motion', () => {
  for (const [fine, reduced] of [[false, false], [true, true]] as const) {
    media(fine, reduced);
    render(<Probe />);
    vi.advanceTimersByTime(IDLE_MS * 2);
    expect(document.body.dataset.idle).toBeUndefined();
    cleanup();
  }
});
