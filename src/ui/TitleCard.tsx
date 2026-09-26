import { useEra } from '../state/store';

export function TitleCard() {
  const era = useEra();
  return (
    <>
      <div className="title-card">
        <div className="title-card__kicker">El Ancón de Loíza</div>
        <div className="title-card__era">{era.years} · {era.label}</div>
      </div>
      {/* ODbL 1.0 attribution for the OpenStreetMap-derived geography (src/data/geo/README.md). */}
      <div className="osm-credit">
        Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
      </div>
    </>
  );
}
