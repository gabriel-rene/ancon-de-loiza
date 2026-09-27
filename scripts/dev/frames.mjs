// Dev helper (not part of the app): N consecutive rendered frames (canvas read back in a rAF right after
// R3F's render), optionally while the mouse orbits the camera. For checking temporal artefacts (rope shimmer).
//   node scripts/dev/frames.mjs "<query>" <outPrefix> [n=40] [orbit=0|1] [dpr=2]
// BASE env overrides the server URL (default: the preview server on :4173).
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const [query = '', out = 'frame', n = '40', orbit = '0', dpr = '2'] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://localhost:4173/ancon-de-loiza/';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(dpr) });
await page.goto(`${base}${query}`);
await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90000 });
await page.waitForTimeout(2000);
if (orbit === '1') { await page.mouse.move(720, 400); await page.mouse.down(); }
const grab = page.evaluate((n) => new Promise((resolve) => {
  const c = document.querySelector('canvas'), shots = [];
  const tick = () => {
    const o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
    o.getContext('2d').drawImage(c, 0, 0);
    shots.push(o);
    if (shots.length < n) requestAnimationFrame(tick); else resolve(shots.map((s) => s.toDataURL('image/png')));
  };
  requestAnimationFrame(tick);
}), Number(n));
if (orbit === '1') for (let i = 0; i < 60; i++) { await page.mouse.move(720 + i * 2, 400 - i * 0.5); await page.waitForTimeout(16); }
const urls = await grab;
if (orbit === '1') await page.mouse.up();
urls.forEach((u, i) => writeFileSync(`${out}-${String(i).padStart(2, '0')}.png`, Buffer.from(u.split(',')[1], 'base64')));
console.log(`${urls.length} frames → ${out}-NN.png`);
await browser.close();
