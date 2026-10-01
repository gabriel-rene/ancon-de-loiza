import * as THREE from 'three';
import { expect, test } from 'vitest';
import { tris } from '../ancon/testing';
import { ERA_IDS } from '../data/eras';
import { QUALITY } from '../quality';
import { FaunaSet } from './FaunaSet';
import { soundTaps } from '../sound/taps';
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

test('low tier (reflect off): every animal is hidden in the reflection pass and restored after it', () => {
  expect(QUALITY.low.fauna.reflect).toBe(false);
  expect(QUALITY.high.fauna.reflect && QUALITY.medium.fauna.reflect).toBe(true);
  const set = new FaunaSet(worldFor('1975'), QUALITY.low.fauna, false, false), ms = meshesOf(set);
  const drawn = (m: THREE.Object3D) => { for (let o: THREE.Object3D | null = m; o; o = o.parent) if (!o.visible) return false; return true; };
  let checked = 0;
  for (let c = 0; c < 400; c += 7) {
    set.update(c);
    const before = ms.map(drawn);
    set.beforeReflection();
    for (const m of ms) expect(drawn(m), m.name).toBe(false);
    set.afterReflection();
    expect(ms.map(drawn)).toEqual(before);
    checked += before.filter(Boolean).length;
  }
  expect(checked).toBeGreaterThan(0);
  set.dispose();
});

test('reflect on (high, medium): the animals stay in the reflection pass; only rings are hidden', () => {
  const set = new FaunaSet(worldFor('1975'), QUALITY.high.fauna, false, true), ms = meshesOf(set);
  set.update(100);
  const before = ms.map((m) => m.visible);
  set.beforeReflection();
  expect(set.group.visible).toBe(true);
  expect(ms.map((m) => (m === set.rings ? true : m.visible))).toEqual(before.map((v, i) => (ms[i] === set.rings ? true : v)));
  expect(set.rings.visible).toBe(false);
  set.afterReflection();
  expect(ms.map((m) => m.visible)).toEqual(before);
  set.dispose();
});

test('same clock, same matrices', () => {
  const a = new FaunaSet(worldFor('1959'), QUALITY.high.fauna, false), b = new FaunaSet(worldFor('1959'), QUALITY.high.fauna, false);
  a.update(321.5); b.update(321.5);
  const ma = meshesOf(a), mb = meshesOf(b);
  for (let i = 0; i < ma.length; i++) expect(Array.from(ma[i].instanceMatrix.array)).toEqual(Array.from(mb[i].instanceMatrix.array));
  a.dispose(); b.dispose();
});

test('sound taps (spec 6b §4): every wader position, and which ones fly', () => {
  const set = new FaunaSet(worldFor('1975'), QUALITY.high.fauna, false), w = soundTaps.waders;
  let flew = false;
  for (let c = 0; c < 400; c += 0.5) {
    set.update(c);
    expect(w.n).toBe(QUALITY.high.fauna.wadersPerLanding * 2);
    for (let i = 0; i < w.n; i++) expect(Number.isFinite(w.pos[i * 3]) && Number.isFinite(w.pos[i * 3 + 2])).toBe(true);
    if (w.flying.subarray(0, w.n).some((f) => f === 1)) flew = true;
  }
  expect(flew).toBe(true);
  set.dispose();
});
