import { create } from 'zustand';
import type { EraId } from '../data/eras';
import { shiftTime, useStore } from '../state/store';
import { EraDip } from './dipMachine';
import { prefersReducedMotion } from './motion';
import { withEra } from './picker';

/** The era the dip is heading to, for the timeline's highlight and the overlay text. */
export const useDip = create<{ target: EraId | null }>(() => ({ target: null }));

let machine = new EraDip((id) => useStore.getState().setEra(id));
let paint: ((opacity: number) => void) | null = null;
let raf = 0, last = 0;

function loop(now: number) {
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
  last = now;
  machine.tick(dt);
  paint?.(machine.opacity);
  if (machine.phase === 'idle') { raf = 0; last = 0; useDip.setState({ target: null }); return; }
  raf = requestAnimationFrame(loop);
}

/** The era the visitor last chose (the one on screen when no dip is running). */
export const pendingEra = (): EraId => machine.target ?? useStore.getState().eraId;

/** Every era change goes through here (spec 6a §3): URL now, era at the bottom of the dip. False if nothing to do. */
export function requestEra(id: EraId): boolean {
  if (id === pendingEra()) return false;
  const st = useStore.getState();
  window.history.replaceState(null, '', withEra(window.location.search, id, shiftTime(st.timeOfDay, st.eraId, id)));
  machine.choose(id, st.eraId, prefersReducedMotion());
  useDip.setState({ target: machine.target });
  if (machine.phase !== 'idle' && !raf) raf = requestAnimationFrame(loop);
  return true;
}

export const eraDip = {
  /** The overlay registers its painter; returns the unregister function. */
  attach(p: (opacity: number) => void) { paint = p; p(machine.opacity); return () => { if (paint === p) paint = null; }; },
  frameRendered: () => machine.frameRendered(),
  /** Current dip opacity 0..1 (sound follows it, spec 6b §3). */
  opacity: () => machine.opacity,
};

/** Test hooks (vitest only). */
export const __dipForTests = {
  reset() { machine = new EraDip((id) => useStore.getState().setEra(id)); raf = 0; last = 0; useDip.setState({ target: null }); },
  frameRendered: () => machine.frameRendered(),
};
