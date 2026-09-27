// src/ancon/wake.test.ts
import { expect, test } from 'vitest';
import { waterFragment } from '../scene/water/waterShader';
import { CROSSING_TIMINGS as T, legDuration } from './crossing';
import { computeVesselPose, createVesselPose } from './pose';
import { ctxFor } from './testing';
import { WAKE_DT, WAKE_N, writeWake } from './wake';
import { clearWakeUniforms, updateWakeUniforms, wakeUniforms } from './wakeUniforms';

const ctx = ctxFor('1975'), layout = ctx.layout;
const MID = T.load + T.castOff + T.cross / 2, L = legDuration();
const run = (c: number, context = ctx) => writeWake(c, context, new Float32Array(4 * WAKE_N), createVesselPose());

test('sample 0 is the trailing end now; ages step by WAKE_DT', () => {
  const w = run(MID), p = computeVesselPose(MID, ctx, createVesselPose());
  const hx = Math.cos(p.yaw), hz = -Math.sin(p.yaw);
  expect(w[0]).toBeCloseTo(p.position.x - hx * layout.reach * p.travel, 4);
  expect(w[1]).toBeCloseTo(p.position.z - hz * layout.reach * p.travel, 4);
  for (let i = 0; i < WAKE_N; i++) expect(w[i * 4 + 2]).toBeCloseTo(i * WAKE_DT, 9);
});
test('mid-crossing the trail lies behind at full strength; exactly 0 whenever the ferry is docked', () => {
  const w = run(MID), p = computeVesselPose(MID, ctx, createVesselPose());
  const hx = Math.cos(p.yaw) * p.travel, hz = -Math.sin(p.yaw) * p.travel;
  for (let i = 1; i < WAKE_N; i++) expect((w[i * 4] - w[0]) * hx + (w[i * 4 + 1] - w[1]) * hz).toBeLessThan(0);
  expect(w[3]).toBeGreaterThan(0.8);
  for (const c of [5, T.load - 0.5, L - 3, L + 5]) {          // loading / unloading on both banks, just after a crossing
    const d = run(c);
    for (let i = 0; i < WAKE_N; i++) expect(d[i * 4 + 3], `c=${c} sample ${i}`).toBe(0);
  }
  const moored = run(MID, ctxFor('1986'));
  for (let i = 0; i < WAKE_N; i++) expect(moored[i * 4 + 3]).toBe(0);
});
test('deterministic', () => { expect(Array.from(run(123.4))).toEqual(Array.from(run(123.4))); });
test('the water shader declares the same number of wake samples', () => {
  expect(waterFragment).toContain(`uniform vec4 uWake[${WAKE_N}]`);
  expect(waterFragment).toContain(`i < ${WAKE_N - 1}`);
  expect(waterFragment).not.toMatch(/pow\(\s*\(dd/);   // no pow() with a possibly negative base
});
test('the shader-side trail box holds every live sample (hull-local) and is empty when docked', () => {
  const box = wakeUniforms.uWakeBox.value, w = wakeUniforms.uWake.value;
  const p = computeVesselPose(MID, ctx, createVesselPose());
  updateWakeUniforms(p, ctx);
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  for (let i = 0; i < WAKE_N; i++) {
    if (w[i * 4 + 3] <= 0) continue;
    const dx = w[i * 4] - p.position.x, dz = w[i * 4 + 1] - p.position.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    expect(lx).toBeGreaterThan(box.x); expect(lx).toBeLessThan(box.y);
    expect(lz).toBeGreaterThan(box.z); expect(lz).toBeLessThan(box.w);
  }
  expect(box.y - box.x).toBeLessThan(60);                       // ≈ 22 s of track at ~1 m/s + spread, not the whole river
  updateWakeUniforms(computeVesselPose(5, ctx, createVesselPose()), ctx);
  expect(box.x).toBeGreaterThan(box.y);
  clearWakeUniforms();
});
