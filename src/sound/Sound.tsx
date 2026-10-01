import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { onVesselPose } from '../ancon/vesselPose';
import { useSun } from '../scene/useSun';
import { useEra, useStore } from '../state/store';
import { eraDip } from '../ui/dipController';
import { getEngine, setSoundActive } from './engine';
import type { MixInput } from './mix';
import { SoundRig } from './rig';

/** Spec 6b §4.5: listener on the camera, every voice placed in the scene, levels and one-shots each frame. */
export default function Sound() {
  const camera = useThree((s) => s.camera);
  const eng = useMemo(getEngine, []);
  const rig = useMemo(() => new SoundRig(eng), [eng]);
  const era = useEra(), sun = useSun(), view = useStore((s) => s.camera);
  const mix = useRef<MixInput>({ view, sunElevation: sun.elevation, dip: 0, bridgeOpen: false });
  mix.current.view = view; mix.current.sunElevation = sun.elevation; mix.current.bridgeOpen = era.infrastructure.bridge.value === 'open';
  useEffect(() => {
    camera.add(eng.listener);
    setSoundActive(true); rig.start();
    window.__ANCON_SOUND__ = rig.stats;
    return () => { rig.stop(); camera.remove(eng.listener); setSoundActive(false); delete window.__ANCON_SOUND__; };
  }, [camera, eng, rig]);
  useEffect(() => onVesselPose((pose, ctx) => rig.ferry(pose, ctx)), [rig]);
  useFrame((_, dt) => {
    mix.current.dip = eraDip.opacity();
    rig.update(dt, mix.current, camera.position);
  });
  return <primitive object={rig.group} />;
}
