import { LANDCLS, WATER } from '../terrain/fields';
import type { Site, SpeciesId } from './types';

export interface SpeciesRule {
  /** Jittered-grid spacing, m. */ spacing: number;
  /** Occupancy radius, m. */ radius: number;
  scale: [number, number]; variants: number;
  /** Habitat suitability 0..1 at a site. */ density(s: Site): number;
}
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const RULES: Record<SpeciesId, SpeciesRule> = {
  // Rhizophora mangle: river/lagoon fringe and shallows, never the surf coast (research §5).
  redMangrove: {
    spacing: 3.2, radius: 1.2, scale: [0.7, 1.25], variants: 3,
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
    spacing: 8, radius: 2.5, scale: [0.8, 1.2], variants: 3,
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 5 || s.height < 0.3 || s.landCls === LANDCLS.WETLAND) return 0;
      const coast = s.seaDist > 12 ? 1 - smooth(180, 320, s.seaDist) : 0;
      const bank = 0.25 * (1 - smooth(10, 40, s.riverDist)) * smooth(4, 8, s.riverDist);
      return Math.min(1, 0.55 * coast + bank + 0.18 * s.town);
    },
  },
  // Casuarina equisetifolia ("piñones"): dunes and sand behind the beach.
  casuarina: {
    spacing: 7, radius: 3, scale: [0.75, 1.3], variants: 3,
    density: (s) => {
      if (s.water !== WATER.LAND || s.roadDist < 5 || s.height < 0.3) return 0;
      const dune = s.seaDist > 20 ? 1 - smooth(90, 220, s.seaDist) : 0;
      const sand = s.landCls === LANDCLS.SAND ? 0.6 : 0;
      return Math.max(0.6 * dune, sand) * (1 - s.town);
    },
  },
};
/** Larger plants claim space first. */
export const PLACEMENT_ORDER: SpeciesId[] = ['casuarina', 'coconut', 'redMangrove'];
