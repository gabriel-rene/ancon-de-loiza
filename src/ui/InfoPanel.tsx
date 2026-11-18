import { useEffect, useRef, type CSSProperties } from 'react';
import { FACTS } from '../data/facts';
import { SOURCES } from '../data/sources';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { useEra } from '../state/store';

const RESEARCH_URL = 'https://github.com/gabriel-rene/ancon-de-loiza/blob/main/docs/research/ancon-research.md';

/** Sourced facts for the current era (spec 3b §5), on the cream board. Non-modal: the scene stays live beside it. */
export function InfoPanel({ onClose }: { onClose: () => void }) {
  const era = useEra();
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  // Focus the heading once, on open; an era change while open keeps focus where it is.
  useEffect(() => { heading.current?.focus(); }, []);
  const facts = FACTS[era.id];
  return (
    <section id="info-panel" className="info-panel" role="dialog" aria-modal="false" aria-labelledby="info-panel-title">
      <header className="info-panel__head">
        <h2 id="info-panel-title" ref={heading} tabIndex={-1}>
          <span className="info-panel__year">{era.id}</span>
          <span className="sr-only"> · {t(era.years)} · </span>
          <span className="info-panel__label">{t(era.label)}</span>
        </h2>
        <button type="button" className="info-panel__close" aria-label={t(STRINGS.close)} onClick={onClose}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </header>
      {/* Keyed by era: the rows come in again when the era changes under an open board. */}
      <div key={era.id} className="info-panel__body">
        {t(era.years) !== era.id && <p className="info-panel__span" aria-hidden="true">{t(era.years)}</p>}
        <ol className="info-panel__facts">
          {facts.map((f, i) => (
            <li key={i} className="info-panel__fact" style={{ '--i': i } as CSSProperties}>
              <p className="info-panel__text">{t(f.text)}</p>
              <p className="info-panel__meta">
                {f.inferred && <span className="info-panel__inferred">{t(STRINGS.inferred)}</span>}
                <span>{t(STRINGS.sources)}: </span>
                {f.sources.map((id, j) => (
                  <span key={id}>{j > 0 && ' · '}<a href={SOURCES[id].url} target="_blank" rel="noreferrer">{SOURCES[id].title}</a></span>
                ))}
              </p>
            </li>
          ))}
        </ol>
        {facts.some((f) => f.inferred) && <p className="info-panel__note">{t(STRINGS.inferredNote)}</p>}
        <p className="info-panel__thanks">
          <a href={RESEARCH_URL} target="_blank" rel="noreferrer">{t(STRINGS.research)}</a>
        </p>
      </div>
    </section>
  );
}
