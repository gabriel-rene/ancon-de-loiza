import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cellRng } from '../rng';
import type { PlantPart } from '../types';

/*
 * Red mangrove (Rhizophora mangle), the fringe tree at the water's edge (research §5). Numbers
 * are from general botany, not site measurements:
 *  - Shrubby tree 4–8 m tall, often multi-stemmed: 1–3 short stems that begin ~0.5–0.8 m up,
 *    resting on their own roots rather than on the mud.
 *  - Arching stilt ("prop") roots spring from the stems 0.6–2.3 m up and from the lower
 *    branches, arch outward and plunge into the mud 1.5–3.5 m out; many fork once, sending a
 *    second arch further out. Bark grey to red-brown with pale lenticels; wet, dark and
 *    mud-stained through the tidal zone.
 *  - A few thin aerial drop roots hang straight down from the branches.
 *  - Dense, rounded, flat-bottomed crown of thick glossy dark-green elliptic leaves (8–13 cm)
 *    crowded at the twig ends, paler yellow-green undersides, a few yellow senescent leaves.
 * Local frame: base at the origin, up = +Y; mud/water line at y ≈ 0, roots end at y = −0.3.
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

const ROOT_RADIAL = 6, ROOT_SEG = 10;
const ROOT_END_Y = -0.3;

function attr(g: THREE.BufferGeometry, name: string, data: number[], size: number) {
  g.setAttribute(name, new THREE.Float32BufferAttribute(data, size));
}

const BARK = lin(0x5c4f43), RED = lin(0x66412f), GREY = lin(0x77726a), MUD = lin(0x262019), WET = lin(0x3a3129);

/**
 * Bark colour at local (x, y, z): grey/red-brown bark with pale lenticel flecks above the
 * tidal zone, darkening through wet bark to mud below y ≈ 0.5 (with a faint pale salt/
 * barnacle band just above the water line). Baked crown occlusion: the stems and the inner,
 * upper root arches sit in the crown's shade (skylight blocked), the outer arches don't; the
 * impostor bake inherits this, so the card root zone reads as the same dark cavity.
 */
function barkColor(rng: Rng, x: number, y: number, z: number, redness: number, out: THREE.Color) {
  out.copy(GREY).lerp(BARK, 0.55).lerp(RED, redness);
  if (rng() < 0.14) out.multiplyScalar(1.25 + 0.2 * rng());      // lenticels
  else out.multiplyScalar(0.88 + 0.2 * rng());
  const band = smooth(0.12, 0.25, y) * (1 - smooth(0.3, 0.42, y));
  out.lerp(GREY, 0.35 * band);
  out.lerp(WET, 0.75 * (1 - smooth(0.25, 0.65, y)));
  out.lerp(MUD, 0.85 * (1 - smooth(-0.15, 0.12, y)));
  const r = Math.hypot(x, z);
  return out.multiplyScalar(lerp(0.4, 1, smooth(0.5, 3.2, r + 0.25 * Math.max(0, 1 - y))));
}

/**
 * Tube along `at(t)` (t ∈ [0,1]) with parallel-transported frames (no twist), radius `rad(t)`,
 * `radial` sides and `segs` segments. Vertex colours from `barkColor`, aFlex from `flex(t)`.
 */
function tube(rng: Rng, at: (t: number, o: THREE.Vector3) => THREE.Vector3, rad: (t: number) => number,
  radial: number, segs: number, flex: (t: number) => number, redness: number) {
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], col: number[] = [], fl: number[] = [], idx: number[] = [];
  const P = new THREE.Vector3(), Q = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  const d = new THREE.Vector3(), prevT = new THREE.Vector3(), c = new THREE.Color();
  const q = new THREE.Quaternion();
  const tangent = (t: number, o: THREE.Vector3) => {
    const e = 1e-3, a = Math.max(0, t - e), b = Math.min(1, t + e);
    return o.subVectors(at(b, Q), at(a, P)).normalize();
  };
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    tangent(t, T);
    if (i === 0) {
      // Any initial normal perpendicular to T.
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
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      d.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      const x = P.x + d.x * r, y = P.y + d.y * r, z = P.z + d.z * r;
      pos.push(x, y, z);
      nrm.push(d.x, d.y, d.z);
      uv.push(j / radial, t);
      barkColor(rng, x, y, z, redness, c);
      // Soft side shading: the tube's underside is a little darker (self-occlusion).
      c.multiplyScalar(0.85 + 0.15 * (0.5 + 0.5 * d.y));
      col.push(c.r, c.g, c.b);
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

const bezier = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) => {
  const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
  return (t: number, o: THREE.Vector3) => curve.getPoint(t, o);
};

interface Stem { at: (t: number, o: THREE.Vector3) => THREE.Vector3; y0: number; y1: number }

/**
 * One prop root from `S` arching out to the mud at `E` (y = −0.3): it leaves the stem heading
 * outward and a little down, then bends over and enters the mud nearly vertically. aFlex ramps
 * from `flex0` (the parent's value at the attachment point) to 0 in the mud, so the root stays
 * joined to a swaying branch/stem.
 */
function propRoot(rng: Rng, S: THREE.Vector3, E: THREE.Vector3, r0: number, flex0: number) {
  const d = new THREE.Vector3(E.x - S.x, 0, E.z - S.z);
  const horiz = d.length();
  d.normalize();
  const drop = S.y - E.y;
  const P1 = S.clone().addScaledVector(d, horiz * (0.4 + 0.15 * rng())).setY(S.y + drop * (-0.05 + 0.2 * rng()));
  const P2 = E.clone().addScaledVector(d, -horiz * (0.1 + 0.12 * rng())).setY(E.y + drop * (0.4 + 0.2 * rng()));
  const at = bezier(S.clone(), P1, P2, E.clone());
  const geo = tube(rng, at, (t) => r0 * (1.2 - 0.35 * t + 0.4 * Math.pow(1 - t, 8)), ROOT_RADIAL, ROOT_SEG, (t) => flex0 * (1 - t), 0.1 + 0.3 * rng());
  return { geo, at, flex0 };
}

/** Leaf cards filling a flat-bottomed ellipsoidal crown, denser at its shell. */
function buildCanopy(rng: Rng, C: THREE.Vector3, rx: number, ry: number, rz: number) {
  const n = 110 + Math.floor(rng() * 21);
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], col: number[] = [], fl: number[] = [], idx: number[] = [];
  const dir = new THREE.Vector3(), c = new THREE.Vector3(), en = new THREE.Vector3(), cn = new THREE.Vector3();
  const u = new THREE.Vector3(), v = new THREE.Vector3(), p = new THREE.Vector3(), nn = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color(), olive = lin(0xb8c070);
  const bottom = C.y - ry * 0.85;
  const ellN = (q: THREE.Vector3, o: THREE.Vector3) =>
    o.set((q.x - C.x) / (rx * rx), (q.y - C.y) / (ry * ry), (q.z - C.z) / (rz * rz)).normalize();
  for (let k = 0; k < n; k++) {
    // Direction: uniform on the sphere, under-represented beneath the crown.
    do {
      const zz = 2 * rng() - 1, a = rng() * Math.PI * 2, rr = Math.sqrt(1 - zz * zz);
      dir.set(rr * Math.cos(a), zz, rr * Math.sin(a));
    } while (dir.y < -0.55 && rng() < 0.7);
    const s = 0.62 + 0.38 * Math.sqrt(rng()); // shell-heavy
    c.set(C.x + dir.x * rx * s, C.y + dir.y * ry * s * (dir.y < 0 ? 0.8 : 1), C.z + dir.z * rz * s);
    ellN(c, en);
    // Card normal: outward and a little up, jittered; card "up" (v) along outward-up in-plane.
    cn.copy(en).addScaledVector(up, 0.35).add(p.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(1.1)).normalize();
    if (cn.dot(en) < 0.15) cn.lerp(en, 0.6).normalize();
    v.copy(en).addScaledVector(up, 0.6);
    v.sub(p.copy(cn).multiplyScalar(v.dot(cn)));
    if (v.lengthSq() < 1e-4) v.set(1, 0, 0).sub(p.copy(cn).multiplyScalar(cn.x));
    v.normalize().applyAxisAngle(cn, (rng() - 0.5) * 1.4);
    u.crossVectors(v, cn).normalize(); // u × v = cn → CCW front face toward cn
    const size = 1.0 + 0.6 * rng(), h = size / 2, w = h * (0.85 + 0.3 * rng());
    const flip = rng() < 0.5;
    // Per-card tint × crown-depth darkening (interior and underside cards see less sky).
    const depth = smooth(0.55, 1, s) * lerp(0.7, 1, smooth(-0.6, 0.5, dir.y));
    const val = (0.62 + 0.38 * depth) * (0.88 + 0.24 * rng());
    tint.setRGB(val, val, val).lerp(olive.clone().multiplyScalar(val), rng() < 0.2 ? 0.35 * rng() : 0);
    const base = pos.length / 3;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      p.copy(c).addScaledVector(u, (i * 2 - 1) * w).addScaledVector(v, (j * 2 - 1) * h);
      p.y = Math.max(p.y, bottom);
      pos.push(p.x, p.y, p.z);
      ellN(p, nn).multiplyScalar(0.6).addScaledVector(cn, 0.4).normalize();
      nrm.push(nn.x, nn.y, nn.z);
      uv.push(flip ? 1 - i : i, j);
      col.push(tint.r, tint.g, tint.b);
      fl.push(0.35 + 0.35 * clamp01((p.y - (C.y - ry)) / (2 * ry)));
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
 * Build one red mangrove (base at the origin, up = +Y). Deterministic in `seed`.
 * Parts: `bark` (stems, branches, prop and drop roots; vertex colours) and `foliage` (leaf
 * cards mapped with `paintMangroveLeaves()`, vertex-colour tint per card).
 */
export function buildMangrove(seed: number): PlantPart[] {
  const rng = cellRng(seed, 0, 1733);
  const bark: THREE.BufferGeometry[] = [];

  // Crown ellipsoid.
  const C = new THREE.Vector3((rng() - 0.5) * 0.6, 4.2 + rng(), (rng() - 0.5) * 0.6);
  const rx = 2.6 + 0.8 * rng(), rz = rx * (0.85 + 0.25 * rng()), ry = 1.6 + 0.6 * rng();

  // Stems: 1–3 short trunks, resting on their roots, leaning apart.
  const nStem = 1 + Math.floor(rng() * 3);
  const stems: Stem[] = [];
  const az0 = rng() * Math.PI * 2;
  for (let k = 0; k < nStem; k++) {
    const a = az0 + (k / nStem) * Math.PI * 2 + (rng() - 0.5) * 0.8;
    const off = nStem > 1 ? 0.2 + 0.2 * rng() : 0.1 * rng();
    const y0 = 0.5 + 0.3 * rng(), y1 = 2.3 + 0.5 * rng();
    const B = new THREE.Vector3(Math.cos(a) * off, y0, Math.sin(a) * off);
    const lean = 0.25 + 0.45 * rng();
    const T = new THREE.Vector3(B.x + Math.cos(a) * lean + C.x * 0.3, y1, B.z + Math.sin(a) * lean + C.z * 0.3);
    const at = bezier(B, B.clone().setY(lerp(y0, y1, 0.4)), T.clone().lerp(B, 0.35).setY(lerp(y0, y1, 0.7)), T);
    const r = 0.08 + 0.06 * rng();
    bark.push(tube(rng, at, (t) => r * (1.1 - 0.3 * t), 6, 5, (t) => 0.1 * t, 0.2));
    stems.push({ at, y0, y1 });
  }

  // Branches into the crown from each stem top.
  const nBranch = 4 + Math.floor(rng() * 4);
  const branches: ((t: number, o: THREE.Vector3) => THREE.Vector3)[] = [];
  for (let k = 0; k < nBranch; k++) {
    const st = stems[k % nStem];
    const S = st.at(0.85 + 0.15 * rng(), new THREE.Vector3());
    const a = az0 + k * 2.4 + (rng() - 0.5) * 0.7;
    const reach = 0.45 + 0.25 * rng();
    const E = new THREE.Vector3(C.x + Math.cos(a) * rx * reach, C.y + (rng() - 0.35) * ry * 0.6, C.z + Math.sin(a) * rz * reach);
    const M1 = S.clone().lerp(E, 0.35).setY(S.y + (E.y - S.y) * 0.6);
    const M2 = S.clone().lerp(E, 0.7).setY(E.y + 0.15);
    const at = bezier(S, M1, M2, E);
    const r = 0.06 + 0.02 * rng();
    bark.push(tube(rng, at, (t) => r * (1 - 0.55 * t), 5, 5, (t) => lerp(0.1, 0.35, t), 0.15));
    branches.push(at);
  }

  // Prop roots: primaries from the stems (and 1–2 from low branches), some forking once.
  const nRoot = 10 + Math.floor(rng() * 7); // 10–16 in total
  const nFork = Math.floor(nRoot * (0.25 + 0.15 * rng()));
  const nPrimary = nRoot - nFork;
  const primaries: { at: (t: number, o: THREE.Vector3) => THREE.Vector3; a: number; R: number; r0: number; flex0: number }[] = [];
  const rootAz0 = rng() * Math.PI * 2;
  for (let k = 0; k < nPrimary; k++) {
    const a = rootAz0 + (k / nPrimary) * Math.PI * 2 + (rng() - 0.5) * (Math.PI / nPrimary);
    const S = new THREE.Vector3();
    const fromBranch = k === 0 && rng() < 0.6;
    let flex0: number;
    if (fromBranch) {
      const tb = 0.15 + 0.2 * rng();
      branches[k % branches.length](tb, S);
      flex0 = lerp(0.1, 0.35, tb);               // branch aFlex at the attachment
    } else {
      // Nearest-facing stem, at a height in 0.6–2.3 m on it.
      const st = stems[Math.floor(rng() * nStem)];
      const y = lerp(Math.max(0.6, st.y0 + 0.1), Math.min(2.3, st.y1 - 0.15), Math.pow(rng(), 0.8));
      const ts = clamp01((y - st.y0) / (st.y1 - st.y0));
      st.at(ts, S);
      flex0 = 0.1 * ts;                          // stem aFlex at the attachment
    }
    const R = Math.min(3.5, Math.max(1.5, 1.5 + 1.6 * rng() + 0.35 * S.y));
    const E = new THREE.Vector3(Math.cos(a) * R, ROOT_END_Y, Math.sin(a) * R);
    const r0 = 0.04 + 0.02 * rng();
    const { geo, at } = propRoot(rng, S, E, r0, flex0);
    bark.push(geo);
    primaries.push({ at, a, R, r0, flex0 });
  }
  for (let k = 0; k < nFork; k++) {
    const p = primaries[Math.floor(rng() * primaries.length)];
    const tp = 0.3 + 0.25 * rng();
    const S = p.at(tp, new THREE.Vector3());
    const a = p.a + (rng() < 0.5 ? -1 : 1) * (0.25 + 0.35 * rng());
    const R = Math.min(3.5, p.R + 0.5 + 0.7 * rng());
    const E = new THREE.Vector3(Math.cos(a) * R, ROOT_END_Y, Math.sin(a) * R);
    bark.push(propRoot(rng, S, E, Math.max(0.035, p.r0 * 0.85), p.flex0 * (1 - tp)).geo);
  }

  // Aerial drop roots: thin, nearly vertical, from mid-branch to the mud.
  const nDrop = 3 + Math.floor(rng() * 2);
  for (let k = 0; k < nDrop; k++) {
    const tb = 0.3 + 0.3 * rng();
    const S = branches[(k * 3 + 1) % branches.length](tb, new THREE.Vector3());
    const E = new THREE.Vector3(S.x + (rng() - 0.5) * 0.4, ROOT_END_Y, S.z + (rng() - 0.5) * 0.4);
    const wob = new THREE.Vector3((rng() - 0.5) * 0.25, 0, (rng() - 0.5) * 0.25);
    const at = bezier(S, S.clone().lerp(E, 0.33).add(wob), S.clone().lerp(E, 0.66).sub(wob), E);
    const f0 = lerp(0.1, 0.35, tb), r = 0.018 + 0.008 * rng(); // continuous with the branch
    bark.push(tube(rng, at, () => r, 4, 4, (t) => f0 * (1 - t), 0.35));
  }

  const canopy = buildCanopy(rng, C, rx, ry, rz);
  const barkG = mergeGeometries(bark)!;
  bark.forEach((g) => g.dispose());
  barkG.computeBoundingBox(); barkG.computeBoundingSphere();
  canopy.computeBoundingBox(); canopy.computeBoundingSphere();
  return [{ name: 'bark', geometry: barkG }, { name: 'foliage', geometry: canopy }];
}
