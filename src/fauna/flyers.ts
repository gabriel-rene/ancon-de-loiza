import { createCrossingState, crossingState, mooredState } from '../ancon/crossing';
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
 * `period` s the leader flies from −half to +half along the river, then the next loop comes back the other way.
 * It crosses the crossing line `ahead` m in front of the ferry, where the ferry is at mid-pass, in the direction the
 * ride camera faces then (a pure function of the crossing clock, like the mullet); clamped to `margin` m inside the
 * banks. The ends lie `half` m out to the side, outside the ride view.
 */
export const FLOCK = {
  period: 64, speed: 8, half: 240, ahead: [40, 70] as [number, number], margin: 20,
  gapBack: 5, gapSide: 2.5, beatHz: 1.25, beats: 3, glide: 2.2, amp: 0.55,
};
const _fs = createCrossingState();
/** Where loop k's flock crosses the crossing line: metres from the east landing along it. */
export function flockAlong(k: number, w: FaunaWorld): number {
  const g = w.site.geom, st = w.moored ? mooredState(_fs) : crossingState((k + 0.5) * FLOCK.period, _fs, w.T);
  // Facing: the leg's travel direction, or the next leg's once the ferry is unloading (the camera swings round).
  const facing = st.phase === 'unload' ? -st.travel : w.moored ? 1 : st.travel;
  const ahead = FLOCK.ahead[0] + (FLOCK.ahead[1] - FLOCK.ahead[0]) * u01(k, 1, 71);
  return Math.min(g.span - FLOCK.margin, Math.max(FLOCK.margin, g.span * st.s + facing * ahead));
}
export function pelicanFlock(clock: number, i: number, w: FaunaWorld, out: FaunaPose): FaunaPose {
  const s0 = w.site, g = s0.geom, k = Math.floor(clock / FLOCK.period), t = clock - k * FLOCK.period, sgn = (k & 1) === 0 ? 1 : -1;
  const along = flockAlong(k, w) + i * FLOCK.gapSide;
  const s = sgn * (-FLOCK.half + FLOCK.speed * t - i * FLOCK.gapBack);
  const x = g.shoreEast[0] + g.dir[0] * along + s0.lateral[0] * s, z = g.shoreEast[1] + g.dir[1] * along + s0.lateral[1] * s;
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
 * Frigatebird (spec 5 §2, §3.1): a slow figure-eight 60–62.5 m up, wings held out (no flapping), banking in the
 * turns. Even birds soar beyond the east bank, odd birds beyond the west. The figure-eight's centre keeps `ahead` m
 * from the ferry toward its bank (a pure function of the crossing clock, like the mullet), so while the ride camera
 * looks toward that bank the bird is about 230–250 m away: just under the top of the view and ≥ 10 px (spec §1.1).
 * Its long axis (A) lies across the view (along the banks), the short one (B) along it. Figure-eight a·sin t, b·sin 2t.
 */
export const FRIGATE = { w: 0.065, A: 50, B: 12, ahead: 220, side: 20, y: 60.6, yVar: 1.4, bob: 0.6 };
const _cs = createCrossingState();
export function frigate(clock: number, i: number, w: FaunaWorld, out: FaunaPose): FaunaPose {
  const s = w.site, g = s.geom, lat = s.lateral, ph = TAU * u01(i, 1, 79);
  const st = w.moored ? mooredState(_cs) : crossingState(clock, _cs, w.T);
  const sgn = (i & 1) === 1 ? 1 : -1, la = (u01(i, 4, 79) - 0.5) * 2 * FRIGATE.side;
  const al = g.span * st.s + sgn * FRIGATE.ahead, vAl = g.span * st.v;
  const cx = g.shoreEast[0] + g.dir[0] * al + lat[0] * la, cz = g.shoreEast[1] + g.dir[1] * al + lat[1] * la;
  const t = FRIGATE.w * clock + ph;
  // a across the view (lateral), b along it (dir); derivatives in t.
  const a = FRIGATE.A * Math.sin(t), b = FRIGATE.B * Math.sin(2 * t);
  const da = FRIGATE.A * Math.cos(t), db = 2 * FRIGATE.B * Math.cos(2 * t);
  const dda = -FRIGATE.A * Math.sin(t), ddb = -4 * FRIGATE.B * Math.sin(2 * t);
  const hx = da * lat[0] + db * g.dir[0], hz = da * lat[1] + db * g.dir[1];
  const hx2 = dda * lat[0] + ddb * g.dir[0], hz2 = dda * lat[1] + ddb * g.dir[1];
  const h2 = hx * hx + hz * hz || 1, yawRate = (FRIGATE.w * (hz * hx2 - hx * hz2)) / h2, speed = FRIGATE.w * Math.sqrt(h2);
  // Heading: the figure-eight's velocity plus the centre's drift with the ferry.
  const vx = FRIGATE.w * hx + g.dir[0] * vAl, vz = FRIGATE.w * hz + g.dir[1] * vAl;
  const y = FRIGATE.y + FRIGATE.yVar * u01(i, 5, 79) + FRIGATE.bob * Math.sin(0.03 * clock + ph);
  return set(out, cx + a * lat[0] + b * g.dir[0], y, cz + a * lat[1] + b * g.dir[1], yawOf(vx, vz), 0, bankFor(yawRate, speed, 0.45), 0, 0, 0);
}
