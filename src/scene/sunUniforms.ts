import * as THREE from 'three';
/** Sun uniforms shared by terrain and vegetation materials (updated in place by <Terrain>). */
export const sunUniforms = {
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(1, 1, 1) },
  uSunI: { value: 0 },
};
