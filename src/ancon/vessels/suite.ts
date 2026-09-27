import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { ERAS, type VesselKind } from '../../data/eras';
import { deckLayout, vesselSpec } from '../spec';
import type { VesselPart } from './common';
import { buildVessel, TRI_BUDGET } from './index';
import { tris } from '../testing';
export const bounds = (parts: VesselPart[]) => {
  const b = new THREE.Box3();
  for (const p of parts) { p.geometry.computeBoundingBox(); b.union(p.geometry.boundingBox!); }
  return b;
};
const hasVertexNear = (parts: VesselPart[], q: [number, number, number], r: number) => parts.some((p) => {
  const a = p.geometry.attributes.position.array as Float32Array;
  for (let i = 0; i < a.length; i += 3) if (Math.hypot(a[i] - q[0], a[i + 1] - q[1], a[i + 2] - q[2]) < r) return true;
  return false;
});

/** Size, budget, determinism, aprons and rope-guide checks for every era whose vessel is one of `kinds`. */
export function vesselSuite(kinds: VesselKind[]) {
  for (const era of ERAS.filter((e) => kinds.includes(e.ancon.kind.value))) describe(`${era.id} ${era.ancon.kind.value}`, () => {
    const spec = vesselSpec(era), L = deckLayout(spec), parts = buildVessel(spec, L, 1);
    test('geometry carries position, normal, uv, colour — no NaN', () => {
      expect(parts.length).toBeGreaterThan(0);
      for (const p of parts) {
        for (const a of ['position', 'normal', 'uv', 'color']) expect(p.geometry.getAttribute(a), a).toBeDefined();
        expect((p.geometry.attributes.position.array as Float32Array).every(Number.isFinite)).toBe(true);
      }
    });
    test('size matches the era: length incl. aprons, beam, draft, height', () => {
      const b = bounds(parts);
      expect(b.max.x - b.min.x).toBeGreaterThan(2 * L.reach - 0.3); expect(b.max.x - b.min.x).toBeLessThan(2 * L.reach + 0.6);
      expect(b.max.z - b.min.z).toBeGreaterThan(spec.beam - 0.2); expect(b.max.z - b.min.z).toBeLessThan(spec.beam + 0.5);
      expect(b.min.y).toBeLessThan(-0.15); expect(b.min.y).toBeGreaterThan(-1.0);
      expect(b.max.y).toBeLessThan(L.deckY + 1.6);
    });
    test('triangle budget', () => {
      expect(parts.reduce((n, p) => n + tris(p.geometry), 0)).toBeLessThan(TRI_BUDGET[spec.kind]);
    });
    test('deterministic by seed', () => {
      const again = buildVessel(spec, L, 1);
      expect(again.map((p) => p.geometry.attributes.position.array)).toEqual(parts.map((p) => p.geometry.attributes.position.array));
    });
    test('two hinged aprons when the kind has aprons, none otherwise', () => {
      const ends = parts.filter((p) => p.apron).map((p) => p.apron!.end).sort();
      expect(ends).toEqual(L.apron > 0 ? [-1, 1] : []);
      for (const p of parts) if (p.apron) expect(Math.abs(p.apron.hinge[0])).toBeCloseTo(L.halfLength, 1);
    });
    test('rope eras carry four deck guides where the ropes run', () => {
      if (spec.propulsion !== 'ropes') return;
      for (const sx of [-1, 1]) for (const sz of [-1, 1])
        expect(hasVertexNear(parts, [sx * (L.halfLength - 0.3), L.guideY, sz * L.ropeZ], 0.25)).toBe(true);
    });
  });
}
