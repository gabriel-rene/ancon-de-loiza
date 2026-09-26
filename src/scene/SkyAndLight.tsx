import { Environment, Sky } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Sun } from './useSun';

const FOCUS = new THREE.Vector3(0, 0, 0);

export function SkyAndLight({ sun, shadowMap }: { sun: Sun; shadowMap: number }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  const skyPos = sun.dir.clone().multiplyScalar(10000);
  const { atm } = sun;

  useEffect(() => { scene.environmentIntensity = atm.envIntensity; }, [scene, atm.envIntensity]);
  useEffect(() => {
    const l = light.current!;
    l.position.copy(FOCUS).addScaledVector(sun.dir, 1500);
    l.target.position.copy(FOCUS);
    l.target.updateMatrixWorld();
  }, [sun.dir]);

  const skyProps = { distance: 30000, sunPosition: skyPos, turbidity: atm.turbidity, rayleigh: atm.rayleigh, mieCoefficient: 0.006, mieDirectionalG: 0.86 };
  const envKey = `${sun.dir.x.toFixed(2)}${sun.dir.y.toFixed(2)}${sun.dir.z.toFixed(2)}`;

  return (
    <>
      <Sky {...skyProps} />
      <Environment key={envKey} resolution={128} frames={1}>
        <Sky {...skyProps} />
      </Environment>
      <directionalLight
        ref={light}
        color={new THREE.Color(...atm.sunColor)}
        intensity={atm.sunIntensity}
        castShadow={shadowMap > 0}
        shadow-mapSize={[shadowMap || 1, shadowMap || 1]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
        shadow-camera-left={-350} shadow-camera-right={350}
        shadow-camera-top={350} shadow-camera-bottom={-350}
        shadow-camera-near={10} shadow-camera-far={4000}
      />
    </>
  );
}
