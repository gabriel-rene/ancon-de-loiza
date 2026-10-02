// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useStore } from '../state/store';
import { __dipForTests } from './dipController';
import { SkipLink } from './SkipLink';
import { Timeline } from './Timeline';

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  window.history.replaceState(null, '', '/?era=1925');
  act(() => { useStore.getState().setLang('en'); useStore.getState().setEra('1925'); });
  __dipForTests.reset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('the skip link moves focus to the selected era button', () => {
  render(<><SkipLink /><Timeline /></>);
  const link = screen.getByRole('link', { name: 'Skip to timeline' });
  fireEvent.click(link);
  expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^1925 ·/);
});
