/** Spec 6b §5: at most 12 voices. Beds = water (no wind, user 2026-10-01); traffic = one per bridge lane; engines = nearest ferry cars. */
export const VOICES = { beds: 1, traffic: 2, engines: 3, shots: 5 } as const;

/** Fixed slots for one-shots. A free slot is one whose sound has ended; when none is free, the one ending soonest is reused. */
export class VoicePool {
  private readonly ends: Float64Array;
  constructor(readonly size: number) { this.ends = new Float64Array(size).fill(-Infinity); }
  acquire(now: number, dur: number): number {
    let best = 0;
    for (let i = 0; i < this.size; i++) {
      if (this.ends[i] <= now) { best = i; break; }
      if (this.ends[i] < this.ends[best]) best = i;
    }
    this.ends[best] = now + dur;
    return best;
  }
  active(now: number): number {
    let n = 0;
    for (let i = 0; i < this.size; i++) if (this.ends[i] > now) n++;
    return n;
  }
}
