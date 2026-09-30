import { legDuration } from '../ancon/crossing';
import { lastDockStart, u01 } from './clock';
import { smooth, yawOf, type FaunaPose } from './pose';
import { BANK_STEP, bankAt, bankValid, type BankLine, type FaunaSite, type FaunaWorld } from './site';

/**
 * Egrets and herons at the two landings (spec 5 §2, §3.1, §3.3). u is the along-bank offset from the landing (m).
 * Flushers stand 12–40 m from the pad and fly `flee` m along the bank when the ferry docks there; the last bird
 * per landing stands 42–55 m out and stays. Idle: stand, walk `step` m, stop, peck — a 20 s cycle.
 */
export const WADE = {
  homeU: [12, 40] as [number, number], extraU: [42, 55] as [number, number], flee: [30, 60] as [number, number],
  flyV: 6, flyH: 3.5, stagger: 0.45, cycle: 20, step: 1.5, flapHz: 2.4,
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
    const [lo, hi] = flush ? WADE.homeU : WADE.extraU;
    const snap = (v: number) => Math.round(v / BANK_STEP) * BANK_STEP;
    const u = validU(b, snap(side * (lo + (hi - lo) * u01(j, landing, seed))), side, lo, hi);
    let flee = side * snap(WADE.flee[0] + (WADE.flee[1] - WADE.flee[0]) * u01(j, landing + 2, seed));
    while (Math.abs(flee) > WADE.flee[0] && !bankValid(b, u + flee)) flee -= side * BANK_STEP;
    if (!bankValid(b, u + flee)) throw new Error(`fauna: no landing spot for wader ${landing}/${j}`);
    out.push({ landing, kind: KINDS[landing][j], u, flee, flush, rank: j, seed });
  }
  return out;
}

const P = [0, 0, 0];
const peck = (tau: number, t0: number) => (tau >= t0 && tau < t0 + 0.35 ? Math.sin((Math.PI * (tau - t0)) / 0.35) : 0);
export function waderHome(s: WaderSpec, w: FaunaWorld, out: number[]) { bankAt(w.site.banks[s.landing], s.u, out); }

export function wader(clock: number, s: WaderSpec, w: FaunaWorld, out: FaunaPose): FaunaPose {
  const b = w.site.banks[s.landing], lat = w.site.lateral, look = WADER_LOOK[s.kind];
  const fly = Math.abs(s.flee) / WADE.flyV;
  let u = s.u, flying = false, p = 0, tf = Infinity, walking = false, idleW = 1;
  if (s.flush && !w.moored) {
    const L = legDuration(w.T), walk = 2 * L - 10 - 40;
    tf = clock - (lastDockStart(clock, w.T, s.landing, false) + s.rank * WADE.stagger);
    if (tf < 0) tf += 2 * L;
    if (tf < fly) { flying = true; p = tf / fly; u = s.u + s.flee * smooth(p); }
    else if (tf < fly + walk) { walking = true; u = s.u + s.flee * (1 - (tf - fly) / walk); idleW = 0; }
    else idleW = smooth((tf - fly - walk) / 5);
  }
  // Idle: in cycle c walk 0 → step (c even) or back (c odd) during τ 8–12 s; pecks at τ 13 and 16 s.
  const ph = s.seed * 3.7, c = Math.floor((clock + ph) / WADE.cycle), tau = clock + ph - c * WADE.cycle, odd = (c & 1) === 1;
  const sm = smooth((tau - 8) / 4), off = WADE.step * (odd ? 1 - sm : sm);
  if (!flying) u += idleW * off;
  bankAt(b, u, P);
  const wx = -b.inland[0], wz = -b.inland[1];
  if (flying) {
    const sg = Math.sign(s.flee);
    out.x = P[0]; out.z = P[2]; out.y = P[1] + WADE.flyH * Math.sin(Math.PI * p);
    out.yaw = yawOf(lat[0] * sg, lat[1] * sg); out.pitch = 0.1; out.roll = 0;
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
