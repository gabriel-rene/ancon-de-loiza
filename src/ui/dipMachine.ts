import type { EraId } from '../data/eras';

/** Dip timings (spec 6a §3.1): fade out and in (s), longest wait for the new era's frames (s), frames to wait for. */
export const DIP = { out: 0.3, in: 0.3, holdCap: 1, frames: 2 };
export type DipPhase = 'idle' | 'out' | 'hold' | 'in';

/**
 * Dip-and-swap between eras (spec 6a §3): fade an overlay out, swap the era at full opacity, wait until the
 * new era has rendered DIP.frames frames (at most DIP.holdCap s), fade back in. Pure: the caller drives
 * tick(dt) and frameRendered(), and paints `opacity`.
 */
export class EraDip {
  phase: DipPhase = 'idle';
  opacity = 0;
  /** The era being faded to (shown on the overlay); null when idle. */
  target: EraId | null = null;
  private held = 0;
  private frames = 0;

  constructor(private readonly apply: (id: EraId) => void) {}

  /** A choice of `id` while `current` is the era on screen; `reduced`: swap at once, no overlay. */
  choose(id: EraId, current: EraId, reduced: boolean) {
    if (reduced) {
      this.phase = 'idle'; this.opacity = 0; this.target = null;
      if (id !== current) this.apply(id);
      return;
    }
    if (this.phase === 'idle') {
      if (id === current) return;
      this.target = id; this.phase = 'out';
      return;
    }
    if ((this.phase === 'hold' || this.phase === 'in') && id === current) return;   // already on screen
    this.target = id;
    if (this.phase === 'hold' || this.phase === 'in') this.phase = 'out';           // back to opaque from here
  }

  tick(dt: number) {
    if (this.phase === 'out') {
      this.opacity = Math.min(1, this.opacity + dt / DIP.out);
      if (this.opacity >= 1) { this.apply(this.target!); this.phase = 'hold'; this.held = 0; this.frames = 0; }
    } else if (this.phase === 'hold') {
      this.held += dt;
      if (this.frames >= DIP.frames || this.held >= DIP.holdCap) this.phase = 'in';
    } else if (this.phase === 'in') {
      this.opacity = Math.max(0, this.opacity - dt / DIP.in);
      if (this.opacity <= 0) { this.phase = 'idle'; this.target = null; }
    }
  }

  /** The 3D scene rendered a frame (counts only while holding after a swap). */
  frameRendered() { if (this.phase === 'hold') this.frames++; }
}
