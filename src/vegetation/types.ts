import type * as THREE from 'three';
export type WoodyId = 'redMangrove' | 'coconut' | 'casuarina' | 'blackMangrove' | 'whiteMangrove' | 'buttonwood' | 'almendro' | 'seaGrape';
export type GroundId = 'grass' | 'reeds' | 'morningGlory';
export type SpeciesId = WoodyId | GroundId;
export interface PlantInstance { x: number; y: number; z: number; rot: number; scale: number; variant: number }
export interface Site {
  water: number; depth: number; shore: number; seaDist: number; riverDist: number;
  roadDist: number; height: number; landCls: number; town: number;
  /** 0..1 clearing weight (ferry landings); scales every species' density down. */
  clear: number;
}
/** One drawable part of a plant (e.g. bark, foliage). Geometry carries an `aFlex` (0 base … 1 tip) attribute. */
export interface PlantPart {
  name: 'bark' | 'foliage'; geometry: THREE.BufferGeometry;
  /** false: never drawn into the shadow map (small detail whose shadow is below a shadow texel, e.g. pneumatophores). */
  shadow?: false;
}
