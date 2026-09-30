import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CarModel } from '../data/eras';
import { DIMS, rearOverhang, type MoverDims } from './models';

export type CarPart = 'paint' | 'glass' | 'trim' | 'dark';
export const CAR_PARTS: readonly CarPart[] = ['paint', 'glass', 'trim', 'dark'];
export type Detail = 'hi' | 'lo';
export const CAR_TRIS: Record<Detail, number> = { hi: 2400, lo: 600 };
export const WHEEL_TRIS: Record<Detail, number> = { hi: 160, lo: 88 };

/**
 * Side view of one model (model frame, m). The lower body runs from the tail to the nose along `sill`, over two
 * wheel arches, up the nose to `noseY`, back along the hood (`hoodY` at the nose, `belt` at the cowl) and the deck
 * (`deckY`), down the tail to `tailY`. The cabin sits on the belt from `c0` (rear base) to `c1` (front base) with a
 * roof at `roof`, the windshield running `ws` forward and the back window `bw` rearward at the belt. `cabinW`: cabin
 * width / body width. `glass0`: side glass starts here (vans: only the front doors). Vintage cars (Model T, A) are
 * built from boxes with separate fenders and running boards instead. All values inferred (L) from period photos.
 */
export interface Silhouette {
  sill: number; noseY: number; hoodY: number; belt: number; deckY: number; tailY: number;
  c0: number; c1: number; roof: number; ws: number; bw: number; cabinW: number; glass0?: number;
  chrome: boolean; vintage?: boolean; sign?: boolean; mast?: boolean;
}
export const SILHOUETTES: Record<CarModel, Silhouette> = {
  modelT: { sill: 0.55, noseY: 1.15, hoodY: 1.15, belt: 1.15, deckY: 1.1, tailY: 1.1, c0: -1.2, c1: 0.55, roof: 2.05, ws: 0, bw: 0, cabinW: 0.92, chrome: false, vintage: true },
  modelA: { sill: 0.5, noseY: 1.1, hoodY: 1.1, belt: 1.12, deckY: 1.05, tailY: 1.0, c0: -1.25, c1: 0.5, roof: 1.85, ws: 0.05, bw: 0, cabinW: 0.9, chrome: true, vintage: true },
  sedan50: { sill: 0.32, noseY: 0.72, hoodY: 0.86, belt: 0.9, deckY: 0.88, tailY: 0.8, c0: -1.05, c1: 0.45, roof: 1.55, ws: 0.5, bw: 0.55, cabinW: 0.86, chrome: true },
  publico: { sill: 0.32, noseY: 0.72, hoodY: 0.86, belt: 0.9, deckY: 0.88, tailY: 0.8, c0: -1.05, c1: 0.45, roof: 1.55, ws: 0.5, bw: 0.55, cabinW: 0.86, chrome: true, sign: true },
  sedan70: { sill: 0.3, noseY: 0.66, hoodY: 0.76, belt: 0.82, deckY: 0.8, tailY: 0.74, c0: -1.1, c1: 0.45, roof: 1.38, ws: 0.65, bw: 0.55, cabinW: 0.86, chrome: true },
  wagon70: { sill: 0.3, noseY: 0.66, hoodY: 0.76, belt: 0.82, deckY: 0.82, tailY: 0.8, c0: -1.89, c1: 0.45, roof: 1.42, ws: 0.65, bw: 0.12, cabinW: 0.86, chrome: true },
  tvVan: { sill: 0.35, noseY: 0.8, hoodY: 0.95, belt: 1.0, deckY: 1.0, tailY: 1.0, c0: -2.28, c1: 1.2, roof: 2.05, ws: 0.35, bw: 0.02, cabinW: 0.97, glass0: 0.2, chrome: false, mast: true },
  sedan80: { sill: 0.28, noseY: 0.62, hoodY: 0.72, belt: 0.8, deckY: 0.78, tailY: 0.72, c0: -1.05, c1: 0.55, roof: 1.36, ws: 0.6, bw: 0.45, cabinW: 0.86, chrome: false },
  compact80: { sill: 0.27, noseY: 0.6, hoodY: 0.7, belt: 0.78, deckY: 0.8, tailY: 0.78, c0: -1.595, c1: 0.45, roof: 1.38, ws: 0.6, bw: 0.35, cabinW: 0.88, chrome: false },
};

type P2 = [number, number];
const C = { chrome: 0xd8d8d4, black: 0x1c1c1c, grille: 0x2a2a28, lamp: 0xf2efe6, tail: 0x8a1a14, sign: 0xe8e2d0, under: 0x151515, glassEdge: 0x101214 };

/** Arch over a wheel at x = xc (radius r, centre height wr) cut into the bottom edge at `sill`, from rear to front. */
function arch(xc: number, wr: number, r: number, sill: number, steps: number): P2[] {
  const dy = sill - wr;
  if (Math.abs(dy) >= r) return [];
  const t0 = Math.asin(dy / r), out: P2[] = [];
  for (let i = 0; i <= steps; i++) { const t = Math.PI - t0 - ((Math.PI - 2 * t0) * i) / steps; out.push([xc + r * Math.cos(t), wr + r * Math.sin(t)]); }
  return out;
}
function extrude(pts: P2[], depth: number, bevel: number, detail: Detail): THREE.BufferGeometry {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  // bevelOffset −b keeps the bevelled outline inside the side profile (a bevel otherwise grows it by bevelSize).
  const b = detail === 'hi' ? bevel : 0, g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -(depth - 2 * b) / 2);
  g.deleteAttribute('uv');
  return g;
}
/** Non-indexed copy of `g` (disposing `g`), without UVs, every vertex coloured `hex`. Shared with src/traffic/animals.ts. */
export function colored(g: THREE.BufferGeometry, hex: number) {
  const n = g.index ? g.toNonIndexed() : g; if (n !== g) g.dispose();
  n.deleteAttribute('uv');
  const c = new THREE.Color(hex), a = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  n.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return n;
}
const boxAt = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
const cylX = (r: number, len: number, x: number, y: number, z: number, seg: number) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2).translate(x, y, z);
function merge(list: THREE.BufferGeometry[]) {
  const flat = list.map((g) => { const n = g.index ? g.toNonIndexed() : g; if (n !== g) g.dispose(); n.deleteAttribute('uv'); return n; });
  const m = mergeGeometries(flat, false)!; flat.forEach((g) => g.dispose()); return m;
}

/** A vertex-coloured window slab: the cabin outline pulled in by `inset`, extruded a hair wider than the cabin. */
function windowSlab(s: Silhouette, d: MoverDims, detail: Detail): THREE.BufferGeometry {
  const inset = 0.06, b = s.belt + 0.04, top = s.roof - inset;
  const x0 = Math.max(s.c0 - s.bw + inset, s.glass0 ?? -Infinity), x1 = s.c1 + s.ws - inset;   // raked windshield and back window
  const pts: P2[] = [[x0, b], [x1, b], [s.c1 + inset * 0.5, top], [Math.max(s.c0 + inset * 0.5, s.glass0 ?? -Infinity), top]];
  return colored(extrude(pts, d.width * s.cabinW + 0.012, 0, detail), C.glassEdge);
}

function modern(model: CarModel, detail: Detail) {
  const d = DIMS[model], s = SILHOUETTES[model], wb2 = d.wheelbase / 2, xn = wb2 + d.front, xt = -(wb2 + rearOverhang(d));
  const R = d.wheelR + 0.05, steps = detail === 'hi' ? 7 : 3;
  const body: P2[] = [
    [xt + 0.08, s.sill], ...arch(-wb2, d.wheelR, R, s.sill, steps), ...arch(wb2, d.wheelR, R, s.sill, steps), [xn - 0.08, s.sill],
    [xn, s.sill + 0.12], [xn, s.noseY], [xn - 0.14, s.hoodY], [s.c1 + s.ws, s.belt], [s.c0 - s.bw, s.belt], [xt + 0.14, s.deckY], [xt, s.tailY], [xt, s.sill + 0.12],
  ];
  const cabin: P2[] = [[s.c0 - s.bw, s.belt - 0.02], [s.c1 + s.ws, s.belt - 0.02], [s.c1, s.roof], [s.c0, s.roof]];
  const paint = merge([
    extrude(body, d.width, 0.05, detail),
    extrude(cabin, d.width * s.cabinW, 0.04, detail),
    boxAt(0.09, s.roof - s.belt - 0.02, d.width * s.cabinW + 0.014, (s.c0 + s.c1) / 2, (s.roof + s.belt) / 2, 0),   // B pillar over the glass
  ]);
  const glass = windowSlab(s, d, detail);
  const bumper = s.chrome ? C.chrome : C.black, seg = detail === 'hi' ? 10 : 6, ly = s.noseY - 0.14, lz = d.width / 2 - 0.26;
  const trim = merge([
    colored(boxAt(0.1, 0.12, d.width - 0.02, xn - 0.03, s.sill + 0.12, 0), bumper),
    colored(boxAt(0.1, 0.12, d.width - 0.02, xt + 0.03, s.sill + 0.12, 0), bumper),
    colored(cylX(0.085, 0.04, xn + 0.005, ly, lz, seg), C.chrome), colored(cylX(0.085, 0.04, xn + 0.005, ly, -lz, seg), C.chrome),
  ]);
  const darkParts = [
    colored(boxAt(0.03, Math.max(0.08, s.noseY - s.sill - 0.3), d.width - 0.7, xn - 0.005, (s.noseY + s.sill + 0.2) / 2, 0), C.grille),
    colored(boxAt(0.03, 0.12, 0.28, xt - 0.005, s.tailY - 0.12, lz), C.tail), colored(boxAt(0.03, 0.12, 0.28, xt - 0.005, s.tailY - 0.12, -lz), C.tail),
    colored(boxAt(d.wheelbase - 2 * R, Math.max(0.05, s.sill - 0.16), d.width * 0.8, 0, (s.sill + 0.16) / 2, 0), C.under),
    colored(cylX(0.075, 0.03, xn + 0.02, ly, lz, seg), C.lamp), colored(cylX(0.075, 0.03, xn + 0.02, ly, -lz, seg), C.lamp),
  ];
  if (s.sign) darkParts.push(colored(boxAt(0.55, 0.16, 0.28, (s.c0 + s.c1) / 2, s.roof + 0.08, 0), C.sign));
  if (s.mast) darkParts.push(colored(new THREE.CylinderGeometry(0.025, 0.03, 0.3, 5).translate(s.c0 + 0.4, s.roof + 0.15, -d.width * 0.3), C.black));
  return { paint, glass, trim, dark: merge(darkParts) };
}

function vintage(model: CarModel, detail: Detail) {
  const d = DIMS[model], s = SILHOUETTES[model], wb2 = d.wheelbase / 2, xn = wb2 + d.front, xt = -(wb2 + rearOverhang(d));
  const W = d.width, cw = W * s.cabinW, seg = detail === 'hi' ? 12 : 6, R = d.wheelR + 0.06;
  const hoodW = W * 0.5, hoodL = xn - 0.12 - s.c1;
  const fender = (xc: number, side: number) => new THREE.CylinderGeometry(R, R, 0.26, seg, 1, true, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(xc, d.wheelR, side * (W / 2 - 0.13));
  const paint = merge([
    boxAt(hoodL, s.hoodY - s.sill - 0.15, hoodW, s.c1 + hoodL / 2, (s.hoodY + s.sill + 0.15) / 2, 0),              // hood
    boxAt(s.c1 - s.c0, s.roof - s.sill - 0.05, cw, (s.c0 + s.c1) / 2, (s.roof + s.sill + 0.05) / 2 - 0.03, 0),      // cabin block
    boxAt(s.c0 - xt, s.deckY - s.sill, cw * 0.95, (s.c0 + xt) / 2, (s.deckY + s.sill) / 2, 0),                       // rear body
    boxAt(s.c1 - s.c0 + 0.1, 0.06, cw + 0.06, (s.c0 + s.c1) / 2, s.roof, 0),                                         // roof cap
    ...[-1, 1].flatMap((side) => [fender(-wb2, side), fender(wb2, side)]),
  ]);
  const glass = colored(merge([
    boxAt(0.03, s.roof - s.belt - 0.2, cw - 0.12, s.c1 + 0.01, (s.roof + s.belt) / 2, 0),                             // upright windshield
    boxAt(s.c1 - s.c0 - 0.3, s.roof - s.belt - 0.25, cw + 0.012, (s.c0 + s.c1) / 2, (s.roof + s.belt) / 2 + 0.02, 0),  // side glass slab
  ]), C.glassEdge);
  const trim = merge([
    colored(boxAt(0.06, s.hoodY - s.sill - 0.05, hoodW + 0.04, xn - 0.1, (s.hoodY + s.sill) / 2, 0), s.chrome ? C.chrome : C.black),   // radiator shell
    colored(cylX(0.11, 0.08, xn - 0.02, s.hoodY - 0.05, W / 2 - 0.28, seg), C.chrome), colored(cylX(0.11, 0.08, xn - 0.02, s.hoodY - 0.05, -(W / 2 - 0.28), seg), C.chrome),
  ]);
  const dark = merge([
    colored(boxAt(0.02, s.hoodY - s.sill - 0.15, hoodW - 0.1, xn - 0.07, (s.hoodY + s.sill) / 2, 0), C.grille),
    ...[-1, 1].map((side) => colored(boxAt(d.wheelbase - 2 * R, 0.04, 0.24, 0, s.sill - 0.08, side * (W / 2 - 0.12)), C.black)),   // running boards
    colored(boxAt(d.wheelbase, 0.12, cw * 0.7, 0, s.sill - 0.1, 0), C.under),
    colored(cylX(0.08, 0.03, xn - 0.0, s.hoodY - 0.05, W / 2 - 0.28, seg), C.lamp), colored(cylX(0.08, 0.03, xn - 0.0, s.hoodY - 0.05, -(W / 2 - 0.28), seg), C.lamp),
    colored(boxAt(0.03, 0.08, 0.1, xt - 0.01, s.deckY - 0.1, W * 0.3), C.tail),
  ]);
  return { paint, glass, trim, dark };
}

export function buildCar(model: CarModel, detail: Detail): Record<CarPart, THREE.BufferGeometry> {
  const g = SILHOUETTES[model].vintage ? vintage(model, detail) : modern(model, detail);
  g.paint.deleteAttribute('color');
  for (const p of CAR_PARTS) g[p].computeVertexNormals();
  return g;
}

/** Unit wheel (radius 1, axle along z): dark tyre, grey rim, chrome hubcap. Segment counts are multiples of 4, so the rim reaches ±1 on both axes. */
export function buildWheel(detail: Detail): THREE.BufferGeometry {
  const seg = detail === 'hi' ? 12 : 8, w = 0.56;
  const tyre = colored(new THREE.CylinderGeometry(1, 1, w, seg, 1).rotateX(Math.PI / 2), 0x151515);
  const rim = colored(new THREE.CylinderGeometry(0.68, 0.68, w + 0.02, seg, 1).rotateX(Math.PI / 2), 0x5a5a58);
  const cap = colored(new THREE.CylinderGeometry(0.42, 0.45, w + 0.06, detail === 'hi' ? 10 : 6, 1).rotateX(Math.PI / 2), 0xcfcfca);
  return merge([tyre, rim, cap]);
}

/** The four wheel positions (front/rear × right/left): model-local x and z signs. */
const WHEEL_SIGNS = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
const _wm = new THREE.Matrix4(), _ws = new THREE.Matrix4();
/**
 * World matrix of wheel `k` (0–3) of a car with sizes `d` whose body matrix is `body`, rolled by `dist` m. For the
 * unit wheel (buildWheel). Shared by the ferry load and the bridge traffic. Allocation-free.
 */
export function wheelMatrix(d: MoverDims, k: number, dist: number, body: THREE.Matrix4, out: THREE.Matrix4): THREE.Matrix4 {
  const [sx, sz] = WHEEL_SIGNS[k];
  _wm.makeRotationZ(-dist / d.wheelR).premultiply(_ws.makeScale(d.wheelR, d.wheelR, d.wheelR)).setPosition((sx * d.wheelbase) / 2, d.wheelR, sz * d.track);
  return out.multiplyMatrices(body, _wm);
}
