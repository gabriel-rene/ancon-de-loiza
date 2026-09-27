import { useEra } from '../state/store';
import { useT } from '../i18n/useT';

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
        Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
      </div>
    </>
  );
}
