import { Effect, EffectAttribute } from 'postprocessing';
import * as THREE from 'three';
import type { Sun } from '../useSun';

const frag = /* glsl */ `
uniform mat4 uProjInv; uniform mat4 uViewInv; uniform vec3 uCamPos;
uniform vec3 uFogColor; uniform vec3 uSunColor; uniform vec3 uSunDir;
uniform float uDensity; uniform float uFalloff; uniform float uSkyHaze;
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
    // The sky dome has no meaningful "distance"; fade the haze from strong at the
    // horizon to weak at the zenith instead of reusing the terrain distance model
    // (which underestimates coverage for steep look-up angles and lets the raw,
    // HDR-bright sky shader show through almost unfiltered). uSkyHaze tracks
    // uDensity so the sky still responds to time-of-day like the terrain fog does.
    f = uSkyHaze * exp(-max(dir.y, 0.0) * 3.0);
  } else {
    float dy = dir.y * dist;
    float ratio = abs(k * dy) > 1e-3 ? (1.0 - exp(-k * dy)) / (k * dy) : 1.0;
    float amount = uDensity * exp(-k * h0) * dist * ratio;
    f = 1.0 - exp(-amount);
  }
  float sunAmt = pow(max(dot(dir, uSunDir), 0.0), 6.0);
  vec3 fogCol = mix(uFogColor, uSunColor * 1.4, sunAmt * 0.8);
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
        ['uSunColor', new THREE.Uniform(new THREE.Color())],
        ['uSunDir', new THREE.Uniform(new THREE.Vector3(0, 1, 0))],
        ['uDensity', new THREE.Uniform(0.0006)],
        ['uFalloff', new THREE.Uniform(0.012)],
        ['uSkyHaze', new THREE.Uniform(0.85)],
      ]),
    });
    this.cam = camera;
  }
  setAtmosphere(sun: Sun) {
    this.uniforms.get('uFogColor')!.value.setRGB(...sun.atm.fogColor);
    this.uniforms.get('uSunColor')!.value.setRGB(...sun.atm.sunColor);
    this.uniforms.get('uSunDir')!.value.copy(sun.dir);
    this.uniforms.get('uDensity')!.value = sun.atm.fogDensity;
    // Sky haze tracks the same density curve as the terrain fog (0.0011 is the
    // golden-hour density from atmosphere.ts), so the sky still responds to
    // time-of-day instead of being a fixed constant.
    this.uniforms.get('uSkyHaze')!.value = 0.85 * THREE.MathUtils.clamp(sun.atm.fogDensity / 0.0011, 0, 1);
  }
  update() {
    this.uniforms.get('uProjInv')!.value.copy(this.cam.projectionMatrixInverse);
    this.uniforms.get('uViewInv')!.value.copy(this.cam.matrixWorld);
    this.uniforms.get('uCamPos')!.value.setFromMatrixPosition(this.cam.matrixWorld);
  }
}
