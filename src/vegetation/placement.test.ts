import { describe, expect, test } from 'vitest';
import { crossingGeometry, landingClearings } from '../ancon/geometry';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { buildFields, WATER } from '../terrain/fields';
import { buildVegMasks, LANDING_CLEARING } from './masks';
import { habitatMask, Occupancy, placeAll, placeSpecies, siteAt, warmHabitat } from './placement';
import { RULES } from './rules';
import type { Site } from './types';

const G = geo as unknown as GeoBundle;
const f = buildFields(G, { extent: 2560, size: 256, bankOffset: 0 });
const m = buildVegMasks(G, f);
const at = (arr: Float32Array | Uint8Array, x: number, z: number) => {
  const i = Math.floor((x - f.grid.minX) / f.grid.cell), j = Math.floor((z - f.grid.minZ) / f.grid.cell);
  return arr[j * f.grid.size + i];
};

/**
 * Quadrat dispersion index: variance ÷ mean of instance counts over 40 m cells restricted to
 * habitat (density(s) > 0). A Poisson/CSR pattern gives ≈ 1; a perfectly even stand gives < 1;
 * real clumping (groups and gaps) gives > 1.
 *
 * Raw variance/mean over the *whole* map is dominated by the habitat gradient itself (coconut's
 * density rises toward the coast, mangroves' toward the river), not by clump-noise clustering: a
 * `placeSpecies('coconut', ...)` run with no other species competing for space, so the clump
 * noise is the only source of unevenness, still gives ≈ 4.7–4.9 regardless of clump tuning,
 * purely from that gradient (see docs/superpowers/notes/phase-2b-rulings.md, "Task 9 —
 * clustering", for the full derivation). To isolate clustering from the gradient, cells are
 * grouped into `bins` quantiles of habitat density first, dispersion is computed within each
 * (density is roughly uniform inside a quantile), and the per-bin ratios are averaged, weighted
 * by bin size.
 */
function dispersionIndex(rule: { density(s: Site): number }, points: { x: number; z: number }[], cell = 40, bins = 15) {
  const g = f.grid, ext = g.cell * g.size, nCells = Math.ceil(ext / cell);
  const habitat: { k: number; d: number }[] = [];
  const habitatKeys = new Set<number>();
  for (let j = 0; j < nCells; j++) for (let i = 0; i < nCells; i++) {
    const cx = g.minX + (i + 0.5) * cell, cz = g.minZ + (j + 0.5) * cell;
    const s = siteAt(f, m, cx, cz);
    const d = s ? rule.density(s) : 0;
    if (d > 0) { const k = j * nCells + i; habitat.push({ k, d }); habitatKeys.add(k); }
  }
  const counts = new Map<number, number>();
  for (const p of points) {
    const i = Math.floor((p.x - g.minX) / cell), j = Math.floor((p.z - g.minZ) / cell);
    const k = j * nCells + i;
    if (habitatKeys.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const sorted = habitat.slice().sort((a, b) => a.d - b.d);
  const perBin = Math.ceil(sorted.length / bins);
  let weightSum = 0, weightedRatio = 0;
  for (let b = 0; b < bins; b++) {
    const group = sorted.slice(b * perBin, (b + 1) * perBin);
    if (group.length < 8) continue;
    const vals = group.map((h) => counts.get(h.k) ?? 0);
    const mean = vals.reduce((a, c) => a + c, 0) / vals.length;
    if (mean <= 0) continue;
    const variance = vals.reduce((a, c) => a + (c - mean) ** 2, 0) / vals.length;
    weightSum += group.length; weightedRatio += group.length * (variance / mean);
  }
  return weightedRatio / weightSum;
}

describe('placement', () => {
  const all = placeAll(f, m, { redMangrove: 1, coconut: 1, casuarina: 1, blackMangrove: 1, whiteMangrove: 1 }, 7);

  test('deterministic', () => {
    expect(placeAll(f, m, { redMangrove: 1, coconut: 1, casuarina: 1, blackMangrove: 1, whiteMangrove: 1 }, 7)).toEqual(all);
  });
  test('plausible counts on the real map', () => {
    expect(all.redMangrove.length).toBeGreaterThan(400);
    expect(all.coconut.length).toBeGreaterThan(300);
    expect(all.casuarina.length).toBeGreaterThan(150);
  });
  // Round-2 review (task-9-report.md): a Clark–Evans test here measured the coastal habitat
  // band's shape, not a lattice — replaced with a quadrat dispersion index (see `dispersionIndex`
  // above). Black and white mangrove are NOT re-tested here: their pre-task-9 dispersion (2.74,
  // 2.13 at bins=15, cell=40) was already > 1.5, i.e. this metric never read them as an even
  // stand, so a regression test here would guard nothing (see the report for the full
  // before/after table).
  //
  // Round-3 review (R11): coconut's low-density habitat (the `bank`/`town` terms) still read as
  // an even scatter — a smooth or gap-threshold multiplier on a low d stays a low, roughly-even
  // acceptance rate everywhere, so clumping could only redistribute *where* that thin scatter
  // fell, not turn it into real groves. Coconut now uses grove-coverage mode (`clump.coverage`,
  // see rules.ts): the fraction of the map that's grove scales with d, not the acceptance rate
  // inside a grove. Looped over three cell sizes (bins=20, wider than the default 15, needed to
  // keep the pre-task-9 value under 1.5 at cell=50 too — see the rulings note) so the test isn't
  // fitted to one arbitrary cell size.
  test('palms stand in groups with gaps, not in even rows (quadrat dispersion > 1.5)', () => {
    for (const cell of [30, 40, 50]) expect(dispersionIndex(RULES.coconut, all.coconut, cell, 20)).toBeGreaterThan(1.5);
  });
  // Scope extension (task-9-report.md, "Important 3"): casuarina turned out to be the majority
  // species in the exact hero shots the brief's visual check names (near counts ~3.3x coconut's
  // in the mouth view), so coconut's fix alone couldn't change what those frames show. Applying
  // the same gap-shaped clumping to casuarina was necessary to move them, even though casuarina
  // was never in the original brief/ruling scope.
  test('casuarina stands in groups with gaps, not in even rows (quadrat dispersion > 1.5)', () => {
    expect(dispersionIndex(RULES.casuarina, all.casuarina)).toBeGreaterThan(1.5);
  });
  test('clumping fix keeps counts within ±25% of pre-task-9 tuning', () => {
    // Baselines (c93d951, before this task): coconut 3605, casuarina 3048, blackMangrove 5580,
    // whiteMangrove 1898 (task-9-report.md).
    expect(all.coconut.length).toBeGreaterThan(3605 * 0.75);
    expect(all.coconut.length).toBeLessThan(3605 * 1.25);
    expect(all.casuarina.length).toBeGreaterThan(3048 * 0.75);
    expect(all.casuarina.length).toBeLessThan(3048 * 1.25);
    expect(all.blackMangrove.length).toBeGreaterThan(5580 * 0.75);
    expect(all.blackMangrove.length).toBeLessThan(5580 * 1.25);
    expect(all.whiteMangrove.length).toBeGreaterThan(1898 * 0.75);
    expect(all.whiteMangrove.length).toBeLessThan(1898 * 1.25);
  });
  test('mangroves hug the river, never the open coast', () => {
    for (const p of all.redMangrove) {
      expect(at(m.riverDist, p.x, p.z)).toBeLessThan(45);
      expect(at(f.seaDist, p.x, p.z)).toBeGreaterThanOrEqual(60);
    }
  });
  test('palms and pines stand on dry land, off roads', () => {
    for (const p of [...all.coconut, ...all.casuarina]) {
      expect(at(f.water, p.x, p.z)).toBe(WATER.LAND);
      expect(at(m.roadDist, p.x, p.z)).toBeGreaterThanOrEqual(5);
    }
  });
  test('occupancy keeps different species apart', () => {
    const big = [...all.casuarina, ...all.coconut];
    const r = Math.min(RULES.casuarina.radius, RULES.coconut.radius);
    // sample check: first 300 against all; track the minimum and assert once (expect() per pair is slow on CI)
    let min = Infinity;
    for (const a of big.slice(0, 300)) for (const b of big) {
      if (a !== b) min = Math.min(min, Math.hypot(a.x - b.x, a.z - b.z));
    }
    expect(min).toBeGreaterThanOrEqual(r - 1e-6);
  });
  test('density scales counts roughly linearly', () => {
    const full = placeSpecies(f, m, 'coconut', { density: 1, seed: 3 }).length;
    const half = placeSpecies(f, m, 'coconut', { density: 0.5, seed: 3 }).length;
    expect(half / full).toBeGreaterThan(0.35);
    expect(half / full).toBeLessThan(0.65);
  });
  test('per-species rotation range keeps baked leans downwind; mangroves spin freely', () => {
    for (const id of ['coconut', 'casuarina'] as const) for (const p of all[id]) expect(Math.abs(p.rot)).toBeLessThanOrEqual(RULES[id].rot);
    const rots = all.redMangrove.map((p) => p.rot);
    expect(Math.max(...rots) - Math.min(...rots)).toBeGreaterThan(5);
  });
  test('skip and spacingMul thin the candidate set', () => {
    const base = placeSpecies(f, m, 'coconut', { density: 1, seed: 3 }).length;
    expect(placeSpecies(f, m, 'coconut', { density: 1, seed: 3, spacingMul: 2 }).length).toBeLessThan(base * 0.5);
    expect(placeSpecies(f, m, 'coconut', { density: 1, seed: 3, skip: () => true })).toEqual([]);
  });
  test('ferry landings are kept clear', () => {
    const cell = f.grid.cell * Math.SQRT1_2; // mask is per cell: allow half a cell diagonal
    for (const [lx, lz] of landingClearings(crossingGeometry(f))) {
      for (const p of Object.values(all).flat()) expect(Math.hypot(p.x - lx, p.z - lz)).toBeGreaterThan(LANDING_CLEARING[0] - cell);
    }
  });
  test('instances sit on the terrain height', () => {
    for (const p of all.coconut.slice(0, 50)) expect(p.y).toBeGreaterThan(0);
  });
  test('bounds: tiles placed one by one equal the whole-map placement', () => {
    // spacingMul 4 keeps the whole-map run fast; the tiling logic is the same.
    const whole = placeSpecies(f, m, 'grass', { density: 1, seed: 5, spacingMul: 4 });
    const g = f.grid, T = 320, ext = g.cell * g.size, tiles = [];
    for (let z = g.minZ; z < g.minZ + ext; z += T) for (let x = g.minX; x < g.minX + ext; x += T)
      tiles.push(...placeSpecies(f, m, 'grass', { density: 1, seed: 5, spacingMul: 4, bounds: [x, z, x + T, z + T] }));
    const key = (p: { x: number; z: number }) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`;
    expect(tiles.map(key).sort()).toEqual(whole.map(key).sort());
  });
  test('blocked: ground cover keeps off woody trunks', () => {
    const trunks = new Occupancy(f.grid, 1);
    const woody = placeAll(f, m, { redMangrove: 1, coconut: 1, casuarina: 1 }, 7, { trunks });
    const grass = placeSpecies(f, m, 'grass', { density: 1, seed: 7, spacingMul: 2, blocked: trunks });
    const palms = woody.coconut;
    let min = Infinity;
    for (const p of palms.slice(0, 200)) for (const q of grass) min = Math.min(min, Math.hypot(p.x - q.x, p.z - q.z));
    // Marks and checks use ≥ 1 m discs on a 1 m grid, so the guaranteed gap is 1 − √½ ≈ 0.29 m.
    expect(min).toBeGreaterThan(0.25);
  });
});

test('warmHabitat fills the habitat cache that placeSpecies reads (ground cover warms it off the frame loop)', () => {
  const f2 = buildFields(G, { extent: 2560, size: 128, bankOffset: 0 }), m2 = buildVegMasks(G, f2);
  expect(habitatMask(f2, m2, 'grass', false)).toBeUndefined();
  warmHabitat(f2, m2, ['grass', 'reeds']);
  const g = habitatMask(f2, m2, 'grass', false)!;
  expect(g).toBeInstanceOf(Uint8Array);
  expect(g.length).toBe(128 * 128);
  expect(habitatMask(f2, m2, 'reeds', false)).toBeDefined();
  expect(habitatMask(f2, m2, 'morningGlory', false)).toBeUndefined();
  expect(habitatMask(f2, m2, 'grass')).toBe(g); // cached: same array
});
