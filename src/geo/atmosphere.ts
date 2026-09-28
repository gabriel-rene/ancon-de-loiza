export type RGB = [number, number, number];
export interface Atmosphere {
  sunColor: RGB; sunIntensity: number; fogColor: RGB; fogDensity: number;
  /** Haze colour looking away from the sun (cooler: blue-lavender at golden hour). */
  fogAway: RGB;
  envIntensity: number; turbidity: number; rayleigh: number; mie: number; mieG: number;
  /** Horizon haze laid over the sky dome (0..1). */
  skyHaze: number;
  /** Haze mixed into the water's (un-fogged) mirror reflection (0..1). */
  reflectionHaze: number;
  /** Output gain on the Preetham sky (balances sky vs sunlit ground). */
  skyGain: number;
  /** Trade-wind cumulus coverage for the sky shader's cloud layer (0..1). */
  cloudCoverage: number;
  /** Pre-tonemap exposure multiplier. */
  exposure: number;
  /** Post-tonemap-input white balance (RGB gain), fed to GradeEffect. Warm at golden hour, near-neutral at high sun. */
  balance: RGB;
  /** Post-tonemap-input saturation multiplier, fed to GradeEffect. Higher at golden hour, lower at high sun. */
  saturation: number;
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
  const high = smooth(3, 35, elevation);         // 0 golden → 1 high sun
  const sunColor = mix([1.0, 0.56, 0.26], [1.0, 0.93, 0.84], high);
  const fogDay = mix([1.15, 0.74, 0.38], [0.85, 0.84, 0.83], high);
  const fogColor = mix([0.05, 0.06, 0.09], fogDay, day);
  const fogAway = mix([0.04, 0.05, 0.09], mix([0.5, 0.52, 0.66], [0.78, 0.78, 0.8], high), day);
  return {
    sunColor,
    sunIntensity: elevation <= -2 ? 0 : lerp(0.0, 1.0, day) * lerp(3.8, 3.4, high),
    fogColor,
    fogAway,
    fogDensity: lerp(0.00042, 0.00016, high),
    envIntensity: lerp(0.1, lerp(1.1, 0.75, high), day),
    turbidity: lerp(7, 4, high),
    rayleigh: lerp(2.2, 1.2, high),
    mie: lerp(0.008, 0.004, high),
    mieG: lerp(0.8, 0.86, high),
    skyHaze: lerp(0.88, 0.4, high),
    reflectionHaze: lerp(0.3, 0.12, high),
    skyGain: lerp(0.45, 0.6, high),
    cloudCoverage: 0.3,
    exposure: lerp(0.9, 0.85, high),
    balance: mix([1.06, 1.0, 0.9], [1.09, 1.0, 0.91], high),
    saturation: lerp(1.15, 1.12, high),
  };
}
