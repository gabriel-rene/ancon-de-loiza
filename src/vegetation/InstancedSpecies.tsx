import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { reflectionHooks } from '../scene/water/reflectionHooks';
import { useStore } from '../state/store';
import { bakeImpostor } from './impostor';
import { composeInstanceMatrices, gatherMatrices, partitionLod } from './lod';
import { vegStats } from './stats';
import type { PlantInstance, PlantPart } from './types';
import { makePlantMaterials, setWindTime } from './windMaterial';

type MatPair = { material: THREE.Material; depth: THREE.Material };
export type PlantMaterials = Record<'bark' | 'foliage', MatPair>;

interface VariantLod {
  matrices: Float32Array; xs: Float32Array; zs: Float32Array;
  near: Uint32Array; far: Uint32Array; nNear: number; nFar: number;
  /** LOD0 part meshes; they share one instanceMatrix attribute. */
  parts: THREE.InstancedMesh[]; partMatrix: THREE.InstancedBufferAttribute;
  /** Far cards (main view). */
  cards: THREE.InstancedMesh;
  /** Every instance as a card; visible only while the water reflection renders. */
  allCards: THREE.InstancedMesh;
  own: { texture: THREE.Texture; card: THREE.BufferGeometry; mats: MatPair };
}

const LOD_INTERVAL = 0.25; // s
const LOD_MOVE2 = 8 * 8;   // m², horizontal

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
 * beyond `lod0` metres, and an "all cards" mesh that replaces both inside the water reflection.
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
      const allCards = newInstanced(card, mats, n);
      allCards.name = `veg-allcards-${v}`;
      allCards.instanceMatrix.array.set(matrices);
      allCards.count = n;
      commit(allCards.instanceMatrix, n);
      allCards.visible = false;

      for (const m of [...partMeshes, cards, allCards]) g.add(m);
      out.push({
        matrices, xs, zs, near: new Uint32Array(n), far: new Uint32Array(n), nNear: 0, nFar: 0,
        parts: partMeshes, partMatrix, cards, allCards, own: { texture, card, mats },
      });
    });
    built.current = out;
    lod.current.dirty = true;

    const stats = { near: 0, far: 0 };
    vegStats.set(stats, stats);
    const before = () => {
      for (const b of built.current) {
        for (const m of b.parts) m.visible = false;
        b.cards.visible = false;
        b.allCards.visible = true;
      }
    };
    const after = () => {
      for (const b of built.current) {
        for (const m of b.parts) m.visible = b.nNear > 0;
        b.cards.visible = lod.current.farCards && b.nFar > 0;
        b.allCards.visible = false;
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
        for (const m of [...b.parts, b.cards, b.allCards]) { g.remove(m); m.dispose(); }
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
    for (const b of built.current) {
      const [a, f] = partitionLod(b.xs, b.zs, cam.x, cam.z, l.lod0, b.near, b.far);
      b.nNear = a; b.nFar = f;
      gatherMatrices(b.matrices, b.near, a, b.partMatrix.array as Float32Array);
      commit(b.partMatrix, a);
      for (const m of b.parts) { m.count = a; m.visible = a > 0; m.castShadow = l.castShadow; }
      const cardCount = l.farCards ? f : 0;
      gatherMatrices(b.matrices, b.far, cardCount, b.cards.instanceMatrix.array as Float32Array);
      commit(b.cards.instanceMatrix, cardCount);
      b.cards.count = cardCount;
      b.cards.visible = cardCount > 0;
      b.cards.castShadow = l.castShadow;
      sn += a; sf += cardCount;
    }
    const s = statsRef.current;
    if (s) { s.near = sn; s.far = sf; }
  });

  return <group ref={group} />;
}
