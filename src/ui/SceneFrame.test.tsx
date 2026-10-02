// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
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

test('the title card is the page h1', () => {
  render(<TitleCard />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('El Ancón de Loíza');
});
