// src/ancon/pole.ts
import * as THREE from 'three';
import { cellRng } from '../vegetation/rng';

/** Mangrove / majagüilla push pole (research §2.3); length inferred from the 1.5–3 m depth (research §1.2). */
export const POLE_LEN = 5.5;
const RADIAL = 8, SEGS = 12, BARK = new THREE.Color(0x6b5a45), GRIP = new THREE.Color(0xa39580);

/** Unit-length pole along −Y (y = 0 top … y = −1 tip/butt) with real radii (0.03 → 0.045 m); scale y by POLE_LEN. */
export function buildPole(seed: number): THREE.BufferGeometry {
  const r = cellRng(seed, 5, 705), crook = Array.from({ length: 5 }, () => [(r() - 0.5) * 0.03, (r() - 0.5) * 0.03]);
  const pos: number[] = [], nrm: number[] = [], col: number[] = [], idx: number[] = [], c = new THREE.Color();
  for (let i = 0; i <= SEGS; i++) {
    const t = i / SEGS, y = -t, rad = 0.03 + 0.015 * t;
    const k = t * 4, k0 = Math.min(3, Math.floor(k)), u = k - k0, s = u * u * (3 - 2 * u);
    const ox = crook[k0][0] + (crook[k0 + 1][0] - crook[k0][0]) * s, oz = crook[k0][1] + (crook[k0 + 1][1] - crook[k0][1]) * s;
    c.copy(y > -0.35 && y < -0.1 ? GRIP : BARK).multiplyScalar(0.92 + 0.16 * r());
    for (let j = 0; j < RADIAL; j++) {
      const a = (j / RADIAL) * Math.PI * 2, nx = Math.cos(a), nz = Math.sin(a);
      pos.push(ox + nx * rad, y, oz + nz * rad); nrm.push(nx, 0, nz); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < SEGS; i++) for (let j = 0; j < RADIAL; j++) {
    const a = i * RADIAL + j, b = i * RADIAL + ((j + 1) % RADIAL), d = a + RADIAL, e = b + RADIAL;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
