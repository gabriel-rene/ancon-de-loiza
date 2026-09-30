import { describe, expect, test } from 'vitest';
import { legDuration } from '../ancon/crossing';
import { tris } from '../ancon/testing';
import { ERAS, type EraId } from '../data/eras';
import { buildAnimalBody, buildBicycle, buildCart, buildCartWheel, buildLegSegment } from './animals';
import { buildCar, buildWheel, CAR_PARTS } from './carKit';
import { isCar } from './models';
import { createMoverFrame, moverFrame } from './motion';
import { LegCache } from './schedule';
import { envFor, poseFor } from './testing';
import { createFigurePose, poseFigure, sitHipHeight } from '../people/rig';
import { SILHOUETTES } from './carKit';
import { driverFeetY, eraMeshKeys, FEET_HIDE, ROOF_CLEAR, trafficLooks } from './TrafficSet';

describe('budget (spec 4c §7)', () => {
  test('at most 14 draw calls per era (1986: the bridge traffic, Task 13, adds its own)', () => {
    for (const e of ERAS) expect(eraMeshKeys(e.ancon.load.value).length, e.id).toBeLessThanOrEqual(14);
  });
  test('at most 80 000 triangles visible at once', () => {
    const carTris = (m: Parameters<typeof buildCar>[0]) => { const g = buildCar(m, 'hi'); return CAR_PARTS.reduce((n, p) => n + tris(g[p]), 0) + 4 * tris(buildWheel('hi')); };
    const legs = 4 * tris(buildLegSegment(false)) + 4 * tris(buildLegSegment(true)), cost: Record<string, number> = {
      oxCart: 2 * (tris(buildAnimalBody('ox')) + legs) + tris(buildCart('oxCart')) + 2 * tris(buildCartWheel()),
      caneCart: 2 * (tris(buildAnimalBody('ox')) + legs) + tris(buildCart('caneCart')) + 2 * tris(buildCartWheel()),
      horse: tris(buildAnimalBody('horse')) + legs, bicycle: tris(buildBicycle()),
    };
    for (const id of ['1840', '1900', '1925', '1935', '1959', '1975', '1984'] as EraId[]) {
      const env = envFor(id), Lg = legDuration(env.spec.timings), cache = new LegCache(env), fr = createMoverFrame();
      let worst = 0;
      for (let c = 2 * Lg; c < 4 * Lg; c += 0.5) {
        const pose = poseFor(env, c), n = Math.floor(c / Lg);
        let sum = 0;
        for (const l of [n - 1, n, n + 1]) for (const s of cache.get(l).movers) if (moverFrame(s, env, c, pose, fr).visible) sum += isCar(s.m.kind) ? carTris(s.m.kind) : cost[s.m.kind];
        worst = Math.max(worst, sum);
      }
      expect(worst, id).toBeLessThanOrEqual(80_000);
    }
  });
});

describe('drivers (Task 12 shots: heads through the 1980s roofs, shins under the Model T)', () => {
  test('every era driver sits inside the solid cabin: head under the roof, feet no lower than just under the sill where the roof allows', () => {
    for (const e of ERAS) {
      const env = envFor(e.id), models = new Set(e.ancon.load.value.flatMap((r) => [...r.fixed, ...(r.cars > r.fixed.length ? r.pool : [])]));
      for (const look of trafficLooks(env)) {
        const body = { height: look.height, build: look.build, dress: look.dress }, hip = sitHipHeight(body);
        const fp = poseFigure(body, { kind: 'sit', phase: 0, handL: [0.17, hip + 0.36, 0.45], handR: [-0.17, hip + 0.36, 0.45] }, createFigurePose());
        for (const m of models) {
          const s = SILHOUETTES[m], y = driverFeetY(m, 0.5, hip, fp.headTop);
          expect(y + fp.headTop, `${e.id} ${m} head`).toBeLessThanOrEqual(s.roof - ROOF_CLEAR + 1e-9);
          if (s.roof - ROOF_CLEAR - fp.headTop >= s.sill - FEET_HIDE) expect(y, `${e.id} ${m} feet`).toBeGreaterThanOrEqual(s.sill - FEET_HIDE - 1e-9);
        }
      }
    }
  });
});
