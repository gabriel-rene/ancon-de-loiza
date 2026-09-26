import { StatsGl } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { QUALITY } from './quality';
import { Cameras } from './scene/Cameras';
import { ReadySignal } from './scene/ReadySignal';
import { World } from './scene/World';
import { useStore } from './state/store';
import { DebugPanel } from './ui/DebugPanel';
import { TitleCard } from './ui/TitleCard';

export function App() {
  const q = QUALITY[useStore((s) => s.quality)];
  const debug = useStore((s) => s.debug);
  return (
    <>
      <Canvas
        dpr={q.dpr}
        shadows={q.shadowMap > 0 ? 'percentage' : false}
        camera={{ fov: 42, near: 0.5, far: 40000, position: [600, 450, 700] }}
        gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
      >
        <World />
        <Cameras />
        <ReadySignal />
        {debug && <StatsGl className="stats-gl" />}
      </Canvas>
      <DebugPanel />
      <TitleCard />
    </>
  );
}
