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
const C = { chrome: 0xd8d8d4, black: 0x1c1c1c, grille: 0x2a2a28, lamp: 0xf2efe6, tail: 0x8a1a14, sign: 0xe8e2d0, under: 0x151515, glassEdge: 0x101214, cabin: 0x1e1c1a, seat: 0x3a3430 };

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

/** One flat pane from four corners (counter-clockwise seen from the side it faces). */
function quad(a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  return g;
}

/**
 * Driver seat (model frame): hip point [x, y, z] of a left-hand-drive driver, a third of the wheelbase behind the front
 * axle (vans: just ahead of the cargo box), `y` the seated hip height — on the cushion, low enough that a seated figure's
 * head clears the roof lining (ROOF_CLEAR). Shared by the load plan (the driver's `at`) and the 'hi' cabin (seat, wheel).
 */
export const ROOF_CLEAR = 0.07, DRIVER_HEAD = 0.8, STEER_REACH = 0.45, STEER_UP = 0.36;
export function driverSeat(model: CarModel): [number, number, number] {
  const d = DIMS[model], s = SILHOUETTES[model];
  const x = Math.max(d.wheelbase / 2 - 0.62 * d.wheelbase, s.glass0 !== undefined ? s.glass0 + 0.35 : -Infinity);
  const cushion = s.vintage ? s.sill + 0.45 : Math.max(s.sill + 0.22, s.belt - 0.3);   // the belt no more than 0.3 m above the hip (a van sits high)
  return [x, Math.min(cushion, s.roof - ROOF_CLEAR - DRIVER_HEAD), -0.2 * d.width];
}
/** The steering wheel's centre (model frame): STEER_REACH ahead of the driver's hip, STEER_UP above it. */
export function steeringWheel(model: CarModel): [number, number, number] {
  const [x, y, z] = driverSeat(model);
  return [x + STEER_REACH, y + STEER_UP, z];
}
/** Seat backs, the belt-line cover (the cabin floor seen through the glass), dash and steering wheel of a hollow cabin. */
function interior(model: CarModel, x0: number, x1: number, cw: number, belt: number, lining: number, back2: boolean): THREE.BufferGeometry[] {
  const [sx, , sz] = driverSeat(model), [wx, wy, wz] = steeringWheel(model), hb = Math.min(0.3, lining - belt - 0.15);   // seat backs reach the shoulders, below the windows' top
  const seatBack = (x: number) => colored(new THREE.BoxGeometry(0.1, hb, cw - 0.12).translate(0, hb / 2, 0).rotateZ(0.18).translate(x, belt - 0.02, 0), C.seat);
  const out = [
    colored(boxAt(x1 - x0, 0.03, cw - 0.06, (x0 + x1) / 2, belt - 0.005, 0), C.cabin),            // cabin floor at the belt
    colored(boxAt(0.22, 0.1, cw - 0.08, x1 - 0.13, belt + 0.05, 0), C.cabin),                        // dash under the windshield
    seatBack(sx - 0.3),
    colored(new THREE.TorusGeometry(0.18, 0.018, 4, 10).rotateY(Math.PI / 2).rotateZ(-0.45).translate(wx, wy, wz), C.black),   // steering wheel
  ];
  if (back2 && sx - 1.05 > x0 + 0.15) out.push(seatBack(sx - 1.05));                                // rear bench
  return out;
}

/** A vertex-coloured window slab: the cabin outline pulled in by `inset`, extruded a hair wider than the cabin. */
function windowSlab(s: Silhouette, d: MoverDims, detail: Detail): THREE.BufferGeometry {
  const inset = 0.06, b = s.belt + 0.04, top = s.roof - inset;
  const x0 = Math.max(s.c0 - s.bw + inset, s.glass0 ?? -Infinity), x1 = s.c1 + s.ws - inset;   // raked windshield and back window
  const pts: P2[] = [[x0, b], [x1, b], [s.c1 + inset * 0.5, top], [Math.max(s.c0 + inset * 0.5, s.glass0 ?? -Infinity), top]];
  return colored(extrude(pts, d.width * s.cabinW + 0.012, 0, detail), C.glassEdge);
}

/** Undercarriage bottom (m above the ground): it hides a low driver's shins between the wheels. */
export const UNDER_Y = 0.12;
const PW = 0.07, PD = 0.06, RT = 0.06;   // pillar width (side view), pillar depth (across), roof thickness
/**
 * The 'hi' modern cabin, hollow (spec 4c §5: the drivers' upper bodies show through the glass): a roof on A, B and C
 * pillars (van: the cargo box stays solid behind `glass0`), see-through panes in the openings, a dark interior.
 */
function hollowCabin(model: CarModel, d: MoverDims, s: Silhouette) {
  const cw = d.width * s.cabinW, h = s.roof - s.belt, xa = s.c1 + s.ws, xc = s.c0 - s.bw, van = s.glass0 !== undefined;
  const fx = (y: number) => xa + (s.c1 - xa) * (y - s.belt) / h, bx = (y: number) => xc + (s.c0 - xc) * (y - s.belt) / h;   // windshield and back-window lines
  const y0 = s.belt - 0.02, yb = s.belt + 0.01, yt = s.roof - RT, zs = cw / 2 - PD / 2, zg = cw / 2 - 0.025;
  const paint: THREE.BufferGeometry[] = [
    extrude([[s.c0, yt], [s.c1, yt], [s.c1, s.roof], [s.c0, s.roof]], cw, 0.02, 'hi'),                                  // roof
  ];
  for (const side of [-1, 1]) {
    paint.push(extrude([[xa, y0], [xa - PW, y0], [s.c1 - PW, s.roof], [s.c1, s.roof]], PD, 0, 'hi').translate(0, 0, side * zs));   // A
    if (!van) paint.push(extrude([[xc, y0], [xc + 1.6 * PW, y0], [s.c0 + 1.6 * PW, s.roof], [s.c0, s.roof]], PD, 0, 'hi').translate(0, 0, side * zs));   // C
    if (!van) paint.push(boxAt(0.08, s.roof - y0, PD, (s.c0 + s.c1) / 2, (s.roof + y0) / 2, side * zs));           // B
  }
  // Van: the cargo box behind the cab, solid up to the roof (its front face is the cab's back wall).
  if (van) paint.push(extrude([[xc, y0], [s.glass0!, y0], [s.glass0!, s.roof], [s.c0, s.roof]], cw, 0.04, 'hi'));
  const rear = (y: number) => (van ? s.glass0! : bx(y) + 0.8 * PW), front = (y: number) => fx(y) - PW / 2;
  const panes = [
    quad([fx(yb) - 0.02, yb, zg], [fx(yb) - 0.02, yb, -zg], [fx(yt) - 0.02, yt, -zg], [fx(yt) - 0.02, yt, zg]),   // windshield
  ];
  if (!van) panes.push(quad([bx(yb) + 0.02, yb, -zg], [bx(yb) + 0.02, yb, zg], [bx(yt) + 0.02, yt, zg], [bx(yt) + 0.02, yt, -zg]));   // back window
  for (const side of [-1, 1]) {
    const z = side * zg, a: [number, number, number] = [rear(yb), yb, z], b: [number, number, number] = [front(yb), yb, z];
    const c: [number, number, number] = [front(yt), yt, z], e: [number, number, number] = [rear(yt), yt, z];
    panes.push(side > 0 ? quad(a, b, c, e) : quad(b, a, e, c));
  }
  const glass = colored(merge(panes), C.glassEdge);
  const dark = interior(model, van ? s.glass0! : bx(s.belt) + 0.05, fx(s.belt) - 0.04, cw, s.belt, yt, !van);
  return { paint, glass, dark };
}

function modern(model: CarModel, detail: Detail) {
  const d = DIMS[model], s = SILHOUETTES[model], wb2 = d.wheelbase / 2, xn = wb2 + d.front, xt = -(wb2 + rearOverhang(d));
  const R = d.wheelR + 0.05, steps = detail === 'hi' ? 7 : 3;
  const body: P2[] = [
    [xt + 0.08, s.sill], ...arch(-wb2, d.wheelR, R, s.sill, steps), ...arch(wb2, d.wheelR, R, s.sill, steps), [xn - 0.08, s.sill],
    [xn, s.sill + 0.12], [xn, s.noseY], [xn - 0.14, s.hoodY], [s.c1 + s.ws, s.belt], [s.c0 - s.bw, s.belt], [xt + 0.14, s.deckY], [xt, s.tailY], [xt, s.sill + 0.12],
  ];
  const cabin: P2[] = [[s.c0 - s.bw, s.belt - 0.02], [s.c1 + s.ws, s.belt - 0.02], [s.c1, s.roof], [s.c0, s.roof]];
  const hollow = detail === 'hi' ? hollowCabin(model, d, s) : undefined;
  const paint = merge([
    extrude(body, d.width, 0.05, detail),
    ...(hollow ? hollow.paint : [
      extrude(cabin, d.width * s.cabinW, 0.04, detail),
      boxAt(0.09, s.roof - s.belt - 0.02, d.width * s.cabinW + 0.014, (s.c0 + s.c1) / 2, (s.roof + s.belt) / 2, 0),   // B pillar over the glass
    ]),
  ]);
  const glass = hollow ? hollow.glass : windowSlab(s, d, detail);
  const bumper = s.chrome ? C.chrome : C.black, seg = detail === 'hi' ? 10 : 6, ly = s.noseY - 0.14, lz = d.width / 2 - 0.26;
  const trim = merge([
    colored(boxAt(0.1, 0.12, d.width - 0.02, xn - 0.03, s.sill + 0.12, 0), bumper),
    colored(boxAt(0.1, 0.12, d.width - 0.02, xt + 0.03, s.sill + 0.12, 0), bumper),
    colored(cylX(0.085, 0.04, xn + 0.005, ly, lz, seg), C.chrome), colored(cylX(0.085, 0.04, xn + 0.005, ly, -lz, seg), C.chrome),
  ]);
  const darkParts = [
    colored(boxAt(0.03, Math.max(0.08, s.noseY - s.sill - 0.3), d.width - 0.7, xn - 0.005, (s.noseY + s.sill + 0.2) / 2, 0), C.grille),
    colored(boxAt(0.03, 0.12, 0.28, xt - 0.005, s.tailY - 0.12, lz), C.tail), colored(boxAt(0.03, 0.12, 0.28, xt - 0.005, s.tailY - 0.12, -lz), C.tail),
    colored(boxAt(d.wheelbase - 2 * R, Math.max(0.05, s.sill - UNDER_Y), d.width * 0.8, 0, (s.sill + UNDER_Y) / 2, 0), C.under),
    ...(hollow ? hollow.dark : []),
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
  // Fender: a closed half-ring shell (outer R, inner R - 0.03), so it has a real thickness from every side.
  const fenderShape = new THREE.Shape(); fenderShape.absarc(0, 0, R, 0, Math.PI, false); fenderShape.absarc(0, 0, R - 0.03, Math.PI, 0, true);
  const fender = (xc: number, side: number) => new THREE.ExtrudeGeometry(fenderShape, { depth: 0.26, bevelEnabled: false, curveSegments: detail === 'hi' ? seg : 3 }).translate(xc, d.wheelR, side * (W / 2 - 0.13) - 0.13);
  // hi: bevelled body blocks (bevel kept inside the size); lo: plain boxes
  const blk = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    if (detail !== 'hi') return boxAt(sx, sy, sz, x, y, z);
    const b = Math.min(0.03, sx / 4, sy / 4, sz / 4), hx = sx / 2, hy = sy / 2;
    return extrude([[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]], sz, b, 'hi').translate(x, y, z);
  };
  const IN = 0.05;   // paint frame around each pane; the glass stands 6 mm proud of the cabin
  const gTop = s.roof - 0.03 - IN, gBot = s.belt + IN, gH = gTop - gBot, gY = (gTop + gBot) / 2;
  // 'hi': hollow above the belt (spec 4c §5) — the lower cabin block, four corner posts and a door post, a solid back;
  // 'lo' (the bridge): one solid cabin block.
  const hi = detail === 'hi', cy0 = s.sill + 0.02, cy1 = s.roof - 0.03, cx = (s.c0 + s.c1) / 2, P = 0.07;
  const cabin = hi ? [
    blk(s.c1 - s.c0, s.belt - cy0, cw, cx, (s.belt + cy0) / 2, 0),                                               // lower cabin
    ...[-1, 1].flatMap((side) => [s.c0 + P / 2, cx, s.c1 - P / 2].map((x) => boxAt(P, cy1 - s.belt, P, x, (cy1 + s.belt) / 2, side * (cw / 2 - P / 2)))),   // posts
    boxAt(0.05, cy1 - s.belt, cw, s.c0 + 0.025, (cy1 + s.belt) / 2, 0),                                           // back wall
  ] : [blk(s.c1 - s.c0, s.roof - s.sill - 0.05, cw, cx, (s.roof + s.sill + 0.05) / 2 - 0.03, 0)];                 // cabin block
  const paint = merge([
    blk(hoodL, s.hoodY - s.sill - 0.15, hoodW, s.c1 + hoodL / 2, (s.hoodY + s.sill + 0.15) / 2, 0),              // hood
    ...cabin,
    blk(s.c0 - xt, s.deckY - s.sill, cw * 0.95, (s.c0 + xt) / 2, (s.deckY + s.sill) / 2, 0),                       // rear body
    blk(s.c1 - s.c0 + 0.1, 0.06, cw + 0.06, (s.c0 + s.c1) / 2, s.roof, 0),                                         // roof cap
    ...[-1, 1].flatMap((side) => [fender(-wb2, side), fender(wb2, side)]),
  ]);
  const glass = colored(merge(hi ? [
    boxAt(0.012, cy1 - s.belt, cw - 2 * P, s.c1 - P / 2, (cy1 + s.belt) / 2, 0),                                   // upright windshield between the posts
    ...[-1, 1].map((side) => boxAt(s.c1 - s.c0 - 2 * P, cy1 - s.belt, 0.012, cx, (cy1 + s.belt) / 2, side * (cw / 2 - P / 2))),   // side panes
  ] : [
    boxAt(0.03, gH, cw - 2 * IN, s.c1 + 0.01, gY, 0),                                   // upright windshield
    boxAt(s.c1 - s.c0 - 2 * IN, gH, cw + 0.012, (s.c0 + s.c1) / 2, gY, 0),              // side glass slab
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
    ...(hi ? interior(model, s.c0 + 0.05, s.c1 - P, cw, s.belt, cy1, true) : []),
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
