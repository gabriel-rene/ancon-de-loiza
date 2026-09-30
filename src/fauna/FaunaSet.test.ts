import * as THREE from 'three';
import { expect, test } from 'vitest';
import { tris } from '../ancon/testing';
import { ERA_IDS } from '../data/eras';
import { QUALITY } from '../quality';
import { FaunaSet } from './FaunaSet';
import { worldFor } from './testing';

const meshesOf = (s: FaunaSet) => s.group.children.filter((o): o is THREE.InstancedMesh => (o as THREE.InstancedMesh).isInstancedMesh);

test('budget (spec 5 §5): at most 8 meshes and 30 000 triangles on high, in every era', () => {
  for (const id of ERA_IDS) {
    const set = new FaunaSet(worldFor(id), QUALITY.high.fauna, true), ms = meshesOf(set);
    expect(ms.length, id).toBeLessThanOrEqual(8);
    let worst = 0;
    for (let c = 0; c < 400; c += 0.5) {
      set.update(c);
      worst = Math.max(worst, ms.reduce((n, m) => n + (m.visible ? m.count * tris(m.geometry) : 0), 0));
    }
    expect(worst, id).toBeLessThanOrEqual(30_000);
    set.dispose();
  }
});

test('counts per tier match spec 5 §2 (birds always on)', () => {
  for (const tier of ['high', 'medium', 'low'] as const) {
    const f = QUALITY[tier].fauna, set = new FaunaSet(worldFor('1975'), f, false);
    set.update(100);
    const [pel, fri, wad] = meshesOf(set);
    expect(pel.count).toBe(f.flock + f.fishers);
    expect(fri.count).toBe(f.frigates);
    expect(wad.count).toBe(2 * f.wadersPerLanding);
    set.dispose();
  }
});

test('only waders cast shadows; rings are hidden in the reflection pass', () => {
  const set = new FaunaSet(worldFor('1975'), QUALITY.high.fauna, true), ms = meshesOf(set);
  expect(ms.filter((m) => m.castShadow).map((m) => m.name)).toEqual(['wader']);
  set.update(100);
  set.beforeReflection(); expect(set.rings.visible).toBe(false);
  set.afterReflection(); expect(set.rings.visible).toBe(set.rings.count > 0);
  set.dispose();
});

test('same clock, same matrices', () => {
  const a = new FaunaSet(worldFor('1959'), QUALITY.high.fauna, false), b = new FaunaSet(worldFor('1959'), QUALITY.high.fauna, false);
  a.update(321.5); b.update(321.5);
  const ma = meshesOf(a), mb = meshesOf(b);
  for (let i = 0; i < ma.length; i++) expect(Array.from(ma[i].instanceMatrix.array)).toEqual(Array.from(mb[i].instanceMatrix.array));
  a.dispose(); b.dispose();
});
