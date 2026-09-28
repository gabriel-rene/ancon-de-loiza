import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cellRng } from '../rng';
import type { PlantPart } from '../types';
import { tube, type Curve } from './tube';

/*
 * Almendro, tropical almond (Terminalia catappa). Habitat (see rules.ts): river banks near the
 * landings and town yards — families spent the day under the almond trees by the ferry
 * (research §5, S1). Morphology is general botany, not site measurement: tree 8–15 m with a
 * straight grey trunk; branches in horizontal tiers (whorls) from the trunk, giving a
 * pagoda-like layered crown, broad and flat; large obovate leaves (15–25 cm) clustered in
 * rosettes at the branch tips, glossy dark green, with some turning red, orange or yellow
 * before they fall. Local frame: base at the origin, up = +Y; ground at y ≈ 0.
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

// Grey-brown, fairly smooth bark with fine shallow fissures; soil-stained at the foot.
const BARK = lin(0x5e554c), BARK_ALT = lin(0x746c62), SOIL = lin(0x3a3027);

function barkColor(rng: Rng, y: number, out: THREE.Color) {
  out.copy(BARK).lerp(BARK_ALT, rng());
  if (rng() < 0.15) out.multiplyScalar(0.6 + 0.15 * rng());
  else out.multiplyScalar(0.9 + 0.2 * rng());
  return out.lerp(SOIL, 0.6 * (1 - smooth(0, 0.4, y)));
}

const barkTube = (rng: Rng, at: Curve, rad: (t: number) => number, radial: number, segs: number, flex: (t: number) => number) =>
  tube(at, rad, radial, segs, flex, { vertex: (_x, y, _z, o) => barkColor(rng, y, o), under: 0.2 });

/** A leaf rosette: flat cards around a branch tip `p`, spreading outward along `out`. */
interface Rosette { p: THREE.Vector3; out: THREE.Vector3; n: number }

/**
 * Flat, near-horizontal leaf cards in rosettes. Card normals tilt at most ~30° off vertical
 * (toward the branch direction), so each tier reads as a flat plate. `red` of the cards (an
 * exact count, picked at random) take a red-orange tint. Shade darkens toward the lower tiers
 * and the crown's inside. aFlex 0.35–0.7 by height.
 */
function tierCanopy(rng: Rng, rosettes: Rosette[], size: [number, number], red: number, yTop: number) {
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], col: number[] = [], fl: number[] = [], idx: number[] = [];
  const c = new THREE.Vector3(), cn = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3();
  const p = new THREE.Vector3(), rn = new THREE.Vector3(), d = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  const cards: { R: Rosette; k: number }[] = [];
  for (const R of rosettes) for (let k = 0; k < R.n; k++) cards.push({ R, k });
  // Exactly round(red · n) red cards.
  const isRed = new Uint8Array(cards.length);
  const nRed = Math.round(red * cards.length);
  for (let placed = 0; placed < nRed;) {
    const i = Math.floor(rng() * cards.length);
    if (!isRed[i]) { isRed[i] = 1; placed++; }
  }
  const rMax = Math.max(...rosettes.map((R) => Math.hypot(R.p.x, R.p.z))) + 0.5;
  cards.forEach(({ R, k }, ci) => {
    // Spread around the tip, biased outward; a slight dome (outer cards a little lower).
    const a = (k / R.n) * Math.PI * 2 + (rng() - 0.5) * 0.9;
    d.set(Math.cos(a), 0, Math.sin(a));
    const dist = lerp(0.1, 0.5, rng());
    c.copy(R.p).addScaledVector(d, dist).addScaledVector(R.out, 0.25);
    c.y += lerp(0.12, 0.2, rng()) - 0.12 * dist;
    // Mostly up, tipped toward the card's own outward direction.
    cn.copy(up).addScaledVector(d, lerp(0.15, 0.55, rng())).add(p.set(rng() - 0.5, 0, rng() - 0.5).multiplyScalar(0.2)).normalize();
    // Card "up" (v) radiates from the tip in the card plane.
    v.copy(d).sub(p.copy(cn).multiplyScalar(d.dot(cn))).normalize().applyAxisAngle(cn, (rng() - 0.5) * 0.8);
    u.crossVectors(v, cn).normalize();
    const s = lerp(size[0], size[1], rng()), h = s / 2, w = h * (0.85 + 0.3 * rng());
    const flip = rng() < 0.5;
    const outer = smooth(0.2, 1, Math.hypot(c.x, c.z) / rMax);
    const val = (0.6 + 0.25 * smooth(0, yTop, c.y) + 0.15 * outer) * (0.88 + 0.24 * rng());
    if (isRed[ci]) {
      const o = rng(); // red … orange
      tint.setRGB(val * 1.55, val * lerp(0.5, 0.85, o), val * lerp(0.35, 0.45, o));
    } else tint.setRGB(val, val, val);
    const base = pos.length / 3;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      p.copy(c).addScaledVector(u, (i * 2 - 1) * w).addScaledVector(v, (j * 2 - 1) * h);
      pos.push(p.x, p.y, p.z);
      // Card normal blended with a broad dome over the whole tier (soft, plate-like shading).
      rn.set(p.x / rMax, 0.9, p.z / rMax).normalize().multiplyScalar(0.5).addScaledVector(cn, 0.5).normalize();
      nrm.push(rn.x, rn.y, rn.z);
      uv.push(flip ? 1 - i : i, j);
      col.push(tint.r, tint.g, tint.b);
      fl.push(0.35 + 0.35 * clamp01(p.y / yTop));
    }
    idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
  });
  const g = new THREE.BufferGeometry();
  attr(g, 'position', pos, 3); attr(g, 'normal', nrm, 3); attr(g, 'uv', uv, 2);
  attr(g, 'color', col, 3); attr(g, 'aFlex', fl, 1);
  g.setIndex(idx);
  return g;
}

/**
 * Almendro (base at the origin, up = +Y), deterministic in `seed`. Parts: `bark` (straight trunk
 * to 55–70 % of the height, a thinner leader above it, 3–5 tiers of 4–6 near-horizontal branches
 * with upturned tips, one side twig each; vertex colours) and `foliage` (leaf cards of 0.9–1.4 m
 * for `paintAlmondLeaves()` in flat rosettes at the branch and twig tips; 12–18 % red-orange).
 * Tiers are 1.45–1.8 m apart (the low end of 1.2 m would let neighbouring plates merge), the
 * branches shorter toward the top. Height ≈ 7–12.5 m.
 * aFlex: trunk 0–0.08, leader up to 0.15, branches up to 0.35, cards 0.35–0.7 by height.
 */
export function buildAlmendro(seed: number): PlantPart[] {
  const rng = cellRng(seed, 0, 6311);
  const bark: THREE.BufferGeometry[] = [];
  const rosettes: Rosette[] = [];
  const nTier = 3 + Math.floor(rng() * 3);
  const gap = lerp(1.45, 1.8, rng());
  const rise0 = lerp(0.35, 0.55, rng()); // upturn of the branch tips (near-equal per tier keeps the plates flat)
  const y0 = lerp(2.6, 3.4, rng());
  const tierY = Array.from({ length: nTier }, (_, i) => y0 + i * gap + (i ? (rng() - 0.5) * 0.1 : 0));
  const yTopAttach = tierY[nTier - 1];
  const H = yTopAttach + 0.9; // approximate crown top
  const Ht = H * lerp(0.55, 0.7, rng());
  const r0 = lerp(0.16, 0.24, rng());
  // Straight trunk, a little lean, root flare at the foot.
  const lean = new THREE.Vector3((rng() - 0.5) * 0.3, 0, (rng() - 0.5) * 0.3);
  const B = new THREE.Vector3(0, -0.15, 0), T = new THREE.Vector3(lean.x, Ht, lean.z);
  const trunk = bezier(B, B.clone().setY(Ht * 0.35), T.clone().lerp(B, 0.3).setY(Ht * 0.7), T);
  const trunkR = (t: number) => r0 * (1 - 0.35 * t + 0.5 * Math.pow(1 - t, 12));
  bark.push(barkTube(rng, trunk, trunkR, 8, 7, (t) => 0.08 * t));
  // Thinner leader from the trunk top to the top tier.
  const L = new THREE.Vector3(T.x + (rng() - 0.5) * 0.2, yTopAttach + 0.15, T.z + (rng() - 0.5) * 0.2);
  const leader = bezier(T.clone().setY(Ht - 0.3), T.clone().setY(lerp(Ht, L.y, 0.4)), L.clone().setY(lerp(Ht, L.y, 0.7)), L);
  const rL = r0 * 0.62;
  bark.push(barkTube(rng, leader, (t) => rL * (1 - 0.6 * t), 6, 4, (t) => lerp(0.08, 0.15, t)));
  // Point on the trunk/leader axis at height y (both curves rise monotonically: bisect for t).
  const onCurve = (c: Curve, y: number, o: THREE.Vector3) => {
    let a = 0, b = 1;
    for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (c(m, o).y < y) a = m; else b = m; }
    const t = (a + b) / 2;
    c(t, o);
    return t;
  };
  const axis = (y: number, o: THREE.Vector3) => {
    if (y <= Ht - 0.3) return trunkR(onCurve(trunk, y, o));
    return rL * (1 - 0.6 * onCurve(leader, y, o));
  };

  const len0 = lerp(3.6, 4.8, rng());
  let az = rng() * Math.PI * 2;
  for (let ti = 0; ti < nTier; ti++) {
    const f = nTier > 1 ? ti / (nTier - 1) : 0;
    const nB = ti === nTier - 1 ? 4 + Math.floor(rng() * 2) : 4 + Math.floor(rng() * 3);
    const len = len0 * lerp(1, 0.45, f);
    const rise = rise0 + (rng() - 0.5) * 0.06;
    az += 0.6 + rng() * 0.8; // rotate each whorl
    for (let bi = 0; bi < nB; bi++) {
      const a = az + (bi / nB) * Math.PI * 2 + (rng() - 0.5) * 0.5;
      const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const y = tierY[ti] + (rng() - 0.5) * 0.12;
      const S = new THREE.Vector3();
      const rAx = axis(y, S);
      const l = len * lerp(0.8, 1.1, rng());
      const rTip = rise + (rng() - 0.5) * 0.1;
      // Leaves the axis slightly upward, runs out level (a slight sag), then turns up at the tip.
      const E = S.clone().addScaledVector(out, l).add(new THREE.Vector3(0, rTip, 0));
      const P1 = S.clone().addScaledVector(out, l * 0.4).add(new THREE.Vector3(0, 0.12, 0));
      const P2 = S.clone().addScaledVector(out, l * 0.8).add(new THREE.Vector3(0, rTip * 0.1 - 0.05, 0));
      const at = bezier(S, P1, P2, E);
      const rb = Math.min(rAx * 0.7, lerp(0.07, 0.03, f) * lerp(0.85, 1.15, rng()));
      bark.push(barkTube(rng, at, (t) => rb * (1 - 0.7 * t), 5, 4, (t) => lerp(0.12, 0.35, t)));
      rosettes.push({ p: E, out, n: 5 + Math.floor(rng() * 3) });
      // Short upturned shoots along the outer branch, their leaves reaching up to the tier's plate.
      for (const tm of [0.5, 0.7, 0.85]) {
        const q = at(tm + (rng() - 0.5) * 0.08, new THREE.Vector3());
        q.y = lerp(q.y, E.y, 0.75);
        rosettes.push({ p: q, out, n: 2 + Math.floor(rng() * 2) });
      }
      // One side twig from the outer half, level with the tier, with its own smaller rosette.
      const tS = lerp(0.5, 0.7, rng());
      const Sb = at(tS, new THREE.Vector3());
      const sa = a + (rng() < 0.5 ? -1 : 1) * lerp(0.5, 0.9, rng());
      const sOut = new THREE.Vector3(Math.cos(sa), 0, Math.sin(sa));
      const lt = l * lerp(0.3, 0.45, rng());
      const Eb = Sb.clone().addScaledVector(sOut, lt);
      Eb.y = E.y + (rng() - 0.5) * 0.1;
      const tw = bezier(Sb, Sb.clone().addScaledVector(sOut, lt * 0.4), Eb.clone().addScaledVector(sOut, -lt * 0.3).setY(Sb.y + (Eb.y - Sb.y) * 0.2), Eb);
      const rt = rb * (1 - 0.7 * tS) * 0.8;
      bark.push(barkTube(rng, tw, (t) => rt * (1 - 0.6 * t), 4, 3, (t) => lerp(lerp(0.12, 0.35, tS), 0.35, t)));
      rosettes.push({ p: Eb, out: sOut, n: 3 + Math.floor(rng() * 2) });
    }
  }
  const canopy = tierCanopy(rng, rosettes, [0.9, 1.4], lerp(0.12, 0.18, rng()), H + 0.5);
  const barkG = mergeGeometries(bark)!;
  bark.forEach((g) => g.dispose());
  barkG.computeBoundingBox(); barkG.computeBoundingSphere();
  canopy.computeBoundingBox(); canopy.computeBoundingSphere();
  return [{ name: 'bark', geometry: barkG }, { name: 'foliage', geometry: canopy }];
}
