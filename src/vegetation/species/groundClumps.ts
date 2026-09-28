import * as THREE from 'three';
import { cellRng } from '../rng';

/*
 * Ground-cover clumps: a few alpha-tested crossed cards each, drawn by the thousand around the
 * camera (see ground/GroundCover.tsx). Local frame: base at the origin, up = +Y.
 *  - Grass: 3 cards 0.6–0.9 m wide around the centre, leaning out 5–15°.
 *  - Reeds (wet river edge): 3 taller, narrower cards.
 *  - Beach morning glory (Ipomoea pes-caprae): 3–4 cards lying almost flat (10–20° up),
 *    radiating 0.6–1.0 m from the centre like runners over the sand.
 * Normals are 60 % +Y so the clumps shade like the ground they stand on; `aFlex` = uv.y
 * (vine: 0.3·uv.y, the runners barely move).
 */

type Rng = () => number;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const UP = new THREE.Vector3(0, 1, 0);
const ROWS = 3; // rows of vertices up each card (2 quads: a slight bend at mid-height)

interface Card {
  /** Base centre. */ base: THREE.Vector3;
  /** Unit width direction. */ u: THREE.Vector3;
  /** Unit up-the-card direction. */ v: THREE.Vector3;
  w: number; h: number;
  /** Horizontal outward sag at the tip (m), grows with t². */ sag: THREE.Vector3;
  /** Vertex colour (linear) at base and tip. */ c0: THREE.Color; c1: THREE.Color;
}

function build(cards: Card[], flexScale: number): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], flex: number[] = [], idx: number[] = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color();
  for (const k of cards) {
    const v0 = pos.length / 3;
    n.crossVectors(k.u, k.v).normalize();
    if (n.y < 0) n.negate();
    n.multiplyScalar(0.4).addScaledVector(UP, 0.6).normalize();
    for (let r = 0; r < ROWS; r++) {
      const t = r / (ROWS - 1);
      for (const s of [0, 1]) {
        p.copy(k.base).addScaledVector(k.u, (s - 0.5) * k.w).addScaledVector(k.v, k.h * t).addScaledVector(k.sag, t * t);
        if (r === 0) p.y = 0;
        pos.push(p.x, p.y, p.z);
        nor.push(n.x, n.y, n.z);
        uv.push(s, t);
        c.copy(k.c0).lerp(k.c1, t);
        col.push(c.r, c.g, c.b);
        flex.push(flexScale * t);
      }
    }
    for (let r = 0; r < ROWS - 1; r++) {
      const a = v0 + r * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aFlex', new THREE.Float32BufferAttribute(flex, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Upright crossed cards around the centre (grass, reeds). */
function upright(rng: Rng, n: number, w: [number, number], h: [number, number], lean: [number, number], off: number, sag: number,
  shade: [number, number]): Card[] {
  const out: Card[] = [];
  const a0 = rng() * Math.PI;
  for (let k = 0; k < n; k++) {
    // Card planes spread evenly over 180° (crossed), jittered.
    const a = a0 + (k / n) * Math.PI + (rng() - 0.5) * 0.35;
    const u = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    // Outward = card normal side, so the lean opens the clump like a tuft.
    const out2 = new THREE.Vector3(-u.z, 0, u.x).multiplyScalar(rng() < 0.5 ? -1 : 1);
    const tilt = THREE.MathUtils.degToRad(lerp(lean[0], lean[1], rng()));
    const v = UP.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(out2, Math.sin(tilt)).normalize();
    const base = out2.clone().multiplyScalar(off * rng());
    const b = lerp(shade[0], shade[1], rng());
    out.push({
      base, u, v, w: lerp(w[0], w[1], rng()), h: lerp(h[0], h[1], rng()),
      sag: out2.clone().multiplyScalar(sag * rng()),
      c0: new THREE.Color(b * 0.72, b * 0.74, b * 0.68), c1: new THREE.Color(b, b, b * 0.97),
    });
  }
  return out;
}

export function buildGrassClump(seed: number): THREE.BufferGeometry {
  const rng = cellRng(seed, 0, 7301);
  return build(upright(rng, 3, [0.6, 0.9], [0.45, 0.75], [5, 15], 0.12, 0.08, [0.88, 1.06]), 1);
}

export function buildReedClump(seed: number): THREE.BufferGeometry {
  const rng = cellRng(seed, 0, 7302);
  return build(upright(rng, 3, [0.35, 0.5], [1.2, 1.9], [3, 10], 0.08, 0.12, [0.9, 1.05]), 1);
}

export function buildVineClump(seed: number): THREE.BufferGeometry {
  const rng = cellRng(seed, 0, 7303);
  const n = 3 + (rng() < 0.5 ? 1 : 0), a0 = rng() * Math.PI * 2, cards: Card[] = [];
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * Math.PI * 2 + (rng() - 0.5) * 0.6;
    const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const tilt = THREE.MathUtils.degToRad(lerp(10, 20, rng()));
    const v = d.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(UP, Math.sin(tilt));
    const u = new THREE.Vector3(-d.z, 0, d.x);
    const b = lerp(0.9, 1.05, rng());
    cards.push({
      base: new THREE.Vector3(), u, v, w: lerp(0.3, 0.45, rng()), h: lerp(0.6, 1.0, rng()),
      sag: new THREE.Vector3(0, -0.02, 0),
      c0: new THREE.Color(b * 0.85, b * 0.85, b * 0.8), c1: new THREE.Color(b, b, b),
    });
  }
  return build(cards, 0.3);
}
