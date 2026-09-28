import { LANDCLS, sampleField, WATER, type WorldFields } from '../../terrain/fields';
import type { VegMasks } from '../masks';
import { siteAt } from '../placement';
import { hash3 } from '../rng';
import type { PlantInstance, Site } from '../types';

/*
 * Coconut farm blocks (phase 2c, spec §2): planted groves on the flat sand behind the beach, the
 * coast's shift from sugar to coconut [S23]. 3–6 rectangles of 120 × 80 m, long side along the
 * coast, palms in straight rows 8 m apart. All numbers inferred.
 */

export const ROW = 8;
const HALF_L = 60, HALF_W = 40, LATTICE = 40, MIN_GAP = 200, MAX_BLOCKS = 6, SAMPLE = 20, SEED = 1901;
const u01 = (i: number, j: number, s: number) => hash3(i, j, s) / 4294967296;

export interface Block { cx: number; cz: number; ux: number; uz: number; halfL: number; halfW: number }

/** Spec 2c §2: dry, low land 60–400 m from the sea, ≥ 40 m from the river, clear of roads, town and landings. */
export function blockSiteOk(s: Site | null): boolean {
  return !!s && s.water === WATER.LAND && s.seaDist >= 60 && s.seaDist <= 400 && s.height < 3
    && s.landCls !== LANDCLS.WETLAND && s.riverDist >= 40 && s.roadDist >= 10 && s.town < 0.05 && s.clear === 0;
}

const at = (b: Block, a: number, c: number): [number, number] => [b.cx + a * b.ux - c * b.uz, b.cz + a * b.uz + c * b.ux];

export function findBlocks(f: WorldFields, m: VegMasks): Block[] {
  const g = f.grid, ext = g.cell * g.size, n = Math.floor(ext / LATTICE);
  const cands: { b: Block; r: number }[] = [];
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
    const cx = g.minX + i * LATTICE, cz = g.minZ + j * LATTICE;
    if (!blockSiteOk(siteAt(f, m, cx, cz))) continue;
    // Across-coast axis = seaDist gradient (points inland); the long side runs along the coast.
    const gx = sampleField(f, f.seaDist, cx + 20, cz) - sampleField(f, f.seaDist, cx - 20, cz);
    const gz = sampleField(f, f.seaDist, cx, cz + 20) - sampleField(f, f.seaDist, cx, cz - 20);
    const gl = Math.hypot(gx, gz);
    if (gl < 1e-3) continue;
    const b: Block = { cx, cz, ux: -gz / gl, uz: gx / gl, halfL: HALF_L, halfW: HALF_W };
    let ok = true;
    for (let a = -HALF_L; a <= HALF_L && ok; a += SAMPLE) for (let c = -HALF_W; c <= HALF_W; c += SAMPLE)
      if (!blockSiteOk(siteAt(f, m, ...at(b, a, c)))) { ok = false; break; }
    if (ok) cands.push({ b, r: u01(i, j, SEED) });
  }
  cands.sort((p, q) => p.r - q.r);
  const out: Block[] = [];
  for (const { b } of cands) {
    if (out.length >= MAX_BLOCKS) break;
    if (out.every((o) => Math.hypot(o.cx - b.cx, o.cz - b.cz) >= MIN_GAP)) out.push(b);
  }
  return out;
}

export function plantBlocks(f: WorldFields, blocks: Block[], survival: number): PlantInstance[] {
  const out: PlantInstance[] = [];
  if (survival <= 0) return out;
  const na = Math.round((2 * HALF_L - 8) / ROW) + 1, nc = Math.round((2 * HALF_W - 8) / ROW) + 1; // 15 × 10
  blocks.forEach((b, bi) => {
    for (let ia = 0; ia < na; ia++) for (let ic = 0; ic < nc; ic++) {
      const h = (s: number) => u01(bi * 64 + ia, ic, SEED + s);
      if (h(1) >= survival) continue;
      const a = -HALF_L + 4 + ia * ROW + (h(2) - 0.5) * 0.8, c = -HALF_W + 4 + ic * ROW + (h(3) - 0.5) * 0.8;
      const [x, z] = at(b, a, c);
      out.push({ x, y: sampleField(f, f.height, x, z), z, rot: (2 * h(4) - 1) * 0.3, scale: 0.9 + 0.2 * h(5), variant: Math.floor(h(6) * 3) });
    }
  });
  return out;
}

export function insideBlocks(blocks: Block[]) {
  return (x: number, z: number) => blocks.some((b) => {
    const dx = x - b.cx, dz = z - b.cz;
    return Math.abs(dx * b.ux + dz * b.uz) <= b.halfL && Math.abs(-dx * b.uz + dz * b.ux) <= b.halfW;
  });
}
