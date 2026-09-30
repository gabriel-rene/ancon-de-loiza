// src/people/rig.test.ts
import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { createFigurePose, FOOT_HEEL_Z, FOOT_TOE_Z, PART_INDEX, PARTS, poseFigure, proportions, sitHipHeight, skirtX, skirtZ, solveTwoBone, ZERO_MATRIX, type FigurePose, type PartName, type PoseKind, type V3 } from './rig';

const body = { height: 1.7, build: 1, dress: false };
const KINDS: PoseKind[] = ['stand', 'walk', 'haul', 'pole', 'sit'];
const mat = (p: FigurePose, n: PartName) => new THREE.Matrix4().fromArray(p.parts, PART_INDEX[n] * 16);
const at = (p: FigurePose, n: PartName, x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(mat(p, n));
/** Lowest heel / toe sole point of one foot. */
const sole = (p: FigurePose, n: 'footL' | 'footR') => Math.min(at(p, n, 0, -1, FOOT_HEEL_Z).y, at(p, n, 0, -1, FOOT_TOE_Z).y);
const footY = (p: FigurePose) => Math.min(sole(p, 'footL'), sole(p, 'footR'));
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
  });
  test('every kind: one foot grounded flat, no heel or toe ever below the ground', () => {
    for (const kind of KINDS) for (let ph = 0; ph < 1; ph += 0.05) {
      const p = poseFigure(body, { kind, phase: ph, t: ph * 7 }, createFigurePose());
      expect(footY(p)).toBeCloseTo(0, 6);
      expect(footY(p)).toBeGreaterThan(-1e-6);
    }
  });
  test('the trailing foot rolls heel-up in walk (toe-off), a grounded foot lies flat', () => {
    const p = poseFigure(body, { kind: 'walk', phase: 0.25 }, createFigurePose());   // left leg forward, right trailing
    expect(at(p, 'footR', 0, -1, FOOT_HEEL_Z).y).toBeGreaterThan(at(p, 'footR', 0, -1, FOOT_TOE_Z).y + 0.01);
    const s = poseFigure(body, { kind: 'stand', phase: 0 }, createFigurePose());
    expect(at(s, 'footL', 0, -1, FOOT_HEEL_Z).y).toBeCloseTo(at(s, 'footL', 0, -1, FOOT_TOE_Z).y, 6);
  });
  test('hand targets are reached (haul, pole); the hand extends past the grip; leaning follows the pose', () => {
    const tL: V3 = [0.15, 1.2, 0.45], tR: V3 = [-0.12, 1.2, 0.45];
    const p = poseFigure(body, { kind: 'haul', phase: 0.3, handL: tL, handR: tR }, createFigurePose());
    expect(dist(p.handL, tL)).toBeLessThan(1e-3); expect(dist(p.handR, tR)).toBeLessThan(1e-3);
    const P = proportions(body), wrist = at(p, 'handL', 0, 0, 0), tip = at(p, 'handL', 0, -1, 0);
    expect(wrist.distanceTo(new THREE.Vector3(...tL))).toBeCloseTo(P.grip, 6);
    expect(tip.distanceTo(wrist)).toBeCloseTo(P.handLen, 6);
    const q = poseFigure(body, { kind: 'pole', phase: 0.3, handL: [0.1, 1.0, 0.6], handR: [0.05, 1.25, 0.4] }, createFigurePose());
    expect(mat(q, 'torso').elements[6]).toBeGreaterThan(0.1);   // torso Y axis tilts forward (+Z)
    expect(mat(p, 'torso').elements[6]).toBeLessThan(0);        // haulers lean back
  });
  test('haul: lead knee bent, rear leg braced straight', () => {
    const p = poseFigure(body, { kind: 'haul', phase: 0 }, createFigurePose());
    const bend = (s: 'L' | 'R') => {
      const t = new THREE.Vector3(0, -1, 0).transformDirection(mat(p, `thigh${s}`)), h = new THREE.Vector3(0, -1, 0).transformDirection(mat(p, `shin${s}`));
      return t.angleTo(h);
    };
    expect(bend('L')).toBeGreaterThan(0.35); expect(bend('R')).toBeLessThan(0.05);
  });
  test('idle motion moves the head and chest over time but the feet stay planted', () => {
    const a = poseFigure(body, { kind: 'stand', phase: 0, t: 0, seed: 3 }, createFigurePose());
    const b = poseFigure(body, { kind: 'stand', phase: 0, t: 4.3, seed: 3 }, createFigurePose());
    expect(mat(a, 'head').equals(mat(b, 'head'))).toBe(false);
    for (const f of ['footL', 'footR'] as const) expect(at(a, f, 0, 0, 0).distanceTo(at(b, f, 0, 0, 0))).toBeLessThan(0.02);
  });
  test('contrapposto: the weight leg straight, the free hip lower', () => {
    const p = poseFigure(body, { kind: 'stand', phase: 0, seed: 0 }, createFigurePose());   // seed 0: weight on the left
    expect(at(p, 'thighL', 0, 0, 0).y).toBeGreaterThan(at(p, 'thighR', 0, 0, 0).y + 0.02);
  });
  test('a dress hides the thighs and shows the skirt; walking in it keeps the ankles inside the hem', () => {
    const d = poseFigure({ ...body, dress: true }, { kind: 'stand', phase: 0 }, createFigurePose());
    expect(mat(d, 'thighL').elements.every((v) => v === 0)).toBe(true);
    expect(mat(d, 'skirt').elements[5]).toBeGreaterThan(0.5);
    const t = poseFigure(body, { kind: 'stand', phase: 0 }, createFigurePose());
    expect(mat(t, 'skirt').elements.every((v) => v === 0)).toBe(true);
    for (let ph = 0; ph < 1; ph += 0.125) {
      const w = poseFigure({ ...body, dress: true }, { kind: 'walk', phase: ph }, createFigurePose());
      const hemZ = new THREE.Vector3().setFromMatrixColumn(mat(w, 'skirt'), 2).length();
      for (const s of ['shinL', 'shinR'] as const) expect(Math.abs(at(w, s, 0, -1, 0).z)).toBeLessThan(hemZ);
    }
  });
  test('in a dress the whole leg stays inside the skirt for every kind and phase (the braced haul too)', () => {
    const d = { ...body, dress: true }, P = proportions(d);
    for (const kind of KINDS) for (let ph = 0; ph < 1; ph += 0.0625) {
      const f = poseFigure(d, { kind, phase: ph, t: ph * 7, seed: 3 }, createFigurePose()), inv = mat(f, 'skirt').invert();
      for (const s of ['shinL', 'shinR'] as const) for (let k = 0; k <= 8; k++) {
        const p = at(f, s, 0, -k / 8, 0).applyMatrix4(inv), t = -p.y;   // skirt-local: y 0 top … −1 hem, unit hem radius
        if (t < 0.2 || t > 1) continue;
        const m = mat(f, 'skirt'), sz = new THREE.Vector3().setFromMatrixColumn(m, 2).length(), sx = new THREE.Vector3().setFromMatrixColumn(m, 0).length();
        expect(Math.abs(p.z) + (P.rShin * 1.08) / sz, `${kind} ${ph} ${s} ${k}`).toBeLessThan(skirtZ(t));
        expect(Math.abs(p.x) + (P.rShin * 1.08) / sx, `${kind} ${ph} ${s} ${k} x`).toBeLessThan(skirtX(t));
      }
    }
  });
  test('finite and deterministic for every kind; ZERO_MATRIX is frozen', () => {
    for (const kind of KINDS) {
      const a = poseFigure(body, { kind, phase: 0.37, t: 2.5, seed: 9 }, createFigurePose()), b = poseFigure(body, { kind, phase: 0.37, t: 2.5, seed: 9 }, createFigurePose());
      expect(a.parts.every(Number.isFinite)).toBe(true); expect(Array.from(a.parts)).toEqual(Array.from(b.parts));
      expect(a.parts.length).toBe(16 * PARTS.length);
    }
    expect(Object.isFrozen(ZERO_MATRIX.elements)).toBe(true);
  });
  test('sit: thighs level, shins upright, hands reach a wheel ahead', () => {
    const body = { height: 1.72, build: 1, dress: false };
    const hand: V3 = [0.17, sitHipHeight(body) + 0.36, 0.45];
    const out = poseFigure(body, { kind: 'sit', phase: 0, handL: hand, handR: [-0.17, hand[1], hand[2]] }, createFigurePose());
    const col = (name: PartName, c: number) => out.parts[PART_INDEX[name] * 16 + 12 + c];
    const thighDir = (n: PartName) => { const e = out.parts.subarray(PART_INDEX[n] * 16, PART_INDEX[n] * 16 + 16); return [e[4], e[5], e[6]]; };
    const [tx, ty, tz] = thighDir('thighL'), l = Math.hypot(tx, ty, tz);
    expect(Math.abs(ty / l)).toBeLessThan(0.15);                 // near horizontal
    const [sx, sy, sz] = thighDir('shinL'), m = Math.hypot(sx, sy, sz);
    expect(Math.abs(sy / m)).toBeGreaterThan(0.95);              // near vertical
    expect(col('hips', 1)).toBeCloseTo(sitHipHeight(body), 2);
    expect(Math.hypot(out.handL[0] - hand[0], out.handL[1] - hand[1], out.handL[2] - hand[2])).toBeLessThan(0.02);
  });
  test('sit with legFwd: shins stretched forward, the hip lower by the same amount sitHipHeight reports', () => {
    const body = { height: 1.72, build: 1, dress: false }, legFwd = 1.1;
    const out = poseFigure(body, { kind: 'sit', phase: 0, legFwd }, createFigurePose());
    const shin = out.parts.subarray(PART_INDEX.shinL * 16, PART_INDEX.shinL * 16 + 16), m = Math.hypot(shin[4], shin[5], shin[6]);
    expect(Math.acos(Math.abs(shin[5]) / m)).toBeCloseTo(legFwd, 1);                            // shin tilted legFwd from upright
    expect(out.parts[PART_INDEX.footL * 16 + 14]).toBeGreaterThan(out.parts[PART_INDEX.shinL * 16 + 14]);   // foot ahead of the knee
    expect(out.parts[PART_INDEX.hips * 16 + 13]).toBeCloseTo(sitHipHeight(body, legFwd), 2);
    expect(sitHipHeight(body, legFwd)).toBeLessThan(sitHipHeight(body) - 0.1);
  });
});
