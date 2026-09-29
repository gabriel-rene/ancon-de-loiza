import * as THREE from 'three';

const none = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
none.needsUpdate = true;
const noneRGBA = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
noneRGBA.needsUpdate = true;
const noneGround = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
noneGround.needsUpdate = true;

/**
 * Ground-cover uniforms read by the terrain material, written by <Vegetation>: `uLitter` is a
 * 0..1 needle-litter weight (R) over the rectangle `uLitterRect` (minX, minZ, extent); outside
 * it (and before any vegetation is placed) the weight is 0. `uCover` is the far ground-cover tint
 * (R = grass, G = reeds, B = morning glory, 0..1) over `uCoverRect`, same layout. `uGround` is the
 * Phase 4a ground mask (R road, G trodden dirt) over `uGroundRect`; `uRoadSurface` is 0 sand,
 * 1 gravel, 2 asphalt (written by `<Infrastructure>`).
 */
export const groundUniforms = {
  uLitter: { value: none as THREE.Texture },
  uLitterRect: { value: new THREE.Vector4(0, 0, 1, 0) },
  uCover: { value: noneRGBA as THREE.Texture },
  uCoverRect: { value: new THREE.Vector4(0, 0, 1, 0) },
  uGround: { value: noneGround as THREE.Texture },
  uGroundRect: { value: new THREE.Vector4(0, 0, 1, 0) },
  uRoadSurface: { value: 0 },
};
export const NO_LITTER = none;
export const NO_COVER = noneRGBA;
export const NO_GROUND = noneGround;
