import { WOOD, woodTone } from '../ancon/vessels/common';
import type { LandingLook } from '../data/eras';
import { PAD, padHeight, padPoint, padYaw, type LandingPad } from '../terrain/landingPads';
import { cellRng } from '../vegetation/rng';
import type { DirtPatch } from './groundMask';
import type { Builders } from './parts';

/** Concrete ramp (1975–86): 9 m wide, 6 cm above the pad, a 0.5 m slab (its sides hide the terrain), 1 m segments. Inferred. */
export const RAMP = { halfWidth: 4.5, lift: 0.06, thick: 0.5, step: 1 } as const;
const CONCRETE = 0xb9b4a8, CONCRETE_WET = 0x6f6a5f;

/** A 1 m-long box lying on the pad from a0 to a1, across [−hw, hw], its top `lift` above the pad. */
function onPad(b: Builders['wood'], p: LandingPad, a0: number, a1: number, v: number, hw: number, lift: number, thick: number, color: number) {
  const am = (a0 + a1) / 2, [x, z] = padPoint(p, am, v), y0 = padHeight(p, a0), y1 = padHeight(p, a1);
  const y = (y0 + y1) / 2 + lift - thick / 2, tilt = Math.atan2(y1 - y0, a1 - a0);
  b.box([a1 - a0 + 0.02, thick, 2 * hw], [x, y, z], color, tilt, padYaw(p));
}

export function buildLanding(b: Builders, p: LandingPad, look: LandingLook, seed: number) {
  const r = cellRng(seed, 7, 4401);
  if (look === 'timber') {
    // 1935–59: squared timber edging along both sides of the trodden slope, in four tilted lengths each, and
    // four mooring stakes out in the water. Short lengths so each log follows the curved slope.
    for (const side of [-1, 1]) for (const [a0, a1] of [[-1, 3], [3, 7.5], [7.5, 11.5], [11.5, PAD.length]] as const)
      onPad(b.wood, p, a0, a1, side * (PAD.halfWidth + 0.15), 0.15, 0.2, 0.3, woodTone(r).getHex());
    for (const side of [-1, 1]) for (const a of [-2.5, -5.5]) {
      const [x, z] = padPoint(p, a, side * (PAD.halfWidth + 1.5)), h = 2.8;
      b.wood.cylinder(0.09, 0.11, h, [x, -0.3, z], WOOD.dark.getHex(), 'y', 7);
    }
  } else if (look === 'concrete') {
    // 1975–86: a poured ramp from under the water to the top of the pad; darker where the river rises.
    for (let a = -PAD.wet; a < PAD.length; a += RAMP.step)
      onPad(b.concrete, p, a, Math.min(PAD.length, a + RAMP.step), 0, RAMP.halfWidth, RAMP.lift, RAMP.thick, a < 1.5 ? CONCRETE_WET : CONCRETE);
  }
}

/** Trodden dirt painted into the ground mask: the whole pad for the bare bank, the slope between the logs for timber. */
export function landingDirt(p: LandingPad, look: LandingLook): DirtPatch[] {
  if (look === 'concrete') return [];
  const [x, z] = padPoint(p, PAD.length / 2, 0), extra = look === 'bank' ? 3 : 0;
  return [{ c: [x, z], axis: [p.inland[0], p.inland[1]], hu: PAD.length / 2 + extra, hv: PAD.halfWidth + extra }];
}
