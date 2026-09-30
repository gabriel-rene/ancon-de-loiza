import { u01 } from './clock';
import { bankFor, smooth, yawOf, type FaunaPose } from './pose';
import type { FaunaWorld } from './site';

const TAU = 2 * Math.PI;

/** Flap `beats` strokes at `beatHz`, then glide `glide` s with the wings level; repeats. Continuous. */
export function flapGlide(t: number, beatHz: number, beats: number, glide: number, amp: number) {
  const fl = beats / beatHz, c = fl + glide, tt = ((t % c) + c) % c;
  return tt < fl ? amp * Math.sin(TAU * beatHz * tt) : 0;
}

const set = (o: FaunaPose, x: number, y: number, z: number, yaw: number, pitch: number, roll: number, flap: number, fold: number, legs: number, scale = 1) => {
  o.x = x; o.y = y; o.z = z; o.yaw = yaw; o.pitch = pitch; o.roll = roll; o.flap = flap; o.fold = fold; o.legs = legs; o.scale = scale; o.on = true;
  return o;
};

/**
 * Pelican flock (spec 5 §3.1): an echelon along the river (across the crossing line), 3–8 m up. Each loop of
 * `period` s the leader flies from −half to +half across the view, then the next loop comes back the other way.
 * The ends lie ~280 m out to the side, outside the ride view.
 */
export const FLOCK = { period: 70, speed: 8, half: 280, gapBack: 5, gapSide: 2.5, beatHz: 1.25, beats: 3, glide: 2.2, amp: 0.55 };
export function pelicanFlock(clock: number, i: number, w: FaunaWorld, out: FaunaPose): FaunaPose {
  const s0 = w.site, k = Math.floor(clock / FLOCK.period), t = clock - k * FLOCK.period, sgn = (k & 1) === 0 ? 1 : -1;
  const along = (u01(k, 1, 71) - 0.5) * 80 + i * FLOCK.gapSide;
  const s = sgn * (-FLOCK.half + FLOCK.speed * t - i * FLOCK.gapBack);
  const x = s0.mid[0] + s0.geom.dir[0] * along + s0.lateral[0] * s, z = s0.mid[1] + s0.geom.dir[1] * along + s0.lateral[1] * s;
  const y = 3.6 + 3.8 * u01(k, 2, 71) + 0.6 * Math.sin(0.4 * t + i);
  return set(out, x, y, z, yawOf(s0.lateral[0] * sgn, s0.lateral[1] * sgn), 0, 0,
    flapGlide(t - i * 0.25, FLOCK.beatHz, FLOCK.beats, FLOCK.glide, FLOCK.amp), 0, 0);
}

/**
 * Pelican fisher (spec 5 §3.1): circles its river circle at `h`, dives (wings folded, steep), sits on the water,
 * runs and takes off, climbs back. Horizontal motion always follows the circle; only the speed changes, so the
 * path is continuous across cycles. One cycle is 25–40 s; the two fishers are out of phase.
 */
export const FISHER = { h: 11, v: 8, dive: 1.2, run: 2.5, climb: 6 };
export interface FisherPlan { cycle: number; offset: number; sit: number; circle: number; dist: number }
const PLANS: FisherPlan[] = [];
/** Fisher i's fixed timings (memoised: called every frame). */
export function fisherPlan(i: number): FisherPlan {
  const hit = PLANS[i];
  if (hit) return hit;
  const cycle = 25 + 15 * u01(i, 3, 73), sit = 4 + 4 * u01(i, 5, 73);
  const circle = cycle - (FISHER.dive + sit + FISHER.run + FISHER.climb);
  const v = FISHER.v, dist = v * circle + 0.6 * v * FISHER.dive + (v * FISHER.run) / 2 + v * FISHER.climb;
  return (PLANS[i] = { cycle, offset: cycle * (u01(i, 4, 73) + 0.5 * i), sit, circle, dist });
}
/** The first dive impact at or after `after`, and its take-off. Pass `out` in per-frame code. */
export function fisherEvents(i: number, after: number, out = { impact: 0, takeoff: 0 }): { impact: number; takeoff: number } {
  const p = fisherPlan(i), k = Math.ceil((after + p.offset - p.circle - FISHER.dive) / p.cycle);
  out.impact = k * p.cycle - p.offset + p.circle + FISHER.dive;
  out.takeoff = out.impact + p.sit;
  return out;
}
export function pelicanFisher(clock: number, i: number, w: FaunaWorld, out: FaunaPose): FaunaPose {
  const p = fisherPlan(i), F = FISHER, v = F.v, { c, r } = w.site.fishers[i];
  const tc = clock + p.offset, k = Math.floor(tc / p.cycle), tau = tc - k * p.cycle;
  const t1 = p.circle, t2 = t1 + F.dive, t3 = t2 + p.sit, t4 = t3 + F.run;
  const dDive = v * t1 + 0.6 * v * F.dive;
  let d: number, y: number, pitch = 0, flap = 0, fold = 0, speed = v;
  if (tau < t1) { d = v * tau; y = F.h; flap = flapGlide(tau, 1.2, 3, 3, 0.5); }
  else if (tau < t2) { const u = (tau - t1) / F.dive; d = v * t1 + 0.6 * v * (tau - t1); y = F.h * (1 - u * u); pitch = -1.1 * Math.min(1, u * 3); fold = 1; speed = 0.6 * v; }
  else if (tau < t3) { d = dDive; y = 0.03 * Math.sin(2 * (tau - t2)); pitch = 0.1; fold = 1; speed = 0; }
  else if (tau < t4) { const s = tau - t3, u = s / F.run; d = dDive + (v * s * s) / (2 * F.run); y = 1.5 * u * u; pitch = 0.15; flap = 0.7 * Math.sin(TAU * 2.2 * s); speed = v * u; }
  else { const s = tau - t4, u = smooth(s / F.climb); d = dDive + (v * F.run) / 2 + v * s; y = 1.5 + (F.h - 1.5) * u; pitch = 0.12 * (1 - u); flap = 0.6 * Math.sin(TAU * 1.6 * s); }
  const th = (k * p.dist + d) / r, hx = -Math.sin(th), hz = Math.cos(th);
  // Anticlockwise in XZ is a right turn (yaw decreasing): yaw rate −speed/r.
  const roll = y > 1 ? bankFor(-speed / r, speed) : 0;
  return set(out, c[0] + r * Math.cos(th), y, c[1] + r * Math.sin(th), yawOf(hx, hz), pitch, roll, flap, fold, 0);
}

/**
 * Frigatebird (spec 5 §3.1): a slow figure-eight 60–120 m up over the crossing, wings held out (no flapping),
 * banking in the turns. Figure-eight a·sin t, b·sin 2t, rotated per bird.
 */
export const FRIGATE = { w: 0.065, A: 80, B: 45 };
export function frigate(clock: number, i: number, w: FaunaWorld, out: FaunaPose): FaunaPose {
  const s = w.site, ph = TAU * u01(i, 1, 79), rot = Math.PI * u01(i, 2, 79);
  const al = (u01(i, 3, 79) - 0.5) * 80, la = (u01(i, 4, 79) - 0.5) * 120;
  const cx = s.mid[0] + s.geom.dir[0] * al + s.lateral[0] * la, cz = s.mid[1] + s.geom.dir[1] * al + s.lateral[1] * la;
  const t = FRIGATE.w * clock + ph, cr = Math.cos(rot), sr = Math.sin(rot);
  const a = FRIGATE.A * Math.sin(t), b = FRIGATE.B * Math.sin(2 * t);
  const da = FRIGATE.A * Math.cos(t), db = 2 * FRIGATE.B * Math.cos(2 * t);
  const dda = -FRIGATE.A * Math.sin(t), ddb = -4 * FRIGATE.B * Math.sin(2 * t);
  const hx = da * cr - db * sr, hz = da * sr + db * cr, hx2 = dda * cr - ddb * sr, hz2 = dda * sr + ddb * cr;
  const h2 = hx * hx + hz * hz || 1, yawRate = (FRIGATE.w * (hz * hx2 - hx * hz2)) / h2, speed = FRIGATE.w * Math.sqrt(h2);
  const y = 70 + 40 * u01(i, 5, 79) + 10 * Math.sin(0.03 * clock + ph);
  return set(out, cx + a * cr - b * sr, y, cz + a * sr + b * cr, yawOf(hx, hz), 0, bankFor(yawRate, speed, 0.45), 0, 0, 0);
}
