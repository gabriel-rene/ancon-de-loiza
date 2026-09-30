import { describe, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import type { CrewSet } from '../ancon/CrewSet';
import { legDuration } from '../ancon/crossing';
import { tris } from '../ancon/testing';
import { ERAS, type CarModel } from '../data/eras';
import { FIGURE_TRI_BUDGET_HI } from '../people/geometry';
import { createFigurePose, sitHipHeight, type PoseInput } from '../people/rig';
import { ROOF_CLEAR, SILHOUETTES, STEER_REACH, STEER_UP, UNDER_Y } from './carKit';
import { isCar } from './models';
import { LegCache } from './schedule';
import { envFor, poseFor } from './testing';
import { DRIVER_LEGS, seatDriver, TrafficSet, trafficLooks } from './TrafficSet';

// The wood material paints a canvas texture (no DOM in node); the meshes and their triangles do not depend on it.
vi.mock('./materials', async () => {
  const T = await import('three');
  const m = new T.MeshBasicMaterial();
  return { trafficMaterials: () => ({ paint: m, glass: m, trim: m, dark: m, wheel: m, hide: m, wood: m, bike: m }) };
});

describe('budget (spec 4c §7), measured on a real TrafficSet per era', () => {
  test('at most 14 meshes (draw calls, shadow twins aside) and 80 000 triangles drawn at once, people included', () => {
    for (const e of ERAS) {
      // Drivers and attendants go into the crew's figure batch: count the visible ones at the hi-tier figure budget.
      const shown = new Set<number>();
      const crew = { setExtra(k: number) { shown.add(k); }, hideExtra(k: number) { shown.delete(k); } } as unknown as CrewSet;
      const env = envFor(e.id), cache = new LegCache(env), set = new TrafficSet(env, cache, crew, false);
      const meshes = set.group.children.filter((o): o is THREE.InstancedMesh => (o as THREE.InstancedMesh).isInstancedMesh);
      expect(meshes.length, e.id).toBe(set.group.children.length);
      expect(meshes.length, e.id).toBeLessThanOrEqual(14);
      const Lg = legDuration(env.spec.timings);
      let worst = 0;
      if (meshes.length) for (let c = 2 * Lg; c < 4 * Lg; c += 0.5) {
        set.update(poseFor(env, c));
        worst = Math.max(worst, meshes.reduce((n, m) => n + (m.visible ? m.count * tris(m.geometry) : 0), shown.size * FIGURE_TRI_BUDGET_HI));
      }
      expect(worst, e.id).toBeLessThanOrEqual(80_000);
      set.dispose();
    }
  });
});

describe('drivers (spec 4c §5: the upper body shows through the glass)', () => {
  test('every planned driver sits on the seat, head under the roof lining, hands on the wheel', () => {
    for (const e of ERAS) {
      const env = envFor(e.id), cache = new LegCache(env), looks = trafficLooks(env), rules = e.ancon.load.value;
      const input: PoseInput = { kind: 'sit', phase: 0 }, fp = createFigurePose();
      for (let leg = 0; leg < 2 * Math.max(1, rules.length); leg++) for (const s of cache.get(leg).movers) {
        if (!isCar(s.m.kind)) continue;
        const kind = s.m.kind as CarModel, at = s.m.people[0].at, sil = SILHOUETTES[kind];
        expect(s.m.people[0].role).toBe('driver');
        for (const look of looks) {
          const body = { height: look.height, build: look.build, dress: look.dress }, hip = sitHipHeight(body, DRIVER_LEGS);
          const y = seatDriver(kind, at, body, input, fp), id = `${e.id} ${kind} h${look.height.toFixed(2)}`;
          expect(y + fp.headTop, `${id} head`).toBeLessThanOrEqual(sil.roof - ROOF_CLEAR + 1e-9);
          expect(y + hip, `${id} hip on the seat`).toBeLessThanOrEqual(at[1] + 1e-9);
          expect(y + hip, `${id} hip sunk at most 10 cm`).toBeGreaterThanOrEqual(at[1] - 0.1);
          expect(y, `${id} feet above the undercarriage's bottom (hidden in the body)`).toBeGreaterThanOrEqual(UNDER_Y);
          expect(y + hip, `${id} hip below the belt`).toBeLessThan(sil.belt);
          expect(y + fp.headTop, `${id} head above the belt`).toBeGreaterThan(sil.belt + 0.35);
          // Hands on the rim: figure-local grips ±0.17 m across, STEER_REACH ahead, at the wheel's height.
          for (const [h, x] of [[fp.handL, 0.17], [fp.handR, -0.17]] as const)
            expect(Math.hypot(h[0] - x, h[1] - (at[1] + STEER_UP - y), h[2] - STEER_REACH), `${id} hand`).toBeLessThan(0.03);
        }
      }
    }
  });
});
