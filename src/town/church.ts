import * as THREE from 'three';
import type { PartBuilder } from '../ancon/vessels/common';
import { toWorld, type Builders, type Footprint, type GroundAt } from '../infrastructure/parts';
import { LOT, type ChurchPlan } from './layout';

/**
 * Parroquia del Espíritu Santo y San Patricio (spec 4b §2): one nave with massive walls and buttresses, a
 * two-storey three-bay front, a belfry with two bells [S14] H, on its OSM outline [S26] H. The front is the
 * end facing the plaza; the tower stands beside the front on the nave's +Z side. Heights, the low barrel
 * roof, the tower side and the lime-white paint are inferred (L). Same in every era (1729 enlargement).
 */
export const CHURCH = { wall: 9, front: 13, towerBase: 13, belfry: 4, tower: 4, buttressEvery: 6 } as const;
export const CHURCH_TRIANGLES = 2000;
const LIME = 0xeeeae0, TRIM = 0xd9d2c3, DARK = 0x1d1b19, BRONZE = 0x5a4a32;

const box = (pb: PartBuilder, f: Footprint, size: [number, number, number], lx: number, y: number, lz: number, color: number) => {
  const [x, z] = toWorld(f, lx, lz);
  pb.box(size, [x, y, z], color, 0, f.yaw);
};

export function buildChurch(b: Builders, p: ChurchPlan, g: GroundAt) {
  const f = p.fp, e = p.front, { hx, hz } = f, c = b.concrete;
  const hs = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([sx, sz]) => g(...toWorld(f, sx * hx, sz * hz)));
  const base = Math.min(...hs) - 0.5, floor = Math.max(...hs) + 0.3, top = floor + CHURCH.wall;

  // Nave and its low barrel roof (half cylinder along local X).
  box(c, f, [2 * hx, top - base, 2 * hz], 0, (top + base) / 2, 0, LIME);
  const vault = new THREE.CylinderGeometry(hz, hz, 2 * hx, 12, 1, false, 0, Math.PI);
  vault.rotateZ(Math.PI / 2); vault.scale(1, 0.45, 1); vault.translate(0, top, 0);
  vault.rotateY(f.yaw); vault.translate(f.c[0], 0, f.c[1]);
  c.add(vault, TRIM);

  // Buttresses along both long walls.
  const n = Math.max(2, Math.floor((2 * hx) / CHURCH.buttressEvery));
  for (let k = 0; k < n; k++) for (const s of [-1, 1]) {
    box(c, f, [1.2, top - 1 - base, 1.6], -hx + ((k + 0.5) * 2 * hx) / n, (top - 1 + base) / 2, s * (hz + 0.8), LIME);
  }

  // Front: wall, cornice between the storeys, four pilasters (three bays), top, door, upper windows.
  const fx = e * (hx + 0.4), H = CHURCH.front;
  box(c, f, [0.8, floor + H - base, 2 * hz + 1], fx, (floor + H + base) / 2, 0, LIME);
  box(c, f, [1.0, 0.4, 2 * hz + 1.4], fx + e * 0.1, floor + 6.5, 0, TRIM);
  for (const lz of [-hz - 0.2, -hz / 3, hz / 3, hz + 0.2]) box(c, f, [1.0, H, 0.5], fx + e * 0.1, floor + H / 2, lz, TRIM);
  box(c, f, [0.8, 1.6, hz], fx, floor + H + 0.8, 0, LIME);
  box(b.iron, f, [0.1, 4, 2.2], fx + e * 0.45, floor + 2, 0, DARK);
  for (const lz of [(-2 * hz) / 3, 0, (2 * hz) / 3]) box(b.iron, f, [0.1, 1.8, 1.0], fx + e * 0.45, floor + 9, lz, DARK);

  // Bell tower beside the front, on the +Z side: base, four belfry piers, cap, dome, cross, two bells.
  const w = CHURCH.tower, tl = e * (hx - w / 2), tz = hz + w / 2, tb = floor + CHURCH.towerBase, bf = CHURCH.belfry;
  box(c, f, [w, tb - base, w], tl, (tb + base) / 2, tz, LIME);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(c, f, [0.8, bf, 0.8], tl + sx * (w / 2 - 0.4), tb + bf / 2, tz + sz * (w / 2 - 0.4), LIME);
  box(c, f, [w + 0.2, 0.4, w + 0.2], tl, tb + bf + 0.2, tz, TRIM);
  const [tx, tzw] = toWorld(f, tl, tz), domeY = tb + bf + 0.4;
  const dome = new THREE.ConeGeometry(w / 2, 2.2, 8, 1);
  dome.translate(tx, domeY + 1.1, tzw);
  c.add(dome, LIME);
  b.iron.box([0.12, 1.2, 0.12], [tx, domeY + 2.8, tzw], DARK, 0, f.yaw);
  b.iron.box([0.6, 0.12, 0.12], [tx, domeY + 2.95, tzw], DARK, 0, f.yaw);
  for (const s of [-1, 1]) {
    const [bx, bz] = toWorld(f, tl + s * 0.8, tz);
    b.iron.cylinder(0.3, 0.5, 0.8, [bx, tb + 1.6, bz], BRONZE, 'y', 8);
  }
}

// The tower (tz + w/2 = hz + w) must stay inside churchReach (hz + LOT.churchReach).
if (CHURCH.tower > LOT.churchReach) throw new Error('church tower wider than LOT.churchReach');
