/** Exponential moving average of the ancón's per-frame CPU cost (pose + rigging + crew + wake), ms, and frames run. */
export const anconTiming = { cpuMs: 0, frames: 0, add(ms: number) { this.frames++; this.cpuMs = this.cpuMs * 0.95 + ms * 0.05; } };
declare global { interface Window { __ANCON_ANCON__?: typeof anconTiming } }
if (typeof window !== 'undefined') window.__ANCON_ANCON__ = anconTiming;
