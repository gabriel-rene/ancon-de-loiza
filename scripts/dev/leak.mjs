// Dev helper (not part of the app): GPU leak probe across era switches.
//   node scripts/dev/leak.mjs "[extra query]" [cycles=3]
// Counts raw WebGL create/delete calls (textures, buffers, framebuffers, renderbuffers, programs) and reads
// renderer.info (?debug=1 exposes it as window.__ANCON_GL__) after each full cycle of the 8 eras via the rail.
// BASE env overrides the server URL (default: the dev server on :5173).
import { chromium } from '@playwright/test';

const [extra = '', cycles = '3'] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://localhost:5173/ancon-de-loiza/';
const ERAS = ['1840', '1900', '1925', '1935', '1959', '1975', '1984', '1986'];
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  const live = (window.__GL_LIVE__ = { texture: 0, buffer: 0, framebuffer: 0, renderbuffer: 0, program: 0, vertexArray: 0 });
  for (const P of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    for (const k of Object.keys(live)) {
      const K = k[0].toUpperCase() + k.slice(1), c = P[`create${K}`], d = P[`delete${K}`];
      if (!c || !d) continue;
      P[`create${K}`] = function (...a) { const r = c.apply(this, a); if (r) live[k]++; return r; };
      P[`delete${K}`] = function (o) { if (o) live[k]--; return d.call(this, o); };
    }
  }
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${base}?era=1840&freeze=1&debug=1${extra ? `&${extra.replace(/^[?&]/, '')}` : ''}`);
await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90000 });
const frames = (n) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const snap = () => page.evaluate(() => ({ ...window.__GL_LIVE__, geometries: window.__ANCON_GL__?.memory.geometries, textures: window.__ANCON_GL__?.memory.textures, programs: window.__ANCON_GL__?.programs?.length }));
const rows = [];
rows.push({ at: 'load', ...(await snap()) });
for (let c = 0; c < Number(cycles); c++) {
  for (const id of [...ERAS.slice(1), ERAS[0]]) {
    await page.locator('.decade-rail__btn', { hasText: id }).first().click();
    await frames(20);
    if (process.env.VERBOSE) rows.push({ at: `c${c + 1} ${id}`, ...(await snap()) });
  }
  await page.waitForTimeout(500); await frames(10);
  rows.push({ at: `cycle ${c + 1}`, ...(await snap()) });
}
console.table(rows);
if (errors.length) console.log(errors.join('\n'));
await browser.close();
