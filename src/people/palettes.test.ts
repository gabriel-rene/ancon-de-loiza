// src/people/palettes.test.ts
import { expect, test } from 'vitest';
import type { ClothingStyle } from '../data/eras';
import { dressFigure, PALETTES, SKINS } from './palettes';

const STYLES: ClothingStyle[] = ['colonial', 'earlyCentury', 'midCentury', 'modern'];
const looks = (style: ClothingStyle, female: boolean) => Array.from({ length: 40 }, (_, i) => dressFigure(style, i, female));

test('deterministic by seed', () => {
  expect(dressFigure('modern', 7, true)).toEqual(dressFigure('modern', 7, true));
});
test('skin from SKINS, clothes from the style palette', () => {
  for (const s of STYLES) for (const f of [false, true]) for (const l of looks(s, f)) {
    expect(SKINS).toContain(l.colors.head);
    const P = PALETTES[s];
    expect([...P.shirts, ...P.dresses]).toContain(l.colors.torso);
    expect(l.height).toBeGreaterThan(f ? 1.5 : 1.6); expect(l.height).toBeLessThan(f ? 1.72 : 1.84);
  }
});
test('hats by period: straw brims early, fedoras mid-century, caps only modern, head wraps on early women', () => {
  const hats = (s: ClothingStyle, f: boolean) => new Set(looks(s, f).map((l) => l.hat));
  expect(hats('colonial', false).has('straw')).toBe(true);
  expect(hats('earlyCentury', true).has('wrap')).toBe(true);
  expect(hats('midCentury', false).has('fedora')).toBe(true);
  expect(hats('modern', false).has('cap')).toBe(true);
  for (const s of ['colonial', 'earlyCentury', 'midCentury'] as const) expect(hats(s, false).has('cap')).toBe(false);
  for (const s of ['colonial', 'earlyCentury', 'modern'] as const) expect(hats(s, false).has('fedora')).toBe(false);
  for (const s of ['midCentury', 'modern'] as const) expect(hats(s, true).has('wrap')).toBe(false);
});
test('women wear dresses before 1950; short sleeves show skin on the forearms', () => {
  for (const s of ['colonial', 'earlyCentury'] as const) for (const l of looks(s, true)) expect(l.dress).toBe(true);
  const modern = looks('modern', false);
  expect(modern.some((l) => l.colors.foreArmL === l.colors.head)).toBe(true);
  for (const l of looks('colonial', false)) expect(l.colors.foreArmL).not.toBe(l.colors.head);
});
test('a varied crowd: at least 4 skin tones over 40 people', () => {
  expect(new Set(looks('modern', false).map((l) => l.colors.head)).size).toBeGreaterThanOrEqual(4);
});
