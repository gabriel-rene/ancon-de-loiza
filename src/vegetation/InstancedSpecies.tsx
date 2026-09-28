import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { reflectionHooks } from '../scene/water/reflectionHooks';
import { useStore } from '../state/store';
import { bakeImpostor } from './impostor';
import { composeInstanceMatrices, gatherMatrices, partitionLod3 } from './lod';
import { vegStats, vegTiming } from './stats';
import type { PlantInstance, PlantPart } from './types';
import { makePlantMaterials, setWindTime } from './windMaterial';

type MatPair = { material: THREE.Material; depth: THREE.Material };
export type PlantMaterials = Record<'bark' | 'foliage', MatPair>;

interface VariantLod {
  matrices: Float32Array; xs: Float32Array; zs: Float32Array;
  near: Uint32Array; far: Uint32Array;
  /** Instances within reflLod0 (n0), the rest of LOD0 (n1), beyond LOD0 (nFar). */
  n0: number; n1: number; nFar: number;
  /** LOD0 part meshes; they share one instanceMatrix attribute laid out [n0 | n1]. */
  parts: THREE.InstancedMesh[]; partMatrix: THREE.InstancedBufferAttribute;
  /**
   * Cards, instance buffer laid out [nFar | n1]: the main view draws the first nFar (far
   * cards), the water reflection draws all nFar + n1 (everything outside reflLod0).
   */
  cards: THREE.InstancedMesh;
  /** Reused update-range records (no per-commit allocation). */
  partRange: { start: number; count: number }; cardRange: { start: number; count: number };
}

/** Per-variant impostor: baked texture, crossed-card geometry and its card materials. */
interface Bake { texture: THREE.Texture; card: THREE.BufferGeometry; mats: MatPair }

const LOD_INTERVAL = 0.25; // s
const LOD_MOVE2 = 8 * 8;   // m², horizontal
const LOD_STILL2 = 0.5 * 0.5; // m²: below this the split cannot have changed, so skip the timed refresh

/** Upload the first `count` matrices (reusing `range`; three clears the list after upload). */
function commit(attr: THREE.InstancedBufferAttribute, count: number, range: { start: number; count: number }) {
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
 * else as cards. The split is recomputed every 250 ms while the camera moves (at once after
 * an 8 m move; not while it stands still); the repartition and matrix gathers allocate nothing.
 */
export function InstancedSpecies({ variants, materials, instances, lod0, reflLod0, castShadow, farCards, name = 'plant' }: {
  variants: PlantPart[][]; materials: PlantMaterials; instances: PlantInstance[];
  lod0: number; reflLod0: number; castShadow: boolean; farCards: boolean;
  /** Species name, used to label impostor textures (and their coverage warnings). */
  name?: string;
}) {
  const gl = useThree((s) => s.gl);
  const frozen = useStore((s) => s.frozen);
  const group = useRef<THREE.Group>(null);
  const built = useRef<VariantLod[]>([]);
  const lod = useRef({ lod0, reflLod0, farCards, castShadow, dirty: true, t: -1, cx: 0, cz: 0 });
  const statsRef = useRef<{ near: number; far: number } | null>(null);
  const split = useRef(new Uint32Array(3));
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
    variants.forEach((parts, v) => {
      const list = instances.filter((p) => p.variant === v);
      const n = list.length, bake = bakes[v];
      if (n === 0 || !bake) return;
      const matrices = composeInstanceMatrices(list);
      const xs = new Float32Array(n), zs = new Float32Array(n);
      list.forEach((p, i) => { xs[i] = p.x; zs[i] = p.z; });

      const partMatrix = new THREE.InstancedBufferAttribute(new Float32Array(n * 16), 16);
      partMatrix.setUsage(THREE.DynamicDrawUsage);
      const partMeshes = parts.map((p) => {
        const m = newInstanced(p.geometry, materials[p.name], n);
        m.instanceMatrix = partMatrix;
        m.name = `veg-lod0-${p.name}-${v}`;
        return m;
      });
      const cards = newInstanced(bake.card, bake.mats, n);
      cards.name = `veg-cards-${v}`;
      // Cards start beyond LOD0, which is wider than the shadow map's reach: they never cast.
      cards.castShadow = false;

      for (const m of [...partMeshes, cards]) g.add(m);
      out.push({
        matrices, xs, zs, near: new Uint32Array(n), far: new Uint32Array(n), n0: 0, n1: 0, nFar: 0,
        parts: partMeshes, partMatrix, cards, partRange: { start: 0, count: 0 }, cardRange: { start: 0, count: 0 },
      });
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
      for (const b of out) for (const m of [...b.parts, b.cards]) { g.remove(m); m.dispose(); }
      built.current = [];
    };
  }, [bakes, variants, materials, instances]);

  useEffect(() => {
    const l = lod.current;
    l.lod0 = lod0; l.reflLod0 = reflLod0; l.farCards = farCards; l.castShadow = castShadow; l.dirty = true;
  }, [lod0, reflLod0, farCards, castShadow]);

  useFrame((state) => {
    setWindTime(state.clock.elapsedTime, frozen);
    const l = lod.current, cam = state.camera.position, t = state.clock.elapsedTime;
    const dx = cam.x - l.cx, dz = cam.z - l.cz;
    const moved2 = dx * dx + dz * dz;
    if (!l.dirty && (moved2 < LOD_STILL2 || (t - l.t < LOD_INTERVAL && moved2 < LOD_MOVE2))) return;
    l.dirty = false; l.t = t; l.cx = cam.x; l.cz = cam.z;
    let sn = 0, sf = 0;
    const dR = Math.min(l.reflLod0, l.lod0);
    for (const b of built.current) {
      const sp = partitionLod3(b.xs, b.zs, cam.x, cam.z, dR, l.lod0, b.near, b.far, split.current);
      const n0 = sp[0], n1 = sp[1], f = sp[2];
      b.n0 = n0; b.n1 = n1; b.nFar = f;
      const tail = b.near.length - n1; // the n1 ring sits at the back of `near`
      const pm = b.partMatrix.array as Float32Array, cm = b.cards.instanceMatrix.array as Float32Array;
      gatherMatrices(b.matrices, b.near, n0, pm);
      gatherMatrices(b.matrices, b.near, n1, pm, tail, n0);
      commit(b.partMatrix, n0 + n1, b.partRange);
      for (const m of b.parts) { m.count = n0 + n1; m.visible = n0 + n1 > 0; m.castShadow = l.castShadow; }
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
  });

  return <group ref={group} />;
}
