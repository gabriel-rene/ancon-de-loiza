import { expect, test } from '@playwright/test';

const ready = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });

test('sound: off at start, no sound chunk; the button turns it on and the choice survives a reload', async ({ page }) => {
  const chunks: string[] = [];
  page.on('request', (r) => { if (/\/Sound-[^/]*\.js$/.test(r.url())) chunks.push(r.url()); });
  await page.goto('?era=1935&q=low');
  await ready(page);
  const btn = page.getByRole('button', { name: 'Sound' });
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(1_000);
  expect(chunks).toEqual([]);

  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await page.waitForFunction(() => window.__ANCON_SOUND__?.state === 'running', null, { timeout: 15_000 });
  expect(chunks.length).toBe(1);
  const s = await page.evaluate(() => window.__ANCON_SOUND__!);
  expect(s.voices).toBeLessThanOrEqual(12);

  await page.reload();
  await ready(page);
  await expect(page.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.click(700, 450);   // the first gesture unlocks audio
  await page.waitForFunction(() => window.__ANCON_SOUND__?.state === 'running', null, { timeout: 15_000 });

  await page.getByRole('button', { name: 'Sound' }).click();
  await expect(page.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'false');
  await page.waitForFunction(() => window.__ANCON_SOUND__ === undefined);
});

test('sound: 1840 shore fires one-shots (pole strokes and birds)', async ({ page }) => {
  await page.goto('?era=1840&q=low');
  await ready(page);
  await page.getByRole('button', { name: 'Sound' }).click();
  await page.waitForFunction(() => window.__ANCON_SOUND__?.state === 'running', null, { timeout: 15_000 });
  await page.waitForFunction(() => (window.__ANCON_SOUND__?.shots ?? 0) > 0, null, { timeout: 30_000 });
});

test('sound: 1986 shore has water and bridge traffic voices', async ({ page }) => {
  await page.goto('?era=1986&q=low&cam=shore');
  await ready(page);
  await page.getByRole('button', { name: 'Sound' }).click();
  await page.waitForFunction(() => window.__ANCON_SOUND__?.state === 'running', null, { timeout: 15_000 });
  await page.waitForFunction(() => (window.__ANCON_SOUND__?.voices ?? 0) >= 2, null, { timeout: 15_000 });
});
