import type { CrossingPhase } from '../ancon/crossing';
import { HAUL_HZ, STROKE_S } from '../ancon/crew';
import type { Propulsion } from '../data/eras';
import { eventTime, u01 } from '../fauna/clock';
import type { ClipId } from './clips';
import { GAIN } from './mix';

export interface SoundEvent { clip: ClipId; source: 'ferry' | 'wader'; index: number; gain: number; rate: number }
export interface FerryFrame { clock: number; phase: CrossingPhase; tLeg: number; effort: number }
export interface FerrySpec { propulsion: Propulsion; crew: number; moored: boolean; load: number }

/** A step longer than this (s), or backwards, is a seek or an era reset: fire nothing. */
export const MAX_STEP = 0.5;
/** Crew effort at which haulers take the rope and polers work (crew.ts: hands on the rope at w ≥ 0.5 = effort ≥ 0.15). */
export const WORK_EFFORT = 0.15;
export const CALL = { period: 4, jitter: 1.5, seed: 4242 } as const;

const jumped = (a: number, b: number) => !(b > a) || b - a > MAX_STEP;
/** Playback rate 0.92–1.08 so repeats do not sound the same (spec 6b §1). */
const vary = (k: number, salt: number) => 1 + (u01(k, salt, 911) - 0.5) * 0.16;

/** Spec 6b §2: hull knock at docking; rope creak per haul (1935–1984); pole stroke per poler (1840–1925). */
export function ferryEvents(prev: FerryFrame, cur: FerryFrame, s: FerrySpec, out: SoundEvent[]): SoundEvent[] {
  if (s.moored || jumped(prev.clock, cur.clock)) return out;
  if (prev.phase !== 'dock' && cur.phase === 'dock') out.push({ clip: 'knock', source: 'ferry', index: 0, gain: GAIN.knock, rate: vary(Math.floor(cur.clock), 1) });
  if (cur.effort < WORK_EFFORT) return out;
  if (s.propulsion === 'ropes') {
    // Hauler 0 starts a pull when its phase (crew.ts hauler: clock · HAUL_HZ) passes a whole number.
    const a = Math.floor(prev.clock * HAUL_HZ), b = Math.floor(cur.clock * HAUL_HZ);
    if (b > a) out.push({ clip: 'creak', source: 'ferry', index: 0, gain: GAIN.creak, rate: vary(b, 2) });
  } else if (s.propulsion === 'poles') {
    // Poler i plants the pole when strokeAt(t, i) = fract(t / STROKE_S + i / 2) wraps (crew.ts), t = s since cast-off.
    const t0 = prev.tLeg - s.load, t1 = cur.tLeg - s.load;
    if (t1 > t0 && t1 >= 0) for (let i = 0; i < s.crew; i++) {
      const a = Math.floor(t0 / STROKE_S + i * 0.5), b = Math.floor(t1 / STROKE_S + i * 0.5);
      if (b > a) out.push({ clip: 'pole', source: 'ferry', index: i, gain: GAIN.pole, rate: vary(b * 8 + i, 3) });
    }
  }
  return out;
}

/** Spec 6b §2: a call every CALL.period s (± jitter) from a seeded wader; each kept with probability `rate`. */
export function birdCalls(prevT: number, curT: number, n: number, rate: number, out: SoundEvent[]): SoundEvent[] {
  if (n === 0 || jumped(prevT, curT)) return out;
  const { period: P, jitter: J, seed } = CALL;
  for (let k = Math.floor((prevT - J) / P); k <= Math.floor((curT + J) / P); k++) {
    const t = eventTime(k, P, J, seed);
    if (t <= prevT || t > curT || u01(k, 3, seed) >= rate) continue;
    out.push({ clip: u01(k, 2, seed) < 0.5 ? 'croak' : 'peep', source: 'wader', index: Math.floor(u01(k, 1, seed) * n), gain: GAIN.call, rate: vary(k, 4) });
  }
  return out;
}

/** Spec 6b §2: wing flaps when a wader takes off (standing → flying). */
export function flushEdges(prev: Uint8Array, cur: Uint8Array, n: number, out: SoundEvent[]): SoundEvent[] {
  for (let i = 0; i < n; i++) if (!prev[i] && cur[i]) out.push({ clip: 'flap', source: 'wader', index: i, gain: GAIN.flap, rate: vary(i, 5) });
  return out;
}
