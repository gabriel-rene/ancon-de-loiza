import type { MouseEvent } from 'react';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';

/** Focuses the timeline button of the chosen era. */
export function focusSelectedEra() {
  document.querySelector<HTMLButtonElement>('.timeline__btn[aria-current="true"]')?.focus();
}

/** First stop in the tab order (spec 7b §2.3); visible only while focused. */
export function SkipLink() {
  const t = useT();
  const onClick = (e: MouseEvent) => { e.preventDefault(); focusSelectedEra(); };
  return <a className="skip-link" href="#timeline" onClick={onClick}>{t(STRINGS.skipToTimeline)}</a>;
}
