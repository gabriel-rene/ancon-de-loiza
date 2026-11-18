// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useStore } from '../state/store';
import { DragHint, HINT } from './DragHint';

const hint = () => document.querySelector('.drag-hint');
beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  delete document.body.dataset.ready;
  act(() => useStore.setState({ lang: 'en', offFront: false, sceneFailed: false }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

test('waits for the scene, then shows once, hidden from screen readers', () => {
  render(<DragHint />);
  act(() => { vi.advanceTimersByTime(HINT.delay * 3); });
  expect(hint()).toBeNull();                                   // no scene yet: no hint
  document.body.dataset.ready = '1';
  act(() => { vi.advanceTimersByTime(HINT.delay + 400); });
  expect(hint()!.textContent).toBe('Drag to look around');
  expect(hint()!.getAttribute('aria-hidden')).toBe('true');
  act(() => { vi.advanceTimersByTime(HINT.stay); });
  expect(hint()!.className).toContain('drag-hint--out');
  act(() => { vi.advanceTimersByTime(HINT.fade); });
  expect(hint()).toBeNull();
  cleanup();
  render(<DragHint />);                                        // same visit: not again
  act(() => { vi.advanceTimersByTime(HINT.delay + 800); });
  expect(hint()).toBeNull();
});
test('the first turn of the view sends it away', () => {
  document.body.dataset.ready = '1';
  render(<DragHint />);
  act(() => { vi.advanceTimersByTime(HINT.delay + 400); });
  expect(hint()).not.toBeNull();
  act(() => useStore.getState().setOffFront(true));
  expect(hint()!.className).toContain('drag-hint--out');
  act(() => { vi.advanceTimersByTime(HINT.fade); });
  expect(hint()).toBeNull();
  expect(window.sessionStorage.getItem('ancon.hint')).toBe('1');
});
test('a visitor who turns before it shows never sees it', () => {
  document.body.dataset.ready = '1';
  render(<DragHint />);
  act(() => useStore.getState().setOffFront(true));
  act(() => { vi.advanceTimersByTime(HINT.delay * 2); });
  expect(hint()).toBeNull();
});
