import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import type { WorldFields } from '../../terrain/fields';
import type { Sun } from '../useSun';
import { makeInfoTexture } from '../useWorldFields';
import { waterFragment, waterVertex } from './waterShader';

const RIVER_DIR = new THREE.Vector2(1, -1).normalize();
const WIND_DIR = new THREE.Vector2(-1, 0.35).normalize();

export function Water({ near, far, sun, flow, reflScale, frozen }: {
  near: WorldFields; far: WorldFields; sun: Sun; flow: number; reflScale: number; frozen: boolean;
}) {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const rect = (f: WorldFields) => new THREE.Vector4(f.grid.minX, f.grid.minZ, f.grid.cell * f.grid.size, 0);

  const mirror = useMemo(() => {
    const r = new Reflector(new THREE.PlaneGeometry(40000, 40000), {
      textureWidth: Math.round(size.width * dpr * reflScale),
      textureHeight: Math.round(size.height * dpr * reflScale),
      clipBias: 0.003,
      shader: {
        name: 'AnconWater',
        uniforms: {
          color: { value: null },
          tDiffuse: { value: null },
          textureMatrix: { value: null },
          uNearInfo: { value: null }, uNearRect: { value: new THREE.Vector4() },
          uFarInfo: { value: null }, uFarRect: { value: new THREE.Vector4() },
          uTime: { value: 0 },
          uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() }, uSunIntensity: { value: 1 },
          uRiverFlow: { value: new THREE.Vector2() }, uWind: { value: WIND_DIR.clone() },
          uHazeColor: { value: new THREE.Color() }, uHazeAway: { value: new THREE.Color() }, uHaze: { value: 0 },
        },
        vertexShader: waterVertex,
        fragmentShader: waterFragment,
      },
    });
    r.rotation.x = -Math.PI / 2;
    return r;
  }, [size.width, size.height, dpr, reflScale]);

  const u = (mirror.material as THREE.ShaderMaterial).uniforms;

  useEffect(() => {
    const a = makeInfoTexture(near.waterInfo, near.grid.size), b = makeInfoTexture(far.waterInfo, far.grid.size);
    u.uNearInfo.value = a; u.uNearRect.value = rect(near);
    u.uFarInfo.value = b; u.uFarRect.value = rect(far);
    return () => { a.dispose(); b.dispose(); };
  }, [near, far, u]);

  useEffect(() => {
    u.uSunDir.value.copy(sun.dir);
    u.uSunColor.value.setRGB(...sun.atm.sunColor);
    u.uSunIntensity.value = sun.atm.sunIntensity;
    u.uHazeColor.value.setRGB(...sun.atm.fogColor);
    u.uHazeAway.value.setRGB(...sun.atm.fogAway);
    u.uHaze.value = sun.atm.reflectionHaze;
    u.uRiverFlow.value.copy(RIVER_DIR).multiplyScalar(flow / 0.35);
  }, [sun, flow, u]);

  useEffect(() => () => { mirror.geometry.dispose(); mirror.dispose(); }, [mirror]);

  useFrame((_, dt) => { if (!frozen) u.uTime.value += dt; else u.uTime.value = 10; });

  return <primitive object={mirror} />;
}
