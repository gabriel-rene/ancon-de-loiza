import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WIND_DIR } from '../../geo/constants';
import { cellRng } from '../rng';
import type { PlantPart } from '../types';

/*
 * Casuarina (Casuarina equisetifolia, "pino australiano"), the tree of the Piñones dunes behind
 * the beach. Numbers are from general botany, not site measurements:
 *  - 15–25 m tall; a straight or slightly leaning trunk (here 0–6° downwind, toward WIND_DIR)
 *    with rough, dark, fissured grey-brown bark.
 *  - Open, irregular conical-to-columnar crown: many thin branches rising 25–60°, the lower
 *    ones longest; windswept on the coast (leeward branches reach further than windward ones).
 *  - Foliage is not needles but thin, jointed grey-green branchlets 10–20 cm long hanging in
 *    soft drooping tufts, which is what makes the crown read as feathery and see-through.
 * Local frame: base at the origin, up = +Y, +X east, +Z south (the wind lean assumes the
 * instance is placed with little rotation).
 */

type Rng = () => number;
type Curve = (t: number, o: THREE.Vector3) => THREE.Vector3;
const DEG = Math.PI / 180;
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

const BARK_DARK = lin(0x3a3129), BARK_GREY = lin(0x5e554b), BARK_BRANCH = lin(0x6a6157);

/**
 * Tube along `at(t)` with parallel-transported frames, radius `rad(t)`. Vertex colours from
 * `color(t, out)` (once per ring), aFlex from `flex(t)`.
 */
function tube(at: Curve, rad: (t: number) => number, radial: number, segs: number,
  flex: (t: number) => number, color: (t: number, out: THREE.Color) => THREE.Color) {
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], col: number[] = [], fl: number[] = [], idx: number[] = [];
  const P = new THREE.Vector3(), Q = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  const d = new THREE.Vector3(), prevT = new THREE.Vector3(), c = new THREE.Color(), q = new THREE.Quaternion();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, e = 1e-3;
    T.subVectors(at(Math.min(1, t + e), Q), at(Math.max(0, t - e), P)).normalize();
    if (i === 0) {
      N.set(0, 1, 0);
      if (Math.abs(T.y) > 0.9) N.set(1, 0, 0);
      N.sub(d.copy(T).multiplyScalar(N.dot(T))).normalize();
    } else {
      q.setFromUnitVectors(prevT, T);
      N.applyQuaternion(q).sub(d.copy(T).multiplyScalar(N.dot(T))).normalize();
    }
    prevT.copy(T);
    B.crossVectors(T, N);
    at(t, P);
    const r = rad(t);
    color(t, c);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      d.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      pos.push(P.x + d.x * r, P.y + d.y * r, P.z + d.z * r);
      nrm.push(d.x, d.y, d.z);
      uv.push(j / radial, t);
      const s = 0.82 + 0.18 * (0.5 + 0.5 * d.y);           // underside a little darker
      col.push(c.r * s, c.g * s, c.b * s);
      fl.push(flex(t));
    }
    if (i > 0) {
      const r0 = (i - 1) * (radial + 1), r1 = i * (radial + 1);
      for (let j = 0; j < radial; j++) idx.push(r0 + j, r0 + j + 1, r1 + j, r0 + j + 1, r1 + j + 1, r1 + j);
    }
  }
  const g = new THREE.BufferGeometry();
  attr(g, 'position', pos, 3); attr(g, 'normal', nrm, 3); attr(g, 'uv', uv, 2);
  attr(g, 'color', col, 3); attr(g, 'aFlex', fl, 1);
  g.setIndex(idx);
  return g;
}

/** Card rows (top = attachment, bottom = hanging tips) and the aFlex at the tips. */
const CARD_ROWS = 3, TIP_FLEX = 0.9;

/**
 * Build one casuarina (base at the origin, up = +Y). Deterministic in `seed`.
 * Parts: `bark` (trunk + branches, vertex colours) and `foliage` (drooping wisp cards mapped
 * with `paintCasuarinaWisps()`, vertex-colour tint per card with crown-depth darkening).
 */
export function buildCasuarina(seed: number): PlantPart[] {
  const rng = cellRng(seed, 0, 2311);
  const H = 15 + 7 * rng();
  const wind = new THREE.Vector3(WIND_DIR[0], 0, WIND_DIR[1]);
  const side = new THREE.Vector3(-wind.z, 0, wind.x);
  const lean = 6 * DEG * rng(), off = H * Math.tan(lean);
  const wob = (rng() - 0.5) * 0.5;

  // Trunk spine: leans downwind from the base, a faint S-wobble across the wind, 0.3 m buried.
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    pts.push(new THREE.Vector3().addScaledVector(wind, off * t).addScaledVector(side, wob * Math.sin(Math.PI * t)).setY(-0.3 + (H + 0.3) * t));
  }
  const spine = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const trunkAt: Curve = (t, o) => spine.getPointAt(clamp01(t), o);
  const trunkFlex = (t: number) => 0.3 * t * t;
  /** Trunk parameter at height y (the spine is near-vertical, so y is close to linear in t). */
  const tAtY = (y: number) => clamp01((y + 0.3) / (H + 0.3));
  const bark: THREE.BufferGeometry[] = [];
  const tint = new THREE.Color();
  bark.push(tube(trunkAt,
    (t) => lerp(0.28, 0.08, Math.pow(t, 0.9)) + 0.12 * Math.pow(Math.max(0, 1 - t * (H + 0.3) / 1.2), 2),
    7, 10, trunkFlex,
    (t, o) => o.copy(BARK_DARK).lerp(BARK_GREY, 0.25 + 0.5 * rng() * smooth(0, 0.6, t)).multiplyScalar(0.85 + 0.25 * rng())));

  const nBranch = 16 + Math.floor(rng() * 7);
  const Rmax = H * (0.2 + 0.06 * rng());
  const cardPos: number[] = [], cardNrm: number[] = [], cardUv: number[] = [], cardCol: number[] = [], cardFl: number[] = [], cardIdx: number[] = [];
  const U = new THREE.Vector3(), V = new THREE.Vector3(), Wd = new THREE.Vector3(), Wn = new THREE.Vector3(), O = new THREE.Vector3();
  const axis = new THREE.Vector3(), p = new THREE.Vector3(), nn = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0), row = new THREE.Vector3();
  const brown = lin(0x9a7a58);

  /**
   * One wisp card hanging from `A` on a twig with unit tangent `T`: it hangs straight down
   * (minus the component along the twig), spun about the twig by up to ±55°, its width roughly
   * along the twig; two segments, the lower one more vertical (drooping). `f` is the height
   * fraction in the crown (0 lowest … 1 top), `flexTop` the aFlex at the attachment.
   */
  const addCard = (A: THREE.Vector3, T: THREE.Vector3, f: number, flexTop: number) => {
    trunkAt(tAtY(A.y), axis);
    O.set(A.x - axis.x, 0, A.z - axis.z);
    const rOut = O.length();
    if (rOut < 1e-4) O.set(1, 0, 0); else O.multiplyScalar(1 / rOut);
    V.copy(down).addScaledVector(T, T.y).normalize();
    V.applyAxisAngle(T, (rng() - 0.5) * 110 * DEG);
    if (V.y > -0.35) V.y = -0.35, V.normalize();
    U.crossVectors(V, T).normalize();
    U.applyAxisAngle(V, (rng() - 0.5) * 50 * DEG);
    Wn.crossVectors(U, V).normalize();                       // the card's own normal
    const size = lerp(1, 0.72, f) * (0.85 + 0.3 * rng());
    const w = 1.4 * size * (0.9 + 0.2 * rng()), h = 2.4 * size;
    const flip = rng() < 0.5;
    // Per-card tint × crown-depth darkening (inner and lower cards see less sky); grey-green,
    // the blue kept low so the sky fill doesn't turn it teal; a few browned tufts.
    const depth = smooth(0.2, 0.9, rOut / Math.max(0.5, Rmax * lerp(1, 0.25, f)));
    const val = (0.6 + 0.4 * depth) * lerp(0.8, 1, f) * (0.8 + 0.3 * rng());
    tint.setRGB(val, val * 0.97, val * 0.7);
    if (rng() < 0.15) tint.lerp(brown.clone().multiplyScalar(val), 0.35 + 0.3 * rng());
    const base = cardPos.length / 3;
    // Top edge a little above the twig so the tufts spring from it.
    row.copy(A).setY(A.y + 0.18 * h);
    for (let r = 0; r < CARD_ROWS; r++) {
      const v = r / (CARD_ROWS - 1);
      if (r > 0) {
        Wd.copy(V).addScaledVector(O, 0.35 * (1 - v)).lerp(down, 0.55 * v).normalize();
        row.addScaledVector(Wd, h / (CARD_ROWS - 1));
      }
      for (let i = 0; i < 2; i++) {
        p.copy(row).addScaledVector(U, (i - 0.5) * w * lerp(0.9, 1.1, v));
        cardPos.push(p.x, p.y, p.z);
        // Normal: outward from the crown axis (and a little up), blended with the card's own.
        trunkAt(tAtY(p.y), axis);
        nn.set(p.x - axis.x, 0, p.z - axis.z);
        if (nn.lengthSq() < 1e-6) nn.copy(O);
        nn.normalize().setY(0.35 + 0.35 * f).normalize();
        nn.multiplyScalar(0.7).addScaledVector(Wn, Wn.dot(nn) < 0 ? -0.3 : 0.3).normalize();
        cardNrm.push(nn.x, nn.y, nn.z);
        cardUv.push(flip ? 1 - i : i, 1 - v);
        cardCol.push(tint.r, tint.g, tint.b);
        cardFl.push(lerp(flexTop, TIP_FLEX, v));
      }
      if (r > 0) {
        const a0 = base + (r - 1) * 2, b0 = base + r * 2;
        cardIdx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
      }
    }
  };

  // Branches: golden-angle spiral from 30% to 95% of the height, longest low (conical crown),
  // longer to leeward (windswept), rising 25–60° (steeper higher up), sagging at the tip; each
  // carries 5–9 wisp cards from 15% of its length to the tip.
  const az0 = rng() * Math.PI * 2;
  const S = new THREE.Vector3(), D = new THREE.Vector3(), A = new THREE.Vector3(), T = new THREE.Vector3(), Tq = new THREE.Vector3();
  for (let k = 0; k < nBranch; k++) {
    const f = clamp01((k + rng() * 0.8) / nBranch);            // 0 = lowest … 1 = top
    const hy = lerp(0.3, 0.95, f) * H;
    const tb = tAtY(hy);
    trunkAt(tb, S);
    const a = az0 + k * 137.5 * DEG + (rng() - 0.5) * 0.5;
    const elev = lerp(25, 60, f) * DEG + (rng() - 0.5) * 12 * DEG;
    D.set(Math.cos(a) * Math.cos(elev), Math.sin(elev), Math.sin(a) * Math.cos(elev));
    const lee = Math.cos(a) * wind.x + Math.sin(a) * wind.z;  // +1 downwind
    const L = Rmax * lerp(1, 0.22, Math.pow(f, 0.9)) * (0.75 + 0.45 * rng()) * (1 + 0.22 * lee) / Math.max(0.45, Math.cos(elev));
    const sag = L * (0.12 + 0.12 * rng()) * (1 - 0.5 * f);
    const P0 = S.clone(), P1 = S.clone().addScaledVector(D, L * 0.45);
    const P2 = S.clone().addScaledVector(D, L).setY(S.y + D.y * L - sag);
    const curve = new THREE.QuadraticBezierCurve3(P0, P1, P2);
    const at: Curve = (t, o) => curve.getPoint(t, o);
    const f0 = trunkFlex(tb);
    const bFlex = (s: number) => lerp(f0, 0.6, Math.sqrt(s));
    const r0 = lerp(0.075, 0.03, f) * (0.85 + 0.3 * rng());
    bark.push(tube(at, (t) => r0 * (1 - 0.7 * t), 4, 3, bFlex,
      (_t, o) => o.copy(BARK_GREY).lerp(BARK_BRANCH, 0.5 * rng()).multiplyScalar(0.85 + 0.2 * rng())));
    const nCard = 5 + Math.floor(rng() * 5);
    for (let c = 0; c < nCard; c++) {
      const s = lerp(0.15, 1, (c + 0.3 + 0.4 * rng()) / nCard);
      at(s, A);
      T.subVectors(at(Math.min(1, s + 0.02), Tq), at(Math.max(0, s - 0.02), p)).normalize();
      addCard(A, T, f, Math.max(0.4, bFlex(s)));
    }
  }
  // Leader: two or three tufts drooping from the trunk tip, so it doesn't end in a bare spike.
  const top = trunkAt(1, new THREE.Vector3());
  const nTop = 2 + Math.floor(rng() * 2), azT = rng() * Math.PI * 2;
  for (let c = 0; c < nTop; c++) {
    const a = azT + (c / nTop) * Math.PI * 2;
    T.set(Math.cos(a), 0, Math.sin(a));
    A.copy(top).addScaledVector(T, 0.15).setY(top.y - 0.3 * c);
    addCard(A, T, 1, 0.4);
  }

  const foliage = new THREE.BufferGeometry();
  attr(foliage, 'position', cardPos, 3); attr(foliage, 'normal', cardNrm, 3); attr(foliage, 'uv', cardUv, 2);
  attr(foliage, 'color', cardCol, 3); attr(foliage, 'aFlex', cardFl, 1);
  foliage.setIndex(cardIdx);
  const barkG = mergeGeometries(bark)!;
  bark.forEach((g) => g.dispose());
  barkG.computeBoundingBox(); barkG.computeBoundingSphere();
  foliage.computeBoundingBox(); foliage.computeBoundingSphere();
  return [{ name: 'bark', geometry: barkG }, { name: 'foliage', geometry: foliage }];
}
