import { describe, expect, test } from 'vitest';
import type { LandingPad } from '../terrain/landingPads';
import { PAD, padHeight } from '../terrain/landingPads';
import { buildLanding, landingDirt, RAMP } from './landing';
import { finish, makeBuilders } from './parts';

const pad: LandingPad = { side: 'east', shore: [0, 0], inland: [1, 0], lateral: [0, 1], hInland: 1.2 };
const built = (look: 'bank' | 'timber' | 'concrete') => { const b = makeBuilders(); buildLanding(b, pad, look, 1); return finish(b); };

describe('landings', () => {
  test('bare bank: no geometry, trodden dirt over the pad', () => {
    expect(Object.keys(built('bank'))).toEqual([]);
    const [d] = landingDirt(pad, 'bank');
    expect(d.hu).toBeGreaterThanOrEqual(PAD.length / 2); expect(d.hv).toBeGreaterThanOrEqual(PAD.halfWidth);
  });
  test('timber: edge logs along both sides and mooring stakes in the water', () => {
    const g = built('timber').wood!, p = g.attributes.position;
    let zMin = Infinity, zMax = -Infinity, xMin = Infinity;
    for (let i = 0; i < p.count; i++) { zMin = Math.min(zMin, p.getZ(i)); zMax = Math.max(zMax, p.getZ(i)); xMin = Math.min(xMin, p.getX(i)); }
    expect(zMax).toBeGreaterThan(PAD.halfWidth); expect(zMin).toBeLessThan(-PAD.halfWidth);
    expect(xMin).toBeLessThan(-2);   // stakes stand out in the river
  });
  test('concrete ramp: its top follows the pad, a little above it', () => {
    const g = built('concrete').concrete!, p = g.attributes.position;
    let top = 0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      if (Math.abs(p.getZ(i)) < RAMP.halfWidth - 0.01 && x > 0.5 && x < PAD.length - 0.5 && y > padHeight(pad, x)) {
        expect(y - padHeight(pad, x)).toBeLessThan(RAMP.lift + 0.12);   // slab top over a tilted 1 m segment
        top++;
      }
    }
    expect(top).toBeGreaterThan(10);
    expect(landingDirt(pad, 'concrete')).toEqual([]);
  });
});
