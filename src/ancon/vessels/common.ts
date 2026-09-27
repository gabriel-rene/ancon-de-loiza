import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type VesselMaterialId = 'wood' | 'steel' | 'iron';
export interface VesselPart {
  material: VesselMaterialId;
  /** Vessel-local frame: origin hull centre at the waterline, +X west, +Y up. */
  geometry: THREE.BufferGeometry;
  /** Hinged end apron/ramp, built flat; it rotates about local Z through `hinge` = (x, y). end −1 = east (−X), +1 = west. */
  apron?: { end: 1 | -1; hinge: [number, number] };
}
/** One texture tile covers TEX_M × TEX_M metres (world-scaled planar UVs). */
export const TEX_M = 2;
type V3 = [number, number, number];
const _c = new THREE.Color();

type Axis = 'x' | 'y' | 'z';
const AX: Record<Axis, number> = { x: 0, y: 1, z: 2 };
/** Seam occlusion for a box: vertex colours on its long side faces (|n.y| < 0.5, not end grain) fade from `sideAO[0]` at its bottom to `sideAO[1]` at its top. */
export interface BoxOpts { sideAO?: [number, number] }

/**
 * Planar UVs in metres / TEX_M, so texel density is the same on every part. The wood grain runs
 * along the tile's v axis, so v follows `grain` on every face whose normal is not the grain axis
 * (u = the remaining in-plane coordinate); end-grain faces keep the dominant-normal mapping.
 * `offset` is added to positions first (so repeated pieces built at the origin don't share texels).
 */
export function worldUv(g: THREE.BufferGeometry, grain: Axis = 'z', offset: V3 = [0, 0, 0]) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2), gi = AX[grain];
  const q = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const d = ay >= ax && ay >= az ? 1 : ax >= az ? 0 : 2;
    q[0] = p.getX(i) + offset[0]; q[1] = p.getY(i) + offset[1]; q[2] = p.getZ(i) + offset[2];
    let u: number, v: number;
    if (d === gi) [u, v] = d === 1 ? [q[0], q[2]] : d === 0 ? [q[2], q[1]] : [q[0], q[1]];
    else { u = q[3 - d - gi]; v = q[gi]; }
    uv[i * 2] = u / TEX_M; uv[i * 2 + 1] = v / TEX_M;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Collects primitive pieces (non-indexed, vertex-coloured, world-UV'd) and merges them into one geometry. */
export class PartBuilder {
  private geos: THREE.BufferGeometry[] = [];
  get empty() { return this.geos.length === 0; }
  /** Box; the grain runs along its longest side. */
  box(size: V3, at: V3, color: THREE.ColorRepresentation, rotZ = 0, rotY = 0, opts: BoxOpts = {}) {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]).toNonIndexed();
    const grain: Axis = size[0] >= size[1] && size[0] >= size[2] ? 'x' : size[1] >= size[2] ? 'y' : 'z';
    worldUv(g, grain, at);
    if (rotZ) g.rotateZ(rotZ);
    if (rotY) g.rotateY(rotY);
    g.translate(at[0], at[1], at[2]);
    this.add(g, color, { keepUv: true });
    if (opts.sideAO) sideAO(g, opts.sideAO, AX[grain]);
    return this;
  }
  /** Cylinder along `axis` (default Y), centred at `at`; the grain runs along the axis. */
  cylinder(rTop: number, rBottom: number, length: number, at: V3, color: THREE.ColorRepresentation, axis: Axis = 'y', radial = 8) {
    const g = new THREE.CylinderGeometry(rTop, rBottom, length, radial, 1);
    if (axis === 'x') g.rotateZ(-Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(at[0], at[1], at[2]);
    return this.add(g, color, { grain: axis });
  }
  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, o: { grain?: Axis; keepUv?: boolean } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(o.keepUv && k === 'uv')) g.deleteAttribute(k);
    _c.set(color);
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) { col[i] = _c.r; col[i + 1] = _c.g; col[i + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!o.keepUv || !g.getAttribute('uv')) worldUv(g, o.grain);
    this.geos.push(g);
    return this;
  }
  build(): THREE.BufferGeometry {
    const m = mergeGeometries(this.geos, false);
    if (!m) throw new Error('PartBuilder: incompatible pieces');
    this.geos.forEach((g) => g.dispose());
    this.geos = [];
    return m;
  }
}

/** Darken long-side-face vertex colours from `lo` (bottom) to `hi` (top): unlit narrow seams between planks. End grain (normal along `grain`) is left alone. */
function sideAO(g: THREE.BufferGeometry, [lo, hi]: [number, number], grain: number) {
  const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < p.count; i++) { y0 = Math.min(y0, p.getY(i)); y1 = Math.max(y1, p.getY(i)); }
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(n.getY(i)) >= 0.5 || Math.abs(n.getComponent(i, grain)) >= 0.5) continue;
    const k = lo + (hi - lo) * (y1 > y0 ? (p.getY(i) - y0) / (y1 - y0) : 1);
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
}

/** Shared vessel palette (sRGB hex → linear THREE.Color). One copy for every builder. Silver-grey sun-bleached timber; the plank map only adds detail. */
export const WOOD = {
  base: new THREE.Color(0x9a8f7e), dark: new THREE.Color(0x5f5549), bleach: new THREE.Color(0xb9b5ac),
  strake: new THREE.Color(0x7d7263), tar: new THREE.Color(0x221d19), iron: new THREE.Color(0x2b2826),
};
/**
 * Steel pontoon paint. In linear space: FOUL (g/r ≈ 1.8) is greener than SHELL (g/r ≈ 1.4), the
 * side-panel base; RUST (luminance ≈ 0.02) is darker than SHELL (≈ 0.065) and DECK, so lerping
 * toward RUST darkens — the idle 1986 barge (more rust) is darker than the working 1984 one.
 */
export const STEEL = {
  deck: new THREE.Color(0x6f746c), shell: new THREE.Color(0x3f4a4c), rust: new THREE.Color(0x3a2618),
  foul: new THREE.Color(0x34461f), antifoul: new THREE.Color(0x5a2a22),
};

/** A tone between `base` and a random partner (weathering / sun bleaching), deterministic in `r`. */
export function tone(base: THREE.Color, dark: THREE.Color, light: THREE.Color, r: () => number, amount = 0.45) {
  return base.clone().lerp(r() < 0.5 ? dark : light, r() * amount);
}
export const woodTone = (r: () => number, amount = 0.45, base = WOOD.base) => tone(base, WOOD.dark, WOOD.bleach, r, amount);

/** Mooring bitts (1986) and corner bitts: deck-local x/z of the bitt at `end` (−1 east, +1 west) on `side`; posts are BITT_H tall. */
export const BITT_H = 0.35;
export const bittXZ = (L: { halfLength: number; halfBeam: number }, end: 1 | -1, side: 1 | -1): [number, number] =>
  [end * (L.halfLength - 0.9), side * (L.halfBeam - 0.45)];

/** Seam occlusion for deck/apron planks: side faces [bottom, top] multipliers. */
export const SEAM_AO: [number, number] = [0.05, 0.25];

/** Hinged plank apron for the wooden kinds, built flat from the hinge (x = end·halfLength) outward. */
export function plankApron(end: 1 | -1, L: { halfLength: number; halfBeam: number; deckY: number; apron: number },
  r: () => number, o: { plankW: number; gap: number; thick: number; beams: boolean }): VesselPart {
  const a = new PartBuilder(), x0 = end * L.halfLength, top = L.deckY, m = Math.max(2, Math.round(L.apron / o.plankW));
  if (o.beams) for (const sz of [-1, 1]) a.box([L.apron, 0.12, 0.16], [x0 + (end * L.apron) / 2, top - o.thick - 0.06, sz * (L.halfBeam - 0.5)], WOOD.dark);
  for (let i = 0; i < m; i++) a.box([L.apron / m - o.gap, o.thick, 2 * L.halfBeam - 0.4], [x0 + end * (i + 0.5) * (L.apron / m), top - o.thick / 2, 0], woodTone(r), 0, 0, { sideAO: SEAM_AO });
  return { material: 'wood', geometry: a.build(), apron: { end, hinge: [x0, top - o.thick / 2] } };
}
