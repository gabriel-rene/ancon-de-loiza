import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { QUALITY } from './quality';
import { World } from './scene/World';
import { useStore } from './state/store';

export function App() {
  const q = QUALITY[useStore((s) => s.quality)];
  return (
    <Canvas
      dpr={q.dpr}
      shadows={q.shadowMap > 0}
      camera={{ fov: 42, near: 0.5, far: 40000, position: [600, 450, 700] }}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
    >
      <World />
      <OrbitControls target={[0, 0, 0]} />
    </Canvas>
  );
}
