/** Spec 6b §3: the visitor's sound choice survives a reload. Any storage failure means "off". */
export const SOUND_KEY = 'ancon.sound';

export function loadSoundPref(): boolean {
  try { return typeof window !== 'undefined' && window.localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; }
}
export function saveSoundPref(on: boolean) {
  try { if (typeof window !== 'undefined') window.localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* private mode: not remembered */ }
}
