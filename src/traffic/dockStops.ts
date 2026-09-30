import type { EraId } from '../data/eras';

/**
 * Each era's dock stop (s), as eraTimings (src/traffic/schedule.ts) computes it — a plain table so the Playwright
 * shot list can import it without the geo bundle (Node's ESM loader rejects the JSON import). dockStops.test.ts keeps
 * it equal to eraTimings.
 */
export const DOCK_STOPS: Record<EraId, { load: number; unload: number }> = {
  '1840': { load: 43, unload: 28 }, '1900': { load: 43, unload: 28 }, '1925': { load: 43, unload: 28 }, '1935': { load: 30, unload: 23 },
  '1959': { load: 39, unload: 34 }, '1975': { load: 45, unload: 42 }, '1984': { load: 50, unload: 50 }, '1986': { load: 20, unload: 16 },
};
