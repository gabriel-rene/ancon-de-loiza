import { expect, test } from 'vitest';
import { drawPolyline, fillPolygon, floodFill, makeGrid } from './raster';

test('fills a square polygon', () => {
  const g = makeGrid(10, 10); // 1 m cells, -5..5
  const out = new Uint8Array(100);
  fillPolygon(g, out, [[-2, -2], [2, -2], [2, 2], [-2, 2]], 1);
  expect(out.reduce((a, b) => a + b, 0)).toBe(16);
});
test('flood fill stops at a wall', () => {
  const g = makeGrid(10, 10);
  const wall = new Uint8Array(100);
  drawPolyline(g, wall, [[-6, 0.2], [6, 0.2]], 1);
  const out = new Uint8Array(100);
  floodFill(g, out, (i) => wall[i] === 1, 0, 2); // seed top-left (north)
  expect(out[0]).toBe(2);
  expect(out[99]).toBe(0); // south of the wall untouched
});
