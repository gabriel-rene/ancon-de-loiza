import { expect, test, vi } from 'vitest';
import { coverageMips, halve, type Pixels } from './textures';

const px = (w: number, h: number, rgba: number[][]): Pixels => ({ width: w, height: h, data: new Uint8ClampedArray(rgba.flat()) });

test('halve averages in linear light, premultiplied by alpha', () => {
  // Black + white (opaque) → linear 0.5 → sRGB ≈ 188, not the gamma-space 128.
  const a = halve(px(2, 2, [[0, 0, 0, 255], [255, 255, 255, 255], [0, 0, 0, 255], [255, 255, 255, 255]]), [0, 0, 0]);
  expect(a.width).toBe(1); expect(a.data[0]).toBeGreaterThan(185); expect(a.data[0]).toBeLessThan(191);
  expect(a.data[3]).toBe(255);
  // Transparent texels don't contribute colour; alpha is the plain mean.
  const b = halve(px(2, 2, [[200, 10, 10, 255], [0, 255, 0, 0], [0, 255, 0, 0], [0, 255, 0, 0]]), [9, 9, 9]);
  expect([b.data[0], b.data[1], b.data[2]]).toEqual([200, 10, 10]); expect(b.data[3]).toBe(64);
  // Fully transparent block → fill colour.
  const c = halve(px(2, 2, [[1, 2, 3, 0], [1, 2, 3, 0], [1, 2, 3, 0], [1, 2, 3, 0]]), [9, 8, 7]);
  expect([...c.data]).toEqual([9, 8, 7, 0]);
});

test('coverageMips keeps alpha-test coverage down the chain', () => {
  // 16×16 checker of 2×2 opaque blocks: plain averaging would drop alpha to ~50% everywhere.
  const w = 16, d: number[][] = [];
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) d.push([50, 90, 30, ((x >> 1) + (y >> 1)) % 2 ? 255 : 0]);
  const mips = coverageMips(px(w, w, d), [50, 90, 30], 127.5, 'test');
  expect(mips.map((m) => m.width)).toEqual([16, 8, 4, 2, 1]);
  const cov = (m: Pixels) => { let n = 0; for (let i = 3; i < m.data.length; i += 4) if (m.data[i] > 127.5) n++; return n / (m.data.length / 4); };
  expect(cov(mips[2])).toBeGreaterThan(0.3);
});

test('coverageMips warns once when the alpha-scale search pins at a bound', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  // Nothing passes the cut at level 0 (target coverage 0): the search runs down to its lower bound.
  const faint = Array.from({ length: 64 }, () => [40, 80, 20, 100]);
  coverageMips(px(8, 8, faint), [40, 80, 20], 127.5, 'faint');
  expect(warn).toHaveBeenCalledTimes(1);
  expect(String(warn.mock.calls[0][0])).toMatch(/"faint".*pinned at 0.5 on mip level 1/);
  // A normal leaf-like texture does not warn.
  warn.mockClear();
  const d: number[][] = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) d.push([50, 90, 30, (x * 7 + y * 3) % 5 < 2 ? 255 : 0]);
  coverageMips(px(16, 16, d), [50, 90, 30], 127.5, 'ok');
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});
