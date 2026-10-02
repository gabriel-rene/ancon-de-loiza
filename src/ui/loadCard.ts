import { prefersReducedMotion } from './motion';

/** Load card progress (spec 7a §4): real steps only. 'ready' is body[data-ready], set by ReadySignal. */
export function setLoadStep(s: 'code' | 'scene') { document.body.dataset.load = s; }

/** Fades the card out (0.6 s) and removes it; at once with reduced motion. Safe to call twice. `onGone` runs right after removal (at once if there is no card). */
export function dismissLoadCard(reduced = prefersReducedMotion(), onGone?: () => void) {
  const el = document.getElementById('load-card');
  if (!el) { onGone?.(); return; }
  if (reduced) { el.remove(); onGone?.(); return; }
  el.classList.add('load-card--out');
  window.setTimeout(() => { el.remove(); onGone?.(); }, 700);
}
