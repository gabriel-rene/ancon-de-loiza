import * as THREE from 'three';

const none = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
none.needsUpdate = true;

/**
 * Ground-cover uniforms read by the terrain material, written by <Vegetation>: `uLitter` is a
 * 0..1 needle-litter weight (R) over the rectangle `uLitterRect` (minX, minZ, extent); outside
 * it (and before any vegetation is placed) the weight is 0.
 */
export const groundUniforms = {
  uLitter: { value: none as THREE.Texture },
  uLitterRect: { value: new THREE.Vector4(0, 0, 1, 0) },
};
export const NO_LITTER = none;
