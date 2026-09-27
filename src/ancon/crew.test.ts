// src/ancon/crew.test.ts
import { describe, expect, test } from 'vitest';
import { ERAS, getEra, type EraId } from '../data/eras';
import type { V3 } from '../people/rig';
import { createCrossingState, CROSSING_TIMINGS as T, crossingState, legDuration } from './crossing';
import { actorFrame, castActors, createActorFrame, POLE_BED, PUSH, STROKE_S, TURN_S, type Actor, type ActorFrame } from './crew';
import { POLE_LEN } from './pole';
import { seatAnchors } from './seats';
import { lerp } from './ease';
import { GUNWALE_TOP } from './vessels/timberBarge';
import { deckLayout, vesselSpec } from './spec';

const L = legDuration(), L_LEG = L, MID = T.load + T.castOff + T.cross / 2;
const setup = (id: EraId, scale = 1) => {
  const spec = vesselSpec(getEra(id)), layout = deckLayout(spec);
  return { spec, layout, actors: castActors(spec, seatAnchors(spec, layout), Number(id), scale) };
};
type Setup = ReturnType<typeof setup>;
const frame = (s: Setup, a: Actor, c: number) => actorFrame(a, crossingState(c, createCrossingState()), c, s, createActorFrame());
const toDeck = (p: V3, f: ActorFrame): V3 => {
  const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
  return [f.pos[0] + p[0] * c + p[2] * s, f.pos[1] + p[1], f.pos[2] - p[0] * s + p[2] * c];
};
const wrap = (a: number) => Math.abs(((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI);

describe('cast', () => {
  test('roles per era', () => {
    const n = (id: EraId, role: string) => setup(id).actors.filter((a) => a.role === role).length;
    expect([n('1925', 'poler'), n('1925', 'helmsman')]).toEqual([1, 1]);
    expect([n('1840', 'poler'), n('1840', 'helmsman')]).toEqual([2, 1]);
    expect(n('1975', 'hauler')).toBe(3); expect(n('1975', 'passenger')).toBe(7);
    expect(setup('1986').actors).toEqual([]);
    expect(setup('1984').actors.find((a) => a.role === 'hauler' && a.index === 0)!.look.female).toBe(true);
    expect(setup('1975', 0.5).actors.filter((a) => a.role === 'passenger').length).toBe(4);
  });
});

describe('choreography', () => {
  test('haulers keep both hands on the rope line while hauling', () => {
    for (const id of ['1935', '1975', '1984'] as EraId[]) {
      const s = setup(id);
      for (const a of s.actors.filter((x) => x.role === 'hauler')) for (let c = MID; c < MID + 4; c += 0.37) {
        const f = frame(s, a, c);
        expect(f.pose.kind).toBe('haul');
        for (const h of [f.handL, f.handR]) {
          const d = toDeck(h, f);
          expect(Math.abs(Math.abs(d[2]) - s.layout.ropeZ)).toBeLessThan(1e-9);
          expect(d[1] - s.layout.guideY).toBeGreaterThanOrEqual(-1e-9);
          expect(d[1] - s.layout.guideY).toBeLessThan(0.09);
          expect(Math.abs(d[0] - f.pos[0])).toBeLessThanOrEqual(0.41);
        }
      }
    }
  });
  test('polers push with the pole biting the bed outside the hull, and lift it to recover', () => {
    for (const id of ['1840', '1925'] as EraId[]) {
      const s = setup(id);
      let pushes = 0, recoveries = 0;
      for (const a of s.actors.filter((x) => x.role === 'poler')) for (let c = MID; c < MID + 14; c += 0.25) {
        const f = frame(s, a, c), psi = (((c - T.load) / STROKE_S + a.index * 0.5) % 1 + 1) % 1, blend = TURN_S / STROKE_S + 0.01;
        expect(Math.hypot(f.poleTop[0] - f.poleTip[0], f.poleTop[1] - f.poleTip[1], f.poleTop[2] - f.poleTip[2])).toBeCloseTo(POLE_LEN, 6);
        if (psi > blend && psi < PUSH) {
          pushes++;
          expect(f.poleTip[1]).toBeCloseTo(-POLE_BED, 6);
          expect(Math.abs(f.poleTip[2])).toBeGreaterThan(s.layout.halfBeam);
        } else if (psi > PUSH + blend) { recoveries++; expect(f.poleTip[1]).toBeGreaterThan(0); }
      }
      expect(pushes).toBeGreaterThan(10); expect(recoveries).toBeGreaterThan(3);
    }
  });
  test('hands stay on the pole; poles never pass through the hull side (gunwale cap / deck edge) or below the floor', () => {
    for (const id of ['1840', '1900', '1925'] as EraId[]) {
      const s = setup(id), L = s.layout, rail = L.deckY + (s.spec.kind === 'timberBarge' ? GUNWALE_TOP : 0), R = 0.045;
      for (const a of s.actors.filter((x) => (x.role === 'poler' || x.role === 'helmsman'))) for (let c = 0; c <= 2 * L_LEG; c += 0.2) {
        const f = frame(s, a, c), tag = `${id} ${a.role}${a.index} @${c.toFixed(1)}`;
        for (const h of [f.handL, f.handR]) {   // both grip points on the pole axis
          const d = toDeck(h, f), ax = [f.poleTop[0] - f.poleTip[0], f.poleTop[1] - f.poleTip[1], f.poleTop[2] - f.poleTip[2]].map((v) => v / POLE_LEN);
          const t = (d[0] - f.poleTip[0]) * ax[0] + (d[1] - f.poleTip[1]) * ax[1] + (d[2] - f.poleTip[2]) * ax[2];
          expect(Math.hypot(d[0] - f.poleTip[0] - ax[0] * t, d[1] - f.poleTip[1] - ax[1] * t, d[2] - f.poleTip[2] - ax[2] * t), `${tag} hand`).toBeLessThan(1e-6);
        }
        for (let k = 0; k <= 60; k++) {
          const u = k / 60, x = lerp(f.poleTop[0], f.poleTip[0], u), y = lerp(f.poleTop[1], f.poleTip[1], u), z = Math.abs(lerp(f.poleTop[2], f.poleTip[2], u));
          if (Math.abs(x) > L.halfLength) continue;
          if (z > L.halfBeam - 0.1 - R && z < L.halfBeam + R) expect(y, `${tag} side`).toBeGreaterThan(rail + R - 1e-9);
          else if (z <= L.halfBeam - 0.1 - R) expect(y, `${tag} floor`).toBeGreaterThan(L.deckY - 1e-9);
        }
      }
    }
  });
  test('the helmsman steers from the trailing end, his pole in the water', () => {
    const s = setup('1925'), a = s.actors.find((x) => x.role === 'helmsman')!;
    for (const c of [MID, L + MID]) {
      const f = frame(s, a, c), st = crossingState(c, createCrossingState());
      expect(Math.sign(f.pos[0])).toBe(-st.travel);
      expect(f.poleTip[1]).toBeLessThan(0);
    }
  });
  test('passengers board during load, stand through the crossing, leave during unload', () => {
    for (const e of ERAS) {
      const s = setup(e.id);
      for (const a of s.actors.filter((x) => x.role === 'passenger')) {
        expect(frame(s, a, 0.5).visible).toBe(false);
        const standing = frame(s, a, T.load - 0.01);
        expect(standing.visible, `${e.id} p${a.index} aboard by cast-off`).toBe(true);
        expect(standing.pose.kind).toBe('stand');
        expect(standing.pos[0]).toBeCloseTo(a.spot!.pos[0], 9); expect(standing.pos[2]).toBeCloseTo(a.spot!.pos[2], 9);
        expect(frame(s, a, MID).pos).toEqual(standing.pos);
        expect(frame(s, a, L - 0.01).visible, `${e.id} p${a.index} ashore by the end of unload`).toBe(false);
      }
    }
  });
  test('everyone stays on the deck; feet and heading move continuously over a round trip', () => {
    for (const e of ERAS) {
      const s = setup(e.id);
      for (const a of s.actors) {
        let prev: ActorFrame | null = null;
        for (let c = 0; c <= 2 * L; c += 0.1) {
          const f = frame(s, a, c), tag = `${e.id} ${a.role}${a.index} @${c.toFixed(1)}`;
          if (f.visible) {
            expect(Math.abs(f.pos[0]), tag).toBeLessThanOrEqual(s.layout.halfLength + 1e-9);
            expect(Math.abs(f.pos[2]), tag).toBeLessThanOrEqual(s.layout.halfBeam + 1e-9);
            if (prev?.visible) {
              expect(Math.hypot(f.pos[0] - prev.pos[0], f.pos[2] - prev.pos[2]), tag).toBeLessThan(0.3);
              expect(wrap(f.yaw - prev.yaw), tag).toBeLessThan(0.8);
              if (f.hasPole && prev.hasPole) {   // poles swing, never pop (≤ 1.5 m per 0.1 s at either end; the brisk stroke swings reach ≈ 1.2)
                expect(Math.hypot(f.poleTip[0] - prev.poleTip[0], f.poleTip[1] - prev.poleTip[1], f.poleTip[2] - prev.poleTip[2]), `${tag} tip`).toBeLessThan(1.5);
                expect(Math.hypot(f.poleTop[0] - prev.poleTop[0], f.poleTop[1] - prev.poleTop[1], f.poleTop[2] - prev.poleTop[2]), `${tag} top`).toBeLessThan(1.5);
              }
            }
          }
          prev = structuredClone(f);
        }
      }
    }
  });
  test('nobody walks through anybody, and no pole through a body (round trip, every era)', () => {
    // Body axes a shoulder width (0.44 m) apart. On the two narrowest decks the only standing rows lie 0.35 m from
    // the lane or the polers' side lane (1925: beside the car slot; 1935: both rows either side of the 0.5 m lane),
    // so shoulders may brush in passing there. A pole's axis ≥ 0.27 m from anyone else's body axis (deck to 1.9 m).
    const poleGap = (f: ActorFrame, x: number, z: number, y0: number) => {
      let best = Infinity;
      for (let k = 0; k <= 40; k++) {
        const u = k / 40, y = lerp(f.poleTip[1], f.poleTop[1], u);
        const dy = y < y0 ? y0 - y : y > y0 + 1.9 ? y - y0 - 1.9 : 0;
        best = Math.min(best, Math.hypot(lerp(f.poleTip[0], f.poleTop[0], u) - x, lerp(f.poleTip[2], f.poleTop[2], u) - z, dy));
      }
      return best;
    };
    for (const e of ERAS) {
      const s = setup(e.id), gap = e.id === '1925' || e.id === '1935' ? 0.34 : 0.44;
      for (let c = 0; c < 2 * L_LEG; c += 0.2) {
        const fs = s.actors.map((a) => frame(s, a, c));
        for (let i = 0; i < fs.length; i++) for (let j = 0; j < fs.length; j++) {
          if (i === j || !fs[i].visible || !fs[j].visible) continue;
          const tag = `${e.id} ${s.actors[i].role}${s.actors[i].index}/${s.actors[j].role}${s.actors[j].index} @${c.toFixed(1)}`;
          if (j > i) expect(Math.hypot(fs[i].pos[0] - fs[j].pos[0], fs[i].pos[2] - fs[j].pos[2]), tag).toBeGreaterThan(gap);
          if (fs[i].hasPole) expect(poleGap(fs[i], fs[j].pos[0], fs[j].pos[2], s.layout.deckY), `${tag} pole`).toBeGreaterThan(0.27);
        }
      }
    }
  });
  test('deterministic', () => {
    const s = setup('1975');
    for (const a of s.actors) expect(frame(s, a, 123.45)).toEqual(frame(s, a, 123.45));
  });
  test('the helmsman crosses the deck only after the passengers have left (unload)', () => {
    for (const id of ['1840', '1900', '1925'] as EraId[]) {
      const s = setup(id), helm = s.actors.find((x) => x.role === 'helmsman')!, pax = s.actors.filter((x) => x.role === 'passenger');
      for (let c = T.load + T.castOff + T.cross + T.dock; c < L; c += 0.1) {
        const h = frame(s, helm, c);
        for (const p of pax) {
          const f = frame(s, p, c);
          if (f.visible) expect(Math.hypot(f.pos[0] - h.pos[0], f.pos[2] - h.pos[2]), `${id} @${c.toFixed(1)}`).toBeGreaterThan(0.6);
        }
      }
    }
  });
});
