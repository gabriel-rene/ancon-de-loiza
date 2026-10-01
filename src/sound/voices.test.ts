import { expect, test } from 'vitest';
import { VoicePool, VOICES } from './voices';

test('the voice budget stays within 12 (spec 6b §5)', () => {
  expect(VOICES.beds + VOICES.traffic + VOICES.engines + VOICES.shots).toBeLessThanOrEqual(12);
});
test('never more voices than the pool; when full, the one ending soonest is reused', () => {
  const p = new VoicePool(3);
  expect([p.acquire(0, 1), p.acquire(0, 2), p.acquire(0, 3)]).toEqual([0, 1, 2]);
  expect(p.active(0.5)).toBe(3);
  expect(p.acquire(0.5, 1)).toBe(0);
  expect(p.active(0.5)).toBe(3);
  expect(p.active(2.5)).toBe(1);
  expect(p.acquire(2.5, 1)).toBe(0);
});
