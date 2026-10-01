import { AudioContext as SharedContext } from 'three';

let unlocked = false;
const listeners = new Set<() => void>();
const markUnlocked = () => { if (unlocked) return; unlocked = true; listeners.forEach((f) => f()); };

/**
 * Browsers start audio only inside a user activation (iOS: touchend/click, not touchstart/pointerdown). Call this
 * synchronously from a gesture handler: it creates three's shared AudioContext (the one AudioListener will use) and
 * resumes it. Audio counts as unlocked only once the context is actually 'running'. No-op without Web Audio.
 */
export function unlockAudio() {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return;
  const ctx = SharedContext.getContext() as unknown as { state: string; resume(): Promise<void> };
  if (ctx.state === 'running') { markUnlocked(); return; }
  void ctx.resume().then(() => { if (ctx.state === 'running') markUnlocked(); }, () => {});
}
/** True once a gesture has started the shared context in this page load. */
export const audioUnlocked = () => unlocked;
/** Calls `f` once audio becomes unlocked; returns an unsubscribe. */
export function onAudioUnlocked(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }
