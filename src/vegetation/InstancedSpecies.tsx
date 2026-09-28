import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { reflectionHooks } from '../scene/water/reflectionHooks';
import { useStore } from '../state/store';
import { bakeImpostor } from './impostor';
import { shadowFocus, type ShadowFocusResult } from '../scene/shadowFocus';
import { sunUniforms } from '../scene/sunUniforms';
import { composeInstanceMatrices, gatherMatrices, lightBox, newLightBox, newWedge, partitionShadow, partitionView, viewWedge, wedgeCovers } from './lod';
import { vegStats, vegTiming } from './stats';
import type { PlantInstance, PlantPart } from './types';
import { makePlantMaterials, setWindTime } from './windMaterial';

type MatPair = { material: THREE.Material; depth: THREE.Material };
export type PlantMaterials = Record<'bark' | 'foliage', MatPair>;

interface VariantLod {
  matrices: Float32Array; xs: Float32Array; zs: Float32Array;
  /** Per-instance view-cull radius (m): crown extent × scale, wind sway and the camera move allowed between splits. */
  rs: Float32Array;
  /** Per-instance shadow-cull sphere: centre height (world y) and radius (m). */
  ys: Float32Array; ls: Float32Array;
  near: Uint32Array; far: Uint32Array; cast: Uint32Array;
  /** In view: instances within reflLod0 (n0), the rest of LOD0 (n1), beyond LOD0 (nFar). LOD0 shadow casters (nCast). */
  n0: number; n1: number; nFar: number; nCast: number;
  /** LOD0 part meshes (main view and reflection; they cast no shadow); they share one instanceMatrix attribute laid out [n0 | n1]. */
  parts: THREE.InstancedMesh[]; partMatrix: THREE.InstancedBufferAttribute;
  /**
   * Shadow-pass twins of the casting parts, over the LOD0 instances in the sun's shadow box (in
   * view or not). They keep count 0 outside the shadow pass (three skips zero-instance draws).
   */
  shadows: THREE.InstancedMesh[]; castMatrix: THREE.InstancedBufferAttribute;
  /**
   * Cards, instance buffer laid out [nFar | n1]: the main view draws the first nFar (far
   * cards), the water reflection draws all nFar + n1 (everything outside reflLod0).
   */
  cards: THREE.InstancedMesh;
  /** Reused update-range records (no per-commit allocation). */
  partRange: { start: number; count: number }; cardRange: { start: number; count: number }; castRange: { start: number; count: number };
}

/** Per-variant impostor: baked texture, crossed-card geometry and its card materials. */
interface Bake { texture: THREE.Texture; card: THREE.BufferGeometry; mats: MatPair }

const LOD_INTERVAL = 0.25; // s
const LOD_MOVE = 8;        // m, horizontal: redo the split at once after this move
const LOD_MOVE2 = LOD_MOVE * LOD_MOVE;
const LOD_STILL2 = 0.5 * 0.5; // m²: below this the split cannot have changed, so skip the timed refresh
/** View-cull wedge margin: the camera may turn this far (rad) before the split must be redone. */
const VIEW_MARGIN = 12 * Math.PI / 180;
/** Wind tip sway plus flutter (m), added to every cull radius. */
const SWAY = 1;
/** The shadow camera's target may drift this far (m) before the shadow-caster set is redone. */
const SHADOW_SLACK = 10;
/** …or the sun turn this far (cos of 1°). */
const SUN_COS = Math.cos(Math.PI / 180);
/** NDC corners (x, y) of the view, unprojected at depth 0.5 to get the frustum's corner rays. */
const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const;
const _v = new THREE.Vector3();

/**
 * Extents (m, before instance scale) of a plant's parts: horizontal radius about the trunk axis
 * (`r`), and a bounding sphere centred on the axis at height `cy` with radius `rs`.
 */
function plantExtent(variants: PlantPart[][]): { r: number; cy: number; rs: number } {
  let r = 0, minY = Infinity, maxY = -Infinity;
  for (const parts of variants) for (const p of parts) {
    if (!p.geometry.boundingBox) p.geometry.computeBoundingBox();
    const b = p.geometry.boundingBox!;
    r = Math.max(r, Math.hypot(Math.max(-b.min.x, b.max.x), Math.max(-b.min.z, b.max.z)));
    minY = Math.min(minY, b.min.y); maxY = Math.max(maxY, b.max.y);
  }
  const cy = (minY + maxY) / 2;
  return { r, cy, rs: Math.hypot(r, (maxY - minY) / 2) };
}
const _focus: ShadowFocusResult = { target: [0, 0, 0], position: [0, 0, 0] };
const _cp: [number, number, number] = [0, 0, 0], _cd: [number, number, number] = [0, 0, 0], _sd: [number, number, number] = [0, 0, 0];

/** Corner-ray directions of `camera`'s frustum (world), into `out` (12 floats). */
function frustumRays(camera: THREE.Camera, out: Float32Array) {
  const p = camera.matrixWorld.elements;
  for (let i = 0; i < CORNERS.length; i++) {
    _v.set(CORNERS[i][0], CORNERS[i][1], 0.5).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
    out[i * 3] = _v.x - p[12]; out[i * 3 + 1] = _v.y - p[13]; out[i * 3 + 2] = _v.z - p[14];
  }
  return out;
}

/** Upload the first `count` matrices (reusing `range`; three clears the list after upload). */
export function commit(attr: THREE.InstancedBufferAttribute, count: number, range: { start: number; count: number }) {
  if (count <= 0) return;
  attr.clearUpdateRanges();
  range.start = 0; range.count = count * 16;
  attr.updateRanges.push(range);
  attr.needsUpdate = true;
}

function newInstanced(geometry: THREE.BufferGeometry, pair: MatPair, n: number) {
  const m = new THREE.InstancedMesh(geometry, pair.material, n);
  m.customDepthMaterial = pair.depth;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.receiveShadow = true;
  m.count = 0;
  return m;
}

function translucencyOf(m: THREE.Material): number {
  const u = (m as THREE.Material & { uniforms?: Record<string, THREE.IUniform> }).uniforms;
  return typeof u?.uTrans?.value === 'number' ? u.uTrans.value : 0;
}

function tintOf(m: THREE.Material): { value: number; hue: number } {
  const u = (m as THREE.Material & { uniforms?: Record<string, THREE.IUniform> }).uniforms;
  const v = u?.uTint?.value as number[] | undefined;
  return { value: v?.[0] ?? 0, hue: v?.[1] ?? 0 };
}

/**
 * Instanced renderer for one species: LOD0 part meshes near the camera, baked impostor cards
 * beyond `lod0` metres. The water reflection keeps the meshes within `reflLod0` metres (prop
 * roots and crown gaps must read in a nearby reflection; 0 = cards only) and draws everything
 * else as cards. Plants outside the camera's horizontal view wedge (widened by 12°, the camera
 * move allowed between splits and each plant's crown) are left out of the main view and the
 * reflection (whose mirrored camera has the same wedge). Shadows come from separate shadow-pass
 * meshes over every LOD0 plant (in view or not) that can reach the sun's shadow box.
 * The split is recomputed every 250 ms while the camera moves (at once after an 8 m move, a
 * turn out of the wedge, a 10 m shadow-box drift or a 1° sun turn; not while it stands still);
 * the repartition and matrix gathers allocate nothing.
 */
export function InstancedSpecies({ variants, materials, instances, lod0, reflLod0, castShadow, farCards, shadowHalf = 0, shadowMap = 0, name = 'plant' }: {
  variants: PlantPart[][]; materials: PlantMaterials; instances: PlantInstance[];
  lod0: number; reflLod0: number; castShadow: boolean; farCards: boolean;
  /** The sun's shadow camera (half-width m, map size; see `shadowFocus`): out-of-view LOD0 plants cast only inside it. 0 = no culling. */
  shadowHalf?: number; shadowMap?: number;
  /** Species name, used to label impostor textures (and their coverage warnings). */
  name?: string;
}) {
  const gl = useThree((s) => s.gl);
  const frozen = useStore((s) => s.frozen);
  const group = useRef<THREE.Group>(null);
  const built = useRef<VariantLod[]>([]);
  const lod = useRef({ lod0, reflLod0, farCards, castShadow, shadowHalf, shadowMap, dirty: true, t: -1, cx: 0, cz: 0 });
  const statsRef = useRef<{ near: number; far: number } | null>(null);
  const split = useRef(new Uint32Array(4));
  const view = useRef({ wedge: newWedge(), cur: newWedge(), rays: new Float32Array(12), box: newLightBox(), tx: 0, tz: 0, sun: new THREE.Vector3() });
  const [bakes, setBakes] = useState<(Bake | null)[] | null>(null);

  // Impostor bakes depend only on the plant (variants + materials), not on where it stands, so
  // a new instance set (era / quality change) reuses them.
  useEffect(() => {
    const t0 = performance.now();
    const trans = translucencyOf(materials.foliage.material);
    const tint = tintOf(materials.foliage.material);
    const out = variants.map((parts, v): Bake | null => {
      if (parts.length === 0) return null;
      const { texture, card } = bakeImpostor(gl, parts.map((p) => ({ geometry: p.geometry, material: materials[p.name].material })), 256, `impostor:${name}-${v}`);
      const mats = makePlantMaterials({ part: 'foliage', map: texture, color: 0xffffff, roughness: 0.9, alphaTest: 0.5, translucency: trans, tint, bentNormals: true });
      return { texture, card, mats };
    });
    vegTiming.bakeMs += performance.now() - t0;
    setBakes(out);
    return () => {
      // Clear the bakes before disposing them, so the mesh-build effect below (which may still be
      // scheduled to run on stale `bakes`) sees null and skips instead of using disposed resources.
      setBakes(null);
      for (const b of out) if (b) { b.card.dispose(); b.texture.dispose(); b.mats.material.dispose(); b.mats.depth.dispose(); }
    };
  }, [gl, variants, materials, name]);

  useEffect(() => {
    const g = group.current;
    if (!g || !bakes || bakes.length !== variants.length) return;
    const out: VariantLod[] = [];
    const ext = plantExtent(variants);
    variants.forEach((parts, v) => {
      const list = instances.filter((p) => p.variant === v);
      const n = list.length, bake = bakes[v];
      if (n === 0 || !bake) return;
      const matrices = composeInstanceMatrices(list);
      const xs = new Float32Array(n), zs = new Float32Array(n), rs = new Float32Array(n), ys = new Float32Array(n), ls = new Float32Array(n);
      list.forEach((p, i) => {
        xs[i] = p.x; zs[i] = p.z; rs[i] = p.scale * ext.r + SWAY + LOD_MOVE;
        ys[i] = p.y + p.scale * ext.cy; ls[i] = p.scale * ext.rs + SWAY;
      });

      const partMatrix = new THREE.InstancedBufferAttribute(new Float32Array(n * 16), 16);
      partMatrix.setUsage(THREE.DynamicDrawUsage);
      const castMatrix = new THREE.InstancedBufferAttribute(new Float32Array(n * 16), 16);
      castMatrix.setUsage(THREE.DynamicDrawUsage);
      const b: VariantLod = {
        matrices, xs, zs, rs, ys, ls, near: new Uint32Array(n), far: new Uint32Array(n), cast: new Uint32Array(n), n0: 0, n1: 0, nFar: 0, nCast: 0,
        parts: [], partMatrix, shadows: [], castMatrix, cards: null!,
        partRange: { start: 0, count: 0 }, cardRange: { start: 0, count: 0 }, castRange: { start: 0, count: 0 },
      };
      const partMeshes = parts.map((p) => {
        const m = newInstanced(p.geometry, materials[p.name], n);
        m.instanceMatrix = partMatrix;
        m.name = `veg-lod0-${p.name}-${name}-${v}`;
        m.castShadow = false;
        return m;
      });
      // Small detail (`shadow: false`, e.g. pneumatophores) gets no shadow twin.
      const shadowMeshes = parts.filter((p) => p.shadow !== false).map((p) => {
        const m = newInstanced(p.geometry, materials[p.name], n);
        m.instanceMatrix = castMatrix;
        m.name = `veg-shadow-${p.name}-${name}-${v}`;
        m.onBeforeShadow = () => { m.count = b.nCast; };
        m.onAfterShadow = () => { m.count = 0; };
        return m;
      });
      const cards = newInstanced(bake.card, bake.mats, n);
      cards.name = `veg-cards-${name}-${v}`;
      // Cards start beyond LOD0, which is wider than the shadow map's reach: they never cast.
      cards.castShadow = false;

      for (const m of [...partMeshes, ...shadowMeshes, cards]) g.add(m);
      b.parts = partMeshes; b.shadows = shadowMeshes; b.cards = cards;
      out.push(b);
    });
    built.current = out;
    lod.current.dirty = true;

    const stats = { near: 0, far: 0 };
    vegStats.set(stats, stats);
    const before = () => {
      for (const b of built.current) {
        for (const m of b.parts) { m.count = b.n0; m.visible = b.n0 > 0; }
        b.cards.count = b.nFar + b.n1;
        b.cards.visible = b.cards.count > 0;
      }
    };
    const after = () => {
      for (const b of built.current) {
        const nNear = b.n0 + b.n1;
        for (const m of b.parts) { m.count = nNear; m.visible = nNear > 0; }
        b.cards.count = lod.current.farCards ? b.nFar : 0;
        b.cards.visible = b.cards.count > 0;
      }
    };
    reflectionHooks.before.add(before);
    reflectionHooks.after.add(after);
    statsRef.current = stats;

    return () => {
      reflectionHooks.before.delete(before);
      reflectionHooks.after.delete(after);
      vegStats.delete(stats);
      statsRef.current = null;
      for (const b of out) for (const m of [...b.parts, ...b.shadows, b.cards]) { g.remove(m); m.dispose(); }
      built.current = [];
    };
  }, [bakes, variants, materials, instances]);

  useEffect(() => {
    const l = lod.current;
    l.lod0 = lod0; l.reflLod0 = reflLod0; l.farCards = farCards; l.castShadow = castShadow; l.shadowHalf = shadowHalf; l.shadowMap = shadowMap; l.dirty = true;
  }, [lod0, reflLod0, farCards, castShadow, shadowHalf, shadowMap]);

  useFrame((state) => {
    setWindTime(state.clock.elapsedTime, frozen);
    const l = lod.current, cam = state.camera.position, t = state.clock.elapsedTime;
    const dx = cam.x - l.cx, dz = cam.z - l.cz;
    const moved2 = dx * dx + dz * dz;
    // Redo the split at once when the camera turns out of the culled wedge.
    const vw = view.current;
    state.camera.updateMatrixWorld();
    viewWedge(cam.x, cam.z, frustumRays(state.camera, vw.rays), 0, vw.cur);
    let turned = !wedgeCovers(vw.wedge, vw.cur);
    // Shadow casters out of view: redo when the shadow camera's target drifts or the sun turns.
    const cullShadow = l.castShadow && l.shadowHalf > 0, sun = sunUniforms.uSunDir.value;
    if (cullShadow) {
      _cp[0] = cam.x; _cp[1] = cam.y; _cp[2] = cam.z;
      state.camera.getWorldDirection(_v); _cd[0] = _v.x; _cd[1] = _v.y; _cd[2] = _v.z;
      _sd[0] = sun.x; _sd[1] = sun.y; _sd[2] = sun.z;
      shadowFocus(_cp, _cd, _sd, l.shadowHalf, l.shadowMap || 1, _focus);
      const fx = _focus.target[0] - vw.tx, fz = _focus.target[2] - vw.tz;
      if (fx * fx + fz * fz > SHADOW_SLACK * SHADOW_SLACK || sun.dot(vw.sun) < SUN_COS * sun.length() * vw.sun.length()) turned = true;
    }
    if (!l.dirty && !turned && (moved2 < LOD_STILL2 || (t - l.t < LOD_INTERVAL && moved2 < LOD_MOVE2))) return;
    l.dirty = false; l.t = t; l.cx = cam.x; l.cz = cam.z;
    const t0 = performance.now();
    viewWedge(cam.x, cam.z, vw.rays, VIEW_MARGIN, vw.wedge);
    const box = cullShadow ? lightBox(_focus.target, _sd, l.shadowHalf, SHADOW_SLACK, vw.box) : null;
    if (cullShadow) { vw.tx = _focus.target[0]; vw.tz = _focus.target[2]; vw.sun.copy(sun); }
    let sn = 0, sf = 0;
    const dR = Math.min(l.reflLod0, l.lod0);
    for (const b of built.current) {
      const sp = partitionView(b.xs, b.zs, b.rs, cam.x, cam.z, dR, l.lod0, vw.wedge, b.near, b.far, split.current);
      const n0 = sp[0], n1 = sp[1], f = sp[2];
      b.n0 = n0; b.n1 = n1; b.nFar = f;
      const tail = b.near.length - n1; // the n1 ring sits at the back of `near`
      const pm = b.partMatrix.array as Float32Array, cm = b.cards.instanceMatrix.array as Float32Array;
      gatherMatrices(b.matrices, b.near, n0, pm);
      gatherMatrices(b.matrices, b.near, n1, pm, tail, n0);
      commit(b.partMatrix, n0 + n1, b.partRange);
      for (const m of b.parts) { m.count = n0 + n1; m.visible = n0 + n1 > 0; }
      const nc = l.castShadow ? partitionShadow(b.xs, b.ys, b.zs, b.ls, cam.x, cam.z, l.lod0, box, b.cast) : 0;
      b.nCast = nc;
      gatherMatrices(b.matrices, b.cast, nc, b.castMatrix.array as Float32Array);
      commit(b.castMatrix, nc, b.castRange);
      for (const m of b.shadows) { m.count = 0; m.visible = nc > 0; m.castShadow = l.castShadow; }
      // Far cards first, then the LOD0 ring outside reflLod0 (drawn only in the reflection).
      gatherMatrices(b.matrices, b.far, f, cm);
      gatherMatrices(b.matrices, b.near, n1, cm, tail, f);
      commit(b.cards.instanceMatrix, f + n1, b.cardRange);
      const cardCount = l.farCards ? f : 0;
      b.cards.count = cardCount;
      b.cards.visible = cardCount > 0;
      sn += n0 + n1; sf += cardCount;
    }
    const s = statsRef.current;
    if (s) { s.near = sn; s.far = sf; }
    vegTiming.lodRuns++; vegTiming.lodMs += performance.now() - t0;
  });

  return <group ref={group} />;
}
