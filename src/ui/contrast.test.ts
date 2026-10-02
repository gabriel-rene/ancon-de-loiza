import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { blend, contrastRatio, parseColor, type RGB } from './contrast';

const css = readFileSync('src/styles.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const WHITE: RGB = [255, 255, 255];
const CREAM: RGB = [0xf4, 0xec, 0xdf];

/** The value of `prop` in the first rule whose selector list is exactly `sel` (rules may be indented). */
function decl(sel: string, prop: string, src = css): string | undefined {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`).exec(src);
  if (!rule) throw new Error(`no rule ${sel}`);
  return new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+)`).exec(rule[1])?.[1].trim();
}
const opacity = (sel: string, src = css) => Number(decl(sel, 'opacity', src) ?? 1);

test('helpers: black on white is 21:1, a colour on itself is 1:1, blend mixes', () => {
  expect(contrastRatio([0, 0, 0], WHITE)).toBeCloseTo(21, 5);
  expect(contrastRatio(CREAM, CREAM)).toBeCloseTo(1, 5);
  expect(parseColor('#f4ecdf')).toEqual({ rgb: CREAM, a: 1 });
  expect(parseColor('rgba(12, 15, 15, 0.65)')).toEqual({ rgb: [12, 15, 15], a: 0.65 });
  expect(blend([0, 0, 0], 0.5, WHITE)).toEqual([127.5, 127.5, 127.5]);
});

// Worst case (spec 7b §3.1): the glass backing alone over a pure white sky.
const glass = parseColor(decl(':root', '--glass')!);
const worst = blend(glass.rgb, glass.a, WHITE);

test('every text-over-scene surface uses the --glass backing', () => {
  for (const sel of ['.title-card', '.osm-credit', '.timeline', '.toolbar__btn', '.toolbar__lang, .toolbar__group']) {
    expect(decl(sel, 'background'), sel).toBe('var(--glass)');
  }
});
test('text on glass reaches 4.5:1 over white', () => {
  expect(contrastRatio(CREAM, worst)).toBeGreaterThanOrEqual(4.5);
  expect(opacity('.title-card__kicker')).toBe(1);
  const label = blend(CREAM, opacity('.timeline__label'), worst);
  expect(contrastRatio(label, worst)).toBeGreaterThanOrEqual(4.5);
  const credit = parseColor(decl('.osm-credit', 'color')!);
  expect(contrastRatio(blend(credit.rgb, credit.a, worst), worst)).toBeGreaterThanOrEqual(4.5);
});
test('the rail line and leaders reach 3:1 on glass over white', () => {
  for (const [sel, prop] of [['.timeline__line', 'background'], ['.timeline__leaders line', 'stroke']] as const) {
    const c = parseColor(decl(sel, prop)!);
    expect(contrastRatio(blend(c.rgb, c.a, worst), worst), sel).toBeGreaterThanOrEqual(3);
  }
});
test('load card and era dip: one gradient, small text at 4.5:1 on its centre stop', () => {
  const dip = decl(':root', '--era-dip')!;
  expect(decl('#load-card', 'background', html)).toBe(dip);
  const centre = parseColor(/#[0-9a-f]{6}(?= 0%)/i.exec(dip)![0]).rgb;
  expect(contrastRatio(CREAM, centre)).toBeGreaterThanOrEqual(4.5);
  expect(opacity('.load-card__kicker', html)).toBe(1);
  expect(opacity('.era-dip__label')).toBe(1);
});
