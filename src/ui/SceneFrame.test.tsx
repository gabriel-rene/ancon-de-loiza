// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { useStore } from '../state/store';
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

test('the title card is the page h1', () => {
  render(<TitleCard />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('El Ancón de Loíza');
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
