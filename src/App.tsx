import { Canvas } from '@react-three/fiber';

export function App() {
  return (
    <Canvas camera={{ fov: 42, near: 0.5, far: 40000, position: [0, 50, 200] }}>
      <color attach="background" args={['#9fb3c2']} />
    </Canvas>
  );
}
