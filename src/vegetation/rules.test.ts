import { describe, expect, test } from 'vitest';
import { LANDCLS, WATER } from '../terrain/fields';
import { GROUND_ORDER, RULES } from './rules';
import type { Site, SpeciesId } from './types';

const site = (o: Partial<Site>): Site => ({
  water: WATER.LAND, depth: 0, shore: 10, seaDist: 400, riverDist: 100, roadDist: 50,
  height: 1, landCls: LANDCLS.GRASS, town: 0, clear: 0, ...o,
});
const NEW: SpeciesId[] = ['blackMangrove', 'whiteMangrove', 'buttonwood', 'almendro', 'seaGrape', 'grass', 'reeds', 'morningGlory'];

describe('habitat rules', () => {
  test('nothing grows in the sea, the river channel or on a road', () => {
    for (const id of NEW) {
      expect(RULES[id].density(site({ water: WATER.SEA, depth: 3 })), id).toBe(0);
      expect(RULES[id].density(site({ water: WATER.RIVER, depth: 2.5 })), id).toBe(0);
      expect(RULES[id].density(site({ roadDist: 1 })), id).toBe(0);
    }
  });
  test('each species has its habitat', () => {
    expect(RULES.blackMangrove.density(site({ landCls: LANDCLS.WETLAND, riverDist: 25, height: 0.8 }))).toBeGreaterThan(0.5);
    expect(RULES.whiteMangrove.density(site({ riverDist: 10, height: 0.8 }))).toBeGreaterThan(0.3);
    expect(RULES.buttonwood.density(site({ riverDist: 70, height: 1.5, landCls: LANDCLS.SCRUB }))).toBeGreaterThan(0.2);
    expect(RULES.almendro.density(site({ riverDist: 12 }))).toBeGreaterThan(0.1);
    expect(RULES.seaGrape.density(site({ seaDist: 25, landCls: LANDCLS.SAND }))).toBeGreaterThan(0.4);
    expect(RULES.morningGlory.density(site({ seaDist: 15, landCls: LANDCLS.SAND }))).toBeGreaterThan(0.4);
    expect(RULES.grass.density(site({}))).toBeGreaterThan(0.6);
    expect(RULES.reeds.density(site({ riverDist: 3, height: 0.4 }))).toBeGreaterThan(0.4);
  });
  test('each species stays out of the wrong place', () => {
    expect(RULES.blackMangrove.density(site({ seaDist: 30 }))).toBe(0);               // not on the surf coast
    expect(RULES.blackMangrove.density(site({ riverDist: 200, height: 3 }))).toBe(0);  // not on high, dry land
    expect(RULES.buttonwood.density(site({ riverDist: 3 }))).toBe(0);                  // not in the mangrove fringe
    expect(RULES.seaGrape.density(site({ seaDist: 300 }))).toBe(0);                    // beach only
    expect(RULES.morningGlory.density(site({ seaDist: 300 }))).toBe(0);
    expect(RULES.grass.density(site({ seaDist: 20, landCls: LANDCLS.SAND }))).toBe(0); // no pasture on the beach
    expect(RULES.grass.density(site({ landCls: LANDCLS.WETLAND }))).toBe(0);
    expect(RULES.reeds.density(site({ riverDist: 60 }))).toBe(0);
  });
  test('inland OSM woodland (wood/scrub) carries a thin stand of palms and almendros; open pasture stays open (6a item 2)', () => {
    const wood = site({ landCls: LANDCLS.WOOD, seaDist: 500, riverDist: 300 }), scrub = { ...wood, landCls: LANDCLS.SCRUB }, open = { ...wood, landCls: LANDCLS.GRASS };
    expect(RULES.coconut.density(wood)).toBeGreaterThan(0.05);
    expect(RULES.coconut.density(wood)).toBeLessThan(0.3);
    expect(RULES.coconut.density(scrub)).toBeGreaterThan(0);
    expect(RULES.coconut.density(scrub)).toBeLessThan(RULES.coconut.density(wood));
    expect(RULES.coconut.density(open)).toBe(0);
    expect(RULES.almendro.density(wood)).toBeGreaterThan(0.05);
    expect(RULES.almendro.density(wood)).toBeLessThan(0.2);
    expect(RULES.almendro.density(open)).toBe(0);
  });
  test('ground cover is its own layer', () => {
    expect([...GROUND_ORDER].sort()).toEqual(['grass', 'morningGlory', 'reeds']);
  });
});
