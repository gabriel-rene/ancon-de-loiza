import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { audioUnlocked, unlockAudio } from './unlock';

/** The sound chunk (spec 6b §4): downloaded only the first time sound is on and a gesture has unlocked audio. */
const Sound = lazy(() => import('./Sound'));

/** Mounted inside <Canvas>. Remembered "on" waits for the first click or key anywhere (browser unlock rule). */
export function SoundGate() {
  const on = useStore((s) => s.soundOn);
  const [, bump] = useState(0);
  useEffect(() => {
    if (!on || audioUnlocked()) return;
    const go = () => { unlockAudio(); bump((n) => n + 1); };
    window.addEventListener('pointerdown', go);
    window.addEventListener('keydown', go);
    return () => { window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go); };
  }, [on]);
  if (!on || !audioUnlocked()) return null;
  return <Suspense fallback={null}><Sound /></Suspense>;
}
