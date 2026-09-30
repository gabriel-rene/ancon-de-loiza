import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { segmentMatrix, type V3 } from '../people/rig';
import { colored } from '../traffic/carKit';

export type Shape = 'pelican' | 'frigate' | 'wader' | 'mullet' | 'manatee' | 'ring';
export const FAUNA_TRIS: Record<Shape, number> = { pelican: 700, frigate: 500, wader: 700, mullet: 150, manatee: 900, ring: 2 };
/** Wing hinge per shape: root |z| (m), hinge y, how far a folded wing tip moves back per metre of span. */
export const WING_K: Record<Shape, { root: number; hinge: number; back: number }> = {
  pelican: { root: 0.15, hinge: 0.05, back: 0.4 }, frigate: { root: 0.12, hinge: 0.02, back: 0.5 },
  wader: { root: 0.08, hinge: 0.64, back: 0.45 },
  mullet: { root: 1, hinge: 0, back: 0 }, manatee: { root: 1, hinge: 0, back: 0 }, ring: { root: 1, hinge: 0, back: 0 },
};
/** Leg pivot (x, y) — only the wader has legs. */
export const HIP: Record<Shape, [number, number]> = { pelican: [0, 0], frigate: [0, 0], wader: [-0.02, 0.5], mullet: [0, 0], manatee: [0, 0], ring: [0, 0] };

/** Colour a piece and tag it: `wing` −1/0/+1 (side), `leg` 0/1. */
function tag(g: THREE.BufferGeometry, hex: number, wing = 0, leg = 0) {
  const n = colored(g, hex), a = new Float32Array(n.attributes.position.count * 2);
  for (let i = 0; i < a.length; i += 2) { a[i] = wing; a[i + 1] = leg; }
  n.setAttribute('aPart', new THREE.BufferAttribute(a, 2));
  return n;
}
const ell = (rx: number, ry: number, rz: number, x: number, y: number, z: number, seg = 8) =>
  new THREE.SphereGeometry(1, seg, Math.max(4, seg - 3)).scale(rx, ry, rz).translate(x, y, z);
/** A tapered rod from a to b (radius r0 at a, r1 at b): unit-height cylinder (y 0 → −1) placed by segmentMatrix. */
const rod = (a: V3, b: V3, r0: number, r1: number, seg = 6) =>
  new THREE.CylinderGeometry(r0, r1, 1, seg, 1, false).translate(0, -0.5, 0).applyMatrix4(segmentMatrix(a, b, 1, 1, new THREE.Matrix4()));
const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
/** One wing: |z| root → tip, chord cRoot → cTip (x), tip swept back by `sweep`, 3 cm thick, at height y, centred on x. */
function wing(root: number, tip: number, cRoot: number, cTip: number, sweep: number, y: number, x: number, side: 1 | -1, hex: number) {
  const g = new THREE.BoxGeometry(1, 1, 1, 1, 1, 4).translate(0, 0, 0.5);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < p.count; k++) {
    const t = p.getZ(k), c = cRoot + (cTip - cRoot) * t;
    p.setXYZ(k, x + p.getX(k) * c - sweep * t, y + p.getY(k) * 0.03, side * (root + (tip - root) * t));
  }
  // Mirroring z (side −1) reverses the winding; flip it back so both wings face outward before normals are computed.
  if (side < 0) { const ix = g.index!; for (let i = 0; i < ix.count; i += 3) { const b = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, b); } }
  g.computeVertexNormals();
  return tag(g, hex, side);
}
const merge = (list: THREE.BufferGeometry[]) => { const m = mergeGeometries(list, false)!; list.forEach((g) => g.dispose()); return m; };

// Colours (linear hex, inferred L): brown pelican greys, frigate black, egret white, mullet silver, manatee grey-brown.
const PEL_BODY = 0x8a8074, PEL_HEAD = 0xe8dcb0, PEL_WING = 0x4a443c, PEL_BILL = 0x8c7a5a, PEL_POUCH = 0x6d6250;
const FRI = 0x1c1c20, FRI_BILL = 0x8a8f96, EGRET = 0xf2f2ee, BILL_Y = 0xd8b030, LEG = 0x1a1a1a, MULLET_C = 0xc8ccd0, MANATEE_C = 0x5a524a;

export function buildFaunaShape(s: Shape): THREE.BufferGeometry {
  switch (s) {
    case 'pelican': {
      const K = WING_K.pelican;
      return merge([
        tag(ell(0.55, 0.2, 0.22, 0, 0, 0, 10), PEL_BODY),
        tag(rod([0.45, 0.08, 0], [0.62, 0.2, 0], 0.08, 0.07), PEL_BODY),
        tag(ell(0.12, 0.09, 0.08, 0.68, 0.22, 0), PEL_HEAD),
        tag(rod([0.75, 0.2, 0], [1.1, 0.12, 0], 0.035, 0.015), PEL_BILL),
        tag(ell(0.16, 0.04, 0.035, 0.9, 0.13, 0), PEL_POUCH),
        tag(box(0.2, 0.03, 0.18, -0.6, 0.02, 0), PEL_WING),
        wing(K.root, 1.05, 0.42, 0.22, 0.12, K.hinge, 0.05, 1, PEL_WING),
        wing(K.root, 1.05, 0.42, 0.22, 0.12, K.hinge, 0.05, -1, PEL_WING),
      ]);
    }
    case 'frigate': {
      const K = WING_K.frigate, inner = (side: 1 | -1) => wing(K.root, 0.55, 0.3, 0.28, -0.05, K.hinge, 0, side, FRI);
      // Outer wing: from the wrist (0.55) to the tip (1.1), swept back hard — the frigatebird's bent wing.
      const outer = (side: 1 | -1) => wing(0.55, 1.1, 0.28, 0.1, 0.3, K.hinge, -0.02, side, FRI);
      return merge([
        tag(ell(0.45, 0.12, 0.12, 0, 0, 0, 8), FRI),
        tag(ell(0.08, 0.07, 0.07, 0.45, 0.04, 0), FRI),
        tag(rod([0.52, 0.04, 0], [0.7, 0.0, 0], 0.02, 0.01), FRI_BILL),
        tag(rod([-0.4, 0, 0.03], [-0.95, 0, 0.18], 0.025, 0.005, 4), FRI),
        tag(rod([-0.4, 0, -0.03], [-0.95, 0, -0.18], 0.025, 0.005, 4), FRI),
        inner(1), inner(-1), outer(1), outer(-1),
      ]);
    }
    case 'wader': {
      const K = WING_K.wader, [hx, hy] = HIP.wader;
      return merge([
        tag(rod([hx, hy, 0.05], [0, 0, 0.06], 0.012, 0.01, 5), LEG, 0, 1),
        tag(rod([hx, hy, -0.05], [0, 0, -0.06], 0.012, 0.01, 5), LEG, 0, 1),
        tag(ell(0.2, 0.11, 0.1, 0, 0.6, 0, 10), EGRET),
        tag(rod([0.15, 0.65, 0], [0.2, 0.8, 0], 0.03, 0.025), EGRET),
        tag(rod([0.2, 0.8, 0], [0.14, 0.92, 0], 0.025, 0.022), EGRET),
        tag(rod([0.14, 0.92, 0], [0.2, 1.0, 0], 0.022, 0.02), EGRET),
        tag(ell(0.05, 0.04, 0.035, 0.22, 1.0, 0), EGRET),
        tag(rod([0.26, 1.0, 0], [0.4, 0.98, 0], 0.012, 0.004, 5), BILL_Y),
        tag(box(0.12, 0.02, 0.08, -0.22, 0.6, 0), EGRET),
        wing(K.root, 0.72, 0.26, 0.14, 0.1, K.hinge, 0, 1, EGRET),
        wing(K.root, 0.72, 0.26, 0.14, 0.1, K.hinge, 0, -1, EGRET),
      ]);
    }
    case 'mullet':
      return merge([
        tag(ell(0.16, 0.035, 0.03, 0, 0, 0, 8), MULLET_C),
        tag(box(0.06, 0.07, 0.005, -0.18, 0, 0), MULLET_C),
      ]);
    case 'manatee':
      return merge([
        tag(new THREE.CapsuleGeometry(0.55, 1.9, 4, 12).rotateZ(Math.PI / 2).scale(1, 0.85, 1), MANATEE_C),
        tag(ell(0.3, 0.05, 0.4, -1.55, 0, 0), MANATEE_C),
        tag(ell(0.25, 0.22, 0.25, 1.45, -0.05, 0), MANATEE_C),
      ]);
    case 'ring':
      return new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2).toNonIndexed();
  }
}
