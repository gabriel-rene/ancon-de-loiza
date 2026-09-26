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
  void main() {
    vec3 ip = vec3(0.0); float s = 1.0; mat3 R = mat3(1.0);
    #ifdef USE_INSTANCING
      ip = instanceMatrix[3].xyz;
      s = length(instanceMatrix[0].xyz);
      R = mat3(instanceMatrix) / s;
    #endif
    float ph = dot(ip.xz, vec2(0.071, 0.053));
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
const foliageFragment = (bentNormals: boolean) => /* glsl */ `
  uniform vec3 uSunDir; uniform float uSunI; uniform float uTrans;${bentNormals ? ' uniform float uCardAO;' : ''}
  varying float vFlex;
  varying vec3 vPlantW;
  void main() {
    vec4 c = csm_DiffuseColor;
    #ifdef USE_COLOR
      c.rgb *= vColor.rgb;
    #endif
    float back = pow(max(dot(normalize(vPlantW - cameraPosition), uSunDir), 0.0), 3.0);
    float day = smoothstep(-0.02, 0.08, uSunDir.y);
    c.rgb *= mix(0.78, 1.0, vFlex) * (1.0 + uTrans * 0.25 * back * day);
    csm_DiffuseColor = c;
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
}

/** A wind-swayed MeshStandardMaterial plus the matching depth material for `customDepthMaterial`. */
export function makePlantMaterials(opts: PlantMaterialOpts): { material: THREE.Material; depth: THREE.Material } {
  const foliage = opts.part === 'foliage';
  const alphaTest = opts.alphaTest ?? 0;
  const material = new CustomShaderMaterial({
    baseMaterial: THREE.MeshStandardMaterial,
    vertexShader: WIND_VERTEX,
    fragmentShader: foliage ? foliageFragment(!!opts.bentNormals) : undefined,
    uniforms: foliage
      ? { ...windUniforms, uSunDir: sunUniforms.uSunDir, uSunI: sunUniforms.uSunI, uTrans: { value: opts.translucency ?? 0 },
        ...(opts.bentNormals ? cardUniforms : {}) }
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
