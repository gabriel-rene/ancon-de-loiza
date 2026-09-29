// Dev helper (not part of the app). Dev server must run on :5173 (PORT=4173 for the preview build).
//   node scripts/dev/shot.mjs "<query>" <out.png> [waitMs]
import { chromium } from '@playwright/test';

const [query = '', out = 'shot.png', waitMs = '8000'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/ancon-de-loiza/${query}`);
await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 60000 }).catch(() => logs.push('[warn] ready flag not set'));
await page.waitForTimeout(Number(waitMs));
await page.screenshot({ path: out });
console.log(logs.length ? logs.join('\n') : 'no console errors/warnings');
await browser.close();
