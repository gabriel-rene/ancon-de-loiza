import type { CrossingTimings } from '../ancon/crossing';
import { crossingGeometry, waterAt, type CrossingGeometry, type XZ } from '../ancon/geometry';
import { landmarkXZ } from '../data/landmarks';
import { WATER, type WorldFields } from '../terrain/fields';
import { u01 } from './clock';

/** Spec 5 §1.1: every animal stays within this distance (m) of the crossing line. */
export const FRAME_RADIUS = 300;
/** Bank lines run ±BANK_HALF m along each bank from the landing, one sample per BANK_STEP m. */
export const BANK_HALF = 100, BANK_STEP = 2;
const BANK_N = Math.round((2 * BANK_HALF) / BANK_STEP) + 1;

export interface BankLine {
  /** 0 east (Loíza), 1 west. */
  side: 0 | 1;
  /** Unit XZ direction from the water onto this bank. */
  inland: XZ;
  /** x, y, z per sample k (u = −BANK_HALF + k·BANK_STEP): the waterline, 0.5 m onto land. NaN: no waterline found. */
  pts: Float32Array;
}
export interface FaunaSite {
  /** The 512 placement fields. */
  fields: WorldFields;
  geom: CrossingGeometry;
  /** Midpoint of the crossing line. */
  mid: XZ;
  /** Unit XZ across the crossing line (world direction of vessel-local +Z); also "along the banks". */
  lateral: XZ;
  /** +1 if the river mouth lies on the +lateral side of the crossing line. */
  mouthSide: 1 | -1;
  banks: [BankLine, BankLine];
  /** Pelican fishers' circles (centre, radius), all over the river. */
  fishers: { c: XZ; r: number }[];
  /** Manatee zone: a strip; centre, half-extent along the crossing (a, a multiple of 5 m) and across it (b). */
  manatee: { c: XZ; a: number; b: number };
  groundAt(x: number, z: number): number;
}
export interface FaunaWorld { site: FaunaSite; T: CrossingTimings; moored: boolean }

function buildBank(f: WorldFields, g: CrossingGeometry, lat: XZ, side: 0 | 1, groundAt: (x: number, z: number) => number): BankLine {
  const shore = side === 0 ? g.shoreEast : g.shoreWest, sg = side === 0 ? -1 : 1;
  const inland: XZ = [g.dir[0] * sg, g.dir[1] * sg];
  const pts = new Float32Array(BANK_N * 3).fill(NaN);
  for (let k = 0; k < BANK_N; k++) {
    const u = -BANK_HALF + k * BANK_STEP, bx = shore[0] + lat[0] * u, bz = shore[1] + lat[1] * u;
    let prev = waterAt(f, bx - inland[0] * 40, bz - inland[1] * 40);
    for (let t = -39.5; t <= 40; t += 0.5) {
      const x = bx + inland[0] * t, z = bz + inland[1] * t, c = waterAt(f, x, z);
      if (c === WATER.LAND && prev === WATER.RIVER) {
        const px = x + inland[0] * 0.5, pz = z + inland[1] * 0.5, y = Math.max(0, groundAt(px, pz));
        if (y <= 1.5 && waterAt(f, px, pz) === WATER.LAND) { pts[k * 3] = px; pts[k * 3 + 1] = y; pts[k * 3 + 2] = pz; }
        break;
      }
      prev = c;
    }
  }
  return { side, inland, pts };
}

const riverAll = (f: WorldFields, pts: number[]) => { for (let i = 0; i < pts.length; i += 2) if (waterAt(f, pts[i], pts[i + 1]) !== WATER.RIVER) return false; return true; };

/**
 * Fisher circles (spec 5 §2): fisher 0 near the east end (≈ 0.2 of the span) on the mouth side, fisher 1 near the
 * west end (≈ 0.8) on the other side, 40–60 m to the side, radius 12–18 m — ahead of the ride camera for the first
 * part of each leg, and every point of the circle ≥ 20 m from the crossing line, so dives stay clear of the ferry.
 */
export const FISHER_SITE = { at: [0.2, 0.8], jitter: 0.1, off: [40, 60] as [number, number], r: [12, 18] as [number, number] };
function findFisher(f: WorldFields, g: CrossingGeometry, lat: XZ, i: number, sideSign: number): { c: XZ; r: number } {
  const S = FISHER_SITE;
  for (let j = 0; j < 128; j++) {
    const along = (S.at[i] + (u01(i, j * 3, 61) - 0.5) * S.jitter) * g.span, off = sideSign * (S.off[0] + (S.off[1] - S.off[0]) * u01(i, j * 3 + 1, 61));
    const r = S.r[0] + (S.r[1] - S.r[0]) * u01(i, j * 3 + 2, 61);
    const cx = g.shoreEast[0] + g.dir[0] * along + lat[0] * off, cz = g.shoreEast[1] + g.dir[1] * along + lat[1] * off;
    const ring: number[] = [cx, cz];
    for (let a = 0; a < 32; a++) ring.push(cx + r * Math.cos((a * Math.PI) / 16), cz + r * Math.sin((a * Math.PI) / 16));
    if (riverAll(f, ring)) return { c: [cx, cz], r };
  }
  throw new Error(`fauna: no river circle for pelican fisher ${i}`);
}

/**
 * Manatee zone (spec 5 §2): a long thin strip on the mouth side, 25.5–29.5 m from the crossing line (inside the
 * approved 25–40 m, ≥ 20 m clear of the ferry and ropes; usually 40–100 m from the ferry), running along the crossing over most of the river width,
 * so a surfacing is often ahead of the ride camera. `a` (a multiple of
 * MANATEE_SITE.step) shrinks until the whole strip is river.
 */
export const MANATEE_SITE = { off: [25.5, 29.5] as [number, number], reach: 0.4, step: 5 };
function findManatee(f: WorldFields, g: CrossingGeometry, lat: XZ, mid: XZ, mouthSide: number): { c: XZ; a: number; b: number } {
  const S = MANATEE_SITE, off = (S.off[0] + S.off[1]) / 2 * mouthSide, b = (S.off[1] - S.off[0]) / 2;
  const c: XZ = [mid[0] + lat[0] * off, mid[1] + lat[1] * off];
  for (let a = Math.floor((S.reach * g.span) / S.step) * S.step; a >= 2 * S.step; a -= S.step) {
    const pts: number[] = [];
    for (let al = -a; al <= a; al += S.step) for (const la of [-b, 0, b]) pts.push(c[0] + g.dir[0] * al + lat[0] * la, c[1] + g.dir[1] * al + lat[1] * la);
    if (riverAll(f, pts)) return { c, a, b };
  }
  throw new Error('fauna: no river zone for the manatee');
}

/** Where animals may be, from the fixed 512 placement fields (never the tier's grid). */
export function faunaSite(f: WorldFields, groundAt: (x: number, z: number) => number): FaunaSite {
  const g = crossingGeometry(f);
  const lat: XZ = [-g.dir[1], g.dir[0]];
  const mid: XZ = [(g.shoreEast[0] + g.shoreWest[0]) / 2, (g.shoreEast[1] + g.shoreWest[1]) / 2];
  const [mx, mz] = landmarkXZ('mouth');
  const mouthSide: 1 | -1 = (mx - mid[0]) * lat[0] + (mz - mid[1]) * lat[1] >= 0 ? 1 : -1;
  return {
    fields: f, geom: g, mid, lateral: lat, mouthSide,
    banks: [buildBank(f, g, lat, 0, groundAt), buildBank(f, g, lat, 1, groundAt)],
    fishers: [findFisher(f, g, lat, 0, mouthSide), findFisher(f, g, lat, 1, -mouthSide)],
    manatee: findManatee(f, g, lat, mid, mouthSide),
    groundAt,
  };
}

const sampleOk = (b: BankLine, k: number) => k >= 0 && k < BANK_N && !Number.isNaN(b.pts[k * 3]);
export const bankValid = (b: BankLine, u: number) => sampleOk(b, Math.round((u + BANK_HALF) / BANK_STEP));

/** Waterline point at along-bank offset u: linear between the two neighbouring samples, else the nearer valid one. */
export function bankAt(b: BankLine, u: number, out: number[]): boolean {
  const s = (u + BANK_HALF) / BANK_STEP, k0 = Math.floor(s), t = s - k0, ok0 = sampleOk(b, k0), ok1 = sampleOk(b, k0 + 1);
  if (ok0 && ok1) {
    for (let c = 0; c < 3; c++) out[c] = b.pts[k0 * 3 + c] + (b.pts[(k0 + 1) * 3 + c] - b.pts[k0 * 3 + c]) * t;
    return true;
  }
  const k = ok0 ? k0 : ok1 ? k0 + 1 : -1;
  if (k < 0) return false;
  for (let c = 0; c < 3; c++) out[c] = b.pts[k * 3 + c];
  return true;
}

/** XZ distance from (x, z) to the crossing line segment shoreEast–shoreWest. */
export function distToCrossing(site: FaunaSite, x: number, z: number): number {
  const g = site.geom, ax = g.shoreEast[0], az = g.shoreEast[1];
  const t = Math.max(0, Math.min(g.span, (x - ax) * g.dir[0] + (z - az) * g.dir[1]));
  return Math.hypot(x - (ax + g.dir[0] * t), z - (az + g.dir[1] * t));
}
