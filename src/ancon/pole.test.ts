// src/ancon/pole.test.ts
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { buildPole } from './pole';

test('pole: unit length along −Y, real radii, cheap, deterministic', () => {
  const g = buildPole(3);
  const b = new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute);
  expect(b.max.y).toBeCloseTo(0, 3); expect(b.min.y).toBeCloseTo(-1, 3);
  expect(b.max.x - b.min.x).toBeLessThan(0.14);
  expect((g.index ? g.index.count : g.attributes.position.count) / 3).toBeLessThan(300);
  expect(g.getAttribute('color')).toBeDefined();
  expect(buildPole(3).attributes.position.array).toEqual(g.attributes.position.array);
});
