import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cellRng } from '../rng';
import type { PlantPart } from '../types';
import { buildCanopy, type Lobe } from './basinMangrove';
import { tube, type Curve } from './tube';

/*
 * Coastal shrubs. Habitats (see rules.ts): buttonwood on drier ground behind the mangroves
 * (research §5, S22); sea grape on the beach edge and dunes, seaward of the casuarinas (S22).
 * Morphology is general botany, not site measurement:
 *  - Buttonwood (Conocarpus erectus): multi-stemmed shrub or small tree 2–5 m, often leaning or
 *    sprawling; dark, rough bark; dense crown of narrow pointed leaves. The coastal form (silver
 *    buttonwood) is silvery-green, greyer and lighter than the mangroves.
 *  - Sea grape (Coccoloba uvifera): sprawling beach shrub 1–3 m, wider than tall; stiff, crooked
 *    grey stems; very large round leathery leaves (15–25 cm) with red-pink veins, some turning
 *    red; open crown with the stems showing.
 * Local frame: base at the origin, up = +Y; ground at y ≈ 0.
 */

type Rng = () => number;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** sRGB hex → linear working-space colour. */
const lin = (hex: number) => new THREE.Color().setHex(hex);

function attr(g: THREE.BufferGeometry, name: string, data: number[], size: number) {
  g.setAttribute(name, new THREE.Float32BufferAttribute(data, size));
}

const bezier = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3): Curve => {
  const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
  return (t, o) => curve.getPoint(t, o);
};

interface BarkStyle {
  base: THREE.Color;
  /** Second bark tone mixed in per vertex. */
  alt: THREE.Color;
  /** Fraction of vertices that take a dark fissure tone. */
  fissure: number;
  /** Per-vertex brightness jitter. */
  jitter: number;
  /** Soil tone the stems take near the ground. */
  soil: THREE.Color;
}

// Buttonwood: dark, rough, furrowed bark. Sea grape: smooth grey, mottled, sand-dusted at the foot.
const BUTTON_BARK: BarkStyle = { base: lin(0x3e3630), alt: lin(0x5a5249), fissure: 0.35, jitter: 0.25, soil: lin(0x2e2821) };
const GRAPE_BARK: BarkStyle = { base: lin(0x6e685f), alt: lin(0x57514a), fissure: 0.08, jitter: 0.18, soil: lin(0x8f826c) };

/** Bark colour at local (x, y, z): species tone with per-vertex variation, soil-tinted near the ground. */
function barkColor(rng: Rng, st: BarkStyle, y: number, out: THREE.Color) {
  out.copy(st.base).lerp(st.alt, rng());
  if (rng() < st.fissure) out.multiplyScalar(0.55 + 0.15 * rng());
  else out.multiplyScalar(1 - st.jitter / 2 + st.jitter * rng());
  return out.lerp(st.soil, 0.6 * (1 - smooth(0, 0.3, y)));
}

const barkTube = (rng: Rng, st: BarkStyle, at: Curve, rad: (t: number) => number, radial: number, segs: number,
  flex: (t: number) => number) =>
  tube(at, rad, radial, segs, flex, { vertex: (_x, y, _z, o) => barkColor(rng, st, y, o), under: 0.2 });

function finish(bark: THREE.BufferGeometry[], canopy: THREE.BufferGeometry): PlantPart[] {
  const barkG = mergeGeometries(bark)!;
  bark.forEach((g) => g.dispose());
  barkG.computeBoundingBox(); barkG.computeBoundingSphere();
  canopy.computeBoundingBox(); canopy.computeBoundingSphere();
  return [{ name: 'bark', geometry: barkG }, { name: 'foliage', geometry: canopy }];
}

/**
 * Buttonwood (base at the origin, up = +Y), deterministic in `seed`. Parts: `bark` (2–4 stems
 * from the base leaning out 10–35°, two branches each; vertex colours) and `foliage` (60–80 leaf
 * cards of 0.6–1.0 m for `paintButtonwoodLeaves()` over 1–3 overlapping ellipsoids at the stem
 * tops, per-card tint with some paler silvery cards). Height ≈ 2.5–4 m; the crown reaches down to about 1 m.
 * aFlex: stems 0–0.2, branches up to 0.3, cards 0.35–0.7 by height.
 */
export function buildButtonwood(seed: number): PlantPart[] {
  const rng = cellRng(seed, 0, 4127);
  const bark: THREE.BufferGeometry[] = [];
  const nStem = 2 + Math.floor(rng() * 3);
  const nLobe = Math.min(nStem, 1 + Math.floor(rng() * 3));
  const az0 = rng() * Math.PI * 2;
  const lean = (0.3 + 0.7 * rng()) * 0.6; // whole-shrub lean bias (sprawling to one side)
  const tips: THREE.Vector3[] = [];
  for (let k = 0; k < nStem; k++) {
    const az = az0 + (k / nStem) * Math.PI * 2 * 0.7 + (rng() - 0.5) * 0.6;
    const tilt = THREE.MathUtils.degToRad(lerp(10, 35, rng()));
    const len = lerp(1.5, 2.6, rng());
    const B = new THREE.Vector3(Math.cos(az) * 0.08, -0.12, Math.sin(az) * 0.08);
    const dir = new THREE.Vector3(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az));
    const T = B.clone().addScaledVector(dir, len);
    T.x += Math.cos(az0) * lean * 0.4; T.z += Math.sin(az0) * lean * 0.4;
    // Slightly crooked: the mid controls wander off the straight line.
    const wob = () => new THREE.Vector3(rng() - 0.5, 0, rng() - 0.5).multiplyScalar(0.35);
    const at = bezier(B, B.clone().lerp(T, 0.33).add(wob()), B.clone().lerp(T, 0.66).add(wob()), T);
    const r = lerp(0.055, 0.09, rng());
    bark.push(barkTube(rng, BUTTON_BARK, at, (t) => r * (1.15 - 0.6 * t + 0.25 * Math.pow(1 - t, 10)), 6, 6, (t) => 0.2 * t));
    tips.push(T);
    // Two branches from the upper stem into the crown.
    for (let j = 0; j < 2; j++) {
      const S = at(lerp(0.5, 0.85, rng()), new THREE.Vector3());
      const a = az + (j ? 1 : -1) * (0.6 + 0.8 * rng());
      const E = S.clone().add(new THREE.Vector3(Math.cos(a) * lerp(0.5, 0.9, rng()), lerp(0.3, 0.7, rng()), Math.sin(a) * lerp(0.5, 0.9, rng())));
      const M1 = S.clone().lerp(E, 0.35).setY(S.y + (E.y - S.y) * 0.6), M2 = S.clone().lerp(E, 0.7).setY(E.y + 0.08);
      const rb = r * (0.35 + 0.15 * rng());
      bark.push(barkTube(rng, BUTTON_BARK, bezier(S, M1, M2, E), (t) => rb * (1 - 0.6 * t), 4, 3, (t) => lerp(0.12, 0.3, t)));
    }
  }
  // Crown lobes around groups of stem tips.
  const lobes: Lobe[] = [];
  for (let l = 0; l < nLobe; l++) {
    const group = tips.filter((_, k) => k % nLobe === l);
    const C = group.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / group.length);
    const rx = lerp(1.0, 1.5, rng());
    lobes.push({ C: C.add(new THREE.Vector3(0, lerp(-0.2, 0.1, rng()), 0)), rx, rz: rx * (0.8 + 0.3 * rng()), ry: lerp(0.85, 1.2, rng()) });
  }
  const canopy = buildCanopy(rng, lobes, { n: 60 + Math.floor(rng() * 21), size: [0.6, 1.0], accent: lin(0xd0d6c8), accentP: 0.3, accentAmt: 0.3 });
  return finish(bark, canopy);
}

/** Crooked polyline stem through jittered points, smoothed as a Catmull–Rom curve. */
function crooked(rng: Rng, pts: THREE.Vector3[], kink: number): Curve {
  const q = pts.map((p, i) => (i === 0 ? p.clone() : p.clone().add(new THREE.Vector3(rng() - 0.5, (rng() - 0.5) * 0.6, rng() - 0.5).multiplyScalar(kink))));
  const curve = new THREE.CatmullRomCurve3(q, false, 'centripetal');
  return (t, o) => curve.getPoint(t, o);
}

/**
 * Sea-grape leaf cards clustered around the stem tips (`anchors`): each card sits a little above
 * and outside its anchor and faces mostly up and out (open crown, stems visible below).
 * About 10 % of cards get a red tint (leaves turning red). aFlex 0.25–0.45 by height (stiff).
 */
function grapeCanopy(rng: Rng, anchors: { p: THREE.Vector3; out: THREE.Vector3 }[], n: number) {
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], col: number[] = [], fl: number[] = [], idx: number[] = [];
  const c = new THREE.Vector3(), cn = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3();
  const p = new THREE.Vector3(), rn = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  const yMax = Math.max(...anchors.map((a) => a.p.y)) + 0.6;
  for (let k = 0; k < n; k++) {
    const { p: A, out } = anchors[k % anchors.length];
    // Around the anchor, biased up and outward.
    c.set(rng() - 0.5, 0, rng() - 0.5).multiplyScalar(0.7).add(A).addScaledVector(out, 0.15 + 0.2 * rng());
    c.y += lerp(0.05, 0.4, rng());
    cn.copy(up).multiplyScalar(0.5).addScaledVector(out, 0.7).add(p.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(0.9)).normalize();
    if (cn.y < 0.1) { cn.y = 0.1; cn.normalize(); }
    // Card "up" (v) roughly along the outward direction, in the card plane.
    v.copy(out).addScaledVector(up, 0.3);
    v.sub(p.copy(cn).multiplyScalar(v.dot(cn)));
    if (v.lengthSq() < 1e-4) v.set(1, 0, 0).sub(p.copy(cn).multiplyScalar(cn.x));
    v.normalize().applyAxisAngle(cn, (rng() - 0.5) * 1.6);
    u.crossVectors(v, cn).normalize();
    const size = lerp(0.7, 1.1, rng()), h = size / 2, w = h * (0.85 + 0.3 * rng());
    const flip = rng() < 0.5;
    const val = (0.72 + 0.28 * smooth(0, yMax, c.y)) * (0.88 + 0.24 * rng());
    if (rng() < 0.1) tint.setRGB(val * 1.45, val * 0.72, val * 0.6); // leaves turning red
    else tint.setRGB(val, val, val);
    const base = pos.length / 3;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      p.copy(c).addScaledVector(u, (i * 2 - 1) * w).addScaledVector(v, (j * 2 - 1) * h);
      p.y = Math.max(p.y, 0.05);
      pos.push(p.x, p.y, p.z);
      // Soft dome normals: card normal blended with the direction from the shrub's core.
      rn.set(p.x, Math.max(0, p.y) + 0.6, p.z).normalize();
      rn.multiplyScalar(0.45).addScaledVector(cn, 0.55).normalize();
      nrm.push(rn.x, rn.y, rn.z);
      uv.push(flip ? 1 - i : i, j);
      col.push(tint.r, tint.g, tint.b);
      fl.push(0.25 + 0.2 * clamp01(p.y / yMax));
    }
    idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
  }
  const g = new THREE.BufferGeometry();
  attr(g, 'position', pos, 3); attr(g, 'normal', nrm, 3); attr(g, 'uv', uv, 2);
  attr(g, 'color', col, 3); attr(g, 'aFlex', fl, 1);
  g.setIndex(idx);
  return g;
}

/**
 * Sea grape (base at the origin, up = +Y), deterministic in `seed`. Parts: `bark` (3–6 crooked,
 * low stems spreading sideways 1.0–1.8 m, each with a short side branch; vertex colours) and
 * `foliage` (50–70 cards of 0.7–1.1 m for `paintSeaGrapeLeaves()` near the stem tips, ~10 %
 * red-tinted). Height ≈ 1.3–2.4 m; crown width ≥ 1.3 × height.
 * aFlex: stems 0–0.15, branches up to 0.2, cards 0.25–0.45 (stiff, leathery).
 */
export function buildSeaGrape(seed: number): PlantPart[] {
  const rng = cellRng(seed, 0, 5227);
  const bark: THREE.BufferGeometry[] = [];
  const anchors: { p: THREE.Vector3; out: THREE.Vector3 }[] = [];
  const nStem = 3 + Math.floor(rng() * 4);
  const az0 = rng() * Math.PI * 2;
  for (let k = 0; k < nStem; k++) {
    const az = az0 + (k / nStem) * Math.PI * 2 + (rng() - 0.5) * 0.7;
    const out = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const reach = lerp(1.0, 1.8, rng()), hTip = lerp(0.6, 1.4, rng());
    // Rises steeply from the base, then runs out sideways and turns up again at the tip.
    const pts = [
      new THREE.Vector3(0, -0.1, 0).addScaledVector(out, 0.05),
      new THREE.Vector3(0, hTip * 0.55, 0).addScaledVector(out, reach * 0.2),
      new THREE.Vector3(0, hTip * 0.7, 0).addScaledVector(out, reach * 0.55),
      new THREE.Vector3(0, hTip * 0.8, 0).addScaledVector(out, reach * 0.8),
      new THREE.Vector3(0, hTip, 0).addScaledVector(out, reach),
    ];
    const at = crooked(rng, pts, 0.3);
    const r = lerp(0.045, 0.075, rng());
    bark.push(barkTube(rng, GRAPE_BARK, at, (t) => r * (1.1 - 0.55 * t + 0.25 * Math.pow(1 - t, 8)), 5, 8, (t) => 0.15 * t));
    anchors.push({ p: at(1, new THREE.Vector3()), out }, { p: at(0.7, new THREE.Vector3()), out });
    // One short side branch from the outer half.
    const S = at(lerp(0.45, 0.7, rng()), new THREE.Vector3());
    const a = az + (rng() < 0.5 ? -1 : 1) * (0.5 + 0.5 * rng());
    const bOut = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const E = S.clone().addScaledVector(bOut, lerp(0.5, 0.9, rng())).add(new THREE.Vector3(0, lerp(0.15, 0.45, rng()), 0));
    const bAt = crooked(rng, [S, S.clone().lerp(E, 0.5), E], 0.15);
    const rb = r * 0.5;
    bark.push(barkTube(rng, GRAPE_BARK, bAt, (t) => rb * (1 - 0.5 * t), 4, 4, (t) => lerp(0.1, 0.2, t)));
    anchors.push({ p: E, out: bOut });
  }
  const canopy = grapeCanopy(rng, anchors, 50 + Math.floor(rng() * 21));
  return finish(bark, canopy);
}
