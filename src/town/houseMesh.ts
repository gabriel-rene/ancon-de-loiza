import * as THREE from 'three';
import type { PartBuilder } from '../ancon/vessels/common';
import { corners, toWorld, type Builders, type Footprint, type GroundAt } from '../infrastructure/parts';
import type { House } from './town';

/**
 * Town houses (spec 4b §3), seen from 150–350 m: one block for the walls, flat dark door and windows, painted
 * shutters. Huts: bare walls on low posts, thatched hip roof. Wood: painted walls on zocos, zinc gable roof
 * with the ridge along the long side. Concrete: plinth to the lowest corner, flat roof with parapet.
 * Heights inferred (L). Local +X is the long side (footprints from layout.orientedBox).
 */
export const HOUSE = { wall: { hut: 2.2, wood: 2.6, concrete: 2.9 }, zoco: { hut: 0.3, wood: 0.6 }, tilt: 0.38, eave: 0.5 } as const;
export const HOUSE_TRIANGLES = 160;
const C = { post: 0x5f5549, dark: 0x1d1b19, trim: 0xe6e0d2, band: 0x3f7f7a, plinth: 0xb9b4a8, roof: 0xd8d2c4 };

const box = (pb: PartBuilder, f: Footprint, size: [number, number, number], lx: number, y: number, lz: number, color: number, rotZ = 0) => {
  const [x, z] = toWorld(f, lx, lz);
  pb.box(size, [x, y, z], color, rotZ, f.yaw);
};
function groundRange(f: Footprint, g: GroundAt): [number, number] {
  const hs = corners(f).map(([x, z]) => g(x, z)).concat(g(f.c[0], f.c[1]));
  return [Math.min(...hs), Math.max(...hs)];
}
/** Four posts from 0.3 m inside the ground up to `top`. */
function posts(pb: PartBuilder, f: Footprint, g: GroundAt, top: number) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [x, z] = toWorld(f, sx * (f.hx - 0.3), sz * (f.hz - 0.3)), gy = g(x, z) - 0.3;
    pb.box([0.2, top - gy, 0.2], [x, (top + gy) / 2, z], C.post, 0, f.yaw);
  }
}
/** Zinc gable, ridge along local X: built on the footprint turned 90° so the slabs tilt about the ridge. Gable ends in wood. */
function gable(b: Builders, f: Footprint, top: number, wall: number) {
  const r: Footprint = { c: f.c, yaw: f.yaw + Math.PI / 2, hx: f.hz, hz: f.hx };
  const o = HOUSE.eave, run = r.hx + o, rise = Math.tan(HOUSE.tilt) * run, len = run / Math.cos(HOUSE.tilt);
  for (const s of [-1, 1]) box(b.zinc, r, [len, 0.04, 2 * r.hz + 2 * o], (s * run) / 2, top + rise / 2, 0, 0xffffff, -s * HOUSE.tilt);
  const tri = new THREE.CylinderGeometry(1, 1, 2 * r.hz, 3, 1);
  tri.rotateX(-Math.PI / 2);
  const riseIn = Math.tan(HOUSE.tilt) * r.hx;
  tri.scale(r.hx / 0.866, riseIn / 1.5, 1);
  tri.translate(0, top + 0.5 * (riseIn / 1.5), 0);
  tri.rotateY(r.yaw); tri.translate(r.c[0], 0, r.c[1]);
  b.wood.add(tri, wall);
}
/** Thatched hip roof: a square pyramid stretched over the footprint with an overhang. */
function hip(pb: PartBuilder, f: Footprint, top: number, rise = 1.8, o = 0.6) {
  const g = new THREE.ConeGeometry(1, rise, 4, 1);
  g.rotateY(Math.PI / 4);
  g.scale((f.hx + o) / 0.7071, 1, (f.hz + o) / 0.7071);
  g.translate(0, top + rise / 2 - 0.15, 0);
  g.rotateY(f.yaw); g.translate(f.c[0], 0, f.c[1]);
  pb.add(g, 0xffffff);
}

export function buildHouse(b: Builders, h: House, g: GroundAt) {
  const f = h.fp, [gmin, gmax] = groundRange(f, g);
  if (h.look === 'concrete') {
    const floor = gmax + 0.25, H = HOUSE.wall.concrete, top = floor + H;
    box(b.concrete, f, [2 * f.hx + 0.3, floor - gmin + 0.3, 2 * f.hz + 0.3], 0, (floor + gmin - 0.3) / 2, 0, C.plinth);
    box(b.concrete, f, [2 * f.hx, H, 2 * f.hz], 0, floor + H / 2, 0, h.paint);
    box(b.concrete, f, [2 * f.hx + 0.3, 0.6, 2 * f.hz + 0.3], 0, top + 0.3, 0, C.roof);   // flat roof and parapet
    box(b.iron, f, [0.05, 2.0, 0.9], -f.hx - 0.03, floor + 1.0, 0, C.dark);                 // door
    for (const s of [-1, 1]) box(b.iron, f, [1.3, 1.1, 0.05], 0, floor + 1.6, s * (f.hz + 0.03), C.dark);   // windows
    return;
  }
  const floor = gmax + HOUSE.zoco[h.look], H = HOUSE.wall[h.look], top = floor + H;
  posts(b.wood, f, g, floor);
  box(b.wood, f, [2 * f.hx, H, 2 * f.hz], 0, floor + H / 2, 0, h.paint);
  box(b.wood, f, [0.05, 2.0, 0.9], -f.hx - 0.03, floor + 1.0, 0, C.dark);
  if (h.look === 'hut') { hip(b.thatch, f, top); return; }
  for (const s of [-1, 1]) box(b.wood, f, [0.9, 1.0, 0.05], 0, floor + 1.5, s * (f.hz + 0.03), s > 0 ? C.band : C.trim);   // shutters (tormenteras)
  gable(b, f, top, h.paint);
}
