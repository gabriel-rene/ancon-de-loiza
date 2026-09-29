import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { ERAS, getEra } from '../data/eras';
import { landingTop } from '../infrastructure/landing';
import { PAD, padFrame, padHeight } from '../terrain/landingPads';
import { landingPadsFor } from '../terrain/placementFields';
import { CROSSING_TIMINGS as T, legDuration } from './crossing';
import { apronRests, restLift } from './docking';
import { APRON_REST, BARGE_CLEAR } from './geometry';
import { apronLift, computeVesselPose, createVesselPose } from './pose';
import { APRON_UNDER, deckLayout, vesselSpec } from './spec';
import { ctxFor } from './testing';
import { buildVessel } from './vessels';
import type { VesselPart } from './vessels/common';

const setup = (e: (typeof ERAS)[number]) => {
  const spec = vesselSpec(e), L = deckLayout(spec), parts = buildVessel(spec, L, 1), look = e.infrastructure.landing.value;
  const pads = landingPadsFor(e.river.bankOffset.value);
  return { spec, L, parts, look, pads, rests: apronRests(parts, pads, look) };
};
/** Local (hull-frame) positions of an apron part turned to `lift` about its hinge. */
function* turned(part: VesselPart, lift: number) {
  const { end, hinge: [hx, hy] } = part.apron!, pos = part.geometry.attributes.position, c = Math.cos(end * lift), s = Math.sin(end * lift);
  for (let k = 0; k < pos.count; k++) {
    const dx = pos.getX(k) - hx, dy = pos.getY(k) - hy;
    yield [hx + dx * c - dy * s, hy + dx * s + dy * c, pos.getZ(k)] as const;
  }
}

/**
 * Docked, the ferry's end must sit ON the landing (spec 4a §6/§7): not under the terrain (sand through the
 * deck) and not floating over it. Pad frame: a = metres inland of the shore point.
 */
describe('the ferry docks on the landing', () => {
  for (const e of ERAS) test(`${e.id}: level at the waterline, the deck end / apron underside rests 0 … 5 cm above the landing`, () => {
    const { L, parts, look, pads, rests } = setup(e);
    if (L.apron === 0) {
      // Barge: its floor boards reach over the pad's end (the raked bow noses into the bank below it).
      for (const p of pads) {
        const gap = L.deckY - padHeight(p, APRON_REST);
        expect(gap, e.id).toBeGreaterThanOrEqual(0); expect(gap, e.id).toBeLessThanOrEqual(0.05);
      }
      return;
    }
    let n = 0;
    parts.forEach((part, i) => {
      if (!part.apron) return;
      n++;
      const end = part.apron.end, pad = pads[end === -1 ? 0 : 1];
      let min = Infinity;
      for (const [x, y] of turned(part, restLift(rests[i]!, 0, 0))) min = Math.min(min, y - landingTop(pad, look, APRON_REST - (L.reach - end * x)));
      expect(min, `${e.id} end ${end}`).toBeGreaterThanOrEqual(0);
      expect(min, `${e.id} end ${end}`).toBeLessThanOrEqual(0.05);
    });
    expect(n).toBe(2);
  });

  test('while docked the apron tip follows the hull (heave, pitch) and stays on the landing; the barge floor stays above the pad', () => {
    const q = new THREE.Vector3(), cycle = legDuration();
    for (const id of ['1840', '1900', '1925', '1935', '1959', '1975', '1984'] as const) {
      const e = getEra(id), { L, parts, look, pads, rests } = setup(e), ctx = ctxFor(id), pose = createVesselPose();
      let lo = Infinity, hi = -Infinity;
      for (let c = 0.5; c < T.load; c += 0.37) for (const leg of [0, 1]) {
        computeVesselPose(c + leg * cycle, ctx, pose);
        const pad = pads[leg];                                  // leg 0 loads at the east landing, leg 1 at the west (legs alternate)
        const pts: (readonly [number, number, number])[] = [];
        if (L.apron === 0) for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push([sx * (L.halfLength - 0.45), L.deckY, sz * (L.halfBeam - 0.15)]);
        else parts.forEach((part, i) => {
          if (part.apron?.end !== (leg ? 1 : -1)) return;
          const lift = apronLift(pose.state, part.apron.end, restLift(rests[i]!, pose.heave, pose.pitch));
          for (const v of turned(part, lift)) pts.push(v);
        });
        let contact = Infinity;                                 // this frame's smallest gap to the landing
        for (const [x, y, z] of pts) {
          q.set(x, y, z).applyMatrix4(pose.matrix);
          const [a] = padFrame(pad, q.x, q.z);
          if (a >= -PAD.wet) contact = Math.min(contact, q.y - (L.apron === 0 ? padHeight(pad, a) : landingTop(pad, look, a)));
        }
        lo = Math.min(lo, contact); hi = Math.max(hi, contact);
      }
      // Docked motion is small (DOCK_HOLD) and the tip follows it; roll still tips a corner a centimetre or two.
      expect(lo, id).toBeGreaterThan(-0.03);
      expect(hi, id).toBeLessThan(0.06);
    }
  });

  test('pad level per bank: lowered for the barges (bank offset 8) and for the wood aprons over timber/concrete (0)', () => {
    expect(landingPadsFor(8)[0].shoreY).toBeCloseTo(0.15 - BARGE_CLEAR, 9);
    expect(landingPadsFor(0)[0].shoreY).toBeLessThan(0.3);
    expect(landingPadsFor(0)[0].shoreY).toBeGreaterThan(0.2);
  });
  test('APRON_UNDER matches each kind\'s apron geometry', () => {
    for (const e of ERAS) {
      const { spec, L, parts } = setup(e);
      for (const p of parts) if (p.apron) {
        let min = Infinity;
        for (const [, y] of turned(p, 0)) min = Math.min(min, y);
        expect(L.deckY - min, e.id).toBeCloseTo(APRON_UNDER[spec.kind], 2);
      }
    }
  });
});
