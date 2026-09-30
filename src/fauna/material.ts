import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { HIP, WING_K, type Shape } from './geometry';

type K = { root: number; hinge: number; back: number };

/**
 * Wing flap/fold and leg trail, per vertex (spec 5 §4.2). part = (wing side −1/0/+1, leg 0/1);
 * anim = (flap angle rad, fold 0..1, legs 0..1). The GLSL below does the same math; keep them in step.
 */
export function animateVertex(p: [number, number, number], part: [number, number], anim: [number, number, number], k: K, hip: [number, number]): [number, number, number] {
  let [x, y, z] = p;
  if (part[0] !== 0) {
    const side = Math.sign(part[0]), d0 = Math.max(Math.abs(z) - k.root, 0), f = anim[1], a = anim[0] * (1 - f);
    const dz = d0 * (1 + (0.08 - 1) * f);
    x -= f * d0 * k.back;
    y = y + dz * Math.sin(a);
    z = side * (k.root + dz * Math.cos(a));
  }
  if (part[1] > 0) {
    const b = -1.3 * anim[2], qx = x - hip[0], qy = y - hip[1];
    x = hip[0] + qx * Math.cos(b) - qy * Math.sin(b);
    y = hip[1] + qx * Math.sin(b) + qy * Math.cos(b);
  }
  return [x, y, z];
}

const VERTEX = /* glsl */ `
uniform vec3 uWingK;   // root |z|, hinge y (unused: offsets are relative), fold-back per metre of span
uniform vec2 uHip;
attribute vec2 aPart;
attribute vec3 aAnim;  // per instance: flap angle, fold, legs
void main() {
  vec3 p = position;
  if (aPart.x != 0.0) {
    float side = sign(aPart.x);
    float d0 = max(abs(p.z) - uWingK.x, 0.0);
    float f = aAnim.y;
    float a = aAnim.x * (1.0 - f);
    float dz = d0 * mix(1.0, 0.08, f);
    p.x -= f * d0 * uWingK.z;
    p.y += dz * sin(a);
    p.z = side * (uWingK.x + dz * cos(a));
  }
  if (aPart.y > 0.0) {
    float b = -1.3 * aAnim.z;
    vec2 q = p.xy - uHip;
    p.xy = uHip + vec2(q.x * cos(b) - q.y * sin(b), q.x * sin(b) + q.y * cos(b));
  }
  csm_Position = p;
}`;

/** Lit, vertex-coloured bird/fish/manatee material plus its depth twin (so shadows fold and flap too). */
export function faunaMaterials(s: Shape): { material: THREE.Material; depth: THREE.Material } {
  const k = WING_K[s], uniforms = { uWingK: { value: new THREE.Vector3(k.root, k.hinge, k.back) }, uHip: { value: new THREE.Vector2(...HIP[s]) } };
  const material = new CustomShaderMaterial({
    baseMaterial: THREE.MeshStandardMaterial, vertexShader: VERTEX, uniforms,
    vertexColors: true, roughness: s === 'mullet' ? 0.35 : 0.85, metalness: 0, side: THREE.DoubleSide,
  });
  const depth = new CustomShaderMaterial({
    baseMaterial: THREE.MeshDepthMaterial, vertexShader: VERTEX, uniforms, depthPacking: THREE.RGBADepthPacking,
  });
  return { material, depth };
}

/** Water ring: a flat quad; an annulus grows from 15 % to the full radius and fades over its life (per-instance aRing = age01). */
export function ringMaterial(): THREE.Material {
  return new CustomShaderMaterial({
    baseMaterial: THREE.MeshBasicMaterial,
    vertexShader: /* glsl */ `
      attribute float aRing;
      varying vec2 vRingUv; varying float vAge;
      void main() { vRingUv = uv; vAge = aRing; }`,
    fragmentShader: /* glsl */ `
      varying vec2 vRingUv; varying float vAge;
      void main() {
        float r = length(vRingUv * 2.0 - 1.0);
        float R = mix(0.15, 1.0, sqrt(vAge));
        float w = 0.06 + 0.05 * vAge;
        float ring = 1.0 - smoothstep(0.0, w, abs(r - R));
        float a = ring * (1.0 - vAge) * 0.55;
        if (a < 0.003) discard;
        csm_DiffuseColor = vec4(0.92, 0.95, 0.97, a);
      }`,
    transparent: true, depthWrite: false,
  });
}
