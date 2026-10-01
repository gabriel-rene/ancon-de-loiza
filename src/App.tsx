import { StatsGl } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { lazy, Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { QUALITY } from './quality';
import { Cameras } from './scene/Cameras';
import { FrameSampler, RendererInfo } from './scene/FrameSampler';
import { ReadySignal } from './scene/ReadySignal';
import { World } from './scene/World';
import { useStore } from './state/store';
import { Timeline } from './ui/Timeline';
import { DipFrameSignal, EraAnnouncer, EraDipOverlay } from './ui/EraDip';
import { SceneBoundary } from './ui/SceneBoundary';
import { TitleCard } from './ui/TitleCard';
import { Toolbar } from './ui/Toolbar';

const DebugPanel = lazy(() => import('./ui/DebugPanel').then((m) => ({ default: m.DebugPanel })));

export function App() {
  const q = QUALITY[useStore((s) => s.quality)];
  const debug = useStore((s) => s.debug);
  const perf = useStore((s) => s.perf);
  const lang = useStore((s) => s.lang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return (
    <>
      <SceneBoundary>
        <Canvas
          dpr={q.dpr}
          shadows={q.shadowMap > 0 ? 'percentage' : false}
          camera={{ fov: 42, near: 1.5, far: 40000, position: [600, 450, 700] }}
          gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
        >
          <World />
          <Cameras />
          <ReadySignal />
          <DipFrameSignal />
          {debug && <StatsGl className="stats-gl" />}
          {perf && <FrameSampler />}
          {(debug || perf) && <RendererInfo />}
        </Canvas>
        <EraDipOverlay />
        <EraAnnouncer />
      </SceneBoundary>
      {debug && <Suspense fallback={null}><DebugPanel /></Suspense>}
      <TitleCard />
      <Timeline />
      <Toolbar />
    </>
  );
}
