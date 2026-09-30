import { CROSSING_TIMINGS, legDuration, type CrossingTimings } from '../ancon/crossing';
import { NO_LOAD, type DeckLoad } from '../ancon/crew';
import { makePoseContext } from '../ancon/pose';
import { crossingGeometry } from '../ancon/geometry';
import { vesselSpec } from '../ancon/spec';
import type { Era, EraId } from '../data/eras';
import type { WorldFields } from '../terrain/fields';
import { placementFields } from '../terrain/placementFields';
import { ANIMAL_ROAD, boardPath, CAR_ROAD, departFrame, dockEnv, leaveOffDeckS, leavePath, leaveRoadS, pointAt, queueHeadS, worldToDeck, type DockEnv, type Polyline } from './env';
import { isAnimal, rearOverhang } from './models';
import { footprint, legMovers, travelOf, type Mover } from './plan';
import { tripAt, tripDuration, tripEndSpeed, tripTimeAt, type Trip, type TripPoint } from './trip';

/**
 * Speeds (m/s) and acceleration (m/s²), inferred (L; spec 4c §4.2): oxen 0.9, a led horse and pushed bicycles 1.3
 * (walking), cars up to 5.5 on the road. `deck` (ramps, pad and deck) is 2.8, not the spec's 2: the lowest speed
 * ≤ 3 m/s (0.1 steps) that keeps every era's dock stop within MAX_STOP — at 2 m/s the 1984 load takes 57 s, at 2.7 m/s
 * 51 s (ruling R4; spec 4c §4.2 amended, rulings note).
 */
export const SPEED = { deck: 2.8, road: 5.5, oxen: 0.9, walk: 1.3, accel: 1 };
/**
 * Dock stop (s): boarding starts BOARD_START into the leg (ASHORE_START when the helmsman first steps ashore), each
 * next mover BOARD_STAGGER later (bicycles board along the rail, beside the cars).
 * Leaving starts OFF_START after unload starts; each next car when the one ahead is its length + OFF_GAP m ahead;
 * bicycles run their own chain, along the rail and out on the verge (src/traffic/env.ts), beside the cars. The queue:
 * QUEUE_GAP m nose to tail; spawns are timed so each mover reaches its place in line QUEUE_MARGIN s before the ferry
 * docks, never before SPAWN_AFTER s after the previous leg's cast-off, and no mover catches up with the one ahead
 * (checked every SPAWN_STEP s; at least SPAWN_MIN s apart). Passengers need PAX_LOAD / PAX_UNLOAD s after the load
 * (Phase 3's whole stop). A stop is at most MAX_STOP s.
 */
export const BOARD_START = 1, ASHORE_START = 3.2, BOARD_STAGGER = 0.8, OFF_START = 0.5, OFF_GAP = 1.1, QUEUE_GAP = 1.5;
export const SPAWN_AFTER = 10, SPAWN_MIN = 1, SPAWN_STEP = 0.25, QUEUE_MARGIN = 5, PAX_LOAD = 20, PAX_UNLOAD = 17, MAX_STOP = 50;

export interface MoverSched {
  m: Mover; board: Polyline; leave: Polyline;
  /** Queue: times relative to the mover's own leg start (negative: during the previous leg). */
  spawn: Trip; boardTrip: Trip;
  /** Leaving: times relative to unload start (moveEnd). */
  leave1: Trip; leave2: Trip;
  /** Arc length (front contact) of the queue head on `board`; the mover waits `queueBack` m behind it. */
  queueS: number; queueBack: number;
  /** Parked (s into the leg); tail past the deck end, at the road end (s after unload starts). */
  boardEnd: number; offDeck: number; gone: number;
}
export interface LegPlan { leg: number; movers: MoverSched[]; load: DeckLoad }
export type { DeckLoad };
export const EMPTY_LOAD = NO_LOAD;

const isBike = (m: Mover) => m.kind === 'bicycle';
const walks = (m: Mover) => m.kind === 'horse' || isBike(m);
const deckVmax = (m: Mover) => (walks(m) ? SPEED.walk : isAnimal(m.kind) ? SPEED.oxen : SPEED.deck);
const roadVmax = (m: Mover) => (walks(m) ? SPEED.walk : isAnimal(m.kind) ? SPEED.oxen : SPEED.road);
const roadLen = (m: Mover) => (isAnimal(m.kind) || isBike(m) ? ANIMAL_ROAD : CAR_ROAD);
/** Front-to-front spacing (m) of `m` waiting behind `ahead`. */
const spacing = (ahead: Mover, m: Mover) => ahead.dims.wheelbase + rearOverhang(ahead.dims) + QUEUE_GAP + m.dims.front;
const _tp: TripPoint = { s: 0, v: 0 };
/** Distance (m) of the front contact behind the queue head at time t. */
const behind = (s: MoverSched, t: number) => s.queueS - tripAt(s.spawn, t, _tp).s;

/**
 * Earliest spawn (relative) for `s` behind `ahead` in the same line: at least SPAWN_MIN s after it and never
 * closer than their spacing, sampled every SPAWN_STEP s until `s` stops.
 */
function spawnAfter(ahead: MoverSched, s: MoverSched): number {
  const gap = spacing(ahead.m, s.m) - 1e-6, dur = tripDuration(s.spawn);
  for (let t0 = ahead.spawn.t0 + SPAWN_MIN; ; t0 += SPAWN_STEP) {
    s.spawn.t0 = t0;
    let ok = true;
    for (let t = t0; t <= t0 + dur + SPAWN_STEP; t += SPAWN_STEP) if (behind(s, t) - behind(ahead, t) < gap) { ok = false; break; }
    if (ok) return t0;
  }
}

/** One leg's schedule. Times: queue/board relative to the leg's start, leaving relative to unload start. Pure. */
export function planLeg(env: DockEnv, leg: number): LegPlan {
  const { spec, layout: L } = env, T = spec.timings, Lg = legDuration(T), tr = travelOf(leg);
  const movers = legMovers(env.era.ancon.load.value, spec, L, env.seats, Number(env.era.id), leg);
  if (!movers.length) return { leg, movers: [], load: EMPTY_LOAD };
  const helmAshore = spec.helmsman;
  const out: MoverSched[] = [];
  // The waiting line (lane) and the bicycles (verge), each in boarding order: places measured back from the head.
  const lastOf: { lane?: MoverSched; verge?: MoverSched } = {};
  for (const m of movers) {
    const board = boardPath(env, m, roadLen(m)), leave = leavePath(env, m, roadLen(m)), queueS = queueHeadS(board);
    const key = isBike(m) ? 'verge' : 'lane', ahead = lastOf[key];
    const queueBack = ahead ? ahead.queueBack + spacing(ahead.m, m) : 0;
    const s: MoverSched = {
      m, board, leave, queueS, queueBack,
      spawn: { t0: 0, s0: m.dims.wheelbase, s1: queueS - queueBack, v0: 0, vmax: roadVmax(m), accel: SPEED.accel, stop: true },
      boardTrip: undefined!, leave1: undefined!, leave2: undefined!, boardEnd: 0, offDeck: 0, gone: 0,
    };
    if (ahead) s.spawn.t0 = spawnAfter(ahead, s);
    lastOf[key] = s; out.push(s);
  }
  // Spawn as early as SPAWN_AFTER s after the previous leg's cast-off, later only if everyone still arrives in time.
  const first = -Lg + T.load + T.castOff + SPAWN_AFTER, due = -T.unload - T.dock - QUEUE_MARGIN;
  const shift = Math.min(first, due - Math.max(...out.map((s) => s.spawn.t0 + tripDuration(s.spawn))));
  for (const s of out) s.spawn.t0 += shift;
  // Boarding, BOARD_STAGGER apart in boarding order.
  const start = helmAshore ? ASHORE_START : BOARD_START;
  out.forEach((s, k) => {
    const t0 = start + k * BOARD_STAGGER;
    s.boardTrip = { t0, s0: s.spawn.s1, s1: s.board.len, v0: 0, vmax: deckVmax(s.m), accel: SPEED.accel, stop: true };
    s.boardEnd = t0 + tripDuration(s.boardTrip) + 0.5;
  });
  // Leaving: nearest the leading end first (largest x'), each next when the one ahead is its length + OFF_GAP along;
  // cars and animals in one chain, bicycles in their own (rail and verge).
  const chain = (list: MoverSched[]) => {
    let t = OFF_START;
    list.forEach((s, i) => {
      const m = s.m, wb = m.dims.wheelbase, road = leaveRoadS(s.leave);
      // s is the FRONT contact; the leaving path starts at the rear contact, so the front starts at s = wb.
      s.leave1 = { t0: t, s0: wb, s1: road, v0: 0, vmax: deckVmax(m), accel: SPEED.accel, stop: false };
      s.leave2 = { t0: t + tripDuration(s.leave1), s0: road, s1: s.leave.len, v0: tripEndSpeed(s.leave1), vmax: roadVmax(m), accel: SPEED.accel, stop: false };
      s.offDeck = tripTimeAt(s.leave1, leaveOffDeckS(s.leave));
      s.gone = s.leave2.t0 + tripDuration(s.leave2);
      if (i + 1 < list.length) t = tripTimeAt(s.leave1, Math.min(road, wb + m.dims.length + OFF_GAP));
    });
  };
  const byLead = (a: MoverSched, b: MoverSched) => b.m.park.x - a.m.park.x || a.m.park.z - b.m.park.z;
  chain(out.filter((s) => !isBike(s.m)).sort(byLead));
  chain(out.filter((s) => isBike(s.m)).sort(byLead));
  const rects = out.map((s) => footprint(s.m, tr));
  // The helmsman waits ashore on the deck side away from the waiting line (its head's side of the deck axis).
  const q = pointAt(out[0].board, out[0].spawn.s1, [0, 0]), [, qz] = worldToDeck(departFrame(env, leg), q[0], q[1]);
  const ashoreZ = -Math.sign(qz || 1) * (L.halfBeam + 0.6);
  return {
    leg, movers: out,
    load: { rects, boardEnd: Math.max(0, ...out.map((s) => s.boardEnd)), offEnd: Math.max(0, ...out.map((s) => s.offDeck)) + 0.5, helmAshore, ashoreZ },
  };
}

/** Keeps the last few legs' plans (a frame reads legs n − 1, n, n + 1). */
export class LegCache {
  private readonly map = new Map<number, LegPlan>();
  constructor(readonly env: DockEnv) {}
  get(leg: number): LegPlan {
    let p = this.map.get(leg);
    if (!p) { p = planLeg(this.env, leg); this.map.set(leg, p); if (this.map.size > 4) this.map.delete(this.map.keys().next().value!); }
    return p;
  }
}

const TIMINGS = new Map<EraId, CrossingTimings>();
/**
 * The era's dock timings (spec 4c §4.3): load = PAX_LOAD after the slowest boarding, unload = PAX_UNLOAD after the
 * slowest leaving, over one pass of the era's leg cycle (twice for an odd cycle, so every rule runs both ways); never
 * shorter than today's. Memoised per era. `fields`: the 512 placement fields (<Ancon> passes its own; omitted, the
 * cached build is used). Ground heights are not needed (routes are XZ only). boardEnd and offDeck do not depend on
 * the timings (only the spawn times do), so planning with today's timings here is consistent.
 */
export function eraTimings(era: Era, fields?: WorldFields): CrossingTimings {
  const hit = TIMINGS.get(era.id);
  if (hit) return hit;
  const rules = era.ancon.load.value;
  let T = CROSSING_TIMINGS;
  if (rules.length && era.ancon.propulsion.value !== 'moored') {
    const spec = vesselSpec(era), f = fields ?? placementFields(era.river.bankOffset.value);
    const env = dockEnv(era, makePoseContext(crossingGeometry(f), spec, era.river.flow.value), () => 0);
    let board = 0, off = 0;
    for (let leg = 0; leg < (rules.length % 2 ? 2 : 1) * rules.length; leg++) { const p = planLeg(env, leg); board = Math.max(board, p.load.boardEnd); off = Math.max(off, p.load.offEnd); }
    T = { ...CROSSING_TIMINGS, load: Math.max(CROSSING_TIMINGS.load, Math.ceil(board + PAX_LOAD)), unload: Math.max(CROSSING_TIMINGS.unload, Math.ceil(off + PAX_UNLOAD)) };
  }
  TIMINGS.set(era.id, T);
  return T;
}
