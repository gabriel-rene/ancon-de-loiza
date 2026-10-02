// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useStore } from '../state/store';
import { __dipForTests } from './dipController';
import { Timeline } from './Timeline';

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));   // reduced motion: swaps are instant, easy to assert
  window.history.replaceState(null, '', '/?era=1975');
  act(() => { useStore.getState().setLang('en'); useStore.getState().setEra('1975'); });
  __dipForTests.reset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('8 buttons in a nav, same names as before, the current era marked', () => {
  render(<Timeline />);
  const nav = screen.getByRole('navigation', { name: 'Choose an era' });
  const btns = within(nav).getAllByRole('button');
  expect(btns).toHaveLength(8);
  expect(btns[5].getAttribute('aria-label')).toBe('1975 · 1960s–1970s · Weekend outings');
  expect(btns[5].getAttribute('aria-current')).toBe('true');
});
test('a click picks the era and updates the URL', () => {
  render(<Timeline />);
  fireEvent.click(screen.getByRole('button', { name: /1980–1986/ }));
  expect(useStore.getState().eraId).toBe('1984');
  expect(window.location.search).toContain('era=1984');
});
test('← → step one era; at the ends the key is left to the page', () => {
  render(<Timeline />);
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(useStore.getState().eraId).toBe('1959');
  act(() => useStore.getState().setEra('1986')); __dipForTests.reset();
  const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
  window.dispatchEvent(ev);
  expect(ev.defaultPrevented).toBe(false);
});
test('the knob and dots are hidden from screen readers', () => {
  const { container } = render(<Timeline />);
  expect(container.querySelector('.timeline__knob')!.getAttribute('aria-hidden')).toBe('true');
  expect(container.querySelector('.timeline__leaders')!.getAttribute('aria-hidden')).toBe('true');
});
test('← → do not change the era from the scene, the Facts panel or the Quality menu (spec 7b §2.2)', () => {
  render(<>
    <Timeline />
    <div data-scene="" tabIndex={0} data-testid="scene" />
    <section className="info-panel"><button type="button" data-testid="panel-btn">x</button></section>
    <div className="quality__menu"><button type="button" data-testid="menu-item">y</button></div>
  </>);
  for (const id of ['scene', 'panel-btn', 'menu-item']) {
    fireEvent.keyDown(screen.getByTestId(id), { key: 'ArrowRight' });
    expect(useStore.getState().eraId, id).toBe('1975');
  }
  fireEvent.keyDown(document.body, { key: 'ArrowRight' });
  expect(useStore.getState().eraId).toBe('1984');
});
