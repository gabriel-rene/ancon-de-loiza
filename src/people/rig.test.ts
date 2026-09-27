// src/people/rig.test.ts
import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { createFigurePose, PART_INDEX, PARTS, poseFigure, solveTwoBone, type FigurePose, type PartName, type PoseKind, type V3 } from './rig';

const body = { height: 1.7, build: 1, dress: false };
const mat = (p: FigurePose, n: PartName) => new THREE.Matrix4().fromArray(p.parts, PART_INDEX[n] * 16);
const footY = (p: FigurePose) => Math.min(mat(p, 'footL').elements[13], mat(p, 'footR').elements[13]);
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('two-bone IK', () => {
  test('reaches a reachable target, keeps both bone lengths, bends toward the hint', () => {
    const mid: V3 = [0, 0, 0], end: V3 = [0, 0, 0], t: V3 = [0.1, -0.2, 0.35];
    expect(solveTwoBone([0, 0, 0], t, 0.3, 0.34, [0, -1, 0], mid, end)).toBe(true);
    expect(dist(end, t)).toBeLessThan(1e-9);
    expect(dist(mid, [0, 0, 0])).toBeCloseTo(0.3, 9); expect(dist(end, mid)).toBeCloseTo(0.34, 9);
    const m2: V3 = [0, 0, 0], e2: V3 = [0, 0, 0];
    solveTwoBone([0, 0, 0], [0, 0, 0.4], 0.3, 0.3, [0, -1, 0], m2, e2);
    expect(m2[1]).toBeLessThan(0);
  });
  test('stretches straight toward an unreachable target and reports it', () => {
    const mid: V3 = [0, 0, 0], end: V3 = [0, 0, 0];
    expect(solveTwoBone([0, 0, 0], [0, 0, 2], 0.3, 0.3, [0, -1, 0], mid, end)).toBe(false);
    expect(Math.hypot(...end)).toBeCloseTo(0.6, 3); expect(end[2]).toBeGreaterThan(0.59);
  });
});

describe('poseFigure', () => {
  test('a standing figure is its height tall with its feet on the ground', () => {
    const p = poseFigure(body, { kind: 'stand', phase: 0 }, createFigurePose());
    expect(p.headTop).toBeGreaterThan(1.7 * 0.97); expect(p.headTop).toBeLessThan(1.7 * 1.03);
    expect(footY(p)).toBeCloseTo(0, 6);
  });
  test('walking alternates the feet and keeps one on the ground', () => {
    const a = poseFigure(body, { kind: 'walk', phase: 0.25 }, createFigurePose());
    expect(mat(a, 'footL').elements[14]).toBeGreaterThan(mat(a, 'footR').elements[14]);
    const b = poseFigure(body, { kind: 'walk', phase: 0.75 }, createFigurePose());
    expect(mat(b, 'footL').elements[14]).toBeLessThan(mat(b, 'footR').elements[14]);
    for (let ph = 0; ph < 1; ph += 0.05) expect(footY(poseFigure(body, { kind: 'walk', phase: ph }, createFigurePose()))).toBeCloseTo(0, 6);
  });
  test('hand targets are reached (haul, pole) and leaning follows the pose', () => {
    const tL: V3 = [0.15, 1.2, 0.45], tR: V3 = [-0.12, 1.2, 0.45];
    const p = poseFigure(body, { kind: 'haul', phase: 0.3, handL: tL, handR: tR }, createFigurePose());
    expect(dist(p.handL, tL)).toBeLessThan(1e-3); expect(dist(p.handR, tR)).toBeLessThan(1e-3);
    const q = poseFigure(body, { kind: 'pole', phase: 0.3, handL: [0.1, 1.0, 0.6], handR: [0.05, 1.25, 0.4] }, createFigurePose());
    expect(mat(q, 'torso').elements[6]).toBeGreaterThan(0.1);   // torso Y axis tilts forward (+Z)
  });
  test('a dress hides the thighs and shows the skirt; trousers the reverse', () => {
    const d = poseFigure({ ...body, dress: true }, { kind: 'stand', phase: 0 }, createFigurePose());
    expect(mat(d, 'thighL').elements.every((v) => v === 0)).toBe(true);
    expect(mat(d, 'skirt').elements[5]).toBeGreaterThan(0.5);
    const t = poseFigure(body, { kind: 'stand', phase: 0 }, createFigurePose());
    expect(mat(t, 'skirt').elements.every((v) => v === 0)).toBe(true);
  });
  test('finite and deterministic for every kind', () => {
    for (const kind of ['stand', 'walk', 'haul', 'pole'] as PoseKind[]) {
      const a = poseFigure(body, { kind, phase: 0.37 }, createFigurePose()), b = poseFigure(body, { kind, phase: 0.37 }, createFigurePose());
      expect(a.parts.every(Number.isFinite)).toBe(true); expect(Array.from(a.parts)).toEqual(Array.from(b.parts));
      expect(a.parts.length).toBe(16 * PARTS.length);
    }
  });
});
