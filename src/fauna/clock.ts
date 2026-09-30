import { legDuration, type CrossingTimings } from '../ancon/crossing';
import { hash3 } from '../vegetation/rng';

/** Deterministic value in [0, 1) for (i, j, seed). */
export const u01 = (i: number, j: number, seed: number) => hash3(i, j, seed) / 4294967296;

/** Time of event k in a jittered series. Gaps between neighbours lie in [period − 2·jitter, period + 2·jitter]. */
export const eventTime = (k: number, period: number, jitter: number, seed: number) =>
  k * period + (u01(k, 0, seed) - 0.5) * 2 * jitter;

/**
 * Clock time at which the most recent `dock` phase at `landing` (0 east, 1 west) started, at or before `clock`.
 * Leg n starts at n·L; its dock starts at n·L + load + castOff + cross. Even legs (leg 0, east → west) dock west,
 * odd legs dock east. −Infinity when the ferry is moored (1986).
 */
export function lastDockStart(clock: number, T: CrossingTimings, landing: 0 | 1, moored: boolean): number {
  if (moored) return -Infinity;
  const L = legDuration(T), off = T.load + T.castOff + T.cross;
  let n = Math.floor((clock - off) / L);
  const parity = ((n % 2) + 2) % 2, want = landing === 1 ? 0 : 1;
  if (parity !== want) n -= 1;
  return n * L + off;
}
