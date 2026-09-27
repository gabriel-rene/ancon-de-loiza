// src/ancon/rigging.test.ts
import { expect, test } from 'vitest';
import { ERAS } from '../data/eras';
import { RIVER_DIR } from '../geo/constants';
import { sampleField, WATER } from '../terrain/fields';
import { LANDING_CLEARING } from '../vegetation/masks';
import { landingClearings, waterAt } from './geometry';
import { POST_H, ropeRig, shoreRopePost } from './rigging';
import { deckLayout, vesselSpec } from './spec';
import { fields512, geom512 } from './testing';

test.each([0, 8])('bank posts: on land, eye POST_H above the ground, inside the landing clearing, one per rope line (bankOffset %i)', (bank) => {
  const f = fields512(bank), g = geom512(bank), [cE, cW] = landingClearings(g);
  for (const e of ERAS.filter((x) => x.ancon.propulsion.value === 'ropes' || x.ancon.propulsion.value === 'moored')) {
    const L = deckLayout(vesselSpec(e)), rig = ropeRig(g, L, f);
    for (const [posts, c] of [[rig.east, cE], [rig.west, cW]] as const) for (const p of posts) {
      expect(waterAt(f, p[0], p[2]), e.id).toBe(WATER.LAND);
      expect(p[1]).toBeCloseTo(sampleField(f, f.height, p[0], p[2]) + POST_H, 6);
      expect(Math.hypot(p[0] - c[0], p[2] - c[1]), e.id).toBeLessThan(LANDING_CLEARING[0]);
    }
  }
  const s = shoreRopePost(g, f);
  expect(waterAt(f, s[0], s[2])).toBe(WATER.LAND);
  expect((s[0] - g.shoreEast[0]) * -RIVER_DIR[0] + (s[2] - g.shoreEast[1]) * -RIVER_DIR[1]).toBeGreaterThan(0); // upstream side
});
