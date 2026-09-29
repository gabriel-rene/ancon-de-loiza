import { describe, expect, test } from 'vitest';
import { WATER } from '../terrain/fields';
import { BRIDGE, bridgeCorridor, bridgePlan, buildBridge, deckTop } from './bridge';
import { finish, makeBuilders, triangleCount } from './parts';

const way: [number, number][] = [[0, 0], [300, 0]];
const water = (x: number) => (x > 90 && x < 210 ? WATER.RIVER : WATER.LAND);   // river over the middle 120 m
const ground = (x: number) => (x > 90 && x < 210 ? -2.5 : 1);

describe('bridge', () => {
  test('no bridge before 1984', () => {
    expect(bridgePlan(way, 'none', water, ground)).toBeNull();
  });
  test('spans of ~30 m follow the OSM line; the deck is highest mid-river and meets the ground at the ends', () => {
    const p = bridgePlan(way, 'open', water, ground)!;
    expect(p.spans.length).toBe(10);
    expect(p.spans.every((s) => s.built)).toBe(true);
    expect(deckTop(p, 0.5)).toBeCloseTo(BRIDGE.midY, 5);
    expect(deckTop(p, 0)).toBeCloseTo(1 + BRIDGE.endLift, 5);
    expect(deckTop(p, 1)).toBeCloseTo(1 + BRIDGE.endLift, 5);
  });
  test('1984: a gap over the middle of the river, both ends built', () => {
    const p = bridgePlan(way, 'building', water, ground)!, gap = p.spans.filter((s) => !s.built);
    expect(gap.length).toBeGreaterThanOrEqual(1);
    for (const s of gap) expect(water(((s.t0 + s.t1) / 2) * 300)).toBe(WATER.RIVER);
    expect(p.spans[0].built).toBe(true); expect(p.spans[p.spans.length - 1].built).toBe(true);
  });
  test('geometry per state: rails and lamps when open; forms and a crane when building', () => {
    const build = (state: 'building' | 'open') => { const b = makeBuilders(); buildBridge(b, bridgePlan(way, state, water, ground)!, state, ground); return finish(b); };
    const open = build('open'), building = build('building');
    expect(open.wood).toBeUndefined();                 // no formwork on the finished bridge
    expect(building.wood).toBeDefined();
    expect(open.concrete).toBeDefined(); expect(building.iron).toBeDefined();
    const tris = (o: ReturnType<typeof build>) => Object.values(o).reduce((n, g) => n + triangleCount(g!), 0);
    expect(tris(open)).toBeLessThan(20000); expect(tris(building)).toBeLessThan(20000);
  });
  test('piers reach down into the riverbed', () => {
    const b = makeBuilders(); buildBridge(b, bridgePlan(way, 'open', water, ground)!, 'open', ground);
    const p = finish(b).concrete!.attributes.position;
    let yMin = Infinity; for (let i = 0; i < p.count; i++) yMin = Math.min(yMin, p.getY(i));
    expect(yMin).toBeLessThan(-2.5);
  });
  test('the corridor covers the deck and a margin, nothing past the ends', () => {
    const inside = bridgeCorridor(way, BRIDGE.width / 2 + 3);
    expect(inside(150, 8)).toBe(true); expect(inside(150, 9)).toBe(false); expect(inside(-20, 0)).toBe(false);
  });
});
