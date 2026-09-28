import { LANDCLS, WATER } from '../terrain/fields';
import type { GroundId, Site, SpeciesId, WoodyId } from './types';

export interface SpeciesRule {
  /** Jittered-grid spacing, m. */ spacing: number;
  /** Occupancy radius, m. */ radius: number;
  scale: [number, number]; variants: number;
  /**
   * Rotation about +Y is drawn from [-rot, rot] rad. Palms and casuarinas bake their lean into
   * the local frame (palm toward local -Z, casuarina downwind along WIND_DIR), so they only get
   * a small spin; π = fully random.
   */
  rot: number;
  /**
   * Clumping: acceptance is multiplied by 1 − strength + 2·strength·n, with n a smooth value
   * noise (0..1) on a lattice of `scale` metres — groves and gaps instead of an even stand.
   */
  clump: { scale: number; strength: number;
    /** Instance scale × (1 + size·(2n − 1)): taller plants in the heart of a grove, a rolling canopy line. */
    size: number };
  /** Habitat suitability 0..1 at a site. */ density(s: Site): number;
  /** Trunk radius (m) that ground cover must not overlap; default 0.5. */
  trunk?: number;
}
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const RULES: Record<SpeciesId, SpeciesRule> = {
  // Rhizophora mangle: river/lagoon fringe and shallows, never the surf coast (research §5).
  redMangrove: {
    spacing: 3.2, radius: 1.2, scale: [0.7, 1.25], variants: 3, rot: Math.PI, clump: { scale: 30, strength: 0.45, size: 0.25 },
    density: (s) => {
      // Bank/shallow-water and land-fringe cutoffs are widened from a sub-cell 6/9m window to
      // 15/20m: at this world's cell size (10m at size=256, 5m at size=512) a raster cell's
      // minimum non-zero distance to the opposite class is one cell width (and its diagonal,
      // ~1.41x), so a window narrower than that is unreachable by any cell — see task-5-report.md.
      if (s.seaDist < 60) return 0;
      if (s.water === WATER.RIVER || s.water === WATER.POND) return s.depth < 1.8 && s.shore > -15 ? 0.85 : 0;
      if (s.water !== WATER.LAND || s.roadDist < 6) return 0;
      const band = 1 - smooth(9, 20, s.riverDist);
      const wet = s.landCls === LANDCLS.WETLAND ? 0.5 * (1 - smooth(0, 40, s.riverDist)) : 0;
      return Math.max(band, wet) * (1 - s.town);
    },
  },
  // Cocos nucifera: coastal sand strip, some on river banks, sparse in town yards.
  coconut: {
    spacing: 8, radius: 2.5, scale: [0.8, 1.2], variants: 3, rot: 0.3, clump: { scale: 45, strength: 0.8, size: 0 },
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 5 || s.height < 0.3 || s.landCls === LANDCLS.WETLAND) return 0;
      const coast = s.seaDist > 12 ? 1 - smooth(180, 320, s.seaDist) : 0;
      const bank = 0.25 * (1 - smooth(10, 40, s.riverDist)) * smooth(4, 8, s.riverDist);
      return Math.min(1, 0.55 * coast + bank + 0.18 * s.town);
    },
  },
  // Casuarina equisetifolia ("piñones"): dunes and sand behind the beach.
  casuarina: {
    spacing: 7, radius: 3, scale: [0.75, 1.3], variants: 3, rot: 0.3, clump: { scale: 60, strength: 0.75, size: 0.12 },
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 5 || s.height < 0.3) return 0;
      const dune = s.seaDist > 20 ? 1 - smooth(90, 220, s.seaDist) : 0;
      const sand = s.landCls === LANDCLS.SAND ? 0.6 : 0;
      return Math.max(0.6 * dune, sand) * (1 - s.town);
    },
  },
  // Avicennia germinans: basin mangrove behind the red fringe, low wet ground (research §5, S22/S34).
  blackMangrove: {
    spacing: 4, radius: 1.8, scale: [0.8, 1.2], variants: 3, rot: Math.PI, clump: { scale: 40, strength: 0.5, size: 0.2 }, trunk: 0.4,
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 5 || s.seaDist < 60) return 0;
      const low = 1 - smooth(1.4, 2.6, s.height);
      const behind = smooth(6, 12, s.riverDist) * (1 - smooth(45, 80, s.riverDist));
      const wet = s.landCls === LANDCLS.WETLAND ? 0.7 : 0;
      return Math.min(1, Math.max(0.56 * behind, wet) * low) * (1 - s.town);
    },
  },
  // Laguncularia racemosa: basin mangrove behind the red fringe, mixed with black mangrove but nearer the fringe (research §5, S22/S34).
  whiteMangrove: {
    spacing: 4, radius: 1.6, scale: [0.8, 1.2], variants: 3, rot: Math.PI, clump: { scale: 30, strength: 0.55, size: 0.2 }, trunk: 0.35,
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 5 || s.seaDist < 60) return 0;
      const low = 1 - smooth(1.4, 2.6, s.height);
      const near = smooth(4, 9, s.riverDist) * (1 - smooth(25, 50, s.riverDist));
      const wet = s.landCls === LANDCLS.WETLAND ? 0.4 : 0;
      return Math.min(1, Math.max(0.5 * near, wet) * low) * (1 - s.town);
    },
  },
  // Conocarpus erectus: drier ground behind the mangroves.
  buttonwood: {
    spacing: 5, radius: 1.5, scale: [0.75, 1.25], variants: 3, rot: Math.PI, clump: { scale: 35, strength: 0.6, size: 0.15 }, trunk: 0.3,
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 4 || s.seaDist < 40) return 0;
      const band = smooth(25, 45, s.riverDist) * (1 - smooth(120, 200, s.riverDist));
      const dry = smooth(0.6, 1.2, s.height) * (s.landCls === LANDCLS.WETLAND ? 0.3 : 1);
      return 0.5 * band * dry * (1 - s.town);
    },
  },
  // Terminalia catappa: river banks near the landings and town yards (S1).
  almendro: {
    spacing: 14, radius: 4, scale: [0.8, 1.2], variants: 3, rot: Math.PI, clump: { scale: 60, strength: 0.5, size: 0.1 }, trunk: 0.5,
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 4 || s.landCls === LANDCLS.WETLAND) return 0;
      const bank = (1 - smooth(15, 45, s.riverDist)) * smooth(4, 8, s.riverDist);
      return Math.min(1, 0.35 * bank + 0.25 * s.town);
    },
  },
  // Coccoloba uvifera: beach edge and dunes, seaward of the casuarinas (S22).
  seaGrape: {
    spacing: 3.5, radius: 1.4, scale: [0.7, 1.3], variants: 3, rot: Math.PI, clump: { scale: 25, strength: 0.6, size: 0.2 }, trunk: 0.3,
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 3) return 0;
      const beach = smooth(6, 12, s.seaDist) * (1 - smooth(45, 80, s.seaDist));
      return Math.min(1, beach * (s.landCls === LANDCLS.SAND ? 1 : 0.6)) * (1 - s.town);
    },
  },
  // Ipomoea pes-caprae: trailing vines on open sand (S22). Ground cover.
  morningGlory: {
    spacing: 1.8, radius: 0.7, scale: [0.7, 1.3], variants: 3, rot: Math.PI, clump: { scale: 12, strength: 0.7, size: 0.2 },
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 2) return 0;
      const sand = smooth(3, 6, s.seaDist) * (1 - smooth(30, 55, s.seaDist));
      return Math.max(sand, s.landCls === LANDCLS.SAND ? 0.5 : 0) * (1 - s.town);
    },
  },
  // Open-land grasses (inferred). Ground cover.
  grass: {
    spacing: 1.6, radius: 0.5, scale: [0.7, 1.3], variants: 3, rot: Math.PI, clump: { scale: 10, strength: 0.5, size: 0.3 },
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 2 || s.landCls === LANDCLS.WETLAND || s.height < 0.3) return 0;
      if (s.landCls === LANDCLS.SAND || s.seaDist < 40) return 0;
      const cls = s.landCls === LANDCLS.WOOD ? 0.3 : 1;
      return cls * smooth(5, 9, s.riverDist) * (1 - 0.7 * s.town);
    },
  },
  // Wet-edge reeds and sedges (inferred). Ground cover.
  reeds: {
    spacing: 1.4, radius: 0.5, scale: [0.7, 1.3], variants: 3, rot: Math.PI, clump: { scale: 14, strength: 0.6, size: 0.25 },
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 2 || s.seaDist < 60) return 0;
      const edge = 1 - smooth(4, 10, s.riverDist);
      const wet = s.landCls === LANDCLS.WETLAND ? 0.6 : 0;
      return Math.max(edge, wet) * (1 - s.town);
    },
  },
};
/** Woody species with a registry entry, larger plants first (they claim space first). Species tasks append here. */
export const PLACEMENT_ORDER: WoodyId[] = ['casuarina', 'coconut', 'blackMangrove', 'whiteMangrove', 'redMangrove'];
/** Ground cover, placed per tile around the camera (see ground/tiles.ts). */
export const GROUND_ORDER: GroundId[] = ['reeds', 'morningGlory', 'grass'];
