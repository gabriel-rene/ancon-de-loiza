// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { loadSoundPref, saveSoundPref, SOUND_KEY } from './prefs';

afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

test('off when nothing is stored; round-trips on and off', () => {
  expect(loadSoundPref()).toBe(false);
  saveSoundPref(true);
  expect(window.localStorage.getItem(SOUND_KEY)).toBe('1');
  expect(loadSoundPref()).toBe(true);
  saveSoundPref(false);
  expect(loadSoundPref()).toBe(false);
});
test('a throwing localStorage means off, and saving does not throw', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(loadSoundPref()).toBe(false);
  expect(() => saveSoundPref(true)).not.toThrow();
});
