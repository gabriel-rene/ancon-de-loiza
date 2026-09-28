import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { reflectionHooks } from '../../scene/water/reflectionHooks';
import type { WorldFields } from '../../terrain/fields';
import { commit } from '../InstancedSpecies';
import { composeInstanceMatrices } from '../lod';
import type { VegMasks } from '../masks';
import { placeSpecies, type Occupancy } from '../placement';
import { reseat } from '../reseat';
import { GROUND_ORDER } from '../rules';
import { buildGrassClump, buildReedClump, buildVineClump } from '../species/groundClumps';
import { vegTiming } from '../stats';
import { foliageTexture, paintGrassBlades, paintReedStems, paintVineLeaves } from '../textures';
import type { GroundId } from '../types';
import { makePlantMaterials } from '../windMaterial';
import { GROUND_TILE, TileCache, tilesInRadius, type GroundTile } from './tiles';

const CAP = 2500;          // instances per mesh (one mesh per species × variant); reachable peak ≈ 1.9k
const VARIANTS = 3;
const SEED = 1840;
const PER_FRAME = 6;       // uncached tiles placed per frame at most (the rest next frame)
const REFRESH = 0.25;      // s
const MOVE2 = 8 * 8;       // m²: refresh at once after this horizontal move
const STILL2 = 0.5 * 0.5;  // m²: below this nothing can have changed

const CLUMPS: Record<GroundId, { build: (seed: number) => THREE.BufferGeometry; paint: () => HTMLCanvasElement; tex: string }> = {
  grass: { build: buildGrassClump, paint: paintGrassBlades, tex: 'grassBlades' },
  reeds: { build: buildReedClump, paint: paintReedStems, tex: 'reedStems' },
  morningGlory: { build: buildVineClump, paint: paintVineLeaves, tex: 'vineLeaves' },
};

/** One tile's instances of one species, packed for the per-refresh gather. */
interface Packed { mats: Float32Array; xs: Float32Array; zs: Float32Array; variant: Uint8Array }

interface Slot { mesh: THREE.InstancedMesh; range: { start: number; count: number } }

/**
 * Grass on open land, reeds at the wet river edges, beach morning glory on the sand: placed per
 * 32 m tile (same rules and seed as a whole-map run, kept clear of woody trunks) and drawn only
 * within `radius` of the camera, dithering out over its last 20 %. Tiles are placed on demand,
 * nearest first, at most 6 per frame; placement runs on the fixed 512 fields and each clump is
 * re-seated on the rendered terrain (`near`) so it neither floats nor sinks on lower tiers.
 * Hidden in the water reflection.
 */
export function GroundCover({ fields, near, masks, densities, trunks, radius }: {
  fields: WorldFields; near: WorldFields; masks: VegMasks; densities: Record<GroundId, number>; trunks: Occupancy; radius: number;
}) {
  const group = useRef<THREE.Group>(null);
  const fadeR = useRef<THREE.IUniform<number>>({ value: radius });
  const slots = useRef<Record<GroundId, Slot[]> | null>(null);
  const st = useRef({ dirty: true, t: -1, cx: 0, cz: 0, radius, counts: new Uint32Array(9) /* [species × variant] */ });

  // Tile cache: recreated whenever what placement depends on changes (era or tier switch).
  const cache = useMemo(() => {
    const packed = new WeakMap<GroundTile, Record<GroundId, Packed>>();
    const c = new TileCache((i, j) => {
      const x0 = i * GROUND_TILE, z0 = j * GROUND_TILE, out = {} as GroundTile;
      for (const id of GROUND_ORDER) {
        const list = densities[id] > 0
          ? placeSpecies(fields, masks, id, { density: densities[id], seed: SEED, blocked: trunks, bounds: [x0, z0, x0 + GROUND_TILE, z0 + GROUND_TILE] })
          : [];
        out[id] = near !== fields ? reseat(list, near) : list;
      }
      const p = {} as Record<GroundId, Packed>;
      for (const id of GROUND_ORDER) {
        const l = out[id];
        p[id] = { mats: composeInstanceMatrices(l), xs: Float32Array.from(l, (q) => q.x), zs: Float32Array.from(l, (q) => q.z),
          variant: Uint8Array.from(l, (q) => q.variant) };
      }
      packed.set(out, p);
      return out;
    });
    return { c, packed };
  }, [fields, near, masks, densities, trunks]);
  const cacheRef = useRef(cache);
  useEffect(() => { cacheRef.current = cache; st.current.dirty = true; }, [cache]);

  useEffect(() => {
    fadeR.current.value = radius;
    st.current.radius = radius; st.current.dirty = true;
  }, [radius]);

  // Meshes, materials and textures: built once per mount.
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    const out = {} as Record<GroundId, Slot[]>;
    const owned: { geo: THREE.BufferGeometry[]; mats: THREE.Material[]; tex: THREE.Texture[] } = { geo: [], mats: [], tex: [] };
    for (const id of GROUND_ORDER) {
      const def = CLUMPS[id];
      const map = foliageTexture(def.paint(), 0.5, def.tex);
      const { material, depth } = makePlantMaterials({
        part: 'foliage', map, color: 0xffffff, roughness: 0.9, alphaTest: 0.5, translucency: 1.5, vertexColors: true,
        fade: { radius: fadeR.current }, upNormals: true,
      });
      owned.tex.push(map); owned.mats.push(material, depth);
      out[id] = Array.from({ length: VARIANTS }, (_, v) => {
        const geo = def.build(v + 1);
        owned.geo.push(geo);
        const mesh = new THREE.InstancedMesh(geo, material, CAP);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.name = `veg-ground-${id}-${v}`;
        mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false;
        mesh.count = 0; mesh.visible = false;
        g.add(mesh);
        return { mesh, range: { start: 0, count: 0 } };
      });
    }
    slots.current = out;
    st.current.dirty = true;

    const all = GROUND_ORDER.flatMap((id) => out[id].map((s) => s.mesh));
    const before = () => { for (const m of all) m.visible = false; };
    const after = () => { for (const m of all) m.visible = m.count > 0; };
    reflectionHooks.before.add(before);
    reflectionHooks.after.add(after);
    return () => {
      reflectionHooks.before.delete(before);
      reflectionHooks.after.delete(after);
      for (const m of all) { g.remove(m); m.dispose(); }
      for (const x of owned.geo) x.dispose();
      for (const x of owned.mats) x.dispose();
      for (const x of owned.tex) x.dispose();
      slots.current = null;
    };
  }, []);

  useFrame((state) => {
    const s = st.current, sl = slots.current, cam = state.camera.position, t = state.clock.elapsedTime;
    if (!sl) return;
    const dx = cam.x - s.cx, dz = cam.z - s.cz, moved2 = dx * dx + dz * dz;
    if (!s.dirty && (moved2 < STILL2 || (t - s.t < REFRESH && moved2 < MOVE2))) return;
    s.dirty = false; s.t = t; s.cx = cam.x; s.cz = cam.z;

    const { c, packed } = cacheRef.current, r2 = s.radius * s.radius;
    const counts = s.counts.fill(0);
    let placed = 0;
    for (const [i, j] of tilesInRadius(cam.x, cam.z, s.radius, GROUND_TILE)) {
      if (!c.has(i, j)) {
        if (placed >= PER_FRAME) { s.dirty = true; continue; } // finish next frame
        placed++;
      }
      const p = packed.get(c.get(i, j))!;
      for (let k = 0; k < GROUND_ORDER.length; k++) {
        const q = p[GROUND_ORDER[k]], meshes = sl[GROUND_ORDER[k]];
        for (let n = 0; n < q.xs.length; n++) {
          const ex = q.xs[n] - cam.x, ez = q.zs[n] - cam.z;
          if (ex * ex + ez * ez > r2) continue;
          const v = q.variant[n], ci = k * VARIANTS + v;
          if (counts[ci] >= CAP) continue;
          const dst = meshes[v].mesh.instanceMatrix.array as Float32Array, o = counts[ci] * 16, src = n * 16;
          for (let e = 0; e < 16; e++) dst[o + e] = q.mats[src + e];
          counts[ci]++;
        }
      }
    }
    for (let k = 0; k < GROUND_ORDER.length; k++) {
      let total = 0;
      sl[GROUND_ORDER[k]].forEach((slot, v) => {
        const n = counts[k * VARIANTS + v];
        commit(slot.mesh.instanceMatrix, n, slot.range);
        slot.mesh.count = n; slot.mesh.visible = n > 0;
        total += n;
      });
      vegTiming.counts[`ground:${GROUND_ORDER[k]}`] = { near: total, far: 0 };
    }
  });

  return <group ref={group} />;
}
