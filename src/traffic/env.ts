import type { PoseContext } from '../ancon/pose';
import { seatAnchors, type SeatAnchor } from '../ancon/seats';
import type { DeckLayout, VesselSpec } from '../ancon/spec';
import type { Era, LandingLook } from '../data/eras';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { eraRoads } from '../infrastructure/roads';
import { PAD, padFrame, padPoint, type LandingPad } from '../terrain/landingPads';
import { landingPadsFor } from '../terrain/placementFields';
import { travelOf, type Mover } from './plan';
import { rearOverhang } from './models';

export type XZ = readonly [number, number];
const G = geo as unknown as GeoBundle;

/** The ferry's docked frame on a bank: deck-local (x, z) ↔ world XZ, where computeVesselPose puts the hull at s = 0 / 1 (no drift, no crab). */
export interface DockFrame { side: 'east' | 'west'; pos: XZ; yaw: number; pad: LandingPad }
export const deckToWorld = (f: DockFrame, x: number, z: number): [number, number] => {
  const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
  return [f.pos[0] + c * x + s * z, f.pos[1] - s * x + c * z];
};
export const worldToDeckInto = (f: DockFrame, wx: number, wz: number, out: [number, number]): [number, number] => {
  const c = Math.cos(f.yaw), s = Math.sin(f.yaw), dx = wx - f.pos[0], dz = wz - f.pos[1];
  out[0] = c * dx - s * dz; out[1] = s * dx + c * dz;
  return out;
};
export const worldToDeck = (f: DockFrame, wx: number, wz: number): [number, number] => worldToDeckInto(f, wx, wz, [0, 0]);

export interface Polyline { pts: XZ[]; cum: number[]; len: number }
export function polyline(pts: readonly XZ[]): Polyline {
  const out: XZ[] = [], cum: number[] = [];
  let len = 0;
  for (const p of pts) {
    const q = out[out.length - 1];
    if (q) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < 1e-6) continue; len += d; }
    out.push(p); cum.push(len);
  }
  return { pts: out, cum, len };
}
/** Point at arc length s (clamped; beyond the ends it extends the end segments). */
export function pointAt(p: Polyline, s: number, out: [number, number]): [number, number] {
  const n = p.pts.length;
  let k = 1;
  while (k < n - 1 && p.cum[k] < s) k++;
  const a = p.pts[k - 1], b = p.pts[k], l = p.cum[k] - p.cum[k - 1], u = (s - p.cum[k - 1]) / l;
  out[0] = a[0] + (b[0] - a[0]) * u; out[1] = a[1] + (b[1] - a[1]) * u;
  return out;
}
/**
 * A polyline offset to the right of its own direction (right of (dx, dz) is (−dz, dx)) by `off` m, one value per
 * vertex or one for all (negative = left). Corners are mitred, so the offset lane stays parallel to the line (the
 * mitre is capped at 3× the offset). Shared with the bridge lanes (src/traffic/bridgeTraffic.ts).
 */
export function offsetRight(pts: readonly XZ[], off: number | readonly number[]): XZ[] {
  const n = pts.length, right = (i: number): [number, number] => {   // right normal of segment i → i + 1
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  };
  return pts.map((p, i) => {
    const o = typeof off === 'number' ? off : off[i];
    const n1 = right(Math.max(0, i - 1)), n2 = right(Math.min(n - 2, i));
    let mx = n1[0] + n2[0], mz = n1[1] + n2[1];
    const ml = Math.hypot(mx, mz);
    if (ml < 1e-6) { mx = n1[0]; mz = n1[1]; } else { mx /= ml; mz /= ml; }
    const k = o / Math.max(1 / 3, mx * n1[0] + mz * n1[1]);
    return [p[0] + mx * k, p[1] + mz * k] as const;
  });
}

/**
 * Routes (inferred L). Roads keep right (spec 4c §4.2, B9b ruling): the waiting line and every mover driving on use
 * the right-hand lane of the inbound direction, movers driving off the other lane. Lanes sit `width / 4` off a story
 * road's centre line and PAD_KEEP off the pad's axis. Both story roads run beside their pad, 10–15 m to one side, so
 * the lanes leave the road where it is ROAD_LEAVE m inland (pad frame a), run diagonally to the pad top and down the
 * pad's axis to the queue head (a = QUEUE_A): a gentle S-bend, no hairpin. Bicycles are pushed along the verge on the side of the deck's bicycle rail, so they never cross the
 * car lanes: they wait VERGE_WAIT m outside the lanes and leave VERGE_LEAVE m outside them (past the next leg's
 * waiting bicycles). Cars spawn and go away CAR_ROAD m up the road (measured from its pad end), animals and bicycles
 * ANIMAL_ROAD m.
 */
export const PAD_KEEP = 2.5, QUEUE_A = 10, ROAD_LEAVE = 28, CAR_ROAD = 110, ANIMAL_ROAD = 60, VERGE_WAIT = 2, VERGE_LEAVE = 3.2;
/** The boarding line's point just off the apron tip (m past `reach`); a leaving mover runs straight until its tail is RUN_OUT m past the apron tip. */
export const LEAD = 1.5, RUN_OUT = 1;
/** One bank's lanes, world XZ. `inRoad`/`waitVerge` run far → queue head; `outRoad`/`leaveVerge` run pad → far. `padPart`: length of the pad part (where the lanes leave the road → queue head), measured on the centre line. */
export interface BankRoads { inRoad: XZ[]; outRoad: XZ[]; waitVerge: XZ[]; leaveVerge: XZ[]; padPart: number; railV: 1 | -1 }
export interface DockEnv {
  era: Era; spec: VesselSpec; layout: DeckLayout; ctx: PoseContext; seats: SeatAnchor[];
  pads: [LandingPad, LandingPad]; look: LandingLook; frames: [DockFrame, DockFrame];   // east, west
  roads: [BankRoads, BankRoads];
  groundAt: (x: number, z: number) => number;
}

/** The first `len` m of `pts` measured from its end nearest `near` (returned far → near). */
function nearestRun(pts: readonly XZ[], near: XZ, len: number): XZ[] {
  const d0 = Math.hypot(pts[0][0] - near[0], pts[0][1] - near[1]), d1 = Math.hypot(pts[pts.length - 1][0] - near[0], pts[pts.length - 1][1] - near[1]);
  const run = d0 < d1 ? [...pts] : [...pts].reverse();   // near first
  const out: XZ[] = [run[0]];
  let acc = 0;
  for (let k = 1; k < run.length && acc < len; k++) {
    const a = run[k - 1], b = run[k], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (acc + d >= len) { const u = (len - acc) / d; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); acc = len; break; }
    out.push(b); acc += d;
  }
  return out.reverse();   // far → near
}

/** Pad side (±1, pad frame v) of the deck's −z rail (where the bicycles ride) with the ferry docked at `f`. */
function railSide(f: DockFrame): 1 | -1 {
  const [x0, z0] = deckToWorld(f, 0, 0), [x1, z1] = deckToWorld(f, 0, -1);
  return padFrame(f.pad, x1, z1)[1] - padFrame(f.pad, x0, z0)[1] > 0 ? 1 : -1;
}

/** The road (far → near) cut where it first comes within ROAD_LEAVE m of the shore along the pad's axis (pad frame a). */
function cutRoad(run: readonly XZ[], pad: LandingPad): XZ[] {
  const out: XZ[] = [run[0]];
  for (let k = 1; k < run.length; k++) {
    const a0 = padFrame(pad, run[k - 1][0], run[k - 1][1])[0], a1 = padFrame(pad, run[k][0], run[k][1])[0];
    if (a1 < ROAD_LEAVE && a0 >= ROAD_LEAVE) {
      const u = (a0 - ROAD_LEAVE) / (a0 - a1);
      out.push([run[k - 1][0] + (run[k][0] - run[k - 1][0]) * u, run[k - 1][1] + (run[k][1] - run[k - 1][1]) * u]);
      return out;
    }
    out.push(run[k]);
  }
  return out;
}

function bankRoads(r: { points: readonly XZ[]; width: number }, f: DockFrame): BankRoads {
  const pad = f.pad, run = cutRoad(nearestRun(r.points, pad.shore, CAR_ROAD + 60), pad), end = run[run.length - 1];
  const centre: XZ[] = [...run, padPoint(pad, PAD.length, 0), padPoint(pad, QUEUE_A, 0)];
  const keep = centre.map((_, i) => (i < run.length ? r.width / 4 : PAD_KEEP)), rev = [...centre].reverse(), keepRev = [...keep].reverse();
  const railV = railSide(f);
  const padPart = Math.hypot(centre[run.length][0] - end[0], centre[run.length][1] - end[1]) + (PAD.length - QUEUE_A);
  return {
    inRoad: offsetRight(centre, keep), outRoad: offsetRight(rev, keepRev),
    // Right of the inbound direction is pad side −1, right of the outbound direction pad side +1.
    waitVerge: offsetRight(centre, keep.map((k) => -railV * (k + VERGE_WAIT))),
    leaveVerge: offsetRight(rev, keepRev.map((k) => railV * (k + VERGE_LEAVE))),
    padPart, railV,
  };
}

export function dockEnv(era: Era, ctx: PoseContext, groundAt: (x: number, z: number) => number): DockEnv {
  const bank = era.river.bankOffset.value, pads = landingPadsFor(bank), spec = ctx.spec, layout = ctx.layout;
  const frames: [DockFrame, DockFrame] = [
    { side: 'east', pos: ctx.dockEast, yaw: ctx.geom.yaw, pad: pads[0] },
    { side: 'west', pos: ctx.dockWest, yaw: ctx.geom.yaw, pad: pads[1] },
  ];
  const story = eraRoads(G, era).story;
  const road = (id: 'escobar' | 'antigua') => story.find((r) => r.id === id)!;
  return {
    era, spec, layout, ctx, seats: seatAnchors(spec, layout), pads, look: era.infrastructure.landing.value, frames,
    roads: [bankRoads(road('escobar'), frames[0]), bankRoads(road('antigua'), frames[1])], groundAt,
  };
}
export const departFrame = (env: DockEnv, leg: number) => env.frames[travelOf(leg) > 0 ? 0 : 1];
export const arriveFrame = (env: DockEnv, leg: number) => env.frames[travelOf(leg) > 0 ? 1 : 0];
export const roadsOf = (env: DockEnv, f: DockFrame) => env.roads[f.side === 'east' ? 0 : 1];

/** The last `len` m of a polyline (its start trimmed, the cut point interpolated). */
function tail(pts: readonly XZ[], len: number): XZ[] {
  const p = polyline(pts), start = Math.max(0, p.len - len), out: XZ[] = [pointAt(p, start, [0, 0])];
  for (let k = 0; k < p.pts.length; k++) if (p.cum[k] > start) out.push(p.pts[k]);
  return out;
}
/** The first `len` m of a polyline (its end trimmed, the cut point interpolated). */
function head(pts: readonly XZ[], len: number): XZ[] {
  const p = polyline(pts), end = Math.min(p.len, len), out: XZ[] = [];
  for (let k = 0; k < p.pts.length && p.cum[k] < end; k++) out.push(p.pts[k]);
  out.push(pointAt(p, end, [0, 0]));
  return out;
}

/**
 * Boarding route (world XZ), for the FRONT contact: the inbound lane (cars and animals) or the waiting verge
 * (bicycles), from `roadLen` m up the road to the queue head on the pad (a = QUEUE_A) → a lead-in point in line
 * with the mover's deck lane, one wheelbase before the apron point (so the whole mover is straight before the ramp)
 * → the apron point LEAD m off the apron tip → along the lane to its parked front contact. Starts one wheelbase
 * further back so the rear contact has road under it at spawn.
 */
export function boardPath(env: DockEnv, m: Mover, roadLen: number): Polyline {
  const f = departFrame(env, m.leg), tr = travelOf(m.leg), L = env.layout, r = roadsOf(env, f), wb = m.dims.wheelbase;
  const lane = m.park.z, fx = tr * (m.park.x + wb / 2), line = m.kind === 'bicycle' ? r.waitVerge : r.inRoad;
  return polyline([
    ...tail(line, roadLen + r.padPart + wb),
    deckToWorld(f, -tr * (L.reach + LEAD + wb), lane), deckToWorld(f, -tr * (L.reach + LEAD), lane), deckToWorld(f, fx, lane),
  ]);
}
/**
 * Leaving route: parked rear contact → straight along the lane until the tail is RUN_OUT m past the apron tip → the
 * outbound lane (bicycles: the leaving verge) from the pad's queue-head level out to `roadLen` m up the road.
 */
export function leavePath(env: DockEnv, m: Mover, roadLen: number): Polyline {
  const f = arriveFrame(env, m.leg), tr = travelOf(m.leg), L = env.layout, r = roadsOf(env, f), d = m.dims;
  const lane = m.park.z, rx = tr * (m.park.x - d.wheelbase / 2), line = m.kind === 'bicycle' ? r.leaveVerge : r.outRoad;
  return polyline([
    deckToWorld(f, rx, lane), deckToWorld(f, tr * (L.reach + RUN_OUT + d.wheelbase + rearOverhang(d)), lane),
    ...head(line, roadLen + r.padPart),
  ]);
}
/** Arc length (front contact) of the queue head on a boarding path: its fourth-last point (see boardPath). */
export const queueHeadS = (path: Polyline) => path.cum[path.pts.length - 4];
/** Arc length on a leaving path where the mover leaves the pad for the road (its pad top; see leavePath): road speed from here. */
export const leaveRoadS = (path: Polyline) => path.cum[3];
/** Arc length on a leaving path where the mover's tail is RUN_OUT m past the apron tip (off the deck). */
export const leaveOffDeckS = (path: Polyline) => path.cum[1];
