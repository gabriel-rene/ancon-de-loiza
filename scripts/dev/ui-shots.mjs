// Dev helper (not part of the app): UI states at desktop and phone sizes, for design review.
//   node scripts/dev/ui-shots.mjs [outDir]      (dev server on PORT, default 5173)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? '.impeccable/review';
mkdirSync(out, { recursive: true });
const base = `http://localhost:${process.env.PORT ?? 5173}/ancon-de-loiza/`;
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ready = (page) => page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90000 });
const logs = [];

for (const [name, viewport, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => logs.push(`[${name}] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && logs.push(`[${name}] ${m.text()}`));
  const shot = (s) => page.screenshot({ path: `${out}/${name}${s ? `-${s}` : ''}.png` });

  await page.goto(`${base}?lang=es&era=1975`);
  await page.waitForTimeout(400);
  await shot('load');
  await ready(page);
  await page.waitForTimeout(700);
  await shot('arrival');
  await page.waitForTimeout(3500);
  await shot('');                                   // settled, with the drag hint
  await page.getByRole('button', { name: 'Datos' }).click();
  await page.waitForTimeout(900);
  await shot('facts');
  await page.getByRole('button', { name: /^Calidad/ }).click();
  await page.waitForTimeout(500);
  await shot('quality');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  if (!mobile) { await page.getByRole('button', { name: /^1935/ }).hover(); await page.waitForTimeout(400); await shot('tip'); }
  await page.getByRole('button', { name: /^1925/ }).dispatchEvent('click');
  await page.waitForTimeout(330);
  await shot('dip');
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: 'Cielo' }).click();
  await page.waitForTimeout(3500);
  await shot('sky-1925');
  await page.goto(`${base}?lang=en&era=1986&cam=shore`);
  await ready(page);
  await page.waitForTimeout(6000);
  await shot('shore-1986-en');
  await ctx.close();
}
// Extra states: a mid-width window, the turned view (Recenter), sound on, keyboard focus, no WebGL, the 404 page.
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 700 } });
  const page = await ctx.newPage();
  await page.goto(`${base}?lang=en&era=1959&cam=sky`);
  await ready(page);
  await page.waitForTimeout(2500);
  await page.mouse.move(500, 300); await page.mouse.down(); await page.mouse.move(650, 320, { steps: 8 }); await page.mouse.up();
  await page.getByRole('button', { name: 'Sound' }).click();
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/mid-turned-sound-focus.png` });
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/mid-timeline-focus.png` });
  await page.goto(`${base.replace(/\/$/, '')}/404.html`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/404.png` });
  await ctx.close();
  const bare = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis'] });
  const p2 = await (await bare.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p2.goto(`${base}?lang=es&era=1935`);
  await p2.waitForSelector('.scene-fallback', { timeout: 30000 });
  await p2.waitForTimeout(1500);
  await p2.screenshot({ path: `${out}/no-webgl.png` });
  await bare.close();
}
console.log(logs.length ? logs.join('\n') : 'no page errors');
await browser.close();
