import { useEffect, useRef } from 'react';
import { FACTS } from '../data/facts';
import { SOURCES } from '../data/sources';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { useEra } from '../state/store';

/** Sourced facts for the current era (spec 3b §5). Non-modal: the scene stays live beside it. */
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
        <h2 id="info-panel-title" ref={heading} tabIndex={-1}>{era.id} · {t(era.years)} · {t(era.label)}</h2>
        <button type="button" className="info-panel__close" onClick={onClose}>{t(STRINGS.close)}</button>
      </header>
      <ol className="info-panel__facts">
        {facts.map((f, i) => (
          <li key={`${era.id}-${i}`} className="info-panel__fact">
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
    </section>
  );
}
