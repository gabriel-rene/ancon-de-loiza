/** Live near/far instance counts per mounted InstancedSpecies (read by the debug panel monitor). */
export const vegStats = new Map<object, { near: number; far: number }>();

export function vegStatsText() {
  let near = 0, far = 0;
  vegStats.forEach((s) => { near += s.near; far += s.far; });
  return `${near} / ${far}`;
}
