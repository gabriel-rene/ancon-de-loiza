import { clamp01, smooth, smoothIntegral as S } from './ease';

export type CrossingPhase = 'load' | 'castOff' | 'cross' | 'dock' | 'unload';
export const PHASES: readonly CrossingPhase[] = ['load', 'castOff', 'cross', 'dock', 'unload'];
export type CrossingTimings = Record<CrossingPhase, number>;
/** Seconds per phase at 1× (spec §13: ≈ 3 min per crossing). */
export const CROSSING_TIMINGS: CrossingTimings = { load: 20, castOff: 8, cross: 126, dock: 10, unload: 16 };
/** Smooth acceleration / deceleration ramps (s) of the moving part (castOff + cross + dock). */
export const RAMP_UP = 18, RAMP_DOWN = 20;
/** Default crossing clock at page load: 8 s before cast-off, so the first thing seen is the ferry leaving. */
export const DEFAULT_CROSSING_START = 12;
export const legDuration = (T: CrossingTimings = CROSSING_TIMINGS) => T.load + T.castOff + T.cross + T.dock + T.unload;

export interface CrossingState {
  /** Legs completed since clock 0 (floor(clock / leg)); may be negative. */
  legIndex: number;
  /** 0: east (Loíza) → west (Torrecilla Baja); 1: back. */
  leg: 0 | 1;
  /** +1 while travelling toward local +X (west), −1 back. */
  travel: 1 | -1;
  phase: CrossingPhase;
  /** 0..1 within the phase. */
  phaseT: number;
  /** Seconds since the leg started. */
  tLeg: number;
  /** Progress along this leg, 0..1. */
  p: number;
  /** Absolute position on the line: 0 at the east dock, 1 at the west dock. */
  s: number;
  /** ds/dt (1/s) and d²s/dt² (1/s²), signed like s. */
  v: number; a: number;
  /** Ropes: 0 taut … 1 slack (sagging into the water while the vessel waits). */
  slack: number;
  /** Crew effort 0..1, continuous. */
  effort: number;
}

export const createCrossingState = (): CrossingState =>
  ({ legIndex: 0, leg: 0, travel: 1, phase: 'load', phaseT: 0, tLeg: 0, p: 0, s: 0, v: 0, a: 0, slack: 1, effort: 0 });

/** Leg progress p, dp/dt, d²p/dt² at τ seconds after cast-off; M = moving time. */
function motion(tau: number, M: number, out: CrossingState) {
  const A = RAMP_UP, D = RAMP_DOWN, vmax = 1 / (M - A / 2 - D / 2);
  if (tau <= 0) { out.p = 0; out.v = 0; out.a = 0; }
  else if (tau < A) { const u = tau / A; out.p = vmax * A * S(u); out.v = vmax * smooth(u); out.a = (vmax * 6 * u * (1 - u)) / A; }
  else if (tau < M - D) { out.p = vmax * (A / 2 + tau - A); out.v = vmax; out.a = 0; }
  else if (tau < M) { const u = (M - tau) / D; out.p = 1 - vmax * D * S(u); out.v = vmax * smooth(u); out.a = (-vmax * 6 * u * (1 - u)) / D; }
  else { out.p = 1; out.v = 0; out.a = 0; }
}

/** The crossing at `clock` seconds. Pure: same clock ⇒ same state. Writes into and returns `out`. */
export function crossingState(clock: number, out: CrossingState, T: CrossingTimings = CROSSING_TIMINGS): CrossingState {
  const L = legDuration(T);
  out.legIndex = Math.floor(clock / L);
  out.leg = (((out.legIndex % 2) + 2) % 2) as 0 | 1;
  out.travel = out.leg === 0 ? 1 : -1;
  const tau = clock - out.legIndex * L;
  out.tLeg = tau;
  let t0 = 0;
  for (const ph of PHASES) {
    if (tau < t0 + T[ph] || ph === 'unload') { out.phase = ph; out.phaseT = clamp01((tau - t0) / T[ph]); break; }
    t0 += T[ph];
  }
  motion(tau - T.load, T.castOff + T.cross + T.dock, out);
  out.s = out.leg === 0 ? out.p : 1 - out.p;
  out.v *= out.travel; out.a *= out.travel;
  const u = out.phaseT;
  switch (out.phase) {
    case 'load': case 'unload': out.slack = 1; out.effort = 0; break;
    case 'castOff': out.slack = 1 - smooth(u); out.effort = smooth(clamp01(u / 0.35)); break;
    case 'cross': out.slack = 0; out.effort = 1 - 0.4 * smooth(clamp01((u - 0.7) / 0.3)); break;
    case 'dock': out.slack = smooth(u); out.effort = 0.6 * (1 - u); break;
  }
  return out;
}

/** 1986: the barge sits at the east (Loíza) landing, ropes slack, nobody working. Allocation-free. */
export function mooredState(out: CrossingState): CrossingState {
  out.legIndex = 0; out.leg = 0; out.travel = 1; out.phase = 'load'; out.phaseT = 0; out.tLeg = 0;
  out.p = 0; out.s = 0; out.v = 0; out.a = 0; out.slack = 1; out.effort = 0;
  return out;
}

/**
 * Advance the crossing clock by one frame (s). Time-scalable: integrating dt·speed keeps the
 * phase continuous when the speed changes mid-run; ?freeze=1 holds it at its start (?c).
 */
export const advanceClock = (clock: number, dt: number, frozen: boolean, speed: number) => (frozen ? clock : clock + dt * speed);
