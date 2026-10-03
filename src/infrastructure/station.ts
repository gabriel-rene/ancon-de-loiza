import * as THREE from 'three';
import { WOOD, type PartBuilder } from '../ancon/vessels/common';
import type { StationLook } from '../data/eras';
import type { XZ } from '../data/geo/types';
import { padFrame, padPoint, padYaw, type LandingPad } from '../terrain/landingPads';
import { cellRng } from '../vegetation/rng';
import type { DirtPatch } from './groundMask';
import { corners, toWorld, type Builders, type Footprint, type GroundAt } from './parts';
import { regionAspect, regionUv, type SignRegion } from './signAtlas';

/**
 * The station on the Loíza bank (spec 4a §2): a thatched shelter (1840–1900); the Cortijo house — wood on
 * zocos (1925–59; thatch, then zinc), then concrete (1975–86) — on the upstream side of the ramp, facing the
 * street; and from 1975 the family's Bar Restaurant El Ancón on the downstream bank, with the steel canopy over
 * the ramp from 1984 (the 1970s–80s photos; see eras.ts). Upstream, by the water, the neighbour's wooden house
 * that the bridge removed (1935–75; bare dirt after). Positions and sizes are inferred; everything sits inside
 * the landing clearing (≤ 22 m from its centre) and only the canopy reaches over the pad, on posts beside it.
 * Footprint local +X points inland (yaw = padYaw), local +Z = the pad's lateral axis.
 */
export interface StationLayout {
  house: Footprint | null; bar: Footprint | null; canopy: Footprint | null; shelter: Footprint | null; neighbour: Footprint;
  dirt: DirtPatch[];
  /** +1 when the upstream (bridge) side is the pad's +lateral side. */
  up: 1 | -1;
}

/** Paint (sRGB, inferred: bright Loíza vernacular, research §7; the 1975–86 colours follow the photos). */
const PAINT = {
  teal: 0x6f9f98, trim: 0xe6e0d2, pink: 0xd6a49a, cream: 0xe4d6b4, band: 0x3f7f7a, post: 0x5f5549, dark: 0x1d1b19,
  maroon: 0x7a2b2c, barCream: 0xe9e1cb, houseCream: 0xece5d3, orange: 0xc4553b, fascia: 0xb8452e, white: 0xefebe2,
  red: 0x8b2f25, stone: 0x8f897c, gate: 0x3a3d3f,
};
const WALL_H = 2.6, ZOCO = 0.6, ROOF_TILT = 0.38;
/** Bar Restaurant El Ancón: half-wall and eave heights, the closed room's length, roof overhang to the river (m, inferred from the photos). */
const BAR = { half: 1.0, eaveFront: 2.9, eaveBack: 3.35, room: 4.6, over: 0.8 };
/** The Cortijo house's front yard, between the house and the street (m). */
const YARD = 2.2;

const fp = (p: LandingPad, a: number, v: number, hx: number, hz: number): Footprint => ({ c: padPoint(p, a, v), yaw: padYaw(p), hx, hz });
/** Slide a group of footprints inland (1 m steps, ≤ 10 m) until every corner is on dry ground. */
function fitInland(p: LandingPad, group: Footprint[], dryAt: (x: number, z: number) => boolean): Footprint[] {
  for (let s = 0; s <= 10; s++) {
    const moved = group.map((f) => ({ ...f, c: [f.c[0] + p.inland[0] * s, f.c[1] + p.inland[1] * s] as XZ }));
    if (moved.every((f) => corners(f).every(([x, z]) => dryAt(x, z)))) return moved;
  }
  return group;
}
/** Trodden dirt over the pad-frame rectangle a0..a1 inland, v0..v1 lateral. */
const padDirt = (p: LandingPad, a0: number, a1: number, v0: number, v1: number): DirtPatch =>
  ({ c: padPoint(p, (a0 + a1) / 2, (v0 + v1) / 2), axis: [p.inland[0], p.inland[1]], hu: (a1 - a0) / 2, hv: Math.abs(v1 - v0) / 2 });
const dirtOf = (f: Footprint, pad: number): DirtPatch => ({ c: f.c, axis: [Math.cos(f.yaw), -Math.sin(f.yaw)], hu: f.hx + pad, hv: f.hz + pad });

export function upstreamSign(pad: LandingPad, bridge: readonly XZ[]): 1 | -1 {
  const a = bridge[0], b = bridge[bridge.length - 1];
  return padFrame(pad, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)[1] >= 0 ? 1 : -1;
}

export function stationLayout(p: LandingPad, look: StationLook, neighbourGone: boolean, up: 1 | -1, dryAt: (x: number, z: number) => boolean): StationLayout {
  const down = -up as 1 | -1, concrete = look === 'concrete' || look === 'concreteCanopy';
  let house: Footprint | null = null, bar: Footprint | null = null, shelter: Footprint | null = null;
  if (look === 'shelter') [shelter] = fitInland(p, [fp(p, 9, down * 8, 2, 1.5)], dryAt);
  // The concrete house's footprint takes in its front yard, on the ramp side: the house faces the street that
  // runs down past it to the ramp (photo 4), leaving that street's width between the yard wall and the canopy.
  else [house] = fitInland(p, [concrete ? fp(p, 11.5, up * 15.6, 3.5, 3 + YARD / 2 + 0.1) : fp(p, 11.5, up * 14.8, 3.5, 3)], dryAt);
  if (concrete) [bar] = fitInland(p, [fp(p, 7, down * 14.3, 3, 6.7)], dryAt);
  // Its river-side posts stand beside the shore view's eye (a ≈ 14), not in front of it (views.ts).
  const canopy = look === 'concreteCanopy' ? fp(p, 15, 0, 4, 6.6) : null;
  const [neighbour] = fitInland(p, [fp(p, 3.5, up * 16.5, 3.5, 2.5)], dryAt);
  const dirt: DirtPatch[] = [];
  if (house) dirt.push(dirtOf(house, 2));
  // The street's last stretch, from the end of Calle Carlos Escobar past the house to the ramp.
  if (concrete) dirt.push(padDirt(p, 7, 23, up * 6.6, up * 11.4), padDirt(p, 18, 23, up * 9, up * 16));
  if (bar) dirt.push(dirtOf(bar, 1.5));
  if (canopy) dirt.push(dirtOf(canopy, 0.5));
  if (shelter) dirt.push(dirtOf(shelter, 1.5));
  if (neighbourGone) dirt.push(dirtOf(neighbour, 1));
  return { house, bar, canopy, shelter, neighbour, dirt, up };
}

// ---- pieces (footprint-local x, y, z → world) ----
type B = Builders;
const box = (b: B['wood'], f: Footprint, size: [number, number, number], lx: number, y: number, lz: number, color: number, rotZ = 0) => {
  const [x, z] = toWorld(f, lx, lz);
  b.box(size, [x, y, z], color, rotZ, f.yaw);
};
const groundRange = (f: Footprint, g: GroundAt) => {
  const hs = corners(f).map(([x, z]) => g(x, z)).concat(g(f.c[0], f.c[1]));
  return [Math.min(...hs), Math.max(...hs)];
};

/** Posts from 0.3 m inside the ground up to `top`, on a 3 × 2 grid. */
function posts(b: B['wood'], f: Footprint, g: GroundAt, top: number, color: number, s = 0.22) {
  for (const lx of [-f.hx + 0.3, 0, f.hx - 0.3]) for (const lz of [-f.hz + 0.3, f.hz - 0.3]) {
    const [x, z] = toWorld(f, lx, lz), gy = g(x, z) - 0.3;
    b.box([s, top - gy, s], [x, (top + gy) / 2, z], color, 0, f.yaw);
  }
}
/** Gable roof, ridge along local Z, slabs in `mat`; gable ends as a triangular prism in wood. */
function gable(b: B, f: Footprint, top: number, mat: 'zinc' | 'wood', wall: number) {
  const o = 0.5, run = f.hx + o, rise = Math.tan(ROOF_TILT) * run, len = run / Math.cos(ROOF_TILT);
  for (const s of [-1, 1]) box(b[mat], f, [len, 0.04, 2 * f.hz + 2 * o], (s * run) / 2, top + rise / 2, 0, 0xffffff, -s * ROOF_TILT);
  const tri = new THREE.CylinderGeometry(1, 1, 2 * f.hz, 3, 1);
  tri.rotateX(-Math.PI / 2);
  const riseIn = Math.tan(ROOF_TILT) * f.hx;
  tri.scale(f.hx / 0.866, riseIn / 1.5, 1);
  tri.translate(0, top + 0.5 * (riseIn / 1.5), 0);
  tri.rotateY(f.yaw); tri.translate(f.c[0], 0, f.c[1]);
  b.wood.add(tri, wall);
}
/** Hip roof of thatch: a square pyramid stretched over the footprint with an overhang. */
function hip(b: B, f: Footprint, top: number, rise = 2.2, o = 0.7) {
  const g = new THREE.ConeGeometry(1, rise, 4, 1);
  g.rotateY(Math.PI / 4);
  g.scale((f.hx + o) / 0.7071, 1, (f.hz + o) / 0.7071);
  g.translate(0, top + rise / 2 - 0.15, 0);
  g.rotateY(f.yaw); g.translate(f.c[0], 0, f.c[1]);
  b.thatch.add(g, 0xffffff);
}

function woodHouse(b: B, f: Footprint, g: GroundAt, wall: number, roof: 'thatch' | 'zinc', r: () => number) {
  const [, gmax] = groundRange(f, g), floor = gmax + ZOCO, top = floor + WALL_H;
  posts(b.wood, f, g, floor, PAINT.post);
  box(b.wood, f, [2 * f.hx, 0.15, 2 * f.hz], 0, floor - 0.075, 0, WOOD.base.getHex());
  for (const s of [-1, 1]) {
    box(b.wood, f, [2 * f.hx, WALL_H, 0.1], 0, floor + WALL_H / 2, s * f.hz, wall);
    box(b.wood, f, [0.1, WALL_H, 2 * f.hz], s * f.hx, floor + WALL_H / 2, 0, wall);
    for (const t of [-1, 1]) box(b.wood, f, [0.12, WALL_H, 0.12], s * f.hx, floor + WALL_H / 2, t * f.hz, PAINT.trim);
    for (const lx of [-f.hx / 2, f.hx / 2]) box(b.wood, f, [0.9, 1.0, 0.05], lx, floor + 1.5, s * (f.hz + 0.06), r() > 0.5 ? PAINT.band : PAINT.trim);   // shutters (tormenteras)
  }
  box(b.wood, f, [0.05, 2.0, 0.9], -f.hx - 0.06, floor + 1.0, 0, PAINT.dark);   // door, facing the river
  for (let k = 0; k < 2; k++) box(b.wood, f, [0.35, 0.18, 1.1], -f.hx - 0.25 - 0.35 * k, floor - 0.2 - 0.3 * k, 0, WOOD.dark.getHex());   // steps
  if (roof === 'thatch') hip(b, f, top); else gable(b, f, top, 'zinc', wall);
}

/** Local yaw that turns a +Z-facing plane to face local `+x`, `-x`, `+z` or `-z`. */
const FACE = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '+z': 0, '-z': Math.PI } as const;
type Face = keyof typeof FACE;
const faceZ = (sign: 1 | -1): Face => (sign > 0 ? '+z' : '-z');
/**
 * A painted plane showing atlas region `r` (signAtlas.ts), w × h, centred at local (lx, y, lz) and facing `face`.
 * `lay` tips it back from upright towards lying flat, outer (lower) edge away from the wall: an awning.
 */
function decal(b: PartBuilder, f: Footprint, r: SignRegion, w: number, h: number, lx: number, y: number, lz: number, face: Face, lay?: number) {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv, [u0, v0, u1, v1] = regionUv(r);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  if (lay !== undefined) g.rotateX(-Math.PI / 2 + lay);
  g.rotateY(FACE[face] + f.yaw);
  const [x, z] = toWorld(f, lx, lz);
  g.translate(x, y, z);
  b.add(g, 0xffffff, { keepUv: true });
}
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
/** A square bar s thick between two local points [lx, y, lz]: braces and truss diagonals. */
function strut(b: PartBuilder, f: Footprint, p0: [number, number, number], p1: [number, number, number], s: number, color: number) {
  const [x0, z0] = toWorld(f, p0[0], p0[2]), [x1, z1] = toWorld(f, p1[0], p1[2]);
  _d.set(x1 - x0, p1[1] - p0[1], z1 - z0);
  const g = new THREE.BoxGeometry(s, _d.length(), s);
  g.applyQuaternion(_q.setFromUnitVectors(_up, _d.normalize()));
  g.translate((x0 + x1) / 2, (p0[1] + p1[1]) / 2, (z0 + z1) / 2);
  b.add(g, color);
}
/** A wall across local X (x0 → x1) at local z = lz, from y0 up to a top sloping from t0 (at x0) to t1 (at x1): an end wall under a shed roof. */
function slopeWall(b: PartBuilder, f: Footprint, lz: number, x0: number, x1: number, y0: number, t0: number, t1: number, thick: number, color: number) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, t1), new THREE.Vector2(x0, t0)]),
    { depth: thick, bevelEnabled: false });
  g.translate(0, 0, lz - thick / 2); g.rotateY(f.yaw); g.translate(f.c[0], 0, f.c[1]);
  b.add(g, color);
}
/** The El Ancón de Loíza sign, readable from both sides along local ±X: a painted board on short legs from `base`. */
function loizaSign(b: B, f: Footprint, w: number, lx: number, lz: number, base: number, legs: number) {
  const h = w / regionAspect('loiza'), y = base + legs + h / 2;
  box(b.concrete, f, [0.12, h + 0.08, w + 0.08], lx, y, lz, PAINT.white);
  for (const s of [-1, 1] as const) decal(b.sign, f, 'loiza', w, h, lx + s * 0.062, y, lz, s > 0 ? '+x' : '-x');
  for (const t of [-0.35, 0.35]) box(b.iron, f, [0.08, legs + 0.1, 0.08], lx, base + legs / 2, lz + t * w, PAINT.gate);
}

/**
 * Bar Restaurant El Ancón (1975–86), after the photos: long and low along the bank on a stone river wall;
 * the downstream part an open dining room behind a lettered maroon half-wall and wooden posts, the end by the
 * ramp a closed cream-over-maroon room with dark doors; one rusty zinc shed roof sloping to the river. In 1975
 * the El Ancón de Loíza sign stands on its roof (it later moved onto the canopy).
 */
function bar(b: B, f: Footprint, g: GroundAt, zs: 1 | -1, signOnRoof: boolean) {
  const [gmin, gmax] = groundRange(f, g), floor = gmax + 0.35, { half, room, over } = BAR;
  const slope = (BAR.eaveBack - BAR.eaveFront) / (2 * f.hx), tilt = Math.atan(slope);
  const roofY = (lx: number) => floor + BAR.eaveFront + (lx + f.hx) * slope;
  const low = Math.min(gmin, 0) - 0.7;
  box(b.concrete, f, [2 * f.hx + 0.6, floor - low, 2 * f.hz + 0.3], -0.3, (floor + low) / 2, 0, PAINT.stone);   // river wall + floor
  const dl = 2 * f.hz - room, dz = -zs * room / 2, rz = zs * (f.hz - room / 2);   // dining length and centre, room centre
  // Dining room: half-walls on three sides, lettered on the river face; posts carry the roof.
  for (const s of [-1, 1]) box(b.concrete, f, [0.2, half, dl], s * (f.hx - 0.1), floor + half / 2, dz, PAINT.maroon);
  box(b.concrete, f, [2 * f.hx, half, 0.2], 0, floor + half / 2, -zs * (f.hz - 0.1), PAINT.maroon);
  decal(b.sign, f, 'barFront', dl - 0.3, half - 0.1, -f.hx - 0.012, floor + half / 2, dz, '-x');
  const n = Math.round(dl / 2.2);
  for (let k = 0; k < n; k++) for (const s of [-1, 1]) {
    const lx = s * (f.hx - 0.1), lz = -zs * (f.hz - 0.15) + zs * (k * (dl - 0.15)) / n, top = roofY(lx);
    box(b.wood, f, [0.14, top - floor - half, 0.14], lx, (top + floor + half) / 2, lz, WOOD.dark.getHex());
  }
  // Closed room: maroon lower band, cream above, full height to the sloping roof.
  for (const s of [-1, 1]) {
    const lx = s * (f.hx - 0.1), top = roofY(lx);
    box(b.concrete, f, [0.2, half, room], lx, floor + half / 2, rz, PAINT.maroon);
    box(b.concrete, f, [0.2, top - floor - half, room], lx, (top + floor + half) / 2, rz, PAINT.barCream);
  }
  for (const lz of [zs * (f.hz - 0.1), zs * (f.hz - room)]) {
    box(b.concrete, f, [2 * f.hx, half, 0.2], 0, floor + half / 2, lz, PAINT.maroon);
    slopeWall(b.concrete, f, lz, -f.hx, f.hx, floor + half, roofY(-f.hx), roofY(f.hx), 0.2, PAINT.barCream);
  }
  for (const t of [0.28, 0.72]) box(b.wood, f, [0.05, 1.95, 0.85], -f.hx - 0.03, floor + 0.975, zs * (f.hz - room * t), PAINT.dark);   // doors to the river
  box(b.wood, f, [0.85, 1.95, 0.05], 1.4, floor + 0.975, zs * (f.hz + 0.03), PAINT.dark);   // door to the ramp
  decal(b.sign, f, 'barRest', 4.2, 4.2 / regionAspect('barRest'), -f.hx - 0.012, floor + 2.42, rz, '-x');
  decal(b.sign, f, 'barRest', 4.2, 4.2 / regionAspect('barRest'), 0, floor + 2.55, zs * (f.hz + 0.012), faceZ(zs));
  decal(b.sign, f, 'hielo', 1.5, 1.5 / regionAspect('hielo'), -1.5, floor + 1.45, zs * (f.hz + 0.012), faceZ(zs));
  // Roof: zinc over everything, overhanging the river side; a dark fascia board along the low edge.
  const rc = (0.3 - over) / 2;
  box(b.zinc, f, [2 * f.hx + over + 0.3, 0.04, 2 * f.hz + 0.5], rc, roofY(rc) + 0.02, 0, 0xc9ae92, tilt);   // rusted
  box(b.wood, f, [0.04, 0.22, 2 * f.hz + 0.5], -f.hx - over, roofY(-f.hx - over) - 0.08, 0, WOOD.dark.getHex());
  for (const lz of [-f.hz + 0.5, 0, f.hz - 0.5]) strut(b.wood, f, [-f.hx, roofY(-f.hx) - 0.4, lz], [-f.hx - over + 0.05, roofY(-f.hx - over) - 0.02, lz], 0.1, WOOD.dark.getHex());
  if (signOnRoof) loizaSign(b, f, 8, 0.2, zs * 0.8, roofY(0.2), 0.45);
}

/**
 * The steel canopy over the top of the ramp (1984–86 photos): red-painted steel trusses on red posts and two
 * thick white columns, beside the ramp; a flat zinc roof; the El Ancón de Loíza sign on top facing the street
 * and the river; the weekend-trips board hanging under its inland edge.
 */
function canopy(b: B, f: Footprint, g: GroundAt) {
  const [, gmax] = groundRange(f, g), top = gmax + 5.1, deep = 0.6;
  for (const lx of [-f.hx + 0.4, 0, f.hx - 0.4]) for (const s of [-1, 1]) {
    const lz = s * (f.hz - 0.3), [x, z] = toWorld(f, lx, lz), gy = g(x, z) - 0.3;
    if (lx === 0) b.concrete.cylinder(0.28, 0.3, top - gy, [x, (top + gy) / 2, z], PAINT.white, 'y', 12);
    else box(b.iron, f, [0.22, top - gy, 0.22], lx, (top + gy) / 2, lz, PAINT.red);
  }
  // Trusses across the ramp over each post line: chords and a zigzag of diagonals.
  for (const lx of [-f.hx + 0.4, 0, f.hx - 0.4]) {
    for (const y of [top - 0.06, top - deep]) box(b.iron, f, [0.1, 0.1, 2 * f.hz], lx, y, 0, PAINT.red);
    const m = 10;
    for (let k = 0; k < m; k++) {
      const z0 = -f.hz + (k * 2 * f.hz) / m, z1 = z0 + (2 * f.hz) / m, up = k % 2 === 0;
      strut(b.iron, f, [lx, up ? top - deep : top - 0.06, z0], [lx, up ? top - 0.06 : top - deep, z1], 0.06, PAINT.red);
    }
  }
  for (const lz of [-f.hz + 0.05, -f.hz / 2, 0, f.hz / 2, f.hz - 0.05]) box(b.iron, f, [2 * f.hx + 0.2, 0.12, 0.08], 0, top - 0.12, lz, PAINT.red);   // purlins
  for (const s of [-1, 1]) box(b.iron, f, [0.06, 0.3, 2 * f.hz + 0.4], s * (f.hx + 0.2), top - 0.05, 0, PAINT.red);   // fascia
  box(b.zinc, f, [2 * f.hx + 0.4, 0.04, 2 * f.hz + 0.4], 0, top + 0.02, 0, 0xffffff);
  loizaSign(b, f, 12, f.hx - 0.8, 0, top + 0.04, 0.35);
  // Weekend-trips board, double-sided, on two wires from the inland truss.
  const bw = 2.4, bh = bw / regionAspect('paseos'), by = top - deep - 1.0, bx = f.hx - 0.4;
  box(b.concrete, f, [0.03, bh, bw], bx, by, 0, PAINT.white);
  for (const s of [-1, 1] as const) decal(b.sign, f, 'paseos', bw, bh, bx + s * 0.02, by, 0, s > 0 ? '+x' : '-x');
  for (const t of [-1, 1]) box(b.iron, f, [0.02, top - deep - by - bh / 2, 0.02], bx, (top - deep + by + bh / 2) / 2, t * bw * 0.4, PAINT.gate);
}

/**
 * The Cortijo house in concrete (1960s; the photos' 1980s look): cream walls, an orange-red fascia, a striped
 * awning over the barred porch, white jalousie windows towards the river, a small room on the roof, and a front
 * yard wall in orange-red with white pillars, a wire gate and a red iron gate. Its front faces the street
 * (local +Z × zs), with the louvred window at the inland end and the porch towards the river (photo 4); the
 * footprint takes in the yard.
 */
function casaCortijo(b: B, f: Footprint, g: GroundAt, zs: 1 | -1) {
  const [gmin, gmax] = groundRange(f, g), floor = gmax + 0.3, H = 2.8, top = floor + H;
  const hz = f.hz - YARD / 2, cz = -zs * YARD / 2, front = cz + zs * hz, back = cz - zs * hz;   // house body
  box(b.concrete, f, [2 * f.hx + 0.3, floor - gmin + 0.3, 2 * hz + 0.3], 0, (floor + gmin - 0.3) / 2, cz, 0xb9b4a8);   // plinth
  for (const lz of [front - zs * 0.1, back + zs * 0.1]) box(b.concrete, f, [2 * f.hx, H, 0.2], 0, floor + H / 2, lz, PAINT.houseCream);
  for (const s of [-1, 1]) box(b.concrete, f, [0.2, H, 2 * hz - 0.4], s * (f.hx - 0.1), floor + H / 2, cz, PAINT.houseCream);
  box(b.concrete, f, [2 * f.hx + 0.5, 0.2, 2 * hz + 0.5], 0, top + 0.1, cz, 0xd8d2c4);   // flat roof
  for (const s of [-1, 1]) {
    box(b.concrete, f, [2 * f.hx + 0.6, 0.32, 0.12], 0, top + 0.1, cz + s * (hz + 0.28), PAINT.fascia);
    box(b.concrete, f, [0.12, 0.32, 2 * hz + 0.6], s * (f.hx + 0.28), top + 0.1, cz, PAINT.fascia);
  }
  // Front: the porch, a dark recess behind an iron grille, towards the river; a jalousie window at the inland end.
  const px = -0.5, pw = 3.6;
  box(b.wood, f, [pw, 2.3, 0.04], px, floor + 1.15, front + zs * 0.02, PAINT.dark);
  for (let k = 0; k <= 12; k++) box(b.iron, f, [0.03, 2.3, 0.03], px - pw / 2 + (k * pw) / 12, floor + 1.15, front + zs * 0.06, PAINT.gate);
  for (const y of [floor + 0.05, floor + 1.15, floor + 2.28]) box(b.iron, f, [pw, 0.05, 0.04], px, y, front + zs * 0.06, PAINT.gate);
  box(b.wood, f, [0.9, 1.15, 0.03], f.hx - 0.9, floor + 1.55, front + zs * 0.015, PAINT.dark);
  for (let k = 0; k < 7; k++) box(b.concrete, f, [0.86, 0.035, 0.1], f.hx - 0.9, floor + 1.06 + k * 0.165, front + zs * 0.06, PAINT.white);
  const aw = 4.4, ad = 1.3, lay = 0.45, ay = top - 0.3;
  decal(b.sign, f, 'stripes', aw, ad, px, ay - (ad / 2) * Math.sin(lay), front + zs * (ad / 2) * Math.cos(lay), faceZ(zs), lay);
  decal(b.sign, f, 'stripes', aw, 0.24, px, ay - ad * Math.sin(lay) - 0.12, front + zs * ad * Math.cos(lay), faceZ(zs));
  for (const t of [-1, 1]) strut(b.iron, f, [px + (t * aw) / 2, floor + 1.9, front], [px + (t * aw) / 2, ay - ad * Math.sin(lay), front + zs * ad * Math.cos(lay)], 0.03, PAINT.gate);
  // River side: two white jalousie windows (louvres).
  for (const lz of [cz - hz / 2, cz + hz / 2]) {
    box(b.wood, f, [0.03, 1.15, 0.95], -f.hx - 0.015, floor + 1.55, lz, PAINT.dark);
    for (let k = 0; k < 7; k++) box(b.concrete, f, [0.1, 0.035, 0.9], -f.hx - 0.06, floor + 1.06 + k * 0.165, lz, PAINT.white, -0.35);
  }
  for (const lx of [-f.hx / 2, f.hx / 2]) {   // street-far side: plain windows with grilles
    box(b.iron, f, [1.1, 1.0, 0.05], lx, floor + 1.6, back - zs * 0.02, PAINT.dark);
    for (let k = -1; k <= 1; k++) box(b.iron, f, [0.03, 1.0, 0.04], lx + k * 0.35, floor + 1.6, back - zs * 0.06, PAINT.gate);
  }
  // The small room on the roof, at the back corner towards the river.
  const rx = -f.hx + 1.3, rz = back + zs * 1.2, rh = 2.0;
  box(b.concrete, f, [2.2, rh, 2.0], rx, top + 0.2 + rh / 2, rz, PAINT.white);
  box(b.concrete, f, [2.5, 0.22, 2.3], rx, top + 0.2 + rh + 0.11, rz, PAINT.fascia);
  box(b.wood, f, [0.04, 0.8, 0.7], rx - 1.12, top + 1.3, rz, PAINT.dark);
  // Yard wall along the street: orange-red, white caps and pillars; a wire gate and a red iron gate.
  const wz = zs * (f.hz - 0.12), wh = 1.0, gate = [f.hx - 1.2, 1.4] as const, iron = [-f.hx + 1.1, 1.8] as const;
  const runs: [number, number][] = [[iron[0] + iron[1] / 2, gate[0] - gate[1] / 2], [gate[0] + gate[1] / 2, f.hx]];
  for (const [x0, x1] of runs) {
    box(b.concrete, f, [x1 - x0, wh, 0.2], (x0 + x1) / 2, floor + wh / 2 - 0.15, wz, PAINT.orange);
    box(b.concrete, f, [x1 - x0, 0.06, 0.26], (x0 + x1) / 2, floor + wh - 0.12, wz, PAINT.white);
  }
  for (const s of [-1, 1]) {   // side walls back to the house
    const lz = (wz + front) / 2, len = Math.abs(wz - front);
    box(b.concrete, f, [0.2, wh, len], s * (f.hx - 0.1), floor + wh / 2 - 0.15, lz, PAINT.orange);
  }
  for (const lx of [-f.hx + 0.1, iron[0] + iron[1] / 2 + 0.16, 0, gate[0] - gate[1] / 2 - 0.16, gate[0] + gate[1] / 2 + 0.16, f.hx - 0.1])
    box(b.concrete, f, [0.32, wh + 0.3, 0.32], lx, floor + (wh + 0.3) / 2 - 0.15, wz, PAINT.white);
  for (const y of [floor + 0.05, floor + 1.2]) box(b.iron, f, [gate[1], 0.04, 0.04], gate[0], y, wz, PAINT.gate);
  for (let k = 0; k <= 7; k++) box(b.iron, f, [0.02, 1.15, 0.02], gate[0] - gate[1] / 2 + (k * gate[1]) / 7, floor + 0.62, wz, PAINT.gate);
  box(b.iron, f, [iron[1], 1.5, 0.05], iron[0], floor + 0.6, wz, PAINT.fascia);
}

function shelter(b: B, f: Footprint, g: GroundAt) {
  const [, gmax] = groundRange(f, g), top = gmax + 2.2;
  for (const lx of [-f.hx + 0.2, f.hx - 0.2]) for (const lz of [-f.hz + 0.2, f.hz - 0.2]) {
    const [x, z] = toWorld(f, lx, lz), gy = g(x, z) - 0.3;
    b.wood.cylinder(0.07, 0.09, top - gy, [x, (top + gy) / 2, z], WOOD.dark.getHex(), 'y', 6);
  }
  box(b.wood, f, [0.4, 0.08, 2 * f.hz - 0.6], -f.hx + 0.6, gmax + 0.45, 0, WOOD.base.getHex());   // bench
  hip(b, f, top, 1.6, 0.5);
}

export function buildStation(b: B, lay: StationLayout, look: StationLook, neighbour: boolean, g: GroundAt, seed: number) {
  const r = cellRng(seed, 3, 5501);
  if (lay.shelter) shelter(b, lay.shelter, g);
  if (lay.house && (look === 'concrete' || look === 'concreteCanopy')) casaCortijo(b, lay.house, g, (-lay.up) as 1 | -1);
  else if (lay.house) woodHouse(b, lay.house, g, look === 'woodThatch' ? WOOD.base.getHex() : PAINT.teal, look === 'woodThatch' ? 'thatch' : 'zinc', r);
  if (lay.bar) bar(b, lay.bar, g, lay.up, !lay.canopy);
  if (lay.canopy) canopy(b, lay.canopy, g);
  if (neighbour) woodHouse(b, lay.neighbour, g, PAINT.pink, 'zinc', r);
}
