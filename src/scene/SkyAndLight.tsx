import { Environment } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import type { Atmosphere } from '../geo/atmosphere';
import { patchSkyShader } from './skyShader';
import type { Sun } from './useSun';

const FOCUS = new THREE.Vector3(0, 0, 0);

/**
 * three's (linear, HDR) Preetham sky with an output gain and a hue-preserving shoulder.
 * The raw model is several times brighter than the sunlit ground and its low-sun Mie
 * halo spans a third of the frame at values the tonemapper clips to white. The gain
 * balances sky vs land; the luminance shoulder turns the halo into a golden glow instead
 * of a white blotch while the sun disc (kept out of the shoulder) still blooms.
 */
function SkyDome({ dir, atm }: { dir: THREE.Vector3; atm: Atmosphere }) {
  const sky = useMemo(() => {
    const s = new Sky();
    const m = s.material as THREE.ShaderMaterial;
    m.uniforms.uGain = { value: 1 };
    m.uniforms.uShoulder = { value: 2.5 };
    m.fragmentShader = patchSkyShader(m.fragmentShader);
    s.scale.setScalar(30000);
    return s;
  }, []);
  useEffect(() => () => { sky.geometry.dispose(); (sky.material as THREE.Material).dispose(); }, [sky]);
  const u = (sky.material as THREE.ShaderMaterial).uniforms;
  u.sunPosition.value.copy(dir).multiplyScalar(10000);
  u.turbidity.value = atm.turbidity;
  u.rayleigh.value = atm.rayleigh;
  u.mieCoefficient.value = atm.mie;
  u.mieDirectionalG.value = atm.mieG;
  u.cloudCoverage.value = atm.cloudCoverage;
  u.uGain.value = atm.skyGain;
  return <primitive object={sky} />;
}

export function SkyAndLight({ sun, shadowMap }: { sun: Sun; shadowMap: number }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  const { atm } = sun;

  useEffect(() => { scene.environmentIntensity = atm.envIntensity; }, [scene, atm.envIntensity]);
  useEffect(() => {
    const l = light.current!;
    l.position.copy(FOCUS).addScaledVector(sun.dir, 1500);
    l.target.position.copy(FOCUS);
    l.target.updateMatrixWorld();
  }, [sun.dir]);

  const envKey = `${sun.dir.x.toFixed(2)}${sun.dir.y.toFixed(2)}${sun.dir.z.toFixed(2)}`;

  return (
    <>
      <SkyDome dir={sun.dir} atm={atm} />
      <Environment key={envKey} resolution={128} frames={1}>
        <SkyDome dir={sun.dir} atm={atm} />
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
