import type { WorldFields } from '../terrain/fields';
import type { VegMasks } from './masks';
import { siteAt } from './placement';
import { RULES } from './rules';
import type { GroundId } from './types';

/**
 * Far ground-cover tint (RGBA per texel, `size`² over the fields' extent): R = grass, G = reeds,
 * B = morning-glory habitat weight (0..255, each `rule.density(site) · dens[id] · (1 − site.clear)`),
 * A = 255. Mirrors the near ground-cover clumps' placement rule so the tint the terrain shows past
 * their radius matches what the clumps would have grown there.
 * `skip(x, z)` true (e.g. under cane): no cover there.
 */
export function coverMap(f: WorldFields, m: VegMasks, dens: Record<GroundId, number>, size = 256,
  skip?: (x: number, z: number) => boolean): Uint8Array {
  const g = f.grid, ext = g.cell * g.size, cell = ext / size, n = size * size;
  const out = new Uint8Array(n * 4);
  const channel: Record<GroundId, 0 | 1 | 2> = { grass: 0, reeds: 1, morningGlory: 2 };
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = g.minX + (i + 0.5) * cell, z = g.minZ + (j + 0.5) * cell;
    const s = siteAt(f, m, x, z);
    const k = (j * size + i) * 4;
    out[k + 3] = 255;
    if (!s || skip?.(x, z)) continue;
    for (const id of Object.keys(channel) as GroundId[]) {
      const w = RULES[id].density(s) * dens[id] * (1 - s.clear);
      out[k + channel[id]] = Math.round(255 * Math.min(1, Math.max(0, w)));
    }
  }
  return out;
}
