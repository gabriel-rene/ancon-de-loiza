// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { loadQualityPref, QUALITY_KEY, saveQualityPref, withoutQ } from './qualityPrefs';

afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

test('Auto when nothing or junk is stored; round-trips each choice', () => {
  expect(loadQualityPref()).toBe('auto');
  window.localStorage.setItem(QUALITY_KEY, 'ultra');
  expect(loadQualityPref()).toBe('auto');
  for (const c of ['high', 'medium', 'low', 'auto'] as const) { saveQualityPref(c); expect(loadQualityPref()).toBe(c); }
  expect(window.localStorage.getItem(QUALITY_KEY)).toBe('auto');
});
test('a throwing localStorage means Auto, and saving does not throw', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(loadQualityPref()).toBe('auto');
  expect(() => saveQualityPref('low')).not.toThrow();
});
test('withoutQ drops only q', () => {
  expect(withoutQ('?era=1935&q=low&lang=en')).toBe('?era=1935&lang=en');
  expect(withoutQ('?q=low')).toBe('');
});
