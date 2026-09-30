import { describe, expect, test } from 'vitest';
import { legDuration } from '../ancon/crossing';
import { QUALITY } from '../quality';
import { FLOCK, pelicanFlock } from './flyers';
import { createFaunaPose } from './pose';
import { rideCamera, rideViewFractions, TAKEOFF_WINDOW, VIEW_PX } from './testing';

// Spec 5 §1.1 (amendments 2026-09-30, framing and closer): the ride camera must frame the animals, big enough to
// read, not merely have them within 300 m of the crossing line. Post-dam (1975) and pre-dam (1840) rivers, two
// full legs, 1 s steps; an animal counts when it is in the frustum and at least VIEW_PX on a 900 px tall view.
for (const id of ['1975', '1840'] as const) describe(`ride view ${id}`, () => {
  const f = rideViewFractions(id);
  const pct = (k: 'frigate' | 'pelican' | 'wader' | 'mullet' | 'manatee') => `${k} ${(100 * f[k]).toFixed(0)} %`;
  console.log(`ride view ${id}: ${(['frigate', 'pelican', 'wader', 'mullet', 'manatee'] as const).map(pct).join(', ')}; take-off (least flying waders seen per dock) ${f.takeoff.join(', ')}`);

  test(`frigatebirds seen (≥ ${VIEW_PX.frigate} px) ≥ 40 % of the time`, () => expect(f.frigate).toBeGreaterThanOrEqual(0.4));
  test(`pelicans (flock + fishers) seen (≥ ${VIEW_PX.pelican} px) ≥ 30 % of the time`, () => expect(f.pelican).toBeGreaterThanOrEqual(0.3));
  test(`waders seen (≥ ${VIEW_PX.wader} px) ≥ 40 % of the time`, () => expect(f.wader).toBeGreaterThanOrEqual(0.4));
  test(`take-off: ≥ 2 flying waders seen (≥ ${VIEW_PX.takeoff} px) ${TAKEOFF_WINDOW[0]}–${TAKEOFF_WINDOW[1]} s after every dock`, () => {
    expect(f.docks.map((d) => d.landing).sort()).toEqual([0, 1]);
    for (const k of f.takeoff) expect(k).toBeGreaterThanOrEqual(2);
  });
  // Controller ruling 2026-09-30: long-run over 300 surfacings, each at mid-roll (the strip 25.5–29.5 m out gives ~32–34 %).
  test('manatee framed in ≥ 30 % of its surfacings (long-run)', () => expect(f.manatee).toBeGreaterThanOrEqual(0.3));

  test('the flock enters and leaves outside the ride view (steady headings, 40 loops)', () => {
    const rc = rideCamera(id), T = rc.spec.timings, L = legDuration(T), o = createFaunaPose();
    let checked = 0;
    for (let k = 0; k < 40; k++) for (const te of [k * FLOCK.period + 0.01, (k + 1) * FLOCK.period - 0.01]) {
      const tau = te - Math.floor(te / L) * L;
      if (tau < T.load || tau > L - T.unload) continue;           // the camera swings round over unload + load
      rc.aim(te);
      for (let i = 0; i < QUALITY.high.fauna.flock; i++) expect(rc.inFrustum(pelicanFlock(te, i, rc.w, o)), `loop ${k} t ${te.toFixed(2)}`).toBe(false);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });
});
