// src/ancon/crew.ts
import { dressFigure, type FigureLook } from '../people/palettes';
import type { PoseInput, PoseKind, V3 } from '../people/rig';
import { hash3 } from '../vegetation/rng';
import { CROSSING_TIMINGS as T, type CrossingState } from './crossing';
import { clamp01, fract, lerp, lerpAngle, smooth } from './ease';
import { POLE_LEN } from './pole';
import { haulerStationX, haulerZ, type SeatAnchor } from './seats';
import { deckLayout, type DeckLayout, type VesselSpec } from './spec';
import { GUNWALE_TOP } from './vessels/timberBarge';

export type Role = 'hauler' | 'poler' | 'helmsman' | 'passenger';
export interface Actor {
  role: Role; index: number; look: FigureLook; spot: SeatAnchor | null;
  /** Passengers: their boarding / leaving plan (castActors). */
  walk?: PassengerWalk;
}
/**
 * A passenger's route: along the lane (deck-local z = `lane`) from the departure end to the spot's x, then across
 * to the spot; leaving, the reverse toward the arrival end. Start times (s into the leg) per travel direction
 * (index 0: travel +1, 1: travel −1), scheduled so nobody walks through anybody (planWalks).
 */
export interface PassengerWalk { lane: number; board: [number, number]; leave: [number, number] }
export interface ActorFrame {
  visible: boolean;
  /** Feet, deck-local. */
  pos: V3;
  /** Rotation about +Y; the figure faces local +Z at yaw 0. */
  yaw: number;
  pose: PoseInput;
  /** Figure-local hand targets (pose.handL / handR point at these when set). */
  handL: V3; handR: V3;
  hasPole: boolean; poleTop: V3; poleTip: V3;
}
export interface ActorCtx { spec: VesselSpec; layout: DeckLayout }

export const HAUL_HZ = 0.5, STROKE_S = 7, PUSH = 0.65, POLE_BED = 2.1, STEER_DEPTH = 0.5;
/** Push poles pass the hull's top edge this far outboard (pole radius 0.045 + margin). */
export const POLE_CLEAR = 0.1;
/** Seconds to lower a pole into a stroke or to steer; to ship the steering pole (reversed through the vertical). */
export const POLE_SWING = 1.6, SHIP_S = 5;
/** Seconds for a pole lifted over the gunwale while idle (standing it up / taking it down to carry). */
export const LIFT_SWING = 3;
export const WALK_SPEED = 1.4, STRIDE = 1.1, TURN_S = 0.8;
/** Haulers turn toward their rope line by atan(HAUL_TURN) ≈ 30°. */
export const HAUL_TURN = 0.58;
/** Seconds into a leg when unloading starts. */
export const MOVE_END = T.load + T.castOff + T.cross + T.dock;

export const createActorFrame = (): ActorFrame => ({
  visible: true, pos: [0, 0, 0], yaw: 0, pose: { kind: 'stand', phase: 0 }, handL: [0, 0, 0], handR: [0, 0, 0],
  hasPole: false, poleTop: [0, 0, 0], poleTip: [0, 0, 0],
});

const set3 = (o: V3, x: number, y: number, z: number) => { o[0] = x; o[1] = y; o[2] = z; return o; };
/** Yaw that faces deck direction (dx, dz). */
export const faceDir = (dx: number, dz: number) => Math.atan2(dx, dz);
/** Deck point → figure-local for a figure at `pos` facing `yaw`. */
export function toFigure(p: V3, pos: V3, yaw: number, out: V3): V3 {
  const dx = p[0] - pos[0], dz = p[2] - pos[2], c = Math.cos(yaw), s = Math.sin(yaw);
  return set3(out, dx * c - dz * s, p[1] - pos[1], dx * s + dz * c);
}

export function castActors(spec: VesselSpec, seats: SeatAnchor[], eraSeed: number, passengerScale = 1): Actor[] {
  const out: Actor[] = [];
  if (spec.moored) return out;
  const add = (role: Role, index: number, female: boolean, spot: SeatAnchor | null) =>
    out.push({ role, index, spot, look: dressFigure(spec.clothing, eraSeed * 97 + out.length, female) });
  if (spec.propulsion === 'ropes') for (let i = 0; i < spec.crew; i++) add('hauler', i, spec.anconera && i === 0, null);
  if (spec.propulsion === 'poles') {
    for (let i = 0; i < spec.crew; i++) add('poler', i, false, null);
    if (spec.helmsman) add('helmsman', 0, false, null);
  }
  // Passengers take the standing spots farthest from where the crew work first (ties: the seats' own shuffled order).
  const L = deckLayout(spec), room = crewRoom(spec, L);
  const standing = seats.filter((s) => s.kind === 'standing').map((s, k) => ({ s, k, r: room(s.pos[0], s.pos[2]) }))
    .sort((a, b) => b.r - a.r || a.k - b.k).map((e) => e.s);
  const n = Math.min(standing.length, Math.round(spec.passengers * passengerScale));
  for (let i = 0; i < n; i++) add('passenger', i, hash3(eraSeed, i, 9) / 2 ** 32 < 0.45, standing[i]);
  planWalks(out.filter((a) => a.role === 'passenger'), spec, L);
  return out;
}

/**
 * Distance (m, capped at 2) from deck point (x, z) to the nearest place the crew work: the polers' side lanes and the
 * helmsman's stations at the ends (poles), or the hauler stations (ropes).
 */
function crewRoom(spec: VesselSpec, L: DeckLayout) {
  const perSide = Math.ceil(spec.crew / 2);
  return (x: number, z: number) => {
    let d = 2;
    if (spec.propulsion === 'poles') {
      d = Math.min(d, L.halfBeam - 0.45 - Math.abs(z));
      if (spec.helmsman) d = Math.min(d, Math.hypot(Math.abs(x) - (L.halfLength - 0.5), z));
    } else if (spec.propulsion === 'ropes') for (const side of [1, -1]) for (let k = 0; k < perSide; k++)
      d = Math.min(d, Math.hypot(x - haulerStationX(k, perSide, L, side), z - haulerZ(side, L)));
    return d;
  };
}

/** Passengers walk 0.6 m off the centre line (clear of the helmsman on it at the ends); on the narrow 1935 deck, 0.5 m from the haulers. */
export const laneZ = (spec: VesselSpec, L: DeckLayout) => (spec.propulsion === 'ropes' ? Math.min(LANE_Z, Math.abs(haulerZ(1, L)) - 0.5) : LANE_Z);
/** Boarding: first start (s into the leg) and the interval between passengers; leaving: earliest start; spacing in single file (m). */
export const BOARD0 = 1, BOARD_GAP = 0.9, LEAVE0 = MOVE_END + 0.3, FILE_GAP = 0.8;

/**
 * Collision-free boarding and leaving. Boarding, the farthest spot boards first (ties: the spot farther from the lane),
 * so nobody walks past an occupied spot and each walker is BOARD_GAP behind the one ahead in the lane. Leaving, the
 * spot nearest the exit goes first (ties: nearer the lane); each passenger starts as early as possible such that they
 * join the lane at least FILE_GAP behind everyone already in it (a deterministic greedy schedule).
 */
function planWalks(pax: Actor[], spec: VesselSpec, L: DeckLayout) {
  const lane = laneZ(spec, L), x = (a: Actor) => a.spot!.pos[0], off = (a: Actor) => Math.abs(a.spot!.pos[2] - a.walk!.lane);
  for (const a of pax) a.walk = { lane: a.spot!.pos[2] >= 0 ? lane : -lane, board: [0, 0], leave: [0, 0] };
  for (const tr of [1, -1] as const) {
    const k = tr > 0 ? 0 : 1, xIn = -tr * L.halfLength, xOut = tr * L.halfLength;
    [...pax].sort((a, b) => Math.abs(x(b) - xIn) - Math.abs(x(a) - xIn) || off(b) - off(a) || a.index - b.index)
      .forEach((a, r) => { a.walk!.board[k] = BOARD0 + r * BOARD_GAP; });
    const inLane: { lane: number; x: number; te: number }[] = [];
    for (const a of [...pax].sort((a, b) => Math.abs(x(a) - xOut) - Math.abs(x(b) - xOut) || off(a) - off(b) || a.index - b.index)) {
      const lat = off(a) / WALK_SPEED;
      let te = LEAVE0 + lat;   // when a joins the lane at x(a); everyone in it is nearer the exit
      for (const j of inLane) if (j.lane === a.walk!.lane) te = Math.max(te, j.te + (FILE_GAP - Math.abs(j.x - x(a))) / WALK_SPEED);
      a.walk!.leave[k] = te - lat;
      inLane.push({ lane: a.walk!.lane, x: x(a), te });
    }
  }
}

// ---- pole shapes (deck-local): top, tip and where the two hands hold it ----
interface PoleShape { top: V3; tip: V3; hl: V3; hr: V3 }
const shape = (): PoleShape => ({ top: [0, 0, 0], tip: [0, 0, 0], hl: [0, 0, 0], hr: [0, 0, 0] });
const sA = shape(), sB = shape(), sC = shape(), sD = shape(), sE = shape();
const hL: V3 = [0, 0, 0], hR: V3 = [0, 0, 0];

/**
 * `rail`: deck-local y of the hull's top edge at the side (the gunwale cap on a timber barge, the deck edge on a
 * platform); a push pole passes outside that edge by POLE_CLEAR. `side` 0 carries a pole parallel to the centreline (helmsman).
 */
function poleShape(kind: 'upright' | 'push' | 'carry', x: number, z: number, side: number, tr: number, alpha: number, L: DeckLayout, o: PoleShape, rail = L.deckY): PoleShape {
  const y = L.deckY;
  if (kind === 'upright') {
    const pz = z + side * 0.2;
    // Butt resting on the planks (its axis end 2 cm up, so the blends into and out of it stay above the floor).
    set3(o.tip, x, y + 0.02, pz); set3(o.top, x, y + 0.02 + POLE_LEN, pz); set3(o.hr, x, y + 1.25, pz); set3(o.hl, x, y + 0.9, pz);
    return o;
  }
  let dx: number, dy: number, dz: number;
  if (kind === 'push') {
    // The lower hand a little outboard; the pole leans out just enough to pass outside the hull's top edge.
    set3(o.hr, x - tr * 0.35, y + 1.25, z + side * 0.25);
    const out = (L.halfBeam + POLE_CLEAR - Math.abs(o.hr[2])) / Math.max(0.3, o.hr[1] - rail);   // lateral per unit drop
    dx = -tr * Math.sin(alpha); dy = -Math.cos(alpha); dz = side * out * Math.cos(alpha);
  } else {
    // Carried raised along the side, the tip trailing just outside the hull (so a plant never brings it in across the
    // gunwale), the top end nearly parallel to the side (clear of the passengers standing inboard).
    dx = -tr * 0.9; dy = 0.12; dz = side * 0.1; set3(o.hr, x + tr * 0.25, y + 1.05, z + side * 0.2);
  }
  const n = Math.hypot(dx, dy, dz); dx /= n; dy /= n; dz /= n;
  const along = kind === 'push' ? (o.hr[1] + POLE_BED) / -dy : 3.6;
  set3(o.hl, o.hr[0] + dx * 0.42, o.hr[1] + dy * 0.42, o.hr[2] + dz * 0.42);
  set3(o.tip, o.hr[0] + dx * along, o.hr[1] + dy * along, o.hr[2] + dz * along);
  set3(o.top, o.tip[0] - dx * POLE_LEN, o.tip[1] - dy * POLE_LEN, o.tip[2] - dz * POLE_LEN);
  return o;
}
/** The steering pole is held by its top end (STEER_GRIP below the top), so none of it overhangs the deck crowd. */
const STEER_GRIP = 0.4;
function steerShape(xEnd: number, tr: number, sweep: number, L: DeckLayout, o: PoleShape): PoleShape {
  // Hands 0.25 m in front of him (he stands on the centreline facing +z): clear of the boarding lane at z = 0.6.
  set3(o.hl, xEnd + tr * 0.25, L.deckY + 1.15, 0.25);
  // Trailing aft and down to STEER_DEPTH below the waterline, swept slowly about the vertical.
  const along = POLE_LEN - STEER_GRIP, dy = -(o.hl[1] + STEER_DEPTH) / along, hz = Math.sqrt(1 - dy * dy);
  const c = Math.cos(sweep), s = Math.sin(sweep), bx = -tr, bz = 0;
  const dx = (bx * c + bz * s) * hz, dz = (-bx * s + bz * c) * hz;
  set3(o.hr, o.hl[0] + dx * 0.5, o.hl[1] + dy * 0.5, o.hl[2] + dz * 0.5);
  set3(o.tip, o.hl[0] + dx * along, o.hl[1] + dy * along, o.hl[2] + dz * along);
  set3(o.top, o.tip[0] - dx * POLE_LEN, o.tip[1] - dy * POLE_LEN, o.tip[2] - dz * POLE_LEN);
  return o;
}
/** Grip-to-butt distance (m) while a pole is lifted over the gunwale. */
const LIFT_S = 0.6;
const _da: V3 = [0, 0, 0], _db: V3 = [0, 0, 0], _dm: V3 = [0, 0, 0];
function axis(p: PoleShape, out: V3): V3 {
  const x = p.top[0] - p.tip[0], y = p.top[1] - p.tip[1], z = p.top[2] - p.tip[2], n = Math.hypot(x, y, z) || 1;
  return set3(out, x / n, y / n, z / n);
}
function nlerp(a: V3, b: V3, w: number, out: V3): V3 {
  const x = lerp(a[0], b[0], w), y = lerp(a[1], b[1], w), z = lerp(a[2], b[2], w), n = Math.hypot(x, y, z) || 1;
  return set3(out, x / n, y / n, z / n);
}
/**
 * Blend two pole shapes as a rigid pole pivoting in the hand: the grip (lower hand) moves linearly, the axis
 * turns (normalised lerp),
 * and the grip-to-tip distance slides (in before the swing, out after it, so the butt never sweeps the deck).
 * `lift`: three stages (¼, ½, ¼) — draw the butt up to LIFT_S below the grip, swing, run the pole out — for a pole that
 * must pass over the gunwale from a butt resting on the deck (cast-off). Hands blend linearly (applyShape then
 * puts them on the pole).
 */
function mixShape(a: PoleShape, b: PoleShape, w: number, o: PoleShape, lift = false): PoleShape {
  axis(a, _da); axis(b, _db);
  const sa = (a.hr[0] - a.tip[0]) * _da[0] + (a.hr[1] - a.tip[1]) * _da[1] + (a.hr[2] - a.tip[2]) * _da[2];
  const sb = (b.hr[0] - b.tip[0]) * _db[0] + (b.hr[1] - b.tip[1]) * _db[1] + (b.hr[2] - b.tip[2]) * _db[2];
  // Callers never blend opposite axes (a pole is reversed through the vertical), so the normalised lerp never collapses.
  const d = nlerp(_da, _db, lift ? smooth(clamp01(2 * w - 0.5)) : w, _dm);
  // Slide before swinging: a pole being shortened in the hand is drawn in early, one being run out goes out late.
  let gs: number;
  if (lift) {
    const sm = Math.min(sa, sb, LIFT_S);
    gs = w < 0.25 ? lerp(sa, sm, smooth(4 * w)) : w < 0.75 ? sm : lerp(sm, sb, smooth(4 * w - 3));
  } else gs = lerp(sa, sb, sb < sa ? smooth(clamp01(2 * w)) : smooth(clamp01(2 * w - 1)));
  // …and the butt never dips below the lower of its two end heights (the deck, when raising a pole upright).
  const gy = lerp(a.hr[1], b.hr[1], w);
  if (d[1] > 1e-3) gs = Math.min(gs, (gy - Math.min(a.tip[1], b.tip[1])) / d[1]);
  for (let k = 0; k < 3; k++) {
    const g = lerp(a.hr[k], b.hr[k], w);
    o.hl[k] = lerp(a.hl[k], b.hl[k], w); o.hr[k] = g;
    o.tip[k] = g - d[k] * gs; o.top[k] = o.tip[k] + d[k] * POLE_LEN;
  }
  return o;
}
/** Moves hand point h onto the pole axis tip + d·s (d unit, s clamped to the pole). */
function onPole(h: V3, tip: V3, dx: number, dy: number, dz: number) {
  const s = Math.min(POLE_LEN, Math.max(0, (h[0] - tip[0]) * dx + (h[1] - tip[1]) * dy + (h[2] - tip[2]) * dz));
  return set3(h, tip[0] + dx * s, tip[1] + dy * s, tip[2] + dz * s);
}
/** Write the pole (renormalised to its true length) and the hand targets; f.pos / f.yaw must already be set. */
function applyShape(s: PoleShape, f: ActorFrame) {
  const dx = s.top[0] - s.tip[0], dy = s.top[1] - s.tip[1], dz = s.top[2] - s.tip[2], n = Math.hypot(dx, dy, dz) || 1;
  set3(f.poleTip, s.tip[0], s.tip[1], s.tip[2]);
  set3(f.poleTop, s.tip[0] + (dx / n) * POLE_LEN, s.tip[1] + (dy / n) * POLE_LEN, s.tip[2] + (dz / n) * POLE_LEN);
  f.hasPole = true;
  // Grip points on the pole axis itself (the rig closes the hands `grip` short of them).
  onPole(set3(hL, s.hl[0], s.hl[1], s.hl[2]), s.tip, dx / n, dy / n, dz / n);
  onPole(set3(hR, s.hr[0], s.hr[1], s.hr[2]), s.tip, dx / n, dy / n, dz / n);
  f.pose.handL = toFigure(hL, f.pos, f.yaw, f.handL);
  f.pose.handR = toFigure(hR, f.pos, f.yaw, f.handR);
}

// ---- rope haulers ----
function ropeHand(p: number, tr: number, x: number, side: number, L: DeckLayout, out: V3): V3 {
  const pull = p < 0.5, u = pull ? p / 0.5 : (p - 0.5) / 0.5;
  const h = pull ? 0.4 - 0.6 * smooth(u) : -0.2 + 0.6 * smooth(u);
  return set3(out, x + tr * h, L.guideY + (pull ? 0 : 0.08 * Math.sin(Math.PI * u)), side * L.ropeZ);
}
function hauler(a: Actor, st: CrossingState, clock: number, { spec, layout: L }: ActorCtx, f: ActorFrame) {
  const side = a.index % 2 === 0 ? 1 : -1, perSide = Math.ceil(spec.crew / 2), x = haulerStationX(Math.floor(a.index / 2), perSide, L, side);
  set3(f.pos, x, L.deckY, haulerZ(side, L));
  const w = smooth(clamp01(st.effort / 0.3));
  // Hauling: face along the rope, turned ~30° toward it so both hands reach forward to it (no arm across the chest).
  f.yaw = lerpAngle(side > 0 ? Math.PI : 0, faceDir(st.travel, side * HAUL_TURN), w);
  if (w < 0.5) { f.pose.kind = 'stand'; f.pose.phase = fract(clock * 0.12 + a.index * 0.31); return; }
  const phi = fract(clock * HAUL_HZ + a.index * 0.37);
  f.pose.kind = 'haul'; f.pose.phase = phi;
  f.pose.handL = toFigure(ropeHand(phi, st.travel, x, side, L, hL), f.pos, f.yaw, f.handL);
  f.pose.handR = toFigure(ropeHand(fract(phi + 0.5), st.travel, x, side, L, hR), f.pos, f.yaw, f.handR);
  // Taking hold: the hands travel from where they hang to the rope as the effort builds (and back when docking).
  const k = smooth(clamp01((w - 0.5) / 0.5)), H = a.look.height;
  if (k < 1) { fromRest(f.handL, 1, H, k); fromRest(f.handR, -1, H, k); }
}
function fromRest(h: V3, sx: number, H: number, k: number) {
  h[0] = lerp(sx * REST_HAND[0] * H, h[0], k); h[1] = lerp(REST_HAND[1] * H, h[1], k); h[2] = lerp(REST_HAND[2] * H, h[2], k);
}
/** A relaxed hand's grip point, figure-local in body heights (x toward the figure's left for the left hand). */
const REST_HAND: V3 = [0.12, 0.46, 0.04];

// ---- polers ----
const strokeAt = (t: number, i: number) => fract(t / STROKE_S + i * 0.5);
function polerX(psi: number, tr: number, L: DeckLayout) {
  const xf = tr * (L.halfLength - 0.9), xb = -tr * (L.halfLength - 1.8);
  return psi < PUSH ? lerp(xf, xb, psi / PUSH) : lerp(xb, xf, (psi - PUSH) / (1 - PUSH));
}
const strokeOut = { x: 0, yaw: 0, kind: 'pole' as PoseKind, phase: 0 };
/** The stroke t s after cast-off: deck x, facing, leg pose, pole shape into `out` (blended over TURN_S at each switch). */
function stroke(t: number, i: number, side: number, z: number, tr: number, L: DeckLayout, rail: number, out: PoleShape) {
  const psi = strokeAt(t, i), push = psi < PUSH, u = push ? psi / PUSH : (psi - PUSH) / (1 - PUSH);
  const w = smooth(clamp01(((push ? psi : psi - PUSH) * STROKE_S) / TURN_S)), x = polerX(psi, tr, L);
  mixShape(poleShape(push ? 'carry' : 'push', x, z, side, tr, push ? 0.35 : 0.75, L, sB, rail),
    poleShape(push ? 'push' : 'carry', x, z, side, tr, lerp(0.35, 0.75, u), L, sA, rail), w, out);
  strokeOut.x = x;
  strokeOut.yaw = lerpAngle(faceDir(push ? tr : -tr, 0), faceDir(push ? -tr : tr, 0), w);
  strokeOut.kind = push ? 'pole' : 'walk';
  strokeOut.phase = fract((u * (2 * L.halfLength - 2.7)) / STRIDE);
  return strokeOut;
}
function poler(a: Actor, st: CrossingState, { spec, layout: L }: ActorCtx, f: ActorFrame) {
  const rail = L.deckY + (spec.kind === 'timberBarge' ? GUNWALE_TOP : 0);
  const i = a.index, side = i % 2 === 0 ? 1 : -1, z = side * (L.halfBeam - 0.45), tr = st.travel, tau = st.tLeg;
  const inboard = side > 0 ? Math.PI : 0, tEnd = MOVE_END - T.load;
  if (tau < T.load) {
    // Idle at this leg's first stroke position, pole upright; finish the turn from the walk that brought him here.
    const x = polerX(strokeAt(0, i), tr, L), from = polerX(strokeAt(tEnd, i), -tr, L), k = smooth(clamp01(tau / TURN_S));
    set3(f.pos, x, L.deckY, z);
    f.yaw = lerpAngle(faceDir(x - from, 0), inboard, k);
    f.pose.kind = 'stand'; f.pose.phase = fract(tau * 0.1 + i * 0.3);
    const kp = clamp01(tau / LIFT_SWING);   // lift stages ease themselves
    applyShape(mixShape(poleShape('carry', x, z, side, -tr, 0, L, sA), poleShape('upright', x, z, side, tr, 0, L, sB), kp, sE, true), f);
    return;
  }
  if (tau < MOVE_END) {
    const t = tau - T.load, s = stroke(t, i, side, z, tr, L, rail, sC);
    const x = s.x, yaw = s.yaw, kind = s.kind, phase = s.phase;
    set3(f.pos, x, L.deckY, z);
    f.pose.kind = kind; f.pose.phase = phase;
    // Cast-off: turn out of the idle stance toward where the stroke will be at TURN_S, and lower the upright
    // pole into the stroke over POLE_SWING.
    const kp = clamp01(t / POLE_SWING);   // lift stages ease themselves
    f.yaw = t < TURN_S ? lerpAngle(inboard, stroke(TURN_S, i, side, z, tr, L, rail, sD).yaw, smooth(t / TURN_S)) : yaw;
    if (kp < 1) applyShape(mixShape(poleShape('upright', x, z, side, tr, 0, L, sB), sC, kp, sE, true), f);
    else applyShape(sC, f);
    return;
  }
  // Unload: draw the pole in and stand it upright where the stroke ended; wait until the helmsman has shipped his
  // pole and set off along the centre line, then carry it to the next leg's first stroke position.
  const e = stroke(tEnd, i, side, z, tr, L, rail, sC), fromX = e.x, endYaw = e.yaw;
  const toX = polerX(strokeAt(0, i), -tr, L), tw = polerWalkStart(spec, L), tArr = MOVE_END + T.unload - 0.3;
  const since = tau - MOVE_END, u = smooth(clamp01((tau - tw) / (tArr - tw))), x = lerp(fromX, toX, u);
  set3(f.pos, x, L.deckY, z);
  f.yaw = lerpAngle(lerpAngle(endYaw, inboard, smooth(clamp01(since / TURN_S))), faceDir(toX - fromX, 0), smooth(clamp01((tau - tw) / TURN_S)));
  f.pose.kind = tau > tw && u < 1 ? 'walk' : 'stand';
  f.pose.phase = tau > tw ? fract(Math.abs(x - fromX) / STRIDE) : fract(tau * 0.1 + i * 0.3);
  const lift = sC.tip[1] < rail, kIn = clamp01(since / (1.5 * POLE_SWING));   // a pole in the water is lifted in over the gunwale
  if (tau < tw) applyShape(mixShape(sC, poleShape('upright', x, z, side, tr, 0, L, sB), lift ? kIn : smooth(kIn), sE, lift), f);
  // Carried with the stroke's orientation (tip toward −travel), whichever way he walks: no reversal.
  else applyShape(mixShape(poleShape('upright', x, z, side, tr, 0, L, sB), poleShape('carry', x, z, side, tr, 0, L, sA), clamp01((tau - tw) / LIFT_SWING), sE, true), f);
}
/** Polers start back to their next stroke position once the helmsman is on his way (his pole shipped). */
const polerWalkStart = (spec: VesselSpec, L: DeckLayout) => (spec.helmsman ? helmWalkStart(L) : MOVE_END) + 0.5;

// ---- helmsman ----
/** The helmsman crosses the deck at the very end of unloading, after the passengers have gone ashore (they leave by ≈ MOVE_END + 8 s). */
const helmWalkStart = (L: DeckLayout) => MOVE_END + T.unload - 0.5 - (2 * (L.halfLength - 0.5)) / WALK_SPEED;
/**
 * He carries the pole tip-first to the far end (tip toward +travel of the leg just ended), so at the start of the
 * next leg he only lowers the tip into the water astern. The one reversal per leg is the swing when he ships the
 * steering pole (in front of him, across the empty deck) just before setting off.
 */
function helmsman(st: CrossingState, clock: number, { layout: L }: ActorCtx, f: ActorFrame) {
  const tr = st.travel, tau = st.tLeg, xEnd = -tr * (L.halfLength - 0.5);
  const sweep = 0.22 * Math.sin(clock * 0.45) * (0.3 + 0.7 * st.effort);
  if (tau < MOVE_END) {
    const k = smooth(clamp01(tau / TURN_S)), kp = smooth(clamp01(tau / POLE_SWING));
    set3(f.pos, xEnd, L.deckY, 0);
    f.yaw = lerpAngle(faceDir(-tr, 0), 0, k);
    f.pose.kind = 'stand'; f.pose.phase = fract(clock * 0.1);
    applyShape(mixShape(poleShape('carry', xEnd, 0.3, 0, tr, 0, L, sA), steerShape(xEnd, tr, sweep, L, sB), kp, sE), f);
    return;
  }
  // Unload: keep steering at the trailing end, ship the pole, then walk the centreline to the far end.
  const t0 = helmWalkStart(L), d = 2 * (L.halfLength - 0.5), walked = clamp01((tau - t0) / (d / WALK_SPEED)) * d, x = xEnd + tr * walked;
  const kShip = clamp01((tau - t0 + SHIP_S) / SHIP_S), kTurn = smooth(clamp01((tau - t0) / TURN_S));
  set3(f.pos, x, L.deckY, 0);
  f.yaw = lerpAngle(0, faceDir(tr, 0), kTurn);
  f.pose.kind = tau > t0 && walked < d ? 'walk' : 'stand'; f.pose.phase = fract(tau > t0 ? walked / STRIDE : clock * 0.1);
  // Ship: draw the pole in and stand it upright in front of him, then tip it forward into the tip-first carry — the
  // reversal happens in the vertical plane in front of him, sweeping nobody.
  const up = poleShape('upright', x, 0.3, 0, tr, 0, L, sD);
  if (kShip < 0.5) applyShape(mixShape(steerShape(x, tr, sweep, L, sA), up, 2 * kShip, sE, true), f);   // the lift stages ease themselves
  else applyShape(mixShape(up, poleShape('carry', x, 0.3, 0, -tr, 0, L, sB), smooth(2 * kShip - 1), sE), f);
}

// ---- passengers ----
const LANE_Z = 0.6, SPOT_TURN = 1.2 * TURN_S;
function passenger(a: Actor, st: CrossingState, clock: number, { layout: L }: ActorCtx, f: ActorFrame) {
  const w = a.walk!, k = st.travel > 0 ? 0 : 1, spot = a.spot!, tau = st.tLeg, tr = st.travel, V = WALK_SPEED;
  const sx = spot.pos[0], sz = spot.pos[2], lz = w.lane, xIn = -tr * L.halfLength, xOut = tr * L.halfLength;
  const lat = Math.abs(sz - lz), toSpot = Math.sign(sz - lz);
  const b0 = w.board[k], bc = b0 + Math.abs(sx - xIn) / V, b1 = bc + lat / V;
  const l0 = w.leave[k], lc = l0 + lat / V, l1 = lc + Math.abs(xOut - sx) / V;
  const along = faceDir(tr, 0), across = lat > 1e-6 ? faceDir(0, toSpot) : along, back = lat > 1e-6 ? faceDir(0, -toSpot) : along;
  f.pose.kind = 'walk';
  if (tau < b0 || tau >= l1) { f.visible = false; set3(f.pos, xIn, L.deckY, lz); f.yaw = along; return; }
  if (tau < bc) {   // in along the lane
    const u = (tau - b0) * V;
    set3(f.pos, xIn + tr * u, L.deckY, lz); f.yaw = along; f.pose.phase = fract(u / STRIDE);
  } else if (tau < b1) {   // across to the spot
    const u = (tau - bc) * V;
    set3(f.pos, sx, L.deckY, lz + toSpot * u); f.yaw = lerpAngle(along, across, smooth(clamp01((tau - bc) / TURN_S)));
    f.pose.phase = fract((Math.abs(sx - xIn) + u) / STRIDE);
  } else if (tau < l0) {   // standing
    const arrived = lerpAngle(along, across, smooth(clamp01((b1 - bc) / TURN_S)));
    set3(f.pos, sx, L.deckY, sz); f.yaw = lerpAngle(arrived, spot.yaw, smooth(clamp01((tau - b1) / SPOT_TURN)));
    f.pose.kind = 'stand'; f.pose.phase = fract(clock * 0.1 + a.index * 0.37);
  } else if (tau < lc) {   // back across to the lane
    const u = (tau - l0) * V;
    set3(f.pos, sx, L.deckY, sz - toSpot * u); f.yaw = lerpAngle(spot.yaw, back, smooth(clamp01((tau - l0) / SPOT_TURN)));
    f.pose.phase = fract(u / STRIDE);
  } else {   // off along the lane to the arrival end (vanishing at the deck edge until the landings exist, Phase 4)
    const u = (tau - lc) * V, joined = lerpAngle(spot.yaw, back, smooth(clamp01((lc - l0) / SPOT_TURN)));
    set3(f.pos, sx + tr * u, L.deckY, lz); f.yaw = lerpAngle(joined, along, smooth(clamp01((tau - lc) / SPOT_TURN)));
    f.pose.phase = fract((lat + u) / STRIDE);
  }
}

const ROLE_NO: Record<Role, number> = { hauler: 0, poler: 1, helmsman: 2, passenger: 3 };
/** A stable per-person seed for poseFigure's idle motion (its low bit picks the contrapposto weight leg). */
export const actorSeed = (a: Actor) => (hash3(ROLE_NO[a.role], a.index, 31) >>> 8) & 0xffff;

/** Where actor `a` is and what they do at this crossing state. Pure; writes into and returns `out`. */
export function actorFrame(a: Actor, st: CrossingState, clock: number, ctx: ActorCtx, out: ActorFrame): ActorFrame {
  out.visible = true; out.hasPole = false;
  out.pose.handL = undefined; out.pose.handR = undefined; out.pose.lean = undefined;
  // Idle motion (breathing, weight drift, head turns) runs on the crossing clock, de-synchronised per person.
  out.pose.t = clock; out.pose.seed = actorSeed(a);
  if (a.role === 'hauler') hauler(a, st, clock, ctx, out);
  else if (a.role === 'poler') poler(a, st, ctx, out);
  else if (a.role === 'helmsman') helmsman(st, clock, ctx, out);
  else passenger(a, st, clock, ctx, out);
  return out;
}
