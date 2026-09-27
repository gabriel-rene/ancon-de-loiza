import { create } from 'zustand';
import { DEFAULT_CROSSING_START } from '../ancon/crossing';
import { getEra, type EraId } from '../data/eras';
import { goldenHourAST } from '../geo/sun';
import { detectQuality, type Quality } from '../quality';
import { detectLang, type Lang } from '../i18n/text';
import { parseUrlState, type CameraPreset, type DebugView } from './url';

interface AppState {
  eraId: EraId; timeOfDay: number; camera: CameraPreset; quality: Quality; debug: boolean; frozen: boolean;
  debugView: DebugView | undefined;
  crossingStart: number; crossingSpeed: number; showAncon: boolean; perf: boolean; lang: Lang;
  setEra: (id: EraId) => void; setTime: (t: number) => void; setCamera: (c: CameraPreset) => void; setQuality: (q: Quality) => void;
  setCrossingSpeed: (v: number) => void; setLang: (l: Lang) => void;
}

const fromUrl = typeof window !== 'undefined' ? parseUrlState(window.location.search) : {};
const DEFAULT_ERA: EraId = '1975';

/** Without ?t, open at the start of golden hour for the era's calendar date (seasonal, not a fixed clock time). */
export const defaultTime = (eraId: EraId) => goldenHourAST(getEra(eraId).date);

/** Carries a clock time across an era switch relative to each era's own golden hour, clamped to the day. */
export const shiftTime = (t: number, from: EraId, to: EraId) => Math.min(24, Math.max(0, defaultTime(to) + (t - defaultTime(from))));

export const useStore = create<AppState>((set) => ({
  eraId: DEFAULT_ERA, timeOfDay: defaultTime(fromUrl.eraId ?? DEFAULT_ERA), camera: 'ride', quality: detectQuality(), debug: false, frozen: false, debugView: undefined,
  crossingStart: DEFAULT_CROSSING_START, crossingSpeed: 1, showAncon: true, perf: false, lang: detectLang(typeof navigator !== 'undefined' ? navigator.language : undefined),
  ...fromUrl,
  setEra: (eraId) => set((s) => ({ eraId, timeOfDay: shiftTime(s.timeOfDay, s.eraId, eraId) })),
  setTime: (timeOfDay) => set({ timeOfDay }),
  setCamera: (camera) => set({ camera }),
  setQuality: (quality) => set({ quality }),
  setCrossingSpeed: (crossingSpeed) => set({ crossingSpeed }),
  setLang: (lang) => set({ lang }),
}));

export const useEra = () => getEra(useStore((s) => s.eraId));
