import { legDuration } from '../ancon/crossing';
import { lastDockStart, u01 } from './clock';
import { smooth, yawOf, type FaunaPose } from './pose';
import { BANK_STEP, bankAt, bankValid, type BankLine, type FaunaSite, type FaunaWorld } from './site';

/**
 * Egrets and herons at the two landings (spec 5 §2, §3.1, §3.3). u is the along-bank offset from the landing (m).
 * Flushers stand 10–22 m from the pad, inside the landing clearing. When the ferry docks there they fly `flee` m
 * (30–60) along the bank, across the front of the pad (5.5 m up, over the docked hull and its load) to the other
 * side, landing at most `landMax` m from the pad, so the ride camera, facing the landing, sees them cross; then they
 * walk back while the ferry is away. The last bird per landing stands 22–30 m out and stays. Idle: stand, walk
 * `step` m, stop, peck — a 20 s cycle.
 */
export const WADE = {
  homeU: [10, 22] as [number, number], extraU: [22, 30] as [number, number], flee: [30, 60] as [number, number], landMax: 30,
  flyV: 5, flyRamp: 0.8, flyH: 5.5, flyRise: 1.6, stagger: 0.45, cycle: 20, step: 1.5, flapHz: 2.4,
};
export type WaderKind = 'great' | 'snowy' | 'blue' | 'tri';
/** Scale on the great-egret model and an instance tint (white birds keep the vertex colours). Inferred (L). */
export const WADER_LOOK: Record<WaderKind, { scale: number; color: number }> = {
  great: { scale: 1, color: 0xffffff }, snowy: { scale: 0.62, color: 0xffffff },
  blue: { scale: 0.62, color: 0x4c5d80 }, tri: { scale: 0.68, color: 0x5d6782 },
};
const KINDS: WaderKind[][] = [['great', 'blue', 'snowy', 'great', 'tri'], ['snowy', 'great', 'tri', 'blue', 'great']];

export interface WaderSpec { landing: 0 | 1; kind: WaderKind; u: number; flee: number; flush: boolean; rank: number; seed: number }

/** The valid bank sample nearest `u0` with |u| in [lo, hi] on side `side`. */
function validU(b: BankLine, u0: number, side: number, lo: number, hi: number): number {
  for (let d = 0; d <= hi - lo; d += BANK_STEP) for (const u of [u0 + d, u0 - d]) {
    if (Math.abs(u) >= lo && Math.abs(u) <= hi && Math.sign(u) === side && bankValid(b, u)) return u;
  }
  throw new Error(`fauna: no bank spot for a wader near u=${u0.toFixed(1)}`);
}

export function waderSpecs(site: FaunaSite, perLanding: number): WaderSpec[] {
  const out: WaderSpec[] = [];
  for (const landing of [0, 1] as const) for (let j = 0; j < perLanding; j++) {
    const b = site.banks[landing], seed = 101 + landing * 10 + j, side = j % 2 === 0 ? 1 : -1, flush = j < perLanding - 1;
    // Flushers go in pairs (one each side); pair q stands in the q-th of equal bands across homeU, in its nearer
    // half, so the pairs cross the ride view one after the other. The last bird stands in extraU.
    const [lo, hi] = flush ? WADE.homeU : WADE.extraU, nb = flush ? Math.ceil((perLanding - 1) / 2) : 1;
    const band = flush ? Math.floor(j / 2) + 0.5 * u01(j, landing, seed) : u01(j, landing, seed);
    const snap = (v: number) => Math.round(v / BANK_STEP) * BANK_STEP;
    const u = validU(b, snap(side * (lo + ((hi - lo) * band) / nb)), side, lo, hi);
    // Across the pad to the other side, landing ≤ landMax m from it.
    const fleeHi = Math.min(WADE.flee[1], Math.abs(u) + WADE.landMax);
    let flee = -side * Math.max(WADE.flee[0], Math.floor((WADE.flee[0] + (fleeHi - WADE.flee[0]) * u01(j, landing + 2, seed)) / BANK_STEP) * BANK_STEP);
    while (Math.abs(flee) > WADE.flee[0] && !bankValid(b, u + flee)) flee += side * BANK_STEP;
    if (!bankValid(b, u + flee)) throw new Error(`fauna: no landing spot for wader ${landing}/${j}`);
    out.push({ landing, kind: KINDS[landing][j], u, flee, flush, rank: j, seed });
  }
  return out;
}

/** Flush flight (s): speed up over `flyRamp` s, cruise at flyV, slow down over `flyRamp` s. */
export const flightTime = (flee: number) => Math.abs(flee) / WADE.flyV + WADE.flyRamp;
/** Distance (m) flown `t` s into a flight of `fly` s. */
function flown(t: number, fly: number) {
  const V = WADE.flyV, r = WADE.flyRamp;
  if (t < r) return (V * t * t) / (2 * r);
  if (t < fly - r) return V * (t - r / 2);
  return V * (fly - r) - (V * (fly - t) * (fly - t)) / (2 * r);
}

const P = [0, 0, 0], Q = [0, 0, 0];
const peck = (tau: number, t0: number) => (tau >= t0 && tau < t0 + 0.35 ? Math.sin((Math.PI * (tau - t0)) / 0.35) : 0);
export function waderHome(s: WaderSpec, w: FaunaWorld, out: number[]) { bankAt(w.site.banks[s.landing], s.u, out); }

/** Idle step offset (m) along the bank: in cycle c walk 0 → step (c even) or back (c odd) during τ 8–12 s. */
function idleOff(clock: number, seed: number) {
  const ph = seed * 3.7, c = Math.floor((clock + ph) / WADE.cycle), tau = clock + ph - c * WADE.cycle, sm = smooth((tau - 8) / 4);
  return WADE.step * ((c & 1) === 1 ? 1 - sm : sm);
}

export function wader(clock: number, s: WaderSpec, w: FaunaWorld, out: FaunaPose): FaunaPose {
  const b = w.site.banks[s.landing], lat = w.site.lateral, look = WADER_LOOK[s.kind];
  const fly = flightTime(s.flee);
  let u = s.u, flying = false, tf = Infinity, walking = false, idleW = 1, f = 0;
  if (s.flush && !w.moored) {
    const L = legDuration(w.T), walk = 2 * L - 10 - 40;
    tf = clock - (lastDockStart(clock, w.T, s.landing, false) + s.rank * WADE.stagger);
    if (tf < 0) tf += 2 * L;
    // A straight line from where it stood at take-off to its landing spot on the bank.
    if (tf < fly) { flying = true; bankAt(b, s.u + idleOff(clock - tf, s.seed), P); bankAt(b, s.u + s.flee, Q); f = flown(tf, fly) / Math.abs(s.flee); }
    else if (tf < fly + walk) { walking = true; u = s.u + s.flee * (1 - (tf - fly) / walk); idleW = 0; }
    else idleW = smooth((tf - fly - walk) / 5);
  }
  // Idle: step along the bank (idleOff); turn at the start of each cycle; pecks at τ 13 and 16 s.
  const ph = s.seed * 3.7, c = Math.floor((clock + ph) / WADE.cycle), tau = clock + ph - c * WADE.cycle, odd = (c & 1) === 1;
  if (!flying) { u += idleW * idleOff(clock, s.seed); bankAt(b, u, P); }
  const wx = -b.inland[0], wz = -b.inland[1];
  if (flying) {
    out.x = P[0] + (Q[0] - P[0]) * f; out.z = P[2] + (Q[2] - P[2]) * f;
    out.y = P[1] + (Q[1] - P[1]) * f + WADE.flyH * smooth(tf / WADE.flyRise) * smooth((fly - tf) / WADE.flyRise);
    out.yaw = yawOf(Q[0] - P[0], Q[2] - P[2]); out.pitch = 0.1; out.roll = 0;
    out.flap = 0.6 * Math.sin(2 * Math.PI * WADE.flapHz * tf); out.fold = 0; out.legs = 1;
  } else {
    let hx: number, hz: number;
    if (walking) { const sg = -Math.sign(s.flee); hx = lat[0] * sg; hz = lat[1] * sg; }
    else {
      const sPrev = odd ? 1 : -1, sCur = odd ? -1 : 1, a = 0.9 * (sPrev + (sCur - sPrev) * smooth(tau / 1.5));
      hx = wx * Math.cos(a) + lat[0] * Math.sin(a); hz = wz * Math.cos(a) + lat[1] * Math.sin(a);
    }
    out.x = P[0]; out.y = P[1]; out.z = P[2];
    out.yaw = yawOf(hx, hz); out.pitch = -0.6 * (peck(tau, 13) + peck(tau, 16)); out.roll = 0;
    out.flap = 0; out.fold = 1; out.legs = 0;
  }
  out.scale = look.scale; out.on = true;
  return out;
}
