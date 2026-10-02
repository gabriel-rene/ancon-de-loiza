// @vitest-environment jsdom
import { act } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { useStore } from '../state/store';
import { QUALITY_KEY } from '../state/qualityPrefs';
import { __dipForTests } from './dipController';
import { pickQuality } from './qualityPick';

beforeEach(() => { __dipForTests.reset(); window.history.replaceState(null, '', '/?era=1935&q=low'); act(() => useStore.setState({ quality: 'low', qualityMode: 'url', frozen: false, perf: false, debug: false })); });
afterEach(() => window.localStorage.clear());

test('a hand pick saves, drops ?q, turns auto off and asks for the tier', () => {
  pickQuality('high');
  expect(window.localStorage.getItem(QUALITY_KEY)).toBe('high');
  expect(window.location.search).toBe('?era=1935');
  expect(useStore.getState().qualityMode).toBe('hand');
});
test('Auto saves auto and turns the governor back on (off under dev flags)', () => {
  pickQuality('auto');
  expect(window.localStorage.getItem(QUALITY_KEY)).toBe('auto');
  expect(useStore.getState().qualityMode).toBe('auto');
  act(() => useStore.setState({ frozen: true }));
  pickQuality('auto');
  expect(useStore.getState().qualityMode).toBe('off');
});
