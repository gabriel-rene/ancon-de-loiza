// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useStore } from '../state/store';
import { FpsReadout } from './FpsReadout';

afterEach(cleanup);
test('shows the tier and mode; nothing when ?fps is off', () => {
  act(() => useStore.setState({ fps: false }));
  const { container } = render(<FpsReadout />);
  expect(container.textContent).toBe('');
  act(() => useStore.setState({ fps: true, quality: 'medium', qualityMode: 'auto', lang: 'en' }));
  expect(screen.getByTestId('fps-readout').textContent).toContain('Medium');
  expect(screen.getByTestId('fps-readout').textContent).toContain('auto');
});
