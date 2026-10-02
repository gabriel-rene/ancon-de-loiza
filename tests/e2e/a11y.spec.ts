import { chromium, expect, test, type Page } from '@playwright/test';

const ready = (page: Page) => page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
/** Accessible-ish name of the focused element. */
const focused = (page: Page) => page.evaluate(() => {
  const a = document.activeElement as HTMLElement | null;
  return a ? (a.getAttribute('aria-label') ?? a.textContent ?? '').trim() : '';
});

test('tab order: skip link, toolbar, scene, timeline; the skip link lands on the chosen era', async ({ page }) => {
  await page.goto('?era=1925&freeze=1&q=low&lang=en');
  await ready(page);
  const seen: string[] = [];
  for (let i = 0; i < 24; i++) { await page.keyboard.press('Tab'); seen.push(await focused(page)); }
  expect(seen[0]).toBe('Skip to timeline');
  const at = (re: RegExp) => seen.findIndex((s) => re.test(s));
  expect(at(/^Facts$/)).toBeGreaterThan(0);
  expect(at(/^Sky$/)).toBeGreaterThan(at(/^Facts$/));
  expect(at(/^3D view of the ferry, 1925/)).toBeGreaterThan(at(/^Sky$/));
  expect(at(/^1840 ·/)).toBeGreaterThan(at(/^3D view/));
  // Chrome keeps the sequential-focus start point on the last focused element, so start from a fresh load.
  await page.reload();
  await ready(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  expect(await focused(page)).toMatch(/^1925 ·/);
});

test('arrows on the scene look around and leave the era; arrows elsewhere change it', async ({ page }) => {
  await page.goto('?cam=sky&era=1975&freeze=1&q=low&lang=en');
  await ready(page);
  const recenter = page.getByRole('button', { name: 'Recenter' });
  await expect(recenter).toBeHidden();
  await page.getByRole('group', { name: /^3D view of the ferry/ }).focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(recenter).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/era=1975/);
  await page.keyboard.press('r');
  await expect(recenter).toBeHidden({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Facts' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/era=1984/);
});

test('head: icons, share card and the 404 page are served', async ({ page, request }) => {
  await page.goto('?freeze=1&q=low');
  // vite preview answers any unknown path with 200 text/html (SPA fallback), so check the content type too.
  const files: Array<[string, RegExp]> = [
    ['favicon.svg', /image\/svg\+xml/],
    ['favicon-32.png', /image\/png/],
    ['apple-touch-icon.png', /image\/png/],
    ['share-card.jpg', /image\/jpeg/],
  ];
  for (const [f, type] of files) {
    const res = await request.get(f);
    expect(res.status(), f).toBe(200);
    expect(res.headers()['content-type'], f).toMatch(type);
  }
  const notFound = await request.get('404.html');
  expect(notFound.status(), '404.html').toBe(200);
  expect(await notFound.text(), '404.html').toContain('Esta página no existe.');
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', '/ancon-de-loiza/favicon.svg');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://gabriel-rene.github.io/ancon-de-loiza/share-card.jpg');
});

// Playwright forbids launchOptions inside a describe group (it forces a new worker), so this test launches its own browser.
test('without WebGL: the fallback shows, Facts opens by itself, and era changes are still announced', async ({ baseURL }) => {
  const browser = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis'] });
  try {
    const page = await (await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } })).newPage();
    await page.goto('?era=1975&lang=en');
    await expect(page.locator('.scene-fallback')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('navigation', { name: 'Choose an era' }).getByRole('button', { name: /^1984/ }).click();
    await expect(page.locator('[aria-live="polite"]', { hasText: 'Now showing: 1984' })).toHaveCount(1, { timeout: 10_000 });
  } finally {
    await browser.close();
  }
});
