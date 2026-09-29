import type { RoadSurface } from '../data/eras';
import type { XZ } from '../data/geo/types';
import type { EraRoads } from './roads';

/** An oriented rectangle of trodden dirt (landings, dooryards, the bare lot of a demolished house). */
export interface DirtPatch { c: XZ; axis: XZ; hu: number; hv: number }
/** 1024² over the 2560 m near extent (2.5 m texels); soft edge and story-road shoulder in metres. */
export const MASK = { size: 1024, extent: 2560, soft: 1.25, shoulder: 1.5 } as const;
export interface GroundMask { data: Uint8Array; size: number; rect: [number, number, number] }
export const SURFACE_INDEX: Record<RoadSurface, number> = { sand: 0, gravel: 1, asphalt: 2 };

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const CELL = MASK.extent / MASK.size, MIN = -MASK.extent / 2;

function stamp(data: Uint8Array, ch: number, x0: number, z0: number, x1: number, z1: number, weight: (x: number, z: number) => number) {
  const i0 = Math.max(0, Math.floor((x0 - MIN) / CELL)), i1 = Math.min(MASK.size - 1, Math.ceil((x1 - MIN) / CELL));
  const j0 = Math.max(0, Math.floor((z0 - MIN) / CELL)), j1 = Math.min(MASK.size - 1, Math.ceil((z1 - MIN) / CELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const w = weight(MIN + (i + 0.5) * CELL, MIN + (j + 0.5) * CELL);
    if (w <= 0) continue;
    const k = (j * MASK.size + i) * 4 + ch;
    data[k] = Math.max(data[k], Math.round(w * 255));
  }
}

function segment(data: Uint8Array, [ax, az]: XZ, [bx, bz]: XZ, half: number) {
  const soft = Math.min(MASK.soft, half), r = half + soft, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
  stamp(data, 0, Math.min(ax, bx) - r, Math.min(az, bz) - r, Math.max(ax, bx) + r, Math.max(az, bz) + r, (x, z) => {
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
    return 1 - smooth(half - soft, half + soft, Math.hypot(x - ax - t * dx, z - az - t * dz));
  });
}

/** R: road weight (story roads with a shoulder, main roads and paths); G: trodden dirt. */
export function groundMask(roads: EraRoads, dirt: readonly DirtPatch[]): GroundMask {
  const data = new Uint8Array(MASK.size * MASK.size * 4);
  for (let k = 3; k < data.length; k += 4) data[k] = 255;
  const lines = [
    ...roads.story.map((r) => ({ pts: r.points, half: r.width / 2 + MASK.shoulder })),
    ...roads.simple.map((r) => ({ pts: r.points, half: r.width / 2 })),
  ];
  for (const l of lines) for (let k = 0; k + 1 < l.pts.length; k++) segment(data, l.pts[k], l.pts[k + 1], l.half);
  for (const d of dirt) {
    const r = Math.hypot(d.hu, d.hv) + MASK.soft, [ux, uz] = d.axis;
    stamp(data, 1, d.c[0] - r, d.c[1] - r, d.c[0] + r, d.c[1] + r, (x, z) => {
      const px = x - d.c[0], pz = z - d.c[1], u = px * ux + pz * uz, v = -px * uz + pz * ux;
      return 1 - smooth(-MASK.soft, MASK.soft, Math.max(Math.abs(u) - d.hu, Math.abs(v) - d.hv));
    });
  }
  return { data, size: MASK.size, rect: [MIN, MIN, MASK.extent] };
}
