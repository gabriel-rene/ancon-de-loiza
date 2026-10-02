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
    // Spec 7b §2.2: the scene owns the arrows only when keyboard users Tab in; a click or drag must not focus it,
    // so mouse users keep the page's era keys. camera-controls uses pointer events, so dragging still works.
    <div className="scene" data-scene="" role="group" tabIndex={0} onKeyDown={onKeyDown} onMouseDown={(e) => e.preventDefault()}
      aria-label={`${t(STRINGS.sceneLabel)}, ${era.id}. ${t(STRINGS.sceneKeys)}`}>
      {children}
    </div>
  );
}
