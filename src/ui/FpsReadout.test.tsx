// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useStore } from '../state/store';
import { bucketShares, FpsReadout } from './FpsReadout';

afterEach(cleanup);
test('shows the tier and mode; nothing when ?fps is off', () => {
  act(() => useStore.setState({ fps: false }));
  const { container } = render(<FpsReadout />);
  expect(container.textContent).toBe('');
  act(() => useStore.setState({ fps: true, quality: 'medium', qualityMode: 'auto', lang: 'en' }));
  expect(screen.getByTestId('fps-readout').textContent).toContain('Medium');
  expect(screen.getByTestId('fps-readout').textContent).toContain('auto');
});
test('frame intervals sort into on-time, one-missed-vsync and slower shares', () => {
  expect(bucketShares([])).toEqual({ f60: 0, f30: 0, slow: 0 });
  expect(bucketShares([16.7, 16.6, 33.3, 50])).toEqual({ f60: 50, f30: 25, slow: 25 });
});
