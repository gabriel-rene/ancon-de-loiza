import { useCallback, useEffect } from 'react';
import { ERAS, type EraId } from '../data/eras';
import { useStore } from '../state/store';
import { isTypingTarget, stepEra, withEra } from './picker';

/** Minimal era rail (spec §13): 8 buttons, ← → keys, URL kept in sync, instant switch. */
export function DecadePicker() {
  const eraId = useStore((s) => s.eraId);
  const choose = useCallback((id: EraId) => {
    const st = useStore.getState();
    if (id === st.eraId) return;
    st.setEra(id);
    window.history.replaceState(null, '', withEra(window.location.search, id, useStore.getState().timeOfDay));
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || isTypingTarget(e.target)) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      choose(stepEra(useStore.getState().eraId, e.key === 'ArrowLeft' ? -1 : 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose]);
  return (
    <nav className="decade-rail" aria-label="Choose an era">
      {ERAS.map((e) => (
        <button key={e.id} type="button" className="decade-rail__btn" aria-pressed={e.id === eraId}
          aria-label={`${e.years} · ${e.label}`} title={`${e.years} · ${e.label}`} onClick={() => choose(e.id)}>
          <span className="decade-rail__year">{e.id}</span>
          <span className="decade-rail__label">{e.label}</span>
        </button>
      ))}
    </nav>
  );
}
