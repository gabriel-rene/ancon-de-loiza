import { prefersReducedMotion } from './motion';

/** Load card progress (spec 7a §4): real steps only. 'ready' is body[data-ready], set by ReadySignal. */
export function setLoadStep(s: 'code' | 'scene') { document.body.dataset.load = s; }

/** Fades the card out (0.6 s) and removes it; at once with reduced motion. Safe to call twice. */
export function dismissLoadCard(reduced = prefersReducedMotion()) {
  const el = document.getElementById('load-card');
  if (!el) return;
  if (reduced) { el.remove(); return; }
  el.classList.add('load-card--out');
  window.setTimeout(() => el.remove(), 700);
}
