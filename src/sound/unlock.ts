import { AudioContext as SharedContext } from 'three';

let unlocked = false;
/**
 * Browsers start audio only inside a user gesture. Call this synchronously from a click or key handler:
 * it creates three's shared AudioContext (the one AudioListener will use) and resumes it. No-op without Web Audio.
 */
export function unlockAudio() {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return;
  const ctx = SharedContext.getContext() as unknown as { state: string; resume(): Promise<void> };
  if (ctx.state !== 'running') void ctx.resume();
  unlocked = true;
}
/** True once a gesture has unlocked audio in this page load. */
export const audioUnlocked = () => unlocked;
