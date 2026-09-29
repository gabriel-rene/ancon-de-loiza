/**
 * A trip along a path: from arc length s0 at time t0 (speed v0) to s1, accelerating at `accel` up to `vmax`,
 * then (if `stop`) braking at `accel` to rest exactly at s1. Pure, allocation-free (tripAt writes `out`).
 */
export interface Trip { t0: number; s0: number; s1: number; v0: number; vmax: number; accel: number; stop: boolean }
export interface TripPoint { s: number; v: number }

interface Shape { vp: number; ta: number; da: number; tc: number; dc: number; td: number }
function shape(t: Trip): Shape {
  const d = Math.max(0, t.s1 - t.s0), a = t.accel, v0 = Math.min(t.v0, t.vmax);
  let vp = t.vmax, da = (vp * vp - v0 * v0) / (2 * a), dd = t.stop ? (vp * vp) / (2 * a) : 0;
  if (da + dd > d) {   // no cruise: peak where the ramps meet
    vp = t.stop ? Math.sqrt((2 * a * d + v0 * v0) / 2) : Math.sqrt(v0 * v0 + 2 * a * d);
    da = (vp * vp - v0 * v0) / (2 * a); dd = t.stop ? (vp * vp) / (2 * a) : 0;
  }
  const dc = Math.max(0, d - da - dd);
  return { vp, ta: (vp - v0) / a, da, tc: vp > 0 ? dc / vp : 0, dc, td: t.stop ? vp / a : 0 };
}
export const tripDuration = (t: Trip) => { const h = shape(t); return h.ta + h.tc + h.td; };
export const tripEndSpeed = (t: Trip) => (t.stop ? 0 : shape(t).vp);

export function tripAt(t: Trip, time: number, out: TripPoint): TripPoint {
  const h = shape(t), a = t.accel, v0 = Math.min(t.v0, t.vmax);
  let u = time - t.t0;
  if (u <= 0) { out.s = t.s0; out.v = 0; return out; }   // at rest until the trip starts
  if (u < h.ta) { out.s = t.s0 + v0 * u + 0.5 * a * u * u; out.v = v0 + a * u; return out; }
  u -= h.ta;
  if (u < h.tc) { out.s = t.s0 + h.da + h.vp * u; out.v = h.vp; return out; }
  u -= h.tc;
  if (u < h.td) { out.s = t.s0 + h.da + h.dc + h.vp * u - 0.5 * a * u * u; out.v = h.vp - a * u; return out; }
  out.s = t.s1; out.v = t.stop ? 0 : h.vp;
  return out;
}

/** Absolute time the trip first reaches arc length s (clamped to [s0, s1]). */
export function tripTimeAt(t: Trip, s: number): number {
  const h = shape(t), a = t.accel, v0 = Math.min(t.v0, t.vmax), d = Math.min(Math.max(s - t.s0, 0), t.s1 - t.s0);
  if (d <= h.da) return t.t0 + (h.ta > 0 ? (-v0 + Math.sqrt(v0 * v0 + 2 * a * d)) / a : 0);
  if (d <= h.da + h.dc) return t.t0 + h.ta + (d - h.da) / h.vp;
  const e = d - h.da - h.dc;   // braking: e = vp·u − a u²/2
  return t.t0 + h.ta + h.tc + (h.vp - Math.sqrt(Math.max(0, h.vp * h.vp - 2 * a * e))) / a;
}
