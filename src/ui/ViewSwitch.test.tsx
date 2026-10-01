// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { useStore } from '../state/store';
import { ViewSwitch } from './ViewSwitch';

beforeEach(() => {
  window.history.replaceState(null, '', '/?era=1935&cam=ride');
  act(() => { useStore.getState().setLang('en'); useStore.getState().setCamera('ride'); useStore.getState().setOffFront(false); });
});
afterEach(cleanup);

test('three buttons, the current view pressed; a click switches view and URL', () => {
  render(<ViewSwitch />);
  const g = screen.getByRole('group', { name: 'View' });
  expect(within(g).getAllByRole('button').map((b) => b.textContent)).toEqual(['Ride', 'Shore', 'Sky']);
  expect(within(g).getByRole('button', { name: 'Ride' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(within(g).getByRole('button', { name: 'Sky' }));
  expect(useStore.getState().camera).toBe('sky');
  expect(window.location.search).toBe('?era=1935&cam=sky');
  expect(within(g).getByRole('button', { name: 'Sky' }).getAttribute('aria-pressed')).toBe('true');
});
test('keys 1/2/3 pick views; ignored while typing or with a modifier', () => {
  render(<ViewSwitch />);
  fireEvent.keyDown(window, { key: '2' });
  expect(useStore.getState().camera).toBe('shore');
  fireEvent.keyDown(window, { key: '3', ctrlKey: true });
  expect(useStore.getState().camera).toBe('shore');
  const input = document.createElement('input'); document.body.appendChild(input);
  fireEvent.keyDown(input, { key: '3' });
  expect(useStore.getState().camera).toBe('shore');
  input.remove();
  fireEvent.keyDown(window, { key: '1' });
  expect(useStore.getState().camera).toBe('ride');
});
test('Recenter shows only when off-front; the button and R both recenter', () => {
  render(<ViewSwitch />);
  expect(screen.queryByRole('button', { name: 'Recenter' })).toBeNull();
  act(() => useStore.getState().setOffFront(true));
  const seq = useStore.getState().recenterSeq;
  fireEvent.click(screen.getByRole('button', { name: 'Recenter' }));
  expect(useStore.getState().recenterSeq).toBe(seq + 1);
  fireEvent.keyDown(window, { key: 'r' });
  expect(useStore.getState().recenterSeq).toBe(seq + 2);
});
test('Spanish labels', () => {
  act(() => useStore.getState().setLang('es'));
  render(<ViewSwitch />);
  const g = screen.getByRole('group', { name: 'Vista' });
  expect(within(g).getAllByRole('button').map((b) => b.textContent)).toEqual(['Paseo', 'Orilla', 'Cielo']);
});
