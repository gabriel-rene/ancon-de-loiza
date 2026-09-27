// src/people/material.ts
import * as THREE from 'three';

/**
 * Shared GLSL for the figure material: a small 3D value noise and a cotton look — slow mottling plus
 * vertical fold streaks, ±6 % in value, faded out when minified so it never shimmers at distance.
 * Evaluated in part-local metres (instance scale applied, not its rotation or translation), so the
 * cloth pattern rides with the body instead of swimming as figures move.
 */
export const FABRIC_GLSL = /* glsl */ `
float figHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float figNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(figHash(i), figHash(i + vec3(1, 0, 0)), f.x), mix(figHash(i + vec3(0, 1, 0)), figHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(figHash(i + vec3(0, 0, 1)), figHash(i + vec3(1, 0, 1)), f.x), mix(figHash(i + vec3(0, 1, 1)), figHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float figFabric(vec3 p) {
  float mottle = figNoise(p * 9.0) * 0.6 + figNoise(p * 23.0 + 7.1) * 0.4;
  float folds = figNoise(vec3(p.x * 38.0, p.y * 3.5, p.z * 38.0));
  float fine = 1.0 - smoothstep(0.4, 1.2, length(fwidth(p * 38.0)));
  float v = mix(0.5, mottle * 0.65 + folds * 0.35, fine);
  return 1.0 + (v - 0.5) * 0.12;
}
`;

/**
 * The people material: MeshStandardMaterial (roughness 0.85, double-sided for open hems) × instance colour,
 * with cotton value noise, baked joint/hem occlusion from the geometry's `occlusion` attribute
 * (albedo × mix(1, 0.75, occlusion), up to 1.8× deeper on pale cloth) and a cheap fresnel sheen proportional to the diffuse light.
 * The caller owns (and disposes) it.
 */
export function createFigureMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float occlusion;
varying float vFigAo;
varying vec3 vFigLocal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vFigAo = mix(1.0, 0.75, occlusion);
#ifdef USE_INSTANCING
vFigLocal = position * vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
#else
vFigLocal = position;
#endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vFigAo;
varying vec3 vFigLocal;
${FABRIC_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
// Pale cloth has little tonal range to shape it: the baked occlusion bites harder the brighter the albedo
// (up to ×1.8 at white), dark cloth keeps the base term.
float figAo = 1.0 - (1.0 - vFigAo) * (1.0 + 0.8 * dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)));
diffuseColor.rgb *= figAo * figFabric(vFigLocal);`)
      .replace('#include <opaque_fragment>', `{
  float figFr = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 3.0);
  outgoingLight += figFr * 0.35 * (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse);
}
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'ancon-figure-v2';
  return m;
}
