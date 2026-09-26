import { CameraControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { landmarkXZ } from '../data/landmarks';
import { useStore } from '../state/store';
import type { CameraPreset } from '../state/url';

const [ex, ez] = landmarkXZ('eastLanding');
const [wx, wz] = landmarkXZ('westLanding');
const [mx, mz] = landmarkXZ('mouth');

export const CAMERA_POSES: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  // Behind and above the (future) ferry mid-river, looking at the far landing — the reference framing.
  ride: { pos: [ex * 0.35, 4.2, ez * 0.35], target: [wx, 1.5, wz] },
  // Standing at the Loíza landing (eye height above the local bank elevation, ~1.7m here).
  bank: { pos: [ex + 10, 3.6, ez + 8], target: [wx - 40, 2.5, wz - 30] },
  aerial: { pos: [520, 380, 640], target: [0, 0, 0] },
  mouth: { pos: [mx - 180, 22, mz + 260], target: [mx, 0, mz] },
};

export function Cameras() {
  const ref = useRef<CameraControls>(null);
  const preset = useStore((s) => s.camera);
  const first = useRef(true);
  useEffect(() => {
    const p = CAMERA_POSES[preset];
    ref.current?.setLookAt(...p.pos, ...p.target, !first.current);
    first.current = false;
  }, [preset]);
  return <CameraControls ref={ref} makeDefault minDistance={1} maxDistance={6000} maxPolarAngle={Math.PI * 0.495} />;
}
