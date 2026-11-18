import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { getEra, type EraId } from '../data/eras';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { useStore } from '../state/store';
import { eraDip, useDip } from './dipController';

/** Counting time (ms) from the old year to the new one: done before the field opens again (DIP.out + the swap). */
const COUNT_MS = 380;

/** The year shown on the field: it counts through the years between the era on screen and the target, easing out. */
function useCountedYear(target: EraId | null): number | null {
  const [shown, setShown] = useState<number | null>(null);
  const at = useRef<number>(Number(useStore.getState().eraId));
  useEffect(() => {
    if (!target) { at.current = Number(useStore.getState().eraId); return; }
    const to = Number(target), from = at.current;
    if (from === to || typeof requestAnimationFrame === 'undefined') { at.current = to; setShown(to); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = () => {
      const k = Math.min(1, Math.max(0, (performance.now() - t0) / COUNT_MS));   // own clock: rAF's timestamp may have another origin
      const y = Math.round(from + (to - from) * (1 - (1 - k) ** 3));
      at.current = y; setShown(y);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    setShown(from);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return target ? shown : null;
}

/** Full-screen green field with the big year (spec 6a §3.1). HTML over the canvas: no draw calls. */
export function EraDipOverlay() {
  const el = useRef<HTMLDivElement>(null);
  const t = useT();
  const target = useDip((s) => s.target);
  const year = useCountedYear(target);
  useEffect(() => eraDip.attach((o) => {
    const d = el.current;
    if (!d) return;
    // Two green leaves: the field grows from the horizon line until it covers the scene, then opens the same way.
    const k = o * o * (3 - 2 * o);
    d.style.opacity = o > 0 ? '1' : '0';
    d.style.clipPath = o >= 1 ? 'none' : `inset(${((1 - k) * 50).toFixed(2)}% 0)`;
    d.style.visibility = o > 0 ? 'visible' : 'hidden';
  }), []);
  const era = target ? getEra(target) : null;
  return (
    <div ref={el} className="era-dip" aria-hidden="true" style={{ opacity: 0, visibility: 'hidden' }}>
      {era && (<>
        {/* Fixed cells: each digit changes in place. */}
        <div className="era-dip__year">{[...String(year ?? era.id)].map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="era-dip__label">{t(era.label)}</div>
      </>)}
    </div>
  );
}

/** Mount inside <Canvas>: tells the dip each time the scene renders a frame. */
export function DipFrameSignal() {
  useFrame(() => eraDip.frameRendered());
  return null;
}

/** Screen readers hear the new era once, after the swap (spec 6a §3.2). */
export function EraAnnouncer() {
  const t = useT();
  const eraId = useStore((s) => s.eraId);
  const [text, setText] = useState('');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const e = getEra(eraId);
    setText(`${t(STRINGS.nowShowing)} ${e.id} · ${t(e.label)}`);
  }, [eraId]);   // eslint-disable-line react-hooks/exhaustive-deps -- language changes must not re-announce
  return <div className="sr-only" aria-live="polite">{text}</div>;
}
