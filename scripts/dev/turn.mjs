// Dev helper (not part of the app). Dev server on :5180 (PORT=4173 for the preview build).
//   node scripts/dev/turn.mjs "<query>" <deg> <out.png> [waitMs]
// Drags the canvas to turn a Sky (2.5 px/°) or Shore (8.33 px/°) view by <deg> at 1440×900, then shoots.
import { chromium } from '@playwright/test';

const [query = '', deg = '0', out = 'shot.png', waitMs = '6000'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://localhost:${process.env.PORT ?? 5180}/ancon-de-loiza/${query}`);
await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90000 }).catch(() => logs.push('[warn] ready flag not set'));
await page.waitForTimeout(2500);
const d = Number(deg);
if (d !== 0) {
  const c = await page.locator('canvas').boundingBox();
  const pxPerDeg = query.includes('cam=shore') ? 375 / 45 : 112.5 / 45;
  const dx = -d * pxPerDeg;
  const x0 = c.x + c.width / 2 - dx / 2, y0 = c.y + c.height / 2;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + dx, y0, { steps: 40 });
  await page.mouse.up();
}
await page.waitForTimeout(Number(waitMs));
await page.screenshot({ path: out });
console.log(out, logs.length ? logs.join('\n') : 'ok');
await browser.close();
