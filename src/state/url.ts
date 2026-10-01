import { ERA_IDS, type EraId } from '../data/eras';
import type { Quality } from '../quality';
import { LANGS, type Lang } from '../i18n/text';

export type PublicView = 'ride' | 'shore' | 'sky';
export type DevView = 'mouth' | 'fields' | 'farm' | 'station' | 'bridge' | 'town';
export type CameraPreset = PublicView | DevView;
/** The three views a visitor can pick (spec 6a §4.1). */
export const PUBLIC_VIEWS: PublicView[] = ['ride', 'shore', 'sky'];
/** Dev views: only with ?debug=1 or ?freeze=1 (spec 6a §4.1). */
export const DEV_VIEWS: DevView[] = ['mouth', 'fields', 'farm', 'station', 'bridge', 'town'];
export const CAMERA_PRESETS: CameraPreset[] = [...PUBLIC_VIEWS, ...DEV_VIEWS];
/** Phase 6a renamed two views; old links still load. */
export const VIEW_ALIASES: Readonly<Record<string, PublicView>> = { bank: 'shore', aerial: 'sky' };
export const isPublicView = (c: CameraPreset): c is PublicView => (PUBLIC_VIEWS as string[]).includes(c);
export type DebugView = 'water';
export const DEBUG_VIEWS: DebugView[] = ['water'];
export interface UrlState {
  eraId: EraId; timeOfDay: number; camera: CameraPreset; quality: Quality; debug: boolean; frozen: boolean;
  debugView: DebugView | undefined;
  crossingStart: number; showAncon: boolean;
  /** ?perf=1: record frame times for scripts/dev/perf.mjs. */
  perf: boolean;
  /** ?lang=es|en: UI language. */
  lang?: Lang;
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
  const named = cam !== null && Object.hasOwn(VIEW_ALIASES, cam) ? VIEW_ALIASES[cam] : cam;
  const devOk = p.get('debug') === '1' || p.get('freeze') === '1';
  if (named && (PUBLIC_VIEWS as string[]).includes(named)) out.camera = named as CameraPreset;
  else if (named && devOk && (DEV_VIEWS as string[]).includes(named)) out.camera = named as CameraPreset;
  const q = p.get('q');
  if (q === 'high' || q === 'medium' || q === 'low') out.quality = q;
  if (p.get('debug') === '1') out.debug = true;
  if (p.get('freeze') === '1') out.frozen = true;
  const view = p.get('view');
  if (view && (DEBUG_VIEWS as string[]).includes(view)) out.debugView = view as DebugView;
  const c = num('c');
  if (c !== undefined && Number.isFinite(c) && c >= 0 && c < 1e6) out.crossingStart = c;
  if (p.get('ancon') === '0') out.showAncon = false;
  if (p.get('perf') === '1') out.perf = true;
  const lang = p.get('lang');
  if (lang && (LANGS as string[]).includes(lang)) out.lang = lang as Lang;
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
  if (s.perf) p.set('perf', '1');
  if (s.lang) p.set('lang', s.lang);
  return `?${p.toString()}`;
}

/** `search` with `cam` rewritten to what parseUrlState loads (alias → new name; a rejected view dropped); null when nothing changes. */
export function canonicalSearch(search: string): string | null {
  const p = new URLSearchParams(search), cam = p.get('cam');
  if (cam === null) return null;
  const loaded = parseUrlState(search).camera;
  if (loaded === cam) return null;
  if (loaded) p.set('cam', loaded); else p.delete('cam');
  return `?${p.toString()}`;
}
