// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useStore } from '../state/store';
import { SceneBoundary } from './SceneBoundary';
import { Toolbar } from './Toolbar';

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
test('without WebGL the Facts panel opens by itself, once (spec 7b §2.5)', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  act(() => useStore.setState({ lang: 'en', sceneFailed: false }));
  render(<><SceneBoundary><Boom /></SceneBoundary><Toolbar /></>);
  expect(useStore.getState().sceneFailed).toBe(true);
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
