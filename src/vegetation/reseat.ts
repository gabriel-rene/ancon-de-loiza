import { sampleField, WATER, type WorldFields } from '../terrain/fields';
import type { PlantInstance } from './types';

/** Re-seat instances on the rendered terrain when placement ran on a different grid. */
export function reseat(list: PlantInstance[], f: WorldFields): PlantInstance[] {
  return list.map((p) => {
    const g = f.grid, i = Math.floor((p.x - g.minX) / g.cell), j = Math.floor((p.z - g.minZ) / g.cell);
    const inWater = i >= 0 && j >= 0 && i < g.size && j < g.size && f.water[j * g.size + i] !== WATER.LAND;
    const h = sampleField(f, f.height, p.x, p.z);
    return { ...p, y: inWater ? Math.max(h, -0.3) : h };
  });
}
