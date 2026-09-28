import { expect, test } from 'vitest';
import { SPECIES } from './index';

test('registry covers every species with a generator, painter and material settings', () => {
  expect(Object.keys(SPECIES).sort()).toEqual(['casuarina', 'coconut', 'redMangrove']);
  for (const def of Object.values(SPECIES)) {
    expect(def.build(1).map((p) => p.name).sort()).toEqual(['bark', 'foliage']);
    expect(typeof def.paint).toBe('function');
    expect(def.bark.vertexColors).toBe(true);
    expect(def.foliage.alphaTest).toBeGreaterThan(0); expect(def.foliage.texture).toBeTruthy();
  }
  // Foliage that carries per-card tint must multiply it in.
  for (const def of Object.values(SPECIES)) {
    const hasColor = !!def.build(2).find((p) => p.name === 'foliage')!.geometry.getAttribute('color');
    expect(!!def.foliage.vertexColors).toBe(hasColor);
  }
  expect(SPECIES.casuarina!.foliage.roughness).toBe(0.85);
  expect(SPECIES.casuarina!.foliage.translucency).toBeGreaterThan(SPECIES.redMangrove!.foliage.translucency);
  expect(SPECIES.redMangrove!.foliage.tint!.value).toBeGreaterThan(0.1);
});
