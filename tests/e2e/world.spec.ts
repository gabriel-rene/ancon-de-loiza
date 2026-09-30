import { expect, test } from '@playwright/test';
import { getEra, type EraId } from '../../src/data/eras';
import { CROSSING_TIMINGS as T } from '../../src/ancon/crossing';
import { goldenHourAST } from '../../src/geo/sun';
import { DOCK_STOPS } from '../../src/traffic/dockStops';

/** Output folder under tests/snapshots (SNAP_DIR=phase4c-before for the baseline run). */
const DIR = `tests/snapshots/${process.env.SNAP_DIR ?? 'phase4c'}`;

// Times follow the sun, not the clock: each era has its own calendar date, so a fixed
// hour is golden in February but mid-afternoon in July (research §1.3).
const golden = (era: EraId, side: 'am' | 'pm' = 'pm') => goldenHourAST(getEra(era).date, 6, side);
/**
 * Crossing clock at a moment of an era's leg 0: 40 % into boarding (the load on the ramp and deck; at 6 s it is still
 * up the road, out of frame — art gate), mid-crossing (the waiting line ahead), 6 s into unloading.
 */
const at = (era: EraId, when: 'board' | 'mid' | 'unload') => {
  const { load } = DOCK_STOPS[era], move = load + T.castOff + T.cross + T.dock;
  return when === 'board' ? Math.round(0.4 * load) : when === 'mid' ? Math.round(load + T.castOff + T.cross / 2) : Math.round(move + 6);
};
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
  { era: '1900', cam: 'farm', t: 12, c: 95, name: '1900-farm-noon' },           // young palms in 8 m rows
  { era: '1935', cam: 'farm', t: 12, c: 95, name: '1935-farm-noon' },           // the same block, full-grown
  // Phase 4a: landings, station, roads, bridge.
  { era: '1900', cam: 'station', t: 12, c: 95, name: '1900-station-noon' },     // shelter, bare bank, sand road
  { era: '1925', cam: 'station', t: 12, c: 95, name: '1925-station-noon' },     // wooden Cortijo house, thatch
  { era: '1959', cam: 'station', t: 12, c: 5, name: '1959-station-docked' },    // timber landing, zinc roofs, ferry docked
  { era: '1975', cam: 'station', t: golden('1975'), c: 95, name: '1975-station' }, // concrete house + bar terrace
  { era: '1984', cam: 'station', t: 12, c: 95, name: '1984-station-noon' },     // neighbour's house gone
  { era: '1984', cam: 'bridge', t: 12, c: 95, name: '1984-bridge-noon' },       // bridge being built, gap, crane
  { era: '1986', cam: 'bridge', t: golden('1986'), c: 0, name: '1986-bridge' }, // bridge open
  // Phase 4b: the town from the river.
  { era: '1840', cam: 'town', t: 12, c: 95, name: '1840-town-noon' },          // thatched huts round the church
  { era: '1925', cam: 'town', t: 12, c: 95, name: '1925-town-noon' },          // wood on zocos, thatch and zinc
  { era: '1959', cam: 'town', t: golden('1959'), c: 95, name: '1959-town' },   // zinc roofs, first concrete
  { era: '1986', cam: 'town', t: 12, c: 95, name: '1986-town-noon' },          // mostly concrete
  // Phase 4c: the load driving on, riding, driving off; the waiting line; the 1986 bridge traffic.
  { era: '1840', cam: 'ride', t: golden('1840'), c: at('1840', 'board'), name: '1840-ride-board' },
  { era: '1900', cam: 'ride', t: golden('1900'), c: at('1900', 'mid'), name: '1900-ride-cane' },
  { era: '1925', cam: 'bank', t: 12, c: at('1925', 'board'), name: '1925-bank-board' },
  { era: '1935', cam: 'ride', t: golden('1935'), c: at('1935', 'mid'), name: '1935-ride-car' },
  { era: '1959', cam: 'ride', t: golden('1959'), c: at('1959', 'unload'), name: '1959-ride-unload' },
  { era: '1975', cam: 'ride', t: golden('1975'), c: at('1975', 'mid'), name: '1975-ride-line' },
  { era: '1975', cam: 'bank', t: golden('1975'), c: at('1975', 'board'), name: '1975-bank-board' },
  { era: '1984', cam: 'ride', t: golden('1984'), c: at('1984', 'board'), name: '1984-ride-board' },
  { era: '1984', cam: 'ride', t: golden('1984'), c: at('1984', 'unload'), name: '1984-ride-unload' },
  { era: '1986', cam: 'bridge', t: golden('1986'), c: 40, name: '1986-bridge-traffic' },
];

for (const s of SHOTS) {
  test(`renders ${s.era} ${s.cam} @${s.t} c=${s.c}`, async ({ page }) => {
    // Station and town shots are too slow on the software GPU (close water reflection); taken with scripts/dev/shot.mjs (phase-4a-rulings.md, phase-4b-rulings.md).
    test.skip(s.cam === 'station' || s.cam === 'town', 'station and town shots use the real GPU');
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
