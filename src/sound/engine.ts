import * as THREE from 'three';
import { CLIP_IDS, CLIP_SEED, CLIPS, type ClipId } from './clips';

export interface Engine { listener: THREE.AudioListener; ctx: AudioContext; buffers: Record<ClipId, AudioBuffer>; buildMs: number }
let engine: Engine | null = null, active = false;

/** One listener and one set of buffers per page; clips are built the first time sound turns on (spec 6b §4.4). */
export function getEngine(): Engine {
  if (engine) return engine;
  const listener = new THREE.AudioListener(), ctx = listener.context, t0 = performance.now();
  const buffers = {} as Record<ClipId, AudioBuffer>;
  for (const id of CLIP_IDS) {
    const data = CLIPS[id].build(CLIP_SEED[id], ctx.sampleRate), b = ctx.createBuffer(1, data.length, ctx.sampleRate);
    b.copyToChannel(data, 0);
    buffers[id] = b;
  }
  engine = { listener, ctx, buffers, buildMs: performance.now() - t0 };
  document.addEventListener('visibilitychange', applyState);
  return engine;
}
function applyState() {
  if (!engine) return;
  if (active && !document.hidden) void engine.ctx.resume(); else void engine.ctx.suspend();
}
/** Sound on screen (Sound mounted) or not; a hidden tab always suspends (spec 6b §3). */
export function setSoundActive(on: boolean) { active = on; applyState(); }
