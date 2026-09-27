// src/people/geometry.ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HatKind } from './palettes';
import type { PartName } from './rig';

export type GeoKind = 'hips' | 'torso' | 'head' | 'limb' | 'foot' | 'skirt';
export const PART_GEO: Record<PartName, GeoKind> = {
  hips: 'hips', torso: 'torso', head: 'head', upperArmL: 'limb', foreArmL: 'limb', upperArmR: 'limb', foreArmR: 'limb',
  thighL: 'limb', shinL: 'limb', thighR: 'limb', shinR: 'limb', footL: 'foot', footR: 'foot', skirt: 'skirt',
};
export const FIGURE_TRI_BUDGET = 720;
const clean = (g: THREE.BufferGeometry) => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };

/** Unit body-part geometries (see poseFigure for how each is scaled). */
export function buildFigureGeometries(): Record<GeoKind, THREE.BufferGeometry> {
  return {
    limb: clean(new THREE.CylinderGeometry(1, 0.8, 1, 7, 1).translate(0, -0.5, 0)),
    // Torso: closed at the shoulders (seen from the elevated ride camera).
    torso: clean(new THREE.LatheGeometry([0.8, 0.85, 1.0, 0.95, 0.5, 0].map((x, i) => new THREE.Vector2(x, [0, 0.3, 0.75, 0.95, 1, 1.02][i])), 10).scale(1, 1, 0.62)),
    head: clean(new THREE.IcosahedronGeometry(1, 1).scale(1, 1.15, 1)),
    hips: clean(new THREE.SphereGeometry(1, 8, 6)),
    foot: clean(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0.25)),
    skirt: clean(new THREE.CylinderGeometry(0.55, 1, 1, 12, 1, true).translate(0, -0.5, 0)),
  };
}

/** Hats in head units (head radius 1, crown top at y = 1.15). */
export function buildHatGeometries(): Record<Exclude<HatKind, 'none'>, THREE.BufferGeometry> {
  const m = (...g: THREE.BufferGeometry[]) => mergeGeometries(g.map((x) => clean(x.index ? x.toNonIndexed() : x)))!;
  return {
    straw: m(new THREE.CylinderGeometry(1.9, 1.9, 0.06, 18).translate(0, 0.75, 0), new THREE.CylinderGeometry(0.95, 1.05, 0.55, 14, 1).translate(0, 1.05, 0)),
    fedora: m(new THREE.CylinderGeometry(1.45, 1.45, 0.05, 16).translate(0, 0.8, 0), new THREE.CylinderGeometry(0.85, 1.0, 0.6, 12, 1).scale(1, 1, 0.85).translate(0, 1.1, 0)),
    cap: m(new THREE.SphereGeometry(1.06, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.35, 0), new THREE.BoxGeometry(1.0, 0.05, 0.8).translate(0, 0.5, 1.2)),
    wrap: m(new THREE.SphereGeometry(1.1, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 0.9, 1.05).translate(0, 0.25, 0), new THREE.SphereGeometry(0.35, 6, 4).translate(0, 1.05, -0.6)),
  };
}
