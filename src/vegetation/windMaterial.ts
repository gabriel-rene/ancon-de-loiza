import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { WIND_DIR } from '../geo/constants';
import { sunUniforms } from '../scene/sunUniforms';

/**
 * Shared wind uniforms for every plant material (and its depth twin, so shadows sway too).
 * `uWindStrength` is the tip displacement in metres at aFlex = 1 (independent of instance scale).
 */
export const windUniforms = {
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector2(...WIND_DIR) },
  uWindStrength: { value: 0.45 },
};

/** Drive the wind clock. Idempotent within a frame (safe to call from several components). */
export function setWindTime(elapsed: number, frozen: boolean) {
  windUniforms.uTime.value = frozen ? 10 : elapsed;
}

const WIND_VERTEX = /* glsl */ `
  uniform float uTime; uniform vec2 uWind; uniform float uWindStrength;
  attribute float aFlex;
  varying float vFlex;
  varying vec3 vPlantW;
  varying float vSeed;
  void main() {
    vec3 ip = vec3(0.0); float s = 1.0; mat3 R = mat3(1.0);
    #ifdef USE_INSTANCING
      ip = instanceMatrix[3].xyz;
      s = length(instanceMatrix[0].xyz);
      R = mat3(instanceMatrix) / s;
    #endif
    float ph = dot(ip.xz, vec2(0.071, 0.053));
    vSeed = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
    float gust = 0.65 + 0.35 * sin(uTime * 0.31 + ph * 0.2);
    float sway = (sin(uTime * 1.1 + ph) * 0.7 + sin(uTime * 2.3 + ph * 1.7) * 0.3) * gust;
    float k = aFlex * aFlex;
    vec3 worldPush = vec3(uWind.x, 0.0, uWind.y) * uWindStrength * k * (0.6 + 0.4 * sway);
    worldPush.y = -0.15 * k * uWindStrength * abs(sway);                       // tips dip slightly
    float flutter = sin(uTime * 7.0 + ph * 5.0 + position.x * 3.1 + position.z * 2.7) * 0.03 * aFlex;
    vec3 local = transpose(R) * worldPush / s;                                   // world metres -> local
    csm_Position = position + local + normal * flutter;
    vFlex = aFlex;
    vec4 wp = vec4(csm_Position, 1.0);
    #ifdef USE_INSTANCING
      wp = instanceMatrix * wp;
    #endif
    vPlantW = (modelMatrix * wp).xyz;
  }`;

/**
 * Impostor cards have no crown self-occlusion and their up-bent normals see more sky than the
 * real crown's sides, so their indirect (sky) light is damped (`uCardAO`, ambient occlusion
 * factor) to keep the LOD swap from brightening the tree. Shared by every card material.
 */
export const cardUniforms = { uCardAO: { value: 0.3 } };

/**
 * Foliage: subtle view-dependent back-light (looking toward the sun through the leaves) folded
 * into the albedo so it still goes through the shadowed lighting path (no emissive), plus a
 * little self-shadowing toward the crown interior (low aFlex). `bentNormals` (impostor cards)
 * keeps the geometry's outward-bent normals on both faces instead of flipping back faces.
 */
const foliageFragment = (bentNormals: boolean, fade: boolean, upNormals: boolean) => /* glsl */ `
  uniform vec3 uSunDir; uniform float uSunI; uniform float uTrans; uniform vec2 uTint;${bentNormals ? ' uniform float uCardAO;' : ''}${fade ? ' uniform float uFadeR;' : ''}
  varying float vFlex;
  varying vec3 vPlantW;
  varying float vSeed;
  void main() {
    vec4 c = csm_DiffuseColor;
    #ifdef USE_COLOR
      c.rgb *= vColor.rgb;
    #endif
    float tv = (vSeed - 0.5) * 2.0;                                   // -1..1 per plant
    float th = (fract(vSeed * 7.13) - 0.5) * 2.0;
    c.rgb *= 1.0 + uTint.x * tv;
    c.rgb = mix(c.rgb, c.rgb * vec3(1.12, 1.06, 0.78), max(0.0, th) * uTint.y); // toward yellow-green
    c.rgb = mix(c.rgb, c.rgb * vec3(0.9, 0.98, 1.05), max(0.0, -th) * uTint.y); // toward blue-green
    float back = pow(max(dot(normalize(vPlantW - cameraPosition), uSunDir), 0.0), 3.0);
    float day = smoothstep(-0.02, 0.08, uSunDir.y);
    c.rgb *= mix(0.78, 1.0, vFlex) * (1.0 + uTrans * 0.25 * back * day);
    ${fade ? `float fd = distance(vPlantW.xz, cameraPosition.xz);
    float fk = 1.0 - smoothstep(uFadeR * 0.8, uFadeR, fd);
    // 4×4 ordered dither: no sorting, no hard edge.
    vec2 q = mod(floor(gl_FragCoord.xy), 4.0);
    float bayer = (mod(q.x + 2.0 * q.y, 4.0) * 4.0 + mod(q.x * 3.0 + q.y, 4.0) + 0.5) / 16.0;
    if (fk < bayer) discard;` : ''}
    csm_DiffuseColor = c;
    ${upNormals ? `// Up-leaning ground-cover normals on both faces (a flipped back face would point into the ground).
    csm_FragNormal = normalize(vNormal);` : ''}
    ${bentNormals ? `// The card's bent normals point sideways/up, i.e. edge-on to a viewer facing the card
    // (grazing Fresnel -> pale sky sheen). Lean them toward the viewer like a rounded crown.
    csm_FragNormal = normalize(normalize(vNormal) + normalize(vViewPosition));
    csm_AO = uCardAO;` : ''}
  }`;

export interface PlantMaterialOpts {
  part: 'bark' | 'foliage';
  map?: THREE.Texture;
  color: THREE.ColorRepresentation;
  roughness: number;
  alphaTest?: number;
  translucency?: number;
  vertexColors?: boolean;
  /** Impostor cards: don't flip normals on back faces (the card's normals are bent outward). */
  bentNormals?: boolean;
  /** Per-instance colour jitter (hashed from instance position); value = ± brightness fraction, hue = ± yellow-green/blue-green shift fraction. */
  tint?: { value: number; hue: number };
  /**
   * Ground cover: dither-fade out over the last 20 % of `radius` (horizontal distance to the
   * camera). The uniform object is shared, so changing its value retunes every material using it.
   */
  fade?: { radius: THREE.IUniform<number> };
  /** Keep the geometry's normals on back faces too (ground clumps: normals are mostly +Y). */
  upNormals?: boolean;
}

/** A wind-swayed MeshStandardMaterial plus the matching depth material for `customDepthMaterial`. */
export function makePlantMaterials(opts: PlantMaterialOpts): { material: THREE.Material; depth: THREE.Material } {
  const foliage = opts.part === 'foliage';
  const alphaTest = opts.alphaTest ?? 0;
  const material = new CustomShaderMaterial({
    baseMaterial: THREE.MeshStandardMaterial,
    vertexShader: WIND_VERTEX,
    fragmentShader: foliage ? foliageFragment(!!opts.bentNormals, !!opts.fade, !!opts.upNormals) : undefined,
    uniforms: foliage
      ? { ...windUniforms, uSunDir: sunUniforms.uSunDir, uSunI: sunUniforms.uSunI, uTrans: { value: opts.translucency ?? 0 },
        uTint: { value: [opts.tint?.value ?? 0, opts.tint?.hue ?? 0] },
        ...(opts.bentNormals ? cardUniforms : {}), ...(opts.fade ? { uFadeR: opts.fade.radius } : {}) }
      : { ...windUniforms },
    color: opts.color,
    map: opts.map ?? null,
    roughness: opts.roughness,
    metalness: 0,
    alphaTest,
    vertexColors: !!opts.vertexColors,
    side: foliage ? THREE.DoubleSide : THREE.FrontSide,
  });
  const depth = new CustomShaderMaterial({
    baseMaterial: THREE.MeshDepthMaterial,
    vertexShader: WIND_VERTEX,
    uniforms: { ...windUniforms },
    depthPacking: THREE.RGBADepthPacking,
    map: opts.map ?? null,
    alphaTest,
  });
  return { material, depth };
}
