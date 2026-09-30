import { N8AOPostPass } from 'n8ao';
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { opaqueAO } from './opaqueAO';

test('N8AO stays opaque-only with the cars’ glass in the scene, visible or not', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  // As the cars' glass (traffic/materials.ts), hidden: n8ao's check ignores visibility.
  const glass = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.34, depthWrite: false }));
  glass.visible = false;
  scene.add(glass);
  const probe = new N8AOPostPass(scene, camera);
  probe.detectTransparency();
  expect(probe.configuration.transparencyAware).toBe(true);   // n8ao's own detection: what opaqueAO guards against
  const pass = new N8AOPostPass(scene, camera);
  opaqueAO(pass);
  glass.visible = true;
  pass.detectTransparency();
  expect(pass.configuration.transparencyAware).toBe(false);
  expect(pass.autoDetectTransparency).toBe(false);
});
