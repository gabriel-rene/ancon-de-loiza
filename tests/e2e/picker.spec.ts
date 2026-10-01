import { expect, test } from '@playwright/test';

test('decade picker switches era, updates the URL, steps with ← →, revisits hit the cache', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('?era=1975&freeze=1&q=low&debug=1');
  await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
  const rail = page.getByRole('navigation', { name: 'Choose an era' });
  await expect(rail.getByRole('button')).toHaveCount(8);
  await expect(rail.locator('button[aria-current="true"]')).toHaveAttribute('aria-label', /1960s–1970s/);
  const runsOf = () => page.evaluate(() => window.__ANCON_VEG__!.placeRuns.length);
  const before = await runsOf();
  await rail.getByRole('button', { name: /1980–1986/ }).click();
  // The dip: the overlay rises over the old era, then clears once 1984 is on screen.
  await expect.poll(() => page.locator('.era-dip').evaluate((e) => Number(getComputedStyle(e).opacity)), { timeout: 5_000 }).toBeGreaterThan(0.5);
  await expect(page.locator('.era-dip')).toBeHidden({ timeout: 10_000 });
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

test('phone: the timeline strip scrolls inside itself and centres the chosen era', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('?freeze=1&q=low&era=1840');
  await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  const strip = page.locator('.timeline__scroll');
  expect(await strip.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
  for (const b of await page.getByRole('navigation', { name: 'Choose an era' }).getByRole('button').all()) {
    const r = (await b.boundingBox())!;
    expect(r.width).toBeGreaterThanOrEqual(40); expect(r.height).toBeGreaterThanOrEqual(44);
  }
  // An interior mark can be centred; the end marks cannot (the strip's scroll clamps at its ends).
  // The scroll centres the mark (the knob), not the label: spread labels sit up to ~115 px off their dots.
  const start = await strip.evaluate((e) => e.scrollLeft);   // era=1840 sits near the strip's start, so 1935 needs a real scroll
  await page.getByRole('button', { name: /^1935/ }).dispatchEvent('click');
  await expect(page).toHaveURL(/era=1935/);
  await expect.poll(() => strip.evaluate((e) => e.scrollLeft), { timeout: 15_000 }).toBeGreaterThan(start + 100);
  await expect.poll(async () => {
    const k = (await page.locator('.timeline__knob').boundingBox())!;
    return Math.abs(k.x + k.width / 2 - 375 / 2);
  }, { timeout: 15_000 }).toBeLessThan(60);
  const before = await strip.evaluate((e) => e.scrollLeft);
  await page.getByRole('button', { name: /^1986/ }).dispatchEvent('click');
  await expect(page).toHaveURL(/era=1986/);
  await expect.poll(() => strip.evaluate((e) => e.scrollLeft), { timeout: 15_000 }).toBeGreaterThan(before);
  await expect.poll(async () => {
    const b = (await page.getByRole('button', { name: /^1986/ }).boundingBox())!;
    const s = (await strip.boundingBox())!;
    return b.x >= s.x - 0.5 && b.x + b.width <= s.x + s.width + 0.5;
  }, { timeout: 15_000 }).toBe(true);
});

test('reduced motion: no dip, the era swaps at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('?era=1975&freeze=1&q=low');
  await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
  await page.getByRole('button', { name: /1980–1986/ }).click();
  await expect(page.locator('.title-card__era')).toContainText('The steel barge', { timeout: 300 }); // a normal dip swaps at >= 0.3 s plus build time
  await expect(page.locator('.era-dip')).toBeHidden();
});
