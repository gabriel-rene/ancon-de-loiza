export type RGB = [number, number, number];
export interface Atmosphere {
  sunColor: RGB; sunIntensity: number; fogColor: RGB; fogDensity: number;
  envIntensity: number; turbidity: number; rayleigh: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Tropical coastal atmosphere as a function of sun elevation (degrees). Linear-space colours. */
export function atmosphereFor(elevation: number): Atmosphere {
  const day = smooth(-4, 2, elevation);          // 0 night → 1 day
  const high = smooth(4, 35, elevation);         // 0 golden → 1 high sun
  const sunColor = mix([1.0, 0.42, 0.16], [1.0, 0.93, 0.84], high);
  const fogDay = mix([0.95, 0.66, 0.42], [0.62, 0.72, 0.82], high);
  const fogColor = mix([0.05, 0.06, 0.09], fogDay, day);
  return {
    sunColor,
    sunIntensity: elevation <= -2 ? 0 : lerp(0.0, 1.0, day) * lerp(2.2, 3.4, high),
    fogColor,
    fogDensity: lerp(0.0011, 0.00045, high),
    envIntensity: lerp(0.08, lerp(0.55, 0.8, high), day),
    turbidity: lerp(9, 5, high),
    rayleigh: lerp(2.6, 1.4, high),
  };
}
