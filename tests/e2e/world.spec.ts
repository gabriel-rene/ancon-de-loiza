import { expect, test } from '@playwright/test';
import { getEra, type EraId } from '../../src/data/eras';
import { goldenHourAST } from '../../src/geo/sun';

// Times follow the sun, not the clock: each era has its own calendar date, so a fixed
// hour is golden in February but mid-afternoon in July (research §1.3).
const golden = (era: EraId, side: 'am' | 'pm' = 'pm') => goldenHourAST(getEra(era).date, 6, side);
const SHOTS: { era: EraId; cam: string; t: number }[] = [
  { era: '1935', cam: 'ride', t: golden('1935') },              // evening golden hour, looking at the far landing
  { era: '1975', cam: 'bank', t: golden('1975') },              // July: 18.50 AST
  { era: '1984', cam: 'aerial', t: +(golden('1984') - 1).toFixed(2) }, // late afternoon, sun ~18° up
  { era: '1986', cam: 'mouth', t: golden('1986', 'am') },       // morning sun rising over the sea
  // Phase 2a: vegetation per era (1840: sparse palms, no casuarina yet; 1975: full coastal belts).
  { era: '1840', cam: 'bank', t: golden('1840') },
  { era: '1975', cam: 'ride', t: golden('1975') },
];

for (const s of SHOTS) {
  test(`renders ${s.era} ${s.cam} @${s.t}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`?era=${s.era}&cam=${s.cam}&t=${s.t}&freeze=1&q=medium`);
    await page.waitForFunction(() => window.__ANCON_READY__ === true, null, { timeout: 90_000 });
    await page.screenshot({ path: `tests/snapshots/phase2a/${s.era}-${s.cam}.png` });
    expect(errors).toEqual([]);
  });
}
