import { expect, test } from 'vitest';
import { ERAS } from '../data/eras';
import { STRINGS } from './strings';
import type { Bilingual } from './text';

const filled = (b: Bilingual) => b.es.trim().length > 0 && b.en.trim().length > 0;

test('every UI string has Spanish and English', () => {
  for (const [k, b] of Object.entries(STRINGS)) expect(filled(b), k).toBe(true);
});
test('every era label and years has Spanish and English', () => {
  for (const e of ERAS) {
    expect(filled(e.label), `${e.id} label`).toBe(true);
    expect(filled(e.years), `${e.id} years`).toBe(true);
  }
});
test('English labels are unchanged (the e2e picker test reads them)', () => {
  expect(ERAS.map((e) => e.label.en)).toEqual(['Colonial crossing', 'Sugar era', 'The Cortijo ancón', 'The ropes', 'Públicos', 'Weekend outings', 'The steel barge', 'The bridge']);
  expect(ERAS.map((e) => e.years.en)).toEqual(['1820s–1890s', '1900s–1910s', '1920s', '1930s–1940s', '1950s', '1960s–1970s', '1980–1986', '1986']);
});
