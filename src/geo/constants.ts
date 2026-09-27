const unit = (x: number, z: number) => { const l = Math.hypot(x, z); return [x / l, z / l] as const; };
/** Lower Río Grande de Loíza flows SW→NE (research §1.1). XZ, +X east, +Z south. */
export const RIVER_DIR = unit(1, -1);
/** ENE trade wind blows toward the WSW (research §1.3). XZ. */
export const WIND_DIR = unit(-1, 0.35);
/** Height of the water surface (the Reflector plane in scene/water/Water.tsx), m. */
export const WATER_Y = 0;
