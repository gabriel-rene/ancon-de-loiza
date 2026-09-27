import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { buildFields, type WorldFields } from './fields';

/**
 * The fixed 512 × 512 near fields (2560 m) that vegetation placement and the ferry's crossing
 * geometry are computed from, whatever the quality tier's terrain resolution — so plants, docks,
 * bank posts and the crossing line never move with the tier (Phase 2a ruling, Phase 3 F11).
 */
export const PLACE_SIZE = 512, PLACE_EXTENT = 2560;
const cache = new Map<number, WorldFields>();
/** Returns `near` itself when it already is the 512 grid (high tier), else a cached build per bank offset. */
export function placementFields(bankOffset: number, near?: WorldFields): WorldFields {
  if (near && near.grid.size === PLACE_SIZE && near.grid.cell * near.grid.size === PLACE_EXTENT) return near;
  let f = cache.get(bankOffset);
  if (!f) {
    f = buildFields(geo as unknown as GeoBundle, { extent: PLACE_EXTENT, size: PLACE_SIZE, bankOffset });
    cache.set(bankOffset, f);
  }
  return f;
}
