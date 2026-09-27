// scripts/dev/perf.mjs — dev helper (not part of the app).
//   npm run build && npm run preview   (serves :4173)
//   node scripts/dev/perf.mjs "<query>" [seconds=10] [dpr=2]
// Frame times with vsync and the frame-rate cap off; BASE env overrides the server URL.
import { chromium } from '@playwright/test';

const [query = '', secs = '10', dpr = '2'] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://localhost:4173/ancon-de-loiza/';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(dpr) });
await page.goto(`${base}${query}${query.includes('?') ? '&' : '?'}perf=1`);
await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90000 });
await page.waitForTimeout(3000);
await page.evaluate(() => { window.__ANCON_PERF__.frames.length = 0; });
await page.waitForTimeout(Number(secs) * 1000);
const r = await page.evaluate(() => {
  const f = window.__ANCON_PERF__.frames.slice().sort((a, b) => a - b);
  const mean = f.reduce((a, b) => a + b, 0) / f.length;
  return { n: f.length, mean, p95: f[Math.floor(f.length * 0.95)], ancon: window.__ANCON_ANCON__?.cpuMs ?? null };
});
console.log(JSON.stringify({ query, dpr: Number(dpr), fps: +(1000 / r.mean).toFixed(1), meanMs: +r.mean.toFixed(2), p95Ms: +r.p95.toFixed(2), anconCpuMs: r.ancon && +r.ancon.toFixed(3) }));
await browser.close();
