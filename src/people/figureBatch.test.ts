// src/people/figureBatch.test.ts
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { FigureBatch, PER_KIND } from './figureBatch';
import { dressFigure } from './palettes';
import { createFigurePose, PART_INDEX, poseFigure } from './rig';

test('instances = world × part; hats go to their own mesh; hidden figures collapse', () => {
  const batch = new FigureBatch(3, new THREE.MeshStandardMaterial());
  const look = dressFigure('earlyCentury', 1, false), pose = poseFigure({ height: look.height, build: look.build, dress: look.dress }, { kind: 'stand', phase: 0 }, createFigurePose());
  const world = new THREE.Matrix4().makeTranslation(5, 0, -2);
  batch.setLook(0, look); batch.set(0, world, pose, 'straw'); batch.hide(1); batch.commit();
  const m = new THREE.Matrix4(), head = new THREE.Matrix4().fromArray(pose.parts, PART_INDEX.head * 16).premultiply(world);
  const same = (x: THREE.Matrix4) => x.elements.forEach((v, k) => expect(v).toBeCloseTo(head.elements[k], 5)); // float32 storage
  batch.meshes.head.getMatrixAt(0, m); same(m);
  batch.hats.straw.getMatrixAt(0, m); same(m);
  batch.hats.cap.getMatrixAt(0, m); expect(m.elements.every((v) => v === 0)).toBe(true);
  batch.meshes.head.getMatrixAt(1, m); expect(m.elements.every((v) => v === 0)).toBe(true);
  const c = new THREE.Color(); batch.meshes.head.getColorAt(0, c); expect(c.getHex()).toBe(look.colors.head);
});
test('two foot slots per figure: feet never land in another figure slot', () => {
  expect(PER_KIND).toEqual({ hips: 1, torso: 1, head: 1, limb: 8, foot: 2, skirt: 1 });
  const batch = new FigureBatch(2, new THREE.MeshStandardMaterial());
  const look = dressFigure('modern', 3, false), pose = poseFigure({ height: look.height, build: look.build, dress: false }, { kind: 'walk', phase: 0.25 }, createFigurePose());
  batch.hide(0); batch.set(1, new THREE.Matrix4(), pose, 'none');
  const m = new THREE.Matrix4();
  for (const slot of [0, 1]) { batch.meshes.foot.getMatrixAt(slot, m); expect(m.elements.every((v) => v === 0)).toBe(true); }   // figure 0 stays hidden
  batch.meshes.foot.getMatrixAt(3, m);
  const footR = new THREE.Matrix4().fromArray(pose.parts, PART_INDEX.footR * 16);
  m.elements.forEach((v, k) => expect(v).toBeCloseTo(footR.elements[k], 5));
});
