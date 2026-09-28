import { expect, test } from '@playwright/test';
import { getEra, type EraId } from '../../src/data/eras';
import { goldenHourAST } from '../../src/geo/sun';

/** Output folder under tests/snapshots (SNAP_DIR=phase2c-before for the baseline run). */
const DIR = `tests/snapshots/${process.env.SNAP_DIR ?? 'phase2c'}`;

// Times follow the sun, not the clock: each era has its own calendar date, so a fixed
// hour is golden in February but mid-afternoon in July (research §1.3).
const golden = (era: EraId, side: 'am' | 'pm' = 'pm') => goldenHourAST(getEra(era).date, 6, side);
const SHOTS: { era: EraId; cam: string; t: number; c: number; name?: string }[] = [
  { era: '1935', cam: 'ride', t: golden('1935'), c: 95 },                        // 1-car platform on two taut ropes
  { era: '1975', cam: 'bank', t: golden('1975'), c: 95 },
  { era: '1984', cam: 'aerial', t: +(golden('1984') - 1).toFixed(2), c: 95 },     // wake from above
  { era: '1986', cam: 'mouth', t: golden('1986', 'am'), c: 0 },
  { era: '1840', cam: 'bank', t: golden('1840'), c: 95 },
  { era: '1975', cam: 'ride', t: golden('1975'), c: 95 },
  // Phase 3: one shot per vessel kind, plus docked-with-slack-ropes and moored.
  { era: '1840', cam: 'ride', t: golden('1840'), c: 95 },                        // timber barge, polers, helmsman, Lombera shore rope
  { era: '1925', cam: 'bank', t: golden('1925'), c: 70 },                        // plank platform, push + steer poles
  { era: '1959', cam: 'bank', t: golden('1959'), c: 5, name: '1959-bank-docked' }, // loading, ropes sagging into the water
  { era: '1984', cam: 'ride', t: golden('1984'), c: 95 },                        // steel pontoon, the anconera hauling
  { era: '1986', cam: 'bank', t: golden('1986'), c: 0 },                         // moored and idle
  // Phase 2b: noon, where the new species, ground cover and the noon grade read best.
  { era: '1975', cam: 'bank', t: 12, c: 95, name: '1975-bank-noon' },
  { era: '1840', cam: 'bank', t: 12, c: 95, name: '1840-bank-noon' },
  // Phase 2c: cane fields, farm blocks, palm age.
  { era: '1900', cam: 'fields', t: 12, c: 95, name: '1900-fields-noon' },
  { era: '1840', cam: 'fields', t: 12, c: 95, name: '1840-fields-noon' },
  { era: '1925', cam: 'fields', t: 12, c: 95, name: '1925-fields-noon' },
  { era: '1975', cam: 'fields', t: 12, c: 95, name: '1975-fields-noon' },
  { era: '1900', cam: 'aerial', t: 12, c: 95, name: '1900-aerial-noon' },
  { era: '1975', cam: 'aerial', t: 12, c: 95, name: '1975-aerial-noon' },
  { era: '1900', cam: 'ride', t: golden('1900'), c: 95 },
  { era: '1925', cam: 'bank', t: 12, c: 70, name: '1925-bank-noon' },
];

for (const s of SHOTS) {
  test(`renders ${s.era} ${s.cam} @${s.t} c=${s.c}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`?era=${s.era}&cam=${s.cam}&t=${s.t}&c=${s.c}&freeze=1&q=medium`);
    await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
    await page.screenshot({ path: `${DIR}/${s.name ?? `${s.era}-${s.cam}`}.png` });
    expect(errors).toEqual([]);
  });
}

test('default view: ride camera at golden hour, the ferry running', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('?freeze=1&q=medium&debug=1');
  await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
  await page.screenshot({ path: `${DIR}/default.png` });
  expect(await page.evaluate(() => window.__ANCON_ANCON__?.frames ?? 0)).toBeGreaterThan(0);   // the ferry's frame loop runs
  expect(errors).toEqual([]);
});
