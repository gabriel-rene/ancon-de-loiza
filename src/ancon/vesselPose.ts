import { createVesselPose, type PoseContext, type VesselPose } from './pose';

/** The ferry's pose this frame, updated in place by <Ancon> before any listener runs. */
export const sharedVesselPose: VesselPose = createVesselPose();
export type PoseListener = (pose: VesselPose, ctx: PoseContext) => void;
const listeners = new Set<PoseListener>();

/**
 * Future-release hook (spec §13): a first-person camera or a drivable car reads the vessel pose
 * without touching the vessel code. Returns the shared mutable pose (no re-render per frame) —
 * read it inside useFrame, or subscribe with onVesselPose to run right after it updates.
 */
export const useVesselPose = (): Readonly<VesselPose> => sharedVesselPose;
export function onVesselPose(fn: PoseListener): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function emitVesselPose(ctx: PoseContext) { listeners.forEach((fn) => fn(sharedVesselPose, ctx)); }
