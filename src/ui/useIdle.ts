import { useEffect } from 'react';
import { prefersReducedMotion } from './motion';

/** Stillness (ms) before the controls step back. */
export const IDLE_MS = 7000;
const WAKE = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'focusin'] as const;

/**
 * Sets body[data-idle] after IDLE_MS without mouse or keyboard input, and clears it on the next input: the placards fade
 * so the scene stands alone, and return on approach (styles.css). Mouse devices only: on touch a hidden button could
 * take the tap that was meant to wake it. Off with reduced motion.
 */
export function useIdle() {
  useEffect(() => {
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches || prefersReducedMotion()) return;
    let id = 0;
    const wake = () => {
      if (document.body.dataset.idle) delete document.body.dataset.idle;
      window.clearTimeout(id);
      id = window.setTimeout(() => { document.body.dataset.idle = '1'; }, IDLE_MS);
    };
    wake();
    for (const e of WAKE) window.addEventListener(e, wake, { passive: true });
    return () => { window.clearTimeout(id); for (const e of WAKE) window.removeEventListener(e, wake); delete document.body.dataset.idle; };
  }, []);
}
