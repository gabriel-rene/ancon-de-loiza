import { expect, test } from 'vitest';
import { SPECIES } from './index';

test('registry covers every species with a generator, painter and material settings', () => {
  expect(Object.keys(SPECIES).sort()).toEqual(['almendro', 'blackMangrove', 'buttonwood', 'casuarina', 'coconut', 'redMangrove', 'seaGrape', 'whiteMangrove']);
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
  expect(SPECIES.casuarina.foliage.roughness).toBe(0.85);
  expect(SPECIES.casuarina.foliage.translucency).toBeGreaterThan(SPECIES.redMangrove.foliage.translucency);
  expect(SPECIES.redMangrove.foliage.tint!.value).toBeGreaterThan(0.1);
  // Leathery, glossy sea grape vs. matte silvery buttonwood.
  expect(SPECIES.seaGrape.foliage.roughness).toBeLessThan(SPECIES.buttonwood.foliage.roughness);
  // Glossy almond leaves.
  expect(SPECIES.almendro.foliage).toMatchObject({ roughness: 0.55, translucency: 1.3, tint: { value: 0.12, hue: 0.1 } });
});
