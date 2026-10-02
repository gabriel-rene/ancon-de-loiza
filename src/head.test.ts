import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const has = (re: RegExp) => expect(html).toMatch(re);

test('favicon set and theme colour (spec 7b §5.1)', () => {
  has(/<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml" \/>/);
  has(/<link rel="icon" href="\/favicon-32\.png" type="image\/png" sizes="32x32" \/>/);
  has(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" \/>/);
  has(/<meta name="theme-color" content="#3f3426" \/>/);
  for (const f of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']) expect(existsSync(`public/${f}`), f).toBe(true);
});
test('the favicon is the sign\'s A', () => {
  const sign = readFileSync('docs/assets/el-ancon-de-loiza-sign.svg', 'utf8');
  const a = /<path id="glyph-A" d="([^"]+)"/.exec(sign)![1];
  expect(readFileSync('public/favicon.svg', 'utf8')).toContain(`d="${a}"`);
});
test('the page language defaults to Spanish', () => has(/<html lang="es">/));
