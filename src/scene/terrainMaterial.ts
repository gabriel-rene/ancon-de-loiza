import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { SNOISE_GLSL } from './glsl/noise';

export function makeTerrainMaterial(info: THREE.Texture, rect: THREE.Vector4) {
  return new CustomShaderMaterial({
    baseMaterial: THREE.MeshStandardMaterial,
    uniforms: { uInfo: { value: info }, uRect: { value: rect } },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec3 vNw;
      void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; vNw = normalize(mat3(modelMatrix) * normal); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uInfo; uniform vec4 uRect;
      varying vec3 vW; varying vec3 vNw;
      ${SNOISE_GLSL}
      void main(){
        vec4 m = texture2D(uInfo, (vW.xz - uRect.xy) / uRect.z);
        float n = snoise(vW.xz * 0.06) * 0.5 + 0.5;
        float n2 = snoise(vW.xz * 0.7) * 0.5 + 0.5;
        float n3 = snoise(vW.xz * 3.1) * 0.5 + 0.5;
        vec3 grass = mix(vec3(0.16,0.21,0.07), vec3(0.29,0.31,0.11), n) * mix(0.85, 1.1, n3);
        vec3 forest = vec3(0.07,0.10,0.04) * mix(0.8, 1.2, n2);
        vec3 sand = mix(vec3(0.66,0.58,0.42), vec3(0.78,0.71,0.54), n2) * mix(0.92, 1.05, n3);
        vec3 mud = mix(vec3(0.16,0.13,0.09), vec3(0.26,0.21,0.14), n2);
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
      }`,
  });
}
