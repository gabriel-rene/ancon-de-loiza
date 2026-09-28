import { PLACEMENT_ORDER } from './rules';
import type { WoodyId } from './types';

/** Small LRU cache keyed by string. */
export class KeyedCache<T> {
  private map = new Map<string, T>();
  constructor(private cap: number) {}
  get size() { return this.map.size; }
  get(key: string, build: () => T): T {
    const hit = this.map.get(key);
    if (hit !== undefined) { this.map.delete(key); this.map.set(key, hit); return hit; }
    const v = build();
    this.map.set(key, v);
    if (this.map.size > this.cap) this.map.delete(this.map.keys().next().value as string);
    return v;
  }
}

/** Placement results depend only on (densities, bank offset, tier, farm blocks) — spec §13, 2c. */
export const placementKey = (dens: Record<WoodyId, number>, bankOffset: number, tier: string, extra = '') =>
  `${tier}|${bankOffset}|${PLACEMENT_ORDER.map((id) => dens[id].toFixed(4)).join(',')}${extra ? `|${extra}` : ''}`;
