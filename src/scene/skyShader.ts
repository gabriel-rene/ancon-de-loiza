const UNIFORM_ANCHOR = 'uniform float showSunDisc;';
const OUTPUT_ANCHOR = 'gl_FragColor = vec4( texColor, 1.0 );';

/**
 * Adds an output gain (uGain) and a hue-preserving luminance shoulder (uShoulder) to
 * three's Preetham Sky fragment shader, keeping the sun disc out of the shoulder.
 * Throws if three's shader source no longer contains the lines we patch, so an upgrade
 * fails loudly (and in CI) instead of silently rendering a blown-out sky.
 */
export function patchSkyShader(src: string): string {
  for (const anchor of [UNIFORM_ANCHOR, OUTPUT_ANCHOR]) {
    if (!src.includes(anchor)) throw new Error(`patchSkyShader: three's Sky shader no longer contains "${anchor}"`);
  }
  return src
    .replace(UNIFORM_ANCHOR, `${UNIFORM_ANCHOR}\nuniform float uGain;\nuniform float uShoulder;`)
    .replace(OUTPUT_ANCHOR, `
        vec3 skyC = max(texColor - sundiscColor, 0.0) * uGain;
        skyC /= 1.0 + dot(skyC, vec3(0.2126, 0.7152, 0.0722)) / uShoulder;
        gl_FragColor = vec4(skyC + sundiscColor * uGain * 0.004, 1.0);`);
}
