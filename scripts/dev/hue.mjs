// Dev helper (not part of the app). Dev server must run on :5173.
// Measures mean linear RGB and sRGB hue angle of three fixed regions of a 1440x900 shot:
// ground/grass, water, and sky/haze near the horizon. Region rects are tuned for the
// `?era=1975&cam=bank...` framing used by the phase-2b noon-colour checks (task 10, R12).
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

// Fixed regions (1440x900 viewport), chosen by sampling the `bank` framing to land on clean
// ground/water/horizon-haze patches clear of UI overlays, boats, poles and treeline.
const regions = {
  ground: { x: 950, y: 621, w: 317, h: 162 },
  water: { x: 605, y: 518, w: 345, h: 27 },
  // Right at/just above the treeline, where HeightFogEffect's sky-branch haze term
  // (which fades quickly with view-ray altitude) actually dominates the pixel; a few
  // rows higher is still mostly the raw (bluer) Preetham sky peeking through.
  horizonHaze: { x: 650, y: 398, w: 250, h: 22 },
};

const result = await page.evaluate(async ({ b64, regions }) => {
  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'image/png' });
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);

  const hueDeg = (r, g, b) => {
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d === 0) return 0;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    return h < 0 ? h + 360 : h;
  };

  const out = {};
  for (const [name, r] of Object.entries(regions)) {
    const data = ctx.getImageData(r.x, r.y, r.w, r.h).data;
    let sr = 0, sg = 0, sb = 0, lr = 0, lg = 0, lb = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const rn = data[i] / 255, gn = data[i + 1] / 255, bn = data[i + 2] / 255;
      sr += rn; sg += gn; sb += bn;
      lr += toLinear(rn); lg += toLinear(gn); lb += toLinear(bn);
      n++;
    }
    sr /= n; sg /= n; sb /= n; lr /= n; lg /= n; lb /= n;
    out[name] = { srgb: [sr, sg, sb], linear: [lr, lg, lb], hue: hueDeg(sr, sg, sb) };
  }
  return out;
}, { b64: png, regions });

console.log(`query: ${query || '(default)'}`);
for (const [name, r] of Object.entries(result)) {
  console.log(
    `${name.padEnd(12)} linear RGB: ${r.linear.map((v) => v.toFixed(4)).join(', ')}` +
    `   sRGB: ${r.srgb.map((v) => v.toFixed(4)).join(', ')}   hue: ${r.hue.toFixed(1)}°`,
  );
}
console.log(logs.length ? logs.join('\n') : 'no console errors/warnings');
await browser.close();
