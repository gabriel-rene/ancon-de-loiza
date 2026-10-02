// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import { ERA_IDS } from '../data/eras';
import { detectLang } from '../i18n/text';
import { DEFAULT_ERA } from '../state/store';
import { dismissLoadCard, setLoadStep } from './loadCard';

const html = readFileSync('index.html', 'utf8');
const boot = html.slice(html.indexOf('/* load-card:boot */'), html.indexOf('/* load-card:end */'));
const anconLoadCard = new Function(`${boot}; return anconLoadCard;`)() as (s: string, n?: string) => { year: string; lang: string };

test('the inline boot script agrees with the app on era and language (spec 7a §4)', () => {
  for (const id of ERA_IDS) expect(anconLoadCard(`?era=${id}`, 'en-US').year).toBe(id);
  expect(anconLoadCard('?era=1999', 'en').year).toBe(DEFAULT_ERA);
  expect(anconLoadCard('', 'en').year).toBe(DEFAULT_ERA);
  for (const n of ['en-US', 'EN', 'es-PR', 'fr', undefined]) expect(anconLoadCard('', n).lang).toBe(detectLang(n));
  expect(anconLoadCard('?lang=en', 'es').lang).toBe('en');
  expect(anconLoadCard('?lang=xx', 'es').lang).toBe('es');
});
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; delete document.body.dataset.load; });
test('steps go on body[data-load]; dismiss fades then removes, or removes at once with reduced motion', () => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="load-card"></div>';
  setLoadStep('scene');
  expect(document.body.dataset.load).toBe('scene');
  dismissLoadCard(false);
  expect(document.getElementById('load-card')?.classList.contains('load-card--out')).toBe(true);
  vi.advanceTimersByTime(700);
  expect(document.getElementById('load-card')).toBeNull();
  document.body.innerHTML = '<div id="load-card"></div>';
  dismissLoadCard(true);
  expect(document.getElementById('load-card')).toBeNull();
  expect(() => dismissLoadCard(true)).not.toThrow();
});
