import { legDuration } from '../ancon/crossing';
import { lastDockStart, u01 } from './clock';
import { smooth, yawOf, type FaunaPose } from './pose';
import { BANK_HALF, BANK_STEP, bankAt, bankValid, type BankLine, type FaunaSite, type FaunaWorld } from './site';

/**
 * Egrets and herons at the two landings (spec 5 §2, §3.1, §3.3). u is the along-bank offset from the landing (m).
 * Flushers stand 10–22 m from the pad, inside the landing clearing. When the ferry docks there they fly `flee` m
 * (30–60) along the bank, across the front of the pad (5.5 m up, over the docked hull and its load) to the other
 * side, landing at most `landMax` m from the pad, so the ride camera, facing the landing, sees them cross; then they
 * walk back while the ferry is away. The last bird per landing stands 22–30 m out and stays. Idle: stand, walk
 * `step` m, stop, peck — a 20 s cycle.
 *
 * Keeping apart: the birds flying toward +u (from the −u side) fly `flyLane` m out over the water and walk back
 * `walkLane` m inland, so they pass the birds going the other way; birds going the same way never overtake (the one
 * from the farther home lands nearer the pad) and all of a landing's birds walk back over the same window
 * (`walkAt` s after dock start to `walkEnd` s before the next one), so they keep their order. Every landing spot is
 * ≥ `gap` m from every other bird's home (with its idle step) and landing spot.
 */
export const WADE = {
  homeU: [10, 22] as [number, number], extraU: [22, 30] as [number, number], flee: [30, 60] as [number, number], landMax: 30,
  flyV: 5, flyRamp: 0.8, flyH: 5.5, flyRise: 1.6, stagger: 0.45, cycle: 20, step: 1.5, flapHz: 2.4,
  gap: 2, flyLane: 2, shiftIn: 8, walkLane: 2, laneRamp: 6, walkAt: 16, walkEnd: 40, turn: 1, liftTurn: 0.6,
};
export type WaderKind = 'great' | 'snowy' | 'blue' | 'tri';
/** Scale on the great-egret model and an instance tint (white birds keep the vertex colours). Inferred (L). */
export const WADER_LOOK: Record<WaderKind, { scale: number; color: number }> = {
  great: { scale: 1, color: 0xffffff }, snowy: { scale: 0.62, color: 0xffffff },
  blue: { scale: 0.62, color: 0x4c5d80 }, tri: { scale: 0.68, color: 0x5d6782 },
};
const KINDS: WaderKind[][] = [['great', 'blue', 'snowy', 'great', 'tri'], ['snowy', 'great', 'tri', 'blue', 'great']];

/** `flee` is 0 for the bird that stays behind. */
export interface WaderSpec { landing: 0 | 1; kind: WaderKind; u: number; flee: number; flush: boolean; rank: number; seed: number }

/** The valid bank sample nearest `u0` with |u| in [lo, hi] on side `side`. */
function validU(b: BankLine, u0: number, side: number, lo: number, hi: number): number {
  for (let d = 0; d <= hi - lo; d += BANK_STEP) for (const u of [u0 + d, u0 - d]) {
    if (Math.abs(u) >= lo && Math.abs(u) <= hi && Math.sign(u) === side && bankValid(b, u)) return u;
  }
  throw new Error(`fauna: no bank spot for a wader near u=${u0.toFixed(1)}`);
}

/** Distance (m) along the bank from `u` to where bird `o` stands at home (u … u + step with its idle step). */
const toHome = (u: number, o: WaderSpec) => Math.max(0, o.u - u, u - (o.u + WADE.step));

/**
 * Landing spots for a landing's flushers: across the pad, ≤ landMax m from it, 30–60 m from home; ≥ gap m from every
 * other bird's home and landing spot; in the same order along the bank as the homes of the birds flying the same way.
 * Each bird prefers a seeded pick, then the spots outward from it; the first assignment that fits every bird wins.
 */
function assignLandings(b: BankLine, all: WaderSpec[], fl: WaderSpec[], i = 0): boolean {
  if (i === fl.length) return true;
  const s = fl[i], side = Math.sign(s.u), hi = Math.min(WADE.flee[1], Math.abs(s.u) + WADE.landMax), lo = WADE.flee[0];
  const m0 = Math.max(lo, Math.floor((lo + (hi - lo) * u01(s.rank, s.landing + 2, s.seed)) / BANK_STEP) * BANK_STEP);
  const ok = (L: number) => bankValid(b, L) && all.every((o) => o === s || (toHome(L, o) >= WADE.gap &&
    (o.flee === 0 || (Math.abs(L - o.u - o.flee) >= WADE.gap && (Math.sign(o.u) !== side || (L - o.u - o.flee) * (s.u - o.u) > 0)))));
  for (let d = 0; m0 - d >= lo || m0 + d <= hi; d += BANK_STEP) for (const m of d === 0 ? [m0] : [m0 - d, m0 + d]) {
    if (m < lo || m > hi || !ok(s.u - side * m)) continue;
    s.flee = -side * m;
    if (assignLandings(b, all, fl, i + 1)) return true;
    s.flee = 0;
  }
  return false;
}

export function waderSpecs(site: FaunaSite, perLanding: number): WaderSpec[] {
  const out: WaderSpec[] = [];
  for (const landing of [0, 1] as const) {
    const b = site.banks[landing], here: WaderSpec[] = [];
    for (let j = 0; j < perLanding; j++) {
      const seed = 101 + landing * 10 + j, side = j % 2 === 0 ? 1 : -1, flush = j < perLanding - 1;
      // Flushers go in pairs (one each side); pair q stands in the q-th of equal bands across homeU, in its nearer
      // half, so the pairs cross the ride view one after the other. The last bird stands in extraU.
      const [lo, hi] = flush ? WADE.homeU : WADE.extraU, nb = flush ? Math.ceil((perLanding - 1) / 2) : 1;
      const band = flush ? Math.floor(j / 2) + 0.5 * u01(j, landing, seed) : u01(j, landing, seed);
      const snap = (v: number) => Math.round(v / BANK_STEP) * BANK_STEP;
      const u = validU(b, snap(side * (lo + ((hi - lo) * band) / nb)), side, lo, hi);
      for (const o of here) if (Math.max(o.u - u, u - o.u) - WADE.step < WADE.gap) throw new Error(`fauna: wader homes too close at landing ${landing}`);
      here.push({ landing, kind: KINDS[landing][j], u, flee: 0, flush, rank: j, seed });
    }
    if (!assignLandings(b, here, here.filter((x) => x.flush))) throw new Error(`fauna: no landing spots for the waders at landing ${landing}`);
    out.push(...here);
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

const _lo = [0, 0, 0], _hi = [0, 0, 0];
/** bankAt, bridging any stretch without a waterline between the nearest valid samples either side (never stale). */
function bankPt(b: BankLine, u: number, out: number[]) {
  if (bankAt(b, u, out)) return;
  let lo = u, hi = u;
  while (lo > -BANK_HALF && !bankValid(b, lo)) lo -= BANK_STEP;
  while (hi < BANK_HALF && !bankValid(b, hi)) hi += BANK_STEP;
  const okLo = bankAt(b, lo, _lo), okHi = bankAt(b, hi, _hi), t = okLo && okHi ? (u - lo) / (hi - lo) : okHi ? 1 : 0;
  if (!okLo && !okHi) throw new Error('fauna: a bank line with no waterline');
  for (let c = 0; c < 3; c++) out[c] = okLo && okHi ? _lo[c] + (_hi[c] - _lo[c]) * t : okHi ? _hi[c] : _lo[c];
}

const P = [0, 0, 0], Q = [0, 0, 0], F = [0, 0, 0], G = [0, 0, 0], R0 = [0, 0, 0], R1 = [0, 0, 0];
const peck = (tau: number, t0: number) => (tau >= t0 && tau < t0 + 0.35 ? Math.sin((Math.PI * (tau - t0)) / 0.35) : 0);
export function waderHome(s: WaderSpec, w: FaunaWorld, out: number[]) { bankPt(w.site.banks[s.landing], s.u, out); }

/** Idle step offset (m) along the bank: in cycle c walk 0 → step (c even) or back (c odd) during τ 8–12 s. */
function idleOff(clock: number, seed: number) {
  const ph = seed * 3.7, c = Math.floor((clock + ph) / WADE.cycle), tau = clock + ph - c * WADE.cycle, sm = smooth((tau - 8) / 4);
  return WADE.step * ((c & 1) === 1 ? 1 - sm : sm);
}
/** Idle heading: toward the water, turned 0.9 rad one way or the other; it turns over at the start of each cycle. */
function idleYaw(clock: number, seed: number, b: BankLine, lat: readonly number[]) {
  const ph = seed * 3.7, c = Math.floor((clock + ph) / WADE.cycle), tau = clock + ph - c * WADE.cycle, odd = (c & 1) === 1;
  const sPrev = odd ? 1 : -1, sCur = odd ? -1 : 1, a = 0.9 * (sPrev + (sCur - sPrev) * smooth(tau / 1.5));
  return yawOf(-b.inland[0] * Math.cos(a) + lat[0] * Math.sin(a), -b.inland[1] * Math.cos(a) + lat[1] * Math.sin(a));
}
const wrap = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
/** Yaw turning from a0 to a1 as t goes 0 → 1 (eased), the short way round, or through `via` when given. */
function turn(a0: number, a1: number, t: number, via?: number) {
  let d = wrap(a1 - a0);
  if (via !== undefined) { const v = wrap(via - a0); if (v * d < 0 || Math.abs(v) > Math.abs(d)) d -= 2 * Math.PI * Math.sign(d || 1); }
  return a0 + d * smooth(t);
}

/**
 * Ground position (x, z into `out`) `fl` m into the flush flight from P (at u = uP) to Q: the straight line P–Q, eased
 * over its first and last `shiftIn` m onto a line shared by the landing's flyers — the straight line through the
 * waterline `landMax` m either side of the pad (R0, R1), or `flyLane` m out over the water from it for the birds
 * flying toward +u. Shared, so two birds flying opposite ways pass `flyLane` m apart whatever the bank does between.
 */
function flightXZ(fl: number, s: WaderSpec, b: BankLine, uP: number, out: number[]) {
  const len = Math.abs(s.flee), f = fl / len, ix = b.inland[0], iz = b.inland[1], u = uP + (s.flee + s.u - uP) * f;
  const x = P[0] + (Q[0] - P[0]) * f, z = P[2] + (Q[2] - P[2]) * f;
  const tRef = (((R1[0] - R0[0]) * ix + (R1[2] - R0[2]) * iz) * (u + WADE.landMax)) / (2 * WADE.landMax) - (s.flee > 0 ? WADE.flyLane : 0);
  const shift = (tRef - ((x - R0[0]) * ix + (z - R0[2]) * iz)) * smooth(fl / WADE.shiftIn) * smooth((len - fl) / WADE.shiftIn);
  out[0] = x + ix * shift; out[2] = z + iz * shift;
}

export function wader(clock: number, s: WaderSpec, w: FaunaWorld, out: FaunaPose): FaunaPose {
  const b = w.site.banks[s.landing], lat = w.site.lateral, look = WADER_LOOK[s.kind], wx = -b.inland[0], wz = -b.inland[1];
  let u = s.u, idleW = 1, lane = 0, yaw = idleYaw(clock, s.seed, b, lat);
  let flying = false, tf = 0, fly = 0;
  if (s.flush && !w.moored) {
    const D = lastDockStart(clock, w.T, s.landing, false), td = clock - D, t0 = s.rank * WADE.stagger;
    const walkEnd = 2 * legDuration(w.T) - WADE.walkEnd, sg = -Math.sign(s.flee), walkYaw = yawOf(lat[0] * sg, lat[1] * sg);
    fly = flightTime(s.flee); tf = td - t0;
    if (tf >= 0 && td < walkEnd) {
      // From where it stood at take-off (with its idle step) to its landing spot.
      bankPt(b, s.u + idleOff(D + t0, s.seed), P); bankPt(b, s.u + s.flee, Q);
      if (tf < fly) flying = true;
      else {
        // Stand where it landed, turn round (through facing the water) and walk back; birds flying toward +u walk
        // walkLane m inland.
        const x = Math.min(1, Math.max(0, (td - WADE.walkAt) / (walkEnd - WADE.walkAt)));
        u = s.u + s.flee * (1 - x); idleW = 0;
        if (s.flee > 0) lane = WADE.walkLane * smooth((td - WADE.walkAt) / WADE.laneRamp) * smooth((walkEnd - td) / WADE.laneRamp);
        yaw = turn(yawOf(Q[0] - P[0], Q[2] - P[2]), walkYaw, (td - WADE.walkAt + WADE.turn) / WADE.turn, yawOf(wx, wz));
      }
    } else if (td >= walkEnd) {
      idleW = smooth((td - walkEnd) / 5);
      yaw = turn(walkYaw, yaw, (td - walkEnd) / WADE.turn);
    }
  }
  if (flying) {
    const uP = s.u + idleOff(clock - tf, s.seed), len = Math.abs(s.flee), fl = flown(tf, fly);
    bankPt(b, -WADE.landMax, R0); bankPt(b, WADE.landMax, R1);
    flightXZ(fl, s, b, uP, F); out.x = F[0]; out.z = F[2];
    out.y = P[1] + ((Q[1] - P[1]) * fl) / len + WADE.flyH * smooth(tf / WADE.flyRise) * smooth((fly - tf) / WADE.flyRise);
    // Heading along the ground track (so P → Q at both ends), turned from the idle heading over the first liftTurn s.
    flightXZ(Math.max(0, fl - 0.1), s, b, uP, F); flightXZ(Math.min(len, fl + 0.1), s, b, uP, G);
    out.yaw = turn(idleYaw(clock - tf, s.seed, b, lat), yawOf(G[0] - F[0], G[2] - F[2]), tf / WADE.liftTurn); out.pitch = 0.1; out.roll = 0;
    out.flap = 0.6 * Math.sin(2 * Math.PI * WADE.flapHz * tf); out.fold = 0; out.legs = 1;
  } else {
    // Idle: step along the bank (idleOff); turn at the start of each cycle; pecks at τ 13 and 16 s.
    const ph = s.seed * 3.7, c = Math.floor((clock + ph) / WADE.cycle), tau = clock + ph - c * WADE.cycle;
    u += idleW * idleOff(clock, s.seed); bankPt(b, u, P);
    out.x = P[0]; out.y = P[1]; out.z = P[2];
    if (lane > 0) {
      const g0 = Math.max(0, w.site.groundAt(P[0], P[2]));
      out.x -= wx * lane; out.z -= wz * lane; out.y += Math.max(0, w.site.groundAt(out.x, out.z)) - g0;
    }
    out.yaw = yaw; out.pitch = -0.6 * (peck(tau, 13) + peck(tau, 16)); out.roll = 0;
    out.flap = 0; out.fold = 1; out.legs = 0;
  }
  out.scale = look.scale; out.on = true;
  return out;
}
