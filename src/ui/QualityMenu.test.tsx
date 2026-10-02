// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { useStore } from '../state/store';
import { __dipForTests } from './dipController';
import { QualityMenu } from './QualityMenu';

beforeEach(() => { __dipForTests.reset(); window.history.replaceState(null, '', '/?era=1935'); act(() => useStore.setState({ lang: 'en', quality: 'medium', qualityMode: 'auto' })); });
afterEach(() => { cleanup(); window.localStorage.clear(); });

test('label shows Auto and the tier; the name starts with Quality', () => {
  render(<QualityMenu />);
  const btn = screen.getByRole('button', { name: /^Quality/ });
  expect(btn.textContent).toBe('Auto · Medium');
  expect(btn.getAttribute('aria-haspopup')).toBe('menu');
  expect(btn.getAttribute('aria-expanded')).toBe('false');
});
test('opens a menu of four radio items with the current choice checked and focused', () => {
  render(<QualityMenu />);
  fireEvent.click(screen.getByRole('button', { name: /^Quality/ }));
  const items = screen.getAllByRole('menuitemradio');
  expect(items.map((i) => i.textContent)).toEqual(['Auto', 'High', 'Medium', 'Low']);
  expect(items[0].getAttribute('aria-checked')).toBe('true');
  expect(document.activeElement).toBe(items[0]);
});
test('arrow keys move, a pick closes the menu, Esc returns focus', () => {
  render(<QualityMenu />);
  const btn = screen.getByRole('button', { name: /^Quality/ });
  fireEvent.click(btn);
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
  expect(document.activeElement?.textContent).toBe('High');
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
  expect(document.activeElement?.textContent).toBe('Low');            // wraps
  fireEvent.click(document.activeElement!);
  expect(screen.queryByRole('menu')).toBeNull();
  expect(useStore.getState().qualityMode).toBe('hand');
  expect(btn.textContent).toBe('Medium');                             // still medium until the dip swaps
  fireEvent.click(btn);
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(document.activeElement).toBe(btn);
});
test('Spanish labels', () => {
  act(() => useStore.setState({ lang: 'es', qualityMode: 'hand', quality: 'low' }));
  render(<QualityMenu />);
  expect(screen.getByRole('button', { name: /^Calidad/ }).textContent).toBe('Baja');
});
test('focus moving out of the menu closes it; focus moving inside or to nowhere does not', () => {
  render(<><QualityMenu /><button type="button">After</button></>);
  fireEvent.click(screen.getByRole('button', { name: /^Quality/ }));
  const items = screen.getAllByRole('menuitemradio');
  fireEvent.blur(items[0], { relatedTarget: items[1] });
  expect(screen.queryByRole('menu')).not.toBeNull();
  fireEvent.blur(items[1], { relatedTarget: null });   // a tap on iOS Safari does not focus the next button
  expect(screen.queryByRole('menu')).not.toBeNull();
  fireEvent.blur(items[1], { relatedTarget: screen.getByRole('button', { name: 'After' }) });
  expect(screen.queryByRole('menu')).toBeNull();
});
test('Home and End jump to the first and last item', () => {
  render(<QualityMenu />);
  fireEvent.click(screen.getByRole('button', { name: /^Quality/ }));
  const items = screen.getAllByRole('menuitemradio');
  fireEvent.keyDown(items[0], { key: 'End' });
  expect(document.activeElement).toBe(items[3]);
  fireEvent.keyDown(items[3], { key: 'Home' });
  expect(document.activeElement).toBe(items[0]);
});
