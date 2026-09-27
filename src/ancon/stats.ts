/**
 * Exponential moving average of the ancón's per-frame CPU cost (pose + rigging + crew + wake), ms, and
 * frames run. Exposed as `window.__ANCON_ANCON__` under `?perf=1` / `?debug=1`, like the other debug globals.
 */
export const anconTiming = { cpuMs: 0, frames: 0, add(ms: number) { this.frames++; this.cpuMs = this.cpuMs * 0.95 + ms * 0.05; } };
declare global { interface Window { __ANCON_ANCON__?: typeof anconTiming } }
if (typeof window !== 'undefined') {
  const p = new URLSearchParams(window.location.search);
  if (p.get('perf') === '1' || p.get('debug') === '1') window.__ANCON_ANCON__ = anconTiming;
}
