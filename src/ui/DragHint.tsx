import { useEffect, useState } from 'react';
import { STRINGS } from '../i18n/strings';
import { useT } from '../i18n/useT';
import { useStore } from '../state/store';

/** Delay before the hint shows, how long it stays, and its fade (ms). */
export const HINT = { delay: 3200, stay: 7000, fade: 400 };
const SEEN_KEY = 'ancon.hint';

function seen(): boolean { try { return window.sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } }
function markSeen() { try { window.sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode: show it again next time */ } }

/**
 * One gesture hint, once per visit: "Drag to look around". It leaves on the first turn of the view or after HINT.stay.
 * Hidden from screen readers: the scene's own label already names the keys (SceneFrame).
 */
export function DragHint() {
  const t = useT();
  const offFront = useStore((s) => s.offFront);
  const failed = useStore((s) => s.sceneFailed);
  const [phase, setPhase] = useState<'wait' | 'on' | 'out' | 'gone'>(() => (seen() ? 'gone' : 'wait'));
  useEffect(() => {
    if (phase === 'gone') return;
    if (phase === 'out') { const id = window.setTimeout(() => setPhase('gone'), HINT.fade); return () => window.clearTimeout(id); }
    if (offFront || failed) { markSeen(); setPhase(phase === 'on' ? 'out' : 'gone'); return; }
    if (phase === 'wait') {
      // The delay starts when the scene is on screen (body[data-ready], set by ReadySignal), not when the page mounts.
      let since = 0;
      const id = window.setInterval(() => {
        if (!document.body.dataset.ready) return;
        since += 400;
        if (since >= HINT.delay) setPhase('on');
      }, 400);
      return () => window.clearInterval(id);
    }
    const id = window.setTimeout(() => { markSeen(); setPhase('out'); }, HINT.stay);
    return () => window.clearTimeout(id);
  }, [phase, offFront, failed]);
  if (phase === 'wait' || phase === 'gone') return null;
  return (
    <div className={`drag-hint${phase === 'out' ? ' drag-hint--out' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 24 12" width="24" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        <path d="M2 6h20M6 2L2 6l4 4M18 2l4 4-4 4" />
      </svg>
      {t(STRINGS.dragHint)}
    </div>
  );
}
