// src/people/material.test.ts
import * as THREE from 'three';
import { expect, test } from 'vitest';
import { createFigureMaterial } from './material';

test('the figure material patches the standard shader at chunks that exist in this three.js', () => {
  const m = createFigureMaterial();
  expect(m.roughness).toBeCloseTo(0.85); expect(m.side).toBe(THREE.DoubleSide);
  const sh = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} } as unknown as THREE.WebGLProgramParametersWithUniforms;
  m.onBeforeCompile(sh, {} as THREE.WebGLRenderer);
  expect(sh.vertexShader).toContain('attribute float occlusion');
  expect(sh.vertexShader).toContain('vFigLocal = position');
  expect(sh.fragmentShader).toContain('diffuseColor.rgb *= vFigAo * figFabric(vFigLocal)');
  expect(sh.fragmentShader).toContain('figFr');
  expect(m.customProgramCacheKey()).toBe('ancon-figure-v1');
  m.dispose();
});
