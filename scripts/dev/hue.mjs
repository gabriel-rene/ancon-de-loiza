// Dev helper (not part of the app). Dev server must run on :5173.
// Measures mean linear RGB of the lower half (land+water) and upper third (sky) of a shot.
//   node scripts/dev/hue.mjs "<query>" [waitMs]
import { chromium } from '@playwright/test';

const [query = '', waitMs = '8000'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://localhost:5173/ancon-de-loiza/${query}`);
await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 60000 }).catch(() => logs.push('[warn] ready flag not set'));
await page.waitForTimeout(Number(waitMs));

const png = (await page.screenshot()).toString('base64');

const result = await page.evaluate(async (b64) => {
  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'image/png' });
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const { width, height } = canvas;
  const lowerData = ctx.getImageData(0, Math.floor(height / 2), width, height - Math.floor(height / 2)).data;
  const upperData = ctx.getImageData(0, 0, width, Math.floor(height / 3)).data;
  const mean = (data) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += toLinear(data[i] / 255);
      g += toLinear(data[i + 1] / 255);
      b += toLinear(data[i + 2] / 255);
      n++;
    }
    return [r / n, g / n, b / n];
  };
  return { lower: mean(lowerData), upper: mean(upperData) };
}, png);

console.log(`query: ${query || '(default)'}`);
console.log(`lower half (land+water) linear RGB: ${result.lower.map((v) => v.toFixed(4)).join(', ')}`);
console.log(`upper third (sky) linear RGB:        ${result.upper.map((v) => v.toFixed(4)).join(', ')}`);
console.log(logs.length ? logs.join('\n') : 'no console errors/warnings');
await browser.close();
