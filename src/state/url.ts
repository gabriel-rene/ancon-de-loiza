import { ERA_IDS, type EraId } from '../data/eras';
import type { Quality } from '../quality';

export type CameraPreset = 'ride' | 'bank' | 'aerial' | 'mouth';
export const CAMERA_PRESETS: CameraPreset[] = ['ride', 'bank', 'aerial', 'mouth'];
export type DebugView = 'water';
export const DEBUG_VIEWS: DebugView[] = ['water'];
export interface UrlState {
  eraId: EraId; timeOfDay: number; camera: CameraPreset; quality: Quality; debug: boolean; frozen: boolean;
  debugView: DebugView | undefined;
  crossingStart: number; showAncon: boolean;
}

export function parseUrlState(search: string): Partial<UrlState> {
  const p = new URLSearchParams(search);
  const out: Partial<UrlState> = {};
  const era = p.get('era');
  if (era && (ERA_IDS as string[]).includes(era)) out.eraId = era as EraId;
  /** A numeric param, or undefined when absent or blank (`?c=` must not mean 0). */
  const num = (k: string) => { const v = p.get(k)?.trim(); return v ? Number(v) : undefined; };
  const t = num('t');
  if (t !== undefined && Number.isFinite(t) && t >= 0 && t <= 24) out.timeOfDay = t;
  const cam = p.get('cam');
  if (cam && (CAMERA_PRESETS as string[]).includes(cam)) out.camera = cam as CameraPreset;
  const q = p.get('q');
  if (q === 'high' || q === 'medium' || q === 'low') out.quality = q;
  if (p.get('debug') === '1') out.debug = true;
  if (p.get('freeze') === '1') out.frozen = true;
  const view = p.get('view');
  if (view && (DEBUG_VIEWS as string[]).includes(view)) out.debugView = view as DebugView;
  const c = num('c');
  if (c !== undefined && Number.isFinite(c) && c >= 0 && c < 1e6) out.crossingStart = c;
  if (p.get('ancon') === '0') out.showAncon = false;
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
  if (s.debugView) p.set('view', s.debugView);
  if (s.crossingStart !== undefined) p.set('c', String(s.crossingStart));
  if (s.showAncon === false) p.set('ancon', '0');
  return `?${p.toString()}`;
}
