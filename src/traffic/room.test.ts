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

  test('helmsman yaw is continuous when he steps back aboard', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id);
      if (!env.spec.helmsman) continue;
      const T = env.spec.timings, Lg = legDuration(T), cache = new LegCache(env);
      const h = castActors(env.spec, env.seats, Number(id)).find((a) => a.role === 'helmsman')!;
      const ctx: ActorCtx = { spec: env.spec, layout: env.layout, loadAt: (l) => cache.get(l).load, groundLocal: () => 0 };
      for (const leg of [2, 3]) {
        const ld = cache.get(leg).load;
        if (!ld.helmAshore) continue;
        const back1 = ld.boardEnd + (Math.abs(ld.ashoreZ) + 1.5) / 1.4;   // back at his station (crew.ts: back0 + legA + legX)
        let prev: number | null = null;
        for (let t = back1 - 1; t < back1 + 2; t += 0.1) {
          const c = leg * Lg + t, y = actorFrame(h, crossingState(c, createCrossingState(), T), c, ctx, createActorFrame()).yaw;
          if (prev !== null) expect(Math.abs(Math.atan2(Math.sin(y - prev), Math.cos(y - prev))), `${id} leg ${leg} t=${t.toFixed(1)}`).toBeLessThan(0.5);
          prev = y;
        }
      }
    }
  });

  test('with a real load: boarders are at their spots before cast-off, leavers are gone before the leg ends, nobody walks through anybody', () => {
    for (const id of ERAS_WITH_LOAD) {
      const env = envFor(id), T = env.spec.timings, Lg = legDuration(T), cache = new LegCache(env);
      const actors = castActors(env.spec, env.seats, Number(id));
      const ctx: ActorCtx = { spec: env.spec, layout: env.layout, loadAt: (l) => cache.get(l).load, groundLocal: () => 0 };
      const gap = id === '1925' || id === '1935' ? 0.34 : 0.44;
      for (const leg of [2, 3]) {
        const at = (a: (typeof actors)[number], t: number) => { const c = leg * Lg + t; return actorFrame(a, crossingState(c, createCrossingState(), T), c, ctx, createActorFrame()); };
        for (const a of actors.filter((x) => x.role === 'passenger')) {
          const f = at(a, T.load);
          if (f.visible) expect(Math.hypot(f.pos[0] - a.spot!.pos[0], f.pos[2] - a.spot!.pos[2]), `${id} leg ${leg} pax${a.index} at spot`).toBeLessThan(0.05);
          expect(at(a, Lg - 0.001).visible, `${id} leg ${leg} pax${a.index} gone`).toBe(false);
        }
        for (let t = 0; t < Lg; t += 0.2) {
          const fs = actors.map((a) => at(a, t));
          for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
            if (!fs[i].visible || !fs[j].visible) continue;
            expect(Math.hypot(fs[i].pos[0] - fs[j].pos[0], fs[i].pos[2] - fs[j].pos[2]), `${id} leg ${leg} ${actors[i].role}${actors[i].index}/${actors[j].role}${actors[j].index} @${t.toFixed(1)}`).toBeGreaterThan(gap);
          }
        }
      }
    }
  });
});
