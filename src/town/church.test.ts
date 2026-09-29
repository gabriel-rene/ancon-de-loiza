import { describe, expect, test } from 'vitest';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { finish, makeBuilders, triangleCount } from '../infrastructure/parts';
import { buildChurch, CHURCH, CHURCH_TRIANGLES } from './church';
import { churchPlan, churchReach, toLocal } from './layout';

const plan = churchPlan(geo as unknown as GeoBundle), ground = () => 3;
const parts = () => { const b = makeBuilders(); buildChurch(b, plan, ground); return finish(b); };

describe('church', () => {
  test('lime walls in concrete; door, windows, cross and two bells in iron', () => {
    expect(Object.keys(parts()).sort()).toEqual(['concrete', 'iron']);
  });
  test(`at most ${CHURCH_TRIANGLES} triangles`, () => {
    expect(Object.values(parts()).reduce((n, g) => n + triangleCount(g!), 0)).toBeLessThanOrEqual(CHURCH_TRIANGLES);
  });
  test('inside its reach; the bell tower stands ≥ 18 m above the ground; the front faces the plaza', () => {
    const reach = churchReach(plan);
    let top = -Infinity, frontMost = 0;
    for (const g of Object.values(parts())) {
      const p = g!.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const [lx, lz] = toLocal(reach, p.getX(i), p.getZ(i));
        expect(Math.abs(lx)).toBeLessThanOrEqual(reach.hx + 0.01);
        expect(Math.abs(lz)).toBeLessThanOrEqual(reach.hz + 0.01);
        top = Math.max(top, p.getY(i));
        if (p.getY(i) > 3 + CHURCH.wall + 2) frontMost += Math.sign(lx) * plan.front;   // tall parts lean to the front
      }
    }
    expect(top - 3).toBeGreaterThanOrEqual(18);
    expect(frontMost).toBeGreaterThan(0);
  });
  const floor = 3 + 0.3;
  test('the facade (door and upper windows) is on the front end, the one facing the plaza', () => {
    const p = parts().iron!.attributes.position;
    let sum = 0, n = 0;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < floor + 10) { sum += toLocal(plan.fp, p.getX(i), p.getZ(i))[0] * plan.front; n++; }
    expect(n).toBeGreaterThan(0);
    expect(sum / n).toBeGreaterThan(plan.fp.hx);
  });
  test('the barrel vault bulges up over the nave', () => {
    const { hx, hz } = plan.fp, p = parts().concrete!.attributes.position;
    let max = -Infinity;
    for (let i = 0; i < p.count; i++) {
      const [lx, lz] = toLocal(plan.fp, p.getX(i), p.getZ(i));
      if (Math.abs(lz) < hz - 1 && lx * plan.front < -hx + 0.01) max = Math.max(max, p.getY(i));
    }
    expect(max).toBeGreaterThan(floor + CHURCH.wall + 0.5);   // the vault has vertices only at the nave ends; the back end has no front wall or tower
  });
});
