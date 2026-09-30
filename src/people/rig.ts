// src/people/rig.ts
import * as THREE from 'three';

export type V3 = [number, number, number];
export const PARTS = ['hips', 'torso', 'tail', 'head', 'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'thighR', 'shinR', 'footL', 'footR', 'skirt'] as const;
export type PartName = (typeof PARTS)[number];
export const PART_INDEX = Object.fromEntries(PARTS.map((p, i) => [p, i])) as Record<PartName, number>;
export type PoseKind = 'stand' | 'walk' | 'haul' | 'pole' | 'sit';
/** Seated thigh angle (rad from straight down) — a touch below level, as on a car bench. */
const SIT_SW = 1.45, _SIT = {} as Proportions;
/** Hip joint height above the feet plane when seated: the thigh drops a little, the shin stands upright (or `legFwd` rad forward, PoseInput). Allocation-free. */
export const sitHipHeight = (b: Body, legFwd = 0) => { const P = proportions(b, _SIT); return P.thigh * Math.cos(SIT_SW) + P.shin * Math.cos(legFwd) + P.footH; };
export interface Body { height: number; build: number; dress: boolean }
/**
 * `phase` drives the gait / effort cycle (0–1). `t` (s, default 0) drives idle motion — breathing, weight
 * shift, head turns — and `seed` de-synchronises it between people. Hand targets are figure-local; when
 * given they override the FK arm for any kind. Everything is a pure function of the input.
 */
export interface PoseInput {
  kind: PoseKind; phase: number; lean?: number; handL?: V3; handR?: V3; t?: number; seed?: number;
  /** 'sit' only: shins this far (rad) forward of upright, the legs stretched out as in a car's footwell (default 0: a bench). */
  legFwd?: number;
}
export interface FigurePose { parts: Float32Array; handL: V3; handR: V3; headTop: number }
export const createFigurePose = (): FigurePose => ({ parts: new Float32Array(16 * PARTS.length), handL: [0, 0, 0], handR: [0, 0, 0], headTop: 0 });

export interface Proportions {
  H: number; thigh: number; shin: number; footH: number; footLen: number; footW: number; torso: number; neck: number; headR: number;
  upperArm: number; foreArm: number; shoulderHalf: number; hipHalf: number; rUpperArm: number; rForeArm: number; rThigh: number; rShin: number;
  /** Hand: length, half thickness (palm normal), half width; `grip` = wrist → grip-point distance (the IK end). */
  handLen: number; handT: number; handW: number; grip: number;
}
/** Segment lengths and radii (m) for a body; writes into `out` (no allocation when one is passed). */
export function proportions(b: Body, out = {} as Proportions): Proportions {
  const H = b.height, w = b.build;
  out.H = H; out.thigh = 0.245 * H; out.shin = 0.245 * H; out.footH = 0.04 * H; out.footLen = 0.15 * H; out.footW = 0.06 * H * w;
  out.torso = 0.3 * H; out.neck = 0.035 * H; out.headR = 0.06 * H; out.upperArm = 0.175 * H; out.foreArm = 0.2 * H;
  out.shoulderHalf = 0.12 * H * w; out.hipHalf = 0.055 * H * w;
  out.rUpperArm = 0.028 * H * w; out.rForeArm = 0.024 * H * w; out.rThigh = 0.05 * H * w; out.rShin = 0.034 * H * w;
  out.handLen = 0.1 * H; out.handT = 0.013 * H * w; out.handW = 0.026 * H * w; out.grip = 0.05 * H;
  return out;
}
/** Foot geometry frame (footLen / footH units, origin at the ankle): sole at y = −1, heel and toe z. */
export const FOOT_HEEL_Z = -0.28, FOOT_TOE_Z = 0.72;
/** Neck length below the head centre, in head radii (head + neck are one geometry). */
export const NECK_DEPTH = 1.9;
/** Shirt tail: radius (× shoulderHalf), hem depth below the hip joint (× H), and its geometry's z-radius at the hem. */
export const TAIL_R = 0.9, TAIL_LEN = 0.06, TAIL_Z = 0.86;

const DOWN = new THREE.Vector3(0, -1, 0);
const _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _e = new THREE.Euler();
const _qPelvis = new THREE.Quaternion(), _qChest = new THREE.Quaternion(), _qHead = new THREE.Quaternion(), _qFoot = new THREE.Quaternion();
/** A matrix with all 16 elements 0 — hides an instance / a part (makeScale(0,0,0) would keep element 15 = 1). Frozen. */
export const ZERO_MATRIX = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
Object.freeze(ZERO_MATRIX.elements);

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
const wrist: V3 = [0, 0, 0], tip: V3 = [0, 0, 0];
/** Per-side leg parameters (index 0 = left, 1 = right), reused every call. */
const SW = [0, 0], KN = [0, 0], HDY = [0, 0], HDZ = [0, 0], HDX = [0, 0];
/** Per leg: hip, knee, ankle (x, y, z) — for fitting the skirt round the whole leg. */
const LEG = new Float64Array(18);
/** Skirt geometry's z-radius profile at depth t (0 top … 1 hem), in hem radii, less its folds (see geometry.ts). */
export const skirtZ = (t: number) => (0.55 + 0.45 * t) * (0.62 + 0.38 * t) * 0.96;
/** …and its x-radius profile. */
export const skirtX = (t: number) => (0.55 + 0.45 * t) * 0.96;

function put(out: FigurePose, n: PartName, m: THREE.Matrix4) { m.toArray(out.parts, PART_INDEX[n] * 16); }
/** Vertical extent of a leg (thigh swing sw, knee bend k). */
function legExt(P: Proportions, sw: number, k: number) { return P.thigh * Math.cos(sw) + P.shin * Math.cos(sw - k); }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Figure-local part matrices for a pose (see PARTS). Figure frame: origin on the ground between the feet,
 * +Y up, +Z forward, +X the figure's left. Legs are sagittal FK with the longest leg grounded; feet pitch
 * with the shin in swing (heel-up toe-off, toe-up heel strike) and lie flat when grounded; arms are FK or
 * two-bone IK to the hand grip point. No allocation.
 */
export function poseFigure(body: Body, input: PoseInput, out: FigurePose): FigurePose {
  const P = proportions(body, _P), H = P.H, ph = input.phase, c = Math.sin(TAU * ph);
  const t = input.t ?? 0, seed = input.seed ?? 0, breath = Math.sin(TAU * 0.25 * t + seed * 1.7);
  let sway = 0, lean = 0.03, pelvisYaw = 0, pelvisRoll = 0, chestYaw = 0, chestRoll = 0, armSwing = 0, elbow = 0.25, headYaw = 0, headNod = 0;
  // brace: side whose leg straightens (swing) to reach the ground; rest: side whose knee bends to rest its foot on it (−1: none).
  let stanceHalf = P.hipHalf, brace = -1, rest = -1;
  SW[0] = 0.04; SW[1] = -0.03; KN[0] = 0.05; KN[1] = 0.05;
  switch (input.kind) {
    case 'stand': {
      // Contrapposto: weight on one straight leg (seeded side), the free knee relaxed, pelvis dropping on the free side,
      // shoulders counter-tilted; slow weight drift, breathing, head turns.
      const w = (seed & 1) === 0 ? 0 : 1, s = SIDES[w];
      SW[w] = 0.0; KN[w] = 0.02; SW[1 - w] = 0.1; KN[1 - w] = 0.2; rest = 1 - w;
      sway = s * (0.012 + 0.003 * Math.sin(TAU * t / 13 + seed)) * H;
      pelvisRoll = s * Math.atan2(0.02 * H, 2 * P.hipHalf);
      chestRoll = -0.6 * pelvisRoll;
      stanceHalf = 1.1 * P.hipHalf;
      lean = input.lean ?? 0.02;
      headYaw = 0.26 * Math.sin(TAU * t / 11 + seed) * (0.6 + 0.4 * Math.sin(TAU * t / 7 + seed * 2.3));
      headNod = 0.04 * Math.sin(TAU * t / 9 + seed * 0.7);
      elbow = 0.22;
      break;
    }
    case 'walk': {
      const ds = body.dress ? 0.5 : 1, dk = body.dress ? 0.7 : 1;   // a hem limits the stride
      SW[0] = 0.42 * c * ds; SW[1] = -SW[0];
      KN[0] = (0.1 + 0.6 * Math.max(0, Math.sin(TAU * ph + 1.9))) * dk;
      KN[1] = (0.1 + 0.6 * Math.max(0, Math.sin(TAU * ph + 1.9 + Math.PI))) * dk;
      pelvisYaw = -0.1 * c;                  // the swinging hip leads (≈ ±6°)
      chestYaw = -0.5 * pelvisYaw;           // shoulders counter-rotate
      armSwing = -0.35 * Math.sin(TAU * (ph - 0.1)) * ds;   // arms lag the legs
      stanceHalf = 0.75 * P.hipHalf;
      lean = input.lean ?? 0.06;
      headYaw = 0.08 * Math.sin(TAU * t / 9 + seed);
      elbow = 0.3;
      break;
    }
    case 'pole': {
      // Walking into the pole: long stride, the forward knee bent, the rear leg driving straight.
      SW[0] = 0.5 * c; SW[1] = -SW[0];
      for (let i = 0; i < 2; i++) KN[i] = 0.03 + 0.45 * smooth(0, 0.45, SW[i]) + 0.35 * Math.max(0, Math.sin(TAU * ph + 1.9 + i * Math.PI)) * smooth(0.1, -0.3, SW[i]);
      pelvisYaw = -0.06 * c; chestYaw = -0.5 * pelvisYaw;
      stanceHalf = 0.85 * P.hipHalf;
      lean = input.lean ?? 0.45;
      headNod = -0.15;
      break;
    }
    case 'sit':
      // Driver on a bench seat: thighs forward, shins upright, a slight lean back; arms go to the wheel via hand targets.
      SW[0] = SW[1] = SIT_SW; KN[0] = KN[1] = SIT_SW - (input.legFwd ?? 0);
      stanceHalf = 1.2 * P.hipHalf;
      lean = input.lean ?? -0.08;
      headYaw = 0.12 * Math.sin(TAU * t / 10 + seed);
      elbow = 0.6;
      break;
    case 'haul':
      // Braced: lead leg forward and bent, rear leg straight with the heel down, weight rocking with the pull.
      // In a dress the stance is shorter (a hem limits it) and the brace comes more from the lean.
      SW[0] = body.dress ? 0.3 : 0.55; KN[0] = (body.dress ? 0.3 : 0.47) + 0.05 * c; KN[1] = 0; brace = 1;
      lean = input.lean ?? -0.12 - 0.08 * c;
      stanceHalf = 1.05 * P.hipHalf;
      headNod = 0.08;
      break;
  }
  const up = 0.003 * H * breath;   // shoulder rise with the breath
  // Pelvis: yaw · roll · 30 % of the lean.
  _qPelvis.setFromEuler(_e.set(0.3 * lean, pelvisYaw, pelvisRoll, 'YZX'));
  for (let i = 0; i < 2; i++) {
    _v.set(SIDES[i] * P.hipHalf, 0, 0).applyQuaternion(_qPelvis);
    HDX[i] = _v.x; HDY[i] = _v.y; HDZ[i] = _v.z;
  }
  if (brace >= 0) {   // straighten the braced leg so it reaches the ground from the same hip height
    const o = 1 - brace, reach = legExt(P, SW[o], KN[o]) - HDY[o] + HDY[brace];
    SW[brace] = -Math.acos(Math.min(1, reach / (P.thigh + P.shin)));
  }
  if (rest >= 0) {    // the free leg's knee takes up the dropped hip so its foot rests flat
    const o = 1 - rest, reach = legExt(P, SW[o], KN[o]) - HDY[o] + HDY[rest];
    const cs = (reach - P.thigh * Math.cos(SW[rest])) / P.shin;
    if (cs < 1) KN[rest] = Math.max(KN[rest], SW[rest] + Math.acos(Math.max(-1, cs)));
  }
  const hipH = Math.max(legExt(P, SW[0], KN[0]) - HDY[0], legExt(P, SW[1], KN[1]) - HDY[1]) + P.footH;
  let reachZ = 0, thighZ = 0;   // furthest ankle / thigh surface from the body line (hems must clear them)
  for (let i = 0; i < 2; i++) {
    const s = SIDES[i], sw = SW[i], k = KN[i], L = i === 0;
    hip[0] = sway + HDX[i]; hip[1] = hipH + HDY[i]; hip[2] = HDZ[i];
    ankle[0] = s * stanceHalf;
    knee[1] = hip[1] - P.thigh * Math.cos(sw); knee[2] = hip[2] + P.thigh * Math.sin(sw);
    ankle[1] = knee[1] - P.shin * Math.cos(sw - k); ankle[2] = knee[2] + P.shin * Math.sin(sw - k);
    knee[0] = 0.5 * (hip[0] + ankle[0]);
    reachZ = Math.max(reachZ, Math.abs(ankle[2]), Math.abs(knee[2]));
    for (let j = 0; j < 3; j++) { LEG[i * 9 + j] = hip[j]; LEG[i * 9 + 3 + j] = knee[j]; LEG[i * 9 + 6 + j] = ankle[j]; }
    thighZ = Math.max(thighZ, TAIL_LEN * H * Math.tan(Math.abs(sw)) + P.rThigh / Math.cos(sw));
    put(out, L ? 'thighL' : 'thighR', body.dress ? ZERO_MATRIX : segmentMatrix(hip, knee, P.rThigh, P.rThigh * 0.95, _m));
    put(out, L ? 'shinL' : 'shinR', segmentMatrix(knee, ankle, P.rShin, P.rShin, _m));
    // Foot pitch: follows the shin in swing, clamped so neither heel nor toe goes below the ground.
    const lift = Math.max(0, ankle[1] - P.footH), a = sw - k;
    const toeDown = Math.asin(Math.min(1, lift / (FOOT_TOE_Z * P.footLen))), heelDown = Math.asin(Math.min(1, lift / (-FOOT_HEEL_Z * P.footLen)));
    const pitch = Math.min(toeDown, Math.max(-heelDown, -0.9 * a));
    _qFoot.setFromEuler(_e.set(pitch, s * 0.1, 0, 'YXZ'));
    put(out, L ? 'footL' : 'footR', _m.compose(_p.set(ankle[0], ankle[1], ankle[2]), _qFoot, _s.set(P.footW, P.footH, P.footLen)));
  }
  put(out, 'hips', _m.compose(_p.set(sway, hipH, 0), _qPelvis, _s.set(P.hipHalf * 1.6, 0.1 * H, P.hipHalf * 1.6)));
  // Shirt tail: the untucked hem hangs from the waist with the pelvis and is pushed out by the thighs.
  if (body.dress) put(out, 'tail', ZERO_MATRIX);
  else {
    const r = TAIL_R * P.shoulderHalf, spread = Math.max(1, (thighZ + 0.006 * H) / (r * TAIL_Z));
    _v.set(0, 0.012 * H, 0).applyQuaternion(_qPelvis);
    put(out, 'tail', _m.compose(_p.set(sway + _v.x, hipH + _v.y, _v.z), _qPelvis, _s.set(r, (TAIL_LEN + 0.012) * H, r * spread)));
  }
  // Chest: shoulders counter-rotate / counter-tilt against the pelvis and carry the full lean; breathing in y.
  _qChest.setFromEuler(_e.set(lean, chestYaw, chestRoll, 'YZX'));
  const torsoY = P.torso * (1 + 0.006 * breath);
  put(out, 'torso', _m.compose(_p.set(sway, hipH, 0), _qChest, _s.set(P.shoulderHalf, torsoY, P.shoulderHalf)));
  if (body.dress) {
    // The hem swings out with the stride and is pushed by the legs, so the shins stay inside it.
    const len = hipH - 0.07 * H, top = hipH + 0.02 * H, R = P.hipHalf * 2.4;
    let spreadX = 1, spread = Math.max(1 + 0.6 * Math.abs(SW[0] - SW[1]), (reachZ + 0.02 * H) / (R * 0.96));
    // …and the whole leg stays inside the cone, not just the ankle at the hem (a braced straight leg leaves it higher up).
    const cy = Math.cos(pelvisYaw), sy = Math.sin(pelvisYaw);   // the skirt turns with the pelvis
    for (let i = 0; i < 2; i++) for (let k = 0; k <= 20; k++) {
      const o = i * 9 + (k < 6 ? 0 : 3), u = k < 6 ? 0.5 + k / 12 : (k - 6) / 14;   // lower half of the thigh, then the shin
      const x = lerp(LEG[o], LEG[o + 3], u) - sway, y = lerp(LEG[o + 1], LEG[o + 4], u), z = lerp(LEG[o + 2], LEG[o + 5], u);
      const t = (top - y) / len, r = k < 6 ? P.rThigh : P.rShin, zl = x * sy + z * cy, xl = x * cy - z * sy;
      if (t > 0.2 && t <= 1) {
        spread = Math.max(spread, (Math.abs(zl) + r * 1.15) / (R * skirtZ(t)));
        spreadX = Math.max(spreadX, (Math.abs(xl) + r * 1.15) / (R * skirtX(t)));
      }
    }
    _q.setFromAxisAngle(_v.set(0, 1, 0), pelvisYaw);
    put(out, 'skirt', _m.compose(_p.set(sway, top, 0), _q, _s.set(R * spreadX, len, R * spread)));
  } else put(out, 'skirt', ZERO_MATRIX);
  // Head + neck: the neck axis starts at the top of the torso; the head counter-pitches to look ahead.
  _qHead.setFromEuler(_e.set(-0.6 * lean + headNod, headYaw, 0, 'YXZ')).premultiply(_qChest);
  _v.set(0, torsoY, 0).applyQuaternion(_qChest);
  const nx = sway + _v.x, ny = hipH + _v.y, nz = _v.z;
  _v.set(0, 1, 0).applyQuaternion(_qHead);
  const off = P.neck + 1.1 * P.headR, hx = nx + _v.x * off, hy = ny + _v.y * off, hz = nz + _v.z * off;
  put(out, 'head', _m.compose(_p.set(hx, hy, hz), _qHead, _s.set(P.headR, P.headR, P.headR)));
  out.headTop = hy + _v.y * P.headR * 1.15;
  // Arms: shoulder from the chest frame; hand = forearm end (the grip point), the wrist sits `grip` short of it.
  for (let i = 0; i < 2; i++) {
    const s = SIDES[i], L = i === 0;
    _v.set(s * P.shoulderHalf * 0.9, P.torso - 0.035 * H, 0).applyQuaternion(_qChest);
    sh[0] = sway + _v.x; sh[1] = hipH + _v.y + up; sh[2] = _v.z;
    const target = L ? input.handL : input.handR, hand = L ? out.handL : out.handR;
    if (target) { hint[0] = s * 0.4; hint[1] = -1; hint[2] = -0.5; solveTwoBone(sh, target, P.upperArm, P.foreArm, hint, el, hand); }
    else {
      const a = L ? armSwing : -armSwing, b = a + elbow;
      el[0] = sh[0] + s * P.upperArm * 0.1; el[1] = sh[1] - P.upperArm * Math.cos(a); el[2] = sh[2] + P.upperArm * Math.sin(a);
      hand[0] = el[0] + s * P.foreArm * 0.03; hand[1] = el[1] - P.foreArm * Math.cos(b); hand[2] = el[2] + P.foreArm * Math.sin(b);
    }
    const f = (P.foreArm - P.grip) / P.foreArm, g = P.handLen / P.foreArm;
    for (let j = 0; j < 3; j++) { const d = hand[j] - el[j]; wrist[j] = el[j] + d * f; tip[j] = wrist[j] + d * g; }
    put(out, L ? 'upperArmL' : 'upperArmR', segmentMatrix(sh, el, P.rUpperArm, P.rUpperArm, _m));
    put(out, L ? 'foreArmL' : 'foreArmR', segmentMatrix(el, wrist, P.rForeArm, P.rForeArm, _m));
    put(out, L ? 'handL' : 'handR', segmentMatrix(wrist, tip, P.handT, P.handW, _m));
  }
  return out;
}
