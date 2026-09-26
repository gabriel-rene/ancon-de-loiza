import * as THREE from 'three';

export type Curve = (t: number, o: THREE.Vector3) => THREE.Vector3;

export interface TubeColor {
  /** Called once per ring (before its vertices), e.g. for a per-ring bark tint written to `out`. */
  ring?: (t: number, out: THREE.Color) => void;
  /** Called per vertex with its local position; overrides the ring colour when present. */
  vertex?: (x: number, y: number, z: number, out: THREE.Color) => void;
  /** Underside darkening: colour × (1 − under + under·(0.5 + 0.5·n.y)). */
  under: number;
}

function attr(g: THREE.BufferGeometry, name: string, data: number[], size: number) {
  g.setAttribute(name, new THREE.Float32BufferAttribute(data, size));
}

/**
 * Tube along `at(t)` (t ∈ [0,1]) with parallel-transported frames (no twist), radius `rad(t)`,
 * `radial` sides and `segs` segments ((radial + 1) · (segs + 1) vertices, ring by ring).
 * Attributes: position, normal, uv, vertex `color` (see TubeColor) and aFlex from `flex(t)`.
 */
export function tube(at: Curve, rad: (t: number) => number, radial: number, segs: number,
  flex: (t: number) => number, color: TubeColor) {
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], col: number[] = [], fl: number[] = [], idx: number[] = [];
  const P = new THREE.Vector3(), Q = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  const d = new THREE.Vector3(), prevT = new THREE.Vector3(), c = new THREE.Color(), v = new THREE.Color();
  const q = new THREE.Quaternion();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, e = 1e-3;
    T.subVectors(at(Math.min(1, t + e), Q), at(Math.max(0, t - e), P)).normalize();
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
    color.ring?.(t, c);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      d.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      const x = P.x + d.x * r, y = P.y + d.y * r, z = P.z + d.z * r;
      pos.push(x, y, z);
      nrm.push(d.x, d.y, d.z);
      uv.push(j / radial, t);
      if (color.vertex) color.vertex(x, y, z, v); else v.copy(c);
      const s = 1 - color.under + color.under * (0.5 + 0.5 * d.y);
      col.push(v.r * s, v.g * s, v.b * s);
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
