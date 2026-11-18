// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { useStore } from '../state/store';
import { Brand } from './Brand';
import { SceneFrame } from './SceneFrame';
import { TitleCard } from './TitleCard';

beforeEach(() => act(() => { useStore.getState().setLang('en'); useStore.getState().setEra('1975'); }));
afterEach(cleanup);

test('a focusable group named for the scene, the era and the keys; follows era and language', () => {
  render(<SceneFrame><canvas /></SceneFrame>);
  const g = screen.getByRole('group');
  expect(g.getAttribute('aria-label')).toBe('3D view of the ferry, 1975. Arrow keys look around.');
  expect(g.tabIndex).toBe(0);
  expect(g.hasAttribute('data-scene')).toBe(true);
  act(() => { useStore.getState().setEra('1840'); useStore.getState().setLang('es'); });
  expect(g.getAttribute('aria-label')).toBe('Vista 3D del ancón, 1840. Flechas para mirar alrededor.');
});

test('a mouse press on the frame does not focus it, so a click keeps the page era keys', () => {
  render(<SceneFrame><canvas /></SceneFrame>);
  const g = screen.getByRole('group');
  const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  act(() => { g.dispatchEvent(ev); });
  expect(ev.defaultPrevented).toBe(true);
});

test('the sign is the page h1; the era title is the h2 under it, with the year once for screen readers', () => {
  render(<><Brand /><TitleCard /></>);
  const h1 = screen.getByRole('heading', { level: 1 });
  expect(h1.querySelector('img')!.getAttribute('alt')).toBe('El Ancón de Loíza');
  const h2 = screen.getByRole('heading', { level: 2 });
  expect(h2.textContent).toBe('19751975 · Weekend outings1960s–1970s');
  expect(h2.querySelector('.title-card__year')!.getAttribute('aria-hidden')).toBe('true');
});
test('an era whose span is its own year does not repeat it', () => {
  act(() => useStore.getState().setEra('1986'));
  render(<TitleCard />);
  expect(document.querySelector('.title-card__span')).toBeNull();
});

test('arrow keys on the scene send one look step each and are consumed', () => {
  render(<SceneFrame><canvas /></SceneFrame>);
  const g = screen.getByRole('group');
  const seq = useStore.getState().lookSeq;
  const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
  act(() => { g.dispatchEvent(ev); });
  expect(useStore.getState().lookSeq).toBe(seq + 1);
  expect(useStore.getState().lookStep!.dAz).toBeLessThan(0);
  expect(ev.defaultPrevented).toBe(true);
  fireEvent.keyDown(g, { key: 'a' });
  expect(useStore.getState().lookSeq).toBe(seq + 1);
});
