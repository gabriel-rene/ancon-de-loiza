// src/people/palettes.test.ts
import { expect, test } from 'vitest';
import type { ClothingStyle } from '../data/eras';
import { dressFigure, HAIRS, PALETTES, SKINS } from './palettes';

const STYLES: ClothingStyle[] = ['colonial', 'earlyCentury', 'midCentury', 'modern'];
const looks = (style: ClothingStyle, female: boolean) => Array.from({ length: 40 }, (_, i) => dressFigure(style, i, female));
const ch = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
/** Within the ±4 % hue/value jitter of some palette colour. */
const near = (c: number, list: number[]) => list.some((p) => ch(p).every((v, k) => Math.abs(v - ch(c)[k]) <= 16));

test('deterministic by seed', () => {
  expect(dressFigure('modern', 7, true)).toEqual(dressFigure('modern', 7, true));
});
test('skin from SKINS (hands too), jittered clothes from the style palette, no clipped whites', () => {
  for (const s of STYLES) for (const f of [false, true]) for (const l of looks(s, f)) {
    expect(SKINS).toContain(l.colors.head); expect(l.colors.handL).toBe(l.colors.head); expect(l.colors.handR).toBe(l.colors.head);
    const P = PALETTES[s];
    expect(near(l.colors.torso, [...P.shirts, ...P.dresses])).toBe(true);
    expect(Math.max(...ch(l.colors.torso))).toBeLessThanOrEqual(0xe4);
    expect(l.height).toBeGreaterThan(f ? 1.5 : 1.6); expect(l.height).toBeLessThan(f ? 1.72 : 1.84);
  }
  for (const s of STYLES) for (const list of [PALETTES[s].shirts, PALETTES[s].dresses, PALETTES[s].trousers]) for (const c of list) expect(Math.max(...ch(c))).toBeLessThanOrEqual(0xdc);
});
test('people are not colour clones: the same palette entry varies between people', () => {
  expect(new Set(looks('colonial', false).map((l) => l.colors.torso)).size).toBeGreaterThan(PALETTES.colonial.shirts.length);
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
test('hair: dark (some grey), crops on men, buns or close hair on women, hidden under hats', () => {
  for (const s of STYLES) {
    for (const l of looks(s, false)) { expect(l.hat === 'none' ? ['crop', 'close'] : ['none']).toContain(l.hair); expect(HAIRS).toContain(l.hairColor); }
    for (const l of looks(s, true)) expect(l.hat === 'none' ? ['bun', 'close'] : ['none']).toContain(l.hair);
  }
  const menHair = new Set(looks('modern', false).map((l) => l.hair));
  expect(menHair.has('crop') && menHair.has('close') && menHair.has('none')).toBe(true);
});
test('women wear dresses before 1950; short sleeves show skin; flared hems only on 1970s trousers; bare feet early', () => {
  for (const s of ['colonial', 'earlyCentury'] as const) for (const l of looks(s, true)) expect(l.dress).toBe(true);
  const modern = looks('modern', false);
  expect(modern.some((l) => l.colors.foreArmL === l.colors.head)).toBe(true);
  for (const l of looks('colonial', false)) expect(l.colors.foreArmL).not.toBe(l.colors.head);
  expect(modern.some((l) => l.flare)).toBe(true);
  for (const s of ['colonial', 'earlyCentury', 'midCentury'] as const) for (const l of looks(s, false)) expect(l.flare).toBe(false);
  for (const l of looks('modern', true)) if (l.dress) expect(l.flare).toBe(false);
  const colonial = looks('colonial', false);
  expect(colonial.filter((l) => l.barefoot).length).toBeGreaterThan(15);
  for (const l of colonial) expect(l.barefoot).toBe(l.colors.footL === l.colors.head);
});
test('a varied crowd: at least 4 skin tones over 40 people', () => {
  expect(new Set(looks('modern', false).map((l) => l.colors.head)).size).toBeGreaterThanOrEqual(4);
});
