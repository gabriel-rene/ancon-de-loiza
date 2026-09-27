// src/people/figureBatch.ts
import * as THREE from 'three';
import { buildFigureGeometries, buildHairGeometries, buildHatGeometries, GEO_ALT, PART_GEO, type Detail, type GeoKind, type Hair, type Hat } from './geometry';
import type { FigureLook } from './palettes';
import { PART_INDEX, PARTS, ZERO_MATRIX, type FigurePose } from './rig';

export const GEO_KINDS: GeoKind[] = ['hips', 'torso', 'tail', 'head', 'upperArm', 'foreArm', 'handL', 'handR', 'thigh', 'shin', 'shinFlare', 'foot', 'footBare', 'skirt'];
export const HATS: Hat[] = ['straw', 'fedora', 'cap', 'wrap'];
export const HAIRS_KINDS: Hair[] = ['crop', 'close', 'bun'];
/** Slots per figure of each geometry kind, counted from PART_GEO (an alternate has its base's slots). */
export const PER_KIND = GEO_KINDS.reduce((o, k) => {
  const base = (Object.keys(GEO_ALT) as GeoKind[]).find((b) => GEO_ALT[b] === k) ?? k;
  o[k] = PARTS.filter((p) => PART_GEO[p] === base).length;
  return o;
}, {} as Record<GeoKind, number>);
/** Per part (PARTS order): its base kind, its alternate kind (or null) and its rank among the parts of that kind. */
const KIND = PARTS.map((p) => PART_GEO[p]);
const ALT = KIND.map((k) => GEO_ALT[k] ?? null);
const RANK = PARTS.map((p, i) => PARTS.slice(0, i).filter((q) => PART_GEO[q] === PART_GEO[p]).length);
const HEAD = PART_INDEX.head;
type Geos = { body: Record<GeoKind, THREE.BufferGeometry>; hats: Record<Hat, THREE.BufferGeometry>; hair: Record<Hair, THREE.BufferGeometry> };
const geoCache: Partial<Record<Detail, Geos>> = {};
const _m = new THREE.Matrix4(), _c = new THREE.Color();

/**
 * Up to `max` stylised figures, drawn as one InstancedMesh per body-part geometry, hat and hair kind
 * (21 draw calls). `detail` picks the geometry tier: 'hi' for the crew and near passengers, 'lo' for distant
 * people. Looks (colours, hat, hair, flared hems, bare feet) are set once with setLook; set() is per frame
 * and allocation-free.
 */
export class FigureBatch {
  readonly group = new THREE.Group();
  readonly meshes: Record<GeoKind, THREE.InstancedMesh>;
  readonly hats: Record<Hat, THREE.InstancedMesh>;
  readonly hair: Record<Hair, THREE.InstancedMesh>;
  private readonly bodyList: THREE.InstancedMesh[] = [];
  private readonly hatList: THREE.InstancedMesh[] = [];
  private readonly hairList: THREE.InstancedMesh[] = [];
  private readonly all: THREE.InstancedMesh[] = [];
  /** Per figure: hat index + 1 (0 = none), hair index + 1, flared shins, bare feet. */
  private readonly hatOf: Uint8Array;
  private readonly hairOf: Uint8Array;
  private readonly flare: Uint8Array;
  private readonly bare: Uint8Array;
  private looksDirty = false;

  constructor(readonly max: number, material: THREE.Material, readonly detail: Detail = 'hi') {
    const g = (geoCache[detail] ??= { body: buildFigureGeometries(detail), hats: buildHatGeometries(detail), hair: buildHairGeometries(detail) });
    this.hatOf = new Uint8Array(max); this.hairOf = new Uint8Array(max); this.flare = new Uint8Array(max); this.bare = new Uint8Array(max);
    const make = (geo: THREE.BufferGeometry, n: number, list: THREE.InstancedMesh[]) => {
      const m = new THREE.InstancedMesh(geo, material, n);
      m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
      for (let i = 0; i < n; i++) { m.setMatrixAt(i, ZERO_MATRIX); m.setColorAt(i, _c.set(0xffffff)); }
      this.group.add(m); list.push(m); this.all.push(m);
      return m;
    };
    this.meshes = {} as Record<GeoKind, THREE.InstancedMesh>;
    for (const k of GEO_KINDS) this.meshes[k] = make(g.body[k], max * PER_KIND[k], this.bodyList);
    this.hats = {} as Record<Hat, THREE.InstancedMesh>;
    for (const h of HATS) this.hats[h] = make(g.hats[h], max, this.hatList);
    this.hair = {} as Record<Hair, THREE.InstancedMesh>;
    for (const h of HAIRS_KINDS) this.hair[h] = make(g.hair[h], max, this.hairList);
  }

  setLook(i: number, look: FigureLook) {
    for (let p = 0; p < PARTS.length; p++) {
      const k = KIND[p], a = ALT[p], slot = i * PER_KIND[k] + RANK[p];
      _c.set(look.colors[PARTS[p]]);
      this.meshes[k].setColorAt(slot, _c);
      if (a) this.meshes[a].setColorAt(slot, _c);
    }
    // Every hat / hair mesh gets the colour at slot i; only the worn one is shown by set().
    _c.set(look.hatColor);
    for (let h = 0; h < this.hatList.length; h++) this.hatList[h].setColorAt(i, _c);
    _c.set(look.hairColor);
    for (let h = 0; h < this.hairList.length; h++) this.hairList[h].setColorAt(i, _c);
    this.hatOf[i] = look.hat === 'none' ? 0 : HATS.indexOf(look.hat) + 1;
    this.hairOf[i] = look.hair === 'none' ? 0 : HAIRS_KINDS.indexOf(look.hair) + 1;
    this.flare[i] = look.flare ? 1 : 0; this.bare[i] = look.barefoot ? 1 : 0;
    this.looksDirty = true;
  }

  /** Figure i at `world` (figure → world) in `pose`, dressed as its look (setLook). */
  set(i: number, world: THREE.Matrix4, pose: FigurePose) {
    for (let p = 0; p < PARTS.length; p++) {
      const k = KIND[p], a = ALT[p], slot = i * PER_KIND[k] + RANK[p];
      _m.fromArray(pose.parts, p * 16).premultiply(world);
      if (a && (k === 'shin' ? this.flare[i] : this.bare[i])) { this.meshes[a].setMatrixAt(slot, _m); this.meshes[k].setMatrixAt(slot, ZERO_MATRIX); }
      else { this.meshes[k].setMatrixAt(slot, _m); if (a) this.meshes[a].setMatrixAt(slot, ZERO_MATRIX); }
    }
    _m.fromArray(pose.parts, HEAD * 16).premultiply(world);
    for (let h = 0; h < this.hatList.length; h++) this.hatList[h].setMatrixAt(i, this.hatOf[i] === h + 1 ? _m : ZERO_MATRIX);
    for (let h = 0; h < this.hairList.length; h++) this.hairList[h].setMatrixAt(i, this.hairOf[i] === h + 1 ? _m : ZERO_MATRIX);
  }

  hide(i: number) {
    for (let j = 0; j < GEO_KINDS.length; j++) {
      const k = GEO_KINDS[j], n = PER_KIND[k];
      for (let r = 0; r < n; r++) this.meshes[k].setMatrixAt(i * n + r, ZERO_MATRIX);
    }
    for (let h = 0; h < this.hatList.length; h++) this.hatList[h].setMatrixAt(i, ZERO_MATRIX);
    for (let h = 0; h < this.hairList.length; h++) this.hairList[h].setMatrixAt(i, ZERO_MATRIX);
  }

  commit() {
    for (let j = 0; j < this.all.length; j++) {
      const m = this.all[j];
      m.instanceMatrix.needsUpdate = true;
      if (this.looksDirty) m.instanceColor!.needsUpdate = true;
    }
    this.looksDirty = false;
  }

  /** Disposes the instance buffers; the shared part geometries stay cached per detail tier for the app's life. The material belongs to the caller. */
  dispose() {
    for (let j = 0; j < this.all.length; j++) { this.all[j].dispose(); this.group.remove(this.all[j]); }
  }
}
