import { describe, expect, test } from 'vitest';
import { rideViewFractions } from './testing';

// Spec 5 §1.1 (amendment 2026-09-30): the ride camera must actually frame the animals, not merely have them
// within 300 m of the crossing line. Post-dam (1975) and pre-dam (1840) rivers, two full legs, 1 s steps.
for (const id of ['1975', '1840'] as const) describe(`ride view ${id}`, () => {
  const f = rideViewFractions(id);
  console.log(`ride view ${id}: ${Object.entries(f).map(([k, v]) => `${k} ${(100 * v).toFixed(0)} %`).join(', ')}`);

  test('frigatebirds in view ≥ 40 % of the time', () => expect(f.frigate).toBeGreaterThanOrEqual(0.4));
  test('pelicans (flock + fishers) in view ≥ 30 % of the time', () => expect(f.pelican).toBeGreaterThanOrEqual(0.3));
  test('waders in view ≥ 50 % of the time', () => expect(f.wader).toBeGreaterThanOrEqual(0.5));
  // Controller ruling 2026-09-30: long-run over 300 surfacings, each at mid-roll (the strip 25.5–29.5 m out gives ~32–34 %).
  test('manatee framed in ≥ 30 % of its surfacings (long-run)', () => expect(f.manatee).toBeGreaterThanOrEqual(0.3));
});
