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
uniform vec3 uHazeColor; uniform vec3 uHazeAway; uniform float uHaze;
uniform float uDebugWater;
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

// Noise gradient in the noise's own coordinates.
vec2 grad(vec2 q) {
  const float e = 0.07;
  return vec2(snoise(q + vec2(e, 0.0)) - snoise(q - vec2(e, 0.0)), snoise(q + vec2(0.0, e)) - snoise(q - vec2(0.0, e))) / (2.0 * e);
}

// One ripple octave in a direction-aligned frame. 'freq' is cycles per metre across the
// crests, 'stretch' (<1) elongates features along 'dir'. The octave fades out once its
// wavelength drops under ~3 pixels (pxm = metres per pixel), which is what removes the
// distant speckle/aliasing instead of a fixed distance cut.
vec2 octave(vec2 p, vec2 dir, float freq, float stretch, float speed, float seed, float pxm) {
  float w = 1.0 - smoothstep(0.12, 0.35, pxm * freq);
  if (w <= 0.0) return vec2(0.0);                       // sub-pixel octave: skip the 4 noise taps
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 q = vec2(dot(p, dir) * stretch, dot(p, perp)) * freq;
  q.x -= uTime * speed * freq;
  vec2 g = grad(q + seed);
  // back to world xz (chain rule: d/dp = dq/dp^T * g)
  return (dir * g.x * stretch + perp * g.y) * w;
}

void main() {
  vec4 inf = waterInfo(vWorld.xz);
  if (uDebugWater > 0.5) {
    // Raw waterInfo channels as colour: R depth/15m, G river(255)/pond(128)/sea(0), B |shore dist|/60m.
    gl_FragColor = vec4(inf.rgb, 1.0);
    #include <colorspace_fragment>
    return;
  }
  float depth = inf.r * 15.0;
  float river = smoothstep(0.55, 0.85, inf.g);
  float shore = inf.b * 60.0;
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  float pxm = max(length(fwidth(vWorld.xz)), 1e-4);

  // The river flag is spatially coherent, so branching keeps warps uniform: river fragments
  // pay only for river octaves, sea fragments only for sea octaves; only the thin blend band
  // at the mouth evaluates both.
  vec2 gr = vec2(0.0), gs = vec2(0.0);
  float flowSpd = length(uRiverFlow);
  if (river > 0.0) {
    // River: calm, mirror-like, fine streaks elongated along the current.
    vec2 fdir = flowSpd > 1e-4 ? uRiverFlow / flowSpd : vec2(0.7071, -0.7071);
    gr = octave(vWorld.xz, fdir, 0.35, 0.30, 0.25 * flowSpd, 1.3, pxm) * 0.55
       + octave(vWorld.xz, fdir, 1.30, 0.40, 0.45 * flowSpd, 7.1, pxm) * 0.30
       + octave(vWorld.xz, fdir, 4.20, 0.60, 0.60 * flowSpd, 3.7, pxm) * 0.15;
  }
  if (river < 1.0) {
    // Sea: trade-wind chop, crests across the wind, several octaves.
    gs = octave(vWorld.xz, uWind, 0.045, 0.45, 1.2, 0.0, pxm) * 0.55
       + octave(vWorld.xz, uWind, 0.16, 0.55, 1.6, 5.3, pxm) * 0.30
       + octave(vWorld.xz, uWind, 0.60, 0.70, 1.9, 9.9, pxm) * 0.18
       + octave(vWorld.xz, uWind, 2.10, 0.80, 2.4, 2.2, pxm) * 0.10;
  }
  float riverAmp = 0.03 * (0.7 + 0.3 * flowSpd);
  vec2 g = mix(gs * 0.16, gr * riverAmp, river);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));

  // Fresnel from a flattened normal: at grazing angles tiny tilts would otherwise swing
  // between full sky reflection and body colour (the old "blotches").
  vec3 nF = normalize(mix(n, vec3(0.0, 1.0, 0.0), 0.6));
  float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(nF, V), 0.0, 1.0), 5.0);
  float distortion = mix(0.05, 0.02, river) / (1.0 + dist * 0.004);
  vec2 ruv = vReflUv.xy / vReflUv.w + n.xz * distortion;
  vec3 refl = texture2D(tDiffuse, ruv).rgb;
  // The mirror renders without post fog; add the haze the reflected ray would see.
  vec3 R = reflect(-V, n);
  vec3 hazeCol = mix(uHazeAway, uHazeColor, pow(0.5 + 0.5 * dot(R, uSunDir), 1.5));
  // Weighted by fres too: haze approximates the atmospheric perspective the reflected ray
  // would pick up over a long, grazing sight line. At steep (near-vertical, low-fres) angles
  // the reflection barely shows anyway, but hazeCol's HDR-bright golden-hour tone (channels
  // can exceed 1) would otherwise still visibly stain it, reading as a warm patch mid-river.
  refl = mix(refl, hazeCol, uHaze * fres);

  float sunUp = clamp(uSunDir.y * 4.0, 0.0, 1.0);
  vec3 riverBody = mix(vec3(0.11, 0.09, 0.05), vec3(0.03, 0.035, 0.022), 1.0 - exp(-depth * 0.5));
  vec3 seaBody = mix(vec3(0.06, 0.30, 0.28), vec3(0.008, 0.06, 0.10), 1.0 - exp(-depth * 0.22));
  vec3 body = mix(seaBody, riverBody, river) * (0.12 + 0.88 * sunUp) * mix(vec3(1.0), uSunColor, 0.5);

  // Sun glint: tight lobe up close, widening as ripples go sub-pixel (Toksvig-style),
  // with energy roughly conserved so the glitter path reads as a soft band far away.
  vec3 H = normalize(uSunDir + V);
  float nh = max(dot(n, H), 0.0);
  float rough = smoothstep(0.02, 1.2, pxm);
  float shin = mix(mix(420.0, 1400.0, river), 90.0, rough);
  float spec = pow(nh, shin) * shin * 0.0032 + pow(nh, 24.0) * 0.03;
  vec3 col = mix(body, refl, fres) + uSunColor * uSunIntensity * spec * sunUp * mix(1.0, 0.7, river);

  float band = 1.0 - smoothstep(0.0, mix(7.0, 1.0, river), shore);
  float fn = snoise(vWorld.xz * 0.5 + uTime * vec2(0.25, 0.18)) * 0.5 + 0.5;
  float foam = band * smoothstep(0.45, 0.85, fn) * mix(0.8, 0.12, river);
  col = mix(col, vec3(0.8) * (0.15 + 0.85 * sunUp) * mix(vec3(1.0), uSunColor, 0.3), foam);

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
