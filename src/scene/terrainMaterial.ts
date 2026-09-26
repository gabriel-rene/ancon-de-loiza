import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { SNOISE_GLSL } from './glsl/noise';

/** Sun uniforms shared by every terrain material (updated in place by <Terrain>). */
export const terrainSun = {
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(1, 1, 1) },
  uSunI: { value: 0 },
};

export function makeTerrainMaterial(info: THREE.Texture, rect: THREE.Vector4) {
  return new CustomShaderMaterial({
    baseMaterial: THREE.MeshStandardMaterial,
    uniforms: { uInfo: { value: info }, uRect: { value: rect }, ...terrainSun },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec3 vNw;
      void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; vNw = normalize(mat3(modelMatrix) * normal); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uInfo; uniform vec4 uRect;
      uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uSunI;
      varying vec3 vW; varying vec3 vNw;
      ${SNOISE_GLSL}
      void main(){
        vec4 m = texture2D(uInfo, (vW.xz - uRect.xy) / uRect.z);
        float n0 = snoise(vW.xz * 0.006 + 11.0) * 0.5 + 0.5;   // ~170 m patches: lush vs dry pasture
        float n = snoise(vW.xz * 0.06) * 0.5 + 0.5;
        float n2 = snoise(vW.xz * 0.7) * 0.5 + 0.5;
        float n3 = snoise(vW.xz * 3.1) * 0.5 + 0.5;
        vec3 lush = mix(vec3(0.07,0.17,0.03), vec3(0.13,0.24,0.05), n);
        vec3 dry = mix(vec3(0.21,0.22,0.07), vec3(0.30,0.27,0.10), n);
        vec3 grass = mix(lush, dry, 0.2 + 0.45 * smoothstep(0.3, 0.85, n0)) * mix(0.85, 1.1, n3);
        vec3 forest = vec3(0.035,0.085,0.025) * mix(0.8, 1.2, n2);
        vec3 sand = mix(vec3(0.70,0.57,0.38), vec3(0.82,0.70,0.50), n2) * mix(0.92, 1.05, n3);
        vec3 mud = mix(vec3(0.15,0.10,0.06), vec3(0.24,0.17,0.10), n2);
        vec3 c = grass;
        c = mix(c, forest, m.b);
        c = mix(c, sand, m.r);
        c = mix(c, mud, m.g);
        float wet = 1.0 - smoothstep(0.05, 0.7, vW.y);
        c *= mix(1.0, 0.5, wet);
        float slope = 1.0 - clamp(vNw.y, 0.0, 1.0);
        c = mix(c, mud * 1.2, smoothstep(0.2, 0.55, slope) * (1.0 - m.r));
        csm_DiffuseColor = vec4(c, 1.0);
        csm_Roughness = mix(0.95, 0.3, wet);
        // Stand-in for grass blades until Phase 2 vegetation: vertical blades catch a low
        // sun far better than the flat ground plane (irradiance ~ cos(elevation), not
        // sin), which is what makes pasture glow at golden hour. Unshadowed; fine while
        // nothing casts shadows on the terrain.
        float grassy = (1.0 - m.r) * (1.0 - m.g) * (1.0 - wet);
        csm_Emissive = c * uSunColor * uSunI * 0.12 * length(uSunDir.xz) * grassy * step(0.0, uSunDir.y);
      }`,
  });
}
