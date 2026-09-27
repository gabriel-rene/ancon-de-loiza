// src/people/figureBatch.ts
import * as THREE from 'three';
import { buildFigureGeometries, buildHatGeometries, PART_GEO, type GeoKind } from './geometry';
import type { FigureLook, HatKind } from './palettes';
import { PART_INDEX, PARTS, ZERO_MATRIX, type FigurePose } from './rig';

type Hat = Exclude<HatKind, 'none'>;
const GEO_KINDS: GeoKind[] = ['hips', 'torso', 'head', 'limb', 'foot', 'skirt'];
const HATS: Hat[] = ['straw', 'fedora', 'cap', 'wrap'];
/** Parts per figure of each geometry kind, counted from PART_GEO (limb 8, foot 2, the rest 1). */
export const PER_KIND = GEO_KINDS.reduce((o, k) => { o[k] = PARTS.filter((p) => PART_GEO[p] === k).length; return o; }, {} as Record<GeoKind, number>);
/** Rank of each part among the parts of its kind (PARTS order): slot = figure · PER_KIND[kind] + rank. */
const RANK = PARTS.map((p, i) => PARTS.slice(0, i).filter((q) => PART_GEO[q] === PART_GEO[p]).length);
let geoCache: { body: Record<GeoKind, THREE.BufferGeometry>; hats: Record<Hat, THREE.BufferGeometry> } | null = null;
const _m = new THREE.Matrix4(), _c = new THREE.Color();

/** Up to `max` stylised figures, drawn as one InstancedMesh per body-part geometry and per hat kind (≈ 10 draw calls). */
export class FigureBatch {
  readonly group = new THREE.Group();
  readonly meshes: Record<GeoKind, THREE.InstancedMesh>;
  readonly hats: Record<Hat, THREE.InstancedMesh>;
  private looksDirty = false;

  constructor(readonly max: number, material: THREE.Material) {
    geoCache ??= { body: buildFigureGeometries(), hats: buildHatGeometries() };
    const make = (g: THREE.BufferGeometry, n: number) => {
      const m = new THREE.InstancedMesh(g, material, n);
      m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
      for (let i = 0; i < n; i++) { m.setMatrixAt(i, ZERO_MATRIX); m.setColorAt(i, _c.set(0xffffff)); }
      this.group.add(m);
      return m;
    };
    this.meshes = {} as Record<GeoKind, THREE.InstancedMesh>;
    for (const k of GEO_KINDS) this.meshes[k] = make(geoCache.body[k], max * PER_KIND[k]);
    this.hats = {} as Record<Hat, THREE.InstancedMesh>;
    for (const h of HATS) this.hats[h] = make(geoCache.hats[h], max);
  }

  setLook(i: number, look: FigureLook) {
    for (let p = 0; p < PARTS.length; p++) {
      const k = PART_GEO[PARTS[p]];
      this.meshes[k].setColorAt(i * PER_KIND[k] + RANK[p], _c.set(look.colors[PARTS[p]]));
    }
    if (look.hat !== 'none') this.hats[look.hat].setColorAt(i, _c.set(look.hatColor));
    this.looksDirty = true;
  }

  /** Figure i at `world` (figure → world) in `pose`, wearing `hat`. */
  set(i: number, world: THREE.Matrix4, pose: FigurePose, hat: HatKind) {
    for (let p = 0; p < PARTS.length; p++) {
      const k = PART_GEO[PARTS[p]];
      this.meshes[k].setMatrixAt(i * PER_KIND[k] + RANK[p], _m.fromArray(pose.parts, p * 16).premultiply(world));
    }
    _m.fromArray(pose.parts, PART_INDEX.head * 16).premultiply(world);
    for (const h of HATS) this.hats[h].setMatrixAt(i, h === hat ? _m : ZERO_MATRIX);
  }

  hide(i: number) {
    for (const k of GEO_KINDS) for (let r = 0; r < PER_KIND[k]; r++) this.meshes[k].setMatrixAt(i * PER_KIND[k] + r, ZERO_MATRIX);
    for (const h of HATS) this.hats[h].setMatrixAt(i, ZERO_MATRIX);
  }

  commit() {
    for (const k of GEO_KINDS) this.meshes[k].instanceMatrix.needsUpdate = true;
    for (const h of HATS) this.hats[h].instanceMatrix.needsUpdate = true;
    if (this.looksDirty) {
      for (const k of GEO_KINDS) this.meshes[k].instanceColor!.needsUpdate = true;
      for (const h of HATS) this.hats[h].instanceColor!.needsUpdate = true;
      this.looksDirty = false;
    }
  }

  /** Disposes the instance buffers; the shared part geometries stay cached for the app's life. */
  dispose() { for (const m of [...Object.values(this.meshes), ...Object.values(this.hats)]) m.dispose(); }
}
