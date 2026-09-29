import * as THREE from 'three';
import { WOOD } from '../ancon/vessels/common';
import type { StationLook } from '../data/eras';
import type { XZ } from '../data/geo/types';
import { padFrame, padPoint, padYaw, type LandingPad } from '../terrain/landingPads';
import { cellRng } from '../vegetation/rng';
import type { DirtPatch } from './groundMask';
import { corners, toWorld, type Builders, type Footprint, type GroundAt } from './parts';

/**
 * The station on the Loíza bank (spec 4a §2): a thatched shelter (1840–1900), the Cortijo house —
 * wood on zocos (1925–59; thatch, then zinc) and concrete with the bar terrace (1975–86) — and, upstream,
 * the neighbour's wooden house that the bridge removed (1935–75; bare dirt after). Positions and sizes
 * are inferred; everything sits inside the landing clearing (≤ 22 m from its centre), clear of the pad.
 * Footprint local +X points inland (yaw = padYaw), local +Z = the pad's lateral axis.
 */
export interface StationLayout {
  house: Footprint | null; terrace: Footprint | null; shelter: Footprint | null; neighbour: Footprint; dirt: DirtPatch[];
}

/** Paint (sRGB, inferred: bright Loíza vernacular, research §7; concrete house in "its 1980s colours" [S6]). */
const PAINT = { teal: 0x6f9f98, trim: 0xe6e0d2, pink: 0xd6a49a, cream: 0xe4d6b4, band: 0x3f7f7a, post: 0x5f5549, dark: 0x1d1b19 };
const WALL_H = 2.6, ZOCO = 0.6, ROOF_TILT = 0.38;

const fp = (p: LandingPad, a: number, v: number, hx: number, hz: number): Footprint => ({ c: padPoint(p, a, v), yaw: padYaw(p), hx, hz });
/** Slide a group of footprints inland (1 m steps, ≤ 10 m) until every corner is on dry ground. */
function fitInland(p: LandingPad, group: Footprint[], dryAt: (x: number, z: number) => boolean): Footprint[] {
  for (let s = 0; s <= 10; s++) {
    const moved = group.map((f) => ({ ...f, c: [f.c[0] + p.inland[0] * s, f.c[1] + p.inland[1] * s] as XZ }));
    if (moved.every((f) => corners(f).every(([x, z]) => dryAt(x, z)))) return moved;
  }
  return group;
}
const dirtOf = (f: Footprint, pad: number): DirtPatch => ({ c: f.c, axis: [Math.cos(f.yaw), -Math.sin(f.yaw)], hu: f.hx + pad, hv: f.hz + pad });

export function upstreamSign(pad: LandingPad, bridge: readonly XZ[]): 1 | -1 {
  const a = bridge[0], b = bridge[bridge.length - 1];
  return padFrame(pad, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)[1] >= 0 ? 1 : -1;
}

export function stationLayout(p: LandingPad, look: StationLook, neighbourGone: boolean, up: 1 | -1, dryAt: (x: number, z: number) => boolean): StationLayout {
  const down = -up as 1 | -1;
  let house: Footprint | null = null, terrace: Footprint | null = null, shelter: Footprint | null = null;
  if (look === 'shelter') [shelter] = fitInland(p, [fp(p, 9, down * 8, 2, 1.5)], dryAt);
  else if (look === 'concrete') [house, terrace] = fitInland(p, [fp(p, 14, down * 12, 5, 4), fp(p, 6.75, down * 12, 2.25, 4)], dryAt);
  else [house] = fitInland(p, [fp(p, 13, down * 11, 4, 3)], dryAt);
  const [neighbour] = fitInland(p, [fp(p, 12, up * 12.5, 3.5, 2.5)], dryAt);
  const dirt: DirtPatch[] = [];
  if (house) dirt.push(dirtOf(house, 2));
  if (shelter) dirt.push(dirtOf(shelter, 1.5));
  if (neighbourGone) dirt.push(dirtOf(neighbour, 1));
  return { house, terrace, shelter, neighbour, dirt };
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

function concreteHouse(b: B, f: Footprint, t: Footprint, g: GroundAt) {
  const [gmin, gmax] = groundRange(f, g), floor = gmax + 0.25, H = 2.9, top = floor + H;
  box(b.concrete, f, [2 * f.hx + 0.4, floor - gmin + 0.3, 2 * f.hz + 0.4], 0, (floor + gmin - 0.3) / 2, 0, 0xb9b4a8);   // plinth
  for (const s of [-1, 1]) {
    box(b.concrete, f, [2 * f.hx, H, 0.2], 0, floor + H / 2, s * f.hz, PAINT.cream);
    box(b.concrete, f, [0.2, H, 2 * f.hz], s * f.hx, floor + H / 2, 0, PAINT.cream);
    box(b.concrete, f, [2 * f.hx + 0.04, 0.35, 0.22], 0, floor + 0.18, s * f.hz, PAINT.band);   // painted base band
    for (const lx of [-f.hx / 2, f.hx / 2]) {
      box(b.iron, f, [1.3, 1.1, 0.05], lx, floor + 1.6, s * (f.hz + 0.11), PAINT.dark);        // window
      for (let k = -1; k <= 1; k++) box(b.iron, f, [0.03, 1.1, 0.04], lx + k * 0.4, floor + 1.6, s * (f.hz + 0.15), 0x2b2826);   // grille
    }
  }
  box(b.concrete, f, [2 * f.hx + 0.6, 0.25, 2 * f.hz + 0.6], 0, top + 0.12, 0, 0xd8d2c4);   // flat roof
  for (const s of [-1, 1]) {
    box(b.concrete, f, [2 * f.hx + 0.6, 0.5, 0.15], 0, top + 0.5, s * (f.hz + 0.22), PAINT.cream);
    box(b.concrete, f, [0.15, 0.5, 2 * f.hz + 0.6], s * (f.hx + 0.22), top + 0.5, 0, PAINT.cream);
  }
  // The bar terrace over the river side: slab, columns, a zinc roof sloping to the river, an iron rail.
  box(b.concrete, t, [2 * t.hx, 0.2, 2 * t.hz], 0, floor - 0.1, 0, 0xc9c2b2);
  for (const lx of [-t.hx + 0.2, t.hx - 0.2]) for (const lz of [-t.hz + 0.2, 0, t.hz - 0.2]) {
    const [x, z] = toWorld(t, lx, lz), gy = g(x, z) - 0.3;
    b.concrete.box([0.25, floor + 2.7 - gy, 0.25], [x, (floor + 2.7 + gy) / 2, z], PAINT.trim, 0, t.yaw);
  }
  box(b.zinc, t, [2 * t.hx + 0.6, 0.04, 2 * t.hz + 0.4], 0, floor + 2.75, 0, 0xffffff, 0.12);
  for (const s of [-1, 1]) box(b.iron, t, [2 * t.hx, 0.05, 0.05], 0, floor + 0.95, s * t.hz, 0x2b2826);
  box(b.iron, t, [0.05, 0.05, 2 * t.hz], -t.hx, floor + 0.95, 0, 0x2b2826);
  for (let k = 0; k <= 8; k++) box(b.iron, t, [0.04, 0.95, 0.04], -t.hx, floor + 0.47, -t.hz + (k * 2 * t.hz) / 8, 0x2b2826);
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
  if (lay.house && look === 'concrete') concreteHouse(b, lay.house, lay.terrace!, g);
  else if (lay.house) woodHouse(b, lay.house, g, look === 'woodThatch' ? WOOD.base.getHex() : PAINT.teal, look === 'woodThatch' ? 'thatch' : 'zinc', r);
  if (neighbour) woodHouse(b, lay.neighbour, g, PAINT.pink, 'zinc', r);
}
