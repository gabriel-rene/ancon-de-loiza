import { expect, test } from 'vitest';
import { makePlantMaterials } from './windMaterial';

type Csm = { uniforms: Record<string, { value: unknown }>; fragmentShader?: string };
test('foliage tint jitter becomes uniforms (default off)', () => {
  const on = makePlantMaterials({ part: 'foliage', color: 0xffffff, roughness: 0.8, alphaTest: 0.5, tint: { value: 0.18, hue: 0.12 } }).material as unknown as Csm;
  expect(on.uniforms.uTint.value).toEqual([0.18, 0.12]);
  const off = makePlantMaterials({ part: 'foliage', color: 0xffffff, roughness: 0.8, alphaTest: 0.5 }).material as unknown as Csm;
  expect(off.uniforms.uTint.value).toEqual([0, 0]);
});

test('ground fade radius is a shared uniform (absent by default)', () => {
  const radius = { value: 45 };
  const m = makePlantMaterials({ part: 'foliage', color: 0xffffff, roughness: 0.9, alphaTest: 0.5, fade: { radius } }).material as unknown as Csm;
  expect(m.uniforms.uFadeR.value).toBe(45);
  radius.value = 25;
  expect(m.uniforms.uFadeR.value).toBe(25);
  const off = makePlantMaterials({ part: 'foliage', color: 0xffffff, roughness: 0.8, alphaTest: 0.5 }).material as unknown as Csm;
  expect(off.uniforms.uFadeR).toBeUndefined();
});
