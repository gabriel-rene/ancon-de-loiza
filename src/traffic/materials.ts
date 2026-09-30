import * as THREE from 'three';
import { vesselMaterials } from '../ancon/materials';

export type TrafficMaterialId = 'paint' | 'glass' | 'trim' | 'dark' | 'wheel' | 'hide' | 'wood' | 'bike';
let mats: Record<TrafficMaterialId, THREE.Material> | null = null;
/**
 * One set for the app's life (never disposed, like infraMaterials). Paint: clear-coated, colour per instance.
 * Glass: near-black and glossy so it takes the sky. Trim: chrome (vertex colours pick chrome, lamps).
 * Dark: rough vertex-coloured parts (grille, tyres' sidewalls, lamps' lenses, undercarriage). Hide: animal coat × instance tint.
 */
export function trafficMaterials(): Record<TrafficMaterialId, THREE.Material> {
  return (mats ??= {
    paint: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.22 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0e1215, roughness: 0.06, metalness: 0.4 }),
    trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 }),
    wheel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 }),
    hide: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
    wood: vesselMaterials().wood,
    bike: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 }),
  });
}
