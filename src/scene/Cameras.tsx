import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RideRig } from '../ancon/rideCamera';
import { onVesselPose } from '../ancon/vesselPose';
import { useStore } from '../state/store';
import { prefersReducedMotion } from '../ui/motion';
import { LOOK_STEP } from './lookKeys';
import { controlLimits, DRAG_SMOOTH_TIME, frontOf, glideK, isOffFront, VIEW_POSES, VIEW_SMOOTH_TIME } from './views';

const _sph = new THREE.Spherical();

export function Cameras() {
  const ref = useRef<CameraControls>(null);
  const preset = useStore((s) => s.camera);
  const eraId = useStore((s) => s.eraId);
  const riding = useStore((s) => s.camera === 'ride' && s.showAncon);
  const recenterSeq = useStore((s) => s.recenterSeq);
  const lookSeq = useStore((s) => s.lookSeq);
  const first = useRef(true);
  /** The ride camera's state; kept across era changes (the angle survives the dip), dropped when leaving Ride. */
  const rig = useRef<RideRig | null>(null);
  /** Ride entry glide state; survives era changes so a mid-glide era change continues the glide. */
  const glideRef = useRef<{ t0: number; fromEye: THREE.Vector3; fromTgt: THREE.Vector3; settled: boolean } | null>(null);
  const lim = controlLimits(preset, riding);

  // Input mapping (spec 6a §4.3): public views turn and zoom only; Shore zooms the lens and "grabs the world".
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const { ACTION } = CameraControlsImpl, mb = c.mouseButtons, t = c.touches;
    const saved = { middle: mb.middle, right: mb.right, wheel: mb.wheel, two: t.two, three: t.three, az: c.azimuthRotateSpeed, pol: c.polarRotateSpeed };
    if (!lim.pan) {
      const zoom = lim.lookInPlace;
      mb.right = ACTION.NONE; t.three = ACTION.NONE;
      mb.middle = zoom ? ACTION.ZOOM : ACTION.DOLLY; mb.wheel = zoom ? ACTION.ZOOM : ACTION.DOLLY;
      t.two = zoom ? ACTION.TOUCH_ZOOM : ACTION.TOUCH_DOLLY;
    }
    c.azimuthRotateSpeed = lim.rotateSpeed; c.polarRotateSpeed = lim.rotateSpeed;
    return () => {
      mb.middle = saved.middle; mb.right = saved.right; mb.wheel = saved.wheel; t.two = saved.two; t.three = saved.three;
      c.azimuthRotateSpeed = saved.az; c.polarRotateSpeed = saved.pol;
    };
  }, [lim.pan, lim.lookInPlace, lim.rotateSpeed]);

  // Fixed views (and Ride when the ferry is hidden with ?ancon=0): glide to the pose; Recenter re-runs this.
  useEffect(() => {
    const c = ref.current;
    if (riding || !c) return;
    const p = VIEW_POSES[preset], smooth = !first.current && !prefersReducedMotion();
    void c.setLookAt(...p.pos, ...p.target, smooth);
    void c.zoomTo(1, smooth);
    first.current = false;
    useStore.getState().setOffFront(false);
  }, [preset, riding, recenterSeq]);

  // Fixed views: report whether the visitor has turned away from the front (shows Recenter).
  useEffect(() => {
    const c = ref.current;
    if (riding || !c) return;
    const f = frontOf(VIEW_POSES[preset]);
    const check = () => useStore.getState().setOffFront(
      isOffFront(f, c.azimuthAngle, c.polarAngle, c.distance, (c.camera as THREE.PerspectiveCamera).zoom));
    c.addEventListener('sleep', check); c.addEventListener('controlend', check);
    return () => { c.removeEventListener('sleep', check); c.removeEventListener('controlend', check); };
  }, [preset, riding]);

  // Leaving Ride drops the rig: coming back starts at the front framing.
  useEffect(() => { if (!riding) rig.current = null; }, [riding]);

  // Ride: the vessel carries the camera; runs right after <Ancon> updates the pose each frame, so the camera
  // never lags the hull. Entering Ride from another view glides in over VIEW_GLIDE_S; an era change does not move it.
  useEffect(() => {
    const c = ref.current;
    if (!riding || !c) return;
    const entering = rig.current === null;
    if (entering) {
      rig.current = new RideRig();
      const glide = !first.current && !prefersReducedMotion();
      // Shore's lens zoom must not carry into Ride (camera-controls never re-clamps zoom on update).
      void c.zoomTo(1, glide);
      glideRef.current = { t0: performance.now(), fromEye: c.getPosition(new THREE.Vector3()), fromTgt: c.getTarget(new THREE.Vector3()), settled: !glide };
    }
    const r = rig.current!, g = glideRef.current!;
    const eye = new THREE.Vector3(), tgt = new THREE.Vector3();
    // The glide state lives in a ref: an era change mid-glide re-runs this effect and continues the same glide.
    // While gliding the rig gets no input (the blended camera is not a user orbit); the first frame of every run neither.
    let first1 = true, dragging = false, last = -1, off = r.offFront;
    useStore.getState().setOffFront(off);
    const start = () => { dragging = true; }, end = () => { dragging = false; };
    c.addEventListener('controlstart', start); c.addEventListener('controlend', end);
    const offPose = onVesselPose((pose, ctx) => {
      const now = performance.now(), dt = last < 0 ? 0 : Math.min((now - last) / 1000, 0.1);
      last = now;
      const k = g.settled ? 1 : glideK((now - g.t0) / 1000), live = g.settled && !first1;
      first1 = false;
      r.frame(pose, ctx, live ? c.getPosition(eye, true) : null, live ? c.getTarget(tgt, true) : null, dragging, dt);
      eye.lerpVectors(g.fromEye, r.eye, k); tgt.lerpVectors(g.fromTgt, r.pivot, k);
      if (g.settled) { eye.copy(r.eye); tgt.copy(r.pivot); }
      void c.setLookAt(eye.x, eye.y, eye.z, tgt.x, tgt.y, tgt.z, false);
      c.update(0);
      if (k >= 1) g.settled = true;
      first.current = false;
      if (r.offFront !== off) { off = r.offFront; useStore.getState().setOffFront(off); }
    });
    return () => { offPose(); c.removeEventListener('controlstart', start); c.removeEventListener('controlend', end); };
  }, [riding, eraId]);

  // Ride recenter (the fixed views recenter through the pose effect above).
  useEffect(() => {
    if (recenterSeq > 0 && riding) rig.current?.recenter(prefersReducedMotion());
  }, [recenterSeq, riding]);

  // Keyboard look (spec 7b §2.1): one step on the controls, inside the same limits as a drag. In Ride the rig
  // reads it as input (its per-frame check), like a drag; the fixed views report off-front on 'sleep'.
  useEffect(() => {
    const c = ref.current, s = useStore.getState().lookStep;
    if (!c || !s || lookSeq === 0) return;
    const smooth = !riding && !prefersReducedMotion();
    if (s.dAz || s.dPol) void c.rotate(s.dAz, s.dPol, smooth);
    if (s.dZoom) {
      // Both build on the transition's END value, so quick or held presses add up (c.distance and camera.zoom are mid-glide).
      if (lim.lookInPlace) void c.zoom(LOOK_STEP.zoom * s.dZoom, smooth);
      else void c.dollyTo(c.getSpherical(_sph, true).radius * (1 - LOOK_STEP.zoom * s.dZoom), smooth);
    }
  }, [lookSeq]);   // eslint-disable-line react-hooks/exhaustive-deps -- one step per bump

  const reduced = prefersReducedMotion();
  return (
    <CameraControls ref={ref} makeDefault minDistance={lim.minDistance} maxDistance={lim.maxDistance}
      minPolarAngle={lim.minPolar} maxPolarAngle={lim.maxPolar} minZoom={lim.minZoom} maxZoom={lim.maxZoom}
      smoothTime={reduced ? 0 : VIEW_SMOOTH_TIME} draggingSmoothTime={reduced ? 0 : DRAG_SMOOTH_TIME} />
  );
}
