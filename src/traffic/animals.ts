import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PartBuilder, WOOD } from '../ancon/vessels/common';
import { segmentMatrix, type V3 } from '../people/rig';
import { colored as tint } from './carKit';
import { DIMS } from './models';

export type Species = 'ox' | 'horse';
/**
 * Joint layout (m, the animal's own frame): shoulder and hip joints [x, y], legs at ±legZ, upper and lower leg
 * lengths (upper + lower = joint height, so a straight leg stands on the ground), leg radius, stride length.
 * Criollo oxen and a small country horse, inferred (L).
 */
export interface Anatomy { length: number; shoulder: [number, number]; hip: [number, number]; legZ: number; upper: number; lower: number; r: number; stride: number }
export const ANATOMY: Record<Species, Anatomy> = {
  ox: { length: 2.3, shoulder: [0.65, 1.0], hip: [-0.65, 1.0], legZ: 0.2, upper: 0.45, lower: 0.55, r: 0.075, stride: 1.4 },
  horse: { length: 2.4, shoulder: [0.6, 1.25], hip: [-0.6, 1.25], legZ: 0.17, upper: 0.55, lower: 0.7, r: 0.06, stride: 1.6 },
};
export const ANIMAL_TRIS = { oxBody: 1200, horseBody: 1000, leg: 60, cart: 800, cartWheel: 200, bicycle: 700 };

const COAT = 0xffffff, HORN = 0xe0d6bd, MUZZLE = 0x3a2e28, HOOF = 0x2a2420, MANE = 0x2a1f18;
const ellipsoid = (rx: number, ry: number, rz: number, x: number, y: number, z: number, seg = 10) => new THREE.SphereGeometry(1, seg, Math.max(4, seg - 4)).scale(rx, ry, rz).translate(x, y, z);
/** A tapered limb from a to b (radius r0 at a, r1 at b): a unit-height cylinder (y 0 → −1; radiusTop lands on a) placed by segmentMatrix, which stretches y only. */
const limb = (a: V3, b: V3, r0: number, r1: number, seg = 6) =>
  new THREE.CylinderGeometry(r0, r1, 1, seg).translate(0, -0.5, 0).applyMatrix4(segmentMatrix(a, b, 1, 1, new THREE.Matrix4()));
const boxy = (sx: number, sy: number, sz: number, x: number, y: number, z: number, rotZ: number) => new THREE.BoxGeometry(sx, sy, sz).rotateZ(rotZ).translate(x, y, z);
/** Merge non-indexed pieces; their own (smooth, matrix-transformed) normals are kept. */
const merge = (list: THREE.BufferGeometry[]) => { const m = mergeGeometries(list, false)!; list.forEach((g) => g.dispose()); return m; };

export function buildAnimalBody(sp: Species): THREE.BufferGeometry {
  if (sp === 'ox') return merge([
    tint(ellipsoid(0.98, 0.4, 0.3, 0, 1.08, 0, 12), COAT),                   // barrel
    tint(ellipsoid(0.28, 0.2, 0.2, 0.55, 1.38, 0), COAT),                    // hump
    tint(limb([0.8, 1.2, 0], [1.1, 1.0, 0], 0.2, 0.16), COAT),               // neck
    tint(ellipsoid(0.26, 0.17, 0.14, 1.28, 0.9, 0), COAT),                   // head
    tint(ellipsoid(0.1, 0.09, 0.1, 1.48, 0.8, 0), MUZZLE),                   // muzzle
    tint(limb([1.22, 1.02, 0.1], [1.3, 1.28, 0.3], 0.035, 0.012, 5), HORN), tint(limb([1.22, 1.02, -0.1], [1.3, 1.28, -0.3], 0.035, 0.012, 5), HORN),
    tint(limb([-0.95, 1.2, 0], [-1.02, 0.55, 0], 0.03, 0.02, 5), COAT),      // tail
    tint(ellipsoid(0.18, 0.2, 0.06, 0.95, 0.75, 0), COAT),                   // dewlap
  ]);
  return merge([
    tint(ellipsoid(0.85, 0.36, 0.27, 0, 1.3, 0, 12), COAT),
    tint(limb([0.62, 1.45, 0], [1.02, 1.88, 0], 0.2, 0.13), COAT),           // neck
    tint(ellipsoid(0.3, 0.12, 0.11, 1.2, 1.78, 0), COAT),                    // head
    tint(ellipsoid(0.09, 0.08, 0.09, 1.44, 1.72, 0), MUZZLE),
    tint(boxy(0.5, 0.2, 0.06, 0.82, 1.78, 0, 0.8), MANE),                    // mane along the neck
    tint(limb([-0.84, 1.42, 0], [-0.98, 0.7, 0], 0.07, 0.03, 5), MANE),      // tail
  ]);
}

/**
 * Unit leg segment (y 0 → −1, radius 1 at the top, 0.8 at the bottom). With `hoof` (the lower segment, default) the lowest 12 %
 * (y < −0.88) is a dark hoof band, a hard step at a split ring; `hoof = false` (the upper segment) is coat all the way, so the knee stays clean.
 */
export const HOOF_Y = -0.88;
export function buildLegSegment(hoof = true): THREE.BufferGeometry {
  const cyl = (y0: number, y1: number, hex: number) => tint(new THREE.CylinderGeometry(1 - 0.2 * -y0, 1 - 0.2 * -y1, y0 - y1, 6, 1).translate(0, (y0 + y1) / 2, 0), hex);
  return merge(hoof ? [cyl(0, HOOF_Y, COAT), cyl(HOOF_Y, -1, HOOF)] : [cyl(0, -1, COAT)]);
}

/**
 * Lateral-sequence walk: right hind, right fore, left hind, left fore, a quarter stride apart (+Z is the right-hand side in the mover frame).
 * Order of `out`: RF, LF, RH, LH (upper), then the same four lower. `moving` is a gait amplitude 0..1 (true = 1, false = 0) scaling swing and lift,
 * so a mover easing between walk and stand does not snap its legs.
 */
const OFF = [0.25, 0.75, 0, 0.5];
const _j: V3 = [0, 0, 0], _k: V3 = [0, 0, 0], _f: V3 = [0, 0, 0], _m = new THREE.Matrix4();
export function legMatrices(sp: Species, dist: number, moving: boolean | number, world: THREE.Matrix4, out: THREE.Matrix4[]) {
  const A = ANATOMY[sp], ph = dist / A.stride, amp = moving === true ? 1 : moving === false ? 0 : Math.min(1, Math.max(0, moving));
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, side = i % 2 === 0 ? 1 : -1, [jx, jy] = fore ? A.shoulder : A.hip;
    const c = Math.sin(2 * Math.PI * (ph + OFF[i]));
    const swing = 0.32 * c * amp, lift = amp * Math.max(0, Math.sin(2 * Math.PI * (ph + OFF[i]) + 0.9));
    const bend = (fore ? 1 : -1) * 0.9 * lift;   // fore knees fold back, hocks forward
    _j[0] = jx; _j[1] = jy; _j[2] = side * A.legZ;
    _k[0] = jx + A.upper * Math.sin(swing); _k[1] = jy - A.upper * Math.cos(swing); _k[2] = _j[2];
    const lo = swing - bend;
    _f[0] = _k[0] + A.lower * Math.sin(lo); _f[1] = Math.max(0, _k[1] - A.lower * Math.cos(lo)); _f[2] = _j[2];
    out[i].copy(segmentMatrix(_j, _k, A.r, A.r, _m)).premultiply(world);
    out[i + 4].copy(segmentMatrix(_k, _f, A.r * 0.8, A.r * 0.8, _m)).premultiply(world);
  }
}

/** The two yoked oxen stand side by side at ±OXEN_Z, their front hooves on the cart mover's front contact. */
export const OXEN_Z = 0.42;
export const oxenCentreX = (kind: 'oxCart' | 'caneCart') => DIMS[kind].wheelbase / 2 - ANATOMY.ox.shoulder[0];

/** Cart (mover frame: origin between the oxen's front hooves and the cart axle, +X toward the oxen): bed, rails, tongue, yoke; cane: stakes and a load. */
export function buildCart(kind: 'oxCart' | 'caneCart'): THREE.BufferGeometry {
  const d = DIMS[kind], b = new PartBuilder(), ax = -d.wheelbase / 2, bedY = d.wheelR + 0.25, bedL = 2.4, bedW = d.width - 0.3;
  const tone = WOOD.base.getHex(), dark = WOOD.dark.getHex();
  b.box([bedL, 0.08, bedW], [ax, bedY, 0], tone);
  for (const s of [-1, 1]) b.box([bedL, 0.3, 0.05], [ax, bedY + 0.19, s * (bedW / 2)], tone);
  b.box([0.05, 0.3, bedW], [ax - bedL / 2, bedY + 0.19, 0], tone);
  b.box([0.14, 0.14, 0.2], [ax, d.wheelR, 0], dark);                      // axle block
  b.box([0.08, 0.08, 2 * d.track], [ax, d.wheelR, 0], dark);              // axle between the wheels, under the bed
  const yokeX = oxenCentreX(kind) + 1.05, yokeY = 1.18, tongue0 = ax + bedL / 2;
  b.add(limb([tongue0 - 0.1, bedY, 0], [yokeX, yokeY, 0], 0.05, 0.05, 6), dark, { grain: 'x' });   // tongue, sloping from the bed up to the yoke, ends buried in both
  b.box([0.12, 0.1, 2 * OXEN_Z + 0.5], [yokeX, yokeY, 0], dark);         // yoke across both necks
  if (kind === 'caneCart') {
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) b.cylinder(0.025, 0.025, 1.0, [ax - bedL / 2 + 0.2 + i * 0.5, bedY + 0.55, s * (bedW / 2)], dark, 'y', 5);
    for (let i = 0; i < 3; i++) b.box([bedL - 0.1, 0.28, bedW - 0.1], [ax, bedY + 0.2 + i * 0.3, 0], [0x7c6a3a, 0x6f7a3a, 0x8a7440][i]);
  }
  return b.build();
}
/** Solid country cart wheel (unit radius, axle along z): plank disc and hub. */
export function buildCartWheel(): THREE.BufferGeometry {
  const b = new PartBuilder(), tone = WOOD.base.getHex();
  b.cylinder(1, 1, 0.16, [0, 0, 0], tone, 'z', 16);
  b.cylinder(0.22, 0.22, 0.3, [0, 0, 0], WOOD.dark.getHex(), 'z', 8);
  return b.build();
}
/** Bicycle (mover frame, +X forward): two wheels, diamond frame, seat, handlebar. White frame (instance tint), dark tyres and seat. */
export function buildBicycle(): THREE.BufferGeometry {
  const d = DIMS.bicycle, wx = d.wheelbase / 2, r = d.wheelR, frame = 0xffffff, dark = 0x1a1a1a;
  const tube = (a: V3, b: V3, rad = 0.018) => tint(limb(a, b, rad, rad, 5), frame);
  const wheel = (x: number) => tint(new THREE.TorusGeometry(r, 0.02, 5, 20).translate(x, r, 0), dark);
  const bb: V3 = [0, 0.32, 0], seat: V3 = [-0.18, 0.88, 0], head: V3 = [0.42, 0.9, 0];
  return merge([
    wheel(-wx), wheel(wx),
    tube(bb, seat), tube(seat, head), tube(bb, head), tube(bb, [-wx, r, 0]), tube(seat, [-wx, r, 0]), tube(head, [wx, r, 0]),
    tint(boxy(0.22, 0.05, 0.1, -0.2, 0.93, 0, 0), dark),
    tint(limb([0.45, 0.98, 0.26], [0.45, 0.98, -0.26], 0.012, 0.012, 5), dark),
  ]);
}
