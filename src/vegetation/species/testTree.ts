// TEMPORARY (Phase 2a Task 6 pipeline check) — delete in Task 10 together with its mount in World.tsx.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { landmarkXZ } from '../../data/landmarks';
import { sampleField, WATER, type WorldFields } from '../../terrain/fields';
import type { PlantMaterials } from '../InstancedSpecies';
import type { PlantInstance, PlantPart } from '../types';
import { makePlantMaterials } from '../windMaterial';
import { foliageTexture, paintFrond } from '../textures';
import { buildPalm } from './palm';

function withFlex(g: THREE.BufferGeometry, fn: (y: number) => number) {
  const pos = g.attributes.position as THREE.BufferAttribute, flex = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) flex[i] = fn(pos.getY(i));
  g.setAttribute('aFlex', new THREE.BufferAttribute(flex, 1));
  return g;
}

/** Cone of foliage on a cylinder trunk, base at y = 0. */
function testTree(trunkH: number, crownH: number, crownR: number): PlantPart[] {
  const H = trunkH + crownH;
  const trunk = new THREE.CylinderGeometry(0.12, 0.2, trunkH + crownH * 0.3, 7, 1, true).translate(0, (trunkH + crownH * 0.3) / 2, 0);
  const crown = new THREE.ConeGeometry(crownR, crownH, 10, 4).translate(0, trunkH + crownH / 2, 0);
  return [
    { name: 'bark', geometry: withFlex(trunk, (y) => 0.5 * y / H) },
    { name: 'foliage', geometry: withFlex(crown, (y) => Math.min(1, y / H)) },
  ];
}

const hash = (i: number, j: number) => {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Hand-placed land instances around the two ferry landings (both banks, 0–700 m). */
function testInstances(f: WorldFields): PlantInstance[] {
  const [ex, ez] = landmarkXZ('eastLanding'), [wx, wz] = landmarkXZ('westLanding');
  const cx = (ex + wx) / 2, cz = (ez + wz) / 2, g = f.grid, out: PlantInstance[] = [];
  const step = 16;
  for (let j = -44; j <= 44; j++) for (let i = -44; i <= 44; i++) {
    const r = hash(i, j);
    const x = cx + i * step + (hash(j, i) - 0.5) * step, z = cz + j * step + (r - 0.5) * step;
    if (Math.hypot(x - cx, z - cz) > 700) continue;
    const gi = Math.floor((x - g.minX) / g.cell), gj = Math.floor((z - g.minZ) / g.cell);
    if (gi < 0 || gj < 0 || gi >= g.size || gj >= g.size) continue;
    const k = gj * g.size + gi;
    if (f.water[k] !== WATER.LAND) continue;
    const shore = f.shore[k];
    // Dense riverbank row (reflections), sparse inland scatter (LOD far cards).
    if (shore < 3 || (shore > 40 ? r > 0.12 : r > 0.7)) continue;
    const y = sampleField(f, f.height, x, z);
    if (y < 0.2) continue;
    out.push({ x, y: y - 0.1, z, rot: hash(i + 7, j - 3) * Math.PI * 2, scale: 0.8 + 0.5 * hash(i - 5, j + 9), variant: r < 0.35 ? 1 : 0 });
  }
  return out;
}

export function useTestTrees(near: WorldFields) {
  const assets = useMemo(() => {
    const variants = [testTree(4, 7, 2.6), testTree(6, 5, 1.8)];
    const materials: PlantMaterials = {
      bark: makePlantMaterials({ part: 'bark', color: '#5a4630', roughness: 0.95 }),
      foliage: makePlantMaterials({ part: 'foliage', color: '#3d6a22', roughness: 0.85, translucency: 1 }),
    };
    return { variants, materials };
  }, []);
  useEffect(() => () => {
    assets.variants.flat().forEach((p) => p.geometry.dispose());
    Object.values(assets.materials).forEach((m) => { m.material.dispose(); m.depth.dispose(); });
  }, [assets]);
  const instances = useMemo(() => testInstances(near), [near]);
  return { ...assets, instances };
}

/** TEMPORARY (Task 7 visual check): five palms in front of the `bank` camera + the test scatter as palms. */
export function useTestPalms(near: WorldFields) {
  const assets = useMemo(() => {
    const variants = [buildPalm(1), buildPalm(2), buildPalm(3)];
    const map = foliageTexture(paintFrond());
    const materials: PlantMaterials = {
      bark: makePlantMaterials({ part: 'bark', color: 0xffffff, roughness: 0.92, vertexColors: true }),
      foliage: makePlantMaterials({ part: 'foliage', map, color: 0xffffff, roughness: 0.8, alphaTest: 0.5, translucency: 3 }),
    };
    return { variants, materials, map };
  }, []);
  useEffect(() => () => {
    assets.variants.flat().forEach((p) => p.geometry.dispose());
    assets.map.dispose();
    Object.values(assets.materials).forEach((m) => { m.material.dispose(); m.depth.dispose(); });
  }, [assets]);
  const instances = useMemo(() => {
    const [ex, ez] = landmarkXZ('eastLanding'), [wx, wz] = landmarkXZ('westLanding');
    const cam = [ex + 10, ez + 8], tgt = [wx - 40, wz - 30];
    const fa = Math.atan2(tgt[1] - cam[1], tgt[0] - cam[0]);
    const out: PlantInstance[] = [];
    for (let k = 0; out.length < 5 && k < 400; k++) {
      const a = fa + (hash(k, 1) - 0.5) * 1.2, r = 14 + 40 * hash(k, 2);
      const x = cam[0] + Math.cos(a) * r, z = cam[1] + Math.sin(a) * r;
      const g = near.grid, gi = Math.floor((x - g.minX) / g.cell), gj = Math.floor((z - g.minZ) / g.cell);
      if (gi < 0 || gj < 0 || gi >= g.size || gj >= g.size || near.water[gj * g.size + gi] !== WATER.LAND) continue;
      const y = sampleField(near, near.height, x, z);
      if (y < 0.3 || out.some((p) => Math.hypot(p.x - x, p.z - z) < 7)) continue;
      out.push({ x, y: y - 0.1, z, rot: (hash(k, 3) - 0.5) * 0.6, scale: 0.95 + 0.1 * hash(k, 4), variant: out.length % 3 });
    }
    return [...out, ...testInstances(near).map((p) => ({ ...p, variant: Math.floor(p.rot * 10) % 3 }))];
  }, [near]);
  return { variants: assets.variants, materials: assets.materials, instances };
}
