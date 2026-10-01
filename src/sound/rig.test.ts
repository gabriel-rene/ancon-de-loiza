import * as THREE from 'three';
import { expect, test } from 'vitest';
import { CLIP_IDS, type ClipId } from './clips';
import type { Engine } from './engine';
import { SoundRig } from './rig';

/** Minimal fake Web Audio graph: records which nodes are wired to which. */
class Node {
  links = new Set<Node>();
  buffer: unknown = null; loop = false; loopStart = 0; loopEnd = 0; onended: unknown = null;
  playbackRate = { value: 1, setValueAtTime() {}, setTargetAtTime() {} }; detune = { value: 0, setValueAtTime() {}, setTargetAtTime() {} };
  start() {} stop() {}
  gain = { value: 1, setTargetAtTime() {}, setValueAtTime() {} };
  connect(n: Node) { this.links.add(n); return n; }
  disconnect(n?: Node) {
    // Like Chrome: disconnecting a destination that is not connected throws.
    if (n) { if (!this.links.delete(n)) throw new DOMException('the given destination is not connected', 'InvalidAccessError'); } else this.links.clear();
  }
}
function fake() {
  const input = new Node();
  const ctx = { currentTime: 0, state: 'running', createGain: () => new Node(), createPanner: () => new Node(), createBufferSource: () => new Node() };
  const listener = { context: ctx, getInput: () => input } as unknown as THREE.AudioListener;
  const buffers = {} as Record<ClipId, AudioBuffer>;
  for (const id of CLIP_IDS) buffers[id] = { duration: 1 } as AudioBuffer;
  return { input, eng: { listener, ctx, buffers, buildMs: 0 } as unknown as Engine };
}
const gains = (rig: SoundRig) => (rig as unknown as { all(): THREE.Audio<AudioNode>[] }).all().map((a) => a.gain as unknown as Node);

test('start -> stop -> start (StrictMode) leaves every gain wired to the listener', () => {
  const { input, eng } = fake(), rig = new SoundRig(eng);
  const g = gains(rig);
  expect(g.every((n) => n.links.has(input))).toBe(true);
  rig.start(); rig.stop();
  expect(g.some((n) => n.links.has(input))).toBe(false);
  rig.start();
  expect(g.every((n) => n.links.has(input))).toBe(true);
  expect(() => rig.stop()).not.toThrow(); expect(() => rig.stop()).not.toThrow();
  expect(g.some((n) => n.links.has(input))).toBe(false);
});
