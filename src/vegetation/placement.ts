import { sampleField, type WorldFields } from '../terrain/fields';
import type { Grid } from '../terrain/raster';
import type { VegMasks } from './masks';
import { cellRng } from './rng';
import { PLACEMENT_ORDER, RULES } from './rules';
import type { PlantInstance, Site, SpeciesId } from './types';

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

function siteAt(f: WorldFields, m: VegMasks, x: number, z: number): Site | null {
  const g = f.grid, i = Math.floor((x - g.minX) / g.cell), j = Math.floor((z - g.minZ) / g.cell);
  if (i < 0 || j < 0 || i >= g.size || j >= g.size) return null;
  const k = j * g.size + i;
  const h = sampleField(f, f.height, x, z);
  return { water: f.water[k], depth: Math.max(0, -h), shore: f.shore[k], seaDist: f.seaDist[k], riverDist: m.riverDist[k],
    roadDist: m.roadDist[k], height: h, landCls: f.landCls[k], town: m.town[k] };
}

export function placeSpecies(f: WorldFields, m: VegMasks, species: SpeciesId,
  opts: { density: number; seed: number; occupancy?: Occupancy }): PlantInstance[] {
  const rule = RULES[species], g = f.grid, sp = rule.spacing, extent = g.cell * g.size;
  const n = Math.floor(extent / sp), out: PlantInstance[] = [];
  const salt = species.length * 7919 + species.charCodeAt(0);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = cellRng(i, j, opts.seed * 131 + salt);
    const x = g.minX + (i + 0.1 + 0.8 * r()) * sp, z = g.minZ + (j + 0.1 + 0.8 * r()) * sp;
    const accept = r(), rot = r() * Math.PI * 2, sc = r(), variant = Math.floor(r() * rule.variants);
    const s = siteAt(f, m, x, z);
    if (!s || accept >= rule.density(s) * opts.density) continue;
    if (opts.occupancy && !opts.occupancy.free(x, z, rule.radius)) continue;
    opts.occupancy?.mark(x, z, rule.radius);
    out.push({ x, y: Math.max(s.height, -0.3), z, rot, scale: rule.scale[0] + (rule.scale[1] - rule.scale[0]) * sc, variant });
  }
  return out;
}

export function placeAll(f: WorldFields, m: VegMasks, densities: Record<SpeciesId, number>, seed: number) {
  const occ = new Occupancy(f.grid, 1);
  const out = {} as Record<SpeciesId, PlantInstance[]>;
  for (const id of PLACEMENT_ORDER) out[id] = placeSpecies(f, m, id, { density: densities[id], seed, occupancy: occ });
  return out;
}
