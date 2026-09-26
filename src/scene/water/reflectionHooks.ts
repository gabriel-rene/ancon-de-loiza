/**
 * Callbacks run around the water Reflector's mirror render. Vegetation uses them to swap its
 * main-view LOD (near meshes + far cards) for a cheap "all cards" mesh in the reflection.
 */
export const reflectionHooks = {
  before: new Set<() => void>(),
  after: new Set<() => void>(),
};
