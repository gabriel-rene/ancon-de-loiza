import type { KeyboardEvent, ReactNode } from 'react';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { lookKey } from '../scene/lookKeys';
import { useEra, useStore } from '../state/store';

/**
 * Focusable frame round the 3D scene (spec 7b §2.1, §2.3): screen readers hear the scene, the era and the keys.
 * A plain group, not role="application", so screen-reader keys keep working.
 */
export function SceneFrame({ children }: { children: ReactNode }) {
  const t = useT();
  const era = useEra();
  const onKeyDown = (e: KeyboardEvent) => {
    const s = lookKey(e);
    if (!s) return;
    e.preventDefault();   // the era keys skip handled presses (Timeline checks defaultPrevented)
    useStore.getState().look(s);
  };
  return (
    <div className="scene" data-scene="" role="group" tabIndex={0} onKeyDown={onKeyDown}
      aria-label={`${t(STRINGS.sceneLabel)}, ${era.id}. ${t(STRINGS.sceneKeys)}`}>
      {children}
    </div>
  );
}
