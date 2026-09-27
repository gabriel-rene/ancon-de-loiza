// src/people/rig.ts
import * as THREE from 'three';

export type V3 = [number, number, number];
export const PARTS = ['hips', 'torso', 'head', 'upperArmL', 'foreArmL', 'upperArmR', 'foreArmR',
  'thighL', 'shinL', 'thighR', 'shinR', 'footL', 'footR', 'skirt'] as const;
export type PartName = (typeof PARTS)[number];
export const PART_INDEX = Object.fromEntries(PARTS.map((p, i) => [p, i])) as Record<PartName, number>;
export type PoseKind = 'stand' | 'walk' | 'haul' | 'pole';
export interface Body { height: number; build: number; dress: boolean }
export interface PoseInput { kind: PoseKind; phase: number; lean?: number; handL?: V3; handR?: V3 }
export interface FigurePose { parts: Float32Array; handL: V3; handR: V3; headTop: number }
export const createFigurePose = (): FigurePose => ({ parts: new Float32Array(16 * PARTS.length), handL: [0, 0, 0], handR: [0, 0, 0], headTop: 0 });

export interface Proportions {
  H: number; thigh: number; shin: number; footH: number; footLen: number; footW: number; torso: number; neck: number; headR: number;
  upperArm: number; foreArm: number; shoulderHalf: number; hipHalf: number; rUpperArm: number; rForeArm: number; rThigh: number; rShin: number;
}
/** Segment lengths and radii (m) for a body; writes into `out` (no allocation when one is passed). */
export function proportions(b: Body, out = {} as Proportions): Proportions {
  const H = b.height, w = b.build;
  out.H = H; out.thigh = 0.245 * H; out.shin = 0.245 * H; out.footH = 0.04 * H; out.footLen = 0.15 * H; out.footW = 0.06 * H * w;
  out.torso = 0.3 * H; out.neck = 0.035 * H; out.headR = 0.065 * H; out.upperArm = 0.175 * H; out.foreArm = 0.2 * H;
  out.shoulderHalf = 0.12 * H * w; out.hipHalf = 0.055 * H * w;
  out.rUpperArm = 0.028 * H * w; out.rForeArm = 0.022 * H * w; out.rThigh = 0.045 * H * w; out.rShin = 0.032 * H * w;
  return out;
}

const DOWN = new THREE.Vector3(0, -1, 0), X = new THREE.Vector3(1, 0, 0);
const _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _m = new THREE.Matrix4(), _up = new THREE.Vector3(), _fw = new THREE.Vector3();
/** A matrix with all 16 elements 0 — hides an instance / a part (makeScale(0,0,0) would keep element 15 = 1). */
export const ZERO_MATRIX = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

/** Matrix taking a unit segment geometry (y 0 → −1, radius 1) onto from → to with radii rx, rz. */
export function segmentMatrix(from: V3, to: V3, rx: number, rz: number, out: THREE.Matrix4): THREE.Matrix4 {
  _d.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const len = _d.length();
  if (len < 1e-9) _q.identity(); else _q.setFromUnitVectors(DOWN, _d.multiplyScalar(1 / len));
  return out.compose(_p.set(from[0], from[1], from[2]), _q, _s.set(rx, Math.max(len, 1e-6), rz));
}

/** Analytic two-bone IK. Writes the middle joint and the end effector; returns false if the target was out of reach (end stretches toward it). */
export function solveTwoBone(root: V3, target: V3, l1: number, l2: number, hint: V3, mid: V3, end: V3): boolean {
  let dx = target[0] - root[0], dy = target[1] - root[1], dz = target[2] - root[2];
  const dist = Math.hypot(dx, dy, dz), lo = Math.abs(l1 - l2) + 1e-6, hi = l1 + l2 - 1e-6;
  const reached = dist >= lo && dist <= hi;
  if (dist < 1e-9) { dx = 0; dy = -1; dz = 0; } else { dx /= dist; dy /= dist; dz /= dist; }
  const D = Math.min(hi, Math.max(lo, dist));
  const cosA = Math.min(1, Math.max(-1, (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D))), sinA = Math.sqrt(1 - cosA * cosA);
  const hd = hint[0] * dx + hint[1] * dy + hint[2] * dz;
  let hx = hint[0] - dx * hd, hy = hint[1] - dy * hd, hz = hint[2] - dz * hd, hl = Math.hypot(hx, hy, hz);
  if (hl < 1e-9) { hx = -dy; hy = dx; hz = 0; hl = Math.hypot(hx, hy); if (hl < 1e-9) { hx = 1; hy = 0; hl = 1; } }
  hx /= hl; hy /= hl; hz /= hl;
  mid[0] = root[0] + dx * l1 * cosA + hx * l1 * sinA;
  mid[1] = root[1] + dy * l1 * cosA + hy * l1 * sinA;
  mid[2] = root[2] + dz * l1 * cosA + hz * l1 * sinA;
  if (reached) { end[0] = target[0]; end[1] = target[1]; end[2] = target[2]; }
  else { end[0] = root[0] + dx * D; end[1] = root[1] + dy * D; end[2] = root[2] + dz * D; }
  return reached;
}

const TAU = Math.PI * 2, SIDES = [1, -1] as const, _P = {} as Proportions;
const hip: V3 = [0, 0, 0], knee: V3 = [0, 0, 0], ankle: V3 = [0, 0, 0], sh: V3 = [0, 0, 0], el: V3 = [0, 0, 0], hint: V3 = [0, 0, 0];

/** Figure-local part matrices for a pose (see PARTS). Legs are FK with the longer leg on the ground; arms are FK or IK to hand targets. */
function put(out: FigurePose, n: PartName, m: THREE.Matrix4) { m.toArray(out.parts, PART_INDEX[n] * 16); }
/** Vertical extent of a leg (thigh swing sw, knee bend k). */
function legExt(P: Proportions, sw: number, k: number) { return P.thigh * Math.cos(sw) + P.shin * Math.cos(sw - k); }

export function poseFigure(body: Body, input: PoseInput, out: FigurePose): FigurePose {
  const P = proportions(body, _P), H = P.H, c = Math.sin(TAU * input.phase);
  let swingL = 0.04, swingR = -0.03, kneeL = 0.05, kneeR = 0.05, sway = 0, armSwing = 0, lean = input.lean ?? 0.03;
  switch (input.kind) {
    case 'stand': sway = 0.007 * H * c; break;
    case 'walk': case 'pole':
      swingL = 0.42 * c; swingR = -0.42 * c;
      kneeL = 0.1 + 0.6 * Math.max(0, Math.sin(TAU * input.phase + 1.9));
      kneeR = 0.1 + 0.6 * Math.max(0, Math.sin(TAU * input.phase + 1.9 + Math.PI));
      armSwing = -0.35 * c;
      if (input.kind === 'pole') lean = input.lean ?? 0.45;
      break;
    case 'haul':
      swingL = 0.35; kneeL = 0.3; swingR = -0.25; kneeR = 0.12;
      lean = input.lean ?? -0.12 - 0.08 * c;
      break;
  }
  const hipH = Math.max(legExt(P, swingL, kneeL), legExt(P, swingR, kneeR)) + P.footH;
  for (let si = 0; si < 2; si++) {
    const s = SIDES[si];
    const sw = s > 0 ? swingL : swingR, k = s > 0 ? kneeL : kneeR;
    hip[0] = s * P.hipHalf + sway; hip[1] = hipH; hip[2] = 0;
    knee[0] = hip[0]; knee[1] = hipH - P.thigh * Math.cos(sw); knee[2] = P.thigh * Math.sin(sw);
    ankle[0] = hip[0]; ankle[1] = knee[1] - P.shin * Math.cos(sw - k); ankle[2] = knee[2] + P.shin * Math.sin(sw - k);
    put(out, s > 0 ? 'thighL' : 'thighR', body.dress ? ZERO_MATRIX : segmentMatrix(hip, knee, P.rThigh, P.rThigh, _m));
    put(out, s > 0 ? 'shinL' : 'shinR', segmentMatrix(knee, ankle, P.rShin, P.rShin, _m));
    put(out, s > 0 ? 'footL' : 'footR', _m.makeScale(P.footW, P.footH, P.footLen).setPosition(ankle[0], ankle[1] - P.footH, ankle[2]));
  }
  // Pelvis and torso (lean = rotation about X; + bends forward).
  _up.set(0, Math.cos(lean), Math.sin(lean)); _fw.set(0, -Math.sin(lean), Math.cos(lean));
  put(out, 'torso', _m.makeBasis(X, _up, _fw).scale(_s.set(P.shoulderHalf, P.torso, P.shoulderHalf)).setPosition(sway, hipH, 0));
  put(out, 'hips', _m.makeScale(P.hipHalf * 1.6, 0.06 * H, 0.055 * H).setPosition(sway, hipH, 0));
  put(out, 'skirt', body.dress ? _m.makeScale(P.hipHalf * 2.4, hipH - 0.08 * H, P.hipHalf * 2.4).setPosition(sway, hipH + 0.02 * H, 0) : ZERO_MATRIX);
  const hx = sway, hy = hipH + _up.y * (P.torso + P.neck) + P.headR * 1.1, hz = _up.z * (P.torso + P.neck);
  _q.setFromAxisAngle(X, lean * 0.3);
  put(out, 'head', _m.compose(_p.set(hx, hy, hz), _q, _s.set(P.headR, P.headR, P.headR)));
  out.headTop = hy + P.headR * 1.15;
  // Arms.
  for (let si = 0; si < 2; si++) {
    const s = SIDES[si];
    const ts = P.torso - 0.03 * H;
    sh[0] = sway + s * P.shoulderHalf * 0.92; sh[1] = hipH + _up.y * ts; sh[2] = _up.z * ts;
    const target = s > 0 ? input.handL : input.handR, hand = s > 0 ? out.handL : out.handR;
    if (target) { hint[0] = s * 0.4; hint[1] = -1; hint[2] = -0.5; solveTwoBone(sh, target, P.upperArm, P.foreArm, hint, el, hand); }
    else {
      const a = s > 0 ? armSwing : -armSwing, b = a + 0.25;
      el[0] = sh[0] + s * P.upperArm * 0.08; el[1] = sh[1] - P.upperArm * Math.cos(a); el[2] = sh[2] + P.upperArm * Math.sin(a);
      hand[0] = el[0] + s * P.foreArm * 0.05; hand[1] = el[1] - P.foreArm * Math.cos(b); hand[2] = el[2] + P.foreArm * Math.sin(b);
    }
    put(out, s > 0 ? 'upperArmL' : 'upperArmR', segmentMatrix(sh, el, P.rUpperArm, P.rUpperArm, _m));
    put(out, s > 0 ? 'foreArmL' : 'foreArmR', segmentMatrix(el, hand, P.rForeArm, P.rForeArm, _m));
  }
  return out;
}
