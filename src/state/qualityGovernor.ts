import type { Quality } from '../quality';

/** Governor timings and floors (spec 7a §2.3): seconds and frames per second. */
export const GOV = { settle: 2, first: 4, firstFps: 40, window: 10, watchFps: 30 };
type Stage = 'settle' | 'first' | 'watch' | 'pending' | 'done';

/**
 * Auto quality (spec 7a §2.3). Pure: the caller feeds tick(dt, frames, paused) every frame and calls reset(tier)
 * when a new tier is on screen or the era changed. 'down' is said once; then it waits in 'pending' for reset().
 * It never asks to go up; on low it is 'done'.
 */
export class QualityGovernor {
  stage: Stage = 'settle';
  private passedFirst = false;
  private t = 0;
  private frames = 0;

  constructor(tier: Quality) { this.reset(tier); }

  reset(tier: Quality) { this.passedFirst = false; this.enter(tier === 'low' ? 'done' : 'settle'); }

  private enter(s: Stage) { this.stage = s; this.t = 0; this.frames = 0; }

  tick(dt: number, frames: number, paused: boolean): 'stay' | 'down' {
    if (this.stage === 'done' || this.stage === 'pending') return 'stay';
    if (paused) { this.enter('settle'); return 'stay'; }
    this.t += dt; this.frames += frames;
    if (this.stage === 'settle') {
      if (this.t >= GOV.settle) this.enter(this.passedFirst ? 'watch' : 'first');
      return 'stay';
    }
    const first = this.stage === 'first';
    if (this.t < (first ? GOV.first : GOV.window)) return 'stay';
    if (this.frames / this.t < (first ? GOV.firstFps : GOV.watchFps)) { this.enter('pending'); return 'down'; }
    this.passedFirst = true; this.enter('watch');
    return 'stay';
  }
}
