import { useEffect, useRef } from 'react';
import { QUALITY_NAMES } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { useStore } from '../state/store';

/** ?fps=1 (spec 7a §5): a small fps number plus the tier, for checks on a phone. No Leva, no StatsGl. */
export function FpsReadout() {
  const on = useStore((s) => s.fps);
  const quality = useStore((s) => s.quality);
  const mode = useStore((s) => s.qualityMode);
  const t = useT();
  const num = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!on) return;
    let raf = 0, frames = 0, since = performance.now();
    const loop = (now: number) => {
      frames++;
      if (now - since >= 500) { if (num.current) num.current.textContent = String(Math.round((frames * 1000) / (now - since))); frames = 0; since = now; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  if (!on) return null;
  return <div className="fps-readout" data-testid="fps-readout"><span ref={num}>–</span> fps · {t(QUALITY_NAMES[quality])} ({mode})</div>;
}
