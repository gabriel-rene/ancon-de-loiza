import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { getEra } from '../data/eras';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { useStore } from '../state/store';
import { eraDip, useDip } from './dipController';

/** Full-screen sepia haze with the big year (spec 6a §3.1). HTML over the canvas: no draw calls. */
export function EraDipOverlay() {
  const el = useRef<HTMLDivElement>(null);
  const t = useT();
  const target = useDip((s) => s.target);
  useEffect(() => eraDip.attach((o) => {
    const d = el.current;
    if (!d) return;
    d.style.opacity = String(o);
    d.style.visibility = o > 0 ? 'visible' : 'hidden';
  }), []);
  const era = target ? getEra(target) : null;
  return (
    <div ref={el} className="era-dip" aria-hidden="true" style={{ opacity: 0, visibility: 'hidden' }}>
      {era && (<><div className="era-dip__year">{era.id}</div><div className="era-dip__label">{t(era.label)}</div></>)}
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
