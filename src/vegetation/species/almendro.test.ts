import * as THREE from 'three';
import { expect, test } from 'vitest';
import type { PlantPart } from '../types';
import { buildAlmendro } from './almendro';

const SEEDS = [1, 2, 3, 4, 5, 6];
const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const foliage = (parts: PlantPart[]) => parts.find((p) => p.name === 'foliage')!.geometry;

test('bark + foliage, aFlex in [0,1], attributes, plausible height, triangle budget', () => {
  for (const seed of SEEDS) {
    const parts = buildAlmendro(seed);
    expect(parts.map((p) => p.name).sort()).toEqual(['bark', 'foliage']);
    for (const p of parts) {
      const f = p.geometry.getAttribute('aFlex').array as Float32Array;
      expect(Math.min(...f)).toBeGreaterThanOrEqual(0); expect(Math.max(...f)).toBeLessThanOrEqual(1);
      expect(p.geometry.getAttribute('normal')).toBeDefined(); expect(p.geometry.getAttribute('uv')).toBeDefined();
      expect(p.geometry.getAttribute('color')).toBeDefined();
    }
    const box = new THREE.Box3();
    for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox!); }
    expect(box.max.y).toBeGreaterThan(6); expect(box.max.y).toBeLessThan(16);
    expect(parts.reduce((n, p) => n + tris(p.geometry), 0)).toBeLessThan(3500);
  }
});

test('no NaNs, unit normals', () => {
  for (const seed of SEEDS) {
    for (const p of buildAlmendro(seed)) {
      for (const a of ['position', 'normal']) {
        for (const v of p.geometry.getAttribute(a).array as Float32Array) expect(Number.isFinite(v)).toBe(true);
      }
      const n = p.geometry.getAttribute('normal') as THREE.BufferAttribute;
      for (let i = 0; i < n.count; i++) expect(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1)).toBeLessThan(1e-3);
    }
  }
});

test('deterministic by seed, different across seeds', () => {
  for (const k of [0, 1]) {
    const a = buildAlmendro(5)[k].geometry.getAttribute('position').array;
    expect(buildAlmendro(5)[k].geometry.getAttribute('position').array).toEqual(a);
    expect(buildAlmendro(6)[k].geometry.getAttribute('position').array).not.toEqual(a);
  }
});

/**
 * Tiered (pagoda) crown: bin leaf-card centres by 0.5 m of height; count bins holding ≥ 10 cards
 * that are separated from the previous such bin by at least one empty bin. Needs ≥ 3.
 */
test('crown is layered: at least 3 separated tiers of foliage cards', () => {
  for (const seed of SEEDS) {
    const pos = foliage(buildAlmendro(seed)).getAttribute('position') as THREE.BufferAttribute;
    const bins = new Map<number, number>();
    for (let i = 0; i < pos.count; i += 4) {
      const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2) + pos.getY(i + 3)) / 4;
      const b = Math.floor(y / 0.5);
      bins.set(b, (bins.get(b) ?? 0) + 1);
    }
    const lo = Math.min(...bins.keys()), hi = Math.max(...bins.keys());
    let tiers = 0, gap = true;
    for (let b = lo; b <= hi; b++) {
      const n = bins.get(b) ?? 0;
      if (n === 0) gap = true;
      else if (n >= 10 && gap) { tiers++; gap = false; }
    }
    expect(tiers, `seed ${seed}`).toBeGreaterThanOrEqual(3);
  }
});

test('12–18 % of leaf cards carry a red-orange tint (leaves turning before they fall)', () => {
  for (const seed of SEEDS) {
    const col = foliage(buildAlmendro(seed)).getAttribute('color') as THREE.BufferAttribute;
    let red = 0, cards = 0;
    for (let i = 0; i < col.count; i += 4) {
      cards++;
      if (col.getX(i) > 1.3 * col.getY(i)) red++;
    }
    expect(red / cards).toBeGreaterThanOrEqual(0.11); expect(red / cards).toBeLessThanOrEqual(0.19);
  }
});

test('crown is wider than tall', () => {
  for (const seed of SEEDS) {
    const g = foliage(buildAlmendro(seed));
    g.computeBoundingBox();
    const b = g.boundingBox!;
    expect(Math.max(b.max.x - b.min.x, b.max.z - b.min.z)).toBeGreaterThan(b.max.y - b.min.y);
  }
});
