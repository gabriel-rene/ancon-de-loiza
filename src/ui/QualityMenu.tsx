import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { QUALITY_NAMES, STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';
import type { QualityChoice } from '../quality';
import { useStore } from '../state/store';
import { menuLeft } from './menuPlacement';
import { pickQuality } from './qualityPick';

const CHOICES: QualityChoice[] = ['auto', 'high', 'medium', 'low'];

/** Toolbar quality button and menu (spec 7a §3): Auto, High, Medium, Low. */
export function QualityMenu() {
  const t = useT();
  const quality = useStore((s) => s.quality);
  const mode = useStore((s) => s.qualityMode);
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const current: QualityChoice = mode === 'auto' ? 'auto' : quality;
  const name = (c: QualityChoice) => (c === 'auto' ? t(STRINGS.auto) : t(QUALITY_NAMES[c]));
  const label = mode === 'auto' ? `${t(STRINGS.auto)} · ${t(QUALITY_NAMES[quality])}` : t(QUALITY_NAMES[quality]);
  const close = () => { setOpen(false); btn.current?.focus(); };
  useLayoutEffect(() => {   // keep the menu on screen at any width (spec 7a §3)
    const b = btn.current, m = menu.current;
    if (open && b && m) m.style.left = `${menuLeft(b.getBoundingClientRect().left, m.getBoundingClientRect().width, window.innerWidth)}px`;
  }, [open]);
  useEffect(() => { if (open) items.current[CHOICES.indexOf(current)]?.focus(); }, [open]);   // eslint-disable-line react-hooks/exhaustive-deps -- focus once on open
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!(e.target as Element).closest('.quality')) setOpen(false); };
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, [open]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = CHOICES.length;
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1
      : e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowUp' ? (i - 1 + n) % n : -1;
    if (to >= 0) { e.preventDefault(); items.current[to]?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  };
  // Spec 7b §2.4: Tab out closes the menu. A null relatedTarget (a tap that focuses nothing) is left to the pointerdown check.
  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const to = e.relatedTarget;
    if (open && to instanceof Node && !e.currentTarget.contains(to)) setOpen(false);
  };
  return (
    <div className="quality" onBlur={onBlur}>
      <button ref={btn} type="button" className="toolbar__btn" aria-haspopup="menu" aria-expanded={open}
        aria-label={`${t(STRINGS.quality)}: ${label}`} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div ref={menu} className="quality__menu" role="menu" aria-label={t(STRINGS.quality)}>
          {CHOICES.map((c, i) => (
            <button key={c} ref={(el) => { items.current[i] = el; }} type="button" role="menuitemradio" aria-checked={c === current}
              className="quality__item" onKeyDown={(e) => onKey(e, i)} onClick={() => { pickQuality(c); close(); }}>
              {name(c)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
