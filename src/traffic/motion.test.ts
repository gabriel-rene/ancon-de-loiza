import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { legDuration } from '../ancon/crossing';
import { moveEnd } from '../ancon/crew';
import type { EraId } from '../data/eras';
import { landingTop } from '../infrastructure/landing';
import { ROAD_LIFT } from '../infrastructure/roadStrip';
import { PAD, padFrame } from '../terrain/landingPads';
import { arriveFrame, departFrame, worldToDeck } from './env';
import { createMoverFrame, moverFrame } from './motion';
import { planLeg } from './schedule';
import { travelOf } from './plan';
import { deckHeight, envFor, obbOf, obbOverlap, poseFor } from './testing';

const ERAS_WITH_LOAD: EraId[] = ['1840', '1900', '1925', '1935', '1959', '1975', '1984'];

describe('moverFrame', () => {
  test('no teleports: consecutive samples move at most vmax·dt (+ deck heave)', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), Lg = legDuration(env.spec.timings), a = createMoverFrame(), b = createMoverFrame();
      for (const s of planLeg(env, 2).movers) {
        let prevVisible = false;
        for (let c = 1 * Lg; c < 3.5 * Lg; c += 0.1) {
          moverFrame(s, env, c, poseFor(env, c), a);
          if (a.visible && prevVisible) expect(a.front.distanceTo(b.front), `${id} ${s.m.id} @${c.toFixed(1)}`).toBeLessThan(6 * 0.1 + 0.05);
          prevVisible = a.visible; b.front.copy(a.front);
        }
      }
    }
  });

  test('movers appear and go away only far up the road', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), Lg = legDuration(env.spec.timings), fr = createMoverFrame();
      for (const s of planLeg(env, 2).movers) {
        let prev = false;
        for (let c = 1 * Lg; c < 3.6 * Lg; c += 0.25) {
          moverFrame(s, env, c, poseFor(env, c), fr);
          if (fr.visible !== prev) {
            const d = Math.min(...env.pads.map((p) => Math.hypot(fr.front.x - p.shore[0], fr.front.z - p.shore[1])));
            expect(d, `${id} ${s.m.id} ${fr.visible ? 'appears' : 'vanishes'} @${c}`).toBeGreaterThanOrEqual(60);   // global constraint: road ends ≥ 60 m inland
          }
          prev = fr.visible;
        }
      }
    }
  });

  test('parked at cast-off, on the deck, facing the way the ferry goes', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), T = env.spec.timings, Lg = legDuration(T), fr = createMoverFrame();
      for (const leg of [2, 3]) for (const s of planLeg(env, leg).movers) {
        const c = leg * Lg + T.load + 0.5, pose = poseFor(env, c);
        moverFrame(s, env, c, pose, fr);
        expect(fr.stage).toBe('park'); expect(fr.onDeck).toBe(true);
        const e = fr.matrix.elements, fwd = [e[0], e[2]], deckX = [Math.cos(pose.yaw), -Math.sin(pose.yaw)];
        expect(travelOf(leg) * (fwd[0] * deckX[0] + fwd[1] * deckX[1])).toBeGreaterThan(0.99);
      }
    }
  });

  test('wheels stand on the deck, the landing pad and the road (within 3 cm)', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), Lg = legDuration(env.spec.timings), fr = createMoverFrame(), L = env.layout;
      const local = new THREE.Vector3(), inv = new THREE.Matrix4();
      for (const s of planLeg(env, 2).movers) for (let c = 1.5 * Lg; c < 3.5 * Lg; c += 0.5) {
        const pose = poseFor(env, c);
        if (!moverFrame(s, env, c, pose, fr).visible) continue;
        const f = fr.stage === 'leave' ? arriveFrame(env, s.m.leg) : departFrame(env, s.m.leg);
        for (const p of [fr.front, fr.rear]) {
          if (fr.stage === 'park') {   // parked contacts ride the deck: deck-local height = the deck surface
            expect(Math.abs(local.copy(p).applyMatrix4(inv.copy(pose.matrix).invert()).y - L.deckY)).toBeLessThan(0.03);
            continue;
          }
          const [x, z] = worldToDeck(f, p.x, p.z), [a, v] = padFrame(f.pad, p.x, p.z);
          let want: number | null = null;
          if (Math.abs(x) <= L.halfLength - 0.05 && Math.abs(z) <= L.halfBeam) want = deckHeight(env, pose, x, z);
          else if (Math.abs(x) <= L.reach + 1) want = null;   // the apron / bow blend onto the bank
          else if (a >= 1 && a <= PAD.length && Math.abs(v) <= PAD.halfWidth) want = landingTop(f.pad, env.look, a);
          else if (a > PAD.length + 2 || Math.abs(v) > PAD.halfWidth + 2) want = env.groundAt(p.x, p.z) + ROAD_LIFT;
          if (want !== null) expect(Math.abs(p.y - want), `${id} ${s.m.id} ${fr.stage} @${c.toFixed(1)}`).toBeLessThan(0.03);
        }
      }
    }
  });

  test('the next load waits in line, still, when the ferry docks', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), T = env.spec.timings, Lg = legDuration(T), fr = createMoverFrame();
      for (const s of planLeg(env, 3).movers) {
        const c = 3 * Lg - T.unload - T.dock;   // leg 2 starts docking at the bank leg 3 leaves from
        moverFrame(s, env, c, poseFor(env, c), fr);
        expect(fr.stage, `${id} ${s.m.id}`).toBe('queue'); expect(fr.speed).toBe(0);
        const pad = env.frames[travelOf(3) > 0 ? 0 : 1].pad, [a] = padFrame(pad, fr.front.x, fr.front.z);
        expect(a).toBeGreaterThan(0.5);   // on land, not in the river
      }
    }
  });

  test('no two movers overlap at any time (three legs, both banks)', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), Lg = legDuration(env.spec.timings);
      const scheds = [1, 2, 3, 4].flatMap((leg) => planLeg(env, leg).movers), frs = scheds.map(createMoverFrame);
      for (let c = 2 * Lg; c < 4 * Lg; c += 0.2) {
        const pose = poseFor(env, c), boxes = scheds.map((s, i) => (moverFrame(s, env, c, pose, frs[i]).visible ? obbOf(frs[i], s.m.dims) : null));
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          if (boxes[i] && boxes[j]) expect(obbOverlap(boxes[i]!, boxes[j]!), `${id} ${scheds[i].m.id} × ${scheds[j].m.id} @${c.toFixed(1)}`).toBe(false);
        }
      }
    }
  });

  test('off the deck before the passengers leave; nothing on deck at the next cast-off', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), T = env.spec.timings, Lg = legDuration(T), fr = createMoverFrame(), p = planLeg(env, 2);
      for (const s of p.movers) {
        const c = 2 * Lg + moveEnd(T) + p.load.offEnd;
        moverFrame(s, env, c, poseFor(env, c), fr);
        expect(fr.onDeck, `${id} ${s.m.id}`).toBe(false);
      }
    }
  });
});
