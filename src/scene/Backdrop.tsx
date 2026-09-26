import { useMemo } from 'react';
import * as THREE from 'three';
import { fbm } from '../terrain/noise';

/** A vertical ridge strip along an arc. Bearings in degrees from north, clockwise. */
function ridge(b0: number, b1: number, dist: (b: number) => number, height: (b: number, k: number) => number, segs = 240) {
  const pos: number[] = [], idx: number[] = [];
  for (let k = 0; k <= segs; k++) {
    const b = b0 + ((b1 - b0) * k) / segs, r = (b * Math.PI) / 180, d = dist(b);
    const x = Math.sin(r) * d, z = -Math.cos(r) * d;
    pos.push(x, -60, z, x, height(b, k), z);
    if (k < segs) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function Backdrop() {
  const { luquillo, foothills, mat, matNear } = useMemo(() => ({
    // El Yunque ≈ 1,065 m at ≈ 17 km, bearing ≈ 145° (landmarks.elYunque).
    luquillo: ridge(100, 190, (b) => 16500 + 2500 * fbm(b * 0.05, 1),
      (b, k) => 120 + 1000 * Math.exp(-(((b - 145) / 16) ** 2)) + 520 * fbm(k * 0.09, 3) * Math.exp(-(((b - 145) / 32) ** 2))),
    foothills: ridge(110, 250, (b) => 7000 + 1200 * fbm(b * 0.08, 5), (_b, k) => 40 + 140 * fbm(k * 0.15, 9)),
    mat: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.18, 0.24, 0.28), side: THREE.DoubleSide }),
    matNear: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.08, 0.12, 0.08), side: THREE.DoubleSide }),
  }), []);
  return (
    <>
      <mesh geometry={luquillo} material={mat} />
      <mesh geometry={foothills} material={matNear} />
    </>
  );
}
