import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ERAS } from '../data/eras';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { useStore } from '../state/store';
import { pendingEra, requestEra, useDip } from './dipController';
import { prefersReducedMotion } from './motion';
import { isTypingTarget, stepEra } from './picker';
import { layoutLabels, nearestIndex, yearFrac } from './timelineLayout';

const FRACS = ERAS.map((e) => yearFrac(Number(e.id)));
/** Label row height (px): row 1 sits this far below row 0. */
const ROW_H = 48;

/** True-scale timeline, 1820–1986 (spec 6a §2): dots at real years, spread labels, a draggable knob. */
export function Timeline() {
  const t = useT();
  const eraId = useStore((s) => s.eraId);
  const target = useDip((s) => s.target);
  const chosen = target ?? eraId;
  const scroll = useRef<HTMLDivElement>(null), track = useRef<HTMLDivElement>(null);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const [width, setWidth] = useState(0);
  const [widths, setWidths] = useState<number[]>(() => ERAS.map(() => 0));
  const [dragX, setDragX] = useState<number | null>(null);

  // Measure the track and the labels (re-measure on resize and language change).
  const lang = useStore((s) => s.lang);
  useLayoutEffect(() => {
    const measure = () => {
      setWidth(track.current?.clientWidth ?? 0);
      setWidths(btns.current.map((b) => b?.offsetWidth ?? 0));
    };
    measure();
    if (typeof ResizeObserver === 'undefined' || !track.current) return;
    const ro = new ResizeObserver(measure);
    ro.observe(track.current);
    return () => ro.disconnect();
  }, [lang]);

  const xs = FRACS.map((f) => f * width);
  const slots = layoutLabels(xs, widths, width);
  const twoRows = slots.some((s) => s.row === 1);
  const ci = ERAS.findIndex((e) => e.id === chosen);
  const dragIndex = dragX === null ? -1 : nearestIndex(dragX, xs);

  // Arrow keys step from the era last chosen (so two quick presses move two eras, even mid-dip).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || isTypingTarget(e.target)) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (requestEra(stepEra(pendingEra(), e.key === 'ArrowLeft' ? -1 : 1))) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Phones: keep the chosen mark centred in the scrolling strip.
  useEffect(() => {
    const s = scroll.current;
    if (!s || s.scrollWidth <= s.clientWidth || !width) return;
    s.scrollTo?.({ left: xs[ci] - s.clientWidth / 2, behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
  }, [ci, width]);   // eslint-disable-line react-hooks/exhaustive-deps -- xs follows width

  const xFrom = useCallback((clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.min(r.width, Math.max(0, clientX - r.left));
  }, []);
  const onKnobDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragX(xFrom(e.clientX));
  };
  const onKnobMove = (e: ReactPointerEvent<HTMLDivElement>) => { if (dragX !== null) setDragX(xFrom(e.clientX)); };
  const onKnobUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragX === null) return;
    requestEra(ERAS[nearestIndex(xFrom(e.clientX), xs)].id);
    setDragX(null);
  };

  const knobX = dragX ?? xs[ci];
  return (
    <nav className={`timeline${twoRows ? ' timeline--two-rows' : ''}`} aria-label={t(STRINGS.chooseEra)}>
      <div ref={scroll} className="timeline__scroll">
        <div ref={track} className="timeline__track">
          <div className="timeline__line" />
          <svg className="timeline__leaders" aria-hidden="true" width={width} height={twoRows ? 2 * ROW_H : ROW_H}>
            {ERAS.map((e, i) => (
              <g key={e.id}>
                <circle className="timeline__dot" cx={xs[i]} cy={2} r={i === ci ? 4 : 3} />
                <line x1={xs[i]} y1={5} x2={slots[i].left + widths[i] / 2} y2={10 + slots[i].row * ROW_H} />
              </g>
            ))}
          </svg>
          {ERAS.map((e, i) => {
            const name = `${e.id} · ${t(e.years)} · ${t(e.label)}`;
            const measured = widths[i] > 0;
            return (
              <button key={e.id} ref={(b) => { btns.current[i] = b; }} type="button"
                className={`timeline__btn${i === dragIndex ? ' timeline__btn--target' : ''}`}
                style={{ left: measured ? slots[i].left : `${FRACS[i] * 100}%`, top: 10 + slots[i].row * ROW_H,
                  transform: measured ? undefined : 'translateX(-50%)' }}
                aria-current={e.id === chosen ? 'true' : undefined} aria-label={name} title={name}
                onClick={() => requestEra(e.id)}>
                <span className="timeline__year">{e.id}</span>
                <span className="timeline__label">{t(e.label)}</span>
              </button>
            );
          })}
          <div className="timeline__knob" aria-hidden="true" style={{ left: width ? knobX : `${FRACS[ci] * 100}%` }}
            onPointerDown={onKnobDown} onPointerMove={onKnobMove} onPointerUp={onKnobUp} onPointerCancel={() => setDragX(null)}
            onLostPointerCapture={() => setDragX(null)} />
        </div>
      </div>
    </nav>
  );
}
