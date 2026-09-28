import { describe, expect, test } from 'vitest';
import geo from '../../data/geo/loiza.json';
import type { GeoBundle } from '../../data/geo/types';
import { placementFields } from '../../terrain/placementFields';
import { buildVegMasks } from '../masks';
import { siteAt } from '../placement';
import { blockSiteOk, findBlocks, insideBlocks, plantBlocks, ROW } from './plantation';

const f = placementFields(0), m = buildVegMasks(geo as unknown as GeoBundle, f);
const blocks = findBlocks(f, m);

describe('findBlocks', () => {
  test('3–6 blocks of 120 × 80 m, deterministic', () => {
    expect(blocks.length).toBeGreaterThanOrEqual(3); expect(blocks.length).toBeLessThanOrEqual(6);
    for (const b of blocks) { expect(b.halfL).toBe(60); expect(b.halfW).toBe(40); expect(Math.hypot(b.ux, b.uz)).toBeCloseTo(1, 6); }
    expect(findBlocks(f, m)).toEqual(blocks);
  });
  test('every sample in a block passes the site rule (spec 2c §2)', () => {
    for (const b of blocks) for (let a = -b.halfL; a <= b.halfL; a += 20) for (let c = -b.halfW; c <= b.halfW; c += 20) {
      const x = b.cx + a * b.ux - c * b.uz, z = b.cz + a * b.uz + c * b.ux;
      expect(blockSiteOk(siteAt(f, m, x, z)), `${x},${z}`).toBe(true);
    }
  });
  test('blocks are ≥ 200 m apart', () => {
    for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++)
      expect(Math.hypot(blocks[i].cx - blocks[j].cx, blocks[i].cz - blocks[j].cz)).toBeGreaterThanOrEqual(200);
  });
});

describe('plantBlocks', () => {
  const all = plantBlocks(f, blocks, 1);
  test('full survival: 15 × 10 palms per block, 8 m rows, ≤ 1500 total', () => {
    expect(all.length).toBe(blocks.length * 150);
    expect(all.length).toBeLessThanOrEqual(1500);
    const b = blocks[0], p = all.slice(0, 150);
    const along = p.map((q) => (q.x - b.cx) * b.ux + (q.z - b.cz) * b.uz).sort((a, c) => a - c);
    expect(along[149] - along[0]).toBeGreaterThan(14 * ROW - 1.2);
    expect(along[149] - along[0]).toBeLessThan(14 * ROW + 1.2);
  });
  test('survival removes about the right share, deterministically', () => {
    const s = plantBlocks(f, blocks, 0.85);
    expect(s.length / all.length).toBeGreaterThan(0.78); expect(s.length / all.length).toBeLessThan(0.92);
    expect(plantBlocks(f, blocks, 0.85)).toEqual(s);
    expect(plantBlocks(f, blocks, 0)).toEqual([]);
  });
  test('palms stand on the ground, inside their blocks', () => {
    const inside = insideBlocks(blocks);
    for (const p of all) { expect(inside(p.x, p.z)).toBe(true); expect(Number.isFinite(p.y)).toBe(true); }
    expect(inside(1e5, 1e5)).toBe(false);
  });
});
