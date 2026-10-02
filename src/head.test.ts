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

const SITE = 'https://gabriel-rene.github.io/ancon-de-loiza/';
/** Width and height from a baseline/progressive JPEG's SOF marker. */
function jpegSize(b: Buffer) {
  let i = 2;
  while (i < b.length) {
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc2) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error('no SOF marker');
}
test('share card meta (spec 7b §5.2)', () => {
  has(new RegExp(`<link rel="canonical" href="${SITE}" />`));
  has(new RegExp(`<meta property="og:url" content="${SITE}" />`));
  has(/<meta property="og:type" content="website" \/>/);
  has(/<meta property="og:site_name" content="El Ancón de Loíza" \/>/);
  has(/<meta property="og:title" content="El Ancón de Loíza" \/>/);
  has(new RegExp(`<meta property="og:image" content="${SITE}share-card\\.jpg" />`));
  has(/<meta property="og:image:width" content="1200" \/>/);
  has(/<meta property="og:image:height" content="630" \/>/);
  has(/<meta property="og:image:alt" content="[^"]+" \/>/);
  has(/<meta property="og:locale" content="es_PR" \/>/);
  has(/<meta property="og:locale:alternate" content="en_US" \/>/);
  has(/<meta name="twitter:card" content="summary_large_image" \/>/);
  const desc = /<meta name="description" content="([^"]+)" \/>/.exec(html)![1];
  expect(/<meta property="og:description" content="([^"]+)" \/>/.exec(html)![1]).toBe(desc);
  expect(desc.indexOf('ancón')).toBeLessThan(desc.indexOf('ferry'));   // Spanish first
});
test('the share card is a 1200×630 JPEG under 300 KB', () => {
  const b = readFileSync('public/share-card.jpg');
  expect(jpegSize(b)).toEqual({ w: 1200, h: 630 });
  expect(b.length).toBeLessThan(300_000);
});
test('404 page: both languages, a link home, the favicon, no index, no script (spec 7b §5.3)', () => {
  const p = readFileSync('public/404.html', 'utf8');
  expect(p).toMatch(/^<!doctype html>/i);
  expect(p).toContain('<html lang="es">');
  expect(p).toContain('<meta name="robots" content="noindex" />');
  expect(p).toContain('href="/ancon-de-loiza/favicon.svg"');
  expect(p).toContain('href="/ancon-de-loiza/"');
  expect(p).toContain('Esta página no existe.');
  expect(p).toContain('This page does not exist.');
  expect(p).not.toMatch(/<script/i);
});
