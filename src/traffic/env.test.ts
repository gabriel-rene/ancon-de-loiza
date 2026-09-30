import { describe, expect, test } from 'vitest';
import { padFrame } from '../terrain/landingPads';
import { deckToWorld, polyline, pointAt, worldToDeck, CAR_ROAD, PAD_KEEP, QUEUE_A, VERGE_LEAVE, VERGE_WAIT, boardPath, leavePath, queueHeadS, departFrame, arriveFrame, roadsOf } from './env';
import { legMovers, travelOf } from './plan';
import { envFor } from './testing';

describe('frames', () => {
  test('deckToWorld and worldToDeck are inverse; the frame sits on the dock point', () => {
    const env = envFor('1975'), f = env.frames[0];
    const [wx, wz] = deckToWorld(f, 3.2, -1.1), [x, z] = worldToDeck(f, wx, wz);
    expect(x).toBeCloseTo(3.2, 9); expect(z).toBeCloseTo(-1.1, 9);
    expect(deckToWorld(f, 0, 0)).toEqual([env.ctx.dockEast[0], env.ctx.dockEast[1]]);
    expect(departFrame(env, 0).side).toBe('east'); expect(arriveFrame(env, 0).side).toBe('west');
    expect(departFrame(env, 1).side).toBe('west');
  });
});

describe('routes', () => {
  test('roads keep right, are long enough, and meet the pad at the queue head', () => {
    for (const id of ['1840', '1975'] as const) {
      const env = envFor(id);
      env.roads.forEach((r, i) => {
        const pad = env.pads[i], inL = polyline(r.inRoad), outL = polyline(r.outRoad);
        expect(inL.len - r.padPart).toBeGreaterThanOrEqual(CAR_ROAD); expect(outL.len - r.padPart).toBeGreaterThanOrEqual(CAR_ROAD);
        const pf = (p: readonly [number, number]) => padFrame(pad, p[0], p[1]);
        const [qa, qv] = pf(r.inRoad[r.inRoad.length - 1]), [oa, ov] = pf(r.outRoad[0]);
        expect(qa).toBeCloseTo(QUEUE_A, 6); expect(qv).toBeCloseTo(-PAD_KEEP, 6);
        expect(oa).toBeCloseTo(QUEUE_A, 6); expect(ov).toBeCloseTo(PAD_KEEP, 6);
        // On the road the outbound lane lies to the left of the inbound direction (right-hand traffic).
        const a = r.inRoad[1], b = r.inRoad[2], o = r.outRoad[r.outRoad.length - 3];
        const cross = (b[0] - a[0]) * (o[1] - a[1]) - (b[1] - a[1]) * (o[0] - a[0]);   // > 0: o is right of a→b (x east, z south)
        expect(cross).toBeLessThan(0);
        // Bicycles wait and leave on the verge on the side of the deck's bicycle rail, leaving outside the waiting ones.
        expect(pf(r.waitVerge[r.waitVerge.length - 1])[1]).toBeCloseTo(r.railV * (PAD_KEEP + VERGE_WAIT), 6);
        expect(pf(r.leaveVerge[0])[1]).toBeCloseTo(r.railV * (PAD_KEEP + VERGE_LEAVE), 6);
      });
    }
  });

  test('a boarding path ends at the parked front contact; a leaving path starts at the parked rear contact', () => {
    const env = envFor('1984');
    for (const leg of [0, 1]) {
      const tr = travelOf(leg);
      for (const m of legMovers(env.era.ancon.load.value, env.spec, env.layout, env.seats, 1984, leg)) {
        const b = boardPath(env, m, CAR_ROAD), end = pointAt(b, b.len, [0, 0]);
        const [x, z] = worldToDeck(departFrame(env, leg), end[0], end[1]);
        expect(x).toBeCloseTo(tr * (m.park.x + m.dims.wheelbase / 2), 6); expect(z).toBeCloseTo(m.park.z, 6);
        const l = leavePath(env, m, CAR_ROAD), start = pointAt(l, 0, [0, 0]);
        const [x2, z2] = worldToDeck(arriveFrame(env, leg), start[0], start[1]);
        expect(x2).toBeCloseTo(tr * (m.park.x - m.dims.wheelbase / 2), 6); expect(z2).toBeCloseTo(m.park.z, 6);
        // the queue head waits QUEUE_A m inland, in the right-hand lane (bicycles: on the verge, rail side)
        const f = departFrame(env, leg), q = pointAt(b, queueHeadS(b), [0, 0]), [qa, qv] = padFrame(f.pad, q[0], q[1]);
        const v = m.kind === 'bicycle' ? roadsOf(env, f).railV * (PAD_KEEP + VERGE_WAIT) : -PAD_KEEP;
        expect(qa).toBeCloseTo(QUEUE_A, 6); expect(qv).toBeCloseTo(v, 6);
      }
    }
  });
});
