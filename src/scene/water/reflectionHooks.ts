/**
 * Callbacks run around the water Reflector's mirror render. Vegetation uses them to swap its
 * main-view LOD (near meshes + far cards) for a cheaper reflection LOD (meshes only close by,
 * cards beyond).
 */
export const reflectionHooks = {
  before: new Set<() => void>(),
  after: new Set<() => void>(),
};
