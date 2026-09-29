import { describe, expect, test } from 'vitest';
import { corners, finish, makeBuilders, toWorld, triangleCount } from './parts';

describe('parts', () => {
  test('toWorld follows the three.js yaw convention; corners are the rectangle', () => {
    const fp = { c: [10, 20] as [number, number], yaw: Math.PI / 2, hx: 2, hz: 1 };
    const [x, z] = toWorld(fp, 1, 0);   // local +X → (cos, −sin) = (0, −1)
    expect(x).toBeCloseTo(10); expect(z).toBeCloseTo(19);
    expect(corners(fp).length).toBe(4);
    for (const [cx, cz] of corners(fp)) expect(Math.hypot(cx - 10, cz - 20)).toBeCloseTo(Math.hypot(2, 1));
  });
  test('finish returns only the materials that got pieces', () => {
    const b = makeBuilders();
    b.wood.box([1, 1, 1], [0, 0, 0], 0xffffff);
    const out = finish(b);
    expect(Object.keys(out)).toEqual(['wood']);
    expect(triangleCount(out.wood!)).toBe(12);
  });
});
