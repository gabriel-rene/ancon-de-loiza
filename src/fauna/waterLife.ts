import { createCrossingState, crossingState, mooredState } from '../ancon/crossing';
import { waterAt } from '../ancon/geometry';
import { WATER } from '../terrain/fields';
import { eventTime, u01 } from './clock';
import { smooth, yawOf, type FaunaPose } from './pose';
import type { FaunaWorld } from './site';

const TAU = 2 * Math.PI;
const _st = createCrossingState();

/** Mullet (spec 5 §3.2): one jump every 3–6 s, within 120 m of the ferry, never within `clear` m of the crossing line. */
export const MULLET = { period: 4.5, jitter: 0.75, dur: 0.45, len: 0.8, rMin: 20, rMax: 120, clear: 12 };
export interface Jump { x: number; z: number; hx: number; hz: number; h: number; t0: number }

/** Jump k: false when no candidate spot passes (then there is no jump k). */
export function mulletJump(k: number, w: FaunaWorld, out: Jump): boolean {
  const g = w.site.geom, lat = w.site.lateral;
  const t0 = eventTime(k, MULLET.period, MULLET.jitter, 83);
  const s = w.moored ? mooredState(_st).s : crossingState(t0, _st, w.T).s;
  const px = g.shoreEast[0] + g.dir[0] * g.span * s, pz = g.shoreEast[1] + g.dir[1] * g.span * s;
  for (let j = 0; j < 8; j++) {
    const a = TAU * u01(k, 10 + j, 83), r = MULLET.rMin + (MULLET.rMax - MULLET.rMin) * u01(k, 20 + j, 83);
    const x = px + r * Math.cos(a), z = pz + r * Math.sin(a);
    if (waterAt(w.site.fields, x, z) !== WATER.RIVER) continue;
    if (Math.abs((x - g.shoreEast[0]) * lat[0] + (z - g.shoreEast[1]) * lat[1]) < MULLET.clear) continue;
    const b = TAU * u01(k, 30 + j, 83);
    out.x = x; out.z = z; out.hx = Math.cos(b); out.hz = Math.sin(b); out.h = 0.3 + 0.3 * u01(k, 40 + j, 83); out.t0 = t0;
    return true;
  }
  return false;
}

const _j: Jump = { x: 0, z: 0, hx: 0, hz: 0, h: 0, t0: 0 };
export function mullet(clock: number, w: FaunaWorld, out: FaunaPose): FaunaPose {
  const k0 = Math.floor((clock + MULLET.jitter) / MULLET.period);
  for (let k = k0; k >= k0 - 1; k--) {
    if (!mulletJump(k, w, _j)) continue;
    const p = (clock - _j.t0) / MULLET.dur;
    if (p < 0 || p >= 1) continue;
    out.x = _j.x + _j.hx * (p - 0.5) * MULLET.len; out.z = _j.z + _j.hz * (p - 0.5) * MULLET.len;
    out.y = 4 * _j.h * p * (1 - p) - 0.12;
    out.yaw = yawOf(_j.hx, _j.hz); out.pitch = Math.atan2(4 * _j.h * (1 - 2 * p), MULLET.len); out.roll = 0;
    out.scale = 1; out.flap = 0; out.fold = 0; out.legs = 0; out.on = true;
    return out;
  }
  out.on = false;
  return out;
}

/**
 * Manatee (spec 5 §3.2): surfaces every 60–90 s at spots in its strip (site.ts), stepping `step` m along the
 * crossing each time and turning back at the strip's ends, with a slow sideways wander (≤ b). 5–15 m apart.
 * Snout up (first quarter), then the back rolls over and it goes down, moving `fwd` m.
 */
export const MANATEE = { period: 75, jitter: 7.5, dur: 4.2, step: 10, wander: 0.7, fwd: 1.5 };
export const manateeTime = (k: number) => eventTime(k, MANATEE.period, MANATEE.jitter, 89);
export function manateeSpot(k: number, w: FaunaWorld, out: number[]) {
  const { c, a, b } = w.site.manatee, d = w.site.geom.dir, l = w.site.lateral;
  const n = Math.round((2 * a) / MANATEE.step), m = (((k % (2 * n)) + 2 * n) % (2 * n));
  const al = -a + MANATEE.step * (m <= n ? m : 2 * n - m), la = b * Math.sin(k * MANATEE.wander);
  out[0] = c[0] + d[0] * al + l[0] * la; out[1] = 0; out[2] = c[1] + d[1] * al + l[1] * la;
}
const _a = [0, 0, 0], _b = [0, 0, 0];
export function manatee(clock: number, w: FaunaWorld, out: FaunaPose): FaunaPose {
  const k0 = Math.floor((clock + MANATEE.jitter) / MANATEE.period);
  for (let k = k0; k >= k0 - 1; k--) {
    const p = (clock - manateeTime(k)) / MANATEE.dur;
    if (p < 0 || p >= 1) continue;
    manateeSpot(k, w, _a); manateeSpot(k + 1, w, _b);
    const dx = _b[0] - _a[0], dz = _b[2] - _a[2], l = Math.hypot(dx, dz) || 1, hx = dx / l, hz = dz / l;
    let y: number, pitch: number;
    if (p < 0.25) { const q = smooth(p / 0.25); y = -1.2 + 0.7 * q; pitch = 0.45 * q; }
    else { const q = (p - 0.25) / 0.75; pitch = 0.45 - 0.95 * q; y = -0.5 + 0.25 * Math.sin(Math.PI * Math.min(1, q * 1.6)) - 0.8 * q * q; }
    const f = MANATEE.fwd * smooth(p);
    out.x = _a[0] + hx * f; out.z = _a[2] + hz * f; out.y = y;
    out.yaw = yawOf(hx, hz); out.pitch = pitch; out.roll = 0; out.scale = 1; out.flap = 0; out.fold = 0; out.legs = 0; out.on = true;
    return out;
  }
  out.on = false;
  return out;
}
