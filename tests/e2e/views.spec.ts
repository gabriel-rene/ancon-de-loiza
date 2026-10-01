import { expect, test } from '@playwright/test';

const ready = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });

test('views: an old ?cam=bank link opens Shore; buttons and keys switch Ride / Shore / Sky', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('?cam=bank&freeze=1&q=low');
  await ready(page);
  await expect(page).toHaveURL(/cam=shore/);
  const g = page.getByRole('group', { name: 'View' });
  await expect(g.getByRole('button', { name: 'Shore' })).toHaveAttribute('aria-pressed', 'true');
  await g.getByRole('button', { name: 'Sky' }).click();
  await expect(page).toHaveURL(/cam=sky/);
  await expect(g.getByRole('button', { name: 'Sky' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('1');
  await expect(page).toHaveURL(/cam=ride/);
  await expect(g.getByRole('button', { name: 'Ride' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('2');
  await expect(page).toHaveURL(/cam=shore/);
  expect(errors).toEqual([]);
});

test('a drag turns the view and it stays; Recenter (button or R) brings back the front', async ({ page }) => {
  await page.goto('?cam=sky&freeze=1&q=low');
  await ready(page);
  const recenter = page.getByRole('button', { name: 'Recenter' });
  await expect(recenter).toBeHidden();
  const c = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x + c.width / 2 + 300, c.y + c.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(recenter).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(3_000);
  await expect(recenter).toBeVisible();                 // no ease-back
  await page.keyboard.press('r');
  await expect(recenter).toBeHidden({ timeout: 10_000 });
});

test('dev views need a dev flag', async ({ page }) => {
  await page.goto('?cam=fields&q=low');
  await ready(page);
  await expect(page).not.toHaveURL(/cam=fields/);
  await expect(page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Ride' })).toHaveAttribute('aria-pressed', 'true');
});
