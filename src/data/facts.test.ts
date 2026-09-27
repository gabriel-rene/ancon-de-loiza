import { expect, test } from 'vitest';
import { ERA_IDS } from './eras';
import { FACTS } from './facts';
import { SOURCES } from './sources';

test('every era has 3–5 facts', () => {
  for (const id of ERA_IDS) {
    expect(FACTS[id].length, id).toBeGreaterThanOrEqual(3);
    expect(FACTS[id].length, id).toBeLessThanOrEqual(5);
  }
});
test('every fact has Spanish and English text', () => {
  for (const id of ERA_IDS) FACTS[id].forEach((f, i) => {
    expect(f.text.es.trim().length, `${id}#${i} es`).toBeGreaterThan(0);
    expect(f.text.en.trim().length, `${id}#${i} en`).toBeGreaterThan(0);
  });
});
test('every fact cites at least one known source, without repeats', () => {
  for (const id of ERA_IDS) FACTS[id].forEach((f, i) => {
    expect(f.sources.length, `${id}#${i}`).toBeGreaterThan(0);
    expect(new Set(f.sources).size, `${id}#${i} repeats`).toBe(f.sources.length);
    for (const s of f.sources) expect(SOURCES[s], `${id}#${i} → ${s}`).toBeDefined();
  });
});
