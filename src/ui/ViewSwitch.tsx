import { useEffect } from 'react';
import { STRINGS, VIEW_NAMES } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { VIEW_KEYS } from '../scene/views';
import { useStore } from '../state/store';
import { PUBLIC_VIEWS, type PublicView } from '../state/url';
import { isTypingTarget, withCam } from './picker';

/** Switches to `v` and keeps ?cam in the URL in sync (spec 6a §4.2). */
export function chooseView(v: PublicView) {
  const st = useStore.getState();
  if (st.camera === v) return;
  st.setCamera(v);
  window.history.replaceState(null, '', withCam(window.location.search, v));
}

/** Ride / Shore / Sky buttons, keys 1/2/3, and Recenter (button while off-front, key R). */
export function ViewSwitch() {
  const t = useT();
  const camera = useStore((s) => s.camera);
  const offFront = useStore((s) => s.offFront);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || isTypingTarget(e.target)) return;
      const v = Object.hasOwn(VIEW_KEYS, e.key) ? VIEW_KEYS[e.key] : undefined;
      if (v) { chooseView(v); e.preventDefault(); }
      else if (e.key === 'r' || e.key === 'R') { useStore.getState().recenter(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <div className="toolbar__group" role="group" aria-label={t(STRINGS.view)}>
        {PUBLIC_VIEWS.map((v, i) => (
          <button key={v} type="button" className="toolbar__btn toolbar__btn--seg" aria-pressed={camera === v}
            aria-keyshortcuts={String(i + 1)} onClick={() => chooseView(v)}>
            {t(VIEW_NAMES[v])}
          </button>
        ))}
      </div>
      {offFront && (
        <button type="button" className="toolbar__btn" aria-keyshortcuts="R" onClick={() => useStore.getState().recenter()}>
          {t(STRINGS.recenter)}
        </button>
      )}
    </>
  );
}
