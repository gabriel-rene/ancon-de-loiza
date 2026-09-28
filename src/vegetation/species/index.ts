import type * as THREE from 'three';
import type { PlantMaterials } from '../InstancedSpecies';
import {
  foliageTexture, paintBlackMangroveLeaves, paintCasuarinaWisps, paintFrond, paintMangroveLeaves, paintWhiteMangroveLeaves,
} from '../textures';
import type { PlantPart, WoodyId } from '../types';
import { makePlantMaterials } from '../windMaterial';
import { buildBlackMangrove, buildWhiteMangrove } from './basinMangrove';
import { buildCasuarina } from './casuarina';
import { buildMangrove } from './mangrove';
import { buildPalm } from './palm';

/** Material settings for one plant part (fed to `makePlantMaterials`). */
export interface PartMaterial {
  color: THREE.ColorRepresentation;
  roughness: number;
  /** Multiply the base colour by the geometry's `color` attribute. */
  vertexColors?: boolean;
}
export interface FoliageMaterial extends PartMaterial {
  /** Back-light strength (see `foliageFragment` in windMaterial.ts). */
  translucency: number;
  /** Alpha-test cut; also the coverage target of the texture's mip chain. */
  alphaTest: number;
  /** Texture label (`foliageTexture` name; shows in coverage warnings). */
  texture: string;
  /** Per-instance colour jitter (see `PlantMaterialOpts.tint` in windMaterial.ts). */
  tint?: { value: number; hue: number };
}
export interface SpeciesDef {
  /** Geometry generator (deterministic in `seed`); local frame, base at the origin, up = +Y. */
  build(seed: number): PlantPart[];
  /** Level-0 foliage canvas (browser-only). */
  paint(): HTMLCanvasElement;
  bark: PartMaterial;
  foliage: FoliageMaterial;
}

/**
 * Species registry: generator, foliage painter and material settings per species. The palm
 * and mangrove values were tuned on screen in Tasks 7–8.
 */
export const SPECIES: Partial<Record<WoodyId, SpeciesDef>> = {
  coconut: {
    build: buildPalm, paint: paintFrond,
    // Trunk multiplier: the pale grey vertex colours read near-white under a high sun.
    bark: { color: 0xb8b0a4, roughness: 0.92, vertexColors: true },
    foliage: { color: 0xffffff, roughness: 0.8, translucency: 3, alphaTest: 0.5, texture: 'palmFrond', tint: { value: 0.1, hue: 0.08 } },
  },
  redMangrove: {
    build: buildMangrove, paint: paintMangroveLeaves,
    bark: { color: 0xffffff, roughness: 0.9, vertexColors: true },
    foliage: { color: 0xffffff, roughness: 0.62, translucency: 1.2, alphaTest: 0.5, vertexColors: true, texture: 'mangroveLeaves', tint: { value: 0.18, hue: 0.12 } },
  },
  // Matte, see-through wisps: high roughness, strong back-light through the thin branchlets.
  casuarina: {
    build: buildCasuarina, paint: paintCasuarinaWisps,
    bark: { color: 0xffffff, roughness: 0.95, vertexColors: true },
    foliage: { color: 0xffffff, roughness: 0.85, translucency: 2.5, alphaTest: 0.5, vertexColors: true, texture: 'casuarinaWisps', tint: { value: 0.12, hue: 0.06 } },
  },
  // Basin mangroves behind the red fringe: matte grey-green black mangrove, glossier, more
  // translucent yellow-green white mangrove.
  blackMangrove: {
    build: buildBlackMangrove, paint: paintBlackMangroveLeaves,
    bark: { color: 0xffffff, roughness: 0.92, vertexColors: true },
    foliage: { color: 0xffffff, roughness: 0.7, translucency: 1.0, alphaTest: 0.5, vertexColors: true, texture: 'blackMangroveLeaves', tint: { value: 0.14, hue: 0.06 } },
  },
  whiteMangrove: {
    build: buildWhiteMangrove, paint: paintWhiteMangroveLeaves,
    bark: { color: 0xffffff, roughness: 0.85, vertexColors: true },
    foliage: { color: 0xffffff, roughness: 0.55, translucency: 1.6, alphaTest: 0.5, vertexColors: true, texture: 'whiteMangroveLeaves', tint: { value: 0.14, hue: 0.1 } },
  },
};

/** Paint the species' foliage texture and build its bark + foliage materials (browser-only). */
export function makeSpeciesMaterials(id: WoodyId): { materials: PlantMaterials; map: THREE.Texture } {
  const def = SPECIES[id]!;
  const map = foliageTexture(def.paint(), def.foliage.alphaTest, def.foliage.texture);
  const { color, roughness, translucency, alphaTest, vertexColors, tint } = def.foliage;
  return {
    map,
    materials: {
      bark: makePlantMaterials({ part: 'bark', ...def.bark }),
      foliage: makePlantMaterials({ part: 'foliage', map, color, roughness, translucency, alphaTest, vertexColors, tint }),
    },
  };
}
