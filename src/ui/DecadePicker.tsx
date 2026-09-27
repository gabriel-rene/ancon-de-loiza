import { useCallback, useEffect } from 'react';
import { ERAS, type EraId } from '../data/eras';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { useStore } from '../state/store';
import { isTypingTarget, stepEra, withEra } from './picker';

/** Minimal era rail (spec §13): 8 buttons, ← → keys, URL kept in sync, instant switch. */
export function DecadePicker() {
  const eraId = useStore((s) => s.eraId);
  const t = useT();
  /** Switches to `id`; false when it is already the era (nothing to do). */
  const choose = useCallback((id: EraId) => {
    const st = useStore.getState();
    if (id === st.eraId) return false;
    st.setEra(id);
    window.history.replaceState(null, '', withEra(window.location.search, id, useStore.getState().timeOfDay));
    return true;
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || isTypingTarget(e.target)) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      // At either end of the rail the key does nothing here: leave it to the page (no preventDefault).
      if (choose(stepEra(useStore.getState().eraId, e.key === 'ArrowLeft' ? -1 : 1))) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose]);
  return (
    <nav className="decade-rail" aria-label={t(STRINGS.chooseEra)}>
      {ERAS.map((e) => {
        const name = `${e.id} · ${t(e.years)} · ${t(e.label)}`;
        return (
          <button key={e.id} type="button" className="decade-rail__btn" aria-current={e.id === eraId ? 'true' : undefined}
            aria-label={name} title={name} onClick={() => choose(e.id)}>
            <span className="decade-rail__year">{e.id}</span>
            <span className="decade-rail__label">{t(e.label)}</span>
          </button>
        );
      })}
    </nav>
  );
}
