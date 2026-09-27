import { StatsGl } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { lazy, Suspense } from 'react';
import * as THREE from 'three';
import { QUALITY } from './quality';
import { Cameras } from './scene/Cameras';
import { ReadySignal } from './scene/ReadySignal';
import { World } from './scene/World';
import { useStore } from './state/store';
import { DecadePicker } from './ui/DecadePicker';
import { TitleCard } from './ui/TitleCard';

const DebugPanel = lazy(() => import('./ui/DebugPanel').then((m) => ({ default: m.DebugPanel })));

export function App() {
  const q = QUALITY[useStore((s) => s.quality)];
  const debug = useStore((s) => s.debug);
  return (
    <>
      <Canvas
        dpr={q.dpr}
        shadows={q.shadowMap > 0 ? 'percentage' : false}
        camera={{ fov: 42, near: 1.5, far: 40000, position: [600, 450, 700] }}
        gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
      >
        <World />
        <Cameras />
        <ReadySignal />
        {debug && <StatsGl className="stats-gl" />}
      </Canvas>
      {debug && <Suspense fallback={null}><DebugPanel /></Suspense>}
      <TitleCard />
      <DecadePicker />
    </>
  );
}
