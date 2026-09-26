import { useEra } from '../state/store';

export function TitleCard() {
  const era = useEra();
  return (
    <div className="title-card">
      <div className="title-card__kicker">El Ancón de Loíza</div>
      <div className="title-card__era">{era.years} · {era.label}</div>
    </div>
  );
}
