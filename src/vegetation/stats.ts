/** Live near/far instance counts per mounted InstancedSpecies (read by the debug panel monitor). */
export const vegStats = new Map<object, { near: number; far: number }>();

export function vegStatsText() {
  let near = 0, far = 0;
  vegStats.forEach((s) => { near += s.near; far += s.far; });
  return `${near} / ${far}`;
}

/**
 * Vegetation build costs (ms): every placement run (`placeRuns`; the first is the cold start,
 * later ones reuse cached masks) and the summed impostor bake time; LOD/view-cull re-splits
 * (count and summed ms, all species); plus the instance counts per species of the last run. Exposed as `window.__ANCON_VEG__` in dev builds for measurement.
 */
export const vegTiming = { placeRuns: [] as number[], bakeMs: 0, lodRuns: 0, lodMs: 0, counts: {} as Record<string, { near: number; far: number }> };
declare global { interface Window { __ANCON_VEG__?: typeof vegTiming } }
if (typeof window !== 'undefined' && (import.meta.env?.DEV || new URLSearchParams(window.location.search).get('debug') === '1')) {
  window.__ANCON_VEG__ = vegTiming;
}
