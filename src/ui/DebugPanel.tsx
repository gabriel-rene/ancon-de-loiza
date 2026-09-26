import { Leva, useControls } from 'leva';
import { ERA_IDS, type EraId } from '../data/eras';
import { useStore } from '../state/store';
import { CAMERA_PRESETS, type CameraPreset } from '../state/url';
import type { Quality } from '../quality';

export function DebugPanel() {
  const s = useStore();
  useControls({
    era: { value: s.eraId, options: ERA_IDS, onChange: (v: EraId) => useStore.getState().setEra(v) },
    time: { value: s.timeOfDay, min: 5, max: 19.5, step: 0.05, onChange: (v: number) => useStore.getState().setTime(v) },
    camera: { value: s.camera, options: CAMERA_PRESETS, onChange: (v: CameraPreset) => useStore.getState().setCamera(v) },
    quality: { value: s.quality, options: ['high', 'medium', 'low'], onChange: (v: Quality) => useStore.getState().setQuality(v) },
  });
  return <Leva hidden={!s.debug} collapsed={false} />;
}
