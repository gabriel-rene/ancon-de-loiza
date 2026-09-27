// src/people/figureBatch.ts
import * as THREE from 'three';
import { buildFigureGeometries, buildHairGeometries, buildHatGeometries, GEO_ALT, PART_GEO, type Detail, type GeoKind, type Hair, type Hat } from './geometry';
import type { FigureLook } from './palettes';
import { PART_INDEX, PARTS, ZERO_MATRIX, type FigurePose } from './rig';

export const GEO_KINDS: GeoKind[] = ['hips', 'torso', 'tail', 'head', 'upperArm', 'foreArm', 'handL', 'handR', 'thigh', 'shin', 'shinFlare', 'foot', 'footBare', 'skirt'];
export const HATS: Hat[] = ['straw', 'fedora', 'cap', 'wrap'];
export const HAIRS_KINDS: Hair[] = ['crop', 'close', 'bun'];
/**
 * Small parts that cast no shadow (perf, spec §13): hands, feet and hair add a draw call each to the shadow
 * pass for a shadow a few pixels wide, mostly inside the body's own. They still receive shadows.
 */
export const NO_SHADOW: ReadonlySet<GeoKind> = new Set<GeoKind>(['handL', 'handR', 'foot', 'footBare']);
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
/** All 16 elements of the matrix at `o` are 0 (ZERO_MATRIX: a part the pose hides). */
function isZero(a: Float32Array, o: number) { for (let k = 0; k < 16; k++) if (a[o + k] !== 0) return false; return true; }

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
  /** Per mesh (order of `all`): which slots hold a live (non-zero) instance, and how many. */
  private readonly live: Uint8Array[] = [];
  private readonly liveN: Int32Array;
  private readonly bodyAt: Record<GeoKind, number> = {} as Record<GeoKind, number>;
  /** Per figure: hat index + 1 (0 = none), hair index + 1, flared shins, bare feet. */
  private readonly hatOf: Uint8Array;
  private readonly hairOf: Uint8Array;
  private readonly flare: Uint8Array;
  private readonly bare: Uint8Array;
  private looksDirty = false;

  constructor(readonly max: number, material: THREE.Material, readonly detail: Detail = 'hi') {
    const g = (geoCache[detail] ??= { body: buildFigureGeometries(detail), hats: buildHatGeometries(detail), hair: buildHairGeometries(detail) });
    this.hatOf = new Uint8Array(max); this.hairOf = new Uint8Array(max); this.flare = new Uint8Array(max); this.bare = new Uint8Array(max);
    const make = (geo: THREE.BufferGeometry, n: number, list: THREE.InstancedMesh[], castShadow = true) => {
      const m = new THREE.InstancedMesh(geo, material, n);
      m.castShadow = castShadow; m.receiveShadow = true; m.frustumCulled = false;
      for (let i = 0; i < n; i++) { m.setMatrixAt(i, ZERO_MATRIX); m.setColorAt(i, _c.set(0xffffff)); }
      this.group.add(m); list.push(m); this.all.push(m); this.live.push(new Uint8Array(n));
      m.visible = false;   // nothing live until set()
      return m;
    };
    this.meshes = {} as Record<GeoKind, THREE.InstancedMesh>;
    for (const k of GEO_KINDS) { this.bodyAt[k] = this.all.length; this.meshes[k] = make(g.body[k], max * PER_KIND[k], this.bodyList, !NO_SHADOW.has(k)); }
    this.hats = {} as Record<Hat, THREE.InstancedMesh>;
    for (const h of HATS) this.hats[h] = make(g.hats[h], max, this.hatList);
    this.hair = {} as Record<Hair, THREE.InstancedMesh>;
    for (const h of HAIRS_KINDS) this.hair[h] = make(g.hair[h], max, this.hairList, false);
    this.liveN = new Int32Array(this.all.length);
  }

  /** Mesh `j` (index into `all`), slot `slot`: live or collapsed. */
  private put(j: number, slot: number, m: THREE.Matrix4 | null) {
    const on = m ? 1 : 0, l = this.live[j];
    this.liveN[j] += on - l[slot]; l[slot] = on;
    this.all[j].setMatrixAt(slot, m ?? ZERO_MATRIX);
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
      // A part the pose collapses (thighs under a dress, the tail or skirt when not worn) is not live.
      const m = isZero(pose.parts, p * 16) ? null : _m, jk = this.bodyAt[k], ja = a ? this.bodyAt[a] : -1;
      if (a && (k === 'shin' ? this.flare[i] : this.bare[i])) { this.put(ja, slot, m); this.put(jk, slot, null); }
      else { this.put(jk, slot, m); if (a) this.put(ja, slot, null); }
    }
    _m.fromArray(pose.parts, HEAD * 16).premultiply(world);
    const h0 = this.bodyList.length, r0 = h0 + this.hatList.length;
    for (let h = 0; h < this.hatList.length; h++) this.put(h0 + h, i, this.hatOf[i] === h + 1 ? _m : null);
    for (let h = 0; h < this.hairList.length; h++) this.put(r0 + h, i, this.hairOf[i] === h + 1 ? _m : null);
  }

  hide(i: number) {
    for (let j = 0; j < GEO_KINDS.length; j++) {
      const k = GEO_KINDS[j], n = PER_KIND[k], jk = this.bodyAt[k];
      for (let r = 0; r < n; r++) this.put(jk, i * n + r, null);
    }
    const h0 = this.bodyList.length;
    for (let h = 0; h < this.hatList.length + this.hairList.length; h++) this.put(h0 + h, i, null);
  }

  /**
   * Uploads this frame's instances. A mesh with no live instance (a whole kind unused — no bun, no flared
   * hems, nobody on board) is made invisible, so it costs no draw call in any pass (colour, shadow, reflection).
   */
  commit() {
    for (let j = 0; j < this.all.length; j++) {
      const m = this.all[j];
      m.visible = this.liveN[j] > 0;
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
