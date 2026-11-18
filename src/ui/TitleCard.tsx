import type { CSSProperties } from 'react';
import { useEra } from '../state/store';
import { useT } from '../i18n/useT';
import { STRINGS } from '../i18n/strings';

/** The era on screen, bottom left: the year in fixed digit cells (a digit changes in place), its name and its span. */
export function TitleCard() {
  const era = useEra();
  const t = useT();
  return (
    <>
      <div className="title-card">
        <h2 className="title-card__era">
          {/* Keyed by era: the cells rise again each time the year changes (styles.css, cell-up). */}
          <span key={era.id} className="title-card__year" aria-hidden="true">
            {[...era.id].map((d, i) => <span key={i} className="title-card__cell" style={{ '--i': i } as CSSProperties}><span>{d}</span></span>)}
          </span>
          <span className="sr-only">{era.id} · </span>
          <span className="title-card__words">
            <span className="title-card__label">{t(era.label)}</span>
            {t(era.years) !== era.id && <span className="title-card__span">{t(era.years)}</span>}
          </span>
        </h2>
      </div>
      {/* ODbL 1.0 attribution for the OpenStreetMap-derived geography (src/data/geo/README.md). */}
      <div className="osm-credit">
        {t(STRINGS.mapData)} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{t(STRINGS.osmContributors)}</a>
      </div>
    </>
  );
}
