import * as THREE from 'three';
import type { XZ } from '../data/geo/types';
import type { GroundAt } from './parts';
import type { StoryRoad } from './roads';

/** Strip height above the terrain (plus a polygon offset in the material), sample step and texture repeat (m). */
export const ROAD_LIFT = 0.05, ROAD_STEP = 2, ROAD_V = 4;

export function resample(points: readonly XZ[], step = ROAD_STEP): XZ[] {
  const out: XZ[] = [points[0]];
  for (let k = 0; k + 1 < points.length; k++) {
    const [ax, az] = points[k], [bx, bz] = points[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let s = 1; s <= n; s++) out.push([ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n]);
  }
  return out;
}

/** The longest run of consecutive resampled points on land (a landing road ends at the river). */
export function clipToLand(points: readonly XZ[], landAt: (x: number, z: number) => boolean): XZ[] {
  const r = resample(points);
  let best: XZ[] = [], cur: XZ[] = [];
  for (const p of r) {
    if (landAt(p[0], p[1])) { cur.push(p); if (cur.length > best.length) best = cur; } else cur = [];
  }
  return best;
}

/** One strip per story road, draped on the ground: u across (0..1), v along (m / ROAD_V). */
export function buildRoadStrip(roads: readonly StoryRoad[], groundAt: GroundAt, landAt: (x: number, z: number) => boolean) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const road of roads) {
    const pts = clipToLand(road.points, landAt);
    if (pts.length < 2) continue;
    const base = pos.length / 3, h = road.width / 2;
    let v = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l, [x, z] = pts[i];
      if (i > 0) v += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
      for (const s of [1, -1]) {
        const px = x + nx * h * s, pz = z + nz * h * s;
        pos.push(px, groundAt(px, pz) + ROAD_LIFT, pz);
        uv.push(s > 0 ? 0 : 1, v / ROAD_V);
      }
      if (i > 0) { const q = base + 2 * i; idx.push(q - 2, q, q - 1, q - 1, q, q + 1); }
    }
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
