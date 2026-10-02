import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { stepDown, type Quality, type QualityMode } from '../quality';
import { QualityGovernor as Governor } from '../state/qualityGovernor';
import { useStore } from '../state/store';
import { eraDip, requestQuality } from '../ui/dipController';

declare global {
  interface Window {
    /** Spec 7a §2.5: the live tier, who chose it, and how many auto steps ran. */
    __ANCON_QUALITY__?: { tier: Quality; mode: QualityMode; steps: number };
    /** Test hook: every frame counts as 1 / this many seconds. */
    __ANCON_FAKE_FPS__?: number;
  }
}

/** Mount inside <Canvas>: feeds the governor (spec 7a §2) and steps the tier down through the dip. */
export function QualityGovernor() {
  const quality = useStore((s) => s.quality);
  const mode = useStore((s) => s.qualityMode);
  const eraId = useStore((s) => s.eraId);
  const gov = useMemo(() => new Governor(quality), []);   // eslint-disable-line react-hooks/exhaustive-deps -- reset below
  const steps = useRef(0);
  useEffect(() => { gov.reset(quality); }, [gov, quality, eraId, mode]);
  useEffect(() => { window.__ANCON_QUALITY__ = { tier: quality, mode, steps: steps.current }; }, [quality, mode]);
  useFrame((_, dt) => {
    if (mode !== 'auto' || !window.__ANCON_READY__) return;
    const fake = window.__ANCON_FAKE_FPS__;
    const paused = document.hidden || eraDip.busy() || dt > 0.5;
    if (gov.tick(fake ? 1 / fake : dt, 1, paused) !== 'down') return;
    const next = stepDown(useStore.getState().quality);
    if (next && requestQuality(next)) { steps.current++; window.__ANCON_QUALITY__ = { tier: quality, mode, steps: steps.current }; }
  });
  return null;
}
