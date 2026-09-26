import { SNOISE_GLSL } from '../glsl/noise';

export const waterVertex = /* glsl */ `
uniform mat4 textureMatrix;
varying vec4 vReflUv;
varying vec3 vWorld;
void main() {
  vReflUv = textureMatrix * vec4(position, 1.0);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const waterFragment = /* glsl */ `
uniform vec3 color;
uniform sampler2D tDiffuse;
uniform sampler2D uNearInfo; uniform vec4 uNearRect;
uniform sampler2D uFarInfo;  uniform vec4 uFarRect;
uniform float uTime;
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uSunIntensity;
uniform vec2 uRiverFlow; uniform vec2 uWind;
varying vec4 vReflUv;
varying vec3 vWorld;
${SNOISE_GLSL}

vec4 waterInfo(vec2 p) {
  vec2 a = (p - uNearRect.xy) / uNearRect.z;
  if (all(greaterThan(a, vec2(0.003))) && all(lessThan(a, vec2(0.997)))) return texture2D(uNearInfo, a);
  vec2 b = (p - uFarRect.xy) / uFarRect.z;
  if (all(greaterThan(b, vec2(0.0))) && all(lessThan(b, vec2(1.0)))) return texture2D(uFarInfo, b);
  return vec4(1.0, 0.0, 1.0, 1.0);
}

vec2 grad(vec2 p) {
  const float e = 0.06;
  return vec2(snoise(p + vec2(e, 0.0)) - snoise(p - vec2(e, 0.0)), snoise(p + vec2(0.0, e)) - snoise(p - vec2(0.0, e))) / (2.0 * e);
}

vec3 waterNormal(vec2 p, float river, float dist) {
  vec2 flow = mix(uWind * 0.8, uRiverFlow, river);
  float fade = 1.0 - smoothstep(150.0, 1500.0, dist);           // calmer-looking far away (less aliasing)
  vec2 g = grad(p * 0.045 - flow * uTime * 0.05) * 0.9
         + grad(p * 0.23 - flow * uTime * 0.23 + 3.1) * 0.35
         + grad(p * 1.1  - flow * uTime * 1.0 + 7.7) * 0.14 * fade
         + grad(p * 3.9  - flow * uTime * 2.6 + 1.3) * 0.06 * fade;
  float amp = mix(0.55, 0.22, river);
  return normalize(vec3(-g.x * amp, 1.0, -g.y * amp));
}

void main() {
  vec4 inf = waterInfo(vWorld.xz);
  float depth = inf.r * 15.0;
  float river = step(0.7, inf.g);
  float shore = inf.b * 60.0;
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec3 n = waterNormal(vWorld.xz, river, dist);

  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  vec2 ruv = vReflUv.xy / vReflUv.w + n.xz * 0.035;
  vec3 refl = texture2D(tDiffuse, ruv).rgb;

  float sunUp = clamp(uSunDir.y * 4.0, 0.0, 1.0);
  vec3 riverBody = mix(vec3(0.20, 0.16, 0.09), vec3(0.035, 0.045, 0.03), 1.0 - exp(-depth * 0.7));
  vec3 seaBody = mix(vec3(0.08, 0.36, 0.34), vec3(0.01, 0.07, 0.13), 1.0 - exp(-depth * 0.22));
  vec3 body = mix(seaBody, riverBody, river) * (0.15 + 0.85 * sunUp) * mix(vec3(1.0), uSunColor, 0.5);

  vec3 H = normalize(uSunDir + V);
  float nh = max(dot(n, H), 0.0);
  vec3 spec = uSunColor * uSunIntensity * (pow(nh, 600.0) * 3.0 + pow(nh, 60.0) * 0.08) * sunUp;

  vec3 col = mix(body, refl, fres) + spec;

  float band = 1.0 - smoothstep(0.0, mix(7.0, 1.2, river), shore);
  float fn = snoise(vWorld.xz * 0.5 + uTime * vec2(0.25, 0.18)) * 0.5 + 0.5;
  float foam = band * smoothstep(0.4, 0.8, fn) * mix(0.85, 0.3, river);
  col = mix(col, vec3(0.85) * (0.2 + 0.8 * sunUp), foam);

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
