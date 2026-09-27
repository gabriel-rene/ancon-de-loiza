import * as THREE from 'three';
import type { VesselMaterialId } from './vessels/common';
import { paintPlanks } from './textures';

let cache: Record<VesselMaterialId, THREE.MeshStandardMaterial> | null = null;
export const canvasTexture = (c: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
};
/** Vessel materials, built once for the app's life (vertex colours × painted detail maps). */
export function vesselMaterials() {
  cache ??= {
    wood: new THREE.MeshStandardMaterial({ map: canvasTexture(paintPlanks()), vertexColors: true, roughness: 0.88 }),
    steel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.3 }),   // Task 4 adds its painted map
    iron: new THREE.MeshStandardMaterial({ color: 0x2b2826, roughness: 0.7, metalness: 0.5 }),
  };
  return cache;
}
