import { expect, test } from 'vitest';
import { isTypingTarget, stepEra, withEra } from './picker';

test('stepEra walks the eras and stops at both ends', () => {
  expect(stepEra('1840', -1)).toBe('1840'); expect(stepEra('1840', 1)).toBe('1900');
  expect(stepEra('1975', 1)).toBe('1984'); expect(stepEra('1986', 1)).toBe('1986');
});
test('withEra sets the era, keeps other params, rewrites t only when the URL pins it', () => {
  expect(withEra('?cam=bank&q=low&freeze=1', '1984')).toBe('?cam=bank&q=low&freeze=1&era=1984');
  expect(withEra('?era=1935&t=17.5&c=40', '1959', 18.123)).toBe('?era=1959&t=18.12&c=40');
  expect(withEra('', '1900', 18)).toBe('?era=1900');
});
test('isTypingTarget is false without an element', () => { expect(isTypingTarget(null)).toBe(false); });
