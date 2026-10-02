import type { ReactNode } from 'react';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { useEra } from '../state/store';

/**
 * Focusable frame round the 3D scene (spec 7b §2.1, §2.3): screen readers hear the scene, the era and the keys.
 * A plain group, not role="application", so screen-reader keys keep working.
 */
export function SceneFrame({ children }: { children: ReactNode }) {
  const t = useT();
  const era = useEra();
  return (
    <div className="scene" data-scene="" role="group" tabIndex={0}
      aria-label={`${t(STRINGS.sceneLabel)}, ${era.id}. ${t(STRINGS.sceneKeys)}`}>
      {children}
    </div>
  );
}
