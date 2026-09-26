import { Effect } from 'postprocessing';
import * as THREE from 'three';

// Pre-tonemap grade in linear light: exposure, white balance and saturation. The
// tonemapper that follows does the filmic contrast; this keeps its input in range and
// restores the colour that AgX-style curves wash out of warm, hazy scenes.
const frag = /* glsl */ `
uniform float uExposure; uniform vec3 uBalance; uniform float uSaturation;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb * uExposure * uBalance;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  outputColor = vec4(max(mix(vec3(l), c, uSaturation), 0.0), inputColor.a);
}`;

export class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', frag, {
      uniforms: new Map<string, THREE.Uniform>([
        ['uExposure', new THREE.Uniform(1)],
        ['uBalance', new THREE.Uniform(new THREE.Vector3(1, 1, 1))],
        ['uSaturation', new THREE.Uniform(1)],
      ]),
    });
  }
  set(exposure: number, balance: [number, number, number], saturation: number) {
    this.uniforms.get('uExposure')!.value = exposure;
    this.uniforms.get('uBalance')!.value.set(...balance);
    this.uniforms.get('uSaturation')!.value = saturation;
  }
}
