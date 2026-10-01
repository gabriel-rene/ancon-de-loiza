// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { FACTS } from '../data/facts';
import { useStore } from '../state/store';
import { Toolbar } from './Toolbar';

beforeEach(() => {
  window.history.replaceState(null, '', '/?era=1935');
  act(() => { useStore.getState().setLang('en'); useStore.getState().setEra('1935'); });
});
afterEach(cleanup);

test('the panel starts closed and the Facts button opens it on the current era', () => {
  render(<Toolbar />);
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Facts' }));
  const panel = screen.getByRole('dialog');
  expect(within(panel).getByRole('heading').textContent).toContain('The ropes');
  expect(within(panel).getAllByRole('listitem')).toHaveLength(FACTS['1935'].length);
  expect(document.activeElement).toBe(within(panel).getByRole('heading'));
  for (const a of within(panel).getAllByRole('link')) {
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noreferrer');
  }
});
test('Esc closes the panel and focus returns to the Facts button', () => {
  render(<Toolbar />);
  const btn = screen.getByRole('button', { name: 'Facts' });
  fireEvent.click(btn);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(btn);
});
test('the close button and a second press of Facts both close it', () => {
  render(<Toolbar />);
  const btn = screen.getByRole('button', { name: 'Facts' });
  fireEvent.click(btn);
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(btn);
  fireEvent.click(btn);
  expect(screen.queryByRole('dialog')).toBeNull();
});
test('the facts follow the era while the panel is open', () => {
  render(<Toolbar />);
  fireEvent.click(screen.getByRole('button', { name: 'Facts' }));
  act(() => useStore.getState().setEra('1984'));
  const panel = screen.getByRole('dialog');
  expect(within(panel).getByRole('heading').textContent).toContain('The steel barge');
  expect(within(panel).getAllByRole('listitem')).toHaveLength(FACTS['1984'].length);
});
test('the language switch changes the text, the pressed button and the URL', () => {
  render(<Toolbar />);
  fireEvent.click(screen.getByRole('button', { name: 'Español' }));
  expect(useStore.getState().lang).toBe('es');
  expect(window.location.search).toContain('lang=es');
  expect(window.location.search).toContain('era=1935');
  expect(screen.getByRole('button', { name: 'Español' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: 'Datos' }));
  expect(within(screen.getByRole('dialog')).getByRole('heading').textContent).toContain('Las sogas');
});
test('the Sound button starts off, toggles aria-pressed and stores the choice', () => {
  act(() => useStore.getState().setSound(false));
  render(<Toolbar />);
  const btn = screen.getByRole('button', { name: 'Sound' });
  expect(btn.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(btn);
  expect(btn.getAttribute('aria-pressed')).toBe('true');
  expect(useStore.getState().soundOn).toBe(true);
  expect(window.localStorage.getItem('ancon.sound')).toBe('1');
  fireEvent.click(btn);
  expect(useStore.getState().soundOn).toBe(false);
  expect(window.localStorage.getItem('ancon.sound')).toBe('0');
});
test('the Sound button is labelled in Spanish', () => {
  act(() => useStore.getState().setLang('es'));
  render(<Toolbar />);
  expect(screen.getByRole('button', { name: 'Sonido' })).toBeTruthy();
});
