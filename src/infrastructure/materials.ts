import * as THREE from 'three';
import { canvasTexture, vesselMaterials } from '../ancon/materials';
import type { RoadSurface } from '../data/eras';
import type { InfraMaterialId } from './parts';
import { paintConcrete, paintRoad, paintThatch, paintZinc } from './textures';

let cache: Record<InfraMaterialId, THREE.Material> | null = null;
/** Built once for the app's life. Wood and iron are the vessel's own (weathered plank map, dark iron). */
export function infraMaterials() {
  const v = vesselMaterials();
  cache ??= {
    wood: v.wood, iron: v.iron,
    concrete: new THREE.MeshStandardMaterial({ map: canvasTexture(paintConcrete()), vertexColors: true, roughness: 0.92 }),
    zinc: new THREE.MeshStandardMaterial({ map: canvasTexture(paintZinc()), vertexColors: true, roughness: 0.55, metalness: 0.4 }),
    thatch: new THREE.MeshStandardMaterial({ map: canvasTexture(paintThatch()), vertexColors: true, roughness: 1 }),
  };
  return cache;
}

const roads = new Map<RoadSurface, THREE.MeshStandardMaterial>();
/** Story-road strip material per surface; the polygon offset keeps it above the terrain it lies on. */
export function roadMaterial(s: RoadSurface) {
  let m = roads.get(s);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: canvasTexture(paintRoad(s)), roughness: s === 'asphalt' ? 0.85 : 0.97,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    roads.set(s, m);
  }
  return m;
}
