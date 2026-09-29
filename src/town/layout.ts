import type { GeoBundle, XZ } from '../data/geo/types';
import { corners, toWorld, type Footprint } from '../infrastructure/parts';
import { LANDING_CLEARING } from '../vegetation/masks';
import { cellRng } from '../vegetation/rng';
import { CIRCLE_R } from './constants';

/**
 * Phase 4b lots (spec 4b §2): every OSM outline in the town circle becomes an oriented rectangle, drops out
 * if it touches the landing clearing, a road or the bridge corridor (exact rectangle tests), the plaza or the church, and gets a fixed
 * rank (distance to the church + jitter) and fixed random numbers. Lots never depend on the era, so a house
 * keeps its place, rank and look progression in every era.
 */
export const CHURCH_WAY = '430399958';   // building=church, Iglesia de San Patricio [S14][S26]
export const PLAZA_WAY = '429703572';    // leisure=park, Plaza Don Ricardo Sanjurjo [S26]
/** Half sizes (m) per look, rank jitter (m), gap between lots (m), church reach past its nave sides (buttresses + 1.4 m, church.ts) (m). Inferred (L). */
export const LOT = {
  wood: { hx: [2.5, 4.5], hz: [2, 3.5] }, concrete: { hx: [3, 7], hz: [2.5, 6] },
  jitter: 40, gap: 1, churchReach: 3,
} as const;

export interface Lot {
  id: string;
  /** Lower = shown earlier. */
  rank: number;
  /** Fixed 0..1: picks the look (spec 4b §2 "Which look"). */
  u: number;
  /** Fixed 0..1: picks the paint. */
  p: number;
  outline: Footprint; wood: Footprint; concrete: Footprint;
}
export interface LotRules {
  centre: XZ; church: XZ;
  /** Centre of the east landing's plant-free clearing (radius LANDING_CLEARING[0]); the 4a station stands inside it. */
  clear: XZ;
  /** Polylines a lot must not touch; the bridge corridor is passed here too (half = width / 2 + margin). */
  roads: { points: readonly XZ[]; half: number }[];
}
export interface ChurchPlan { fp: Footprint; front: 1 | -1 }

/** World → footprint-local (x, z); inverse of parts.toWorld. */
export function toLocal(f: Footprint, x: number, z: number): [number, number] {
  const c = Math.cos(f.yaw), s = Math.sin(f.yaw), dx = x - f.c[0], dz = z - f.c[1];
  return [c * dx - s * dz, s * dx + c * dz];
}

/** Bounding rectangle aligned with the ring's longest edge; hx ≥ hz. */
export function orientedBox(ring: readonly XZ[]): Footprint {
  let best = 0, ux = 1, uz = 0;
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k], b = ring[(k + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    if (l > best) { best = l; ux = dx / l; uz = dz / l; }
  }
  const along = ring.map(([x, z]) => x * ux + z * uz), across = ring.map(([x, z]) => -x * uz + z * ux);
  const a0 = Math.min(...along), a1 = Math.max(...along), v0 = Math.min(...across), v1 = Math.max(...across);
  const ca = (a0 + a1) / 2, cv = (v0 + v1) / 2;
  let hx = (a1 - a0) / 2, hz = (v1 - v0) / 2, yaw = Math.atan2(-uz, ux);
  if (hz > hx) { [hx, hz] = [hz, hx]; yaw += Math.PI / 2; }
  return { c: [ca * ux - cv * uz, ca * uz + cv * ux], yaw, hx, hz };
}

/** Separating-axis test; both rectangles grown by `pad` on every side. */
export function rectsOverlap(a: Footprint, b: Footprint, pad = 0): boolean {
  const ca = corners(a, pad), cb = corners(b, pad);
  for (const f of [a, b]) for (const [ax, az] of [[Math.cos(f.yaw), -Math.sin(f.yaw)], [Math.sin(f.yaw), Math.cos(f.yaw)]]) {
    const pa = ca.map(([x, z]) => x * ax + z * az), pb = cb.map(([x, z]) => x * ax + z * az);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}

export function inRing(ring: readonly XZ[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function distToLine(pts: readonly XZ[], x: number, z: number): number {
  let d = Infinity;
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2));
    d = Math.min(d, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return d;
}

export const centroid = (ring: readonly XZ[]): XZ =>
  [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));
function fit(o: Footprint, r: { hx: readonly [number, number]; hz: readonly [number, number] }): Footprint {
  const hx = clamp(o.hx, r.hx);
  return { c: o.c, yaw: o.yaw, hx, hz: Math.min(hx, clamp(o.hz, r.hz)) };
}
const segsCross = (a: XZ, b: XZ, c: XZ, d: XZ) => {
  const o = (p: XZ, q: XZ, r: XZ) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};
const distToSeg = (a: XZ, b: XZ, x: number, z: number) => distToLine([a, b], x, z);
/** Distance from a footprint rectangle to a polyline; 0 if any segment crosses or lies inside it. */
export function rectLineDist(f: Footprint, pts: readonly XZ[]): number {
  const cs = corners(f) as XZ[], loc = pts.map(([x, z]) => toLocal(f, x, z));
  const boxDist = ([lx, lz]: [number, number]) => Math.hypot(Math.max(Math.abs(lx) - f.hx, 0), Math.max(Math.abs(lz) - f.hz, 0));
  let d = Infinity;
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k], b = pts[k + 1];
    if (boxDist(loc[k]) === 0 || boxDist(loc[k + 1]) === 0 || cs.some((c, i) => segsCross(a, b, c, cs[(i + 1) % 4]))) return 0;
    d = Math.min(d, boxDist(loc[k]), boxDist(loc[k + 1]), ...cs.map(([x, z]) => distToSeg(a, b, x, z)));
  }
  return d;
}
/** Does the rectangle overlap the polygon (corner in ring, vertex in rectangle, or edges crossing)? */
export function rectRingOverlap(f: Footprint, ring: readonly XZ[]): boolean {
  const cs = corners(f) as XZ[];
  if (cs.some(([x, z]) => inRing(ring, x, z))) return true;
  if (ring.some(([x, z]) => { const [lx, lz] = toLocal(f, x, z); return Math.abs(lx) <= f.hx && Math.abs(lz) <= f.hz; })) return true;
  return cs.some((c, i) => ring.some((r, k) => segsCross(c, cs[(i + 1) % 4], r, ring[(k + 1) % ring.length])));
}
/** Distance from a point to the rectangle (0 inside). */
const distToRect = (f: Footprint, x: number, z: number) => {
  const [lx, lz] = toLocal(f, x, z);
  return Math.hypot(Math.max(Math.abs(lx) - f.hx, 0), Math.max(Math.abs(lz) - f.hz, 0));
};

function outline(geo: GeoBundle, list: 'buildings' | 'parks', id: string) {
  const o = geo[list].find((b) => b.id === id);
  if (!o) throw new Error(`OSM way ${id} missing from loiza.json ${list}`);
  return o;
}
export const plazaRing = (geo: GeoBundle) => outline(geo, 'parks', PLAZA_WAY).ring;
export function churchPlan(geo: GeoBundle): ChurchPlan {
  const fp = orientedBox(outline(geo, 'buildings', CHURCH_WAY).ring), [px, pz] = centroid(plazaRing(geo));
  return { fp, front: toLocal(fp, px, pz)[0] >= 0 ? 1 : -1 };
}
/** The church's whole reach: nave, front with its bell gable (+1 m) and the buttresses on the sides (church.ts). */
export const churchReach = (p: ChurchPlan): Footprint => ({ ...p.fp, hx: p.fp.hx + 1, hz: p.fp.hz + LOT.churchReach });

export function townLots(geo: GeoBundle, r: LotRules): Lot[] {
  const church = churchReach(churchPlan(geo)), plaza = plazaRing(geo);
  const blocked = (f: Footprint) =>
    rectsOverlap(f, church, LOT.gap / 2) || distToRect(f, r.clear[0], r.clear[1]) <= LANDING_CLEARING[0] ||
    rectRingOverlap(f, plaza) || r.roads.some((rd) => rectLineDist(f, rd.points) <= rd.half);
  const cands: Lot[] = [];
  for (const b of geo.buildings) {
    if (b.id === CHURCH_WAY) continue;
    const o = orientedBox(b.ring);
    if (Math.hypot(o.c[0] - r.centre[0], o.c[1] - r.centre[1]) > CIRCLE_R) continue;
    const concrete = fit(o, LOT.concrete);
    if (blocked(concrete)) continue;
    const n = Number(b.id) || b.id.length, rng = cellRng(n % 65536, Math.floor(n / 65536), 4401);
    const rank = Math.hypot(o.c[0] - r.church[0], o.c[1] - r.church[1]) + LOT.jitter * rng();
    cands.push({ id: b.id, rank, u: rng(), p: rng(), outline: o, wood: fit(o, LOT.wood), concrete });
  }
  cands.sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1));
  // Overlaps use the concrete (largest) size, so a lot never disappears when its house turns concrete.
  const kept: Lot[] = [];
  for (const l of cands) if (!kept.some((k) => rectsOverlap(k.concrete, l.concrete, LOT.gap / 2))) kept.push(l);
  return kept;
}
