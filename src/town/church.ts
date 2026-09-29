import * as THREE from 'three';
import type { PartBuilder } from '../ancon/vessels/common';
import { toWorld, type Builders, type Footprint, type GroundAt } from '../infrastructure/parts';
import { LOT, type ChurchPlan } from './layout';

/**
 * Parroquia del Espíritu Santo y San Patricio (spec 4b §2): one nave with massive walls and buttresses, a
 * two-storey three-bay front, a belfry (bell gable) with two open-arch bells over the front [S14] H, on its
 * OSM outline [S26] H. The front is the end facing the plaza; the bell gable stands on its centre bay, two
 * bells side by side in one open arch, a cross on top. Heights, the low barrel roof and the lime-white
 * paint are inferred (L). Same in every era (1729 enlargement).
 */
/** Heights (m) above the floor; gable = bell-gable width, arch = its opening height, buttress = depth past the wall. */
export const CHURCH = { wall: 9, front: 13, gable: 4, arch: 2.6, buttress: 1.6, buttressEvery: 6 } as const;
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
    box(c, f, [1.2, top - 1 - base, CHURCH.buttress], -hx + ((k + 0.5) * 2 * hx) / n, (top - 1 + base) / 2, s * (hz + CHURCH.buttress / 2), LIME);
  }

  // Front: wall, cornice between the storeys, four pilasters (three bays), top, door, upper windows.
  const fx = e * (hx + 0.4), H = CHURCH.front;
  box(c, f, [0.8, floor + H - base, 2 * hz + 1], fx, (floor + H + base) / 2, 0, LIME);
  box(c, f, [1.0, 0.4, 2 * hz + 1.4], fx + e * 0.1, floor + 6.5, 0, TRIM);
  for (const lz of [-hz - 0.2, -hz / 3, hz / 3, hz + 0.2]) box(c, f, [1.0, H, 0.5], fx + e * 0.1, floor + H / 2, lz, TRIM);
  box(c, f, [0.8, 1.6, hz], fx, floor + H + 0.8, 0, LIME);
  box(b.iron, f, [0.1, 4, 2.2], fx + e * 0.45, floor + 2, 0, DARK);
  for (const lz of [(-2 * hz) / 3, 0, (2 * hz) / 3]) box(b.iron, f, [0.1, 1.8, 1.0], fx + e * 0.45, floor + 9, lz, DARK);

  // Bell gable (espadaña) on the centre bay, over the front's top: two piers and a top around one open
  // arch, a cross on top, two bells side by side in the arch on a beam.
  const y0 = floor + H + 1.6, W = CHURCH.gable, A = CHURCH.arch, pier = 0.9;
  for (const s of [-1, 1]) box(c, f, [0.8, A, pier], fx, y0 + A / 2, s * (W / 2 - pier / 2), LIME);
  box(c, f, [0.8, 1.0, W], fx, y0 + A + 0.5, 0, LIME);
  box(b.iron, f, [0.12, 1.4, 0.12], fx, y0 + A + 1.7, 0, DARK);
  box(b.iron, f, [0.12, 0.12, 0.7], fx, y0 + A + 1.95, 0, DARK);
  box(b.iron, f, [0.1, 0.1, W - 2 * pier], fx, y0 + A - 0.15, 0, DARK);
  for (const s of [-1, 1]) {
    const [bx, bz] = toWorld(f, fx, s * 0.52);
    b.iron.cylinder(0.25, 0.42, 0.7, [bx, y0 + A - 0.6, bz], BRONZE, 'y', 8);
  }
}

// Every side part (the buttresses reach furthest) stays ≥ 1 m inside churchReach (hz + LOT.churchReach).
if (CHURCH.buttress + 1 > LOT.churchReach) throw new Error('church buttresses closer than 1 m to LOT.churchReach');
