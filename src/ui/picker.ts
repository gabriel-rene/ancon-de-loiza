import { ERA_IDS, type EraId } from '../data/eras';

/** Steps one era forward/back, clamped at both ends (no wrap). */
export function stepEra(id: EraId, delta: -1 | 1): EraId {
  const i = ERA_IDS.indexOf(id);
  return ERA_IDS[Math.min(ERA_IDS.length - 1, Math.max(0, i + delta))];
}

/** New search string for `id`: other params survive; a pinned ?t follows the era's golden-hour shift. */
export function withEra(search: string, id: EraId, timeOfDay?: number): string {
  const p = new URLSearchParams(search);
  p.set('era', id);
  if (timeOfDay !== undefined && p.has('t')) p.set('t', timeOfDay.toFixed(2));
  return `?${p.toString()}`;
}

/** True when `t` is an element that would eat an arrow-key press as text input. */
export function isTypingTarget(t: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
}

/** New search string with `cam` set; other params survive. */
export function withCam(search: string, cam: string): string {
  const p = new URLSearchParams(search);
  p.set('cam', cam);
  return `?${p.toString()}`;
}
