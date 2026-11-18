import { useCallback, useEffect, useRef, useState } from 'react';
import { STRINGS } from '../i18n/strings';
import { withLang, type Lang } from '../i18n/text';
import { useT } from '../i18n/useT';
import { unlockAudio } from '../sound/unlock';
import { useStore } from '../state/store';
import { InfoPanel } from './InfoPanel';
import { QualityMenu } from './QualityMenu';
import { ViewSwitch } from './ViewSwitch';

/** Language names stay in their own language, whatever the current one. */
const LANG_BUTTONS: { lang: Lang; short: string; name: string }[] = [
  { lang: 'es', short: 'ES', name: 'Español' },
  { lang: 'en', short: 'EN', name: 'English' },
];

/** Speaker glyph (16 px, currentColor); a slash when sound is off, sound waves when on. */
function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg className="toolbar__icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor" />
      {on ? <path className="toolbar__icon-wave" d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.3 3.7a6 6 0 0 1 0 8.6" />
        : <path className="toolbar__icon-mute" d="M10.5 6l4 4M14.5 6l-4 4" />}
    </svg>
  );
}

/** The placards: language, sound and quality top right; Facts (owns the panel's open state, spec 3b §5.1) and the views bottom right. */
export function Toolbar() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const soundOn = useStore((s) => s.soundOn);
  const [open, setOpen] = useState(false);
  const factsBtn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(false); factsBtn.current?.focus(); }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);
  // Spec 7b §2.5: without the scene, the facts are the page; open them once.
  const sceneFailed = useStore((s) => s.sceneFailed);
  useEffect(() => { if (sceneFailed) setOpen(true); }, [sceneFailed]);
  const chooseLang = (l: Lang) => {
    if (l === useStore.getState().lang) return;
    useStore.getState().setLang(l);
    window.history.replaceState(null, '', withLang(window.location.search, l));
  };
  return (
    <>
      <div className="toolbar">
        <div className="toolbar__util">
          <div className="toolbar__lang" role="group" aria-label={t(STRINGS.language)}>
            {LANG_BUTTONS.map((b) => (
              <button key={b.lang} type="button" lang={b.lang} className="toolbar__btn toolbar__btn--lang"
                aria-pressed={lang === b.lang} aria-label={b.name} onClick={() => chooseLang(b.lang)}>
                {b.short}
              </button>
            ))}
          </div>
          <button type="button" className="toolbar__btn" aria-pressed={soundOn}
            onClick={() => { if (!soundOn) unlockAudio(); useStore.getState().setSound(!soundOn); }}>
            <SpeakerIcon on={soundOn} />
            <span className="toolbar__label--wide">{t(STRINGS.sound)}</span>
          </button>
          <QualityMenu />
        </div>
        <div className="toolbar__actions">
          <button ref={factsBtn} type="button" className="toolbar__btn toolbar__btn--primary" aria-expanded={open}
            aria-controls={open ? 'info-panel' : undefined} onClick={() => (open ? close() : setOpen(true))}>
            {t(STRINGS.facts)}
          </button>
          <ViewSwitch />
        </div>
      </div>
      {open && <InfoPanel onClose={close} />}
    </>
  );
}
