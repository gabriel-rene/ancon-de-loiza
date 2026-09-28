import { describe, expect, test } from 'vitest';
import { crossingGeometry, landingClearings } from '../ancon/geometry';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { buildFields, WATER } from '../terrain/fields';
import { buildVegMasks, LANDING_CLEARING } from './masks';
import { Occupancy, placeAll, placeSpecies } from './placement';
import { RULES } from './rules';

const G = geo as unknown as GeoBundle;
const f = buildFields(G, { extent: 2560, size: 256, bankOffset: 0 });
const m = buildVegMasks(G, f);
const at = (arr: Float32Array | Uint8Array, x: number, z: number) => {
  const i = Math.floor((x - f.grid.minX) / f.grid.cell), j = Math.floor((z - f.grid.minZ) / f.grid.cell);
  return arr[j * f.grid.size + i];
};

/**
 * Mean nearest-neighbour distance ÷ the value expected for a fully random pattern of the same
 * density (0.5/√density): R ≈ 1 random, < 1 clustered (groups and gaps), > 1 evenly spaced
 * (a planted-looking grid). O(n²); callers should pass a bounded subset for large species.
 */
function clarkEvansR(p: { x: number; z: number }[]) {
  let sum = 0;
  for (const a of p) { let d = Infinity; for (const b of p) if (a !== b) d = Math.min(d, Math.hypot(a.x - b.x, a.z - b.z)); sum += d; }
  const xs = p.map((q) => q.x), zs = p.map((q) => q.z);
  const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
  return (sum / p.length) / (0.5 / Math.sqrt(p.length / area));
}

/**
 * A fixed 650 m square centred on the species' own instances' centroid — big enough to span
 * several clumps (so real gaps show up as reduced R, not just a bounding-box artefact) and small
 * enough to keep the O(n²) Clark–Evans loop under a second for species with thousands of
 * instances across the whole 2560 m map. Uses the subset's own bounding box for its area.
 */
function centroidWindow<T extends { x: number; z: number }>(p: T[], size = 650): T[] {
  const xs = p.map((q) => q.x), zs = p.map((q) => q.z);
  const cx = xs.reduce((a, b) => a + b, 0) / xs.length, cz = zs.reduce((a, b) => a + b, 0) / zs.length;
  return p.filter((q) => Math.abs(q.x - cx) < size / 2 && Math.abs(q.z - cz) < size / 2);
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
  test('palms stand in groups with gaps, not in even rows (Clark–Evans R < 0.8)', () => {
    const R = clarkEvansR(centroidWindow(all.coconut));
    expect(R).toBeLessThan(0.8);
  });
  // R8: black mangrove reads as even rows up close too ("orchard" look); white mangrove shares
  // its rule shape, so the same clumping fix applies to both (task-9-report.md).
  test('black mangrove stands in groups with gaps, not in even rows (Clark–Evans R < 0.8)', () => {
    const R = clarkEvansR(centroidWindow(all.blackMangrove));
    expect(R).toBeLessThan(0.8);
  });
  test('white mangrove stands in groups with gaps, not in even rows (Clark–Evans R < 0.8)', () => {
    const R = clarkEvansR(centroidWindow(all.whiteMangrove));
    expect(R).toBeLessThan(0.8);
  });
  test('clumping fix keeps counts within ±25% of pre-task-9 tuning', () => {
    // Baselines: coconut 3605, blackMangrove 5580, whiteMangrove 1898 (task-9-report.md).
    expect(all.coconut.length).toBeGreaterThan(3605 * 0.75);
    expect(all.coconut.length).toBeLessThan(3605 * 1.25);
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
