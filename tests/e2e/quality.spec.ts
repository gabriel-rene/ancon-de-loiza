import { expect, test } from '@playwright/test';

const ready = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });

test('the load card shows the era year, then is gone after ready', async ({ page }) => {
  await page.goto('?era=1935&freeze=1&q=low&lang=en');
  const card = page.locator('#load-card');
  await expect(card).toContainText('1935');
  await ready(page);
  await expect(card).toHaveCount(0, { timeout: 5_000 });
});

test('the quality button changes the tier and the choice survives a reload', async ({ page }) => {
  test.setTimeout(240_000);   // two full loads plus a tier rebuild on the software GPU; ~85 s alone, more beside parallel workers
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('?era=1975&freeze=1&q=low&lang=en');
  await ready(page);
  await page.getByRole('button', { name: /^Quality/ }).click();
  await page.getByRole('menuitemradio', { name: 'Medium' }).click();
  await page.waitForFunction(() => window.__ANCON_QUALITY__?.tier === 'medium', null, { timeout: 30_000 });
  await expect(page).not.toHaveURL(/[?&]q=/);
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => window.__ANCON_QUALITY__)).toMatchObject({ tier: 'medium', mode: 'hand' });
  expect(errors).toEqual([]);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Auto starts a phone on medium and a slow frame rate steps it down to low through the dip', async ({ page }) => {
    test.setTimeout(240_000);   // ~120 governor frames, each slow on the software GPU
    await page.addInitScript(() => { window.__ANCON_FAKE_FPS__ = 20; });
    await page.goto('?era=1975&lang=en');
    await ready(page);
    expect(await page.evaluate(() => window.__ANCON_QUALITY__)).toMatchObject({ tier: 'medium', mode: 'auto' });
    await page.waitForFunction(() => window.__ANCON_QUALITY__?.tier === 'low', null, { timeout: 180_000 });
    expect(await page.evaluate(() => window.__ANCON_QUALITY__?.steps)).toBe(1);
  });

  test('the open Facts sheet does not cover the quality menu', async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 402, height: 600 });   // short enough that the sheet covers Low (the sheet top is ~192 px, Low sits at 201-245)
    await page.goto('?era=1975&freeze=1&q=medium&lang=en');
    await ready(page);
    await page.getByRole('button', { name: 'Facts' }).click();
    await page.getByRole('button', { name: /^Quality/ }).click();
    await page.getByRole('menuitemradio', { name: 'Low' }).click();   // Low is the item the sheet covers; a covered item would hit the sheet and close the menu instead
    await page.waitForFunction(() => window.__ANCON_QUALITY__?.tier === 'low', null, { timeout: 30_000 });
  });

  test('the canvas takes the drag (touch-action none)', async ({ page }) => {
    await page.goto('?era=1975&freeze=1&q=low');
    await ready(page);
    expect(await page.locator('canvas').evaluate((c) => getComputedStyle(c).touchAction)).toBe('none');
  });
});
