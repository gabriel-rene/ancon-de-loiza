// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useStore } from '../state/store';
import { __dipForTests, requestEra } from './dipController';
import { EraDipOverlay } from './EraDip';

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  window.history.replaceState(null, '', '/?era=1975');
  act(() => { useStore.getState().setLang('en'); useStore.getState().setEra('1975'); });
  __dipForTests.reset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); __dipForTests.reset(); });

const year = () => document.querySelector('.era-dip__year')?.textContent;

test('idle: no year on the field; a request shows four fixed cells and the target era\'s name', async () => {
  render(<EraDipOverlay />);
  expect(year()).toBeUndefined();
  act(() => { requestEra('1984'); });
  expect(document.querySelectorAll('.era-dip__year > span')).toHaveLength(4);
  expect(document.querySelector('.era-dip__label')!.textContent).toBe('The steel barge');
  expect(Number(year())).toBeGreaterThanOrEqual(1975);          // starts at the era on screen
  await act(async () => { await new Promise((r) => setTimeout(r, 700)); });
  expect(year()).toBe('1984');                                  // and lands on the target
});
