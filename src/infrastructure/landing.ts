import * as THREE from 'three';
import { WOOD, woodTone } from '../ancon/vessels/common';
import type { LandingLook } from '../data/eras';
import { PAD, padHeight, padPoint, padYaw, type LandingPad } from '../terrain/landingPads';
import { cellRng } from '../vegetation/rng';
import type { DirtPatch } from './groundMask';
import type { Builders } from './parts';

/** Concrete ramp (1975–86): 9 m wide, 6 cm above the pad, a 0.5 m slab (its sides hide the terrain), 1 m segments. Inferred. */
export const RAMP = { halfWidth: 4.5, lift: 0.06, thick: 0.5, step: 1 } as const;
const DRY = new THREE.Color(0xa29d90), WORN = new THREE.Color(0x7d786d), WET = new THREE.Color(0x57534a), KERB = 0x8f8a7e;
/** Lanes across the ramp (v from, v to, worn by tyres?): two darker wheel tracks on light concrete. */
const LANES: [number, number, boolean][] = [[-4.5, -2.7, false], [-2.7, -1.3, true], [-1.3, 1.3, false], [1.3, 2.7, true], [2.7, 4.5, false]];
const _c = new THREE.Color();

/** Height of the landing surface `a` m inland on pad `p` (the ramp's top on a concrete landing, else the pad). */
export const landingTop = (p: LandingPad, look: LandingLook, a: number) => padHeight(p, a) + landingLift(look);
/** How far the landing's surface stands above the pad (the concrete ramp's lift; 0 on bare bank and timber). */
export const landingLift = (look: LandingLook) => (look === 'concrete' ? RAMP.lift : 0);

/** A 1 m-long box lying on the pad from a0 to a1, across [−hw, hw], its top `lift` above the pad. */
function onPad(b: Builders['concrete'], p: LandingPad, a0: number, a1: number, v: number, hw: number, lift: number, thick: number, color: number) {
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
    // 1975–86: a poured ramp from under the water to the top of the pad: darker wheel tracks, wet and
    // stained where the river rises, a slightly different tone per pour, low kerbs along both sides.
    for (let a = -PAD.wet; a < PAD.length; a += RAMP.step) {
      const a1 = Math.min(PAD.length, a + RAMP.step), wet = 1 - Math.min(1, Math.max(0, (a + 1) / 4)), tone = 0.94 + 0.1 * r();
      for (const [v0, v1, worn] of LANES) {
        _c.copy(worn ? WORN : DRY).lerp(WET, wet).multiplyScalar(tone);
        onPad(b.concrete, p, a, a1, (v0 + v1) / 2, (v1 - v0) / 2, RAMP.lift, RAMP.thick, _c.getHex());
      }
    }
    for (const side of [-1, 1]) for (let a = -1; a < PAD.length; a += 4)
      onPad(b.concrete, p, a, Math.min(PAD.length, a + 4), side * (RAMP.halfWidth + 0.12), 0.12, RAMP.lift + 0.15, 0.4, KERB);
  }
}

/** Trodden dirt painted into the ground mask: the whole pad for the bare bank, the slope between the logs for timber. */
export function landingDirt(p: LandingPad, look: LandingLook): DirtPatch[] {
  if (look === 'concrete') return [];
  const [x, z] = padPoint(p, PAD.length / 2, 0), extra = look === 'bank' ? 3 : 0;
  return [{ c: [x, z], axis: [p.inland[0], p.inland[1]], hu: PAD.length / 2 + extra, hv: PAD.halfWidth + extra }];
}
