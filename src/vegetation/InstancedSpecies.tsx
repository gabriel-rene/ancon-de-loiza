import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { reflectionHooks } from '../scene/water/reflectionHooks';
import { useStore } from '../state/store';
import { bakeImpostor } from './impostor';
import { composeInstanceMatrices, gatherMatrices, partitionLod3 } from './lod';
import { vegStats } from './stats';
import type { PlantInstance, PlantPart } from './types';
import { makePlantMaterials, setWindTime } from './windMaterial';

type MatPair = { material: THREE.Material; depth: THREE.Material };
export type PlantMaterials = Record<'bark' | 'foliage', MatPair>;

interface VariantLod {
  matrices: Float32Array; xs: Float32Array; zs: Float32Array;
  near: Uint32Array; far: Uint32Array;
  /** Instances within REFL_LOD0 (n0), the rest of LOD0 (n1), beyond LOD0 (nFar). */
  n0: number; n1: number; nFar: number;
  /** LOD0 part meshes; they share one instanceMatrix attribute laid out [n0 | n1]. */
  parts: THREE.InstancedMesh[]; partMatrix: THREE.InstancedBufferAttribute;
  /**
   * Cards, instance buffer laid out [nFar | n1]: the main view draws the first nFar (far
   * cards), the water reflection draws all nFar + n1 (everything outside REFL_LOD0).
   */
  cards: THREE.InstancedMesh;
  own: { texture: THREE.Texture; card: THREE.BufferGeometry; mats: MatPair };
}

const LOD_INTERVAL = 0.25; // s
const LOD_MOVE2 = 8 * 8;   // m², horizontal
/**
 * Within this radius the water reflection keeps the full meshes (prop roots, trunks and crown
 * gaps must read in a nearby reflection); beyond it the reflection uses the impostor cards.
 */
const REFL_LOD0 = 50;      // m

function commit(attr: THREE.InstancedBufferAttribute, count: number) {
  attr.clearUpdateRanges();
  if (count > 0) attr.addUpdateRange(0, count * 16);
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

/**
 * Instanced renderer for one species: LOD0 part meshes near the camera, baked impostor cards
 * beyond `lod0` metres. The water reflection keeps the meshes within REFL_LOD0 and draws
 * everything else as cards.
 * The near/far split is recomputed every 250 ms or after an 8 m camera move (no per-frame alloc).
 */
export function InstancedSpecies({ variants, materials, instances, lod0, castShadow, farCards }: {
  variants: PlantPart[][]; materials: PlantMaterials; instances: PlantInstance[];
  lod0: number; castShadow: boolean; farCards: boolean;
}) {
  const gl = useThree((s) => s.gl);
  const frozen = useStore((s) => s.frozen);
  const group = useRef<THREE.Group>(null);
  const built = useRef<VariantLod[]>([]);
  const lod = useRef({ lod0, farCards, castShadow, dirty: true, t: -1, cx: 0, cz: 0 });
  const statsRef = useRef<{ near: number; far: number } | null>(null);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    const trans = translucencyOf(materials.foliage.material);
    const out: VariantLod[] = [];
    variants.forEach((parts, v) => {
      const list = instances.filter((p) => p.variant === v);
      const n = list.length;
      if (n === 0 || parts.length === 0) return;
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

      const { texture, card } = bakeImpostor(gl, parts.map((p) => ({ geometry: p.geometry, material: materials[p.name].material })));
      const mats = makePlantMaterials({ part: 'foliage', map: texture, color: 0xffffff, roughness: 0.9, alphaTest: 0.5, translucency: trans, bentNormals: true });
      const cards = newInstanced(card, mats, n);
      cards.name = `veg-cards-${v}`;

      for (const m of [...partMeshes, cards]) g.add(m);
      out.push({
        matrices, xs, zs, near: new Uint32Array(n), far: new Uint32Array(n), n0: 0, n1: 0, nFar: 0,
        parts: partMeshes, partMatrix, cards, own: { texture, card, mats },
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
      for (const b of out) {
        for (const m of [...b.parts, b.cards]) { g.remove(m); m.dispose(); }
        b.own.card.dispose();
        b.own.texture.dispose();
        b.own.mats.material.dispose();
        b.own.mats.depth.dispose();
      }
      built.current = [];
    };
  }, [gl, variants, materials, instances]);

  useEffect(() => {
    const l = lod.current;
    l.lod0 = lod0; l.farCards = farCards; l.castShadow = castShadow; l.dirty = true;
  }, [lod0, farCards, castShadow]);

  useFrame((state) => {
    setWindTime(state.clock.elapsedTime, frozen);
    const l = lod.current, cam = state.camera.position, t = state.clock.elapsedTime;
    const dx = cam.x - l.cx, dz = cam.z - l.cz;
    if (!l.dirty && t - l.t < LOD_INTERVAL && dx * dx + dz * dz < LOD_MOVE2) return;
    l.dirty = false; l.t = t; l.cx = cam.x; l.cz = cam.z;
    let sn = 0, sf = 0;
    const dR = Math.min(REFL_LOD0, l.lod0);
    for (const b of built.current) {
      const [n0, n1, f] = partitionLod3(b.xs, b.zs, cam.x, cam.z, dR, l.lod0, b.near, b.far);
      b.n0 = n0; b.n1 = n1; b.nFar = f;
      const tail = b.near.subarray(b.near.length - n1);
      const pm = b.partMatrix.array as Float32Array, cm = b.cards.instanceMatrix.array as Float32Array;
      gatherMatrices(b.matrices, b.near, n0, pm);
      gatherMatrices(b.matrices, tail, n1, pm.subarray(n0 * 16));
      commit(b.partMatrix, n0 + n1);
      for (const m of b.parts) { m.count = n0 + n1; m.visible = n0 + n1 > 0; m.castShadow = l.castShadow; }
      // Far cards first, then the LOD0 ring outside REFL_LOD0 (drawn only in the reflection).
      gatherMatrices(b.matrices, b.far, f, cm);
      gatherMatrices(b.matrices, tail, n1, cm.subarray(f * 16));
      commit(b.cards.instanceMatrix, f + n1);
      const cardCount = l.farCards ? f : 0;
      b.cards.count = cardCount;
      b.cards.visible = cardCount > 0;
      b.cards.castShadow = l.castShadow;
      sn += n0 + n1; sf += cardCount;
    }
    const s = statsRef.current;
    if (s) { s.near = sn; s.far = sf; }
  });

  return <group ref={group} />;
}
