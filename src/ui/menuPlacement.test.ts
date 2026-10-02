import { expect, test } from 'vitest';
import { menuLeft } from './menuPlacement';

test('the normal case stays left-aligned with the button', () => {
  expect(menuLeft(100, 140, 375)).toBe(0);
});
test('near the right edge it shifts left to keep the gutter', () => {
  expect(menuLeft(300, 140, 375)).toBe(375 - 8 - 140 - 300);   // -73
});
test('near the left edge it never goes past the gutter', () => {
  expect(menuLeft(2, 140, 375)).toBe(6);                       // left edge 8
  expect(menuLeft(8, 140, 375)).toBe(0);
});
test('a menu wider than the space sits at the left gutter', () => {
  expect(menuLeft(50, 400, 375)).toBe(8 - 50);
});
test('the gutter is adjustable', () => {
  expect(menuLeft(300, 140, 375, 0)).toBe(-65);
});
