import { ERA_IDS, type EraId } from '../data/eras';
import type { Quality } from '../quality';

export type CameraPreset = 'ride' | 'bank' | 'aerial' | 'mouth';
export const CAMERA_PRESETS: CameraPreset[] = ['ride', 'bank', 'aerial', 'mouth'];
export interface UrlState { eraId: EraId; timeOfDay: number; camera: CameraPreset; quality: Quality; debug: boolean; frozen: boolean }

export function parseUrlState(search: string): Partial<UrlState> {
  const p = new URLSearchParams(search);
  const out: Partial<UrlState> = {};
  const era = p.get('era');
  if (era && (ERA_IDS as string[]).includes(era)) out.eraId = era as EraId;
  const t = Number(p.get('t'));
  if (p.has('t') && Number.isFinite(t) && t >= 0 && t <= 24) out.timeOfDay = t;
  const cam = p.get('cam');
  if (cam && (CAMERA_PRESETS as string[]).includes(cam)) out.camera = cam as CameraPreset;
  const q = p.get('q');
  if (q === 'high' || q === 'medium' || q === 'low') out.quality = q;
  if (p.get('debug') === '1') out.debug = true;
  if (p.get('freeze') === '1') out.frozen = true;
  return out;
}

export function toSearch(s: Partial<UrlState>): string {
  const p = new URLSearchParams();
  if (s.eraId) p.set('era', s.eraId);
  if (s.timeOfDay !== undefined) p.set('t', String(s.timeOfDay));
  if (s.camera) p.set('cam', s.camera);
  if (s.quality) p.set('q', s.quality);
  if (s.debug) p.set('debug', '1');
  if (s.frozen) p.set('freeze', '1');
  return `?${p.toString()}`;
}
