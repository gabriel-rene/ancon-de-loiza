// Renders public/share-card.jpg (spec 7b §5.2) from the production build. Run by hand, with `npm run preview` running:
//   node scripts/make-share-card.ts        (ANCON_URL overrides the page; SWIFTSHADER=1 forces software WebGL)
// Commit the output. The user approves the image before merge.
import { chromium } from '@playwright/test';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const url = process.env.ANCON_URL ?? 'http://localhost:4173/ancon-de-loiza/?freeze=1&q=high&lang=es';
const out = fileURLToPath(new URL('../public/share-card.jpg', import.meta.url));
const args = process.env.SWIFTSHADER ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(url);
await page.waitForFunction(() => (window as unknown as { __ANCON_READY__?: boolean }).__ANCON_READY__ === true, null, { timeout: 180_000 });
await page.addStyleTag({ content: 'header, nav, .timeline, .title-card, .osm-credit, .skip-link, .fps-readout { display: none !important; }' });
await page.waitForTimeout(1500);
const scene = (await page.screenshot({ type: 'png' })).toString('base64');

// The title over the frame: load-card serif, cream, bottom left, on a soft dark gradient.
await page.setContent(`<!doctype html><html><body style="margin:0">
  <div style="position:relative;width:1200px;height:630px;background:url(data:image/png;base64,${scene}) center/cover">
    <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(12,15,15,0.72) 0%, rgba(12,15,15,0) 48%)"></div>
    <div style="position:absolute;left:56px;bottom:48px;color:#f4ecdf;font-family:ui-serif, Georgia, serif">
      <div style="font-size:76px;line-height:1;font-weight:500;letter-spacing:0.02em">El Ancón de Loíza</div>
      <div style="margin-top:14px;font-size:26px;letter-spacing:0.24em">1840–1986</div>
    </div>
  </div></body></html>`);
await page.screenshot({ path: out, type: 'jpeg', quality: 85 });
await browser.close();
console.log(`share card written: ${out} (${Math.round(statSync(out).size / 1024)} KB)`);
