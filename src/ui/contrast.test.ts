import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { blend, contrastRatio, parseColor, type RGB } from './contrast';

const css = readFileSync('src/styles.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const WHITE: RGB = [255, 255, 255];
const CREAM: RGB = [0xe7, 0xec, 0xe3];

/** The value of `prop` in the first rule whose selector list is exactly `sel` (rules may be indented). */
function decl(sel: string, prop: string, src = css): string | undefined {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`).exec(src);
  if (!rule) throw new Error(`no rule ${sel}`);
  return new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+)`).exec(rule[1])?.[1].trim();
}
/** A custom property on :root, with var() references to other :root properties resolved. */
function token(name: string): string {
  const v = decl(':root', name)!;
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  return ref ? token(ref[1]) : v;
}
const colour = (v: string) => parseColor(/^var\((--[\w-]+)\)$/.test(v) ? token(/^var\((--[\w-]+)\)$/.exec(v)![1]) : v);

test('helpers: black on white is 21:1, a colour on itself is 1:1, blend mixes', () => {
  expect(contrastRatio([0, 0, 0], WHITE)).toBeCloseTo(21, 5);
  expect(contrastRatio(CREAM, CREAM)).toBeCloseTo(1, 5);
  expect(parseColor('#e7ece3')).toEqual({ rgb: CREAM, a: 1 });
  expect(parseColor('rgba(8, 20, 14, 0.72)')).toEqual({ rgb: [8, 20, 14], a: 0.72 });
  expect(blend([0, 0, 0], 0.5, WHITE)).toEqual([127.5, 127.5, 127.5]);
});

// Worst case (spec 7b §3.1): the scrim alone over a pure white sky.
const scrim = parseColor(token('--scrim'));
const worst = blend(scrim.rgb, scrim.a, WHITE);
const scrimLarge = parseColor(token('--scrim-large'));
const worstLarge = blend(scrimLarge.rgb, scrimLarge.a, WHITE);

test('the tokens are the sign\'s own colours', () => {
  const sign = readFileSync('docs/assets/el-ancon-de-loiza-sign.svg', 'utf8').toLowerCase();
  for (const name of ['--green', '--cream', '--ochre']) expect(sign, name).toContain(`fill="${token(name)}"`);
});
test('the scrim is solid under the small text and never thinner than --scrim-large under the big year', () => {
  const bg = decl('.scrim', 'background')!;
  expect(bg).toMatch(/^linear-gradient\(to top, var\(--scrim\) 0, var\(--scrim\) calc\(var\(--rail-h\) \+ var\(--stack\) \+ (\d+)px\),\s*var\(--scrim-large\) calc\(var\(--rail-h\) \+ var\(--stack\) \+ (\d+)px\)/);
  const [, solid, large] = /\+ (\d+)px\),\s*var\(--scrim-large\) calc\(var\(--rail-h\) \+ var\(--stack\) \+ (\d+)px\)/.exec(bg)!.map(Number);
  // The title sits --lift above the rail: its small span line ends inside the solid zone, its year inside the large zone.
  expect(decl('.title-card', 'bottom')).toBe('calc(var(--rail-h) + var(--stack) + var(--lift))');
  const lift = parseInt(token('--lift'), 10);                    // the larger, wide-screen value
  expect(solid).toBeGreaterThanOrEqual(lift + 18);               // span: 13 px text, one line
  expect(large).toBeGreaterThanOrEqual(lift + 100 * 0.8 + 4);    // year: at most 100 px at line-height 0.8
});
test('small text on the scrim reaches 4.5:1 over white; large text reaches 3:1', () => {
  expect(contrastRatio(CREAM, worst)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(CREAM, worstLarge)).toBeGreaterThanOrEqual(3);
  for (const sel of ['.osm-credit', '.timeline__btn']) {
    const c = colour(decl(sel, 'color')!);
    expect(contrastRatio(blend(c.rgb, c.a, worst), worst), sel).toBeGreaterThanOrEqual(4.5);
  }
  // The big year and the era name are large text (>= 24 px, or >= 18.66 px bold).
  expect(decl('.title-card__year', 'font')).toMatch(/^900 clamp\(58px/);
  expect(decl('.title-card__label', 'font')).toMatch(/^700 clamp\(19px/);
});
test('the route line and leaders reach 3:1 on the scrim over white', () => {
  for (const [sel, prop] of [['.timeline__line', 'background'], ['.timeline__leader', 'stroke']] as const) {
    const c = parseColor(decl(sel, prop)!);
    expect(contrastRatio(blend(c.rgb, c.a, worst), worst), sel).toBeGreaterThanOrEqual(3);
  }
});
test('placards carry their own ground: every pairing reaches 4.5:1', () => {
  const pairs: [string, string][] = [
    ['--cream', '--green'], ['--green-deep', '--cream'], ['--ink', '--ochre'], ['--cream', '--green-deep'], ['--ochre-ink', '--cream'], ['--ink', '--gold'],
  ];
  for (const [fg, bg] of pairs) expect(contrastRatio(parseColor(token(fg)).rgb, parseColor(token(bg)).rgb), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  for (const sel of ['.toolbar__btn', '.toolbar__lang, .toolbar__group']) expect(decl(sel, 'background'), sel).toBe('var(--green)');
  expect(decl('.info-panel', 'background')).toBe('var(--cream)');
});
test('load card and era dip: one green field, cream text at 4.5:1 on its lightest stop', () => {
  const field = token('--field');
  expect(decl('#load-card', 'background', html)).toBe(field);
  expect(decl('.era-dip', 'background')).toBe('var(--field)');
  const centre = parseColor(/#[0-9a-f]{6}(?= 0%)/i.exec(field)![0]).rgb;
  expect(contrastRatio(CREAM, centre)).toBeGreaterThanOrEqual(4.5);
  expect(readFileSync('public/404.html', 'utf8')).toContain(field);
});
