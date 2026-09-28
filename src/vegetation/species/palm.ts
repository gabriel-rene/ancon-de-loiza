import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cellRng } from '../rng';
import type { PlantPart } from '../types';

/*
 * Coconut palm (Cocos nucifera). Morphology from general botany — all numbers below are
 * inferred, not measured on site:
 *  - 12–19 m tall, slender grey trunk (≈ 0.30 m radius low → 0.16 m under the crown) with a
 *    swollen base (bole) and close ring scars left by fallen fronds; weathered pale grey low
 *    down, browner towards the crown.
 *  - Trunks commonly lean (toward light / open sea, here biased to −Z = north) and curve back
 *    toward vertical near the top.
 *  - Crown of ≈ 26 pinnate fronds on a 137.5° spiral: the newest (spear) nearly vertical and
 *    short, mature ones arching out and drooping under their own weight, the oldest hanging
 *    below horizontal. Leaflets hang from the rachis in an inverted V and droop at the tips.
 *  - Clusters of nuts sit tucked under the crown among the frond bases.
 */

const DEG = Math.PI / 180;
const TRUNK_RADIAL = 7;
const FRONDS = 26;
const FROND_SEG = 12;
/** Columns across a frond: left tip, left mid, rachis, right mid, right tip. */
const FROND_COLS = 5;

type Rng = () => number;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** sRGB hex → linear working-space RGB triple. */
const lin = (hex: number) => new THREE.Color().setHex(hex);

function attr(g: THREE.BufferGeometry, name: string, data: number[], size: number) {
  g.setAttribute(name, new THREE.Float32BufferAttribute(data, size));
}

/**
 * Trunk: a tapered tube along a leaning, gently S-curved Catmull-Rom spine. Rings are placed
 * densely in the base flare and every ~0.3 m above so vertex colours can carry ring scars.
 */
function buildTrunk(rng: Rng, H: number, curve: THREE.CatmullRomCurve3, rScale: number) {
  // Ring heights (fractions of the curve): flare rings, then a jittered regular spacing.
  const ts: number[] = [];
  const len = curve.getLength();
  for (const y of [0, 0.12, 0.26, 0.42, 0.62]) ts.push(y / len);
  const step = 0.3;
  for (let s = 0.62 + step; s < len - 0.05; s += step * (0.85 + 0.3 * rng())) ts.push(s / len);
  ts.push(1);

  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], col: number[] = [], flex: number[] = [], idx: number[] = [];
  const P = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  const ref = new THREE.Vector3(0, 0, 1), d = new THREE.Vector3();
  const grey = lin(0x9e9b95), brown = lin(0x7d766c), crown = lin(0x4f4130), c = new THREE.Color();
  const base0 = 0.3; // curve starts 0.3 m below the instance origin (sinks into slopes)
  ts.forEach((t, i) => {
    curve.getPointAt(t, P);
    curve.getTangentAt(t, T);
    N.crossVectors(T, ref).normalize();
    B.crossVectors(T, N).normalize();
    const y = t * len; // metres from the buried base
    const above = Math.max(0, y - base0);
    let r = (0.3 - 0.14 * Math.pow(t, 0.8)) * rScale;
    r += 0.15 * Math.pow(Math.max(0, 1 - above / 0.6), 2); // bole flare: ≈ 0.45 m at ground
    r += 0.07 * smooth(0.95, 1, t) * rScale;               // leaf-base bulge under the crown
    // Ring scar: every ring a little darker at random, every other ring a clear scar.
    const scar = i > 4 && i < ts.length - 2 ? (i % 2 ? 0.62 + 0.12 * rng() : 0.92 + 0.08 * rng()) : 1;
    c.copy(grey).lerp(brown, smooth(0.25, 0.9, t)).lerp(crown, smooth(0.94, 1, t)).multiplyScalar(scar);
    for (let j = 0; j <= TRUNK_RADIAL; j++) {
      const a = (j / TRUNK_RADIAL) * Math.PI * 2;
      d.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      pos.push(P.x + d.x * r, P.y + d.y * r, P.z + d.z * r);
      nrm.push(d.x, d.y, d.z);
      uv.push(j / TRUNK_RADIAL, y / H);
      // Slight lighter streak on one side (weathering) keeps the tube from looking turned.
      const w = 1 + 0.06 * Math.cos(a * 2 + 1.3);
      col.push(c.r * w, c.g * w, c.b * w);
      flex.push(0.35 * t * t);
    }
    if (i > 0) {
      const r0 = (i - 1) * (TRUNK_RADIAL + 1), r1 = i * (TRUNK_RADIAL + 1);
      for (let j = 0; j < TRUNK_RADIAL; j++) idx.push(r0 + j, r0 + j + 1, r1 + j, r0 + j + 1, r1 + j + 1, r1 + j);
    }
  });
  const g = new THREE.BufferGeometry();
  attr(g, 'position', pos, 3); attr(g, 'normal', nrm, 3); attr(g, 'uv', uv, 2);
  attr(g, 'color', col, 3); attr(g, 'aFlex', flex, 1);
  g.setIndex(idx);
  return g;
}

/** 6–10 nuts (smooth-shaded icosahedra) tucked under the crown. */
function buildNuts(rng: Rng, top: THREE.Vector3): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const n = 6 + Math.floor(rng() * 5);
  const green = lin(0x56631f), ripe = lin(0x8a6a2c), c = new THREE.Color();
  const bunchAz = rng() * Math.PI * 2;
  for (let k = 0; k < n; k++) {
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 0);
    g.deleteAttribute('normal');
    g = mergeVertices(g);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const nrm: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i).normalize();
      nrm.push(v.x, v.y, v.z);
    }
    attr(g, 'normal', nrm, 3);
    const s = 0.13 * (0.85 + 0.3 * rng());
    g.scale(s, s * 1.15, s);
    // Two or three bunches around the trunk, hanging 0.3–0.8 m under the frond bases.
    const az = bunchAz + (k % 3) * 2.1 + (rng() - 0.5) * 0.9;
    const rr = 0.26 + 0.16 * rng();
    g.translate(top.x + Math.cos(az) * rr, top.y - 0.3 - 0.5 * rng(), top.z + Math.sin(az) * rr);
    c.copy(green).lerp(ripe, rng() < 0.3 ? 0.6 + 0.4 * rng() : 0.25 * rng());
    const col: number[] = [], flex: number[] = [];
    for (let i = 0; i < p.count; i++) { col.push(c.r, c.g, c.b); flex.push(0.35); }
    attr(g, 'color', col, 3); attr(g, 'aFlex', flex, 1);
    out.push(g);
  }
  return out;
}

/**
 * One frond: a quadratic rachis rising at `elev` and sagging ∝ t², carrying a 5-column ribbon
 * whose halves hang down (inverted V) with extra droop at the leaflet tips and a slight twist
 * toward the frond tip. UV: u across (0 left tip … 1 right tip), v along the rachis.
 */
function buildFrond(rng: Rng, base: THREE.Vector3, az: number, age: number, crownC: THREE.Vector3, lenMul = 1) {
  const elev = lerp(62, -38, Math.pow(age, 0.85)) * DEG + (rng() - 0.5) * 12 * DEG;
  // New fronds are shorter and still narrow (leaflets not fully spread).
  const L = (4 + 1.8 * rng()) * lerp(0.5, 1, smooth(0, 0.25, age)) * lenMul;
  const spread = lerp(0.35, 1, smooth(0, 0.25, age));
  const sag = L * (0.14 + 0.44 * age);
  const D = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
  const S0 = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az)); // horizontal, ⟂ frond plane
  const up = new THREE.Vector3(0, 1, 0);
  // Quadratic rachis, then uniformly rescaled about the base so its arc length is L.
  const raw = (t: number, o: THREE.Vector3) =>
    o.copy(D).multiplyScalar(L * t * Math.cos(elev)).addScaledVector(up, L * t * Math.sin(elev) - sag * t * t);
  let arc = 0; const a0 = new THREE.Vector3(), a1 = new THREE.Vector3();
  for (let i = 1; i <= 16; i++) { raw(i / 16, a1); arc += a1.distanceTo(a0); a0.copy(a1); }
  const k = L / arc;
  const at = (t: number, o: THREE.Vector3) => raw(t, o).multiplyScalar(k).add(base);

  const fold = (28 + 10 * age) * DEG, droop = (22 + 16 * age) * DEG;
  const twist = (rng() < 0.5 ? -1 : 1) * (10 + 15 * rng()) * DEG;
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], flex: number[] = [], idx: number[] = [];
  const R = new THREE.Vector3(), T = new THREE.Vector3(), S = new THREE.Vector3(), N = new THREE.Vector3();
  const dirIn = new THREE.Vector3(), dirOut = new THREE.Vector3(), p = new THREE.Vector3(), o = new THREE.Vector3(), n = new THREE.Vector3();
  const crownUp = crownC.clone().addScaledVector(up, 0.4);
  for (let i = 0; i <= FROND_SEG; i++) {
    const t = i / FROND_SEG;
    at(t, R);
    // Analytic tangent of the quadratic.
    T.copy(D).multiplyScalar(L * Math.cos(elev)).addScaledVector(up, L * Math.sin(elev) - 2 * sag * t).normalize();
    S.copy(S0).applyAxisAngle(T, twist * t);
    N.crossVectors(S, T).normalize(); // ribbon "up" (≈ +Y for a level frond)
    const hw = 0.9 * Math.pow(Math.sin(Math.PI * Math.min(t, 0.999) + 1e-3), 0.6) * spread;
    for (let c = 0; c < FROND_COLS; c++) {
      const side = c < 2 ? -1 : c > 2 ? 1 : 0;
      p.copy(R);
      if (side) {
        dirIn.copy(S).multiplyScalar(side * Math.cos(fold)).addScaledVector(N, -Math.sin(fold));
        dirOut.copy(S).multiplyScalar(side * Math.cos(fold + droop)).addScaledVector(N, -Math.sin(fold + droop));
        p.addScaledVector(dirIn, hw * 0.5);
        if (c === 0 || c === 4) p.addScaledVector(dirOut, hw * 0.5);
      }
      pos.push(p.x, p.y, p.z);
      // Normal: half ribbon "up", half outward from the crown (reads as a rounded mass).
      o.subVectors(p, crownUp).normalize();
      n.copy(N).add(o).normalize();
      nrm.push(n.x, n.y, n.z);
      uv.push(c / (FROND_COLS - 1), t);
      flex.push(0.35 + 0.65 * t);
    }
    if (i > 0) {
      const r0 = (i - 1) * FROND_COLS, r1 = i * FROND_COLS;
      for (let c = 0; c < FROND_COLS - 1; c++) {
        const a = r0 + c, b = r1 + c;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  attr(g, 'position', pos, 3); attr(g, 'normal', nrm, 3); attr(g, 'uv', uv, 2); attr(g, 'aFlex', flex, 1);
  g.setIndex(idx);
  return g;
}

/**
 * Build one coconut palm (base at the origin, trunk along +Y). Deterministic in `seed`.
 * `age` (0 young … 1 full grown, phase 2c): a young palm has a short trunk (0.8–1.5 m), no nuts
 * and fronds at 75 % length rising from near the ground — not a scaled-down old palm.
 * Parts: `bark` (trunk + nuts, vertex colours) and `foliage` (merged fronds, mapped with
 * `paintFrond()`).
 */
export function buildPalm(seed: number, age = 1): PlantPart[] {
  const rng = cellRng(seed, 0, 911), young = cellRng(seed, 1, 911);
  const Hfull = 12 + 7 * rng();
  const H = age >= 1 ? Hfull : lerp(0.8 + 0.7 * young(), Hfull, age * age);
  const lean = 12 * DEG * rng() * Math.min(1, age * 1.5);
  const az = (rng() - 0.5) * 0.9 * Math.PI;                  // biased toward −Z (the sea)
  const dir = new THREE.Vector3(Math.sin(az), 0, -Math.cos(az));
  const side = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
  const sAmp = (0.15 + 0.25 * rng()) * (rng() < 0.5 ? -1 : 1);
  const off = H * Math.tan(lean);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const g = (1.3 * t - 0.5 * t * t) / 0.8;                  // leans from the base, straightens up top
    pts.push(new THREE.Vector3().addScaledVector(dir, off * g).addScaledVector(side, sAmp * Math.sin(Math.PI * 2 * t)).setY(-0.3 + (H + 0.3) * t));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const trunk = buildTrunk(rng, H, curve, 0.9 + 0.2 * rng());
  const top = curve.getPointAt(1);
  const nuts = buildNuts(rng, top);
  const keptNuts = age >= 0.5 ? nuts : [];
  if (!keptNuts.length) nuts.forEach((g) => g.dispose());

  const fronds: THREE.BufferGeometry[] = [];
  const az0 = rng() * Math.PI * 2;
  for (let f = 0; f < FRONDS; f++) {
    const fa = f / (FRONDS - 1);
    const a = az0 + f * 137.5 * DEG + (rng() - 0.5) * 0.15;
    const base = top.clone().add(new THREE.Vector3(Math.cos(a) * 0.12, 0.25 - 0.55 * fa, Math.sin(a) * 0.12));
    fronds.push(buildFrond(rng, base, a, fa, top, lerp(0.75, 1, age)));
  }

  const bark = mergeGeometries([trunk, ...keptNuts])!;
  const foliage = mergeGeometries(fronds)!;
  [trunk, ...keptNuts, ...fronds].forEach((g) => g.dispose());
  bark.computeBoundingBox(); bark.computeBoundingSphere();
  foliage.computeBoundingBox(); foliage.computeBoundingSphere();
  return [{ name: 'bark', geometry: bark }, { name: 'foliage', geometry: foliage }];
}
