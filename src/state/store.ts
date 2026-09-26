import { create } from 'zustand';
import { getEra, type EraId } from '../data/eras';
import { detectQuality, type Quality } from '../quality';
import { parseUrlState, type CameraPreset } from './url';

interface AppState {
  eraId: EraId; timeOfDay: number; camera: CameraPreset; quality: Quality; debug: boolean; frozen: boolean;
  setEra: (id: EraId) => void; setTime: (t: number) => void; setCamera: (c: CameraPreset) => void; setQuality: (q: Quality) => void;
}

const fromUrl = typeof window !== 'undefined' ? parseUrlState(window.location.search) : {};

export const useStore = create<AppState>((set) => ({
  eraId: '1975', timeOfDay: 17.4, camera: 'ride', quality: detectQuality(), debug: false, frozen: false,
  ...fromUrl,
  setEra: (eraId) => set({ eraId }),
  setTime: (timeOfDay) => set({ timeOfDay }),
  setCamera: (camera) => set({ camera }),
  setQuality: (quality) => set({ quality }),
}));

export const useEra = () => getEra(useStore((s) => s.eraId));
