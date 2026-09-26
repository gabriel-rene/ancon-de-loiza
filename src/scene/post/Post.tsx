import { useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, Noise, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEffect, useMemo, type ReactElement } from 'react';
import type { Sun } from '../useSun';
import { HeightFogEffect } from './HeightFogEffect';

export function Post({ sun, ao }: { sun: Sun; ao: boolean }) {
  const camera = useThree((s) => s.camera);
  const fog = useMemo(() => new HeightFogEffect(camera), [camera]);
  useEffect(() => fog.setAtmosphere(sun), [fog, sun]);
  useEffect(() => () => fog.dispose(), [fog]);
  return (
    <EffectComposer multisampling={0}>
      {(
        [
          ao ? <N8AO key="ao" aoRadius={3} distanceFalloff={1.5} intensity={2.2} halfRes /> : null,
          <primitive key="fog" object={fog} />,
          <Bloom key="bloom" mipmapBlur intensity={0.35} luminanceThreshold={3} luminanceSmoothing={0.3} />,
          <ToneMapping key="tonemap" mode={ToneMappingMode.AGX} />,
          <Vignette key="vignette" offset={0.3} darkness={0.5} />,
          <Noise key="noise" opacity={0.025} premultiply />,
          <SMAA key="smaa" />,
        ] as (ReactElement | null)[]
      ).filter(Boolean)}
    </EffectComposer>
  );
}
