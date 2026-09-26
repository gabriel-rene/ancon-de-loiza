import { Environment } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import type { Atmosphere } from '../geo/atmosphere';
import { shadowFocus, type ShadowFocusResult } from './shadowFocus';
import { patchSkyShader } from './skyShader';
import type { Sun } from './useSun';

// Module-level temporaries reused every frame in the shadow-follow useFrame below — no
// per-frame allocation.
const tmpDir = new THREE.Vector3();
const camPosArr: [number, number, number] = [0, 0, 0];
const camDirArr: [number, number, number] = [0, 0, 0];
const sunDirArr: [number, number, number] = [0, 0, 0];
const focusOut: ShadowFocusResult = { target: [0, 0, 0], position: [0, 0, 0] };

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
    s.renderOrder = -1; // draw first regardless of object id (it writes no depth)
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

export function SkyAndLight({ sun, shadowMap, shadowHalf }: { sun: Sun; shadowMap: number; shadowHalf: number }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const { atm } = sun;

  useEffect(() => { scene.environmentIntensity = atm.envIntensity; }, [scene, atm.envIntensity]);

  // The shadow camera's frustum bounds are set imperatively (rather than left to the
  // shadow-camera-* JSX props) because changing them requires an explicit
  // updateProjectionMatrix() call — R3F's prop diffing sets the fields but does not call it,
  // so without this effect the frustum goes stale after a quality change (shadowHalf/shadowMap).
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    const cam = l.shadow.camera;
    cam.left = -shadowHalf; cam.right = shadowHalf;
    cam.top = shadowHalf; cam.bottom = -shadowHalf;
    cam.near = 10; cam.far = 4000;
    cam.updateProjectionMatrix();
    // The shadow map render target is sized from mapSize at creation time and isn't resized
    // in place; dispose it so three recreates it (at the current mapSize) on the next frame.
    if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; }
    l.shadow.needsUpdate = true;
  }, [shadowHalf, shadowMap]);

  useFrame(() => {
    const l = light.current;
    if (!l || shadowHalf <= 0) return;
    camPosArr[0] = camera.position.x; camPosArr[1] = camera.position.y; camPosArr[2] = camera.position.z;
    camera.getWorldDirection(tmpDir);
    camDirArr[0] = tmpDir.x; camDirArr[1] = tmpDir.y; camDirArr[2] = tmpDir.z;
    sunDirArr[0] = sun.dir.x; sunDirArr[1] = sun.dir.y; sunDirArr[2] = sun.dir.z;
    shadowFocus(camPosArr, camDirArr, sunDirArr, shadowHalf, shadowMap || 1, focusOut);
    l.position.set(focusOut.position[0], focusOut.position[1], focusOut.position[2]);
    l.target.position.set(focusOut.target[0], focusOut.target[1], focusOut.target[2]);
    l.target.updateMatrixWorld();
  });

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
      />
    </>
  );
}
