import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import geo from '../data/geo/loiza.json';
import type { GeoBundle } from '../data/geo/types';
import { bridgePlan, deckTop } from '../infrastructure/bridge';
import { bridgeWay } from '../infrastructure/roads';
import { waterAt } from '../ancon/geometry';
import { fields512 } from '../ancon/testing';
import { sampleField } from '../terrain/fields';
import { BRIDGE_LANE, bridgeCarAt, bridgeCarCount, bridgeCars, bridgeLanes } from './bridgeTraffic';
import { pointAt } from './env';
import { DIMS } from './models';

const G = geo as unknown as GeoBundle, f = fields512(0), groundAt = (x: number, z: number) => sampleField(f, f.height, x, z);
const plan = bridgePlan(bridgeWay(G), 'open', (x, z) => waterAt(f, x, z), groundAt)!;

describe('bridge traffic', () => {
  const lanes = bridgeLanes(G, plan, groundAt);
  test('lanes run past both ends and keep right of the bridge axis', () => {
    expect(lanes[0].path.len).toBeGreaterThan(plan.len);
    expect(lanes[1].path.len).toBeGreaterThan(plan.len);
    // lane 0 runs a → b; at mid-bridge it is BRIDGE_LANE right of the axis (right of dir = (−dir.z, dir.x)); lane 1 the mirror
    for (const [k, sign] of [[0, 1], [1, -1]] as const) {
      const pt: [number, number] = [0, 0];
      let best = Infinity, off = 0;
      for (let s = 0; s < lanes[k].path.len; s += 0.5) {
        const [x, z] = pointAt(lanes[k].path, s, pt), dx = x - plan.a[0], dz = z - plan.a[1];
        const along = dx * plan.dir[0] + dz * plan.dir[1], across = -dx * plan.dir[1] + dz * plan.dir[0];
        if (Math.abs(along - plan.len / 2) < best) { best = Math.abs(along - plan.len / 2); off = across; }
      }
      expect(off, `lane ${k}`).toBeCloseTo(sign * BRIDGE_LANE, 0);
    }
  });
  test('cars keep their gaps; half go each way', () => {
    const cars = bridgeCars(10), fr = new THREE.Vector3(), rr = new THREE.Vector3();
    expect(cars.filter((k) => k.lane === 0).length).toBe(5);
    for (let c = 0; c < 120; c += 0.5) for (const lane of [0, 1] as const) {
      const pos = cars.filter((k) => k.lane === lane).map((k) => (bridgeCarAt(lanes[lane], k, c, fr, rr) ? fr.clone() : null)).filter(Boolean) as THREE.Vector3[];
      for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) expect(pos[i].distanceTo(pos[j])).toBeGreaterThan(DIMS.sedan80.length + 5);
    }
  });
  test('about 10 (high) or 6 (low) cars are on the bridge at once (spec 4c §6)', () => {
    for (const want of [10, 6]) {
      const cars = bridgeCars(bridgeCarCount(want, lanes, plan)), fr = new THREE.Vector3(), rr = new THREE.Vector3();
      let sum = 0, n = 0;
      for (let c = 0; c < 200; c += 1, n++) for (const k of cars) if (bridgeCarAt(lanes[k.lane], k, c, fr, rr)) {
        const t = ((fr.x - plan.a[0]) * plan.dir[0] + (fr.z - plan.a[1]) * plan.dir[1]) / plan.len;
        if (t >= 0 && t <= 1) sum++;
      }
      expect(Math.abs(sum / n - want), `${want}`).toBeLessThan(1.5);
    }
  });
  test('on the bridge the wheels are on the deck', () => {
    const cars = bridgeCars(10), fr = new THREE.Vector3(), rr = new THREE.Vector3();
    for (let c = 0; c < 200; c += 0.7) for (const k of cars) if (bridgeCarAt(lanes[k.lane], k, c, fr, rr)) {
      const t = ((fr.x - plan.a[0]) * plan.dir[0] + (fr.z - plan.a[1]) * plan.dir[1]) / plan.len;
      if (t > 0.05 && t < 0.95) expect(Math.abs(fr.y - (deckTop(plan, t) + 0.06))).toBeLessThan(0.05);
    }
  });
});
