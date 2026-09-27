import { CameraControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { carryCamera, clampAboveGround, rideView, rideYaw } from '../ancon/rideCamera';
import { onVesselPose } from '../ancon/vesselPose';
import { landmarkXZ } from '../data/landmarks';
import { useStore } from '../state/store';
import type { CameraPreset } from '../state/url';

const [ex, ez] = landmarkXZ('eastLanding');
const [wx, wz] = landmarkXZ('westLanding');
const [mx, mz] = landmarkXZ('mouth');

export const CAMERA_POSES: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  // Fallback for `ride` when the ferry is hidden (?ancon=0): behind and above mid-river, looking at the far landing.
  ride: { pos: [ex * 0.35, 4.2, ez * 0.35], target: [wx, 1.5, wz] },
  // Standing at the Loíza landing (eye height above the local bank elevation, ~1.7m here).
  bank: { pos: [ex + 10, 3.6, ez + 8], target: [wx - 40, 2.5, wz - 30] },
  aerial: { pos: [520, 380, 640], target: [0, 0, 0] },
  mouth: { pos: [mx - 180, 22, mz + 260], target: [mx, 0, mz] },
};

export function Cameras() {
  const ref = useRef<CameraControls>(null);
  const preset = useStore((s) => s.camera);
  const eraId = useStore((s) => s.eraId);
  const riding = useStore((s) => s.camera === 'ride' && s.showAncon);
  const first = useRef(true);

  // Fixed presets (and `ride` when the ferry is hidden with ?ancon=0).
  useEffect(() => {
    if (riding) return;
    const p = CAMERA_POSES[preset];
    ref.current?.setLookAt(...p.pos, ...p.target, !first.current);
    first.current = false;
  }, [preset, riding]);

  // Ride: the vessel carries the camera. Runs right after <Ancon> updates the pose each frame, so the
  // camera never lags the hull; a user orbit/dolly is kept (carried rigidly with the deck).
  useEffect(() => {
    if (!riding) return;
    const prev = new THREE.Matrix4(), pos = new THREE.Vector3(), tgt = new THREE.Vector3();
    let init = true, lastYaw = 0;
    return onVesselPose((pose, ctx) => {
      const c = ref.current;
      if (!c) return;
      const yaw = rideYaw(pose.clock, ctx.spec.moored);
      if (init) { rideView(pose, ctx.layout, yaw, pos, tgt, ctx.groundAt); init = false; }
      else {
        c.getPosition(pos); c.getTarget(tgt);
        carryCamera(prev, pose.matrix, yaw - lastYaw, pos, tgt);
        if (ctx.groundAt) clampAboveGround(pos, ctx.groundAt);
      }
      c.setLookAt(pos.x, pos.y, pos.z, tgt.x, tgt.y, tgt.z, false);
      c.update(0);
      prev.copy(pose.matrix); lastYaw = yaw;
      first.current = false;
    });
  }, [riding, eraId]);

  return <CameraControls ref={ref} makeDefault minDistance={1} maxDistance={6000} maxPolarAngle={Math.PI * 0.495} />;
}
