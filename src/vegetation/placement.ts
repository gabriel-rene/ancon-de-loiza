import { sampleField, type WorldFields } from '../terrain/fields';
import type { Grid } from '../terrain/raster';
import type { VegMasks } from './masks';
import { CellStream } from './rng';
import { PLACEMENT_ORDER, RULES } from './rules';
import type { PlantInstance, Site, SpeciesId, WoodyId } from './types';

export class Occupancy {
  private cells: Uint8Array; private n: number;
  constructor(private grid: Grid, private cell = 1) {
    this.n = Math.ceil((grid.cell * grid.size) / cell);
    this.cells = new Uint8Array(this.n * this.n);
  }
  private each(x: number, z: number, r: number, fn: (k: number) => boolean | void) {
    const c = this.cell, i0 = Math.floor((x - r - this.grid.minX) / c), i1 = Math.floor((x + r - this.grid.minX) / c);
    const j0 = Math.floor((z - r - this.grid.minZ) / c), j1 = Math.floor((z + r - this.grid.minZ) / c);
    for (let j = Math.max(0, j0); j <= Math.min(this.n - 1, j1); j++)
      for (let i = Math.max(0, i0); i <= Math.min(this.n - 1, i1); i++) {
        const cx = this.grid.minX + (i + 0.5) * c, cz = this.grid.minZ + (j + 0.5) * c;
        if (Math.hypot(cx - x, cz - z) <= r && fn(j * this.n + i) === false) return false;
      }
    return true;
  }
  free(x: number, z: number, r: number) { return this.each(x, z, r, (k) => this.cells[k] === 0) !== false; }
  mark(x: number, z: number, r: number) { this.each(x, z, r, (k) => { this.cells[k] = 1; }); }
}

export function siteAt(f: WorldFields, m: VegMasks, x: number, z: number): Site | null {
  const g = f.grid, i = Math.floor((x - g.minX) / g.cell), j = Math.floor((z - g.minZ) / g.cell);
  if (i < 0 || j < 0 || i >= g.size || j >= g.size) return null;
  const k = j * g.size + i;
  const h = sampleField(f, f.height, x, z);
  return { water: f.water[k], depth: Math.max(0, -h), shore: f.shore[k], seaDist: f.seaDist[k], riverDist: m.riverDist[k],
    roadDist: m.roadDist[k], height: h, landCls: f.landCls[k], town: m.town[k], clear: m.clear[k] };
}

const _noise = new CellStream(), _cand = new CellStream();

/** Smooth value noise in [0, 1] on a lattice of `scale` metres (deterministic in `seed`). */
export function valueNoise(x: number, z: number, scale: number, seed: number) {
  const fx = x / scale, fz = z / scale, i = Math.floor(fx), j = Math.floor(fz);
  const u = fx - i, v = fz - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const h = (a: number, b: number) => _noise.reset(a, b, seed).next();
  const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1);
  return (a + (b - a) * su) * (1 - sv) + (c + (d - c) * su) * sv;
}

/** Candidate jitter as a fraction of the spacing (> 1 lets neighbours' candidates overlap; occupancy sorts it out). */
const JITTER = 1.3;

/**
 * Per field cell: 1 where the species' habitat density is > 0 at that cell's centre or at any
 * of its 8 neighbours' centres. Lets the candidate loop reject most of the map with one lookup
 * (only the thin habitat bands pay for a full site sample). Cached per (fields, masks, species).
 */
const habitatCache = new WeakMap<WorldFields, WeakMap<VegMasks, Partial<Record<SpeciesId, Uint8Array>>>>();
/** The cached habitat mask; with `build` false, only what is already cached (undefined if none). */
export function habitatMask(f: WorldFields, m: VegMasks, species: SpeciesId, build?: true): Uint8Array;
export function habitatMask(f: WorldFields, m: VegMasks, species: SpeciesId, build: false): Uint8Array | undefined;
export function habitatMask(f: WorldFields, m: VegMasks, species: SpeciesId, build = true): Uint8Array | undefined {
  let byMask = habitatCache.get(f);
  if (!byMask) { byMask = new WeakMap(); habitatCache.set(f, byMask); }
  let bySp = byMask.get(m);
  if (!bySp) { bySp = {}; byMask.set(m, bySp); }
  const hit = bySp[species];
  if (hit || !build) return hit;
  const g = f.grid, n = g.size, rule = RULES[species], ok = new Uint8Array(n * n), out = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const s = siteAt(f, m, g.minX + (i + 0.5) * g.cell, g.minZ + (j + 0.5) * g.cell);
    if (s && rule.density(s) > 0) ok[j * n + i] = 1;
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let v = 0;
    for (let dj = -1; dj <= 1 && !v; dj++) for (let di = -1; di <= 1; di++) {
      const a = i + di, b = j + dj;
      if (a >= 0 && b >= 0 && a < n && b < n && ok[b * n + a]) { v = 1; break; }
    }
    out[j * n + i] = v;
  }
  bySp[species] = out;
  return out;
}

/** Build the habitat masks of `species` now (e.g. ground cover's, outside the frame loop). */
export function warmHabitat(f: WorldFields, m: VegMasks, species: readonly SpeciesId[]) {
  for (const s of species) habitatMask(f, m, s);
}

export interface PlaceOpts {
  density: number; seed: number; occupancy?: Occupancy;
  /** Multiplies the species' spacing (coarser candidate grid, e.g. for the distant ring). */
  spacingMul?: number;
  /** Candidates for which this returns true are skipped before any site lookup. */
  skip?: (x: number, z: number) => boolean;
  /** Only candidates whose final position lies in [minX, maxX) × [minZ, maxZ). Same result as filtering a whole-map run. */
  bounds?: [number, number, number, number];
  /** Read-only occupancy: candidates whose `radius` disc touches a marked cell are rejected (ground cover vs trunks). */
  blocked?: Occupancy;
}

export function placeSpecies(f: WorldFields, m: VegMasks, species: SpeciesId, opts: PlaceOpts): PlantInstance[] {
  const rule = RULES[species], g = f.grid, sp = rule.spacing * (opts.spacingMul ?? 1), extent = g.cell * g.size;
  const n = Math.floor(extent / sp), out: PlantInstance[] = [];
  const salt = species.length * 7919 + species.charCodeAt(0);
  const { scale: cs, strength: cstr, size: csize, octave, gap, coverage } = rule.clump;
  const noiseSeed = opts.seed * 977 + salt;
  const hab = habitatMask(f, m, species);
  const b = opts.bounds;
  const i0 = b ? Math.max(0, Math.floor((b[0] - g.minX) / sp) - 1) : 0, i1 = b ? Math.min(n - 1, Math.floor((b[2] - g.minX) / sp) + 1) : n - 1;
  const j0 = b ? Math.max(0, Math.floor((b[1] - g.minZ) / sp) - 1) : 0, j1 = b ? Math.min(n - 1, Math.floor((b[3] - g.minZ) / sp) + 1) : n - 1;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const r = _cand.reset(i, j, opts.seed * 131 + salt);
    const x = g.minX + (i + 0.5 + JITTER * (r.next() - 0.5)) * sp, z = g.minZ + (j + 0.5 + JITTER * (r.next() - 0.5)) * sp;
    const accept = r.next(), rot = (2 * r.next() - 1) * rule.rot, sc = r.next(), variant = Math.floor(r.next() * rule.variants);
    if (b && (x < b[0] || x >= b[2] || z < b[1] || z >= b[3])) continue;
    const gi = Math.floor((x - g.minX) / g.cell), gj = Math.floor((z - g.minZ) / g.cell);
    if (gi < 0 || gj < 0 || gi >= g.size || gj >= g.size || !hab[gj * g.size + gi]) continue;
    if (opts.skip?.(x, z)) continue;
    const s = siteAt(f, m, x, z);
    if (!s) continue;
    const d = rule.density(s) * opts.density * (1 - s.clear);
    if (d <= 0) continue;
    let cn = valueNoise(x, z, cs, noiseSeed);
    if (octave) cn = Math.min(1, Math.max(0, cn * (0.6 + 0.8 * valueNoise(x, z, cs / 3, noiseSeed + 17))));
    let acceptProb: number;
    if (coverage) {
      // Grove coverage: the *area fraction* that is grove scales with d (task-9 R11), not the
      // acceptance rate inside it — so low-density habitat still produces dense little clusters
      // with real open ground between them, instead of a uniformly thinned scatter.
      const cutoff = 1 - Math.min(1, d * coverage.k);
      acceptProb = cn > cutoff ? Math.min(1, coverage.groveDensity) : 0;
    } else if (gap !== undefined) {
      // Threshold-shaped: real zero-acceptance gaps below the cut, dense groves above it. `strength`
      // sets the transition's sharpness (higher = narrower, more binary gap-vs-grove edge).
      const w = Math.max(0.03, 0.5 * (1 - cstr) + 0.05);
      const t = Math.min(1, Math.max(0, (cn - (gap - w)) / (2 * w)));
      acceptProb = d * (t * t * (3 - 2 * t));
    } else {
      acceptProb = d * (1 - cstr + 2 * cstr * cn);
    }
    if (accept >= acceptProb) continue;
    if (opts.occupancy && !opts.occupancy.free(x, z, rule.radius)) continue;
    if (opts.blocked && !opts.blocked.free(x, z, Math.max(1, rule.radius))) continue;
    opts.occupancy?.mark(x, z, rule.radius);
    const scale = (rule.scale[0] + (rule.scale[1] - rule.scale[0]) * sc) * (1 + csize * (2 * cn - 1));
    out.push({ x, y: Math.max(s.height, -0.3), z, rot, scale, variant });
  }
  return out;
}

/**
 * Place every species in PLACEMENT_ORDER (larger plants first) with one shared occupancy grid,
 * so species never overlap. `occCell` is the occupancy resolution in metres. `planted` (phase 2c
 * farm blocks): those palms are marked first and lead `out.coconut`; no woody species is placed
 * where `inside` is true (the blocks' floor stays open, grass only).
 */
export function placeAll(f: WorldFields, m: VegMasks, densities: Partial<Record<SpeciesId, number>>, seed: number,
  opts: { occCell?: number; spacingMul?: number; skip?: (x: number, z: number) => boolean; trunks?: Occupancy;
    planted?: { coconut: PlantInstance[]; inside: (x: number, z: number) => boolean } } = {}) {
  const occ = new Occupancy(f.grid, opts.occCell ?? 1);
  const p = opts.planted;
  if (p) for (const q of p.coconut) occ.mark(q.x, q.z, RULES.coconut.radius);
  const skip = p ? (x: number, z: number) => p.inside(x, z) || !!opts.skip?.(x, z) : opts.skip;
  const out = {} as Record<WoodyId, PlantInstance[]>;
  for (const id of PLACEMENT_ORDER) {
    const list = placeSpecies(f, m, id, { density: densities[id] ?? 0, seed, occupancy: occ, spacingMul: opts.spacingMul, skip });
    out[id] = p && id === 'coconut' ? p.coconut.concat(list) : list;
    if (opts.trunks) markTrunks(opts.trunks, id, out[id]);
  }
  return out;
}

/** Mark the trunk discs of the first `n` of `list` (woody species `id`) in `trunks` (ground cover keeps off them). */
export function markTrunks(trunks: Occupancy, id: WoodyId, list: readonly PlantInstance[], n = list.length) {
  const t = RULES[id].trunk ?? 0.5;
  for (let i = 0; i < n; i++) trunks.mark(list[i].x, list[i].z, Math.max(1, t * list[i].scale));
}
