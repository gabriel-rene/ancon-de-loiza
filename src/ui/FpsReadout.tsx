import { useEffect, useRef } from 'react';
import { QUALITY_NAMES } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { useStore } from '../state/store';

/** Frame intervals (ms) sorted into buckets: on time at 60 Hz, one missed vsync (30 Hz), slower. */
export function bucketShares(intervals: number[]): { f60: number; f30: number; slow: number } {
  if (!intervals.length) return { f60: 0, f30: 0, slow: 0 };
  let f60 = 0, f30 = 0;
  for (const d of intervals) { if (d <= 20) f60++; else if (d <= 40) f30++; }
  const n = intervals.length;
  return { f60: Math.round((f60 / n) * 100), f30: Math.round((f30 / n) * 100), slow: Math.round(((n - f60 - f30) / n) * 100) };
}

/**
 * Wraps requestAnimationFrame so every callback's run time adds to `busy` (ms): the scene's JS plus its WebGL calls.
 * ?fps=1 only (spec 7a §5): tells a CPU-bound frame (busy ≈ interval) from a GPU-bound or capped one (busy small).
 */
function timeRafCallbacks() {
  const orig = window.requestAnimationFrame;
  const acc = { busy: 0 };
  window.requestAnimationFrame = (cb) => orig.call(window, (t) => {
    const s = performance.now();
    try { cb(t); } finally { acc.busy += performance.now() - s; }
  });
  return { acc, restore: () => { window.requestAnimationFrame = orig; } };
}

/** ?fps=1 (spec 7a §5): fps and tier, plus frame-time evidence for checks on a phone. No Leva, no StatsGl. */
export function FpsReadout() {
  const on = useStore((s) => s.fps);
  const quality = useStore((s) => s.quality);
  const mode = useStore((s) => s.qualityMode);
  const t = useT();
  const num = useRef<HTMLSpanElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!on) return;
    const timing = timeRafCallbacks();
    let raf = 0, frames = 0, since = performance.now(), last = since;
    const intervals: number[] = [];
    const loop = (now: number) => {
      frames++;
      intervals.push(now - last); last = now;
      if (now - since >= 1000) {
        const span = now - since;
        if (num.current) num.current.textContent = String(Math.round((frames * 1000) / span));
        const b = bucketShares(intervals);
        const c = document.querySelector('canvas');
        if (detail.current) {
          detail.current.textContent = `js ${(timing.acc.busy / frames).toFixed(1)} ms/frame · 60:${b.f60}% 30:${b.f30}% slow:${b.slow}%`
            + ` · ${c ? `${c.width}×${c.height}` : '–'} dpr ${window.devicePixelRatio}`;
        }
        timing.acc.busy = 0; frames = 0; since = now; intervals.length = 0;
      }
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); timing.restore(); };
  }, [on]);
  if (!on) return null;
  return (
    <div className="fps-readout" data-testid="fps-readout">
      <div><span ref={num}>–</span> fps · {t(QUALITY_NAMES[quality])} ({mode})</div>
      <div ref={detail} />
    </div>
  );
}
