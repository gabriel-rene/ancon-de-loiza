import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RIDE_ORBIT, RideRig } from '../ancon/rideCamera';
import { onVesselPose } from '../ancon/vesselPose';
import { useStore } from '../state/store';
import { VIEW_POSES } from './views';

export function Cameras() {
  const ref = useRef<CameraControls>(null);
  const preset = useStore((s) => s.camera);
  const eraId = useStore((s) => s.eraId);
  const riding = useStore((s) => s.camera === 'ride' && s.showAncon);
  const first = useRef(true);

  // Fixed presets (and `ride` when the ferry is hidden with ?ancon=0).
  useEffect(() => {
    if (riding) return;
    const p = VIEW_POSES[preset];
    ref.current?.setLookAt(...p.pos, ...p.target, !first.current);
    first.current = false;
  }, [preset, riding]);

  // Ride: the vessel carries the camera. Runs right after <Ancon> updates the pose each frame, so the
  // camera never lags the hull. A drag orbits about a point over the deck and eases back ~1 s after release.
  useEffect(() => {
    const c = ref.current;
    if (!riding || !c) return;
    // Riding, only orbit and dolly: the rig re-derives the view from the vessel every frame, so a truck/pan
    // would be discarded (the view jumps back). Restored when the ride ends.
    const { ACTION } = CameraControlsImpl, saved = { right: c.mouseButtons.right, two: c.touches.two, three: c.touches.three };
    c.mouseButtons.right = ACTION.NONE; c.touches.two = ACTION.TOUCH_DOLLY; c.touches.three = ACTION.NONE;
    const rig = new RideRig(), eye = new THREE.Vector3(), tgt = new THREE.Vector3();
    let dragging = false, last = -1;
    const start = () => { dragging = true; }, end = () => { dragging = false; };
    c.addEventListener('controlstart', start); c.addEventListener('controlend', end);
    const off = onVesselPose((pose, ctx) => {
      const now = performance.now(), dt = last < 0 ? 0 : Math.min((now - last) / 1000, 0.1);
      last = now;
      rig.frame(pose, ctx, c.getPosition(eye, true), c.getTarget(tgt, true), dragging, dt);
      c.setLookAt(rig.eye.x, rig.eye.y, rig.eye.z, rig.pivot.x, rig.pivot.y, rig.pivot.z, false);
      c.update(0);
      first.current = false;
    });
    return () => {
      off(); c.removeEventListener('controlstart', start); c.removeEventListener('controlend', end);
      c.mouseButtons.right = saved.right; c.touches.two = saved.two; c.touches.three = saved.three;
    };
  }, [riding, eraId]);

  // Polar limits: ride-only (a little outside the rig's own, so the controls never re-clamp what the rig sets).
  const minPolar = riding ? RIDE_ORBIT.minPolar - 0.02 : 0;
  const maxPolar = riding ? RIDE_ORBIT.maxPolar + 0.02 : Math.PI * 0.495;
  return <CameraControls ref={ref} makeDefault minDistance={1} maxDistance={6000} minPolarAngle={minPolar} maxPolarAngle={maxPolar} />;
}
