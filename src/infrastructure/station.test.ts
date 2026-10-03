import { describe, expect, test } from 'vitest';
import { CLEAR_INLAND } from '../ancon/geometry';
import type { StationLook } from '../data/eras';
import { PAD, padFrame, padPoint, type LandingPad } from '../terrain/landingPads';
import { LANDING_CLEARING } from '../vegetation/masks';
import { corners, finish, makeBuilders, type Footprint } from './parts';
import { buildStation, stationLayout, upstreamSign } from './station';
import { rectsOverlap } from '../town/layout';

const pad: LandingPad = { side: 'east', shore: [0, 0], inland: [1, 0], lateral: [0, 1], hInland: 1.2, shoreY: PAD.shoreY };
const LOOKS: StationLook[] = ['shelter', 'woodThatch', 'woodZinc', 'concrete', 'concreteCanopy'];
const dry = () => true, flat = () => 1;
const all = (l: ReturnType<typeof stationLayout>) => [l.house, l.bar, l.canopy, l.shelter, l.neighbour].filter(Boolean) as Footprint[];

describe('station layout', () => {
  test('each look has the right buildings', () => {
    const l = (look: StationLook) => stationLayout(pad, look, false, 1, dry);
    expect(l('shelter').shelter).not.toBeNull(); expect(l('shelter').house).toBeNull();
    expect(l('woodZinc').house).not.toBeNull(); expect(l('woodZinc').bar).toBeNull();
    expect(l('concrete').bar).not.toBeNull(); expect(l('concrete').canopy).toBeNull();
    expect(l('concreteCanopy').bar).not.toBeNull(); expect(l('concreteCanopy').canopy).not.toBeNull();
  });
  test('everything stands inside the plant-free landing clearing, off the pad', () => {
    const [cx, cz] = padPoint(pad, CLEAR_INLAND, 0);
    for (const look of LOOKS) for (const fp of all(stationLayout(pad, look, false, 1, dry))) for (const [x, z] of corners(fp)) {
      expect(Math.hypot(x - cx, z - cz)).toBeLessThanOrEqual(LANDING_CLEARING[0]);
      const [a, v] = padFrame(pad, x, z);
      expect(Math.abs(v) > PAD.halfWidth + 1 || a > PAD.length + 1).toBe(true);
    }
  });
  test('the house and the neighbour stand upstream, the bar downstream, the canopy over the ramp top', () => {
    for (const s of [1, -1] as const) {
      const l = stationLayout(pad, 'concreteCanopy', false, s, dry), side = (f: Footprint) => Math.sign(padFrame(pad, ...f.c)[1]);
      expect(side(l.neighbour)).toBe(s);
      expect(side(l.house!)).toBe(s);
      expect(side(l.bar!)).toBe(-s);
      const [a, v] = padFrame(pad, ...l.canopy!.c);
      expect(Math.abs(v)).toBeLessThan(0.01);
      expect(a - l.canopy!.hx).toBeLessThan(PAD.length);
      expect(a + l.canopy!.hx).toBeGreaterThan(PAD.length);
      expect(side(stationLayout(pad, 'woodZinc', false, s, dry).house!)).toBe(s);
    }
  });
  test('a street\'s width runs between the Cortijo yard and the canopy', () => {
    for (const s of [1, -1] as const) {
      const l = stationLayout(pad, 'concreteCanopy', false, s, dry), edge = (f: Footprint) => Math.abs(padFrame(pad, ...f.c)[1]);
      expect(edge(l.house!) - l.house!.hz - (edge(l.canopy!) + l.canopy!.hz)).toBeGreaterThanOrEqual(4.5);
    }
  });
  test('no two buildings overlap', () => {
    for (const look of LOOKS) {
      const fps = all(stationLayout(pad, look, false, 1, dry));
      for (let i = 0; i < fps.length; i++) for (let j = i + 1; j < fps.length; j++) expect(rectsOverlap(fps[i], fps[j]), look).toBe(false);
    }
  });
  test('buildings slide inland off wet ground', () => {
    const l = stationLayout(pad, 'concrete', false, 1, (x) => x > 9);
    for (const fp of all(l)) for (const [x] of corners(fp)) expect(x).toBeGreaterThan(9);
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
    expect(build('concrete', false).sign).toBeDefined();
    expect(build('woodZinc', true).sign).toBeUndefined();
  });
  test('the El Ancón de Loíza sign rides the bar roof in 1975, the canopy from 1984', () => {
    const top = (look: StationLook) => {
      const p = build(look, false).sign!.attributes.position;
      let y = -Infinity; for (let i = 0; i < p.count; i++) y = Math.max(y, p.getY(i));
      return y;
    };
    expect(top('concrete')).toBeGreaterThan(flat() + 4);
    expect(top('concreteCanopy')).toBeGreaterThan(top('concrete') + 1);
  });
  test('lettering samples only its own atlas regions', () => {
    const uv = build('concreteCanopy', false).sign!.attributes.uv;
    for (let i = 0; i < uv.count; i++) { expect(uv.getX(i)).toBeGreaterThanOrEqual(0); expect(uv.getX(i)).toBeLessThanOrEqual(1); expect(uv.getY(i)).toBeGreaterThanOrEqual(0); }
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
