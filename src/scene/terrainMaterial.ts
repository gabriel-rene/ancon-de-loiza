import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { SNOISE_GLSL } from './glsl/noise';
import { groundUniforms } from './groundUniforms';
import { sunUniforms } from './sunUniforms';

export function makeTerrainMaterial(info: THREE.Texture, rect: THREE.Vector4) {
  return new CustomShaderMaterial({
    baseMaterial: THREE.MeshStandardMaterial,
    uniforms: { uInfo: { value: info }, uRect: { value: rect }, ...sunUniforms, ...groundUniforms },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec3 vNw;
      void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; vNw = normalize(mat3(modelMatrix) * normal); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uInfo; uniform vec4 uRect;
      uniform sampler2D uLitter; uniform vec4 uLitterRect;
      uniform sampler2D uCover; uniform vec4 uCoverRect;
      uniform sampler2D uGround; uniform vec4 uGroundRect; uniform float uRoadSurface;
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
        // Casuarina needle litter: a brown, fibrous floor under the belts (weight from <Vegetation>).
        vec2 lu = (vW.xz - uLitterRect.xy) / uLitterRect.z;
        float inL = step(0.0, lu.x) * step(lu.x, 1.0) * step(0.0, lu.y) * step(lu.y, 1.0);
        float litter = texture2D(uLitter, lu).r * inL * (1.0 - m.g);
        vec3 needles = mix(vec3(0.13,0.075,0.04), vec3(0.21,0.13,0.07), n2) * mix(0.85, 1.1, n3);
        c = mix(c, needles, 0.85 * litter);
        // Far ground cover: same habitat weights as the near clumps, tinted in past their radius.
        vec2 cu = (vW.xz - uCoverRect.xy) / uCoverRect.z;
        float inC = step(0.0, cu.x) * step(cu.x, 1.0) * step(0.0, cu.y) * step(cu.y, 1.0);
        vec4 cov = texture2D(uCover, cu) * inC;
        vec3 vine = mix(vec3(0.10,0.20,0.05), vec3(0.16,0.27,0.07), n3);
        float vineP = cov.b * smoothstep(0.45, 0.7, snoise(vW.xz * 0.35) * 0.5 + 0.5);   // patches on the sand
        c = mix(c, vine, 0.8 * vineP);
        vec3 reed = mix(vec3(0.12,0.17,0.05), vec3(0.20,0.22,0.09), n2);
        c = mix(c, reed, 0.6 * cov.g * (1.0 - m.r));
        c *= mix(1.0, mix(0.92, 1.06, n3), cov.r);                                        // grass: slight tuft mottling
        // Phase 4a: main roads and paths (R) and trodden dirt (G), painted from <Infrastructure>.
        vec2 gu = (vW.xz - uGroundRect.xy) / uGroundRect.z;
        float inG = step(0.0, gu.x) * step(gu.x, 1.0) * step(0.0, gu.y) * step(gu.y, 1.0);
        vec4 gm = texture2D(uGround, gu) * inG;
        vec3 roadSand = mix(vec3(0.50,0.41,0.27), vec3(0.62,0.51,0.35), n2) * mix(0.9, 1.05, n3);
        vec3 roadGravel = mix(vec3(0.33,0.31,0.27), vec3(0.44,0.41,0.36), n3);
        vec3 roadAsphalt = mix(vec3(0.085,0.085,0.09), vec3(0.14,0.14,0.14), n2);
        vec3 roadC = uRoadSurface < 0.5 ? roadSand : uRoadSurface < 1.5 ? roadGravel : roadAsphalt;
        vec3 dirt = mix(vec3(0.22,0.16,0.10), vec3(0.32,0.25,0.16), n2) * mix(0.9, 1.05, n3);
        c = mix(c, dirt, 0.85 * gm.g);
        c = mix(c, roadC, gm.r);
        float wet = 1.0 - smoothstep(0.05, 0.7, vW.y);
        c *= mix(1.0, 0.5, wet);
        float slope = 1.0 - clamp(vNw.y, 0.0, 1.0);
        c = mix(c, mud * 1.2, smoothstep(0.2, 0.55, slope) * (1.0 - m.r));
        csm_DiffuseColor = vec4(c, 1.0);
        csm_Roughness = mix(0.95, 0.3, wet);
        // Grass sheen: vertical blades catch a low sun far better than the flat ground
        // plane (irradiance ~ cos(elevation), not sin), which is what makes pasture glow
        // at golden hour. Rather than an unshadowed emissive add, tilt the shading normal
        // toward the horizontal sun direction so the effect goes through the normal
        // (shadowed) lighting loop and disappears inside shadows (e.g. under trees).
        float grassy = (1.0 - m.r) * (1.0 - m.g) * (1.0 - m.b) * (1.0 - wet) * (1.0 - litter) * (1.0 - gm.r) * (1.0 - gm.g);
        vec3 sunH = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + vec3(1e-4));
        float lowSun = 1.0 - smoothstep(0.15, 0.6, uSunDir.y);          // only near golden hour
        lowSun *= smoothstep(-0.035, 0.035, uSunDir.y);                 // 0 below horizon (matches atmosphereFor's day ramp)
        vec3 bladeN = normalize(mix(vNw, normalize(vNw * 0.55 + sunH * 0.45), grassy * lowSun));
        csm_FragNormal = normalize((viewMatrix * vec4(bladeN, 0.0)).xyz);
      }`,
  });
}
