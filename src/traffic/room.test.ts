import { describe, expect, test } from 'vitest';
import { createCrossingState, crossingState, legDuration } from '../ancon/crossing';
import { actorFrame, castActors, createActorFrame, type ActorCtx } from '../ancon/crew';
import type { EraId } from '../data/eras';
import * as THREE from 'three';
import { createMoverFrame, moverFrame } from './motion';
import { LegCache } from './schedule';
import { discInObb, envFor, obbOf, poseFor } from './testing';

const ERAS_WITH_LOAD: EraId[] = ['1840', '1900', '1925', '1935', '1959', '1975', '1984'];

describe('crew and load', () => {
  test('nobody on board stands or walks inside a mover', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), T = env.spec.timings, Lg = legDuration(T), cache = new LegCache(env);
      const actors = castActors(env.spec, env.seats, Number(id));
      const ctx: ActorCtx = { spec: env.spec, layout: env.layout, loadAt: (l) => cache.get(l).load, groundLocal: () => 0 };
      const af = actors.map(createActorFrame), mf = [0, 1, 2, 3, 4].flatMap((l) => cache.get(l).movers).map((s) => ({ s, fr: createMoverFrame() }));
      const w = new THREE.Vector3();
      for (let c = 2 * Lg; c < 4 * Lg; c += 0.2) {
        const pose = poseFor(env, c), st = crossingState(c, createCrossingState(), T);
        const boxes = mf.map(({ s, fr }) => (moverFrame(s, env, c, pose, fr).visible ? obbOf(fr, s.m.dims) : null));
        actors.forEach((a, i) => {
          const f = actorFrame(a, st, c, ctx, af[i]);
          if (!f.visible) return;
          w.set(f.pos[0], f.pos[1], f.pos[2]).applyMatrix4(pose.matrix);
          boxes.forEach((b, j) => { if (b) expect(discInObb(w.x, w.z, 0.22, b), `${id} ${a.role}${a.index} × ${mf[j].s.m.id} @${c.toFixed(1)}`).toBe(false); });
        });
      }
    }
  });

  test('car eras keep someone standing on deck every leg', () => {
    for (const id of ['1935', '1959', '1975', '1984'] as const) {
      const env = envFor(id), T = env.spec.timings, Lg = legDuration(T), cache = new LegCache(env);
      const actors = castActors(env.spec, env.seats, Number(id)).filter((a) => a.role === 'passenger');
      const ctx: ActorCtx = { spec: env.spec, layout: env.layout, loadAt: (l) => cache.get(l).load };
      for (const leg of [0, 1, 2, 3]) {
        const c = leg * Lg + T.load + T.castOff + T.cross / 2, st = crossingState(c, createCrossingState(), T);
        expect(actors.filter((a) => actorFrame(a, st, c, ctx, createActorFrame()).visible).length, `${id} leg ${leg}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('without a load the crew is unchanged', () => {
    const env = envFor('1975'), T = env.spec.timings, actors = castActors(env.spec, env.seats, 1975);
    const a = { spec: env.spec, layout: env.layout }, b = { ...a, loadAt: () => ({ rects: [], boardEnd: 0, offEnd: 0, helmAshore: false, ashoreZ: 0 }) };
    for (let c = 0; c < legDuration(T); c += 1.3) {
      const st = crossingState(c, createCrossingState(), T);
      for (const x of actors) expect(actorFrame(x, st, c, b, createActorFrame())).toEqual(actorFrame(x, st, c, a, createActorFrame()));
    }
  });
});
