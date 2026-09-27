// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useStore } from '../state/store';
import { SceneBoundary } from './SceneBoundary';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Boom(): never { throw new Error('WebGL context could not be created'); }

test('shows the no-WebGL message instead of the scene, and siblings keep rendering', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  act(() => useStore.getState().setLang('en'));
  render(<><SceneBoundary><Boom /></SceneBoundary><button type="button">Facts</button></>);
  expect(screen.getByRole('status').textContent).toContain('cannot show the 3D scene');
  expect(screen.getByRole('button', { name: 'Facts' })).toBeTruthy();
});
test('renders its children when nothing throws', () => {
  render(<SceneBoundary><p>scene</p></SceneBoundary>);
  expect(screen.getByText('scene')).toBeTruthy();
});
