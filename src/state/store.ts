import { create } from 'zustand';
import { getEra, type EraId } from '../data/eras';
import { goldenHourAST } from '../geo/sun';
import { detectQuality, resolveQuality, type Quality, type QualityMode } from '../quality';
import { detectLang, type Lang } from '../i18n/text';
import { loadSoundPref, saveSoundPref } from '../sound/prefs';
import { loadQualityPref } from './qualityPrefs';
import { parseUrlState, type CameraPreset, type DebugView } from './url';

interface AppState {
  eraId: EraId; timeOfDay: number; camera: CameraPreset; quality: Quality; debug: boolean; frozen: boolean;
  debugView: DebugView | undefined;
  crossingStart: number | null; crossingSpeed: number; showAncon: boolean; perf: boolean; lang: Lang;
  /** The visitor has turned or zoomed away from the view's front framing (shows Recenter). */
  offFront: boolean; setOffFront: (v: boolean) => void;
  /** Bumped by recenter(); Cameras glides back to the front framing on each bump. */
  recenterSeq: number; recenter: () => void;
  /** Spec 6b §3: off by default, remembered in localStorage. */
  soundOn: boolean; setSound: (on: boolean) => void;
  /** Spec 7a §2.2: who chose the tier; only 'auto' runs the governor. */
  qualityMode: QualityMode; setQualityMode: (m: QualityMode) => void;
  /** ?fps=1: on-screen fps readout (spec 7a §5). */
  fps: boolean;
  setEra: (id: EraId) => void; setTime: (t: number) => void; setCamera: (c: CameraPreset) => void; setQuality: (q: Quality) => void;
  setCrossingSpeed: (v: number) => void; setLang: (l: Lang) => void;
}

const fromUrl = typeof window !== 'undefined' ? parseUrlState(window.location.search) : {};
export const DEFAULT_ERA: EraId = '1975';

const startQuality = resolveQuality({
  url: fromUrl.quality, saved: loadQualityPref(), dev: !!(fromUrl.frozen || fromUrl.perf || fromUrl.debug), detected: detectQuality(),
});

/** Without ?t, open at the start of golden hour for the era's calendar date (seasonal, not a fixed clock time). */
export const defaultTime = (eraId: EraId) => goldenHourAST(getEra(eraId).date);

/** Carries a clock time across an era switch relative to each era's own golden hour, clamped to the day. */
export const shiftTime = (t: number, from: EraId, to: EraId) => Math.min(24, Math.max(0, defaultTime(to) + (t - defaultTime(from))));

export const useStore = create<AppState>((set) => ({
  eraId: DEFAULT_ERA, timeOfDay: defaultTime(fromUrl.eraId ?? DEFAULT_ERA), camera: 'ride', quality: startQuality.quality, qualityMode: startQuality.mode, fps: false, debug: false, frozen: false, debugView: undefined,
  crossingStart: null, crossingSpeed: 1, showAncon: true, perf: false, lang: detectLang(typeof navigator !== 'undefined' ? navigator.language : undefined),
  offFront: false, recenterSeq: 0, soundOn: loadSoundPref(),
  ...fromUrl,
  setEra: (eraId) => set((s) => ({ eraId, timeOfDay: shiftTime(s.timeOfDay, s.eraId, eraId) })),
  setTime: (timeOfDay) => set({ timeOfDay }),
  setCamera: (camera) => set({ camera, offFront: false }),
  setQuality: (quality) => set({ quality }),
  setQualityMode: (qualityMode) => set({ qualityMode }),
  setCrossingSpeed: (crossingSpeed) => set({ crossingSpeed }),
  setLang: (lang) => set({ lang }),
  setSound: (soundOn) => { saveSoundPref(soundOn); set({ soundOn }); },
  setOffFront: (offFront) => set((s) => (s.offFront === offFront ? s : { offFront })),
  recenter: () => set((s) => ({ recenterSeq: s.recenterSeq + 1 })),
}));

export const useEra = () => getEra(useStore((s) => s.eraId));
