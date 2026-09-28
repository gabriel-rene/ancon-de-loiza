import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cellRng } from '../rng';
import type { PlantPart } from '../types';
import { tube, type Curve } from './tube';

/*
 * Basin mangroves behind the red fringe (research §5). Numbers are from general botany, not
 * site measurements:
 *  - Black mangrove (Avicennia germinans): tree 4–8 m, single or forked trunk; grey-brown to
 *    dark bark, fissured into scaly plates; no prop roots, but many pneumatophores — pencil-like
 *    vertical breathing roots 10–30 cm tall and 1–1.5 cm thick, standing out of the mud in a
 *    1.5–3 m disc around the trunk. Open, irregular crown; narrow elliptic leaves, dark
 *    grey-green above and pale silvery-grey (salt-crusted) beneath, so the crown reads greyer
 *    than red mangrove.
 *  - White mangrove (Laguncularia racemosa): 4–7 m, slim upright trunk(s), light grey-brown
 *    smooth bark; no prop roots (the occasional short peg roots are omitted). Rounded crown of
 *    oval, round-tipped, light yellow-green leaves — the brightest of the three mangroves.
 * Local frame: base at the origin, up = +Y; mud line at y ≈ 0.
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

const MUD = lin(0x2a241d), WET = lin(0x3d352c);

interface BarkStyle {
  base: THREE.Color;
  /** Second bark tone mixed in per vertex (fissures / lichen). */
  alt: THREE.Color;
  /** Fraction of vertices that take the dark fissure tone. */
  fissure: number;
  /** Per-vertex brightness jitter. */
  jitter: number;
}

const BLACK_BARK: BarkStyle = { base: lin(0x5a5048), alt: lin(0x6e6a62), fissure: 0.3, jitter: 0.22 };
const WHITE_BARK: BarkStyle = { base: lin(0x8c8274), alt: lin(0x9a968a), fissure: 0.06, jitter: 0.1 };

/**
 * Bark colour at local (x, y, z): the species tone with per-vertex fissure/lichen variation,
 * wet and mud-stained below y ≈ 0.4, and a mild baked crown occlusion toward the trunk axis
 * (the crown shades the trunk; the pneumatophore disc lies mostly outside it).
 */
function barkColor(rng: Rng, st: BarkStyle, x: number, y: number, z: number, out: THREE.Color) {
  out.copy(st.base).lerp(st.alt, rng() * 0.6);
  if (rng() < st.fissure) out.multiplyScalar(0.55 + 0.15 * rng());
  else out.multiplyScalar(1 - st.jitter / 2 + st.jitter * rng());
  out.lerp(WET, 0.6 * (1 - smooth(0.1, 0.45, y)));
  out.lerp(MUD, 0.8 * (1 - smooth(-0.1, 0.06, y)));
  return out.multiplyScalar(lerp(0.62, 1, smooth(0.3, 2.2, Math.hypot(x, z))));
}

const barkTube = (rng: Rng, st: BarkStyle, at: Curve, rad: (t: number) => number, radial: number, segs: number,
  flex: (t: number) => number) =>
  tube(at, rad, radial, segs, flex, { vertex: (x, y, z, o) => barkColor(rng, st, x, y, z, o), under: 0.15 });

export interface Lobe { C: THREE.Vector3; rx: number; ry: number; rz: number }

export interface CanopyOpts {
  n: number;
  /** Card edge length range (m). */
  size: [number, number];
  /** Accent tint mixed into some cards (salt-grey / yellow), and how often. */
  accent: THREE.Color; accentP: number; accentAmt: number;
}

/**
 * Leaf cards over one or more flattened, flat-bottomed ellipsoid lobes, denser at the shell.
 * Card orientation follows `buildCanopy` in mangrove.ts (copied, with per-species parameters).
 * Also used by buttonwood (shrubs.ts).
 */
export function buildCanopy(rng: Rng, lobes: Lobe[], o: CanopyOpts) {
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], col: number[] = [], fl: number[] = [], idx: number[] = [];
  const dir = new THREE.Vector3(), c = new THREE.Vector3(), en = new THREE.Vector3(), cn = new THREE.Vector3();
  const u = new THREE.Vector3(), v = new THREE.Vector3(), p = new THREE.Vector3(), nn = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color(), acc = new THREE.Color();
  const yLo = Math.min(...lobes.map((l) => l.C.y - l.ry)), yHi = Math.max(...lobes.map((l) => l.C.y + l.ry));
  const vol = lobes.map((l) => l.rx * l.ry * l.rz), volSum = vol.reduce((a, b) => a + b, 0);
  for (let k = 0; k < o.n; k++) {
    // Lobe by volume.
    let pick = rng() * volSum, li = 0;
    while (li < lobes.length - 1 && pick > vol[li]) pick -= vol[li++];
    const { C, rx, ry, rz } = lobes[li];
    const bottom = C.y - ry * 0.85;
    const ellN = (q: THREE.Vector3, out: THREE.Vector3) =>
      out.set((q.x - C.x) / (rx * rx), (q.y - C.y) / (ry * ry), (q.z - C.z) / (rz * rz)).normalize();
    do {
      const zz = 2 * rng() - 1, a = rng() * Math.PI * 2, rr = Math.sqrt(1 - zz * zz);
      dir.set(rr * Math.cos(a), zz, rr * Math.sin(a));
    } while (dir.y < -0.55 && rng() < 0.7);
    const s = 0.6 + 0.4 * Math.sqrt(rng());
    c.set(C.x + dir.x * rx * s, C.y + dir.y * ry * s * (dir.y < 0 ? 0.8 : 1), C.z + dir.z * rz * s);
    ellN(c, en);
    cn.copy(en).addScaledVector(up, 0.35).add(p.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(1.1)).normalize();
    if (cn.dot(en) < 0.15) cn.lerp(en, 0.6).normalize();
    v.copy(en).addScaledVector(up, 0.6);
    v.sub(p.copy(cn).multiplyScalar(v.dot(cn)));
    if (v.lengthSq() < 1e-4) v.set(1, 0, 0).sub(p.copy(cn).multiplyScalar(cn.x));
    v.normalize().applyAxisAngle(cn, (rng() - 0.5) * 1.4);
    u.crossVectors(v, cn).normalize();
    const size = lerp(o.size[0], o.size[1], rng()), h = size / 2, w = h * (0.85 + 0.3 * rng());
    const flip = rng() < 0.5;
    const depth = smooth(0.55, 1, s) * lerp(0.7, 1, smooth(-0.6, 0.5, dir.y));
    const val = (0.62 + 0.38 * depth) * (0.88 + 0.24 * rng());
    tint.setRGB(val, val, val);
    if (rng() < o.accentP) tint.lerp(acc.copy(o.accent).multiplyScalar(val), o.accentAmt * (0.4 + 0.6 * rng()));
    const base = pos.length / 3;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      p.copy(c).addScaledVector(u, (i * 2 - 1) * w).addScaledVector(v, (j * 2 - 1) * h);
      p.y = Math.max(p.y, bottom);
      pos.push(p.x, p.y, p.z);
      ellN(p, nn).multiplyScalar(0.6).addScaledVector(cn, 0.4).normalize();
      nrm.push(nn.x, nn.y, nn.z);
      uv.push(flip ? 1 - i : i, j);
      col.push(tint.r, tint.g, tint.b);
      fl.push(0.35 + 0.35 * clamp01((p.y - yLo) / (yHi - yLo)));
    }
    idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
  }
  const g = new THREE.BufferGeometry();
  attr(g, 'position', pos, 3); attr(g, 'normal', nrm, 3); attr(g, 'uv', uv, 2);
  attr(g, 'color', col, 3); attr(g, 'aFlex', fl, 1);
  g.setIndex(idx);
  return g;
}

interface TreeOpts {
  bark: BarkStyle;
  /** Crown lobes (1 = rounded crown; more = open, irregular crown). */
  lobes: (rng: Rng) => Lobe[];
  /** Separate stems from the ground (white) vs. one trunk forking at `forkY` (black). */
  stemsFromGround: boolean;
  forkY: [number, number];
  trunkR: [number, number];
  canopy: (rng: Rng) => CanopyOpts;
}

/**
 * Shared tree: trunk (or trunks) with 1–3 leaders and 6–9 branches into the crown lobes.
 * aFlex: trunk 0.1·t, leaders 0.1–0.2, branches up to 0.35, leaf cards 0.35–0.7 by height.
 */
function buildTree(rng: Rng, o: TreeOpts) {
  const bark: THREE.BufferGeometry[] = [];
  const lobes = o.lobes(rng);
  const nLead = 1 + Math.floor(rng() * 3);
  const az0 = rng() * Math.PI * 2;
  const leaders: Curve[] = [];
  const top = (i: number) => lobes[i % lobes.length];
  const r0 = lerp(o.trunkR[0], o.trunkR[1], rng());
  if (o.stemsFromGround) {
    // Slim upright stems from a shared base, each rising into a lobe.
    for (let k = 0; k < nLead; k++) {
      const a = az0 + (k / nLead) * Math.PI * 2 + (rng() - 0.5) * 0.8;
      const off = nLead > 1 ? 0.08 + 0.1 * rng() : 0;
      const B = new THREE.Vector3(Math.cos(a) * off, -0.15, Math.sin(a) * off);
      const L = top(k);
      const T = new THREE.Vector3(lerp(B.x, L.C.x, 0.8) + Math.cos(a) * 0.3, L.C.y - L.ry * 0.1, lerp(B.z, L.C.z, 0.8) + Math.sin(a) * 0.3);
      const at = bezier(B, B.clone().setY(lerp(B.y, T.y, 0.35)), T.clone().lerp(B, 0.3).setY(lerp(B.y, T.y, 0.7)), T);
      const r = r0 * (nLead > 1 ? 0.8 : 1) * (0.85 + 0.3 * rng());
      bark.push(barkTube(rng, o.bark, at, (t) => r * (1.15 - 0.55 * t + 0.25 * Math.pow(1 - t, 10)), 6, 6, (t) => lerp(0, 0.2, t)));
      leaders.push(at);
    }
  } else {
    // One trunk to a fork, then 1–3 leaders into the lobes.
    const fy = lerp(o.forkY[0], o.forkY[1], rng());
    const lean = new THREE.Vector3((rng() - 0.5) * 0.5, 0, (rng() - 0.5) * 0.5);
    const B = new THREE.Vector3(0, -0.15, 0), F = new THREE.Vector3(lean.x, fy, lean.z);
    const trunk = bezier(B, B.clone().setY(fy * 0.35), F.clone().lerp(B, 0.3).setY(fy * 0.7), F);
    bark.push(barkTube(rng, o.bark, trunk, (t) => r0 * (1.2 - 0.35 * t + 0.35 * Math.pow(1 - t, 10)), 7, 5, (t) => 0.1 * t));
    for (let k = 0; k < nLead; k++) {
      const L = top(k);
      const a = az0 + k * 2.2 + (rng() - 0.5) * 0.6;
      const T = new THREE.Vector3(L.C.x + Math.cos(a) * L.rx * 0.2, L.C.y - L.ry * 0.05, L.C.z + Math.sin(a) * L.rz * 0.2);
      const S = trunk(0.9, new THREE.Vector3());
      // Leaders bow outward, then turn up into the lobe.
      const out = new THREE.Vector3(T.x - S.x, 0, T.z - S.z).multiplyScalar(0.35);
      const at = bezier(S, S.clone().lerp(T, 0.3).add(out).setY(lerp(S.y, T.y, 0.3)), T.clone().lerp(S, 0.3).add(out.multiplyScalar(0.5)), T);
      // Starts at the trunk's radius near the fork (buried in it), thins quickly to the leader's own.
      const rTop = r0 * 0.9, r = r0 * (nLead > 1 ? 0.6 : 0.75);
      bark.push(barkTube(rng, o.bark, at, (t) => lerp(rTop, r, smooth(0, 0.25, t)) * (1 - 0.5 * t), 6, 5, (t) => lerp(0.09, 0.2, t)));
      leaders.push(at);
    }
  }
  // Branches from the upper leaders out toward each lobe's shell.
  const nBranch = 6 + Math.floor(rng() * 4);
  for (let k = 0; k < nBranch; k++) {
    const li = k % leaders.length;
    const tl = 0.4 + 0.55 * rng();
    const S = leaders[li](tl, new THREE.Vector3());
    const L = top(li);
    const a = az0 + k * 2.4 + (rng() - 0.5) * 0.7;
    const reach = 0.5 + 0.3 * rng();
    const E = new THREE.Vector3(L.C.x + Math.cos(a) * L.rx * reach, L.C.y + (rng() - 0.3) * L.ry * 0.6, L.C.z + Math.sin(a) * L.rz * reach);
    const M1 = S.clone().lerp(E, 0.35).setY(S.y + (E.y - S.y) * 0.6);
    const M2 = S.clone().lerp(E, 0.7).setY(E.y + 0.12);
    const f0 = lerp(0.1, 0.2, tl), r = r0 * (0.25 + 0.12 * rng());
    bark.push(barkTube(rng, o.bark, bezier(S, M1, M2, E), (t) => r * (1 - 0.6 * t), 5, 4, (t) => lerp(f0, 0.35, t)));
  }
  return { bark, lobes, canopy: buildCanopy(rng, lobes, o.canopy(rng)) };
}

/**
 * Pneumatophores: 60–90 pencil roots in a disc (outer radius 1.5–3 m) around the trunk,
 * thinning toward the rim; 4-sided single-segment tubes, radius ≈ 0.006–0.008, 0.1–0.3 m
 * out of the mud (base at y = −0.05). aFlex 0 (rigid).
 */
function pneumatophores(rng: Rng) {
  const out: THREE.BufferGeometry[] = [];
  const n = 60 + Math.floor(rng() * 31);
  const R = 1.5 + 1.5 * rng();
  const A = new THREE.Vector3(), B = new THREE.Vector3();
  const tip = lin(0x7a7266), dark = lin(0x3a332b);
  for (let k = 0; k < n; k++) {
    const a = rng() * Math.PI * 2;
    const rr = lerp(0.45, R, Math.sqrt(rng()));
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const hgt = lerp(0.1, 0.3, rng()) * lerp(1, 0.7, rr / R);
    const tx = (rng() - 0.5) * 0.04, tz = (rng() - 0.5) * 0.04;
    A.set(x, -0.05, z); B.set(x + tx, -0.05 + hgt, z + tz);
    const at: Curve = (t, o) => o.copy(A).lerp(B, t);
    const r = 0.006 + 0.002 * rng();
    out.push(tube(at, (t) => r * (1 - 0.35 * t), 4, 1, () => 0, {
      vertex: (_x, y, _z, o) => o.copy(dark).lerp(tip, smooth(0.0, 0.2, y)).multiplyScalar(0.85 + 0.3 * rng()),
      under: 0.1,
    }));
  }
  return out;
}

function merged(parts: THREE.BufferGeometry[]) {
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/** `roots`: small detail drawn without a shadow (pencil roots ~1.5 cm wide, under a 7 cm shadow texel on high). */
function finish(bark: THREE.BufferGeometry[], canopy: THREE.BufferGeometry, roots?: THREE.BufferGeometry[]): PlantPart[] {
  canopy.computeBoundingBox(); canopy.computeBoundingSphere();
  const out: PlantPart[] = [{ name: 'bark', geometry: merged(bark) }, { name: 'foliage', geometry: canopy }];
  if (roots) out.push({ name: 'bark', geometry: merged(roots), shadow: false });
  return out;
}

/**
 * Black mangrove (base at the origin, up = +Y), deterministic in `seed`. Parts: `bark` (trunk,
 * leaders and branches; vertex colours), `foliage` (leaf cards for `paintBlackMangroveLeaves()`,
 * per-card grey tint) and a second, shadowless `bark` part: the pneumatophore disc. Open crown of 2–3 offset lobes.
 */
export function buildBlackMangrove(seed: number): PlantPart[] {
  const rng = cellRng(seed, 0, 2711);
  const { bark, canopy } = buildTree(rng, {
    bark: BLACK_BARK, stemsFromGround: false, forkY: [0.9, 1.6], trunkR: [0.1, 0.15],
    lobes: (r) => {
      const n = 2 + Math.floor(r() * 2), a0 = r() * Math.PI * 2;
      const cy = 3.25 + 0.85 * r();
      return Array.from({ length: n }, (_, k) => {
        const a = a0 + (k / n) * Math.PI * 2 + (r() - 0.5) * 0.9, d = 0.5 + 0.5 * r();
        const rx = 1.7 + 0.7 * r();
        return {
          C: new THREE.Vector3(Math.cos(a) * d, cy + (r() - 0.5) * 0.9, Math.sin(a) * d),
          rx, rz: rx * (0.8 + 0.3 * r()), ry: 1.4 + 0.5 * r(),
        };
      });
    },
    canopy: (r) => ({ n: 90 + Math.floor(r() * 11), size: [0.9, 1.3], accent: lin(0xc4ccbc), accentP: 0.3, accentAmt: 0.35 }),
  });
  return finish(bark, canopy, pneumatophores(rng));
}

/**
 * White mangrove (base at the origin, up = +Y), deterministic in `seed`. Parts: `bark` (slim
 * stems and branches; vertex colours) and `foliage` (leaf cards for `paintWhiteMangroveLeaves()`,
 * per-card tint with some yellower cards). Rounded crown, one main lobe plus an optional shoulder.
 */
export function buildWhiteMangrove(seed: number): PlantPart[] {
  const rng = cellRng(seed, 0, 3119);
  const { bark, canopy } = buildTree(rng, {
    bark: WHITE_BARK, stemsFromGround: true, forkY: [0, 0], trunkR: [0.07, 0.1],
    lobes: (r) => {
      const cy = 3.3 + 1.1 * r(), rx = 1.7 + 0.5 * r();
      const main: Lobe = { C: new THREE.Vector3((r() - 0.5) * 0.4, cy, (r() - 0.5) * 0.4), rx, rz: rx * (0.85 + 0.25 * r()), ry: 1.3 + 0.4 * r() };
      if (r() < 0.5) return [main];
      const a = r() * Math.PI * 2;
      return [main, { C: main.C.clone().add(new THREE.Vector3(Math.cos(a) * 1.3, -0.5 - 0.4 * r(), Math.sin(a) * 1.3)), rx: 1.0 + 0.3 * r(), rz: 1.0 + 0.3 * r(), ry: 0.8 + 0.2 * r() }];
    },
    canopy: (r) => ({ n: 80 + Math.floor(r() * 21), size: [0.85, 1.3], accent: lin(0xe0e090), accentP: 0.25, accentAmt: 0.3 }),
  });
  return finish(bark, canopy);
}
