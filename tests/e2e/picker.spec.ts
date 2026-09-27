import { expect, test } from '@playwright/test';

test('decade picker switches era, updates the URL, steps with ← →, revisits hit the cache', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('?era=1975&freeze=1&q=low&debug=1');
  await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
  const rail = page.getByRole('navigation', { name: 'Choose an era' });
  await expect(rail.getByRole('button')).toHaveCount(8);
  await expect(rail.getByRole('button', { pressed: true })).toHaveAttribute('aria-label', /1960s–1970s/);
  const runsOf = () => page.evaluate(() => window.__ANCON_VEG__!.placeRuns.length);
  const before = await runsOf();
  await rail.getByRole('button', { name: /1980–1986/ }).click();
  await expect(page).toHaveURL(/era=1984/);
  // 1984 has new densities: wait until its placement has actually run (it happens inside the R3F tree, not with the DOM title).
  await page.waitForFunction((n) => window.__ANCON_VEG__!.placeRuns.length > n, before, { timeout: 30_000 });
  await expect(page.locator('.title-card__era')).toContainText('The steel barge');
  const runs = await runsOf();
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/era=1975/);
  await expect(page.locator('.title-card__era')).toContainText('Weekend outings');
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/era=1984/);
  await expect(page.locator('.title-card__era')).toContainText('The steel barge');
  await page.waitForTimeout(1500);                                                          // let both switches render
  expect(await runsOf()).toBe(runs);   // revisits: no new placement
  await expect(page).toHaveURL(/freeze=1/);
  const box = await rail.getByRole('button').first().boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(errors).toEqual([]);
});

test('phone: the rail fits 375 px without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('?freeze=1&q=low');
  await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  for (const b of await page.getByRole('navigation', { name: 'Choose an era' }).getByRole('button').all()) {
    const r = (await b.boundingBox())!;
    expect(r.width).toBeGreaterThanOrEqual(40); expect(r.height).toBeGreaterThanOrEqual(44);
  }
});
