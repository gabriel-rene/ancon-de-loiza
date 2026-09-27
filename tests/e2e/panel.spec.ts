import { expect, test } from '@playwright/test';

test('phone: facts panel opens, switches language, follows the rail, closes with Esc', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('?era=1935&freeze=1&q=low&lang=en');
  await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
  await page.getByRole('button', { name: 'Facts' }).click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading')).toContainText('The ropes');
  const n = await panel.getByRole('listitem').count();
  expect(n).toBeGreaterThanOrEqual(3);
  expect(n).toBeLessThanOrEqual(5);
  await expect(panel.getByRole('link').first()).toHaveAttribute('target', '_blank');
  await page.getByRole('button', { name: 'Español' }).click();
  await expect(page).toHaveURL(/lang=es/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(panel.getByRole('heading')).toContainText('Las sogas');
  // The rail stays tappable above the sheet (a covered button would fail the click).
  await page.getByRole('navigation', { name: 'Escoge una época' }).getByRole('button', { name: /^1984/ }).click();
  await expect(page).toHaveURL(/era=1984/);
  await expect(panel.getByRole('heading')).toContainText('La barcaza de acero');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Datos' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  expect(errors).toEqual([]);
});
