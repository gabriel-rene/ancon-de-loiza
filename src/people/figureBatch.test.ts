// src/people/figureBatch.test.ts
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { FigureBatch, PER_KIND } from './figureBatch';
import { dressFigure, type FigureLook } from './palettes';
import { createFigurePose, PART_INDEX, poseFigure, type FigurePose } from './rig';

const find = (f: (l: FigureLook) => boolean, style: Parameters<typeof dressFigure>[0] = 'earlyCentury', female = false) => {
  for (let s = 0; s < 500; s++) { const l = dressFigure(style, s, female); if (f(l)) return l; }
  throw new Error('no such look');
};
const poseOf = (l: FigureLook, kind: 'stand' | 'walk' = 'stand') => poseFigure({ height: l.height, build: l.build, dress: l.dress }, { kind, phase: 0.25 }, createFigurePose());
const zero = (m: THREE.Matrix4) => m.elements.every((v) => v === 0);
const part = (pose: FigurePose, n: keyof typeof PART_INDEX, world = new THREE.Matrix4()) => new THREE.Matrix4().fromArray(pose.parts, PART_INDEX[n] * 16).premultiply(world);
const same = (a: THREE.Matrix4, b: THREE.Matrix4) => a.elements.forEach((v, k) => expect(v).toBeCloseTo(b.elements[k], 5));   // float32 storage

test('instances = world × part; the look chooses hat and hair; hidden figures collapse', () => {
  for (const detail of ['hi', 'lo'] as const) {
    const batch = new FigureBatch(3, new THREE.MeshStandardMaterial(), detail);
    const look = find((l) => l.hat === 'straw'), pose = poseOf(look);
    const bare = find((l) => l.hat === 'none' && l.hair === 'crop'), poseB = poseOf(bare);
    const world = new THREE.Matrix4().makeTranslation(5, 0, -2);
    batch.setLook(0, look); batch.set(0, world, pose); batch.hide(1);
    batch.setLook(2, bare); batch.set(2, world, poseB); batch.commit();
    const m = new THREE.Matrix4(), head = part(pose, 'head', world);
    batch.meshes.head.getMatrixAt(0, m); same(m, head);
    batch.hats.straw.getMatrixAt(0, m); same(m, head);
    batch.hats.cap.getMatrixAt(0, m); expect(zero(m)).toBe(true);
    for (const h of ['crop', 'close', 'bun'] as const) { batch.hair[h].getMatrixAt(0, m); expect(zero(m)).toBe(true); }   // no hair under a hat
    batch.hair.crop.getMatrixAt(2, m); same(m, part(poseB, 'head', world));
    batch.hair.bun.getMatrixAt(2, m); expect(zero(m)).toBe(true);
    for (const h of ['straw', 'fedora', 'cap', 'wrap'] as const) { batch.hats[h].getMatrixAt(2, m); expect(zero(m)).toBe(true); }
    batch.meshes.head.getMatrixAt(1, m); expect(zero(m)).toBe(true);
    const c = new THREE.Color();
    batch.meshes.head.getColorAt(0, c); expect(c.getHex()).toBe(look.colors.head);
    batch.meshes.handR.getColorAt(0, c); expect(c.getHex()).toBe(look.colors.head);
    batch.hair.crop.getColorAt(2, c); expect(c.getHex()).toBe(bare.hairColor);
    for (const h of ['straw', 'fedora', 'cap', 'wrap'] as const) { batch.hats[h].getColorAt(0, c); expect(c.getHex()).toBe(look.hatColor); }
    batch.dispose();
    expect(batch.group.children.length).toBe(0);
  }
});
test('slots per kind; two foot slots per figure: feet never land in another figure slot', () => {
  expect(PER_KIND).toEqual({ hips: 1, torso: 1, tail: 1, head: 1, upperArm: 2, foreArm: 2, handL: 1, handR: 1, thigh: 2, shin: 2, shinFlare: 2, foot: 2, footBare: 2, skirt: 1 });
  const batch = new FigureBatch(2, new THREE.MeshStandardMaterial());
  const look = dressFigure('modern', 3, false), pose = poseOf(look, 'walk');
  batch.hide(0); batch.set(1, new THREE.Matrix4(), pose);
  const m = new THREE.Matrix4();
  for (const slot of [0, 1]) { batch.meshes.foot.getMatrixAt(slot, m); expect(zero(m)).toBe(true); }   // figure 0 stays hidden
  batch.meshes.foot.getMatrixAt(3, m); same(m, part(pose, 'footR'));
});
test('alternates: flared hems and bare feet swap geometry, the base slot collapses', () => {
  const batch = new FigureBatch(2, new THREE.MeshStandardMaterial());
  const flared = find((l) => l.flare && !l.barefoot, 'modern'), bare = find((l) => l.barefoot, 'colonial');
  const pf = poseOf(flared), pb = poseOf(bare), m = new THREE.Matrix4();
  batch.setLook(0, flared); batch.set(0, new THREE.Matrix4(), pf);
  batch.setLook(1, bare); batch.set(1, new THREE.Matrix4(), pb);
  batch.meshes.shinFlare.getMatrixAt(1, m); same(m, part(pf, 'shinR'));
  batch.meshes.shin.getMatrixAt(1, m); expect(zero(m)).toBe(true);
  batch.meshes.foot.getMatrixAt(0, m); same(m, part(pf, 'footL'));
  batch.meshes.footBare.getMatrixAt(2, m); same(m, part(pb, 'footL'));
  batch.meshes.foot.getMatrixAt(2, m); expect(zero(m)).toBe(true);
  batch.meshes.shin.getMatrixAt(2, m); same(m, part(pb, 'shinL'));
});
