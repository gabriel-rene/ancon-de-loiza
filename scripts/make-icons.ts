// Renders the PNG icons from public/favicon.svg (spec 7b §5.1). Run by hand: `node scripts/make-icons.ts`; commit the output.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
// The Apple icon must be opaque: iOS rounds the corners itself, so the brown fills the whole square.
for (const [file, size, opaque] of [['favicon-32.png', 32, false], ['apple-touch-icon.png', 180, true]] as const) {
  await page.setViewportSize({ width: size, height: size });
  const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" style="display:block" `);
  await page.setContent(`<html><body style="margin:0;background:${opaque ? '#5e4d38' : 'transparent'}">${sized}</body></html>`);
  await page.screenshot({ path: fileURLToPath(new URL(`../public/${file}`, import.meta.url)), omitBackground: !opaque });
}
await browser.close();
console.log('icons written to public/');
