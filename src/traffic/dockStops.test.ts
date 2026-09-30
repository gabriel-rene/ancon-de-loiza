import { expect, test } from 'vitest';
import { ERAS } from '../data/eras';
import { DOCK_STOPS } from './dockStops';
import { eraTimings } from './schedule';

test('the shot list’s dock stops match eraTimings', () => {
  for (const e of ERAS) {
    const T = eraTimings(e);
    expect(DOCK_STOPS[e.id], e.id).toEqual({ load: T.load, unload: T.unload });
  }
});
