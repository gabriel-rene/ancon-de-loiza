import { describe, expect, test } from 'vitest';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { landmarkXZ } from '../data/landmarks';
import { buildFields, sampleField, WATER, SEA_SEED } from './fields';

const f = buildFields(geo as unknown as GeoBundle, { extent: 2560, size: 256, bankOffset: 0 });
const at = (arr: Float32Array | Uint8Array, [x, z]: [number, number]) => {
  const i = Math.floor((x - f.grid.minX) / f.grid.cell), j = Math.floor((z - f.grid.minZ) / f.grid.cell);
  return arr[j * f.grid.size + i];
};

describe('real fields', () => {
  test('crossing midpoint is river, ≥1 m deep', () => {
    expect(at(f.water, [0, 0])).toBe(WATER.RIVER);
    expect(sampleField(f, f.height, 0, 0)).toBeLessThan(-1);
  });
  test('open sea off the mouth', () => expect(at(f.water, SEA_SEED)).toBe(WATER.SEA));
  test('town plaza is dry land above 0.5 m', () => {
    const p = landmarkXZ('plaza');
    expect(at(f.water, p)).toBe(WATER.LAND);
    expect(sampleField(f, f.height, ...p)).toBeGreaterThan(0.5);
  });
  test('shore distance is negative in water, positive on land', () => {
    expect(at(f.shore, [0, 0])).toBeLessThan(0);
    expect(at(f.shore, landmarkXZ('church'))).toBeGreaterThan(0);
  });
  test('bankOffset widens the river', () => {
    const wide = buildFields(geo as unknown as GeoBundle, { extent: 2560, size: 256, bankOffset: 10 });
    const count = (w: Uint8Array) => w.reduce((n, v) => n + (v === WATER.RIVER ? 1 : 0), 0);
    expect(count(wide.water)).toBeGreaterThan(count(f.water));
  });
});

test('post-dam river mouth is open: river and sea are 4-connected (no coastline wall across it)', () => {
  const f = buildFields(geo as unknown as GeoBundle, { extent: 2560, size: 512, bankOffset: 0 });
  const { size, cell, minX, minZ } = f.grid;
  const idx = ([x, z]: [number, number]) => Math.floor((z - minZ) / cell) * size + Math.floor((x - minX) / cell);
  // Start from the river cell nearest the mouth landmark.
  const [mx, mz] = landmarkXZ('mouth');
  let start = -1, best = Infinity;
  for (let k = 0; k < size * size; k++) {
    if (f.water[k] !== WATER.RIVER) continue;
    const d = Math.hypot(minX + ((k % size) + 0.5) * cell - mx, minZ + (Math.floor(k / size) + 0.5) * cell - mz);
    if (d < best) { best = d; start = k; }
  }
  expect(best).toBeLessThan(300);
  const seen = new Uint8Array(size * size), queue = [start];
  seen[start] = 1;
  const target = idx(SEA_SEED as [number, number]);
  while (queue.length && !seen[target]) {
    const k = queue.pop()!, i = k % size, j = (k - i) / size;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, nk = nj * size + ni;
      if (ni < 0 || nj < 0 || ni >= size || nj >= size || seen[nk] || f.water[nk] === WATER.LAND) continue;
      seen[nk] = 1; queue.push(nk);
    }
  }
  expect(seen[target]).toBe(1);

  // Connectivity alone passes through gaps in the diagonal wall, so also check the mouth is
  // open along its width: few land cells may sit between river and sea (was 21 with the wall,
  // leaving a visible strip), and many river cells touch the sea directly (was 8).
  const nb4 = (k: number) => [k + 1, k - 1, k + size, k - size];
  const nb8 = (k: number) => [...nb4(k), k + size + 1, k + size - 1, k - size + 1, k - size - 1];
  let strip = 0, contact = 0;
  for (let k = size + 1; k < size * (size - 1) - 1; k++) {
    const w = f.water[k];
    if (w === WATER.LAND && nb4(k).some((x) => f.water[x] === WATER.RIVER) && nb8(k).some((x) => f.water[x] === WATER.SEA)) strip++;
    if (w === WATER.RIVER && nb4(k).some((x) => f.water[x] === WATER.SEA)) contact++;
  }
  expect(strip).toBeLessThanOrEqual(3);
  expect(contact).toBeGreaterThanOrEqual(20);
});
