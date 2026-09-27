import { expect, test } from 'vitest';
import { detectLang, withLang } from './text';

test('detectLang: English browsers get en, everyone else es', () => {
  expect(detectLang('en-US')).toBe('en');
  expect(detectLang('EN')).toBe('en');
  expect(detectLang('es-PR')).toBe('es');
  expect(detectLang('fr-FR')).toBe('es');
  expect(detectLang(undefined)).toBe('es');
});
test('withLang sets ?lang and keeps other params', () => {
  expect(withLang('?era=1935&freeze=1', 'es')).toBe('?era=1935&freeze=1&lang=es');
  expect(withLang('?lang=es&era=1984', 'en')).toBe('?lang=en&era=1984');
  expect(withLang('', 'en')).toBe('?lang=en');
});
