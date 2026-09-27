import { describe, expect, test } from 'vitest';
import { type EraId } from '../data/eras';
import { RIVER_DIR } from '../geo/constants';
import { CROSSING_TIMINGS as T, createCrossingState, crossingState, legDuration } from './crossing';
import { apronLift, computeVesselPose, createVesselPose } from './pose';
import { ctxFor } from './testing';

const L = legDuration(), MID = T.load + T.castOff + T.cross / 2;
const poseAt = (id: EraId, c: number, flow?: number) => computeVesselPose(c, ctxFor(id, flow), createVesselPose());

describe('vessel pose', () => {
  test('docked at the east landing loading leg 0, at the west landing unloading it', () => {
    const ctx = ctxFor('1975'), e = ctx.dockEast, w = ctx.dockWest;
    const a = poseAt('1975', 5), b = poseAt('1975', L - 3);
    expect(Math.hypot(a.position.x - e[0], a.position.z - e[1])).toBeLessThan(1e-6);
    expect(Math.hypot(b.position.x - w[0], b.position.z - w[1])).toBeLessThan(1e-6);
  });
  test('mid-river the current pushes it downstream (along RIVER_DIR); ropes hold better than poles', () => {
    for (const id of ['1925', '1935'] as const) {
      const ctx = ctxFor(id), p = poseAt(id, MID), st = crossingState(MID, createCrossingState());
      const e = ctx.dockEast, w = ctx.dockWest;
      const sx = e[0] + (w[0] - e[0]) * st.s, sz = e[1] + (w[1] - e[1]) * st.s;
      expect((p.position.x - sx) * RIVER_DIR[0] + (p.position.z - sz) * RIVER_DIR[1]).toBeCloseTo(p.drift, 6);
    }
    expect(poseAt('1925', MID, 0.6).drift).toBeGreaterThan(2);
    expect(poseAt('1935', MID, 0.6).drift).toBeGreaterThan(0);
    expect(poseAt('1935', MID, 0.6).drift).toBeLessThan(poseAt('1925', MID, 0.6).drift);
    expect(poseAt('1925', 5).drift).toBeCloseTo(0, 9);
  });
  test('the crew crabs the leading end slightly upstream', () => {
    const p = poseAt('1925', MID), up = [-RIVER_DIR[0], -RIVER_DIR[1]];
    const h = [Math.cos(p.yaw), -Math.sin(p.yaw)], h0 = ctxFor('1925').geom.dir;
    expect(h[0] * up[0] + h[1] * up[1]).toBeGreaterThan(h0[0] * up[0] + h0[1] * up[1]);
    expect(Math.abs(p.yaw - ctxFor('1925').geom.yaw)).toBeLessThan(0.06);
  });
  test('small motion: |pitch|, |roll| < 0.05 rad, |heave| < 0.06 m; the steel barge moves less than the 1840 barge', () => {
    let big = 0, small = 0;
    for (let c = 0; c < 2 * L; c += 0.5) {
      for (const id of ['1840', '1984'] as const) {
        const p = poseAt(id, c);
        expect(Math.abs(p.pitch)).toBeLessThan(0.05); expect(Math.abs(p.roll)).toBeLessThan(0.05); expect(Math.abs(p.heave)).toBeLessThan(0.06);
      }
      small = Math.max(small, Math.abs(poseAt('1840', c).roll)); big = Math.max(big, Math.abs(poseAt('1984', c).roll));
    }
    expect(big).toBeLessThan(small);
  });
  test('cruise ≈ 1 m/s (dock-to-dock line = span − 2·(reach − APRON_REST), 122–138 m) and a matrix that matches position', () => {
    for (const id of ['1935', '1984'] as EraId[]) {
      const ctx = ctxFor(id);
      expect(ctx.lineLen).toBeGreaterThan(115); expect(ctx.lineLen).toBeLessThan(160);
      expect(Math.abs(poseAt(id, MID).speed)).toBeGreaterThan(0.85); expect(Math.abs(poseAt(id, MID).speed)).toBeLessThan(1.3);
    }
    const p = poseAt('1984', MID);
    expect(p.matrix.elements[12]).toBeCloseTo(p.position.x, 9); expect(p.matrix.elements[14]).toBeCloseTo(p.position.z, 9);
  });
  test('deterministic, writes into out', () => {
    const ctx = ctxFor('1959'), o = createVesselPose();
    expect(computeVesselPose(77.7, ctx, o)).toBe(o);
    const m = o.matrix.elements.slice();
    computeVesselPose(12, ctx, o); computeVesselPose(77.7, ctx, o);
    expect(o.matrix.elements).toEqual(m);
  });
  test('1986: moored at the Loíza landing, bobbing only', () => {
    const ctx = ctxFor('1986'), e = ctx.dockEast;
    for (const c of [0, 100, 250, 900]) {
      const p = poseAt('1986', c);
      expect(Math.hypot(p.position.x - e[0], p.position.z - e[1])).toBeLessThan(1e-9); expect(p.speed).toBe(0);
    }
  });
  test('aprons: the docked end rests down, both are raised mid-crossing', () => {
    const st = crossingState(5, createCrossingState());          // at the east dock
    expect(apronLift(st, -1)).toBeLessThan(0); expect(apronLift(st, 1)).toBeGreaterThan(0);
    const mid = crossingState(MID, createCrossingState());
    expect(apronLift(mid, -1)).toBeGreaterThan(0); expect(apronLift(mid, 1)).toBeGreaterThan(0);
    const west = crossingState(L - 3, createCrossingState());
    expect(apronLift(west, 1)).toBeLessThan(0);
  });
});
