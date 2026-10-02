/** One keyboard look step (spec 7b §2.1), camera-controls terms: azimuth and polar in radians; dZoom +1 in, −1 out. */
export interface LookStep { dAz: number; dPol: number; dZoom: number }

/** Per key press: 10° turn, 6° tilt, 10 % zoom or dolly. Holding a key repeats through the browser's key repeat. */
export const LOOK_STEP = { az: (10 * Math.PI) / 180, pol: (6 * Math.PI) / 180, zoom: 0.1 };

const step = (dAz: number, dPol: number, dZoom: number): LookStep => ({ dAz, dPol, dZoom });
// A lower azimuth turns the picture right; a higher polar angle (camera lower) tilts it up.
const KEYS: Readonly<Record<string, LookStep>> = {
  ArrowLeft: step(LOOK_STEP.az, 0, 0), ArrowRight: step(-LOOK_STEP.az, 0, 0),
  ArrowUp: step(0, LOOK_STEP.pol, 0), ArrowDown: step(0, -LOOK_STEP.pol, 0),
  '+': step(0, 0, 1), '=': step(0, 0, 1), '-': step(0, 0, -1), _: step(0, 0, -1),
};

/** The look step for a key press on the focused scene, or null. */
export function lookKey(e: { key: string; altKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }): LookStep | null {
  if (e.altKey || e.metaKey || e.ctrlKey) return null;
  return Object.hasOwn(KEYS, e.key) ? KEYS[e.key] : null;
}
