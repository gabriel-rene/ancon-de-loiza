// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useStore } from '../state/store';
import { SoundGate } from './SoundGate';

const audio = vi.hoisted(() => ({ open: false, unlocks: 0 }));
vi.mock('./unlock', () => ({ unlockAudio: () => { audio.unlocks++; }, audioUnlocked: () => audio.open }));
vi.mock('./Sound', () => ({ default: () => <div data-testid="sound" /> }));
afterEach(() => { cleanup(); audio.open = false; audio.unlocks = 0; });

test('off: renders nothing', () => {
  act(() => useStore.getState().setSound(false));
  expect(render(<SoundGate />).container.innerHTML).toBe('');
});
test('remembered on: waits for the first click or key, then mounts the sound', async () => {
  act(() => useStore.getState().setSound(true));
  const r = render(<SoundGate />);
  expect(r.queryByTestId('sound')).toBeNull();
  audio.open = true;
  await act(async () => { window.dispatchEvent(new Event('pointerdown')); });
  expect(await r.findByTestId('sound')).toBeTruthy();
  expect(audio.unlocks).toBe(1);
});
