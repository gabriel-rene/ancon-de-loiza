import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { finish, makeBuilders, toWorld, triangleCount } from '../infrastructure/parts';
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
  test('inside its reach; the bell gable rises ≥ 18 m above the ground; the front faces the plaza', () => {
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
  const floor = 3 + 0.3, frontTop = floor + CHURCH.front + 1.6;
  test('bell gable [S14]: on the front, centred over the centre bay, above the front top', () => {
    const p = parts().concrete!.attributes.position;
    let n = 0;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > frontTop + 0.01) {
      const [lx, lz] = toLocal(plan.fp, p.getX(i), p.getZ(i));
      expect(Math.abs(lz)).toBeLessThanOrEqual(Math.min(CHURCH.gable / 2, plan.fp.hz / 3) + 0.01);   // inside the centre bay
      expect(lx * plan.front).toBeGreaterThanOrEqual(plan.fp.hx - 0.01);   // on the front wall
      n++;
    }
    expect(n).toBeGreaterThan(0);
  });
  test('bell gable: one open arch with two bells side by side in iron', () => {
    const iron = parts().iron!.attributes.position, sides = new Set<number>();
    for (let i = 0; i < iron.count; i++) {
      const y = iron.getY(i), lz = toLocal(plan.fp, iron.getX(i), iron.getZ(i))[1];
      if (y > frontTop && y < frontTop + CHURCH.arch && Math.abs(lz) > 0.1) sides.add(Math.sign(lz));
    }
    expect([...sides].sort()).toEqual([-1, 1]);
    // A ray through the arch, across the front, meets no masonry.
    const mesh = new THREE.Mesh(parts().concrete!, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const [ox, oz] = toWorld(plan.fp, plan.front * (plan.fp.hx + 5), 0), [tx, tz] = toWorld(plan.fp, plan.front * (plan.fp.hx - 2), 0);
    const y = frontTop + CHURCH.arch / 2, dir = new THREE.Vector3(tx - ox, 0, tz - oz).normalize();
    expect(new THREE.Raycaster(new THREE.Vector3(ox, y, oz), dir, 0, 7).intersectObject(mesh)).toHaveLength(0);
  });
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
    expect(max).toBeGreaterThan(floor + CHURCH.wall + 0.5);   // the vault has vertices only at the nave ends; the back end has no front wall or gable
  });
});
