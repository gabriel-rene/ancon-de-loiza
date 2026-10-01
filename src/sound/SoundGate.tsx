import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { audioUnlocked, onAudioUnlocked, unlockAudio } from './unlock';

/** The sound chunk (spec 6b §4): downloaded only the first time sound is on and a gesture has unlocked audio. */
const Sound = lazy(() => import('./Sound'));
/** Touch browsers (iOS) grant activation on touchend/click, not pointerdown, so the gate listens to all of these. */
const GESTURES = ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown'] as const;

/** Mounted inside <Canvas>. Remembered "on" waits for a user gesture anywhere (browser unlock rule), until the context runs. */
export function SoundGate() {
  const on = useStore((s) => s.soundOn);
  const [, bump] = useState(0);
  useEffect(() => {
    if (!on) return;
    if (audioUnlocked()) { bump((n) => n + 1); return; }
    const off = () => { for (const g of GESTURES) window.removeEventListener(g, go); };
    const go = () => unlockAudio();
    for (const g of GESTURES) window.addEventListener(g, go);
    const un = onAudioUnlocked(() => { off(); bump((n) => n + 1); });
    return () => { off(); un(); };
  }, [on]);
  if (!on || !audioUnlocked()) return null;
  return <Suspense fallback={null}><Sound /></Suspense>;
}
