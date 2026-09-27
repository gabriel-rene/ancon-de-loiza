import { useEra } from '../state/store';
import { useT } from '../i18n/useT';
import { STRINGS } from '../i18n/strings';

export function TitleCard() {
  const era = useEra();
  const t = useT();
  return (
    <>
      <div className="title-card">
        <div className="title-card__kicker">El Ancón de Loíza</div>
        <div className="title-card__era">{t(era.years)} · {t(era.label)}</div>
      </div>
      {/* ODbL 1.0 attribution for the OpenStreetMap-derived geography (src/data/geo/README.md). */}
      <div className="osm-credit">
        {t(STRINGS.mapData)} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{t(STRINGS.osmContributors)}</a>
      </div>
    </>
  );
}
