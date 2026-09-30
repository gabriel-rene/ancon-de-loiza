import type { SeatAnchor } from '../ancon/seats';
import type { DeckLayout, VesselSpec } from '../ancon/spec';
import type { CarModel, LegRule } from '../data/eras';
import { hash3 } from '../vegetation/rng';
import { driverSeat } from './carKit';
import { DIMS, rearOverhang, type MoverDims, type MoverKind } from './models';

/** A driver (seated, model-local seat point) or an attendant on foot (model-local stand point). */
export interface MoverPerson { role: 'driver' | 'attendant'; at: [number, number, number]; goad: boolean }
export interface Mover {
  id: string; leg: number;
  /** Boarding order (0 boards first). */
  order: number;
  kind: MoverKind;
  /** Body paint, sRGB hex (cars); coat tint (animals); frame colour (bicycles). */
  paint: number;
  dims: MoverDims;
  /** Parked model origin in the travel frame: x' toward the leading end (deck-local x = travel · x'), z deck-local. */
  park: { x: number; z: number };
  people: MoverPerson[];
}

/** Leg n runs east → west (+1) when even. */
export const travelOf = (leg: number): 1 | -1 => (((leg % 2) + 2) % 2 === 0 ? 1 : -1);
/** Attendant ahead of the animal's nose (m); beside it (gap to the flank, m); bicycles ride this far inboard of the rope line;
 * a bicycle's pusher walks this far to its outboard side (deck −z, whichever way it faces). */
export const ATTEND_AHEAD = 0.55, ATTEND_SIDE = 0.35, BIKE_RAIL = 0.75, BIKE_PUSH = 0.45;
/** Margins: the helmsman's disc (0.25) + 0.15 at the trailing end; 0.2 at the leading end. */
const TRAIL_CLEAR = 0.5 + 0.25 + 0.15, LEAD_CLEAR = 0.2;

/** Period paint (inferred L): dark before 1950, pastels and two-tones in 1959, bold solids and white in 1975–86. */
export const PAINT: Record<number, number[]> = {
  1925: [0x1b1b1b, 0x23262b, 0x2e3a2f],
  1935: [0x1c1c1c, 0x2d3440, 0x3b2f2a, 0x33402f],
  1959: [0x7fa3b8, 0xd9d2c0, 0xb8453a, 0x6e8f6a, 0xe0c890, 0x2f3b52],
  1975: [0xe8e4da, 0x8a5a2b, 0x2f5d3a, 0xb58b2a, 0x7a2e2a, 0x3c5f8a, 0xc6c0b0],
  1984: [0xdcdcd6, 0x9a1f1f, 0x1f3a5f, 0x7a7d80, 0x2b2b2b, 0xb8a27a],
};
const FIXED_PAINT: Partial<Record<CarModel, number>> = { publico: 0xe4d7b0, tvVan: 0xe6e3dc };
const COATS: Record<string, number[]> = { oxCart: [0x8a5a36, 0x6b4a33, 0xb08a5e], caneCart: [0x8a5a36, 0x6b4a33, 0xb08a5e], horse: [0x5a3a24, 0x7a4a2a, 0x3a2c22, 0x9a8f84] };
const BIKES = [0x2b2b2b, 0x7a1f1f, 0x1f3a5f];

const r01 = (era: number, leg: number, k: number, salt: number) => hash3(era * 131 + k, leg, salt) / 2 ** 32;
const pick = <T>(a: readonly T[], u: number) => a[Math.min(a.length - 1, Math.floor(u * a.length))];
const origin = (d: MoverDims, centre: number) => centre - (d.front - rearOverhang(d)) / 2;


/**
 * The movers of leg `leg`. Cars take the 'car' seat anchors, farthest from the entry end first, in `fixed` then
 * pool order; animals take the cargo anchor's line (centred where they clear the helmsman and the leading edge);
 * bicycles line up along the rail on the side without a hauler (−z), behind the cars. Pure.
 */
export function legMovers(rules: readonly LegRule[], spec: VesselSpec, L: DeckLayout, seats: readonly SeatAnchor[], era: number, leg: number): Mover[] {
  if (!rules.length || spec.moored) return [];
  const rule = rules[((leg % rules.length) + rules.length) % rules.length], out: Mover[] = [];
  const add = (kind: MoverKind, park: { x: number; z: number }, paint: number, people: MoverPerson[]) =>
    out.push({ id: `${leg}:${out.length}`, leg, order: out.length, kind, paint, dims: DIMS[kind], park, people });
  const person = (role: MoverPerson['role'], at: [number, number, number], goad = false): MoverPerson => ({ role, at, goad });
  if (rule.animal) {
    const d = DIMS[rule.animal], ahead = !(spec.propulsion === 'poles' && spec.crew < 2);   // one poler: the free side is beside the animal
    const noseMax = L.halfLength - LEAD_CLEAR - (ahead ? ATTEND_AHEAD + 0.25 : 0), tailMin = -(L.halfLength - TRAIL_CLEAR);
    const lo = tailMin + d.length / 2, hi = noseMax - d.length / 2;
    if (lo > hi + 1e-9) throw new Error(`${rule.animal} does not fit the ${spec.kind} deck`);
    const at: [number, number, number] = ahead
      ? [d.wheelbase / 2 + d.front + ATTEND_AHEAD, 0, 0]
      : [d.wheelbase / 2 + d.front - 0.6, 0, -travelOf(leg) * (d.width / 2 + ATTEND_SIDE)];   // on deck side −1 (model left when travel +1)
    add(rule.animal, { x: origin(d, (lo + hi) / 2), z: 0 }, pick(COATS[rule.animal], r01(era, leg, 0, 3)), [person('attendant', at, rule.animal !== 'horse')]);
    return out;
  }
  const slots = seats.filter((s) => s.kind === 'car').slice().sort((a, b) => b.pos[0] - a.pos[0] || a.pos[2] - b.pos[2]);
  for (let k = 0; k < rule.cars; k++) {
    const kind: CarModel = k < rule.fixed.length ? rule.fixed[k] : pick(rule.pool, r01(era, leg, k, 1));
    const d = DIMS[kind], s = slots[k];
    const paint = FIXED_PAINT[kind] ?? pick(PAINT[era] ?? PAINT[1984], r01(era, leg, k, 2));
    add(kind, { x: origin(d, s.pos[0]), z: s.pos[2] }, paint, [person('driver', driverSeat(kind))]);
  }
  if (rule.bicycles) {
    const d = DIMS.bicycle, rows = Math.max(1, L.rows), last = -(rows / 2 - 0.5) * 4.4;   // nose behind the last car row's centre, walking in single file
    for (let b = 0; b < rule.bicycles; b++) {
      const centre = last - b * (d.length + 0.6) + 0.5;
      add('bicycle', { x: origin(d, centre), z: -(L.ropeZ - BIKE_RAIL) }, pick(BIKES, r01(era, leg, 40 + b, 4)),
        [person('attendant', [d.wheelbase / 2 - 0.4, 0, -travelOf(leg) * BIKE_PUSH])]);   // model −z faces deck −z only when travel is +1
    }
  }
  return out;
}

/** Parked deck-local rectangle [x0, x1, z0, z1] of `m` (body plus its people on foot), grown by `pad`. */
export function footprint(m: Mover, travel: 1 | -1, pad = 0): [number, number, number, number] {
  const d = m.dims, rear = rearOverhang(d);
  let a = -(d.wheelbase / 2 + rear), b = d.wheelbase / 2 + d.front, zl = -d.width / 2, zr = d.width / 2;   // model-local x, z
  for (const p of m.people) if (p.role === 'attendant') {
    a = Math.min(a, p.at[0] - 0.25); b = Math.max(b, p.at[0] + 0.25);
    zl = Math.min(zl, p.at[2] - 0.25); zr = Math.max(zr, p.at[2] + 0.25);
  }
  // Facing +x (travel +1) the right side (model +z) is deck +z; facing −x (travel −1) it is deck −z: deck z = park.z + travel·zModel.
  const x0 = m.park.x + a, x1 = m.park.x + b, zs = [m.park.z + travel * zl, m.park.z + travel * zr];
  const xs = travel > 0 ? [x0, x1] : [-x1, -x0];
  return [xs[0] - pad, xs[1] + pad, Math.min(zs[0], zs[1]) - pad, Math.max(zs[0], zs[1]) + pad];
}
