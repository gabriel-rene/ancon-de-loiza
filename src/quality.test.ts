// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { detectQuality, resolveQuality, stepDown } from './quality';

function device(o: { coarse: boolean; cores?: number; mem?: number }) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('coarse') ? o.coarse : false }));
  Object.defineProperty(navigator, 'hardwareConcurrency', { value: o.cores ?? 8, configurable: true });
  if (o.mem === undefined) delete (navigator as { deviceMemory?: number }).deviceMemory;
  else Object.defineProperty(navigator, 'deviceMemory', { value: o.mem, configurable: true });
}
afterEach(() => { vi.unstubAllGlobals(); delete (navigator as { deviceMemory?: number }).deviceMemory; });

test('start tier table (spec 7a §2.1)', () => {
  device({ coarse: true, cores: 8, mem: 4 }); expect(detectQuality()).toBe('low');
  device({ coarse: true, cores: 8, mem: 2 }); expect(detectQuality()).toBe('low');
  device({ coarse: true, cores: 6, mem: 8 }); expect(detectQuality()).toBe('medium');
  device({ coarse: true, cores: 6 }); expect(detectQuality()).toBe('medium');          // iPhone: no deviceMemory
  device({ coarse: false, cores: 4 }); expect(detectQuality()).toBe('medium');
  device({ coarse: false, cores: 10 }); expect(detectQuality()).toBe('high');
});
test('precedence: URL beats a hand pick beats Auto; dev flags turn the governor off (spec 7a §2.2)', () => {
  expect(resolveQuality({ url: 'low', saved: 'high', dev: false, detected: 'medium' })).toEqual({ quality: 'low', mode: 'url' });
  expect(resolveQuality({ saved: 'high', dev: false, detected: 'medium' })).toEqual({ quality: 'high', mode: 'hand' });
  expect(resolveQuality({ saved: 'auto', dev: false, detected: 'medium' })).toEqual({ quality: 'medium', mode: 'auto' });
  expect(resolveQuality({ saved: 'auto', dev: true, detected: 'high' })).toEqual({ quality: 'high', mode: 'off' });
});
test('stepDown walks high → medium → low and stops', () => {
  expect(stepDown('high')).toBe('medium'); expect(stepDown('medium')).toBe('low'); expect(stepDown('low')).toBeNull();
});
