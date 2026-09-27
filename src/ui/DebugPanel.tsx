import { Leva, monitor, useControls } from 'leva';
import { useEffect, useRef } from 'react';
import { ERA_IDS, type EraId } from '../data/eras';
import { useStore } from '../state/store';
import { CAMERA_PRESETS, type CameraPreset } from '../state/url';
import type { Quality } from '../quality';
import { vegStatsText } from '../vegetation/stats';
import { anconTiming } from '../ancon/stats';

export function DebugPanel() {
  const init = useStore.getState();

  const [, set] = useControls(() => ({
    era: { value: init.eraId, options: ERA_IDS, onChange: (v: EraId) => useStore.getState().setEra(v) },
    time: { value: init.timeOfDay, min: 0, max: 24, step: 0.05, onChange: (v: number) => useStore.getState().setTime(v) },
    camera: { value: init.camera, options: CAMERA_PRESETS, onChange: (v: CameraPreset) => useStore.getState().setCamera(v) },
    quality: { value: init.quality, options: ['high', 'medium', 'low'], onChange: (v: Quality) => useStore.getState().setQuality(v) },
    'veg near/far': monitor(vegStatsText, { graph: false, interval: 250 }),
    'crossing ×': { value: init.crossingSpeed, min: 0, max: 8, step: 0.25, onChange: (v: number) => useStore.getState().setCrossingSpeed(v) },
    'ancón ms': monitor(() => anconTiming.cpuMs.toFixed(3), { graph: false, interval: 250 }),
  }));

  // Keep the panel in sync when the store changes from outside leva (URL parsing, future UI,
  // programmatic setCamera/setEra/... calls) — without this the mounted controls go stale.
  const last = useRef({ eraId: init.eraId, timeOfDay: init.timeOfDay, camera: init.camera, quality: init.quality, crossingSpeed: init.crossingSpeed });
  useEffect(() => {
    return useStore.subscribe((s) => {
      const patch: Partial<{ era: EraId; time: number; camera: CameraPreset; quality: Quality; 'crossing ×': number }> = {};
      if (s.eraId !== last.current.eraId) patch.era = s.eraId;
      if (s.timeOfDay !== last.current.timeOfDay) patch.time = s.timeOfDay;
      if (s.camera !== last.current.camera) patch.camera = s.camera;
      if (s.quality !== last.current.quality) patch.quality = s.quality;
      if (s.crossingSpeed !== last.current.crossingSpeed) patch['crossing ×'] = s.crossingSpeed;
      if (Object.keys(patch).length) {
        last.current = { eraId: s.eraId, timeOfDay: s.timeOfDay, camera: s.camera, quality: s.quality, crossingSpeed: s.crossingSpeed };
        set(patch);
      }
    });
  }, [set]);

  return <Leva collapsed={false} />;
}
