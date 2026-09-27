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

/** Planar UVs from the dominant normal axis, in metres / TEX_M, so texel density is the same on every part. */
export function worldUv(g: THREE.BufferGeometry) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u / TEX_M; uv[i * 2 + 1] = v / TEX_M;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Collects primitive pieces (non-indexed, vertex-coloured, world-UV'd) and merges them into one geometry. */
export class PartBuilder {
  private geos: THREE.BufferGeometry[] = [];
  get empty() { return this.geos.length === 0; }
  box(size: V3, at: V3, color: THREE.ColorRepresentation, rotZ = 0, rotY = 0) {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
    if (rotZ) g.rotateZ(rotZ);
    if (rotY) g.rotateY(rotY);
    g.translate(at[0], at[1], at[2]);
    return this.add(g, color);
  }
  /** Cylinder along `axis` (default Y), centred at `at`. */
  cylinder(rTop: number, rBottom: number, length: number, at: V3, color: THREE.ColorRepresentation, axis: 'x' | 'y' | 'z' = 'y', radial = 8) {
    const g = new THREE.CylinderGeometry(rTop, rBottom, length, radial, 1);
    if (axis === 'x') g.rotateZ(-Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(at[0], at[1], at[2]);
    return this.add(g, color);
  }
  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    _c.set(color);
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) { col[i] = _c.r; col[i + 1] = _c.g; col[i + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    worldUv(g);
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

/** Shared vessel palette (sRGB hex → linear THREE.Color). One copy for every builder. */
export const WOOD = {
  base: new THREE.Color(0x7c6a52), dark: new THREE.Color(0x4f4234), bleach: new THREE.Color(0xa39580),
  strake: new THREE.Color(0x5e5040), tar: new THREE.Color(0x221d19), iron: new THREE.Color(0x2b2826),
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

/** Hinged plank apron for the wooden kinds, built flat from the hinge (x = end·halfLength) outward. */
export function plankApron(end: 1 | -1, L: { halfLength: number; halfBeam: number; deckY: number; apron: number },
  r: () => number, o: { plankW: number; gap: number; thick: number; beams: boolean }): VesselPart {
  const a = new PartBuilder(), x0 = end * L.halfLength, top = L.deckY, m = Math.max(2, Math.round(L.apron / o.plankW));
  if (o.beams) for (const sz of [-1, 1]) a.box([L.apron, 0.12, 0.16], [x0 + (end * L.apron) / 2, top - o.thick - 0.06, sz * (L.halfBeam - 0.5)], WOOD.dark);
  for (let i = 0; i < m; i++) a.box([L.apron / m - o.gap, o.thick, 2 * L.halfBeam - 0.4], [x0 + end * (i + 0.5) * (L.apron / m), top - o.thick / 2, 0], woodTone(r));
  return { material: 'wood', geometry: a.build(), apron: { end, hinge: [x0, top - o.thick / 2] } };
}
