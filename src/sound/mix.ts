import type { CameraPreset, PublicView } from '../state/url';
import { isPublicView } from '../state/url';

/** Peak gain per sound (spec 6b §2: cars stay quiet and far-sounding). */
export const GAIN = { call: 0.35, flap: 0.5, pole: 0.6, creak: 0.5, knock: 0.8, engine: 0.3, traffic: 0.25 } as const;
const WATER: Record<PublicView, number> = { ride: 0.7, shore: 0.45, sky: 0.15 };
const WIND: Record<PublicView, number> = { ride: 0.12, shore: 0.15, sky: 0.25 };

export interface MixInput { view: CameraPreset; sunElevation: number; dip: number; bridgeOpen: boolean }
export interface Levels { master: number; water: number; wind: number; birdRate: number; traffic: number }
export const createLevels = (): Levels => ({ master: 0, water: 0, wind: 0, birdRate: 0, traffic: 0 });

/** Spec 6b §2–3. Pure; writes into and returns `out`. */
export function mixLevels(i: MixInput, out: Levels): Levels {
  const v: PublicView = isPublicView(i.view) ? i.view : 'shore';
  out.master = Math.min(1, Math.max(0, 1 - i.dip));
  out.water = WATER[v];
  out.wind = WIND[v];
  out.birdRate = i.sunElevation >= 0 ? 1 : i.sunElevation <= -6 ? 0.2 : 1 + (0.8 * i.sunElevation) / 6;
  out.traffic = i.bridgeOpen ? GAIN.traffic : 0;
  return out;
}
