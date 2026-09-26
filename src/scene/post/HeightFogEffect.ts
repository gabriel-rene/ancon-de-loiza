import { Effect, EffectAttribute } from 'postprocessing';
import * as THREE from 'three';
import type { Sun } from '../useSun';

const frag = /* glsl */ `
uniform mat4 uProjInv; uniform mat4 uViewInv; uniform vec3 uCamPos;
uniform vec3 uFogColor; uniform vec3 uFogAway; uniform vec3 uSunColor; uniform vec3 uSunDir;
uniform float uDensity; uniform float uFalloff; uniform float uSkyHaze; uniform float uGlow;
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec4 ndc = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 view = uProjInv * ndc; view /= view.w;
  vec3 world = (uViewInv * view).xyz;
  vec3 ray = world - uCamPos;
  float dist = length(ray);
  vec3 dir = ray / max(dist, 1e-4);
  bool sky = depth >= 0.99999;
  float h0 = max(uCamPos.y, 0.0);
  float k = uFalloff;
  float f;
  if (sky) {
    // The sky dome has no meaningful "distance": haze is strong at the horizon and
    // thins quickly with altitude so the upper sky keeps the Sky shader's gradient. The
    // last few degrees go fully to haze so the sky meets distant land/sea without the
    // Preetham model's bright horizon rim.
    float y = max(dir.y, 0.0);
    f = 1.0 - (1.0 - uSkyHaze * exp(-y * 7.0)) * (1.0 - exp(-y * 60.0));
  } else {
    float dy = dir.y * dist;
    float ratio = abs(k * dy) > 1e-3 ? (1.0 - exp(-k * dy)) / (k * dy) : 1.0;
    float amount = uDensity * exp(-k * h0) * dist * ratio;
    f = 1.0 - exp(-amount);
  }
  // In-scattering: haze is warm and bright toward the sun, cooler and dimmer away from it.
  float cosT = dot(dir, uSunDir);
  float c = max(cosT, 0.0);
  vec3 fogCol = mix(uFogAway, uFogColor, pow(0.5 + 0.5 * cosT, 1.5));
  fogCol += uSunColor * (0.25 * pow(c, 6.0) + 0.6 * pow(c, 40.0)) * uGlow;
  outputColor = vec4(mix(inputColor.rgb, fogCol, clamp(f, 0.0, 1.0)), inputColor.a);
}`;

export class HeightFogEffect extends Effect {
  private cam: THREE.Camera;
  constructor(camera: THREE.Camera) {
    super('HeightFogEffect', frag, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ['uProjInv', new THREE.Uniform(new THREE.Matrix4())],
        ['uViewInv', new THREE.Uniform(new THREE.Matrix4())],
        ['uCamPos', new THREE.Uniform(new THREE.Vector3())],
        ['uFogColor', new THREE.Uniform(new THREE.Color())],
        ['uFogAway', new THREE.Uniform(new THREE.Color())],
        ['uSunColor', new THREE.Uniform(new THREE.Color())],
        ['uSunDir', new THREE.Uniform(new THREE.Vector3(0, 1, 0))],
        ['uDensity', new THREE.Uniform(0.0006)],
        ['uFalloff', new THREE.Uniform(0.012)],
        ['uSkyHaze', new THREE.Uniform(0.7)],
        ['uGlow', new THREE.Uniform(1)],
      ]),
    });
    this.cam = camera;
  }
  setAtmosphere(sun: Sun) {
    this.uniforms.get('uFogColor')!.value.setRGB(...sun.atm.fogColor);
    this.uniforms.get('uFogAway')!.value.setRGB(...sun.atm.fogAway);
    this.uniforms.get('uSunColor')!.value.setRGB(...sun.atm.sunColor);
    this.uniforms.get('uSunDir')!.value.copy(sun.dir);
    this.uniforms.get('uDensity')!.value = sun.atm.fogDensity;
    this.uniforms.get('uSkyHaze')!.value = sun.atm.skyHaze;
    // Sun in-scatter fades with the direct light (no glow once the sun is down).
    this.uniforms.get('uGlow')!.value = Math.min(1, sun.atm.sunIntensity / 3.4);
  }
  update() {
    this.uniforms.get('uProjInv')!.value.copy(this.cam.projectionMatrixInverse);
    this.uniforms.get('uViewInv')!.value.copy(this.cam.matrixWorld);
    this.uniforms.get('uCamPos')!.value.setFromMatrixPosition(this.cam.matrixWorld);
  }
}
