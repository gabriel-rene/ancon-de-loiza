/**
 * One painted texture for every sign and lettered wall of the 1975–86 station (the `sign` material). Pure:
 * the regions are shared by the painter (textures.ts, browser) and the geometry (station.ts, tests).
 * Pixel rectangles on an ATLAS.w × ATLAS.h canvas, y down; `regionUv` turns one into three.js UVs (flipY).
 */
export const ATLAS = { w: 2048, h: 1024 } as const;
export type SignRegion = 'loiza' | 'barFront' | 'barRest' | 'hielo' | 'paseos' | 'stripes';
/** [x, y, w, h] px. The sign crops the SVG's panel (y 30–170 of 200), so its aspect is 926:140. */
export const REGIONS: Record<SignRegion, [number, number, number, number]> = {
  loiza: [0, 0, 2048, 310],
  barFront: [0, 330, 2048, 230],
  barRest: [0, 580, 1024, 160],
  hielo: [1044, 580, 480, 160],
  paseos: [1544, 580, 504, 210],
  stripes: [0, 800, 512, 128],
};
/** Width / height of a region, so a plane can be sized to show it undistorted. */
export const regionAspect = (r: SignRegion) => REGIONS[r][2] / REGIONS[r][3];
/** [u0, v0, u1, v1]: left, bottom, right, top. */
export function regionUv(r: SignRegion): [number, number, number, number] {
  const [x, y, w, h] = REGIONS[r];
  return [x / ATLAS.w, 1 - (y + h) / ATLAS.h, (x + w) / ATLAS.w, 1 - y / ATLAS.h];
}
