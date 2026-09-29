import { describe, expect, test } from 'vitest';
import { CLEAR_INLAND } from '../ancon/geometry';
import type { StationLook } from '../data/eras';
import { PAD, padFrame, padPoint, type LandingPad } from '../terrain/landingPads';
import { LANDING_CLEARING } from '../vegetation/masks';
import { corners, finish, makeBuilders, type Footprint } from './parts';
import { buildStation, stationLayout, upstreamSign } from './station';

const pad: LandingPad = { side: 'east', shore: [0, 0], inland: [1, 0], lateral: [0, 1], hInland: 1.2, shoreY: PAD.shoreY };
const LOOKS: StationLook[] = ['shelter', 'woodThatch', 'woodZinc', 'concrete'];
const dry = () => true, flat = () => 1;
const all = (l: ReturnType<typeof stationLayout>) => [l.house, l.terrace, l.shelter, l.neighbour].filter(Boolean) as Footprint[];

describe('station layout', () => {
  test('each look has the right buildings', () => {
    const l = (look: StationLook) => stationLayout(pad, look, false, 1, dry);
    expect(l('shelter').shelter).not.toBeNull(); expect(l('shelter').house).toBeNull();
    expect(l('woodZinc').house).not.toBeNull(); expect(l('woodZinc').terrace).toBeNull();
    expect(l('concrete').terrace).not.toBeNull();
  });
  test('everything stands inside the plant-free landing clearing, off the pad', () => {
    const [cx, cz] = padPoint(pad, CLEAR_INLAND, 0);
    for (const look of LOOKS) for (const fp of all(stationLayout(pad, look, false, 1, dry))) for (const [x, z] of corners(fp)) {
      expect(Math.hypot(x - cx, z - cz)).toBeLessThanOrEqual(LANDING_CLEARING[0]);
      const [a, v] = padFrame(pad, x, z);
      expect(Math.abs(v) > PAD.halfWidth + 1 || a > PAD.length + 1).toBe(true);
    }
  });
  test('the neighbour stands upstream, the Cortijo house downstream', () => {
    for (const s of [1, -1] as const) {
      const l = stationLayout(pad, 'woodZinc', false, s, dry);
      expect(Math.sign(padFrame(pad, ...l.neighbour.c)[1])).toBe(s);
      expect(Math.sign(padFrame(pad, ...l.house!.c)[1])).toBe(-s);
    }
  });
  test('buildings slide inland off wet ground', () => {
    const l = stationLayout(pad, 'concrete', false, 1, (x) => x > 12);
    for (const fp of all(l)) for (const [x] of corners(fp)) expect(x).toBeGreaterThan(12);
  });
  test('a demolished neighbour leaves bare dirt', () => {
    const n = (gone: boolean) => stationLayout(pad, 'concrete', gone, 1, dry).dirt.length;
    expect(n(true)).toBe(n(false) + 1);
  });
  test('upstream side is the bridge side', () => {
    expect(upstreamSign(pad, [[-100, 50], [-50, 300]])).toBe(1);
    expect(upstreamSign(pad, [[-100, -50], [-50, -300]])).toBe(-1);
  });
});

describe('station geometry', () => {
  const build = (look: StationLook, neighbour: boolean) => {
    const b = makeBuilders(), l = stationLayout(pad, look, false, 1, dry);
    buildStation(b, l, look, neighbour, flat, 1);
    return finish(b);
  };
  test('materials per look', () => {
    expect(Object.keys(build('shelter', false)).sort()).toEqual(['thatch', 'wood']);
    expect(build('woodThatch', false).thatch).toBeDefined();
    expect(build('woodZinc', true).zinc).toBeDefined();
    expect(build('concrete', false).concrete).toBeDefined();
  });
  test('wooden houses stand on posts that reach into the ground', () => {
    const g = build('woodZinc', false).wood!, p = g.attributes.position;
    let yMin = Infinity; for (let i = 0; i < p.count; i++) yMin = Math.min(yMin, p.getY(i));
    expect(yMin).toBeLessThan(flat() - 0.1);
  });
  test('the neighbour adds geometry only when present', () => {
    const n = (on: boolean) => build('woodZinc', on).wood!.attributes.position.count;
    expect(n(true)).toBeGreaterThan(n(false));
  });
});
