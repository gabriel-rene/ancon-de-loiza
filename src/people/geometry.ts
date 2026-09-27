// src/people/geometry.ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HairKind, HatKind } from './palettes';
import { FOOT_HEEL_Z, FOOT_TOE_Z, NECK_DEPTH, TAIL_Z, type PartName } from './rig';

export type Detail = 'hi' | 'lo';
export type GeoKind = 'hips' | 'torso' | 'tail' | 'head' | 'upperArm' | 'foreArm' | 'handL' | 'handR' | 'thigh' | 'shin' | 'shinFlare' | 'foot' | 'footBare' | 'skirt';
export type Hat = Exclude<HatKind, 'none'>;
export type Hair = Exclude<HairKind, 'none'>;
/** The base geometry of each part. */
export const PART_GEO: Record<PartName, GeoKind> = {
  hips: 'hips', torso: 'torso', tail: 'tail', head: 'head', upperArmL: 'upperArm', foreArmL: 'foreArm', handL: 'handL', upperArmR: 'upperArm', foreArmR: 'foreArm', handR: 'handR',
  thighL: 'thigh', shinL: 'shin', thighR: 'thigh', shinR: 'shin', footL: 'foot', footR: 'foot', skirt: 'skirt',
};
/** Per-look alternates of a base geometry (flared trouser hems, bare feet); same slots as the base. */
export const GEO_ALT: Partial<Record<GeoKind, GeoKind>> = { shin: 'shinFlare', foot: 'footBare' };
/** Triangle budgets for one figure (every part, the largest alternate, hair and hat): crew / near people, and distant ones. */
export const FIGURE_TRI_BUDGET_HI = 2500, FIGURE_TRI_BUDGET_LO = 720;

/**
 * Keeps position + normal and adds `occlusion` (0 = open, 1 = fully occluded; the figure material darkens by
 * it). An absent attribute reads as 0 in WebGL, so geometry without it renders unoccluded.
 */
function finish(g: THREE.BufferGeometry, occl: (x: number, y: number, z: number) => number = () => 0) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const p = g.attributes.position, o = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) o[i] = Math.min(1, Math.max(0, occl(p.getX(i), p.getY(i), p.getZ(i))));
  g.setAttribute('occlusion', new THREE.BufferAttribute(o, 1));
  return g;
}
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Applies f(x, y, z) → [x, y, z] to every vertex, then recomputes normals. */
function warp(g: THREE.BufferGeometry, f: (x: number, y: number, z: number) => [number, number, number]) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const [x, y, z] = f(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, x, y, z); }
  g.computeVertexNormals();
  return g;
}
/** Mirror in x, keeping the winding (and so the outward normals) correct. */
function mirrorX(g: THREE.BufferGeometry) {
  const m = g.clone().scale(-1, 1, 1), idx = m.index!;
  for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a); }
  m.computeVertexNormals();
  return m;
}

/**
 * A limb segment (y 0 → −1, radius 1) as a lathe: `radii` sampled evenly from the top joint to the bottom one,
 * closed by rounded caps of height `cap` (in segment lengths) so neighbouring segments overlap at the joints.
 * `hem` flares the last third (trouser hems).
 */
function limb(radii: number[], cap: number, radial: number, hem = 0, round = true) {
  const n = radii.length, pts: THREE.Vector2[] = [];
  const r = (i: number) => radii[i] * (1 + hem * smooth(0.6, 1, i / (n - 1)));
  // Lathe profiles run bottom → top for outward normals.
  pts.push(new THREE.Vector2(0, -1 - cap));
  if (round) pts.push(new THREE.Vector2(r(n - 1) * 0.72, -1 - cap * 0.7));
  for (let i = n - 1; i >= 0; i--) pts.push(new THREE.Vector2(r(i), -i / (n - 1)));
  if (round) pts.push(new THREE.Vector2(r(0) * 0.72, cap * 0.7));
  pts.push(new THREE.Vector2(0, cap));
  return new THREE.LatheGeometry(pts, radial);
}
/** Unit sphere of (w × h) segments, then f. */
const blob = (w: number, h: number, f: (x: number, y: number, z: number) => [number, number, number]) => warp(new THREE.SphereGeometry(1, w, h), f);

/** Shoe / bare foot in the rig's foot frame (origin at the ankle, sole y = −1, z heel → toe in foot lengths, x in foot widths). */
function foot(w: number, h: number, bare: boolean) {
  const mid = (FOOT_HEEL_Z + FOOT_TOE_Z) / 2, half = (FOOT_TOE_Z - FOOT_HEEL_Z) / 2;
  return blob(w, h, (sx, sy, sz) => {
    const z = mid + half * sz, u = (sz + 1) / 2;                                   // u: 0 heel → 1 toe
    const halfW = bare ? 0.15 + 0.07 * Math.sin(Math.PI * Math.min(1, u * 1.25)) : 0.16 + 0.05 * u;   // in foot lengths
    const top = bare ? lerp(0.05, -0.72, u * u) : lerp(0.25, -0.5, u * u);           // in foot heights
    const sole = bare ? 0.18 : 0.14, y = sy < 0 ? -1 + (1 + sy) * sole : -1 + sole + sy * (top + 1 - sole);
    const arch = bare ? 0 : 0.08 * Math.sin(Math.PI * smooth(0.15, 0.7, u)) * (sy < 0 ? 1 : 0);
    return [(sx * halfW) / 0.4, y + arch, z];
  });
}
/** Mitten hand (left): palm faces −x (toward the body), fingers curl ~30° toward the palm, thumb nub forward. */
function hand(w: number, h: number, thumb: boolean) {
  const T = 0.13, W = 0.26, pivot = -0.45;   // half thickness and half width in hand lengths
  const bend = (x: number, y: number, z: number): [number, number, number] => {
    if (y >= pivot) return [x / T, y, z / W];
    const dy = y - pivot, phi = 0.52 * Math.min(1, -dy / 0.55);
    return [(x * Math.cos(phi) + dy * Math.sin(phi)) / T, pivot - x * Math.sin(phi) + dy * Math.cos(phi), z / W];
  };
  const palm = blob(w, h, (sx, sy, sz) => {
    const y = -0.5 + sy * 0.5, taper = 1 - 0.25 * smooth(-0.5, -1, y);
    return bend(sx * T, y, sz * W * taper);
  });
  if (!thumb) return palm;
  const nub = blob(5, 3, (sx, sy, sz) => bend(-0.05 + sx * 0.08, -0.3 + sy * 0.2, 0.22 + sz * 0.08));
  return mergeGeometries([palm, nub])!;
}

/** Unit body-part geometries (see poseFigure for how each is scaled). */
export function buildFigureGeometries(detail: Detail = 'hi'): Record<GeoKind, THREE.BufferGeometry> {
  const hi = detail === 'hi', R = hi ? 8 : 5;
  const thighR = hi ? [0.78, 0.88, 0.9, 0.84, 0.7, 0.6] : [0.82, 0.82, 0.6];
  const shinR = hi ? [0.8, 1.06, 1.08, 0.92, 0.72, 0.56] : [0.9, 1.0, 0.58];
  const trouserShinR = hi ? [0.9, 1.0, 0.98, 0.9, 0.84, 0.8] : [0.9, 0.95, 0.82];
  const upperArmR = hi ? [1.0, 1.04, 0.98, 0.92, 0.88, 0.86] : [1.0, 0.92, 0.86];
  const foreArmR = hi ? [0.8, 1.02, 1.0, 0.85, 0.7, 0.58] : [0.95, 0.9, 0.6];
  const ends = (x: number, y: number) => 0.25 * smooth(-0.85, -1.15, y) + 0.12 * smooth(-0.1, 0.15, y) * (1 - Math.abs(x));   // joint creases
  const torsoPts = (hi
    ? [[0, -0.07], [0.5, -0.05], [0.72, -0.01], [0.8, 0.06], [0.74, 0.3], [0.84, 0.5], [0.9, 0.66], [0.92, 0.8], [0.8, 0.93], [0.5, 1.0], [0.25, 1.03], [0, 1.04]]
    : [[0, -0.07], [0.7, -0.02], [0.76, 0.3], [0.9, 0.7], [0.78, 0.94], [0.3, 1.03], [0, 1.04]]).map(([x, y]) => new THREE.Vector2(x, y));
  const torso = warp(new THREE.LatheGeometry(torsoPts, hi ? 11 : 7), (x, y, z) => {
    let zz = z * lerp(0.62, 0.8, smooth(0.2, 0, y));                               // fuller at the waist, into the shirt tail
    if (zz < 0) zz *= 0.86;                                                        // flatter back
    else zz *= 1 + 0.1 * smooth(0.4, 0.62, y) * smooth(0.9, 0.7, y);               // chest forward
    const delt = 1 + 0.06 * smooth(0.7, 0.9, Math.abs(x)) * smooth(0.7, 0.86, y);    // deltoid bulge
    return [x * delt, y, zz];
  });
  const neckBottom = -NECK_DEPTH;
  const head = mergeGeometries([
    blob(hi ? 14 : 7, hi ? 10 : 5, (x, y, z) => {
      const jaw = y < 0 ? 1 - 0.2 * Math.pow(-y, 1.5) : 1;                         // jaw / chin taper, no face
      return [x * jaw * 0.94, y * 1.15, (z < 0 ? z * 1.06 : z * jaw) + (y < -0.3 && z > 0 ? 0.04 : 0)];
    }),
    new THREE.CylinderGeometry(0.45, 0.52, -0.6 - neckBottom, hi ? 10 : 5, 1, true).translate(0, (-0.6 + neckBottom) / 2, 0),
  ].map((g) => { g.deleteAttribute('uv'); return g; }))!;
  const skirt = warp(new THREE.CylinderGeometry(0.55, 1, 1, hi ? 16 : 8, hi ? 4 : 1, true).translate(0, -0.5, 0), (x, y, z) => {
    const t = -y, th = Math.atan2(z, x), fold = 1 + 0.04 * Math.sin(7 * th) * t;
    return [x * fold, y, z * fold * lerp(0.62, 1, t)];
  });
  // Shirt tail: an open, flared tube with soft folds, its top tucked inside the torso (y 0 → −1, z-radius TAIL_Z at the hem).
  const tail = warp(new THREE.CylinderGeometry(0.84, 1.04, 1, hi ? 14 : 7, 1, true).translate(0, -0.5, 0), (x, y, z) => {
    const t = -y, fold = 1 + 0.025 * Math.sin(5 * Math.atan2(z, x)) * t;
    return [x * fold, y, z * fold * lerp(0.72, TAIL_Z / 1.04, t)];
  });
  const hips = new THREE.LatheGeometry([[0, -1.0], [0.55, -0.95], [0.9, -0.7], [1.0, -0.3], [0.98, 0.2], [0.9, 0.5], [0, 0.55]]
    .filter((_, i) => hi || i % 2 === 0 || i === 6).map(([x, y]) => new THREE.Vector2(x, y)), hi ? 8 : 6).scale(1, 1, 0.5);
  const handL = hand(hi ? 8 : 5, hi ? 5 : 3, hi);
  return {
    thigh: finish(limb(thighR, 0.1, R, 0, hi), ends),
    shin: finish(limb(shinR, 0.14, R, 0, hi), ends),
    shinFlare: finish(limb(trouserShinR, 0.14, R, 0.12, hi), ends),
    upperArm: finish(limb(upperArmR, 0.18, R, 0, hi), ends),
    foreArm: finish(limb(foreArmR, 0.12, R, 0, hi), ends),
    handL: finish(handL, (_, y) => 0.15 * smooth(-0.3, 0.05, y)),
    handR: finish(mirrorX(handL), (_, y) => 0.15 * smooth(-0.3, 0.05, y)),
    torso: finish(torso, (x, y) => 0.2 * smooth(0.7, 0.9, Math.abs(x)) * smooth(0.5, 0.65, y) * smooth(0.85, 0.72, y)),
    tail: finish(tail, (_, y) => 0.12 * smooth(-0.6, -1, y)),
    head: finish(head, (_, y) => 0.3 * smooth(-0.9, -1.8, y) + 0.12 * smooth(-0.5, -0.9, y)),
    hips: finish(hips, (_, y) => 0.3 * smooth(-0.5, -1, y)),
    foot: finish(foot(hi ? 8 : 5, hi ? 5 : 3, false), (_, y) => 0.35 * smooth(-0.7, -1, y)),
    footBare: finish(foot(hi ? 8 : 5, hi ? 5 : 3, true), (_, y) => 0.3 * smooth(-0.7, -1, y)),
    skirt: finish(skirt, (_, y) => 0.25 * smooth(-0.15, 0, y) + 0.1 * smooth(-0.8, -1, y)),
  };
}

/** Hats in head units (head radius 1, crown top at y = 1.15). */
export function buildHatGeometries(detail: Detail = 'hi'): Record<Hat, THREE.BufferGeometry> {
  const hi = detail === 'hi', k = hi ? 1 : 0.4, n = (s: number) => Math.max(4, Math.round(s * k));
  const m = (...g: THREE.BufferGeometry[]) => finish(mergeGeometries(g.map((x) => { x.deleteAttribute('uv'); return x.index ? x.toNonIndexed() : x; }))!,
    (_, y) => 0.3 * smooth(0.85, 0.7, y));   // the underside of brims and crowns
  return {
    straw: m(new THREE.CylinderGeometry(1.9, 1.9, 0.06, n(18)).translate(0, 0.75, 0), new THREE.CylinderGeometry(0.95, 1.05, 0.55, n(14), 1).translate(0, 1.05, 0)),
    fedora: m(new THREE.CylinderGeometry(1.45, 1.45, 0.05, n(16)).translate(0, 0.8, 0), new THREE.CylinderGeometry(0.85, 1.0, 0.6, n(12), 1).scale(1, 1, 0.85).translate(0, 1.1, 0)),
    cap: m(new THREE.SphereGeometry(1.06, n(12), n(5), 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.35, 0), new THREE.BoxGeometry(1.0, 0.05, 0.8).translate(0, 0.5, 1.2)),
    wrap: m(new THREE.SphereGeometry(1.1, n(12), n(6), 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 0.9, 1.05).translate(0, 0.25, 0), new THREE.SphereGeometry(0.35, hi ? 6 : 4, hi ? 4 : 3).translate(0, 1.05, -0.6)),
  };
}

/** Hair in head units, following the head like a hat: a short crop, a close cap, a close cap with a bun. */
export function buildHairGeometries(detail: Detail = 'hi'): Record<Hair, THREE.BufferGeometry> {
  const hi = detail === 'hi';
  // A skull cap whose front edge rises to a hairline; y scaled to the egg-shaped head.
  const cap = (r: number, back: number) => warp(new THREE.SphereGeometry(r, hi ? 10 : 6, hi ? 4 : 3, 0, Math.PI * 2, 0, Math.PI * back), (x, y, z) => {
    // Hairline height by direction: low at the nape, at the temples on the sides, high on the forehead.
    const f = z / Math.max(1e-6, Math.hypot(x, z)), line = f < 0 ? lerp(0.55, -0.25, smooth(0, 0.8, -f)) : lerp(0.55, 0.85, smooth(0, 0.6, f));
    const yy = Math.max(y, line * r);
    return [x, yy * 1.15, z * (z < 0 ? 1.06 : 1)];
  });
  const close = () => cap(1.035, 0.56);
  const bun = new THREE.SphereGeometry(0.36, hi ? 6 : 4, hi ? 4 : 3).scale(1, 0.85, 1).translate(0, 0.45 * 1.15, -1.02);
  const strip = (g: THREE.BufferGeometry) => { g.deleteAttribute('uv'); return g; };
  return {
    crop: finish(cap(1.06, 0.6), (_, y) => 0.2 * smooth(0.2, -0.3, y)),
    close: finish(close(), (_, y) => 0.2 * smooth(0.2, -0.3, y)),
    bun: finish(hi ? mergeGeometries([strip(close()), strip(bun)])! : close(), (_, y) => 0.2 * smooth(0.2, -0.3, y)),
  };
}
