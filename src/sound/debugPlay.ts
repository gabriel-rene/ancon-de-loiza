import { CLIP_IDS, type ClipId } from './clips';
import { getEngine } from './engine';

export { CLIP_IDS };
/** ?debug: play one clip alone, flat (not placed), at full volume, for the by-ear check (spec 6b §6). */
export function playClip(id: ClipId) {
  const { ctx, buffers } = getEngine();
  void ctx.resume();
  const src = ctx.createBufferSource();
  src.buffer = buffers[id];
  src.connect(ctx.destination);
  src.start();
}
