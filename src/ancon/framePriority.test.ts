import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { ANCON_FRAME_PRIORITY } from './Ancon';

// Ancon moves the ride camera; vegetation culling, ground cover and the shadow focus (priority 0)
// must run after it in the same frame. Positive priorities take over rendering in R3F.
test('Ancon updates before priority-0 frame callbacks (and never takes over rendering)', () => {
  expect(ANCON_FRAME_PRIORITY).toBeLessThan(0);
  const src = readFileSync(new URL('./Ancon.tsx', import.meta.url), 'utf8');
  expect(src).toMatch(/\}, ANCON_FRAME_PRIORITY\);/);
});
