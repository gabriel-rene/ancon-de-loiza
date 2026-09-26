import { describe, expect, test } from 'vitest';
import { project, unproject } from './project';
import { landmarkXZ } from '../data/landmarks';

describe('project', () => {
  test('origin maps to 0,0', () => {
    const [x, z] = project(18.43485, -65.8823);
    expect(Math.abs(x)).toBeLessThan(1e-6);
    expect(Math.abs(z)).toBeLessThan(1e-6);
  });
  test('east landing is east and south of origin', () => {
    const [x, z] = landmarkXZ('eastLanding');
    expect(x).toBeCloseTo(84.5, 0);
    expect(z).toBeCloseTo(72.4, 0);
  });
  test('crossing length matches research (200–230 m)', () => {
    const [ax, az] = landmarkXZ('eastLanding');
    const [bx, bz] = landmarkXZ('westLanding');
    const d = Math.hypot(ax - bx, az - bz);
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(230);
  });
  test('unproject inverts project', () => {
    const [lat, lon] = unproject(...project(18.44, -65.87));
    expect(lat).toBeCloseTo(18.44, 7);
    expect(lon).toBeCloseTo(-65.87, 7);
  });
});
