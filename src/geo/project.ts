export const ORIGIN = { lat: 18.43485, lon: -65.8823 } as const;
const R = 6378137;
const D = Math.PI / 180;
const COS0 = Math.cos(ORIGIN.lat * D);

/** WGS84 lat/lon → local metres. +X east, +Z south. */
export function project(lat: number, lon: number): [number, number] {
  return [(lon - ORIGIN.lon) * D * R * COS0, -(lat - ORIGIN.lat) * D * R];
}

export function unproject(x: number, z: number): [number, number] {
  return [ORIGIN.lat - z / (D * R), ORIGIN.lon + x / (D * R * COS0)];
}
