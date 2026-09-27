import { expect, test, vi } from 'vitest';
import { emitVesselPose, onVesselPose, sharedVesselPose, useVesselPose } from './vesselPose';
import type { PoseContext } from './pose';

test('listeners get the shared pose; unsubscribe stops them', () => {
  const fn = vi.fn(), off = onVesselPose(fn), ctx = {} as PoseContext;
  emitVesselPose(ctx); expect(fn).toHaveBeenCalledWith(sharedVesselPose, ctx);
  off(); emitVesselPose(ctx); expect(fn).toHaveBeenCalledTimes(1);
  expect(useVesselPose()).toBe(sharedVesselPose);
});
