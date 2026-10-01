// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useStore } from '../state/store';
import { SoundGate } from './SoundGate';

const audio = vi.hoisted(() => ({ open: false, unlocks: 0, subs: new Set<() => void>() }));
/** unlockAudio() does not open the gate by itself (like a real resume that is still pending); tests call openAudio(). */
vi.mock('./unlock', () => ({
  unlockAudio: () => { audio.unlocks++; },
  audioUnlocked: () => audio.open,
  onAudioUnlocked: (f: () => void) => { audio.subs.add(f); return () => { audio.subs.delete(f); }; },
}));
const openAudio = () => { audio.open = true; audio.subs.forEach((f) => f()); };
vi.mock('./Sound', () => ({ default: () => <div data-testid="sound" /> }));
afterEach(() => { cleanup(); audio.open = false; audio.unlocks = 0; audio.subs.clear(); act(() => useStore.getState().setSound(false)); });

test('off: renders nothing', () => {
  act(() => useStore.getState().setSound(false));
  expect(render(<SoundGate />).container.innerHTML).toBe('');
});
test.each([['keydown'], ['click'], ['pointerup'], ['touchend'], ['pointerdown']])('remembered on: a %s gesture unlocks and mounts the sound', async (type) => {
  act(() => useStore.getState().setSound(true));
  const r = render(<SoundGate />);
  expect(r.queryByTestId('sound')).toBeNull();
  await act(async () => { window.dispatchEvent(new Event(type)); });
  expect(audio.unlocks).toBe(1);
  expect(r.queryByTestId('sound')).toBeNull();   // context not running yet: still waiting
  await act(async () => { openAudio(); });
  expect(await r.findByTestId('sound')).toBeTruthy();
});
test('keeps listening until the context runs (a first touch that does not unlock re-arms)', async () => {
  act(() => useStore.getState().setSound(true));
  render(<SoundGate />);
  await act(async () => { window.dispatchEvent(new Event('pointerdown')); });
  await act(async () => { window.dispatchEvent(new Event('touchend')); });
  expect(audio.unlocks).toBe(2);
});
test('listeners are removed once unlocked', async () => {
  act(() => useStore.getState().setSound(true));
  render(<SoundGate />);
  await act(async () => { openAudio(); });
  await act(async () => { window.dispatchEvent(new Event('click')); window.dispatchEvent(new Event('keydown')); });
  expect(audio.unlocks).toBe(0);
});
test('already unlocked and on: mounts at once', async () => {
  audio.open = true;
  act(() => useStore.getState().setSound(true));
  const r = render(<SoundGate />);
  expect(await r.findByTestId('sound')).toBeTruthy();
});
