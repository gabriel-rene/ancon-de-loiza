import { fisherEvents, fisherPlan, pelicanFisher } from './flyers';
import { createFaunaPose } from './pose';
import type { FaunaWorld } from './site';
import { manateeSpot, manateeTime, MANATEE, MULLET, mulletJump, type Jump } from './waterLife';

/** Spec 5 §4.4: a fixed pool of rings. Worst case alive at once is ≤ 8 (see test). */
export const RING_POOL = 12;
/** [radius (m), life (s)] per ring source. */
const R = { jumpIn: [0.8, 1.5], jumpOut: [1.4, 2.0], surfA: [1.5, 2.5], surfB: [2.8, 3.0], dive: [2.5, 2.5], takeoff: [1.8, 2.0] } as const;

let n = 0;
function push(out: Float32Array, clock: number, x: number, z: number, t0: number, r: readonly [number, number]) {
  const age = clock - t0;
  if (age < 0 || age >= r[1]) return;
  if (n < RING_POOL) { out[n * 4] = x; out[n * 4 + 1] = z; out[n * 4 + 2] = age / r[1]; out[n * 4 + 3] = r[0]; }
  n++;
}

const _j: Jump = { x: 0, z: 0, hx: 0, hz: 0, h: 0, t0: 0 }, _s = [0, 0, 0], _p = createFaunaPose(), _ev = { impact: 0, takeoff: 0 };

/** Rings alive at `clock`: [x, z, age01, radius] per ring into `out`. Returns how many are alive. Allocation-free. */
export function ringsAt(clock: number, w: FaunaWorld, fishers: number, out: Float32Array): number {
  n = 0;
  // Mullet: a ring where it leaves the water and one where it falls back.
  const kHi = Math.floor((clock + MULLET.jitter) / MULLET.period), kLo = Math.floor((clock - MULLET.dur - 2 - MULLET.jitter) / MULLET.period);
  for (let k = kLo; k <= kHi; k++) {
    if (!mulletJump(k, w, _j)) continue;
    const h = MULLET.len / 2;
    push(out, clock, _j.x - _j.hx * h, _j.z - _j.hz * h, _j.t0, R.jumpIn);
    push(out, clock, _j.x + _j.hx * h, _j.z + _j.hz * h, _j.t0 + MULLET.dur, R.jumpOut);
  }
  // Manatee: the snout, then the back.
  const mHi = Math.floor((clock + MANATEE.jitter) / MANATEE.period);
  for (let k = mHi - 1; k <= mHi; k++) {
    manateeSpot(k, w, _s);
    const t0 = manateeTime(k);
    push(out, clock, _s[0], _s[2], t0 + 0.08 * MANATEE.dur, R.surfA);
    push(out, clock, _s[0], _s[2], t0 + 0.55 * MANATEE.dur, R.surfB);
  }
  // Pelican fishers: dive impact and take-off (this cycle and the one before).
  for (let i = 0; i < fishers; i++) {
    const cyc = fisherPlan(i).cycle;
    fisherEvents(i, clock - 12, _ev);
    let impact = _ev.impact, takeoff = _ev.takeoff;
    for (let c = 0; c < 2; c++, impact += cyc, takeoff += cyc) {
      pelicanFisher(impact, i, w, _p); push(out, clock, _p.x, _p.z, impact, R.dive);
      pelicanFisher(takeoff, i, w, _p); push(out, clock, _p.x, _p.z, takeoff, R.takeoff);
    }
  }
  return n;
}
