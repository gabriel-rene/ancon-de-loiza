import type { QualityChoice } from '../quality';

/** Spec 7a §3: the quality button's choice survives a reload. Any storage failure means Auto. */
export const QUALITY_KEY = 'ancon.quality';
const CHOICES: QualityChoice[] = ['auto', 'high', 'medium', 'low'];

export function loadQualityPref(): QualityChoice {
  try {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem(QUALITY_KEY) : null;
    return CHOICES.includes(v as QualityChoice) ? (v as QualityChoice) : 'auto';
  } catch { return 'auto'; }
}
export function saveQualityPref(c: QualityChoice) {
  try { if (typeof window !== 'undefined') window.localStorage.setItem(QUALITY_KEY, c); } catch { /* private mode: not remembered */ }
}
/** The search string without ?q (a hand pick replaces it, spec 7a §3); '' when nothing is left. */
export function withoutQ(search: string): string {
  const p = new URLSearchParams(search);
  p.delete('q');
  const s = p.toString();
  return s ? `?${s}` : '';
}
