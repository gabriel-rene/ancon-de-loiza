import { Environment } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import type { Atmosphere } from '../geo/atmosphere';
import { shadowFocus, shadowSetupFor, type ShadowFocusResult, type ShadowSetup } from './shadowFocus';
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
  const now = useRef({ half: 0, mapSize: 0, radius: 1 });
  const apply = (l: THREE.DirectionalLight, s: ShadowSetup) => {
    const cam = l.shadow.camera, n = now.current;
    cam.left = -s.half; cam.right = s.half;
    cam.top = s.half; cam.bottom = -s.half;
    cam.near = 10; cam.far = 4000;
    cam.updateProjectionMatrix();
    l.shadow.radius = s.radius;
    if (s.mapSize !== n.mapSize) {
      // The shadow map render target is sized from mapSize at creation time and isn't resized
      // in place; dispose it so three recreates it (at the new mapSize) on the next frame.
      l.shadow.mapSize.set(s.mapSize || 1, s.mapSize || 1);
      if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; }
    }
    l.shadow.needsUpdate = true;
    n.half = s.half; n.mapSize = s.mapSize; n.radius = s.radius;
  };
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    now.current.mapSize = -1;   // force the map to be rebuilt at the tier's size
    apply(l, shadowSetupFor(shadowHalf, shadowMap, camera.position.y));
  }, [shadowHalf, shadowMap]);   // the camera height is re-read every frame below

  useFrame(() => {
    const l = light.current;
    if (!l || shadowHalf <= 0) return;
    // Extent, map size and blur follow the camera height (a high Sky camera widens and softens the map);
    // the frustum and map are only rebuilt when they change.
    const s = shadowSetupFor(shadowHalf, shadowMap, camera.position.y), n = now.current;
    if (s.half !== n.half || s.mapSize !== n.mapSize) apply(l, s);
    camPosArr[0] = camera.position.x; camPosArr[1] = camera.position.y; camPosArr[2] = camera.position.z;
    camera.getWorldDirection(tmpDir);
    camDirArr[0] = tmpDir.x; camDirArr[1] = tmpDir.y; camDirArr[2] = tmpDir.z;
    sunDirArr[0] = sun.dir.x; sunDirArr[1] = sun.dir.y; sunDirArr[2] = sun.dir.z;
    shadowFocus(camPosArr, camDirArr, sunDirArr, s.half, s.mapSize || 1, focusOut);
    l.position.set(focusOut.position[0], focusOut.position[1], focusOut.position[2]);
    l.target.position.set(focusOut.target[0], focusOut.target[1], focusOut.target[2]);
    l.target.updateMatrixWorld();
  });

  // Do NOT key or remount this <Environment> (or <SkyAndLight> itself): three never frees the PMREM made from a
  // render-target environment, so every remount leaks a texture + framebuffer (tests/e2e/leak.spec.ts catches it).
  const envSky = useMemo(() => <SkyDome dir={sun.dir} atm={sun.atm} />, [sun]);

  return (
    <>
      <SkyDome dir={sun.dir} atm={atm} />
      <Environment resolution={128} frames={1}>{envSky}</Environment>
      {/* Sky fill: the PMREM sky alone left shadows black, so houses and groves seen from the Sky view stood
          on dark blocks (6a open items 3 and 4). Cool sky from above, warm earth bounce from below. */}
      <hemisphereLight color={new THREE.Color(...atm.fogAway)} groundColor={new THREE.Color(0.30, 0.22, 0.12)} intensity={atm.fillIntensity} />
      <directionalLight
        ref={light}
        color={new THREE.Color(...atm.sunColor)}
        intensity={atm.sunIntensity}
        castShadow={shadowMap > 0}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
      />
    </>
  );
}
